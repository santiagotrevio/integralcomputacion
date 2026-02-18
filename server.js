
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('public'));

// Configuración de almacenamiento
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'assets/images/products/toner'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).send('Error');
    const relativePath = `assets/images/products/toner/${req.file.filename}`;
    res.json({ url: relativePath });
});

app.use('/assets', (req, res, next) => {
    const fileName = path.basename(decodeURIComponent(req.url));
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

app.delete('/api/products/:id', (req, res) => {
    db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "OK", changes: this.changes });
    });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Listo en puerto ${PORT}`));
