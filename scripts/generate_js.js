
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
    console.log('Fetching products and brands...');

    db.all(`SELECT * FROM products WHERE archived = 0 OR archived IS NULL ORDER BY name ASC`, [], (err, prodRows) => {
        if (err) throw err;

        db.all(`SELECT * FROM brands`, [], (err, brandRows) => {
            if (err) throw err;

            console.log(`Found ${prodRows.length} products and ${brandRows.length} brand configs.`);

            const products = prodRows.map(row => ({
                id: row.id,
                category: row.category,
                brand: row.brand,
                name: row.name,
                description: row.description,
                image: row.image,
                ...(row.price > 0 && { price: row.price }),
                ...(row.yield > 0 && { yield: row.yield }),
                ...(row.compatibility && { compatibility: row.compatibility })
            }));

            const brands = brandRows || [];

            const fileContent = `// Base de datos de productos (Generado automáticamente desde SQLite)\n` +
                `const productsDB = ${JSON.stringify(products, null, 2)};\n\n` +
                `const brandSettingsDB = ${JSON.stringify(brands, null, 2)};`;

            fs.writeFile(targetPath, fileContent, (err) => {
                if (err) throw err;
                console.log(`✅ Success! Updated assets/js/productos.js with ${products.length} items and brand customizations.`);
                db.close();
            });
        });
    });
});
