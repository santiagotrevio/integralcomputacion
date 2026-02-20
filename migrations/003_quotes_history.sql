-- Migración 003: Historial de Cotizaciones y CRM de Clientes

-- Tabla de clientes (CRM compartido entre vendedores)
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    last_quoted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de cotizaciones (folio único compartido entre usuarios)
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id TEXT UNIQUE NOT NULL,
    client_name TEXT,
    user_id TEXT,
    total REAL,
    items TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
