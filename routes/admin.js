
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const { exec } = require('child_process');
const db = require('../lib/db');
const authMiddleware = require('../middleware/auth');


const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const API_SECRET_TOKEN = process.env.API_SECRET_TOKEN;

if (!ADMIN_PASSWORD || !API_SECRET_TOKEN) {
    console.error('❌ FATAL: ADMIN_PASSWORD y API_SECRET_TOKEN deben estar definidos en .env');
    process.exit(1);
}

// Configuración de almacenamiento en memoria para procesamiento
const upload = multer({ storage: multer.memoryStorage() });

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

// Endpoint de Login para obtener el token (Público pero relacionado con Admin)
router.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ token: API_SECRET_TOKEN });
    } else {
        res.status(403).json({ error: 'Contraseña incorrecta' });
    }
});

// A partir de aquí todas las rutas requieren autenticación
router.use(authMiddleware);

// Endpoint TEMPORAL para sincronizar DB inicial
router.post('/upload-db', express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
    try {
        const dbPath = process.env.DB_PATH || path.join(__dirname, '../inventario.db');
        fs.writeFileSync(dbPath, req.body);
        console.log('✅ Base de datos subida y sobreescrita en:', dbPath);
        res.json({ success: true, message: 'DB actualizada. Reiniciando servidor...' });
        // Reiniciar servidor para que SQLite recargue los archivos
        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// Upload Imagen Producto
router.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send('Error');

    const fileName = `${Date.now()}-${req.file.originalname.split('.')[0]}.webp`;
    const outputPath = path.join(__dirname, '../assets/images/products/toner', fileName);

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

// Upload Logo Marca
router.post('/upload-brand', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send('Error');

    const brandName = req.body.name || 'brand';
    const fileName = `${brandName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}.png`;
    const outputPath = path.join(__dirname, '../assets/images/brands', fileName);

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

// Actualizar Marca
router.put('/brands/:id', (req, res) => {
    const { name, logo, scale, offset_x, offset_y, color } = req.body;
    const id = req.params.id;

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

// Conflict Management
router.get('/conflicts', (req, res) => {
    db.all("SELECT * FROM product_conflicts WHERE resolved = 0 ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/conflicts/stage', (req, res) => {
    const { product_id, new_data } = req.body;
    db.get("SELECT * FROM products WHERE id = ?", [product_id], (err, currentData) => {
        if (err || !currentData) return res.status(404).json({ error: "Product not found to archive" });
        db.run(`INSERT INTO product_conflicts (product_id, old_data, new_data) VALUES (?, ?, ?)`,
            [product_id, JSON.stringify(currentData), JSON.stringify(new_data)], function (iErr) {
                if (iErr) return res.status(500).json({ error: iErr.message });
                res.json({ message: "Conflict staged", id: this.lastID });
            });
    });
});

router.post('/conflicts/:id/resolve', (req, res) => {
    const { action } = req.body;
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
            db.run("UPDATE product_conflicts SET resolved = 1 WHERE id = ?", [conflictId], () => {
                res.json({ message: "Kept original version" });
            });
        }
    });
});

// Products CRUD
router.post('/products', (req, res) => {
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

router.put('/products/:id', (req, res) => {
    const { id: newId, name, category, brand, price, stock, compatibility, image, description } = req.body;
    ensureBrandExists(brand);
    const sql = `UPDATE products SET id = ?, name = ?, category = ?, brand = ?, price = ?, stock = ?, compatibility = ?, image = ?, description = ?, published = 0 WHERE id = ?`;
    db.run(sql, [newId, name, category, brand, price, stock, compatibility, image, description, req.params.id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Updated" });
    });
});

router.post('/publish', (req, res) => {
    const scriptPath = path.join(__dirname, '../scripts', 'generate_js.js');
    console.log(`Publishing: Running ${scriptPath}`);

    exec(`node "${scriptPath}"`, (err, stdout, stderr) => {
        if (err) {
            console.error('Publish Error:', err, stderr);
            return res.status(500).json({ error: 'Fallo al generar productos.js' });
        }

        // Crear un Snapshot automático después de publicar con éxito
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const versionTag = `V-${timestamp}`;
        const sourcePath = path.join(__dirname, '../assets/js/productos.js');
        const snapshotName = `productos-${versionTag}.js`;
        const destPath = path.join(__dirname, '../backups/snapshots', snapshotName);

        try {
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);

                db.run(`INSERT INTO site_snapshots (version_tag, file_path, description) VALUES (?, ?, ?)`,
                    [versionTag, `/backups/snapshots/${snapshotName}`, 'Snapshot automático post-publicación']);

                db.run("UPDATE site_snapshots SET is_active = 0"); // Reset previous
                db.run("UPDATE site_snapshots SET is_active = 1 WHERE version_tag = ?", [versionTag]);
            }
        } catch (copyErr) {
            console.error('Snapshot error:', copyErr);
        }

        db.run("UPDATE products SET published = 1", (uErr) => {
            if (uErr) console.error('DB Update Error:', uErr);
            res.json({ message: 'OK', version: versionTag });
        });
    });
});

// --- Snapshots & Rollback ---
router.get('/snapshots', (req, res) => {
    db.all("SELECT * FROM site_snapshots ORDER BY created_at DESC LIMIT 10", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/snapshots/:id/rollback', (req, res) => {
    const snapshotId = req.params.id;
    db.get("SELECT * FROM site_snapshots WHERE id = ?", [snapshotId], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Snapshot no encontrado" });

        const sourcePath = path.join(__dirname, '..', row.file_path);
        const destPath = path.join(__dirname, '../assets/js/productos.js');

        try {
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);

                db.run("UPDATE site_snapshots SET is_active = 0");
                db.run("UPDATE site_snapshots SET is_active = 1 WHERE id = ?", [snapshotId]);

                res.json({ message: "Rollback exitoso", version: row.version_tag });
            } else {
                res.status(404).json({ error: "El archivo de respaldo no existe físicamente" });
            }
        } catch (err) {
            res.status(500).json({ error: "Error al restaurar: " + err.message });
        }
    });
});

// Wizard Import
router.post('/import-image-url', async (req, res) => {
    const { productId, imageUrl } = req.body;
    if (!productId || !imageUrl) return res.status(400).json({ error: 'Faltan datos' });

    const fileName = `${productId.replace(/[^a-zA-Z0-9]/g, '_')}.webp`;
    const outputPath = path.join(__dirname, '../assets/images/products/toner', fileName);

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
        db.run(`UPDATE products SET image = ? WHERE id = ?`, [relativePath, productId], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, url: relativePath, changes: this.changes });
        });
    } catch (err) {
        console.error('[WIZARD] Catch Error:', err);
        res.status(500).json({ error: 'Fallo al procesar la imagen: ' + err.message });
    }
});

router.post('/import-brand-logo', async (req, res) => {
    const { brandName, imageUrl } = req.body;
    if (!brandName || !imageUrl) return res.status(400).json({ error: 'Faltan datos' });

    const fileName = `${brandName.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
    const outputPath = path.join(__dirname, '../assets/images/brands', fileName);

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

// Delete methods
router.delete('/products/pending', (req, res) => {
    db.run(`DELETE FROM products WHERE published = 0`, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "OK", changes: this.changes });
    });
});

router.delete('/products/:id', (req, res) => {
    db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "OK", changes: this.changes });
    });
});

// --- Search Intelligence Analytics ---
router.get('/search-analytics', (req, res) => {
    // 1. Oportunidades perdidas (Búsquedas comunes con 0 resultados)
    const sqlMissed = `
        SELECT query, COUNT(*) as occurrences 
        FROM search_analytics 
        WHERE results_count = 0 
        GROUP BY query 
        ORDER BY occurrences DESC 
        LIMIT 20
    `;

    // 2. Búsquedas más frecuentes en general
    const sqlTop = `
        SELECT query, COUNT(*) as occurrences 
        FROM search_analytics 
        GROUP BY query 
        ORDER BY occurrences DESC 
        LIMIT 20
    `;

    db.all(sqlMissed, [], (err, missed) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(sqlTop, [], (err2, top) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ missed, top });
        });
    });
});


// ─── SISTEMA DE COTIZACIONES ───

// Obtener el siguiente ID de cotización
router.get('/quotes/next-id/:userId', (req, res) => {
    const userId = req.params.userId.padStart(2, '0');
    let dateStr;

    if (req.query.date) {
        // Formato esperado: YYYY-MM-DD del input date
        const parts = req.query.date.split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts;
            dateStr = `${d.padStart(2, '0')}${m.padStart(2, '0')}${y.slice(-2)}`;
        }
    }

    // Fallback a hoy si no hay fecha o es inválida
    if (!dateStr) {
        const now = new Date();
        dateStr = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
    }

    const prefix = `IC${userId}-${dateStr}-`;

    db.get("SELECT COUNT(*) as count FROM quotes WHERE quote_id LIKE ?", [`${prefix}%`], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const nextNum = (row.count + 1).toString().padStart(2, '0');
        res.json({ nextId: `${prefix}${nextNum}` });
    });
});

// Listar clientes del CRM con conteo de cotizaciones
router.get('/clients', authMiddleware, (req, res) => {
    const { q } = req.query; // búsqueda opcional
    let query = `
        SELECT c.id, c.name, c.company, c.email, c.phone, c.last_quoted_at,
               COUNT(qu.rowid) as quote_count,
               MAX(qu.total) as max_total,
               SUM(qu.total) as total_spent
        FROM clients c
        LEFT JOIN quotes qu ON qu.client_name = c.name AND COALESCE(qu.status,'active') != 'trash'
    `;
    const params = [];
    if (q) {
        query += ` WHERE (c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`;
        const like = `%${q}%`;
        params.push(like, like, like, like);
    }
    query += ` GROUP BY c.id ORDER BY c.last_quoted_at DESC`;
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Editar cliente
router.put('/clients/:id', authMiddleware, (req, res) => {
    const { name, company, email, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    db.run('UPDATE clients SET name=?, company=?, email=?, phone=? WHERE id=?',
        [name, company || '', email || '', phone || '', req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Eliminar cliente (y sus cotizaciones si se desea)
router.delete('/clients/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM clients WHERE id=?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});


router.post('/quotes', authMiddleware, (req, res) => {
    const { quoteId, clientName, clientCompany, clientEmail, clientPhone, userId, total, items, notes, validity } = req.body;

    if (!quoteId || (!clientName && !clientCompany)) return res.status(400).json({ error: 'Datos incompletos' });

    const nameKey = clientName || clientCompany; // usar empresa como clave si no hay nombre

    db.serialize(() => {
        // 1. Upsert del cliente
        db.run(`INSERT INTO clients (name, company, email, phone) VALUES (?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET 
                company = excluded.company,
                email = excluded.email, 
                phone = excluded.phone, 
                last_quoted_at = CURRENT_TIMESTAMP`,
            [nameKey, clientCompany || '', clientEmail || '', clientPhone || '']);

        // 2. Insertar la cotización (ignorar si ya existe el mismo folio)
        db.run(`INSERT OR IGNORE INTO quotes 
                (quote_id, client_name, client_company, client_email, client_phone, user_id, total, items, notes, validity, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [quoteId, nameKey, clientCompany || '', clientEmail || '', clientPhone || '', userId, total, JSON.stringify(items), notes || '', validity || 15],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, quoteId });
            });
    });
});

// Listar historial de cotizaciones
router.get('/quotes', authMiddleware, (req, res) => {
    const { status = 'active', userId, clientName } = req.query;
    let query = `SELECT id, quote_id, client_name, client_company, client_email, client_phone, user_id, total, items, notes, validity, status, created_at
                 FROM quotes WHERE status = ?`;
    const params = [status];
    if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
    }
    if (clientName) {
        query += ' AND client_name = ?';
        params.push(clientName);
    }
    query += ' ORDER BY created_at DESC';
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Obtener cotización individual por quote_id
router.get('/quotes/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.get(
        `SELECT id, quote_id, client_name, client_company, client_email, client_phone, user_id, total, items, notes, validity, status, created_at
         FROM quotes WHERE quote_id = ?`,
        [id],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Cotización no encontrada' });
            res.json({ data: row });
        }
    );
});



// Cambiar estado de una cotización (archivar / papelera / restaurar)
// Acepta tanto el id numérico como el quote_id textual (IC01-...)
router.patch('/quotes/:id/status', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'active' | 'archived' | 'trash'
    if (!['active', 'archived', 'trash'].includes(status))
        return res.status(400).json({ error: 'Status inválido' });

    // Intentar primero como quote_id (texto), luego como id numérico
    db.run('UPDATE quotes SET status = ? WHERE quote_id = ?', [status, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes > 0) return res.json({ success: true, changes: this.changes });
        db.run('UPDATE quotes SET status = ? WHERE id = ?', [status, id], function (err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ success: true, changes: this.changes });
        });
    });
});

// Vaciar papelera manual
router.delete('/quotes/trash', authMiddleware, (req, res) => {
    db.run("DELETE FROM quotes WHERE status = 'trash'", [], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, deleted: this.changes });
    });
});

// ── Auto-limpieza: eliminar de papelera cotizaciones con +30 días ──────────────
function cleanOldTrash() {
    db.run(
        "DELETE FROM quotes WHERE status = 'trash' AND created_at < datetime('now', '-30 days')",
        [],
        function (err) {
            if (err) { console.error('[Auto-limpieza] Error:', err.message); return; }
            if (this.changes > 0)
                console.log(`🗑️  Auto-limpieza: ${this.changes} cotizaciones eliminadas de la papelera (+30 días).`);
        }
    );
}
// Ejecutar al arrancar y luego cada 24 horas
cleanOldTrash();
setInterval(cleanOldTrash, 24 * 60 * 60 * 1000);



// ──────────────────────────────────────────────────────────────────────────────
// POST /api/quotes/pdf  — Genera PDF A4 con Puppeteer
// ──────────────────────────────────────────────────────────────────────────────
let _puppeteerBrowser = null;
async function getBrowser() {
    if (_puppeteerBrowser && _puppeteerBrowser.connected) return _puppeteerBrowser;
    const puppeteer = require('puppeteer');
    _puppeteerBrowser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    return _puppeteerBrowser;
}

router.post('/quotes/pdf', authMiddleware, async (req, res) => {
    const { html, filename } = req.body;
    if (!html) return res.status(400).json({ error: 'HTML requerido' });

    try {
        const browser = await getBrowser();
        const page = await browser.newPage();

        // Bloquear Google Fonts y otros recursos externos para evitar timeout
        await page.setRequestInterception(true);
        page.on('request', req => {
            const url = req.url();
            if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
                req.abort(); // No necesitamos esperar fuentes externas
            } else {
                req.continue();
            }
        });

        await page.setViewport({ width: 794, height: 1123 });
        // domcontentloaded: no espera recursos externos (fonts, imágenes remotas)
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });

        // Delay para que carguen imágenes del servidor local y el CSS se aplique
        await new Promise(r => setTimeout(r, 1200));


        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });
        await page.close();

        const safeFilename = (filename || 'cotizacion').replace(/[^\w\-_.]/g, '_') + '.pdf';
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${safeFilename}"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);

    } catch (err) {
        console.error('[PDF] Puppeteer error:', err.message);
        res.status(500).json({ error: 'Error generando PDF: ' + err.message });
    }
});

module.exports = router;
