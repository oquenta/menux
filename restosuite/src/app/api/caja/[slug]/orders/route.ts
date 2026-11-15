import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { expirarVencidos } from "@/lib/orders";
import { ORDEN_STATUS } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireUser(["CAJERO", "GERENTE"]);
  if (!s || s.slug !== slug) return NextResponse.json({ error: "NO_AUTORIZADO" }, { status: 401 });
  const tenant = await db.tenant.findUnique({ where: { slug } });
  await expirarVencidos(tenant!.id);
  const orders = await db.order.findMany({
    where: { tenantId: tenant!.id, createdAt: { gte: new Date(Date.now() - 86400000) } },
    include: { items: { orderBy: { id: "asc" } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  // PRIORIDAD DE COLA: EN_CAJA primero
  const weight = (st: string) => ({ EN_CAJA: 0, PAGADO: 1, ANULADO: 2, EXPIRADO: 2 }[st] ?? 3);
  orders.sort((a, b) => weight(a.status) - weight(b.status) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json(orders, { headers: { "Cache-Control": "no-store" } });
}
void ORDEN_STATUS;
