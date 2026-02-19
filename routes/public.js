
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

// Obtener todos los productos
router.get('/products', (req, res) => {
    db.all("SELECT * FROM products ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

module.exports = router;
