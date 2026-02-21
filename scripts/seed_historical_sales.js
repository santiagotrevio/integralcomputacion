const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../inventario.db');
const db = new sqlite3.Database(dbPath);

const dataPath = path.resolve(__dirname, '../data/parsed_invoices.json');
const invoices = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

db.serialize(() => {
    console.log(`Borrando historial antiguo para insertar ${invoices.length} facturas PDF puras...`);
    db.run(`DELETE FROM imported_sale_items`);

    const stmtClient = db.prepare(`INSERT OR IGNORE INTO clients (name, company) VALUES (?, ?)`);
    const stmtSale = db.prepare(`INSERT OR REPLACE INTO imported_sales (invoice_no, sale_date, client_name_raw, amount) VALUES (?, ?, ?, ?)`);
    const stmtItem = db.prepare(`INSERT INTO imported_sale_items (invoice_no, qty, unit, description, price, amount) VALUES (?, ?, ?, ?, ?, ?)`);

    db.run("BEGIN TRANSACTION");

    let processed = 0;
    invoices.forEach(inv => {
        if (!inv.cliente || !inv.folio) return;

        // Formatear cliente
        const clientName = inv.cliente.trim();

        // Crear cliente en directorio
        stmtClient.run(clientName, clientName);

        // Guardar la factura
        stmtSale.run(inv.folio, inv.fecha, clientName, inv.total);

        // Guardar items de esta factura
        (inv.productos || []).forEach(prod => {
            stmtItem.run(inv.folio, prod.qty, prod.unit, prod.desc, prod.price, prod.amount);
            processed++;
        });
    });

    db.run("COMMIT", (err) => {
        if (err) console.error("Error committing transaction:", err);
        else console.log(`¡Éxito! Se insertaron ${invoices.length} facturas y ${processed} items individuales en la DB.`);

        stmtClient.finalize();
        stmtSale.finalize();
        stmtItem.finalize();
        db.close();
    });
});
