"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fmt, change as calcChange, parseBs } from "@/lib/money";

type OrderItem = { id: string; nameSnapshot: string; emojiSnapshot: string; unitPriceCents: number; qty: number; kindSnapshot: string; sentToKitchen: boolean };
type Order = {
  id: string; code: string; status: string; source: string; serviceType: string; tableNumber: number | null;
  aliasSnapshot: string | null; phoneSnapshot: string | null; expiresAt: string; totalCents: number;
  method: string | null; createdAt: string; paidAt: string | null; items: OrderItem[];
};
type Product = { id: string; name: string; emoji: string; priceCents: number; stock: number; trackStock: boolean; kind: string; category: string };
type Provider = { id: string; name: string };

const CHIPS = ["EN_CAJA", "PAGADO", "ANULADO", "TODOS"] as const;
const statusBadge: Record<string, { label: string; cls: string }> = {
  EN_CAJA: { label: "En caja", cls: "bg-gold/20 text-gold" },
  PAGADO: { label: "Pagado", cls: "bg-moss/20 text-moss" },
  ANULADO: { label: "Anulado", cls: "bg-berry/20 text-berry" },
  EXPIRADO: { label: "Expirado", cls: "bg-berry/20 text-berry" },
};

export default function CajaClient(props: {
  slug: string; userName: string; displayName: string;
  products: Product[]; tables: { id: string; number: number }[]; providers: Provider[]; warned: boolean;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [, setTick] = useState(0);
  const [filter, setFilter] = useState<(typeof CHIPS)[number]>("EN_CAJA");
  const [q, setQ] = useState("");
  const [cobro, setCobro] = useState<Order | null>(null);
  const [msg, setMsg] = useState("");

  const reload = useCallback(async () => {
    const r = await fetch(`/api/caja/${props.slug}/orders`, { cache: "no-store" });
    if (r.ok) setOrders(await r.json());
  }, [props.slug]);

  useEffect(() => { reload(); const t = setInterval(reload, 4000); return () => clearInterval(t); }, [reload]);
  // tick de 1s para animar los countdowns de TTL en cada tarjeta
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);

  // si viene ?focus=CODE tras "Guardar y cobrar", abrimos el cobro de ese pedido
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus && orders.length) {
      const o = orders.find((x) => x.code === focus && x.status === "EN_CAJA");
      if (o) setCobro(o);
      window.history.replaceState({}, "", `/caja/${props.slug}`);
    }
  }, [orders, props.slug]);

  const visible = useMemo(() => orders.filter((o) => {
    if (filter === "EN_CAJA" && o.status !== "EN_CAJA") return false;
    if (filter === "PAGADO" && o.status !== "PAGADO") return false;
    if (filter === "ANULADO" && !(o.status === "ANULADO" || o.status === "EXPIRADO")) return false;
    if (q) {
      const needle = q.toLowerCase();
      const hay = `${o.code} ${o.aliasSnapshot ?? ""} ${o.phoneSnapshot ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  }), [orders, filter, q]);

  async function doAction(id: string, action: "cancel" | "charge", body?: object) {
    const r = await fetch(`/api/caja/${props.slug}/orders/${id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error ?? "Error"); setTimeout(() => setMsg(""), 2500); return null; }
    await reload();
    return j;
  }

  return (
    <div className="min-h-screen bg-night text-paper">
      <header className="flex flex-wrap items-center gap-3 border-b border-nightline px-4 md:px-5 py-3 md:py-4">
        <div className="grid h-10 w-10 md:h-11 md:w-11 shrink-0 place-items-center rounded-full bg-gold text-sm font-extrabold text-night">{props.displayName}</div>
        <div className="flex-1 min-w-0">
          <div className="text-base md:text-lg font-extrabold truncate">Caja · {props.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</div>
          <div className="text-xs text-paper/50 truncate">{props.userName} · polling en vivo cada 4s</div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {props.warned && <span className="badge-gold text-[10px] sm:text-xs">⏠ Por vencer</span>}
          <Link className="btn-gold !py-2 !px-3 md:!px-4 text-sm whitespace-nowrap" href={`/caja/${props.slug}/nuevo-pedido`}>+ nuevo</Link>
        </div>
      </header>

      <div className="p-4 md:p-5">
        <div className="flex items-center gap-2 rounded-2xl bg-nightcard border border-nightline px-3 md:px-4 py-3">
          <span className="text-paper/50">🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por celular, alias o código de pedido…" className="w-full bg-transparent outline-none placeholder:text-paper/40" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${filter === c ? "bg-paper text-night" : "bg-nightcard text-paper/60 border border-nightline hover:text-paper"}`}>
              {c === "EN_CAJA" ? "En caja" : c === "PAGADO" ? "Pagados" : c === "ANULADO" ? "Anulados" : "Todos"}
              {c === "EN_CAJA" && ` · ${orders.filter((o) => o.status === "EN_CAJA").length}`}
            </button>
          ))}
        </div>

        {msg && <div className="mt-4 rounded-xl bg-berry/20 border border-berry/40 px-4 py-2.5 text-sm text-[#ffb3a3]">{msg}</div>}

        <div className="mt-4 space-y-3 pb-24">
          {visible.map((o) => {
            const badge = statusBadge[o.status];
            const left = o.status === "EN_CAJA" ? Math.max(0, new Date(o.expiresAt).getTime() - Date.now()) : 0;
            return (
              <div key={o.id} className="rounded-2xl border border-nightline bg-nightcard p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-lg font-extrabold text-gold">#{o.code}</span>
                  <span className="font-bold">{o.aliasSnapshot ?? "—"}<span className="text-paper/50 font-normal"> · {o.phoneSnapshot ?? "s/cel"}</span></span>
                  {o.tableNumber != null && <span className="badge-line !bg-night !text-paper/70 border-nightline">Mesa {o.tableNumber}</span>}
                  <span className="badge-line !bg-night !text-paper/70 border-nightline">{o.source === "CAJERO" ? "✍ manual" : "📱 QR"}</span>
                  <span className="ml-auto text-lg font-extrabold">{fmt(o.totalCents)}</span>
                  <span className={`badge ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-paper/60">
                  {o.status === "EN_CAJA" && <span className={left < 5 * 60000 ? "font-bold text-[#ff9d84]" : "text-moss"}>⏱ {mmss(left)}</span>}
                  <span>{o.serviceType === "EN_LOCAL" ? "🍽 en el local" : "🥡 para llevar"}</span>
                  <span>{fmtTime(o.createdAt)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-4 text-sm">
                  {o.items.map((it) => (
                    <span key={it.id} className="text-paper/80">
                      {it.qty}× {it.emojiSnapshot} {it.nameSnapshot} <span className="text-paper/40">({it.kindSnapshot.toLowerCase()})</span>
                    </span>
                  ))}
                </div>
                {o.status === "EN_CAJA" ? (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button className="btn-ghost !bg-nightline !border-nightline !text-paper" onClick={() => {
                      setMsg("En la demo v1: anula el pedido y créalo de nuevo con “+ nuevo”; el stock se devuelve automáticamente."); setTimeout(() => setMsg(""), 4000);
                    }}>✎ Modificar</button>
                    <button className="btn-danger !border-berry/50 !text-[#ff9d84]" onClick={() => confirm(`¿Anular pedido #${o.code}? Se devolverá el stock.`) && doAction(o.id, "cancel")}>🗑 Anular</button>
                    <button className="btn-gold" onClick={() => setCobro(o)}>Cobrar {fmt(o.totalCents)}</button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <a href={`/print/ticket/${o.code}`} target="_blank" className="btn-ghost !bg-nightline !border-nightline !text-paper !py-1.5 text-xs">🧾 Ticket</a>
                    {["PLATO", "BEBIDA", "POSTRE"].map((k) => o.items.some((it) => it.kindSnapshot === k) && (
                      <a key={k} href={`/print/comanda/${o.code}/${k}`} target="_blank" className="btn-ghost !bg-nightline !border-nightline !text-paper !py-1.5 text-xs">🖨 {k.toLowerCase()}</a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-nightline p-12 text-center text-paper/40">
              No hay pedidos en esta vista. Los pedidos por QR llegan solos 👌 usa <b>+ nuevo</b> para crear uno manual.
            </div>
          )}
        </div>
      </div>

      {cobro && <CobroModal o={cobro} providers={props.providers} onClose={() => setCobro(null)} onDone={async () => { if (cobro) { window.open(`/print/ticket/${cobro.code}`, "_blank"); } setCobro(null); await reload(); }} />}
    </div>
  );
}

function mmss(ms: number) { const s = Math.round(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }); }

/* ===================== MODAL: Nuevo pedido manual COMPLETO ===================== */
function NuevoModal({ tables, products, slug, onClose, onSaved }: {
  tables: { id: string; number: number }[]; products: Product[]; slug: string;
  onClose: () => void; onSaved: (code: string, direct: boolean) => Promise<void>;
}) {
  const [alias, setAlias] = useState(""); const [phone, setPhone] = useState("");
  const [tableId, setTableId] = useState<string | "">(tables[0]?.id ?? "");
  const [service, setService] = useState<"EN_LOCAL" | "PARA_LLEVAR">("EN_LOCAL");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cat, setCat] = useState("TODO"); const [busq, setBusq] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const cats = ["TODO", ...Array.from(new Set(products.map((p) => p.category)))];
  const shown = products.filter((p) => {
    if (cat !== "TODO" && p.category !== cat) return false;
    if (busq && !p.name.toLowerCase().includes(busq.toLowerCase())) return false;
    return true;
  });
  const lines = products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] }));
  const total = lines.reduce((a, l) => a + (cart[l.id] ?? 0) * l.priceCents, 0);
  const count = lines.reduce((a, l) => a + (cart[l.id] ?? 0), 0) ;

  const setQty = (id: string, qty: number) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (p.trackStock && qty > p.stock) return; // R10
    setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = qty; return n; });
  };

  async function submit(direct: boolean) {
    if (!alias.trim() || !phone.trim()) { setErr("Alias y celular son obligatorios (control anti pedidos fantasma, R4)"); return; }
    if (service === "EN_LOCAL" && !tableId) { setErr("Elige la mesa para el consumo en local"); return; }
    if (count === 0) { setErr("Agrega al menos un producto al carrito"); return; }
    setErr(""); setBusy(true);
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant: slug, tableId: service === "EN_LOCAL" ? tableId : undefined,
        alias, phone, source: "CAJERO", serviceType: service, items: cart, notes,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(j.error ?? "Error al crear el pedido"); return; }
    if (direct) { window.location.href = `/caja/${slug}?focus=${j.code}`; return; }
    await onSaved(j.code as string, false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 md:p-6" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-nightline bg-nightcard shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* CABECERA */}
        <div className="flex items-center justify-between border-b border-nightline px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-white">Nuevo pedido manual — sin QR</h2>
            <p className="text-xs text-paper/50">Arma el carrito para el cliente del mostrador o de la mesa · genera código de 5 caracteres y TTL de 30 min (R6)</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-night text-paper/60 hover:text-paper">✕</button>
        </div>

        {/* CUERPO: cliente (izq) + POS (der) */}
        <div className="grid min-h-0 flex-1 md:grid-cols-[300px_1fr]">
          {/* IZQUIERDA: datos + carrito */}
          <div className="min-h-0 space-y-4 overflow-y-auto border-b border-nightline p-5 md:border-b-0 md:border-r">
            <div className="text-[11px] font-bold uppercase tracking-widest text-gold">1 · Cliente y servicio</div>
            <div>
              <label className="label !text-paper/50">Alias (¿cómo le llama caja?) *</label>
              <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="p. ej. Fernanda Q." className="input !bg-night !border-nightline !text-paper" />
            </div>
            <div>
              <label className="label !text-paper/50">Celular *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="70012345" className="input !bg-night !border-nightline !text-paper" />
            </div>
            <div>
              <label className="label !text-paper/50">Mesa</label>
              <div className="grid grid-cols-4 gap-1.5">
                {tables.map((t) => (
                  <button key={t.id} onClick={() => { setTableId(t.id); setService("EN_LOCAL"); }}
                    className={`rounded-lg border py-2 text-xs font-extrabold transition ${service === "EN_LOCAL" && tableId === t.id ? "border-gold bg-gold text-night" : "border-nightline bg-night text-paper/60 hover:text-paper"}`}>
                    M{t.number}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setService("EN_LOCAL")} className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${service === "EN_LOCAL" ? "border-moss bg-moss/20 text-moss" : "border-nightline bg-night text-paper/60"}`}>🍽 En el local</button>
              <button onClick={() => setService("PARA_LLEVAR")} className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${service === "PARA_LLEVAR" ? "border-moss bg-moss/20 text-moss" : "border-nightline bg-night text-paper/60"}`}>🥡 Para llevar</button>
            </div>
            <div>
              <label className="label !text-paper/50">Notas para cocina</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="p. ej. sin ají, queso aparte…" className="input !bg-night !border-nightline !text-paper resize-none" />
            </div>

            <div className="border-t border-nightline pt-3">
              <div className="text-[11px] font-bold uppercase tracking-widest text-gold">2 · Carrito ({count})</div>
              {lines.length === 0 ? (
                <p className="mt-2 text-xs text-paper/40">Aún vacío — toca “＋” en los productos de la derecha.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {lines.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 rounded-xl bg-night px-3 py-2">
                      <span className="text-lg">{l.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold">{l.name}</div>
                        <div className="text-[11px] text-gold font-bold">{fmt(l.priceCents)}</div>
                      </div>
                      <button onClick={() => setQty(l.id, (cart[l.id] ?? 0) - 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-nightline font-bold">−</button>
                      <span className="w-5 text-center text-sm font-extrabold">{cart[l.id]}</span>
                      <button disabled={l.trackStock && (cart[l.id] ?? 0) >= l.stock} onClick={() => setQty(l.id, (cart[l.id] ?? 0) + 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-nightline font-bold text-gold disabled:opacity-30">＋</button>
                      <div className="w-14 text-right text-xs font-bold">{fmt((cart[l.id] ?? 0) * l.priceCents)}</div>
                    </div>
                  ))}
                  <div className="flex justify-between rounded-xl bg-night px-3 py-2.5">
                    <span className="text-xs text-paper/50">TOTAL</span>
                    <span className="text-lg font-extrabold text-gold">{fmt(total)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DERECHA: catálogo tipo POS */}
          <div className="flex min-h-0 flex-col">
            <div className="border-b border-nightline p-4">
              <div className="flex items-center gap-2 rounded-xl bg-night border border-nightline px-3 py-2.5">
                <span className="text-paper/50">🔍</span>
                <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar producto…" className="w-full bg-transparent text-sm outline-none placeholder:text-paper/40" />
              </div>
              <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
                {cats.map((c) => (
                  <button key={c} onClick={() => setCat(c)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${cat === c ? "bg-paper text-night" : "bg-night text-paper/60 border border-nightline hover:text-paper"}`}>
                    {c === "TODO" ? "Todo" : c}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
                {shown.map((p) => {
                  const qty = cart[p.id] ?? 0;
                  const full = p.trackStock && qty >= p.stock;
                  const out = p.trackStock && p.stock <= 0;
                  return (
                    <div key={p.id} className={`rounded-2xl border p-3 transition ${out ? "border-berry/40 bg-night opacity-75" : "border-nightline bg-night hover:border-gold/50"}`}>
                      <div className="flex items-start justify-between">
                        <span className="text-2xl">{p.emoji}</span>
                        {p.trackStock && <span className={`badge !px-1.5 !py-0.5 text-[9px] ${out ? "badge-berry" : p.stock <= 3 ? "badge-gold" : "badge-moss"}`}>{out ? "AGOTADO" : p.stock <= 3 ? `${p.stock} en stock` : `${p.stock} listos`}</span>}
                      </div>
                      <div className="mt-1.5 line-clamp-2 min-h-[2.1rem] text-xs font-bold leading-snug">{p.name}</div>
                      <div className="text-sm font-extrabold text-gold">{fmt(p.priceCents)}<span className="ml-1 text-[9px] font-semibold text-paper/40 uppercase">{p.kind}</span></div>
                      {qty > 0 ? (
                        <div className="mt-2 flex items-center justify-between rounded-lg bg-nightline px-2 py-1.5">
                          <button className="font-bold text-paper/70" onClick={() => setQty(p.id, qty - 1)}>−</button>
                          <span className="text-sm font-extrabold">{qty}</span>
                          <button disabled={full} className="font-bold text-gold disabled:opacity-30" onClick={() => setQty(p.id, qty + 1)}>＋</button>
                        </div>
                      ) : (
                        <button disabled={out} onClick={() => setQty(p.id, 1)} className="btn-moss mt-2 w-full !py-1.5 !text-xs disabled:!bg-berry/25 disabled:!text-[#ff9d84]">
                          {out ? "🚫 Sin stock" : "＋ Agregar"}
                        </button>
                      )}
                    </div>
                  );
                })}
                {shown.length === 0 && <div className="col-span-full py-10 text-center text-sm text-paper/40">Sin resultados para “{busq}”.</div>}
              </div>
            </div>
          </div>
        </div>

        {/* PIE FIJO */}
        <div className="border-t border-nightline bg-night p-4">
          {err && <div className="mb-3 rounded-xl bg-berry/20 border border-berry/40 px-4 py-2 text-sm text-[#ffb3a3]">{err}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-paper/50">{count} ítem(s) · {service === "EN_LOCAL" ? "en local · mesa " + (tables.find((t) => t.id === tableId)?.number ?? "—") : "para llevar"}</div>
              <div className="text-2xl font-extrabold text-gold">{fmt(total)}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-ghost !bg-nightline !border-nightline !text-paper">Cancelar</button>
              <button onClick={() => submit(false)} disabled={busy} className="btn-ghost !bg-nightline !border-nightline !text-paper">🧾 Guardar en cola</button>
              <button onClick={() => submit(true)} disabled={busy} className="btn-gold">💳 Guardar y cobrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= MODAL COBRO ================= */
function CobroModal({ o, providers, onClose, onDone }: { o: Order; providers: Provider[]; onClose: () => void; onDone: () => Promise<void> }) {
  const [method, setMethod] = useState<"EFECTIVO" | "QR">("EFECTIVO");
  const [received, setReceived] = useState("");
  const [service, setService] = useState(o.serviceType);
  const [providerId, setProviderId] = useState(providers[0]?.id);
  const [busy, setBusy] = useState(false);
  const rc = parseBs(received);
  const vuelto = method === "EFECTIVO" ? calcChange(rc, o.totalCents) : 0;

  async function pagar() {
    setBusy(true);
    const res = await fetch(`/api/caja/orders/${o.id}/charge`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, receivedCents: method === "EFECTIVO" ? rc : undefined, serviceType: service, providerId }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { alert(j.error ?? "Error al cobrar"); return; }
    await onDone();
  }

  const kinds = (["PLATO", "BEBIDA", "POSTRE"] as const).filter((k) => o.items.some((i) => i.kindSnapshot === k));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-nightcard border border-nightline p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Cobro de cuenta <span className="text-gold">#{o.code}</span></h2>
          <button onClick={onClose} className="text-paper/50 hover:text-paper">✕</button>
        </div>

        <div className="mt-4 rounded-2xl bg-night p-4">
          {o.items.map((i) => (
            <div key={i.id} className="flex justify-between text-sm">
              <span>{i.qty}× {i.emojiSnapshot} {i.nameSnapshot} <span className="text-paper/40">({i.unitPriceCents / 100})</span></span>
              <span>{fmt(i.qty * i.unitPriceCents)}</span>
            </div>
          ))}
          <div className="mt-3 flex justify-between border-t border-nightline pt-3 font-extrabold">
            <span>TOTAL</span><span className="text-gold">{fmt(o.totalCents)}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["EFECTIVO", "QR"] as const).map((m) => (
            <button key={m} onClick={() => setMethod(m)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${method === m ? "border-gold bg-gold text-night" : "border-nightline bg-night text-paper/60"}`}>
              {m === "EFECTIVO" ? "💵 Efectivo" : "📱 QR"}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["EN_LOCAL", "PARA_LLEVAR"] as const).map((t) => (
            <button key={t} onClick={() => { setService(t); void o; }}
              className={`rounded-xl border px-4 py-2 text-xs font-bold transition ${service === t ? "border-moss bg-moss/20 text-moss" : "border-nightline bg-night text-paper/60"}`}>
              {t === "EN_LOCAL" ? "🍽 En el local" : "🥡 Para llevar"}
            </button>
          ))}
        </div>

        {method === "EFECTIVO" ? (
          <div className="mt-4">
            <label className="text-xs font-bold uppercase text-paper/50">Monto entregado (Bs)</label>
            <input value={received} onChange={(e) => setReceived(e.target.value)} inputMode="decimal" placeholder="0,00" className="input !bg-night !border-nightline !text-paper" />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-ghost !bg-night !border-nightline !text-paper !py-1 !px-2.5 text-xs" onClick={() => setReceived(String(o.totalCents / 100))}>monto exacto</button>
              {["10", "20", "50", "100"].map((d) => (
                <button key={d} className="btn-ghost !bg-night !border-nightline !text-paper !py-1 !px-2.5 text-xs" onClick={() => setReceived(d)}>{`Bs ${d}`}</button>
              ))}
            </div>
            <div className="mt-3 flex justify-between rounded-xl bg-moss/10 border border-moss/30 px-4 py-3">
              <span className="font-bold text-moss">Cambio (vuelto)</span><span className="text-xl font-extrabold text-moss">{fmt(vuelto)}</span>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <label className="text-xs font-bold uppercase text-paper/50">Proveedor QR (R2)</label>
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="input !bg-night !border-nightline !text-paper">
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="mt-2 rounded-xl bg-night p-4 text-center text-xs text-paper/60">Adaptador v1: registra la cobranza con el QR del proveedor activo; API firme disponible en fase 2.</div>
          </div>
        )}

        <button onClick={pagar} disabled={busy} className="btn-moss mt-5 w-full !py-3 text-base">
          {method === "EFECTIVO" ? `Conforme y pagado — dar ${fmt(vuelto)} de cambio` : "Registrar verificación de pago QR"}
        </button>
        <div className="mt-2 text-center text-xs text-paper/40">
          Al pagar se liberan: ticket del cliente + {kinds.length} comanda(s): {kinds.map((k) => k.toLowerCase()).join(", ") || "—"}.
        </div>
      </div>
    </div>
  );
}
