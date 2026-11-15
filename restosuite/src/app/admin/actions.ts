"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { parseToCents } from "@/lib/money";
import { SUBS } from "@/lib/domain";

async function assertSuper() {
  const s = await requireUser(["SUPERADMIN"]);
  if (!s) redirect("/login");
  return s;
}

function adminUrl(params: Record<string, string>) {
  return `/admin?${new URLSearchParams(params).toString()}`;
}

export async function crearTenant(formData: FormData) {
  await assertSuper();
  const name = String(formData.get("name") || "").trim();
  const plan = String(formData.get("plan") || "BÁSICO");
  const months = Math.max(1, parseInt(String(formData.get("months") || "12"), 10));
  const monthly = parseToCents(String(formData.get("price") || "79") || "79");
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Gerente del restaurante (obligatorio para poder operar)
  const gerenteName = String(formData.get("gerenteName") || "").trim();
  const gerenteEmail = String(formData.get("gerenteEmail") || "").trim().toLowerCase();
  const gerentePassword = String(formData.get("gerentePassword") || "");
  const gerenteDisplay = String(formData.get("gerenteDisplay") || "").trim().toUpperCase().slice(0, 2) || gerenteName.slice(0, 2).toUpperCase() || "GR";

  if (!name || !slug) return;
  if (!gerenteName || !gerenteEmail || gerentePassword.length < 6) return;

  const expires = new Date();
  expires.setMonth(expires.getMonth() + months);
  const subStatus = expires.getTime() - Date.now() <= 15 * 86400000 ? SUBS.POR_VENCER : SUBS.ACTIVA;

  const existingTenant = await db.tenant.findUnique({ where: { slug } });
  if (existingTenant) return;
  const existingUser = await db.user.findUnique({ where: { email: gerenteEmail } });
  if (existingUser) return;

  const passwordHash = await bcrypt.hash(gerentePassword, 10);
  await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name, slug, plan, subStartsAt: new Date(), subExpiresAt: expires, subStatus, priceCents: monthly },
    });
    await tx.user.create({
      data: {
        email: gerenteEmail,
        name: gerenteName,
        displayName: gerenteDisplay,
        role: "GERENTE",
        tenantId: tenant.id,
        passwordHash,
      },
    });
    await tx.auditLog.create({ data: { action: "CREAR_TENANT", entity: "Tenant", detail: `${name} (${plan}, ${months} meses) + gerente ${gerenteEmail}` } });
  });
  revalidatePath("/admin");
}

export async function renovarSuscripcion(formData: FormData) {
  await assertSuper();
  const tenantId = String(formData.get("tenantId"));
  const months = Math.max(1, parseInt(String(formData.get("months") || "6"), 10));
  const t = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!t) return;
  const from = t.subExpiresAt > new Date() ? t.subExpiresAt : new Date();
  const expires = new Date(from);
  expires.setMonth(expires.getMonth() + months);
  await db.tenant.update({ where: { id: tenantId }, data: { subExpiresAt: expires, subStatus: SUBS.ACTIVA, isActive: true } });
  await db.subscriptionEvent.create({ data: { tenantId, type: "RENOVADO", message: `Renovado +${months} meses` } });
  revalidatePath("/admin");
}

export async function suscripcionesStatusRefresh(formData: unknown) { void formData; /* compat */ }

export async function crearUsuarioTenant(formData: FormData) {
  await assertSuper();
  const tenantId = String(formData.get("tenantId") || "");
  const role = String(formData.get("role") || "CAJERO") as "GERENTE" | "CAJERO";
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim().toUpperCase().slice(0, 2) || (role === "GERENTE" ? "GR" : "CJ");
  const password = String(formData.get("password") || "");

  if (!tenantId || !email || !name) redirect(adminUrl({ err: "datos_usuario" }));
  if (password.length < 6) redirect(adminUrl({ err: "pass_corta" }));
  if (role !== "GERENTE" && role !== "CAJERO") redirect(adminUrl({ err: "rol" }));

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) redirect(adminUrl({ err: "tenant" }));
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) redirect(adminUrl({ err: "email_usuario" }));

  await db.user.create({
    data: {
      email,
      name,
      displayName,
      role,
      tenantId,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  await db.auditLog.create({ data: { action: "CREAR_USUARIO_TENANT", entity: "User", tenantId, detail: `${role} ${email} para ${tenant.slug}` } });
  revalidatePath("/admin");
  redirect(adminUrl({ ok: "usuario_creado" }));
}

export async function resetPasswordUsuario(formData: FormData) {
  await assertSuper();
  const userId = String(formData.get("userId") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!userId) redirect(adminUrl({ err: "sel_usuario" }));
  if (password.length < 6) redirect(adminUrl({ err: "pass_corta" }));
  if (confirm && password !== confirm) redirect(adminUrl({ err: "pass_confirm" }));

  const user = await db.user.findUnique({ where: { id: userId }, include: { tenant: true } });
  if (!user) redirect(adminUrl({ err: "usuario_no" }));
  if (user.role === "SUPERADMIN") redirect(adminUrl({ err: "superadmin" }));

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  await db.auditLog.create({
    data: {
      action: "RESET_PASSWORD",
      entity: "User",
      entityId: userId,
      tenantId: user.tenantId,
      detail: `Reset contraseña para ${user.email} (${user.role}${user.tenant ? ` / ${user.tenant.slug}` : ""})`,
    },
  });
  revalidatePath("/admin");
  redirect(adminUrl({ ok: "password_reset" }));
}
