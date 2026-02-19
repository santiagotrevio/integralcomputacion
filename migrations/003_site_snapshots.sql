-- Migración 003: Sistema de Snapshots y Versiones del Sitio

CREATE TABLE IF NOT EXISTS site_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_tag TEXT NOT NULL, -- Ej: 'V-20240219-1200'
    file_path TEXT NOT NULL,    -- Ruta al archivo .js respaldado
    description TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 0,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
