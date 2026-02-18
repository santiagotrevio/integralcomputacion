
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../inventario.db');
const targetPath = path.resolve(__dirname, '../assets/js/productos.js');

console.log('Connecting to database...');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error(err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    console.log('Fetching products...');
    db.all(`SELECT * FROM products ORDER BY name ASC`, [], (err, rows) => {
        if (err) {
            throw err;
        }

        console.log(`Found ${rows.length} products.`);

        // Clean up data for frontend (remove nulls, format numbers if needed)
        const products = rows.map(row => ({
            id: row.id,
            category: row.category,
            brand: row.brand,
            name: row.name,
            description: row.description,
            image: row.image,
            // Only include price if it's > 0 to save bytes
            ...(row.price > 0 && { price: row.price }),
            // Include yield if > 0
            ...(row.yield > 0 && { yield: row.yield }),
            // Include compatibility if exists
            ...(row.compatibility && { compatibility: row.compatibility })
        }));

        const fileContent = `// Base de datos de productos (Generado automáticamente desde SQLite)\nconst productsDB = ${JSON.stringify(products, null, 2)};`;

        fs.writeFile(targetPath, fileContent, (err) => {
            if (err) throw err;
            console.log(`✅ Success! Updated assets/js/productos.js with ${products.length} items.`);
        });
    });
});

db.close();
