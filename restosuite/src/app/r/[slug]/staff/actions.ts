"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

function staffUrl(slug: string, params: Record<string, string>) {
  return `/r/${slug}/staff?${new URLSearchParams(params).toString()}`;
}

export async function crearCajero(formData: FormData) {
  const s = await requireUser(["GERENTE"]);
  const tenantId = s?.tenantId;
  if (!tenantId || !s?.slug) redirect("/login");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim().toUpperCase().slice(0, 2) || "CJ";
  const password = String(formData.get("password") || "");

  if (!email || !name) redirect(staffUrl(s.slug, { err: "datos" }));
  if (password.length < 6) redirect(staffUrl(s.slug, { err: "corta" }));

  const exists = await db.user.findUnique({ where: { email } });
  if (exists) redirect(staffUrl(s.slug, { err: "email" }));

  await db.user.create({
    data: { email, name, displayName, role: "CAJERO", tenantId, passwordHash: await bcrypt.hash(password, 10) },
  });
  await db.auditLog.create({ data: { tenantId, actorEmail: s.email, action: "CREAR_CAJERO", entity: "User", detail: email } });
  revalidatePath(`/r/${s.slug}/staff`);
  redirect(staffUrl(s.slug, { ok: "cajero_creado" }));
}

export async function resetPasswordCajero(formData: FormData) {
  const s = await requireUser(["GERENTE"]);
  const tenantId = s?.tenantId;
  if (!tenantId || !s?.slug) redirect("/login");

  const userId = String(formData.get("userId") || "");
  const password = String(formData.get("password") || "");
  if (!userId) redirect(staffUrl(s.slug, { err: "datos" }));
  if (password.length < 6) redirect(staffUrl(s.slug, { err: "corta" }));

  const user = await db.user.findFirst({ where: { id: userId, tenantId, role: "CAJERO" } });
  if (!user) redirect(staffUrl(s.slug, { err: "no_encontrado" }));

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  await db.auditLog.create({ data: { tenantId, actorEmail: s.email, action: "RESET_PASSWORD_CAJERO", entity: "User", entityId: userId, detail: user.email } });
  revalidatePath(`/r/${s.slug}/staff`);
  redirect(staffUrl(s.slug, { ok: "reset" }));
}
