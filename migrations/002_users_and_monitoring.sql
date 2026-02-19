-- Migración 002: Sistema de Usuarios y Auditoría (Staff Monitoring)

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'staff', -- 'manager' o 'staff'
    full_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Tabla de historial de acciones (Monitoreo de Staff)
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action_type TEXT NOT NULL, -- 'CREATE_PRODUCT', 'EDIT_PRODUCT', 'PUBLISH', 'LOGIN'
    description TEXT,
    target_id TEXT, -- ID del producto afectado, si aplica
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insertar usuario manager inicial por defecto (si no existe)
-- Nota: La contraseña inicial será la misma del .env temporalmente hasta migrar a Auth completo
INSERT OR IGNORE INTO users (username, password_hash, role, full_name) 
VALUES ('admin', 'placeholder', 'manager', 'Administrador Principal');
