
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

// Asegurar columnas
db.serialize(() => {
    db.run("ALTER TABLE products ADD COLUMN created_at DATETIME", (err) => { });
    db.run("ALTER TABLE products ADD COLUMN published INTEGER DEFAULT 1", (err) => { });
    db.run("ALTER TABLE products ADD COLUMN brand TEXT", (err) => { });
    db.run("ALTER TABLE products ADD COLUMN description TEXT", (err) => { });
});

app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/products', (req, res) => {
    const { id, name, category, brand, price, stock, compatibility, image, description } = req.body;
    if (!id || id.trim() === "") return res.status(400).json({ error: "ID/Modelo es requerido" });
    const now = new Date().toISOString();
    const sql = `INSERT INTO products (id, name, category, brand, price, stock, compatibility, image, description, created_at, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`;
    db.run(sql, [id, name, category, brand, price, stock, compatibility, image, description, now], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Created" });
    });
});

app.put('/api/products/:id', (req, res) => {
    const { name, category, brand, price, stock, compatibility, image, description } = req.body;
    const sql = `UPDATE products SET name = ?, category = ?, brand = ?, price = ?, stock = ?, compatibility = ?, image = ?, description = ?, published = 0 WHERE id = ?`;
    db.run(sql, [name, category, brand, price, stock, compatibility, image, description, req.params.id], function (err) {
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

const scoutPrice = require('./scripts/price_scout');
app.get('/api/scout-price/:model', async (req, res) => {
    try {
        const name = req.query.name || "";
        const results = await scoutPrice(req.params.model, name);
        res.json({ data: results });
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
