-- Migración: Tabla de artículos de ventas importadas
CREATE TABLE IF NOT EXISTS imported_sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT,
    qty REAL,
    unit TEXT,
    description TEXT,
    price REAL,
    amount REAL
);
