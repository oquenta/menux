import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log("Intentando conectar a PostgreSQL...");
    await prisma.$connect();
    console.log("¡Conexión a PostgreSQL exitosa!");

    const tenantsCount = await prisma.tenant.count();
    const usersCount = await prisma.user.count();
    
    console.log(`Estado de la BD -> Tenants: ${tenantsCount}, Usuarios: ${usersCount}`);
  } catch (error) {
    console.error("Error al conectar con la base de datos:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
