-- Migración: Tabla de sucursales configurables
CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    lat REAL,
    lng REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO branches (name, description, lat, lng) VALUES ('Integral Computación (Matriz)', 'Av. Circunvalación División del Norte 1438, GDL', 20.7027581, -103.3340538);
