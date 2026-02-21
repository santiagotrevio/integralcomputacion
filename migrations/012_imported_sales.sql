-- Migración: Tabla de ventas importadas
CREATE TABLE IF NOT EXISTS imported_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT UNIQUE,
    sale_date DATE,
    client_name_raw TEXT,
    amount REAL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
