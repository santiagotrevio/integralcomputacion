-- Migración inicial: Estructura profesional de la base de datos

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    brand TEXT,
    price REAL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    compatibility TEXT,
    image TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published INTEGER DEFAULT 0
);

-- Tabla de configuración de marcas
CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo TEXT,
    scale REAL DEFAULT 1.0,
    offset_x INTEGER DEFAULT 0,
    offset_y INTEGER DEFAULT 0,
    color TEXT DEFAULT '#0071e3'
);

-- Tabla de conflictos para sincronización/auditoría
CREATE TABLE IF NOT EXISTS product_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    old_data TEXT,
    new_data TEXT,
    resolved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Tabla de versiones de migración (para control interno)
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    version TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
