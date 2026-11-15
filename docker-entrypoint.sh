#!/usr/bin/env sh
set -e
set -o pipefail
set -e

echo "=================================================="
echo " Iniciando RestoSuite en Coolify"
echo "=================================================="

if [ -z "$DATABASE_URL" ]; then
  echo "ADVERTENCIA: La variable DATABASE_URL no esta configurada."
  echo "Si tu aplicacion necesita base de datos, configurala en el panel de Coolify."
else
  echo "==> Verificando conexion a PostgreSQL y sincronizando esquema..."
  MAX_RETRIES=30
  COUNT=0
  until npx prisma db push --accept-data-loss --skip-generate || [ $COUNT -ge $MAX_RETRIES ]; do
    echo "==> Esperando conexion con PostgreSQL (intento $((COUNT+1)) de $MAX_RETRIES)..."
    sleep 2
    COUNT=$((COUNT + 1))
  done

  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "==> ERROR FATAL: No se pudo conectar a la base de datos tras $MAX_RETRIES intentos."
    echo "    Revisa que el contenedor/servicio de PostgreSQL este activo y que DATABASE_URL sea correcta."
    exit 1
  fi

  echo "==> Esquema de base de datos sincronizado correctamente."

  # Sembrar datos iniciales (superadmin y demo si la BD esta vacia)
  echo "==> Comprobando datos iniciales..."
  node prisma/seed.mjs || echo "==> Aviso: Seed finalizado o no requerido."
fi

echo "==> Arrancando servidor Next.js en el puerto ${PORT:-3000}..."
exec "$@"
