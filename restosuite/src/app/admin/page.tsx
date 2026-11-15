import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { fmt } from "@/lib/money";
import { subBadge } from "@/lib/domain";
import { crearTenant, renovarSuscripcion, crearUsuarioTenant, resetPasswordUsuario } from "./actions";

export const dynamic = "force-dynamic";

type SP = { ok?: string; err?: string };
const FEEDBACK: Record<string, { ok?: string; err?: string }> = {
  usuario_creado: { ok: "Usuario creado correctamente. Ya puede iniciar sesión." },
  password_reset: { ok: "Contraseña restablecida/actualizada correctamente. El usuario puede iniciar sesión con la nueva clave." },
  datos_usuario: { err: "Completa restaurante, nombre, correo y rol." },
  pass_corta: { err: "La contraseña debe tener al menos 6 caracteres." },
  pass_confirm: { err: "La confirmación de contraseña no coincide." },
  rol: { err: "Rol inválido." },
  tenant: { err: "Restaurante no encontrado." },
  email_usuario: { err: "Ese correo ya está registrado." },
  sel_usuario: { err: "Selecciona un usuario." },
  usuario_no: { err: "Usuario no encontrado." },
  superadmin: { err: "No se puede restablecer la contraseña del SUPERADMIN desde aquí." },
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await requireUser(["SUPERADMIN"]);
  if (!s) redirect("/login");

  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: "asc" },
    include: { users: { select: { id: true, name: true, email: true, role: true, displayName: true } } },
  });
  const notifications = await db.subscriptionEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { tenant: { select: { name: true, slug: true } } },
  });
  const mrr = tenants.filter((t) => t.subStatus !== "VENCIDA").reduce((a, t) => a + t.priceCents, 0);
  const porVencer = tenants.filter((t) => { const d = Math.ceil((t.subExpiresAt.getTime() - Date.now()) / 86400000); return d >= 0 && d <= 15; }).length;
  const vencidas = tenants.filter((t) => t.subExpiresAt < new Date()).length;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar name={s.name} />
      {/* Mobile nav */}
      <div className="md:hidden bg-night border-b border-nightline px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-terra text-sm font-extrabold text-gold">R</div>
            <span className="font-extrabold text-white text-sm">RestoSuite Admin</span>
          </div>
          <Link href="/api/auth/logout" className="text-paper/50 hover:text-white text-sm">⎋ Salir</Link>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Link href="/admin" className="sidebar-link-active !py-1.5 !px-3 text-xs whitespace-nowrap">Dashboard</Link>
          <Link href="/admin#restaurantes" className="sidebar-link !py-1.5 !px-3 text-xs whitespace-nowrap">🏪 Restaurantes</Link>
          <Link href="/admin#suscripciones" className="sidebar-link !py-1.5 !px-3 text-xs whitespace-nowrap">💳 Suscripciones</Link>
          <Link href="/admin#notificaciones" className="sidebar-link !py-1.5 !px-3 text-xs whitespace-nowrap">🔔 Notificaciones</Link>
        </nav>
      </div>
      <main className="flex-1 p-4 md:p-8 min-w-0">
        <h1 className="text-xl md:text-2xl font-extrabold">Dashboard global</h1>
        <p className="text-muted text-sm">Restaurantes del sistema · suscripciones y vencimientos (R9)</p>

        {sp.ok && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            ✓ {FEEDBACK[sp.ok]?.ok || "Operación realizada correctamente."}
          </div>
        )}
        {sp.err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {FEEDBACK[sp.err]?.err || "No se pudo completar la operación."}
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi title="Restaurantes activos" value={String(tenants.filter((t) => t.subStatus !== "VENCIDA").length)} tone="ink" />
          <Kpi title="Por vencer (≤15 días)" value={String(porVencer)} tone="gold" />
          <Kpi title="Vencidas (bloqueadas)" value={String(vencidas)} tone="berry" />
          <Kpi title="Ingreso mensual (MRR)" value={fmt(mrr)} tone="moss" />
        </div>

        <div id="restaurantes" className="mt-8 grid gap-5 lg:grid-cols-3">
          <form action={crearTenant} className="card p-5 lg:col-span-1">
            <h2 className="font-extrabold">+ Nuevo restaurante</h2>
            <label className="label mt-4">Nombre del restaurante</label>
            <input name="name" required placeholder="Mi Sabor Criollo" className="input" />
            <label className="label mt-3">Plan</label>
            <select name="plan" className="input" defaultValue="BÁSICO">
              <option>BÁSICO</option><option>PROFESIONAL</option><option>PREMIUM</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label mt-3">Contrato (meses)</label>
                <input name="months" type="number" min={1} max={60} defaultValue={12} className="input" />
              </div>
              <div>
                <label className="label mt-3">Renta (Bs/mes)</label>
                <input name="price" defaultValue="79" className="input" />
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <h3 className="font-bold text-sm">Gerente del restaurante (obligatorio)</h3>
              <p className="text-xs text-muted mt-0.5">Se crea junto con el restaurante para que pueda iniciar sesión y gestionar el negocio.</p>
              <label className="label mt-3">Nombre del gerente</label>
              <input name="gerenteName" required placeholder="Ej. Ana Pérez" className="input" />
              <label className="label mt-3">Correo (login)</label>
              <input name="gerenteEmail" type="email" required placeholder="gerente@mirestaurante.app" className="input" />
              <label className="label mt-3">Contraseña (≥ 6)</label>
              <input name="gerentePassword" type="password" required minLength={6} placeholder="••••••" className="input" />
              <label className="label mt-3">Iniciales (opcional)</label>
              <input name="gerenteDisplay" maxLength={2} placeholder="AP" className="input" />
            </div>

            <button className="btn-primary mt-5 w-full">Crear restaurante + gerente</button>
          </form>

          <div id="suscripciones" className="card overflow-x-auto lg:col-span-2">
            <div className="border-b border-line px-5 py-4 font-extrabold">Vencimientos y control</div>
            <table className="w-full min-w-[700px]">
              <thead><tr><th className="th">Restaurante</th><th className="th">Usuarios asignados</th><th className="th">Plan</th><th className="th">Vence</th><th className="th">Estado</th><th className="th">Acciones</th></tr></thead>
              <tbody>
                {tenants.map((t) => {
                  const b = subBadge(t.subStatus, t.subExpiresAt);
                  const date = t.subExpiresAt.toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
                  const days = `en ${b.days} d`;
                  const gerentes = t.users.filter((u) => u.role === "GERENTE");
                  const cajeros = t.users.filter((u) => u.role === "CAJERO");
                  return (
                    <tr key={t.id}>
                      <td className="td font-semibold">
                        {t.name}
                        <div className="text-xs text-muted">/{t.slug}</div>
                      </td>
                      <td className="td">
                        <div className="text-xs space-y-0.5">
                          <div><span className="font-semibold">Gerentes:</span> {gerentes.length ? gerentes.map((u) => u.email).join(", ") : <span className="text-berry">sin gerente</span>}</div>
                          <div><span className="font-semibold">Cajeros:</span> {cajeros.length ? cajeros.length : "0"}</div>
                        </div>
                      </td>
                      <td className="td">{t.plan}</td>
                      <td className="td">{date}<div className="text-xs text-muted">{days}</div></td>
                      <td className="td">
                        <span className={b.tone === "moss" ? "badge-moss" : b.tone === "gold" ? "badge-gold" : "badge-berry"}>
                          {t.subExpiresAt < new Date() ? "🔒 VENCIDA" : b.label}
                        </span>
                      </td>
                      <td className="td">
                        <form action={renovarSuscripcion} className="flex items-center gap-1.5">
                          <input type="hidden" name="tenantId" value={t.id} />
                          <select name="months" defaultValue="6" className="input !py-1.5 !w-16">
                            <option>1</option><option>3</option><option>6</option><option>12</option>
                          </select>
                          <button className="btn-ghost !py-1.5 !px-3 text-xs">Renovar</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="font-extrabold">+ Crear usuario para restaurante existente</h2>
            <p className="text-sm text-muted mt-1">Agrega un <b>gerente</b> (si falta) o un <b>cajero</b> a cualquier restaurante registrado. El gerente también puede crear cajeros desde su panel.</p>
            <form action={crearUsuarioTenant} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Restaurante</label>
                <select name="tenantId" className="input" required defaultValue="">
                  <option value="" disabled>Selecciona un restaurante…</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Rol</label>
                <select name="role" className="input" defaultValue="CAJERO">
                  <option value="GERENTE">GERENTE</option>
                  <option value="CAJERO">CAJERO</option>
                </select>
              </div>
              <div>
                <label className="label">Nombre</label>
                <input name="name" required className="input" placeholder="Nombre completo" />
              </div>
              <div>
                <label className="label">Correo (login)</label>
                <input name="email" type="email" required className="input" placeholder="usuario@restaurante.app" />
              </div>
              <div>
                <label className="label">Contraseña (≥ 6)</label>
                <input name="password" type="password" required minLength={6} className="input" placeholder="••••••" />
              </div>
              <div>
                <label className="label">Iniciales (opcional)</label>
                <input name="displayName" maxLength={2} className="input" placeholder="AB" />
              </div>
              <div className="sm:col-span-2">
                <button className="btn-primary">Crear usuario</button>
              </div>
            </form>
          </div>

          <div className="card p-5">
            <h2 className="font-extrabold">🔑 Restablecer contraseña</h2>
            <p className="text-sm text-muted mt-1">Selecciona un usuario (gerente o cajero) y asigna una nueva contraseña. El usuario podrá iniciar sesión inmediatamente con la nueva clave.</p>
            <form action={resetPasswordUsuario} className="mt-4 space-y-3">
              <div>
                <label className="label">Usuario</label>
                <select name="userId" className="input" required defaultValue="">
                  <option value="" disabled>Selecciona un usuario…</option>
                  {tenants.flatMap((t) => t.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email} — {u.role} — {t.name} (/{t.slug})
                    </option>
                  )))}
                </select>
              </div>
              <div>
                <label className="label">Nueva contraseña (≥ 6)</label>
                <input name="password" type="password" required minLength={6} autoComplete="new-password" className="input" placeholder="••••••" />
              </div>
              <div>
                <label className="label">Confirmar nueva contraseña</label>
                <input name="confirm" type="password" required minLength={6} autoComplete="new-password" className="input" placeholder="••••••" />
              </div>
              <button className="btn-primary">Restablecer contraseña</button>
            </form>
            <p className="mt-3 text-xs text-muted">Nota: el SUPERADMIN no aparece en esta lista. Los gerentes también pueden restablecer contraseñas de sus cajeros desde <span className="font-mono">/r/[slug]/staff</span>.</p>
          </div>
        </div>

        <div id="notificaciones" className="mt-8 card overflow-hidden">
          <div className="border-b border-line px-5 py-4 font-extrabold">🔔 Notificaciones de suscripción</div>
          {notifications.length === 0 ? (
            <div className="p-5 text-sm text-muted">No hay notificaciones recientes. Los eventos de vencimiento y renovación aparecerán aquí.</div>
          ) : (
            <div className="divide-y divide-line">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div>
                    <div className="font-semibold text-sm">{n.tenant?.name ?? "Sistema"} <span className="text-muted font-normal">/{n.tenant?.slug ?? ""}</span></div>
                    <div className="text-sm">{n.message ?? n.type}</div>
                    <div className="text-xs text-muted mt-0.5">{n.type}</div>
                  </div>
                  <div className="text-xs text-muted whitespace-nowrap">{n.createdAt.toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Sidebar({ name }: { name: string }) {
  return (
    <aside className="hidden w-64 flex-col bg-night p-5 md:flex">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-terra text-lg font-extrabold text-gold">R</div>
        <div>
          <div className="font-extrabold text-white">RestoSuite</div>
          <div className="text-xs text-paper/50">Panel del operador</div>
        </div>
      </div>
      <nav className="space-y-1">
        <Link href="/admin" className="sidebar-link-active block">▦ Dashboard</Link>
        <Link href="/admin#restaurantes" className="sidebar-link block">🏪 Restaurantes</Link>
        <Link href="/admin#suscripciones" className="sidebar-link block">💳 Suscripciones</Link>
        <Link href="/admin#notificaciones" className="sidebar-link block">🔔 Notificaciones</Link>
      </nav>
      <div className="mt-auto flex items-center gap-3 rounded-xl bg-nightcard p-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-terra text-xs font-bold text-white">{name.slice(0, 2).toUpperCase()}</div>
        <div className="flex-1 text-xs">
          <div className="font-bold text-white">{name}</div>
          <div className="text-paper/50">SUPERADMIN</div>
        </div>
        <Link href="/api/auth/logout" className="text-paper/50 hover:text-white">⎋</Link>
      </div>
    </aside>
  );
}

function Kpi({ title, value, tone }: { title: string; value: string; tone: "ink" | "gold" | "berry" | "moss" }) {
  const toneCls = tone === "berry" ? "text-berry" : tone === "gold" ? "text-[#8a5b12]" : tone === "moss" ? "text-moss" : "text-ink";
  return (
    <div className="card p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-muted">{title}</div>
      <div className={`mt-2 text-3xl font-extrabold ${toneCls}`}>{value}</div>
    </div>
  );
}
