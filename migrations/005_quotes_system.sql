-- Migración: Sistema de Cotizaciones y Clientes
-- Tabla de Clientes para historial
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    last_quoted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Cotizaciones guardadas
CREATE TABLE IF NOT EXISTS quotes (
    quote_id TEXT PRIMARY KEY, -- Formato ICXX-DDMMYY-XX
    client_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    total REAL NOT NULL,
    items JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
