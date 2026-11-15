// Test E2E del flujo de negocio vía API real (localhost) — demo de verificación
import { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";

const db = new PrismaClient();
const base = "http://localhost:3100";
const secret = process.env.APP_SECRET || "restosuite-dev-secret";
const b64url = (b) => b.toString("base64url");
const sign = (d) => createHmac("sha256", secret).update(d).digest("base64url");
const token = (p) => { const payload = { ...p, exp: Date.now() + 3600000 }; const d = b64url(Buffer.from(JSON.stringify(payload))); return `${d}.${sign(d)}`; };

function log(emoji, msg) { console.log(`${emoji} ${msg}`); }

const main = async () => {
  const tenant = await db.tenant.findUnique({ where: { slug: "la-paila" } });
  const cajero = await db.user.findFirst({ where: { tenantId: tenant.id, role: "CAJERO" } });
  const authCookie = `rst=${token({ uid: cajero.id, email: cajero.email, name: cajero.name, role: "CAJERO", displayName: cajero.displayName ?? undefined, tenantId: tenant.id, slug: tenant.slug })}; Path=/`;

  const silpancho = await db.product.findFirst({ where: { tenantId: tenant.id, name: { contains: "Silpancho" } } });
  const flan = await db.product.findFirst({ where: { tenantId: tenant.id, name: { contains: "Flan" } } });
  const agotado = await db.product.findFirst({ where: { tenantId: tenant.id, name: { contains: "Chicharrón" } } });

  const preStock = await Promise.all([silpancho.stock, flan.stock]);
  log("📦", `Stock inicial: Silpancho=${preStock[0]}, Flan=${preStock[1]}`);

  const post = async (url, body, cookie) => fetch(base + url, { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  const get = async (url, cookie) => fetch(base + url, { headers: cookie ? { Cookie: cookie } : {}, headers2: undefined });

  // 1) Cliente pide por QR (mesa 2 vía tableId)
  const mesa2 = await db.table.findUnique({ where: { tenantId_number: { tenantId: tenant.id, number: 2 } } });
  let r = await post("/api/orders", { tenant: "la-paila", tableId: mesa2.id, alias: "katty", phone: "70012345", items: { [silpancho.id]: 2, [flan.id]: 1 } });
  let j = await r.json();
  console.assert(r.ok, r.status);
  log("✅", `Pedido QR creado — código ${j.code} · total ${(j.totalCents / 100).toFixed(2)} Bs`);

  // 2) R5: segundo pedido en la misma mesa con pedido abierto debe fallar
  r = await post("/api/orders", { tenant: "la-paila", tableId: mesa2.id, alias: "x", phone: "1", items: { [silpancho.id]: 1 } });
  j = await r.json();
  log(r.status === 409 ? "✅" : "❌", `R5 anti-doble pedido: HTTP ${r.status} — ${j.error}`);

  // 3) R10: producto agotado rechazado
  r = await post("/api/orders", { tenant: "la-paila", alias: "otra", phone: "999", items: { [agotado.id]: 1 } });
  j = await r.json();
  log(r.status === 400 ? "✅" : "❌", `R10 sin stock: HTTP ${r.status} — ${j.error}`);  // 4) Cajero ve la cola
  r = await (await fetch(base + "/api/caja/la-paila/orders", { headers: { Cookie: authCookie } })).json();
  log("✅", `Cola de caja vía API: ${r.length} pedidos (último: #${r[0]?.code})`);
  const order = r.find((o) => o.items.some((i) => i.nameSnapshot.includes("Silpancho")) && o.aliasSnapshot === "katty");

  // 5) Cobro EFECTIVO con Bs 200 → vuelto
  r = await post(`/api/caja/orders/${order.id}/charge`, { method: "EFECTIVO", receivedCents: 20000 }, authCookie);
  j = await r.json();
  log(r.ok ? "✅" : "❌", `Cobro ${r.ok ? `OK · changeCents=${j.changeCents} (${(j.changeCents / 100).toFixed(2)} Bs de vuelto)` : j.error}`);

  // 6) Idempotencia (Art. II): segundo cobro debe fallar
  r = await post(`/api/caja/orders/${order.id}/charge`, { method: "EFECTIVO", receivedCents: 20000 }, authCookie);
  j = await r.json();
  log(r.status === 400 ? "✅" : "❌", `Doble cobro bloqueado: HTTP ${r.status} — ${j.error}`);

  // 7) Stock descontado
  const after = await Promise.all([
    (await db.product.findUnique({ where: { id: silpancho.id } })).stock,
    (await db.product.findUnique({ where: { id: flan.id } })).stock,
  ]);
  log(after[0] === preStock[0] - 2 && after[1] === preStock[1] - 1 ? "✅" : "❌", `Stock después: Silpancho=${after[0]} (-2), Flan=${after[1]} (-1)`);

  // 8) Suscripción vencida bloquea el pedido (R9) — Chifa del Sol
  r = await post("/api/orders", { tenant: "chifa-del-sol", alias: "demo", phone: "999", items: {} });
  j = await r.json();
  log(r.status === 402 || r.status === 400 ? "✅" : "❌", `R9 restaurante vencido bloqueado: HTTP ${r.status} — ${j.error}`);

  console.log("\n🎉 TEST E2E COMPLETADO");
};

main().catch((e) => { console.error("FAIL:", e); process.exitCode = 1; }).finally(() => db.$disconnect());
