import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crearPedido } from "@/lib/orders";
import { ORDEN_STATUS } from "@/lib/domain";

export const dynamic = "force-dynamic";

type Body = {
  tenant: string; tableId?: string; alias: string; phone: string;
  source?: "CLIENTE_QR" | "CAJERO"; serviceType?: string; notes?: string;
  items: Record<string, number>;
};

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b?.tenant || !b.items || Object.keys(b.items).length === 0)
    return NextResponse.json({ error: "Carrito vacío" }, { status: 400 });
  if (!b.alias?.trim() || !b.phone?.trim())
    return NextResponse.json({ error: "Alias y celular son obligatorios (control de pedidos R4)" }, { status: 400 });

  const tenant = await db.tenant.findUnique({ where: { slug: b.tenant } });
  if (!tenant) return NextResponse.json({ error: "Restaurante no existe" }, { status: 404 });
  if (tenant.subStatus === "VENCIDA")
    return NextResponse.json({ error: "Suscripción vencida — el restaurante no puede recibir pedidos" }, { status: 402 });

  const lines = Object.entries(b.items).filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }));

  try {
    const order = await crearPedido({
      tenantId: tenant.id,
      tableId: b.tableId ?? null,
      tableNumber: b.tableId ? (await db.table.findUnique({ where: { id: b.tableId } }))?.number ?? null : null,
      alias: b.alias.trim(),
      phone: b.phone.trim(),
      source: b.source === "CAJERO" ? "CAJERO" : "CLIENTE_QR",
      serviceType: b.serviceType === "PARA_LLEVAR" ? "PARA_LLEVAR" : "EN_LOCAL",
      notes: typeof b.notes === "string" ? b.notes.slice(0, 200) : undefined,
      lines,
    });
    return NextResponse.json({ ok: true, code: order.code, totalCents: order.totalCents, expiresAt: order.expiresAt });
  } catch (e) {
    const m = e instanceof Error ? e.message : "ERROR";
    if (m === "MESA_OCUPADA") return NextResponse.json({ error: "Esta mesa ya tiene un pedido En caja. Pago o anula el pedido #existente antes de iniciar otro (R5)." }, { status: 409 });
    if (m?.startsWith("SIN_STOCK:")) return NextResponse.json({ error: `Sin stock: ${m.split(":")[1]}` }, { status: 400 });
    if (m === "SUSCRIPCION_VENCIDA") return NextResponse.json({ error: "Suscripción vencida" }, { status: 402 });
    return NextResponse.json({ error: m }, { status: 500 });
  }
}
void ORDEN_STATUS;
