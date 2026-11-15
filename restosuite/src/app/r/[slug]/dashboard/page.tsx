import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { fmt } from "@/lib/money";
import { ORDEN_STATUS } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireUser(["GERENTE"]);
  if (!s) redirect("/login");
  const tenant = await db.tenant.findUnique({ where: { slug } });

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const pagados = await db.order.findMany({
    where: { tenantId: tenant!.id, status: ORDEN_STATUS.PAGADO, paidAt: { gte: startOfDay } },
    include: { items: { include: { product: true } } },
  });
  const ventasHoy = pagados.reduce((a, o) => a + o.totalCents, 0);
  const ticketProm = pagados.length ? Math.round(ventasHoy / pagados.length) : 0;

  // Top productos vendidos (R8)
  const counter = new Map<string, { name: string; emoji: string; units: number }>();
  for (const o of pagados) for (const it of o.items) {
    const cur = counter.get(it.productId) ?? { name: it.nameSnapshot, emoji: it.emojiSnapshot, units: 0 };
    cur.units += it.qty; counter.set(it.productId, cur);
  }
  const top = [...counter.values()].sort((a, b) => b.units - a.units).slice(0, 5);

  const lowStock = await db.product.findMany({
    where: { tenantId: tenant!.id, trackStock: true, stock: { lte: 3 }, active: true },
    include: { category: true },
    orderBy: { stock: "asc" },
  });

  const enCaja = await db.order.count({ where: { tenantId: tenant!.id, status: ORDEN_STATUS.EN_CAJA } });

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Resumen del negocio</h1>
      <p className="text-muted">{tenant!.name} · {new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Ventas de hoy" value={fmt(ventasHoy)} />
        <Kpi title="Pedidos pagados hoy" value={String(pagados.length)} />
        <Kpi title="Ticket promedio" value={fmt(ticketProm)} />
        <Kpi title="En caja ahora" value={String(enCaja)} accent="text-gold" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-extrabold">🏆 Productos más vendidos (hoy)</h2>
          {top.length === 0 ? <p className="mt-3 text-sm text-muted">Aún no hay ventas pagadas hoy. Cobra un pedido en la caja para poblar el ranking.</p> : (
            <div className="mt-4 space-y-3">
              {top.map((p, i) => (
                <div key={p.name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{i + 1} · {p.emoji} {p.name}</span>
                    <span className="font-extrabold">{p.units} u</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-paper"><div className="h-2 rounded-full bg-terra" style={{ width: `${Math.min(100, (p.units / top[0].units) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-extrabold">⚠️ Stock agotado / bajo (R10)</h2>
          {lowStock.length === 0 ? <p className="mt-3 text-sm text-muted">Inventario saludable.</p> : (
            <div className="mt-4 space-y-2">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-2.5 text-sm">
                  <span className="font-semibold">{p.emoji} {p.name} <span className="text-muted">· {p.category.name}</span></span>
                  {p.stock === 0 ? <span className="badge-berry">🚫 AGOTADO</span> : <span className="badge-gold">quedan {p.stock}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value, accent }: { title: string; value: string; accent?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-muted">{title}</div>
      <div className={`mt-2 text-3xl font-extrabold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
