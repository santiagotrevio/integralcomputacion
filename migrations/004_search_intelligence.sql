-- Migración 004: Inteligencia de Búsqueda y Analíticas

CREATE TABLE IF NOT EXISTS search_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    user_session_id TEXT, -- Para agrupar búsquedas de un mismo cliente
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
