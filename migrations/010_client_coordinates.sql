-- Migración: Soporte Geográfico para Clientes
ALTER TABLE clients ADD COLUMN lat REAL DEFAULT NULL;
ALTER TABLE clients ADD COLUMN lng REAL DEFAULT NULL;
