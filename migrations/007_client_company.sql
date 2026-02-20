-- Migración 007: Campo empresa en clientes y cotizaciones
ALTER TABLE clients ADD COLUMN company TEXT DEFAULT '';
ALTER TABLE quotes ADD COLUMN client_company TEXT DEFAULT '';
