export default function Landing() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-terra-dark via-terra to-[#a2491f] text-white">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <span className="badge bg-white/15 text-gold">Plataforma SaaS multi-restaurante</span>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
            RestoSuite
            <span className="block text-gold">Tu restaurante, funcionando como reloj.</span>
          </h1>
          <p className="mt-5 max-w-xl text-white/80 md:text-lg">
            Menú digital por QR, caja con tickets y comandas separadas por comida, bebida y postre,
            inventario con alerta de agotados y suscripciones con aviso de vencimiento a 15 días.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/login" className="btn-gold text-base">Entrar al sistema →</a>
            <a href="#demo" className="btn bg-white/10 text-white border border-white/25 hover:bg-white/15">Ver cuentas demo</a>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["📱", "Menú por QR", "El cliente pide desde la mesa sin instalar nada"],
              ["🧾", "Caja + tickets", "Cobro con cambio automático, comandas por categoría"],
              ["📊", "Reportes", "Más vendidos, agotados y ventas por día"],
              ["🔐", "Suscripciones", "Dashboard global de vencimientos y corte automático"],
            ].map(([e, t, d]) => (
              <div key={t} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-2xl">{e}</div>
                <div className="mt-2 font-bold">{t}</div>
                <div className="text-sm text-white/70">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cuentas demo */}
      <section id="demo" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-extrabold">Cuentas de demostración</h2>
        <p className="mt-1 text-muted">Contraseña única: <code className="rounded bg-terra-light px-2 py-0.5 font-bold text-terra-dark">demo1234</code></p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Operador SaaS", "admin@resto.app", "Dashboard global de restaurantes y vencimientos"],
            ["Gerente · La Paila", "gerente@paila.app", "Menú, mesa/QR, reportes y cajeros"],
            ["Cajero · La Paila", "cajero@paila.app", "Cola de pedidos, cobro y comandas"],
          ].map(([t, e, d]) => (
            <div key={e} className="card p-5">
              <div className="text-sm font-bold uppercase tracking-wide text-gold">{t}</div>
              <div className="mt-1 font-mono text-lg font-bold">{e}</div>
              <div className="mt-2 text-sm text-muted">{d}</div>
            </div>
          ))}
        </div>
        <div className="card mt-6 p-5">
          <div className="font-bold">Pedido del cliente (sin login)</div>
          <div className="mt-2 text-sm text-muted">
            Escanea el QR de una mesa o entra directo:{" "}
            <a className="text-terra font-semibold underline" href="/m/la-paila/1">restosuite/m/la-paila/1</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        RestoSuite v1.0 · SDD · Next.js + Prisma + SQLite (portable a PostgreSQL)
      </footer>
    </main>
  );
}
