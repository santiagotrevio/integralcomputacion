
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../inventario.db');
const jsPath = path.resolve(__dirname, '../assets/js/productos.js');

// 1. Read JS file
console.log('Reading productos.js...');
let content = fs.readFileSync(jsPath, 'utf8');

// Extract JSON array
const jsonStart = content.indexOf('[');
const jsonEnd = content.lastIndexOf(']');
const jsonStr = content.substring(jsonStart, jsonEnd + 1);

let products = [];
try {
    products = JSON.parse(jsonStr);
    console.log(`Found ${products.length} products to migrate.`);

    // Deduplicate by ID
    const uniqueMap = new Map();
    products.forEach(p => {
        if (!uniqueMap.has(p.id)) {
            uniqueMap.set(p.id, p);
        } else {
            console.warn(`Duplicate ID found: ${p.id} (${p.name}). Keeping first one.`);
        }
    });

    products = Array.from(uniqueMap.values());
    console.log(`Cleaned list: ${products.length} unique products.`);

} catch (e) {
    console.error('Error parsing JSON:', e);
    process.exit(1);
}

// 2. Setup DB
console.log('Setting up SQLite database...');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Create Table
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        description TEXT,
        image TEXT,
        price REAL,
        stock INTEGER DEFAULT 0,
        compatibility TEXT,
        yield INTEGER
    )`);

    // Clear old data
    db.run(`DELETE FROM products`);

    // Insert Data
    const stmt = db.prepare(`INSERT INTO products (id, name, category, description, image, price, compatibility) VALUES (?, ?, ?, ?, ?, ?, ?)`);

    products.forEach(p => {
        // Mock some extra data for now
        let price = 0; // Placeholder
        let comp = ""; // Placeholder for compatibility

        // Simple heuristic for compatibility from name
        if (p.name.includes("HP")) comp += "HP ";
        if (p.name.includes("Brother")) comp += "Brother ";
        if (p.name.includes("Canon")) comp += "Canon ";

        stmt.run(p.id, p.name, p.category, p.description, p.image, price, comp.trim());
    });

    stmt.finalize();

    console.log('Migration complete!');
    console.log(`Database saved to: ${dbPath}`);
});

db.close();
