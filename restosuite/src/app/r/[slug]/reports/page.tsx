import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { fmt } from "@/lib/money";
import { ORDEN_STATUS } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireUser(["GERENTE"]);
  if (!s) redirect("/login");
  const tenant = await db.tenant.findUnique({ where: { slug } });

  const pagados = await db.order.findMany({
    where: { tenantId: tenant!.id, status: ORDEN_STATUS.PAGADO },
    include: { items: true },
    orderBy: { paidAt: "desc" },
  });

  // Ventas por día (últimos 7 días con actividad)
  const byDay = new Map<string, { total: number; count: number }>();
  for (const o of pagados) {
    const key = (o.paidAt ?? o.createdAt).toLocaleDateString("es-BO", { day: "2-digit", month: "short" });
    const cur = byDay.get(key) ?? { total: 0, count: 0 };
    cur.total += o.totalCents; cur.count++; byDay.set(key, cur);
  }
  const days = [...byDay.entries()].slice(0, 7).reverse();

  // Ranking total histórico (R8)
  const rank = new Map<string, { name: string; emoji: string; kind: string; units: number; cents: number }>();
  const byKind = new Map<string, number>();
  for (const o of pagados) {
    for (const it of o.items) {
      const cur = rank.get(it.productId) ?? { name: it.nameSnapshot, emoji: it.emojiSnapshot, kind: it.kindSnapshot, units: 0, cents: 0 };
      cur.units += it.qty; cur.cents += it.qty * it.unitPriceCents;
      rank.set(it.productId, cur);
      byKind.set(it.kindSnapshot, (byKind.get(it.kindSnapshot) ?? 0) + it.qty * it.unitPriceCents);
    }
  }
  const top = [...rank.values()].sort((a, b) => b.units - a.units).slice(0, 10);
  const maxUnits = top[0]?.units || 1;
  const total = pagados.reduce((a, o) => a + o.totalCents, 0);
  const methods = ["EFECTIVO", "QR"].map((m) => [m, pagados.filter((o) => o.method === m).reduce((a, o) => a + o.totalCents, 0)] as const);

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Reportes</h1>
      <p className="text-muted">Ventas totales: <b>{fmt(total)}</b> en {pagados.length} pedidos pagados</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-extrabold">📅 Ventas por día</h2>
          <div className="mt-4 space-y-3">
            {days.length === 0 && <p className="text-sm text-muted">Sin ventas registradas aún.</p>}
            {days.map(([d, v]) => (
              <div key={d} className="flex items-center gap-3">
                <span className="w-20 text-sm text-muted">{d}</span>
                <div className="h-3 flex-1 rounded-full bg-paper"><div className="h-3 rounded-full bg-terra" style={{ width: `${Math.min(100, (v.total / Math.max(...days.map(([, x]) => x.total))) * 100)}%` }} /></div>
                <span className="w-24 text-right text-sm font-bold">{fmt(v.total)}</span>
                <span className="w-14 text-right text-xs text-muted">{v.count} ped.</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-extrabold">💳 Por método y categoría</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {methods.map(([m, c]) => (
              <div key={m} className="rounded-xl border border-line bg-paper p-3">
                <div className="text-xs font-bold text-muted">{m === "EFECTIVO" ? "💵 EFECTIVO" : "📱 QR"}</div>
                <div className="text-lg font-extrabold">{fmt(c)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {[["PLATO", "🏗 Comida"], ["BEBIDA", "🥤 Bebidas"], ["POSTRE", "🍮 Postres"]].map(([k, label]) => (
              <div key={k} className="flex justify-between text-sm">
                <span>{label}</span><b>{fmt(byKind.get(k) ?? 0)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4 font-extrabold">🏆 Productos más vendidos — histórico (R8)</div>
        <table className="w-full">
          <thead><tr><th className="th">#</th><th className="th">Producto</th><th className="th">Categoría</th><th className="th">Unidades</th><th className="th">Facturado</th></tr></thead>
          <tbody>
            {top.map((p, i) => (
              <tr key={p.name}>
                <td className="td font-bold">{i + 1}</td>
                <td className="td font-semibold">{p.emoji} {p.name}</td>
                <td className="td"><span className="badge-line">{p.kind}</span></td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-full max-w-[180px] rounded-full bg-paper"><div className="h-2 rounded-full bg-gold" style={{ width: `${(p.units / maxUnits) * 100}%` }} /></div>
                    <b>{p.units}</b>
                  </div>
                </td>
                <td className="td font-bold">{fmt(p.cents)}</td>
              </tr>
            ))}
            {top.length === 0 && <tr><td className="td text-muted" colSpan={5}>Sin datos — cobra pedidos para poblar reportes.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
