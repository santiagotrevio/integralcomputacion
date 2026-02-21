
const express = require('express');
const router = express.Router();
const db = require('../lib/db');

// Obtener todas las marcas
router.get('/brands', (req, res) => {
    db.all("SELECT * FROM brands", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Obtener todos los productos activos
router.get('/products', (req, res) => {
    db.all("SELECT * FROM products WHERE archived = 0 OR archived IS NULL ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Registrar búsqueda del cliente (Analíticas)
router.post('/log-search', (req, res) => {
    const { query, count } = req.body;
    console.log(`[SEARCH LOG] Query: "${query}", Results: ${count}`);
    if (!query) return res.status(400).json({ error: 'Query missing' });

    db.run("INSERT INTO search_analytics (query, results_count) VALUES (?, ?)",
        [query.trim().toLowerCase(), count], (err) => {
            if (err) console.error("Error logging search:", err);
            res.json({ status: 'ok' });
        });
});

module.exports = router;
