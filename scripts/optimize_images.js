/**
 * optimize_images.js
 * Convierte todos los PNGs de productos a WebP y actualiza la DB.
 * Uso: node scripts/optimize_images.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '../inventario.db');
const TONER_DIR = path.join(__dirname, '../assets/images/products/toner');
const WEBP_QUALITY = 82;

const db = new sqlite3.Database(DB_PATH);

async function convertImage(inputPath) {
    const ext = path.extname(inputPath).toLowerCase();
    if (ext === '.webp') return null; // Already WebP

    const outputPath = inputPath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    const inputSizeMB = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(2);

    await sharp(inputPath)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outputPath);

    const outputSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    const saving = (((inputPath.length > 0 ? fs.statSync(inputPath).size : 1) - fs.statSync(outputPath).size) / fs.statSync(inputPath).size * 100).toFixed(0);

    return { inputPath, outputPath, inputSizeMB, outputSizeMB, saving };
}

async function main() {
    console.log('🔍 Buscando imágenes PNG en', TONER_DIR);

    const files = fs.readdirSync(TONER_DIR)
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
        .map(f => path.join(TONER_DIR, f));

    console.log(`📦 Encontradas ${files.length} imágenes para convertir\n`);

    let totalSavedBytes = 0;
    let converted = 0;
    let failed = 0;
    const dbUpdates = [];

    for (const filePath of files) {
        try {
            const result = await convertImage(filePath);
            if (!result) continue;

            const inputBytes = fs.statSync(result.inputPath).size;
            const outputBytes = fs.statSync(result.outputPath).size;
            totalSavedBytes += (inputBytes - outputBytes);

            // Build old and new relative paths for DB
            const oldRelative = 'assets/images/products/toner/' + path.basename(result.inputPath);
            const newRelative = 'assets/images/products/toner/' + path.basename(result.outputPath);
            dbUpdates.push({ oldRelative, newRelative });

            console.log(`✅ ${path.basename(result.inputPath)} → ${result.outputSizeMB}MB (antes: ${result.inputSizeMB}MB, -${result.saving}%)`);
            converted++;
        } catch (err) {
            console.error(`❌ Error con ${path.basename(filePath)}:`, err.message);
            failed++;
        }
    }

    console.log(`\n📊 Conversión completada: ${converted} exitosas, ${failed} fallidas`);
    console.log(`💾 Espacio ahorrado: ${(totalSavedBytes / 1024 / 1024).toFixed(1)} MB\n`);

    // Update database
    console.log('🗄️  Actualizando base de datos...');
    let dbCount = 0;
    await new Promise((resolve) => {
        let pending = dbUpdates.length;
        if (pending === 0) return resolve();

        dbUpdates.forEach(({ oldRelative, newRelative }) => {
            db.run(
                `UPDATE products SET image = ? WHERE image = ?`,
                [newRelative, oldRelative],
                function (err) {
                    if (err) console.error('DB error:', err.message);
                    else if (this.changes > 0) {
                        dbCount += this.changes;
                    }
                    pending--;
                    if (pending === 0) resolve();
                }
            );
        });
    });

    console.log(`✅ ${dbCount} registros actualizados en la base de datos\n`);

    db.close();

    // Now delete original PNGs (only if WebP exists)
    let deleted = 0;
    console.log('🗑️  Eliminando PNGs originales...');
    for (const { inputPath, outputPath } of dbUpdates.map((u, i) => ({
        inputPath: files[i],
        outputPath: files[i].replace(/\.(png|jpg|jpeg)$/i, '.webp')
    }))) {
        if (fs.existsSync(outputPath) && fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
            deleted++;
        }
    }
    console.log(`🗑️  ${deleted} PNGs originales eliminados`);
    console.log('\n🎉 Todo listo. Ahora ejecuta "Publicar" en el panel admin para regenerar productos.js');
}

main().catch(console.error);
