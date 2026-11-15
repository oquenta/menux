import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { cobrarPedido } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser(["CAJERO", "GERENTE"]);
  if (!s?.tenantId) return NextResponse.json({ error: "NO_AUTORIZADO" }, { status: 401 });
  const body = await _req.json().catch(() => ({} as { method?: string; receivedCents?: number; serviceType?: string; providerId?: string }));
  const method = body.method === "QR" ? "QR" : "EFECTIVO";
  const order = await db.order.findUnique({ where: { id } });
  if (!order || order.tenantId !== s.tenantId) return NextResponse.json({ error: "NO_EXISTE" }, { status: 404 });
  try {
    if (body.serviceType && body.serviceType !== order.serviceType) {
      await db.order.update({ where: { id }, data: { serviceType: body.serviceType } });
    }
    const updated = await cobrarPedido(id, method, {
      receivedCents: body.receivedCents,
      providerId: body.providerId,
      actorEmail: s.email,
    });
    return NextResponse.json({ ok: true, code: updated.code, changeCents: updated.changeCents });
  } catch (e) {
    const m = e instanceof Error ? e.message : "ERROR";
    const map: Record<string, string> = {
      ESTADO_INVALIDO: "El pedido ya no está en caja",
      EXPIRADO: "El pedido expiró (30 min) — anúlalo para devolver el stock",
      MONTO_INSUFICIENTE: "El monto entregado es menor que el total",
    };
    return NextResponse.json({ error: map[m] ?? m }, { status: 400 });
  }
}
