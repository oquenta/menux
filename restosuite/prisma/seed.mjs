// Seed demo / producción — RestoSuite
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const now = new Date();
const D = (d) => new Date(now.getTime() + d * 86400000);
const cents = (b) => Math.round(b * 100);

async function main() {
  const userCount = await db.user.count().catch(() => 0);
  const forceSeed = process.env.FORCE_SEED === "true";

  if (userCount > 0 && !forceSeed) {
    console.log(`[Seed] La base de datos ya contiene ${userCount} usuarios. Omitiendo seed automático para proteger los datos.`);
    return;
  }

  if (forceSeed) {
    console.log("[Seed] FORCE_SEED=true: Limpiando tablas existentes…");
    await db.payment.deleteMany();
    await db.orderItem.deleteMany();
    await db.order.deleteMany();
    await db.clientSession.deleteMany();
    await db.stockMovement.deleteMany();
    await db.subscriptionEvent.deleteMany();
    await db.paymentProvider.deleteMany();
    await db.product.deleteMany();
    await db.category.deleteMany();
    await db.table.deleteMany();
    await db.user.deleteMany();
    await db.auditLog.deleteMany();
    await db.tenant.deleteMany();
  }

  console.log("[Seed] Sembrando datos de prueba...");
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "demo1234";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@resto.app";
  const pass = await bcrypt.hash(adminPass, 10);

  // ===== La Paila (activa, vence en 150 días) =====
  const paila = await db.tenant.create({
    data: {
      name: "La Paila (Prueba)", slug: "la-paila-prueba", phone: "+591 23456789",
      subStartsAt: D(-100), subExpiresAt: D(150), subStatus: "ACTIVA",
      plan: "PROFESIONAL", priceCents: cents(149),
    },
  });
  await db.user.createMany({
    data: [
      { email: adminEmail, passwordHash: pass, name: "Root Admin", role: "SUPERADMIN", displayName: "RS" },
      { email: "gerente@paila.app", passwordHash: pass, name: "Jessica Mamani", role: "GERENTE", tenantId: paila.id, displayName: "JM" },
      { email: "cajero@paila.app", passwordHash: pass, name: "Cajero La Paila", role: "CAJERO", tenantId: paila.id, displayName: "CJ" },
    ],
  });
  const catPlato = await db.category.create({ data: { tenantId: paila.id, name: "Platos", kind: "PLATO", sortOrder: 1 } });
  const catBebida = await db.category.create({ data: { tenantId: paila.id, name: "Bebidas", kind: "BEBIDA", sortOrder: 2 } });
  const catPostre = await db.category.create({ data: { tenantId: paila.id, name: "Postres", kind: "POSTRE", sortOrder: 3 } });

  const P = (cat, name, emoji, price, stock, desc) => ({
    tenantId: paila.id, categoryId: cat.id, name, emoji, priceCents: cents(price), stock, description: desc,
  });
  const silpancho = await db.product.create({ data: P(catPlato, "Silpancho a la Chuquisaqueña", "🍛", 38, 20, "Milanesa de res, arroz, papas y ají") });
  const pique = await db.product.create({ data: P(catPlato, "Pique Macho (2 pers.)", "🥘", 68, 12, "Res, chorizos, papas, locoto y cebolla") });
  const sopa = await db.product.create({ data: P(catPlato, "Sopa de Maní", "🍲", 22, 8, "Clásica sopa paceña con maní frito") });
  await db.product.create({ data: P(catPlato, "Chicharrón de Cerdo", "🍖", 45, 0, "Con mote y ají — agotado por demo") });
  const chicha = await db.product.create({ data: P(catBebida, "Chicha Morada (jarra)", "🥤", 16, 40, "Jarra de 1L, hecha en casa") });
  await db.product.create({ data: P(catBebida, "Refresco de Linaza", "🍋", 12, 6, "Natural, con hielo") });
  await db.product.create({ data: P(catPostre, "Flan con Dulce de Leche", "🍮", 12, 15, "Con leche de coco") });
  await db.product.create({ data: P(catPostre, "Roll de Canela", "🥮", 14, 4, "Con glaseado") });

  const tables = await Promise.all(
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => db.table.create({ data: { tenantId: paila.id, number: n, seats: n <= 2 ? 4 : n % 2 === 0 ? 6 : 4 } }))
  );

  await db.paymentProvider.create({ data: { tenantId: paila.id, name: "QR Banco Unión", kind: "QR_ESTATICO", priority: 1 } });
  await db.paymentProvider.create({ data: { tenantId: paila.id, name: "Mercado Pago", kind: "MERCADO_PAGO", priority: 2 } });

  // ===== Chifa del Sol (VENCIDA — para prueba del corte R9) =====
  const chifa = await db.tenant.create({
    data: { name: "Chifa del Sol (Prueba)", slug: "chifa-del-sol-prueba", subStartsAt: D(-60), subExpiresAt: D(-3), subStatus: "VENCIDA", plan: "BÁSICO", priceCents: cents(79) },
  });
  await db.user.create({ data: { email: "gerente@chifa-prueba.app", passwordHash: pass, name: " Presidente Chifa", role: "GERENTE", tenantId: chifa.id, displayName: "CH" } });
  await db.tenant.create({ data: { name: "Urban Grill (Prueba)", slug: "urban-grill-prueba", subStartsAt: D(-40), subExpiresAt: D(12), subStatus: "ACTIVA", plan: "BÁSICO", priceCents: cents(79) } });

  // ===== Un pedido EN_CAJA de ejemplo (para ver la caja con data al abrir) =====
  const sess = await db.clientSession.create({ data: { tenantId: paila.id, tableId: tables[0].id, alias: "oscar", phone: "71572401" } });
  const order = await db.order.create({
    data: {
      tenantId: paila.id, sessionId: sess.id,
      code: "VK3MD", status: "EN_CAJA", source: "CLIENTE_QR", serviceType: "EN_LOCAL", tableNumber: 1,
      aliasSnapshot: "oscar", phoneSnapshot: "71572401",
      expiresAt: new Date(now.getTime() + 22 * 60000),
      totalCents: cents(106),
      items: {
        create: [
          { productId: silpancho.id, nameSnapshot: "Silpancho a la Chuquisaqueña", emojiSnapshot: "🍛", unitPriceCents: cents(38), qty: 1, kindSnapshot: "PLATO" },
          { productId: pique.id, nameSnapshot: "Pique Macho (2 pers.)", emojiSnapshot: "🥘", unitPriceCents: cents(68), qty: 1, kindSnapshot: "PLATO" },
        ],
      },
    },
  });
  void order; void sopa; void chicha;
  console.log("Seed OK → tenants de prueba: la-paila-prueba, chifa-del-sol-prueba, urban-grill-prueba");
}

main().finally(() => db.$disconnect());
