import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { cambiarMiPassword } from "./actions";

export const dynamic = "force-dynamic";

type SP = { ok?: string; err?: string };

const ERRORS: Record<string, string> = {
  actual: "Ingresa tu contraseña actual.",
  actual_incorrecta: "La contraseña actual es incorrecta.",
  corta: "La nueva contraseña debe tener al menos 6 caracteres.",
  confirm: "La confirmación no coincide con la nueva contraseña.",
  igual: "La nueva contraseña debe ser diferente a la actual.",
};

export default async function CuentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const s = await requireUser(["GERENTE", "CAJERO"]);
  if (!s) redirect("/login");
  if (s.slug !== slug) redirect("/login");

  const ok = sp.ok === "1";
  const err = sp.err ? (ERRORS[sp.err] || "No se pudo cambiar la contraseña.") : null;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-extrabold">Mi cuenta</h1>
      <p className="text-muted">Cambia y actualiza tu contraseña de acceso.</p>

      {ok && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          ✓ Contraseña actualizada correctamente.
        </div>
      )}
      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {err}
        </div>
      )}

      <form action={cambiarMiPassword} className="card mt-6 p-5 space-y-3">
        <div>
          <div className="text-sm"><b>Usuario:</b> {s.name} ({s.email})</div>
          <div className="text-sm text-muted">Rol: {s.role}</div>
        </div>
        <div>
          <label className="label">Contraseña actual</label>
          <input name="current" type="password" required autoComplete="current-password" className="input" />
        </div>
        <div>
          <label className="label">Nueva contraseña (≥ 6 caracteres)</label>
          <input name="next" type="password" required minLength={6} autoComplete="new-password" className="input" />
        </div>
        <div>
          <label className="label">Confirmar nueva contraseña</label>
          <input name="confirm" type="password" required minLength={6} autoComplete="new-password" className="input" />
        </div>
        <button className="btn-primary">Cambiar contraseña</button>
        <p className="text-xs text-muted">Si olvidaste tu contraseña actual, pide al administrador (o gerente, si eres cajero) que la restablezca.</p>
      </form>
    </div>
  );
}