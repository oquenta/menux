import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ORDEN_STATUS } from "@/lib/domain";
import PedidoStatus from "./PedidoStatus";

export const dynamic = "force-dynamic";

export default async function PedidoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const order = await db.order.findFirst({ where: { code, createdAt: { gte: new Date(Date.now() - 86400000) } }, include: { items: true } });
  if (!order) notFound();
  const status = order.status === ORDEN_STATUS.EN_CAJA && order.expiresAt < new Date() ? ORDEN_STATUS.EXPIRADO : order.status;
  return (
    <PedidoStatus
      initial={{
        code: order.code, status, totalCents: order.totalCents, alias: order.aliasSnapshot ?? undefined,
        phone: order.phoneSnapshot ?? undefined, tableNumber: order.tableNumber ?? undefined,
        method: order.method ?? undefined, changeCents: order.changeCents ?? undefined,
        serviceType: order.serviceType, expiresAt: order.expiresAt.toISOString(), createdAt: order.createdAt.toISOString(),
        items: order.items.map((i) => ({ name: i.nameSnapshot, emoji: i.emojiSnapshot, qty: i.qty, unitCents: i.unitPriceCents })),
      }}
    />
  );
}
