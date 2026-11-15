"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createToken, setSessionCookie } from "@/lib/session";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await db.user.findUnique({ where: { email }, include: { tenant: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) redirect("/login?err=credenciales");
  if (user.tenant && user.tenant.subStatus === "VENCIDA") redirect("/login?err=suscripcion");
  await setSessionCookie(createToken({
    uid: user.id, email: user.email, name: user.name, role: user.role, displayName: user.displayName ?? undefined,
    tenantId: user.tenantId ?? undefined, slug: user.tenant?.slug ?? undefined,
  }));
  if (user.role === "SUPERADMIN") redirect("/admin");
  if (user.role === "GERENTE") redirect(`/r/${user.tenant?.slug}/dashboard`);
  redirect(`/caja/${user.tenant?.slug}`);
}
