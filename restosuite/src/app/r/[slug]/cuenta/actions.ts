"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

function cuentaUrl(slug: string | undefined, params: Record<string, string>) {
  const base = `/r/${slug || ""}/cuenta`;
  const q = new URLSearchParams(params).toString();
  return `${base}?${q}`;
}

export async function cambiarMiPassword(formData: FormData) {
  const s = await requireUser(["GERENTE", "CAJERO"]);
  if (!s?.uid || !s.slug) redirect("/login");

  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!current) redirect(cuentaUrl(s.slug, { err: "actual" }));
  if (next.length < 6) redirect(cuentaUrl(s.slug, { err: "corta" }));
  if (next !== confirm) redirect(cuentaUrl(s.slug, { err: "confirm" }));
  if (current === next) redirect(cuentaUrl(s.slug, { err: "igual" }));

  const user = await db.user.findUnique({ where: { id: s.uid } });
  if (!user) redirect("/login");

  const ok = await bcrypt.compare(current, user.passwordHash);
  if (!ok) redirect(cuentaUrl(s.slug, { err: "actual_incorrecta" }));

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  await db.auditLog.create({ data: { tenantId: user.tenantId, actorEmail: user.email, action: "CAMBIAR_PASSWORD", entity: "User", entityId: user.id } });
  revalidatePath(`/r/${s.slug}/cuenta`);
  redirect(cuentaUrl(s.slug, { ok: "1" }));
}