import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ email?: string; err?: string }> }) {
  const { email, err } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-terra-dark to-terra px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 text-center">
          <div className="text-3xl font-extrabold text-white">Resto<span className="text-gold">Suite</span></div>
          <div className="text-sm text-white/70">Administración de restaurantes</div>
        </div>
        <form action={login} className="card p-7">
          <label className="label" htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" required defaultValue={email || ""} placeholder="admin@resto.app" className="input" />
          <label className="label mt-4" htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" required placeholder="demo1234" className="input" />
          <button className="btn-primary mt-6 w-full">Iniciar sesión</button>
          {err === "credenciales" && <p className="mt-3 rounded-xl bg-berry/10 border border-berry/30 px-4 py-2 text-center text-sm text-berry">Correo o contraseña incorrectos</p>}
          {err === "suscripcion" && <p className="mt-3 rounded-xl bg-berry/10 border border-berry/30 px-4 py-2 text-center text-sm text-berry">Suscripción vencida — contacta al operador</p>}
          <p className="mt-4 text-center text-xs text-muted">
            Prueba: admin@resto.app · gerente@paila.app · cajero@paila.app — clave <b>demo1234</b>
          </p>>
        </form>
      </div>
    </main>
  );
}
