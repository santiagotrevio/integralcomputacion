
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../inventario.db');
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

module.exports = db;
