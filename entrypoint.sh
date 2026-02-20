#!/bin/sh
set -e

echo "🚀 Integral Computación — iniciando..."

# ── Primer arranque: copiar DB al volumen persistente ─────────────────────────
if [ ! -f /data/inventario.db ]; then
    echo "📦 Primera ejecución: copiando base de datos inicial a /data/..."
    if [ -f /app/inventario.db ]; then
        cp /app/inventario.db /data/inventario.db
        echo "✅ Base de datos copiada."
    else
        echo "⚠️  No hay inventario.db en el build — se creará una vacía."
    fi
fi

# ── (Opcional) Sincronizar imágenes de marcas al volumen ─────────────────────
# Si en el futuro quieres que las imágenes subidas persistan,
# descomenta esto y ajusta fly.toml para montar /data en /app/assets/images:
#
# if [ ! -d /data/brands ]; then
#     cp -r /app/assets/images/brands /data/brands 2>/dev/null || true
# fi

echo "✅ Entorno listo — arrancando servidor Node.js..."
exec "$@"
