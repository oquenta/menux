"use client";
import { useEffect, useState } from "react";
import { fmt } from "@/lib/money";

type Status = { code: string; status: string; totalCents: number; expiresAt: string; createdAt: string; alias?: string; phone?: string; tableNumber?: number; method?: string; changeCents?: number; serviceType?: string; items: { name: string; emoji: string; qty: number; unitCents: number }[] };

export default function PedidoStatus({ initial }: { initial: Status }) {
  const [s, setS] = useState(initial);
  const [left, setLeft] = useState(Math.max(0, new Date(initial.expiresAt).getTime() - Date.now()));

  useEffect(() => { const t = setInterval(() => setLeft(Math.max(0, new Date(s.expiresAt).getTime() - Date.now())), 1000); return () => clearInterval(t); }, [s.expiresAt]);
  useEffect(() => {
    if (s.status !== "EN_CAJA") return;
    const poll = setInterval(async () => {
      const r = await fetch(`/api/orders/${initial.code}`, { cache: "no-store" });
      if (r.ok) setS(await r.json());
    }, 4000);
    return () => clearInterval(poll);
  }, [initial.code, s.status]);

  const paid = s.status === "PAGADO";
  const expired = s.status === "EXPIRADO" || s.status === "ANULADO";

  return (
    <div className="mx-auto min-h-screen max-w-md bg-paper pb-10">
      <header className={`px-6 py-10 text-center text-white ${paid ? "bg-moss" : expired ? "bg-berry" : "bg-terra-dark"}`}>
        <div className="text-4xl">{paid ? "✅" : expired ? "⚠️" : "📨"}</div>
        <h1 className="mt-2 text-xl font-extrabold">
          {paid ? "¡Pago confirmado en caja!" : expired ? "El pedido fue anulado" : "¡Tu pedido ya está en caja!"}
        </h1>
        <p className="mt-1 text-sm text-white/70">
          {paid ? (s.changeCents && s.changeCents > 0 ? `Cambio entregado: ${fmt(s.changeCents)}  ·  método ${s.method}` : `Método ${s.method} · pago exacto`) : expired ? "Se devolvió el stock. Escanea el QR de nuevo con calma." : "Acércate a la caja y menciona tu alias para realizar el pago."}
        </p>
      </header>

      <div className="-mt-6 px-5">
        <div className="card mx-auto max-w-sm p-6 text-center shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted">Tu número de pedido</div>
          <div className="text-4xl font-extrabold text-terra">{s.code}</div>
          {s.alias && <div className="mt-1 text-sm text-muted">Alias: <b className="text-ink">{s.alias}</b></div>}
          {s.tableNumber != null && <span className="badge-line mt-2">Mesa {s.tableNumber}</span>}
          {!paid && !expired && (
            <div className={`badge mt-3 ${left < 5 * 60000 ? "badge-berry" : "badge-gold"}`}>
              ⏱ Expira en {mmss(left)}
            </div>
          )}
          <div className="mt-4 rounded-2xl bg-paper px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted">Total a cancelar en caja</div>
            <div className="text-2xl font-extrabold text-terra">{fmt(s.totalCents)}</div>
          </div>
        </div>
      </div>

      <div className="card mx-auto mt-4 max-w-sm p-5 text-sm">
        <div className="flex justify-between"><span className="text-muted">Hora de envío</span><b>{new Date(s.createdAt).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}</b></div>
        {s.phone && <div className="mt-1 flex justify-between"><span className="text-muted">Celular</span><b>{s.phone}</b></div>}
        <div className="mt-3 border-t border-line pt-3 font-extrabold text-xs uppercase tracking-wider text-muted">Detalle</div>
        {s.items.map((i, idx) => (
          <div key={idx} className="mt-1.5 flex justify-between">
            <span>{i.qty}× {i.emoji} {i.name}</span><b>{fmt(i.qty * i.unitCents)}</b>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-muted">Esta pantalla se actualiza sola cada pocos segundos (polling 5s).</p>
      <div className="mt-3 text-center">
        <a href={`/m/la-paila/${s.tableNumber ?? 1}`} className="text-sm font-bold text-terra underline">Volver al menú</a>
      </div>
    </div>
  );
}
function mmss(ms: number) { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
