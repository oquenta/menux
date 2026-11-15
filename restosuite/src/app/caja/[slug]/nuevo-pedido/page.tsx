"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fmt } from "@/lib/money";

type Product = { id: string; name: string; emoji: string; photoUrl?: string | null; priceCents: number; stock: number; trackStock: boolean; kind: string; category: string };
type Table = { id: string; number: number };

export default function NuevoPedidoPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const [focus, setFocus] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      setFocus(sp.get("focus") ?? "");
    }
  }, []);

  const [tables, setTables] = useState<Table[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Carga inicial de datos - sin depender del hook use() para evitar errores en SSR
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/caja/${slug}/data`, { cache: "no-store" });
        const data = await res.json();
        const loadedTables = data.tables || [];
        setTables(loadedTables);
        setProducts((data.products || []).map((p: any) => ({
          id: p.id, name: p.name, emoji: p.emoji, photoUrl: p.photoUrl || null, priceCents: p.priceCents, stock: p.stock, trackStock: p.trackStock,
          kind: p.category?.kind || "", category: p.category?.name || "",
        })));
        if (loadedTables.length > 0) {
          setTableId((prev) => prev || loadedTables[0].id);
        }
      } catch (e) {
        console.error("Error cargando datos del pedido:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  const [alias, setAlias] = useState(""); const [phone, setPhone] = useState("");
  const [tableId, setTableId] = useState<string>("");
  const [service, setService] = useState<"EN_LOCAL" | "PARA_LLEVAR">("EN_LOCAL");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cat, setCat] = useState("TODO"); const [busq, setBusq] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  // Pre-selección de mesa si viene focus en la URL
  useEffect(() => {
    if (focus && tables.length) {
      const initialTable = tables.find(t => String(t.number) === focus);
      if (initialTable) {
        setTableId(initialTable.id);
        setService("EN_LOCAL");
      }
    }
  }, [focus, tables]);

  const cats = useMemo(() => ["TODO", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const shown = useMemo(() => products.filter((p) => {
    if (cat !== "TODO" && p.category !== cat) return false;
    if (busq && !p.name.toLowerCase().includes(busq.toLowerCase())) return false;
    return true;
  }), [products, cat, busq]);

  const lines = useMemo(() => products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] })), [products, cart]);
  const total = useMemo(() => lines.reduce((a, l) => a + (cart[l.id] ?? 0) * l.priceCents, 0), [lines, cart]);
  const count = useMemo(() => lines.reduce((a, l) => a + (cart[l.id] ?? 0), 0), [lines, cart]);

  const setQty = useCallback((id: string, qty: number) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (p.trackStock && qty > p.stock) return; // R10
    setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = qty; return n; });
  }, [products]);

  async function submit(direct: boolean) {
    if (!alias.trim() || !phone.trim()) { setErr("Alias y celular son obligatorios (control anti pedidos fantasma, R4)"); return; }
    if (service === "EN_LOCAL" && !tableId) { setErr("Elige la mesa para el consumo en local"); return; }
    if (count === 0) { setErr("Agrega al menos un producto al carrito"); return; }
    setErr(""); setBusy(true);

    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant: slug, tableId: service === "EN_LOCAL" ? tableId : undefined,
        alias, phone, source: "CAJERO", serviceType: service, items: cart,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(j.error ?? "Error al crear el pedido"); return; }
    if (direct) { router.push(`/caja/${slug}?focus=${j.code}`); return; }
    router.push(`/caja/${slug}`);
  }

  if (loading) return (
    <div className="grid h-screen place-items-center bg-night p-6 text-paper/70">
      <div className="text-center text-lg font-bold">Cargando productos y mesas...</div>
    </div>
  );

  if (!slug) return (
    <div className="grid h-screen place-items-center bg-night p-6 text-paper/70">
      <div className="text-center text-lg font-bold">Error: slug no encontrado</div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-nightcard text-paper">
      {/* CABECERA */}
      <div className="flex items-center justify-between border-b border-nightline px-6 py-4">
        <div>
          <p className="text-xs text-paper/50">Arma el carrito para el cliente del mostrador o de la mesa · genera código de 5 caracteres y TTL de 30 min (R6)</p>
        </div>
        <button onClick={() => router.push(`/caja/${slug}`)} className="grid h-9 w-9 place-items-center rounded-full bg-night text-paper/60 hover:text-paper">✕</button>
      </div>

      {/* CUERPO: cliente (izq) + POS (der) */}
      <div className="grid md:min-h-0 md:flex-1 md:grid-cols-[40%_60%]">
        {/* IZQUIERDA: datos + carrito */}
        <div className="md:min-h-0 space-y-3 md:overflow-y-auto border-b border-nightline p-4 md:border-b-0 md:border-r">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gold">1 · Cliente y servicio</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label !text-paper/50 text-[9px]">Alias (¿cómo le llama caja?) *</label>
              <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="p. ej. Fernanda Q." className="input !bg-night !border-nightline !text-paper w-full" />
            </div>
            <div>
              <label className="label !text-paper/50 text-[9px]">Celular *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="70012345" className="input !bg-night !border-nightline !text-paper w-full" />
            </div>
          </div>
          <div>
            <label className="label !text-paper/50 text-[9px]">Mesa</label>
            <div className="grid grid-cols-4 gap-1">
              {tables.map((t) => (
                <button key={t.id} onClick={() => { setTableId(t.id); setService("EN_LOCAL"); }}
                  className={`rounded-lg border py-1.5 text-[9px] font-bold transition ${service === "EN_LOCAL" && tableId === t.id ? "border-gold bg-gold text-night" : "border-nightline bg-night text-paper/60 hover:text-paper"}`}>
                  {t.number}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setService("EN_LOCAL")} className={`rounded-xl border px-2 py-1.5 text-[9px] font-bold ${service === "EN_LOCAL" ? "border-moss bg-moss/20 text-moss" : "border-nightline bg-night text-paper/60"}`}>🍽 En el local</button>
            <button onClick={() => setService("PARA_LLEVAR")} className={`rounded-xl border px-2 py-1.5 text-[9px] font-bold ${service === "PARA_LLEVAR" ? "border-moss bg-moss/20 text-moss" : "border-nightline bg-night text-paper/60"}`}>🥡 Para llevar</button>
          </div>
          <div className="border-t border-nightline pt-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gold mb-1">2 · Carrito ({count})</div>
            <div className="rounded-xl border border-nightline bg-night/50 p-2">
              {lines.length === 0 ? (
                <p className="text-[9px] text-paper/40 text-center py-2">Aún vacío — toca “＋” en los productos de la derecha.</p>
              ) : (
                <div className="space-y-1">
                  {lines.map((l) => (
                    <div key={l.id} className="flex items-center gap-1 rounded-lg bg-nightcard/60 px-2 py-1">
                      {l.photoUrl ? (
                        <img src={l.photoUrl} alt={l.name} className="h-6 w-6 rounded object-cover shrink-0" />
                      ) : (
                        <span className="text-sm shrink-0">{l.emoji}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] font-bold">{l.name}</div>
                        <div className="text-[9px] text-gold font-bold">{fmt(l.priceCents)}</div>
                      </div>
                      <button onClick={() => setQty(l.id, (cart[l.id] ?? 0) - 1)} className="grid h-5 w-5 place-items-center rounded-lg bg-nightline font-bold text-[9px]">−</button>
                      <span className="w-4 text-center text-xs font-extrabold">{cart[l.id]}</span>
                      <button disabled={l.trackStock && (cart[l.id] ?? 0) >= l.stock} onClick={() => setQty(l.id, (cart[l.id] ?? 0) + 1)} className="grid h-5 w-5 place-items-center rounded-lg bg-nightline font-bold text-gold disabled:opacity-30 text-[9px]">＋</button>
                      <div className="w-10 text-right text-[9px] font-bold">{fmt((cart[l.id] ?? 0) * l.priceCents)}</div>
                    </div>
                  ))}
                  <div className="flex justify-between rounded-lg bg-nightline/50 px-2 py-1.5 mt-1">
                    <span className="text-[9px] text-paper/50">TOTAL</span>
                    <span className="text-sm font-extrabold text-gold">{fmt(total)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DERECHA: catálogo tipo POS */}
        <div className="flex flex-col md:min-h-0">
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

          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto p-4 w-full">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((p) => {
                const qty = cart[p.id] ?? 0;
                const full = p.trackStock && qty >= p.stock;
                const out = p.trackStock && p.stock <= 0;
                return (
                  <div key={p.id} className={`rounded-2xl border p-2 transition flex flex-col items-center text-center ${out ? "border-berry/40 bg-night opacity-75" : "border-nightline bg-night hover:border-gold/50"}`}>
                    <div className="relative w-full aspect-square mb-1 flex items-center justify-center overflow-hidden rounded-xl bg-nightline/30">
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-6xl leading-none">{p.emoji}</span>
                      )}
                      {p.trackStock && (
                        <span className={`badge absolute top-1 right-1 !px-1.5 !py-0.5 text-[8px] ${out ? "badge-berry" : p.stock <= 3 ? "badge-gold" : "badge-moss"}`}>
                          {out ? "AGOTADO" : p.stock <= 3 ? `${p.stock}` : `${p.stock}`}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 line-clamp-2 min-h-[2rem] text-xs font-bold leading-snug w-full px-1">{p.name}</div>
                    <div className="text-sm font-extrabold text-gold">{fmt(p.priceCents)}<span className="ml-1 text-[8px] font-semibold text-paper/40 uppercase">{p.kind}</span></div>
                    {qty > 0 ? (
                      <div className="mt-2 flex items-center justify-between rounded-lg bg-nightline px-2 py-1 w-full">
                        <button className="font-bold text-paper/70" onClick={() => setQty(p.id, qty - 1)}>−</button>
                        <span className="text-sm font-extrabold">{qty}</span>
                        <button disabled={full} className="font-bold text-gold disabled:opacity-30" onClick={() => setQty(p.id, qty + 1)}>＋</button>
                      </div>
                    ) : (
                      <button disabled={out} onClick={() => setQty(p.id, 1)} className="btn-moss mt-2 w-full !py-1 !text-xs disabled:!bg-berry/25 disabled:!text-[#ff9d84]">
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

        {/* PIE FIJO */}
        <div className="border-t border-nightline bg-night p-4">
          {err && <div className="mb-3 rounded-xl bg-berry/20 border border-berry/40 px-4 py-2 text-sm text-[#ffb3a3]">{err}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-paper/50">{count} ítem(s) · {service === "EN_LOCAL" ? "en local · mesa " + (tables.find((t) => t.id === tableId)?.number ?? "—") : "para llevar"}</div>
              <div className="text-2xl font-extrabold text-gold">{fmt(total)}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push(`/caja/${slug}`)} className="btn-ghost !bg-nightline !border-nightline !text-paper">Cancelar</button>
              <button onClick={() => submit(false)} disabled={busy} className="btn-ghost !bg-nightline !border-nightline !text-paper">🧾 Guardar en cola</button>
              <button onClick={() => submit(true)} disabled={busy} className="btn-gold">💳 Guardar y cobrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}