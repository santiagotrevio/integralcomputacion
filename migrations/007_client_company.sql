-- Migración 007: Campo empresa en clientes y cotizaciones
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company TEXT DEFAULT '';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_company TEXT DEFAULT '';
