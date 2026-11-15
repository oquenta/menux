import { db } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await db.tenant.findUnique({
    where: { slug },
    include: {
      products: { where: { active: true }, include: { category: true } },
      tables: true,
    },
  });

  if (!tenant) {
    return new Response("Tenant not found", { status: 404 });
  }

  return Response.json({ products: tenant.products, tables: tenant.tables });
}
