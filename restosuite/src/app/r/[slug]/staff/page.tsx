import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { crearCajero, resetPasswordCajero } from "./actions";

export const dynamic = "force-dynamic";

type SP = { ok?: string; err?: string };

const MSG: Record<string, { ok?: string; err?: string }> = {
  cajero_creado: { ok: "Cajero creado correctamente." },
  reset: { ok: "Contraseña del cajero actualizada correctamente." },
  datos: { err: "Completa todos los campos requeridos." },
  corta: { err: "La contraseña debe tener al menos 6 caracteres." },
  email: { err: "Ese correo ya está registrado. Usa otro correo." },
  no_encontrado: { err: "No se encontró el cajero o no pertenece a este restaurante." },
};

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const s = await requireUser(["GERENTE"]);
  if (!s) redirect("/login");
  const tenant = await db.tenant.findUnique({ where: { slug }, include: { users: { where: { role: "CAJERO" } } } });

  const info = (sp.ok && MSG[sp.ok]) || (sp.err && MSG[sp.err]) || null;
  const okMsg = sp.ok ? (MSG[sp.ok]?.ok || "Operación realizada.") : info?.ok;
  const errMsg = sp.err ? (MSG[sp.err]?.err || "No se pudo completar la operación.") : info?.err;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-extrabold">Cajeros</h1>
      <p className="text-muted">Crea cuentas de caja y restablece contraseñas para tu restaurante.</p>

      {okMsg && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">✓ {okMsg}</div>
      )}
      {errMsg && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errMsg}</div>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <form action={crearCajero} className="card h-fit p-5">
          <h2 className="font-extrabold">+ Nuevo cajero</h2>
          <label className="label mt-3">Nombre</label>
          <input name="name" required className="input" placeholder="Mario Quispert" />
          <label className="label mt-3">Correo (usuario)</label>
          <input name="email" type="email" required autoComplete="off" className="input" placeholder="cajero2@paila.app" />
          <label className="label mt-3">Iniciales para caja</label>
          <input name="displayName" maxLength={2} className="input" placeholder="MQ" />
          <label className="label mt-3">Contraseña (≥ 6)</label>
          <input name="password" type="password" required minLength={6} autoComplete="new-password" className="input" placeholder="••••••" />
          <button className="btn-primary mt-4 w-full">Crear cajero</button>
        </form>

        <div className="space-y-3">
          {tenant!.users.map((u) => (
            <div key={u.id} className="card p-4">
              <div className="flex items-center gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-gold text-sm font-extrabold shrink-0">{u.displayName}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{u.name}</div>
                  <div className="text-sm text-muted truncate">{u.email}</div>
                </div>
                <span className="badge-moss shrink-0">CAJERO</span>
              </div>
              <form action={resetPasswordCajero} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
                <input type="hidden" name="userId" value={u.id} />
                <div className="flex-1 min-w-[160px]">
                  <label className="label !mt-0 text-xs">Nueva contraseña (≥ 6)</label>
                  <input name="password" type="password" required minLength={6} autoComplete="new-password" className="input !py-2 text-sm" placeholder="••••••" />
                </div>
                <button className="btn-ghost !py-2 !px-3 text-sm whitespace-nowrap">Restablecer contraseña</button>
              </form>
            </div>
          ))}
          {tenant!.users.length === 0 && <div className="card p-6 text-sm text-muted">Aún no hay cajeros creados.</div>}
        </div>
      </div>
    </div>
  );
}
