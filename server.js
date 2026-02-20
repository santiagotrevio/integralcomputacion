
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Seguridad: solo el dominio propio puede hacer requests ──────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(',')
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://integral-computacion-production.up.railway.app'
    ];

app.use(cors({
    origin: (origin, cb) => {
        // Permitir requests sin origin (curl, Postman, apps nativas)
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('CORS bloqueado: ' + origin));
    },
    credentials: true
}));

// ── Rate limiting en login para evitar fuerza bruta ─────────────────────────────
const loginAttempts = new Map();
app.use('/api/login', (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const entry = loginAttempts.get(ip) || { count: 0, first: now };

    // Resetear contador si pasó más de 15 min
    if (now - entry.first > 15 * 60 * 1000) {
        loginAttempts.set(ip, { count: 1, first: now });
        return next();
    }

    entry.count++;
    loginAttempts.set(ip, entry);

    if (entry.count > 10) {
        return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
    }
    next();
});

// ── Body parser con límite razonable ────────────────────────────────────────────
app.use(bodyParser.json({ limit: '10mb' })); // 50mb era excesivo

// ── Importar Routers ────────────────────────────────────────────────────────────
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

app.use('/api', publicRoutes);
app.use('/api', adminRoutes);

// ── Archivos estáticos ──────────────────────────────────────────────────────────
app.use(express.static('public'));
app.use(express.static(__dirname));

// ── Assets con fallback por nombre de archivo ────────────────────────────────────
app.use('/assets', (req, res, next) => {
    const cleanUrl = req.url.split('?')[0];
    const decodedUrl = decodeURIComponent(cleanUrl);

    const exactPath = path.join(__dirname, 'assets', decodedUrl);
    if (fs.existsSync(exactPath) && fs.lstatSync(exactPath).isFile()) {
        return res.sendFile(exactPath);
    }

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

app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ── Manejo global de errores ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Error global]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
