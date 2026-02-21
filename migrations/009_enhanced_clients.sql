-- Migración: Directorio de Clientes y Datos Extensos
ALTER TABLE clients ADD COLUMN address TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN billing_info TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN secondary_emails TEXT DEFAULT '[]';
ALTER TABLE clients ADD COLUMN secondary_phones TEXT DEFAULT '[]';
ALTER TABLE clients ADD COLUMN archived INTEGER DEFAULT 0;
