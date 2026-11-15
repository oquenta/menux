import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { anularConDevolucion } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser(["CAJERO", "GERENTE"]);
  if (!s?.tenantId) return NextResponse.json({ error: "NO_AUTORIZADO" }, { status: 401 });
  const order = await db.order.findUnique({ where: { id } });
  if (!order || order.tenantId !== s.tenantId) return NextResponse.json({ error: "NO_EXISTE" }, { status: 404 });
  try {
    await anularConDevolucion(id, "ANULADO", s.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const m = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: m }, { status: 400 });
  }
}
