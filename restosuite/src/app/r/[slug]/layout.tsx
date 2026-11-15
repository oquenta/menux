import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { subBadge } from "@/lib/domain";

const LINKS = [
  ["dashboard", "▦ Resumen", "/dashboard"],
  ["menu", "🍽 Menú", "/menu"],
  ["tables", "🧺 Mesas y QR", "/tables"],
  ["reports", "📊 Reportes", "/reports"],
  ["staff", "👥 Cajeros", "/staff"],
  ["cuenta", "🔑 Mi cuenta", "/cuenta"],
] as const;

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireUser(["GERENTE"]);
  if (!s) redirect("/login");
  if (s.slug !== slug) notFound();

  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();
  if (tenant.subStatus === "VENCIDA") return <TenantBlocked name={tenant.name} />;

  const badge = subBadge(tenant.subStatus, tenant.subExpiresAt);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-0 hidden h-screen w-64 flex-col bg-night p-5 md:flex">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-terra text-lg">🍽</div>
          <div>
            <div className="font-extrabold text-white">{tenant.name}</div>
            <div className="text-xs text-paper/50">Panel del gerente</div>
          </div>
        </div>
        <nav className="space-y-1">
          {LINKS.map(([k, label, href]) => (
            <Link key={k} href={`/r/${slug}${href}`} className="sidebar-link">{label}</Link>
          ))}
          <Link href={`/caja/${slug}`} className="sidebar-link">🧾 Ir a la caja</Link>
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-xl bg-nightcard p-3 text-xs">
            <div className="text-paper/50">Suscripción {badge.tone === "moss" ? "ACTIVA" : badge.label}</div>
            <div className={badge.tone === "moss" ? "font-bold text-emerald-300" : "font-bold text-amber-300"}>
              Vence {tenant.subExpiresAt.toLocaleDateString("es-BO")} · {badge.days}d
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-nightcard p-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gold text-xs font-bold">{s.name.slice(0, 2).toUpperCase()}</div>
            <div className="flex-1 text-xs">
              <div className="font-bold text-white">{s.name}</div>
              <div className="text-paper/50">GERENTE</div>
            </div>
            <Link href="/api/auth/logout" className="text-paper/50 hover:text-white">⎋</Link>
          </div>
        </div>
      </aside>
      {/* Mobile nav */}
      <div className="md:hidden bg-night border-b border-nightline px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-terra text-sm shrink-0">🍽</div>
            <span className="font-extrabold text-white text-sm truncate">{tenant.name}</span>
          </div>
          <Link href="/api/auth/logout" className="text-paper/50 hover:text-white text-sm shrink-0">⎋ Salir</Link>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {LINKS.map(([k, label, href]) => (
            <Link key={k} href={`/r/${slug}${href}`} className="sidebar-link !py-1.5 !px-3 text-xs whitespace-nowrap">{label}</Link>
          ))}
          <Link href={`/caja/${slug}`} className="sidebar-link !py-1.5 !px-3 text-xs whitespace-nowrap">🧾 Caja</Link>
        </nav>
      </div>
      <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
    </div>
  );
}

function TenantBlocked({ name }: { name: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-paper p-6">
      <div className="card max-w-md p-8 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="mt-4 text-xl font-extrabold">Suscripción vencida</h1>
        <p className="mt-2 text-muted">El acceso de <b>{name}</b> está cortado hasta renovar el contrato con el operador RestoSuite. Tus datos están intactos.</p>
        <Link href="/api/auth/logout" className="btn-ghost mt-6">← Salir</Link>
      </div>
    </div>
  );
}
