-- Migración 006: Agregar status a cotizaciones (activa/archivada/papelera)
-- y campos adicionales para mejor historial

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS validity INTEGER DEFAULT 15;
