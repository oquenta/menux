// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalAny = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalAny.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalAny.prisma = db;
