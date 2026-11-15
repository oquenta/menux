import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Verificar conexión activa con PostgreSQL
    await db.$queryRaw`SELECT 1`;
    const usersCount = await db.user.count().catch(() => 0);
    const tenantsCount = await db.tenant.count().catch(() => 0);

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
        stats: {
          users: usersCount,
          tenants: tenantsCount,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        error: error?.message || "Unknown database error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
