import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expirarVencidos } from "@/lib/orders";
import { ORDEN_STATUS } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const order = await db.order.findFirst({
    where: { code, createdAt: { gte: new Date(Date.now() - 86400000) } },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "NO_EXISTE" }, { status: 404 });
  await expirarVencidos(order.tenantId).catch(() => null);
  const status = order.status === ORDEN_STATUS.EN_CAJA && order.expiresAt < new Date() ? ORDEN_STATUS.EXPIRADO : order.status;
  return NextResponse.json(
    {
      code: order.code, status, serviceType: order.serviceType,
      alias: order.aliasSnapshot, tableNumber: order.tableNumber,
      totalCents: order.totalCents, expiresAt: order.expiresAt, createdAt: order.createdAt,
      method: order.method, changeCents: order.changeCents,
      items: order.items.map((i) => ({ name: i.nameSnapshot, emoji: i.emojiSnapshot, qty: i.qty, unitCents: i.unitPriceCents })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
