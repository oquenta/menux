// src/lib/orders.ts — lógica de pedidos: máquina de estados, TTL, stock transaccional (Art. II, R5, R6, R10)
import { db } from "./db";
import { ORDEN_STATUS } from "./domain";
import { generarCodigo } from "./codes";
import { mul } from "./money";

export type CartLine = { productId: string; qty: number };

/** Devuelve stock y anula pedidos EN_CAJA cuyo TTL expiró (lazily en cada lectura/creación) */
export async function expirarVencidos(tenantId: string) {
  const vencidos = await db.order.findMany({
    where: { tenantId, status: ORDEN_STATUS.EN_CAJA, expiresAt: { lt: new Date() } },
    include: { items: true },
  });
  for (const o of vencidos) {
    await anularConDevolucion(o.id, ORDEN_STATUS.EXPIRADO, "sistema/TTL");
  }
}

/** Crea un pedido: congela precios (snapshot), descuenta stock transaccionalmente, genera código */
export async function crearPedido(opts: {
  tenantId: string; tableId?: string | null; tableNumber?: number | null;
  alias: string; phone: string; source: "CLIENTE_QR" | "CAJERO";
  serviceType?: string; notes?: string;
  lines: CartLine[];
}) {
  await expirarVencidos(opts.tenantId);
  const tenant = await db.tenant.findUnique({ where: { id: opts.tenantId } });
  if (!tenant || tenant.subStatus === "VENCIDA") throw new Error("SUSCRIPCION_VENCIDA");

  const session = await db.clientSession.create({
    data: { tenantId: opts.tenantId, tableId: opts.tableId ?? null, alias: opts.alias, phone: opts.phone },
  });

  // R5: un pedido abierto por mesa (solo aplica a pedidos con mesa asignada)
  if (opts.tableNumber != null) {
    const abierto = await db.order.findFirst({
      where: { tenantId: opts.tenantId, tableNumber: opts.tableNumber, status: ORDEN_STATUS.EN_CAJA },
    });
    if (abierto) throw new Error("MESA_OCUPADA");
  }

  const products = await db.product.findMany({
    where: { id: { in: opts.lines.map((l) => l.productId) }, tenantId: opts.tenantId, active: true },
    include: { category: true },
  });
  const map = new Map(products.map((p) => [p.id, p]));

  let totalCents = 0;
  const items = opts.lines.map((l) => {
    const p = map.get(l.productId);
    if (!p) throw new Error("PRODUCTO_INVALIDO");
    if (p.trackStock && p.stock < l.qty) throw new Error(`SIN_STOCK:${p.name}`);
    totalCents = mul(l.qty, p.priceCents) + totalCents;
    return {
      productId: p.id,
      nameSnapshot: p.name,           // Art. III: snapshot
      emojiSnapshot: p.emoji,
      unitPriceCents: p.priceCents,   // snapshot
      qty: l.qty,
      kindSnapshot: p.category.kind,  // R7: comandas por categoría
    };
  });

  const unique = new Set(products.filter((p) => p.trackStock).map((p) => p.id));
  void unique;

  const order = await db.$transaction(async (tx) => {
    // decremento condicional de stock (R10)
    for (const l of opts.lines) {
      const p = map.get(l.productId)!;
      if (p.trackStock) {
        const upd = await tx.product.updateMany({
          where: { id: l.productId, stock: { gte: l.qty } },
          data: { stock: { decrement: l.qty } },
        });
        if (upd.count === 0) throw new Error(`SIN_STOCK:${p.name}`);
        await tx.stockMovement.create({
          data: { tenantId: opts.tenantId, productId: l.productId, delta: -l.qty, reason: "VENTA" },
        });
      }
    }
    let code = generarCodigo();
    for (let tries = 0; tries < 5; tries++) {
      const exists = await tx.order.findFirst({ where: { tenantId: opts.tenantId, code, createdAt: { gte: new Date(Date.now() - 86400000) } } });
      if (!exists) break;
      code = generarCodigo();
    }
    return tx.order.create({
      data: {
        tenantId: opts.tenantId,
        sessionId: session.id,
        code,
        source: opts.source,
        serviceType: opts.serviceType || "EN_LOCAL",
        tableNumber: opts.tableNumber ?? null,
        aliasSnapshot: opts.alias, phoneSnapshot: opts.phone,
        notes: opts.notes || null,
        expiresAt: new Date(Date.now() + tenant.orderTtlMinutes * 60000),
        totalCents,
        items: { create: items },
      },
      include: { items: true },
    });
  });
  return order;
}

/** Anula/expira un pedido y devuelve stock */
export async function anularConDevolucion(orderId: string, status: "ANULADO" | "EXPIRADO" = ORDEN_STATUS.ANULADO, actor = "cajero") {  const o = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!o || o.status !== ORDEN_STATUS.EN_CAJA) throw new Error("ESTADO_INVALIDO");
  await db.$transaction(async (tx) => {
    for (const it of o.items) {
      const p = await tx.product.findUnique({ where: { id: it.productId } });
      if (p?.trackStock) {
        await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.qty } } });
        await tx.stockMovement.create({
          data: { tenantId: o.tenantId, productId: it.productId, delta: it.qty, reason: "DEVOLUCION" },
        });
      }
    }
    await tx.order.update({ where: { id: o.id }, data: { status, closedAt: new Date() } });
    await tx.auditLog.create({
      data: { tenantId: o.tenantId, action: `ANULAR_${status}`, entity: "Order", entityId: o.id, detail: `código ${o.code} por ${actor}` },
    });
  });
}

/** Cobro idempotente (Art. II): doble POST no cobra dos veces */
export async function cobrarPedido(orderId: string, method: "EFECTIVO" | "QR", opts?: { receivedCents?: number; providerId?: string; actorEmail?: string }) {
  const o = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!o) throw new Error("NO_EXISTE");
  if (o.status !== ORDEN_STATUS.EN_CAJA) throw new Error("ESTADO_INVALIDO");
  if (o.expiresAt < new Date()) throw new Error("EXPIRADO");

  const paidCents = o.totalCents;
  const changeCents = method === "EFECTIVO" ? Math.max(0, (opts?.receivedCents || 0) - o.totalCents) : 0;
  if (method === "EFECTIVO" && (opts?.receivedCents || 0) < o.totalCents) throw new Error("MONTO_INSUFICIENTE");

  const updated = await db.order.update({
    where: { id: o.id },
    data: {
      status: ORDEN_STATUS.PAGADO, paidCents, changeCents, method,
      paidAt: new Date(), closedAt: new Date(),
      payments: {
        create: {
          method,
          providerId: method === "QR" ? (opts?.providerId ?? null) : null,
          providerRef: `rst-${o.id}-${method}`,
          amountCents: paidCents,
        },
      },
    },
  });
  await db.auditLog.create({
    data: { tenantId: o.tenantId, actorEmail: opts?.actorEmail, action: "COBRAR", entity: "Order", entityId: o.id, detail: `código ${o.code} · ${method}` },
  });
  return updated;
}
