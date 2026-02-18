const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const dbPath = path.resolve(__dirname, '..', 'inventario.db');
const db = new sqlite3.Database(dbPath);

const productsDir = path.resolve(__dirname, '..', 'assets/images/products/toner');

async function optimizeImages() {
    console.log('🚀 Iniciando optimización masiva de imágenes...');

    db.all("SELECT id, image FROM products WHERE image IS NOT NULL AND image != ''", async (err, rows) => {
        if (err) {
            console.error('Error al obtener productos:', err);
            return;
        }

        console.log(`📦 Encontrados ${rows.length} productos con imágenes.`);

        for (const row of rows) {
            const originalPath = path.resolve(__dirname, '..', row.image);

            if (!fs.existsSync(originalPath)) {
                console.warn(`⚠️ Archivo no encontrado: ${row.image}`);
                continue;
            }

            if (row.image.endsWith('.webp')) {
                console.log(`✅ Ya es WebP: ${row.image}`);
                continue;
            }

            const fileNameNoExt = path.basename(row.image, path.extname(row.image));
            const newFileName = `${fileNameNoExt}.webp`;
            const newRelativePath = `assets/images/products/toner/${newFileName}`;
            const newAbsolutePath = path.join(productsDir, newFileName);

            try {
                await sharp(originalPath)
                    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toFile(newAbsolutePath);

                // Actualizar DB
                db.run("UPDATE products SET image = ? WHERE id = ?", [newRelativePath, row.id], (updateErr) => {
                    if (updateErr) {
                        console.error(`❌ Error actualizando DB para ${row.id}:`, updateErr);
                    } else {
                        console.log(`✨ Optimizado: ${row.image} -> ${newRelativePath}`);

                        // Opcional: Borrar original si no es el mismo (para no borrar el logo de reserva si se usa)
                        if (!row.image.includes('logo.svg') && originalPath !== newAbsolutePath) {
                            fs.unlinkSync(originalPath);
                        }
                    }
                });
            } catch (sharpErr) {
                console.error(`❌ Error procesando ${row.image}:`, sharpErr.message);
            }
        }
    });
}

optimizeImages();
