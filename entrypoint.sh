#!/bin/sh
set -e

echo "🚀 Integral Computación — iniciando..."

# ── Asegurar que el directorio de datos existe ────────────────────────────────
mkdir -p /data

# ── La BD se crea vacía si no existe; las migraciones llenan la estructura ────
if [ ! -f /data/inventario.db ]; then
    echo "📦 Primera ejecución: la base de datos se creará en /data/inventario.db"
    echo "   Las migraciones se ejecutarán automáticamente al arrancar Node.js"
fi

echo "✅ Entorno listo — arrancando servidor Node.js..."
exec "$@"
