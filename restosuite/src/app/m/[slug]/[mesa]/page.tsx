import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import MenuClient from "./MenuClient";

export const dynamic = "force-dynamic";

export default async function ClientMenu({ params }: { params: Promise<{ slug: string; mesa: string }> }) {
  const { slug, mesa } = await params;
  const tenant = await db.tenant.findUnique({
    where: { slug },
    include: { categories: { where: { active: true }, orderBy: { sortOrder: "asc" }, include: { products: { where: { active: true }, orderBy: { name: "asc" }, include: { category: true } } } }, tables: true },
  });
  if (!tenant) notFound();
  const tableNumber = parseInt(mesa, 10);
  const table = tenant.tables.find((t) => t.number === tableNumber) ?? null;

  return (
    <MenuClient
      tenant={{ name: tenant.name, slug: tenant.slug, orderTtlMinutes: tenant.orderTtlMinutes }}
      mesa={Number.isFinite(tableNumber) ? tableNumber : null}
      products={tenant.categories.flatMap((c) =>
        c.products.map((p) => ({
          id: p.id, name: p.name, description: p.description, emoji: p.emoji, photoUrl: p.photoUrl ?? null,
          priceCents: p.priceCents, category: c.name, kind: c.kind,
          agotado: p.trackStock && p.stock <= 0,
        }))
      )}
      tableId={table?.id ?? null}
    />
  );
}
