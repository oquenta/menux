"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { parseToCents } from "@/lib/money";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

async function tenantOf() {
  const s = await requireUser(["GERENTE"]);
  if (!s?.tenantId) throw new Error("NO_AUTORIZADO");
  return s;
}

export async function crearCategoria(formData: FormData) {
  const s = await tenantOf();
  const name = String(formData.get("name") || "").trim();
  const kind = String(formData.get("kind") || "OTRO");
  const tenantId = s.tenantId;
  if (!tenantId) return;
  if (!name) return;
  const exists = await db.category.findFirst({ where: { tenantId, name } });
  if (exists) return;
  const max = await db.category.aggregate({ where: { tenantId }, _max: { sortOrder: true } });
  await db.category.create({ data: { tenantId, name, kind, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  revalidatePath(`/r/${s.slug}/menu`);
}

async function savePhoto(file: File | null): Promise<string | null> {
  if (!file || !(file instanceof File) || file.size === 0) return null;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = path.extname(file.name) || ".jpg";
  const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext.toLowerCase()) ? ext.toLowerCase() : ".jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${filename}`;
}

export async function crearProducto(formData: FormData) {
  const s = await tenantOf();
  const tenantId = s.tenantId;
  if (!tenantId) return;
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "");
  const description = String(formData.get("description") || "").trim() || null;
  const emoji = String(formData.get("emoji") || "🍽");
  const priceCents = parseToCents(String(formData.get("price") || "0"));
  const stock = Math.max(0, parseInt(String(formData.get("stock") || "0"), 10) || 0);
  const trackStock = String(formData.get("trackStock")) !== "off";
  const photo = formData.get("photo") as File | null;
  if (!name || !categoryId || priceCents <= 0) return;
  const cat = await db.category.findFirst({ where: { id: categoryId, tenantId } });
  if (!cat) return;
  const photoUrl = await savePhoto(photo);
  await db.product.create({ data: { tenantId, categoryId, name, description, emoji, photoUrl, priceCents, stock, trackStock } });
  revalidatePath(`/r/${s.slug}/menu`);
}

export async function ingresoStock(formData: FormData) {
  const s = await tenantOf();
  const tenantId = s.tenantId;
  if (!tenantId) return;
  const productId = String(formData.get("productId") || "");
  const qty = parseInt(String(formData.get("qty") || "0"), 10) || 0;
  if (qty <= 0) return;
  const p = await db.product.findFirst({ where: { id: productId, tenantId } });
  if (!p) return;
  await db.$transaction([
    db.product.update({ where: { id: p.id }, data: { stock: { increment: qty } } }),
    db.stockMovement.create({ data: { tenantId, productId: p.id, delta: qty, reason: "INGRESO" } }),
  ]);
  revalidatePath(`/r/${s.slug}/menu`);
}

export async function toggleProducto(formData: FormData) {
  const s = await tenantOf();
  const tenantId = s.tenantId;
  if (!tenantId) return;
  const productId = String(formData.get("productId") || "");
  const p = await db.product.findFirst({ where: { id: productId, tenantId } });
  if (!p) return;
  await db.product.update({ where: { id: p.id }, data: { active: !p.active } });
  revalidatePath(`/r/${s.slug}/menu`);
}

export async function eliminarCategoria(formData: FormData) {
  const s = await tenantOf();
  const tenantId = s.tenantId;
  if (!tenantId) return;
  const categoryId = String(formData.get("categoryId") || "");
  const count = await db.product.count({ where: { categoryId } });
  if (count > 0) return;
  await db.category.deleteMany({ where: { id: categoryId, tenantId } });
  revalidatePath(`/r/${s.slug}/menu`);
}

export async function actualizarFotoProducto(formData: FormData) {
  const s = await tenantOf();
  const tenantId = s.tenantId;
  if (!tenantId) return;
  const productId = String(formData.get("productId") || "");
  const photo = formData.get("photo") as File | null;
  const p = await db.product.findFirst({ where: { id: productId, tenantId } });
  if (!p) return;
  const photoUrl = await savePhoto(photo);
  if (!photoUrl) return;
  await db.product.update({ where: { id: p.id }, data: { photoUrl } });
  revalidatePath(`/r/${s.slug}/menu`);
}
