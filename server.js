
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use(express.static(__dirname)); // Servir archivos de la raíz (index.html, catalogo.html, etc.)
app.use('/assets', express.static(path.join(__dirname, 'assets'))); // Servir assets directamente

// Configuración de almacenamiento en memoria para procesamiento
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send('Error');

    const fileName = `${Date.now()}-${req.file.originalname.split('.')[0]}.webp`;
    const outputPath = path.join(__dirname, 'assets/images/products/toner', fileName);

    try {
        await sharp(req.file.buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(outputPath);

        const relativePath = `assets/images/products/toner/${fileName}`;
        res.json({ url: relativePath });
    } catch (err) {
        console.error('Sharp Error:', err);
        res.status(500).send('Error al procesar imagen');
    }
});

// Specific upload for Brand Logos
app.post('/api/upload-brand', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send('Error');

    const brandName = req.body.name || 'brand';
    const fileName = `${brandName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}.png`;
    const outputPath = path.join(__dirname, 'assets/images/brands', fileName);

    try {
        await sharp(req.file.buffer)
            .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toFile(outputPath);

        const relativePath = `/assets/images/brands/${fileName}`;
        res.json({ url: relativePath });
    } catch (err) {
        console.error('Brand Upload Error:', err);
        res.status(500).send('Error al procesar logo');
    }
});

app.use('/assets', (req, res, next) => {
    // Limpiar el query string (e.g. ?v=123) para que no rompa la búsqueda en el sistema de archivos
    const cleanUrl = req.url.split('?')[0];
    const decodedUrl = decodeURIComponent(cleanUrl);

    // 1. Intentar la ruta exacta primero
    const exactPath = path.join(__dirname, 'assets', decodedUrl);
    if (fs.existsSync(exactPath) && fs.lstatSync(exactPath).isFile()) {
        return res.sendFile(exactPath);
    }

    // 2. Si falla, buscar por nombre de archivo en carpetas conocidas
    const fileName = path.basename(decodedUrl);
    const searchFolders = [
        path.join(__dirname, 'assets/images/products/toner'),
        path.join(__dirname, 'assets/images/brands'),
        path.join(__dirname, 'assets/images'),
        path.join(__dirname, 'assets')
    ];
    for (let folder of searchFolders) {
        const fullPath = path.join(folder, fileName);
        if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
            return res.sendFile(fullPath);
        }
    }
    next();
});

const dbPath = path.resolve(__dirname, 'inventario.db');
const db = new sqlite3.Database(dbPath);

// Asegurar columnas y tablas
db.serialize(() => {
    db.run("ALTER TABLE products ADD COLUMN created_at DATETIME", (err) => { });
    db.run("ALTER TABLE products ADD COLUMN published INTEGER DEFAULT 1", (err) => { });
    db.run("ALTER TABLE products ADD COLUMN brand TEXT", (err) => { });
    db.run("ALTER TABLE products ADD COLUMN description TEXT", (err) => { });

    // Nueva tabla de marcas para personalización
    db.run(`CREATE TABLE IF NOT EXISTS brands (
        id TEXT PRIMARY KEY,
        name TEXT,
        logo TEXT,
        scale REAL DEFAULT 1.0,
        offset_x INTEGER DEFAULT 0,
        offset_y INTEGER DEFAULT 0,
        color TEXT DEFAULT '#0071e3'
    )`);
    // Asegurar que existe offset_x si la tabla ya existía
    db.run("ALTER TABLE brands ADD COLUMN offset_x INTEGER DEFAULT 0", (err) => { });
});

app.get('/api/brands', (req, res) => {
    db.all("SELECT * FROM brands", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.put('/api/brands/:id', (req, res) => {
    const { name, logo, scale, offset_x, offset_y, color } = req.body;
    const id = req.params.id;

    // UPSERT logic for brands
    db.run(`INSERT INTO brands (id, name, logo, scale, offset_x, offset_y, color) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
            name = excluded.name,
            logo = excluded.logo,
            scale = excluded.scale,
            offset_x = excluded.offset_x,
            offset_y = excluded.offset_y,
            color = excluded.color`,
        [id, name, logo, scale, offset_x, offset_y, color], function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ message: "Brand updated" });
        });
});

// --- CONFLICT MANAGEMENT ---
app.get('/api/conflicts', (req, res) => {
    db.all("SELECT * FROM product_conflicts WHERE resolved = 0 ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/conflicts/stage', (req, res) => {
    const { product_id, new_data } = req.body;

    // Get current data to archive
    db.get("SELECT * FROM products WHERE id = ?", [product_id], (err, currentData) => {
        if (err || !currentData) return res.status(404).json({ error: "Product not found to archive" });

        db.run(`INSERT INTO product_conflicts (product_id, old_data, new_data) VALUES (?, ?, ?)`,
            [product_id, JSON.stringify(currentData), JSON.stringify(new_data)], function (iErr) {
                if (iErr) return res.status(500).json({ error: iErr.message });
                res.json({ message: "Conflict staged", id: this.lastID });
            });
    });
});

app.post('/api/conflicts/:id/resolve', (req, res) => {
    const { action } = req.body; // 'keep_old' or 'keep_new'
    const conflictId = req.params.id;

    db.get("SELECT * FROM product_conflicts WHERE id = ?", [conflictId], (err, conflict) => {
        if (err || !conflict) return res.status(404).json({ error: "Conflict not found" });

        const productId = conflict.product_id;
        const newData = JSON.parse(conflict.new_data);

        if (action === 'keep_new') {
            const sql = `UPDATE products SET name = ?, category = ?, brand = ?, compatibility = ?, image = ?, description = ?, published = 0 WHERE id = ?`;
            db.run(sql, [newData.name, newData.category, newData.brand, newData.compatibility, newData.image, newData.description, productId], (uErr) => {
                if (uErr) return res.status(500).json({ error: uErr.message });
                db.run("UPDATE product_conflicts SET resolved = 1 WHERE id = ?", [conflictId], () => {
                    res.json({ message: "Updated with new version" });
                });
            });
        } else if (action === 'update_description') {
            const sql = `UPDATE products SET description = ?, published = 0 WHERE id = ?`;
            db.run(sql, [newData.description, productId], (uErr) => {
                if (uErr) return res.status(500).json({ error: uErr.message });
                db.run("UPDATE product_conflicts SET resolved = 1 WHERE id = ?", [conflictId], () => {
                    res.json({ message: "Description updated" });
                });
            });
        } else if (action === 'custom') {
            const { custom_data } = req.body;
            const sql = `UPDATE products SET name = ?, category = ?, brand = ?, compatibility = ?, description = ?, published = 0 WHERE id = ?`;
            db.run(sql, [custom_data.name, custom_data.category, custom_data.brand, custom_data.compatibility, custom_data.description, productId], (uErr) => {
                if (uErr) return res.status(500).json({ error: uErr.message });
                db.run("UPDATE product_conflicts SET resolved = 1 WHERE id = ?", [conflictId], () => {
                    res.json({ message: "Updated with manual edits" });
                });
            });
        } else {
            // keep_old: We just mark conflict as resolved (no change to products table)
            db.run("UPDATE product_conflicts SET resolved = 1 WHERE id = ?", [conflictId], () => {
                res.json({ message: "Kept original version" });
            });
        }
    });
});

app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Helper to auto-create brand config if not exists
function ensureBrandExists(brandName) {
    if (!brandName || brandName === 'Otros') return;
    const brandId = brandName.trim();
    const logoDefault = `/assets/images/brands/${brandId.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;

    // Check if brand exists
    db.get("SELECT id FROM brands WHERE id = ?", [brandId], (err, row) => {
        if (err || row) return; // Error or already exists

        // Auto-insert default config
        db.run(`INSERT INTO brands (id, name, logo, scale, offset_x, offset_y, color) VALUES (?, ?, ?, 1.0, 0, 0, '#0071e3')`,
            [brandId, brandId, logoDefault]);
    });
}

app.post('/api/products', (req, res) => {
    const { id, name, category, brand, price, stock, compatibility, image, description } = req.body;
    if (!id || id.trim() === "") return res.status(400).json({ error: "ID/Modelo es requerido" });

    ensureBrandExists(brand);

    const now = new Date().toISOString();
    const sql = `INSERT INTO products (id, name, category, brand, price, stock, compatibility, image, description, created_at, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`;
    db.run(sql, [id, name, category, brand, price, stock, compatibility, image, description, now], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Created" });
    });
});

app.put('/api/products/:id', (req, res) => {
    const { id: newId, name, category, brand, price, stock, compatibility, image, description } = req.body;

    ensureBrandExists(brand);

    const sql = `UPDATE products SET id = ?, name = ?, category = ?, brand = ?, price = ?, stock = ?, compatibility = ?, image = ?, description = ?, published = 0 WHERE id = ?`;
    db.run(sql, [newId, name, category, brand, price, stock, compatibility, image, description, req.params.id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Updated" });
    });
});

app.post('/api/publish', (req, res) => {
    const scriptPath = path.join(__dirname, 'scripts', 'generate_js.js');
    console.log(`Publishing: Running ${scriptPath}`);
    exec(`node "${scriptPath}"`, (err, stdout, stderr) => {
        if (err) {
            console.error('Publish Error:', err, stderr);
            return res.status(500).json({ error: 'Fallo al generar productos.js' });
        }
        db.run("UPDATE products SET published = 1", (uErr) => {
            if (uErr) console.error('DB Update Error:', uErr);
            res.json({ message: 'OK' });
        });
    });
});

app.get('/api/scout-price/:model', async (req, res) => {
    try {
        const name = req.query.name || "";
        console.log(`📡 [RADAR] Iniciando escaneo para: ${req.params.model} (${name})`);
        const results = await scoutPrice(req.params.model, name);
        console.log(`✅ [RADAR] Escaneo completado. Resultados encontrados: ${results.length}`);
        res.json({ data: results });
    } catch (err) {
        console.error(`❌ [RADAR] Error en escaneo:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- SERVICIO DE INTELIGENCIA AUTÓNOMO ---
const marketScanner = require('./scripts/market_trends_scanner');

// Tarea de actualización automática (Cada 12 horas)
const REFRESH_INTERVAL = 12 * 60 * 60 * 1000;

const runMarketScanner = async () => {
    console.log("🕒 [AUTO-INTEL] Actualizando tendencias de mercado de forma autónoma...");
    try {
        await marketScanner();
        console.log("✅ [AUTO-INTEL] Datos actualizados con éxito.");
    } catch (err) {
        console.error("❌ [AUTO-INTEL] Error en actualización automática:", err.message);
    }
};

// Primer escaneo al iniciar y luego programado
runMarketScanner();
setInterval(runMarketScanner, REFRESH_INTERVAL);

app.get('/api/market-trends', async (req, res) => {
    try {
        const forceRefresh = req.query.forceRefresh === 'true';
        const cachePath = path.join(__dirname, 'assets/data/market_intelligence.json');

        // Si no es forceRefresh y el cache existe, devolver cache
        if (!forceRefresh && fs.existsSync(cachePath)) {
            const data = fs.readFileSync(cachePath, 'utf8');
            return res.json(JSON.parse(data));
        }

        // De lo contrario, ejecutar escaneo real
        console.log("⚡ [LIVE-INTEL] Ejecutando escaneo solicitado por el usuario...");
        const results = await marketScanner();
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/import-image-url', async (req, res) => {
    const { productId, imageUrl } = req.body;
    if (!productId || !imageUrl) return res.status(400).json({ error: 'Faltan datos' });

    console.log(`[WIZARD] Importando imagen para ${productId} desde ${imageUrl}`);

    const fileName = `${productId.replace(/[^a-zA-Z0-9]/g, '_')}.webp`;
    const outputPath = path.join(__dirname, 'assets/images/products/toner', fileName);

    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fallo al descargar: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await sharp(buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(outputPath);

        const relativePath = `assets/images/products/toner/${fileName}`;
        console.log(`[WIZARD] Imagen guardada en ${outputPath}`);

        db.run(`UPDATE products SET image = ? WHERE id = ?`, [relativePath, productId], function (err) {
            if (err) {
                console.error(`[WIZARD] Error DB: ${err.message}`);
                return res.status(500).json({ error: err.message });
            }
            console.log(`[WIZARD] DB actualizada para ${productId}. Filas afectadas: ${this.changes}`);
            res.json({ success: true, url: relativePath, changes: this.changes });
        });
    } catch (err) {
        console.error('[WIZARD] Catch Error:', err);
        res.status(500).json({ error: 'Fallo al procesar la imagen: ' + err.message });
    }
});

app.post('/api/import-brand-logo', async (req, res) => {
    const { brandName, imageUrl } = req.body;
    if (!brandName || !imageUrl) return res.status(400).json({ error: 'Faltan datos' });

    const fileName = `${brandName.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
    const outputPath = path.join(__dirname, 'assets/images/brands', fileName);

    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fallo al descargar: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await sharp(buffer)
            .resize(400, 200, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toFile(outputPath);

        res.json({ success: true, url: `/assets/${fileName}` });
    } catch (err) {
        console.error('Brand Logo Import Error:', err);
        res.status(500).json({ error: 'Fallo al descargar o procesar el logo.' });
    }
});

app.delete('/api/products/pending', (req, res) => {
    db.run(`DELETE FROM products WHERE published = 0`, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "OK", changes: this.changes });
    });
});

app.delete('/api/products/:id', (req, res) => {
    db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "OK", changes: this.changes });
    });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Listo en puerto ${PORT}`));
