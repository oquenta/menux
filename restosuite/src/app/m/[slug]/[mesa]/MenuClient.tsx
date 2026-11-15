"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, mul } from "@/lib/money";

type P = { id: string; name: string; description: string | null; emoji: string; photoUrl?: string | null; priceCents: number; category: string; kind: string; agotado: boolean };

export default function MenuClient({ tenant, mesa, products, tableId }: {
  tenant: { name: string; slug: string; orderTtlMinutes: number };
  mesa: number | null; products: P[]; tableId: string | null;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cat, setCat] = useState("Todo");
  const [sheet, setSheet] = useState(false);
  const [alias, setAlias] = useState(""); const [phone, setPhone] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const cats = useMemo(() => ["Todo", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const shown = cat === "Todo" ? products : products.filter((p) => p.category === cat);
  const add = (id: string, d: number) => setCart((c) => { const q = Math.max(0, (c[id] ?? 0) + d); const n = { ...c }; if (q === 0) delete n[id]; else n[id] = q; return n; });

  const lines = products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] }));
  const total = lines.reduce((a, l) => a + mul(l.qty, l.priceCents), 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);

  async function enviar() {
    if (!alias.trim() || !phone.trim()) { setErr("Completa tu alias y tu celular — cómo te llamará la caja (R4)"); return; }
    setBusy(true);
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: tenant.slug, tableId, alias, phone, serviceType: "EN_LOCAL", items: cart }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(j.error ?? "Error al enviar"); return; }
    router.push(`/m/${tenant.slug}/${mesa}/pedido/${j.code}`);
  }

  return (
    <div className="adaptive-height min-h-screen bg-paper pb-24">
      {/* Header */}
      <header className="bg-white border-b border-line px-5 py-4 sticky top-0 z-20">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-terra text-xl text-white">🍲</div>
          <div className="flex-1">
            <div className="text-lg font-extrabold leading-tight">{tenant.name}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Picantería criolla · Mesa {mesa}</div>
          </div>
          <button disabled={count === 0} onClick={() => setSheet(true)} className={`badge ${count === 0 ? "badge-line" : "badge-gold"}`}>
            Tu pedido ·{count === 0 ? " vacío" : ` ${count} ítem 🧺`}
          </button>
        </div>
      </header>

      {/* Chips categorías */}
      <div className="mx-auto sticky top-[72px] z-10 flex max-w-2xl gap-2 overflow-x-auto bg-paper/95 px-5 py-3 backdrop-blur">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${cat === c ? "bg-terra text-white" : "bg-white border border-line text-ink hover:border-terra"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-2xl px-5">
        <h2 className="text-lg font-extrabold text-terra">{cat === "Todo" ? "Nuestro menú" : cat} <span className="badge-line ml-1">{shown.length} opciones</span></h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {shown.map((p) => (
            <div key={p.id} className={`card flex items-center gap-3 p-3 sm:p-4 ${p.agotado ? "opacity-70" : ""}`}>
              {p.photoUrl ? (
                  <img src={p.photoUrl} alt={p.name} className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl object-cover bg-terra-light" />
                ) : (
                  <div className="grid h-14 w-14 sm:h-16 sm:w-16 shrink-0 place-items-center rounded-2xl bg-terra-light text-2xl">{p.emoji}</div>
                )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{p.name}</div>
                <div className="line-clamp-1 text-xs text-muted">{p.description}</div>
                <div className="mt-0.5 font-extrabold text-berry">{fmt(p.priceCents)}</div>
              </div>
              {p.agotado ? (
                <span className="badge-berry shrink-0">🚫 Agotado</span>
              ) : cart[p.id] ? (
                <div className="flex shrink-0 items-center gap-2 rounded-full border border-line px-2 py-1">
                  <button className="h-7 w-7 font-bold text-berry" onClick={() => add(p.id, -1)}>−</button>
                  <span className="w-5 text-center font-bold">{cart[p.id]}</span>
                  <button className="h-7 w-7 font-bold text-terra" onClick={() => add(p.id, 1)}>＋</button>
                </div>
              ) : (
                <button className="btn-primary shrink-0 !px-3 !py-2 text-xs" onClick={() => add(p.id, 1)}>＋ Agregar</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Carrito inferior fijo */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-terra-dark to-terra p-3 pb-5">
          <button onClick={() => setSheet(true)} className="mx-auto flex w-full max-w-2xl items-center justify-between rounded-2xl bg-terra-dark/90 px-5 py-4 text-white shadow-lg ring-1 ring-white/10">
            <span className="flex items-center gap-2 font-bold">🛒 Ver pedido · {count} ítem(s)</span>
            <span className="font-extrabold">{fmt(total)}</span>
          </button>
        </div>
      )}

      {/* Bottom sheet: Tu pedido */}
      {sheet && (
        <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setSheet(false)}>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl rounded-t-3xl bg-white p-6 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
            <h3 className="text-xl font-extrabold">Tu pedido</h3>
            <div className="mt-3 space-y-2">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-xl bg-paper px-4 py-3">
                  <div className="flex-1 text-sm font-semibold">{l.emoji} {l.name}</div>
                  <button className="grid h-8 w-8 place-items-center rounded-full bg-berry/10 text-berry" onClick={() => add(l.id, -1)}>−</button>
                  <span className="w-6 text-center font-bold">{l.qty}</span>
                  <button className="grid h-8 w-8 place-items-center rounded-full bg-terra/10 text-terra" onClick={() => add(l.id, 1)}>＋</button>
                  <div className="w-16 text-right text-sm font-bold">{fmt(mul(l.qty, l.priceCents))}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between border-t border-line pt-4 text-lg">
              <span className="text-muted">Total a cancelar en caja</span><b className="font-extrabold">{fmt(total)}</b>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Tu alias (cómo te llama caja) *</label>
                <input value={alias} onChange={(e) => setAlias(e.target.value)} className="input" placeholder="p. ej. Fernanda Q." />
              </div>
              <div>
                <label className="label">Celular *</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="70012345" />
              </div>
            </div>
            {err && <div className="mt-3 rounded-xl bg-berry/10 border border-berry/30 px-4 py-2.5 text-sm text-berry">{err}</div>}

            <button onClick={enviar} disabled={busy} className="btn-primary mt-5 w-full !py-3.5 text-base">
              {busy ? "Enviando…" : "Enviar pedido a caja →"}
            </button>
            <p className="mt-2 text-center text-xs text-muted">
              Al enviar, espera en caja (TTL {tenant.orderTtlMinutes} minutos); no podrás hacer otro pedido hasta pagar o anular (R5).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
