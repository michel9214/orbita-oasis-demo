-- Migración 002: reseñas separadas por local.
-- Agrega columna `sitio` a public.resenas para que cada local
-- (handroll, cafe, fuente) tenga sus propias reseñas.
-- Idempotente.

ALTER TABLE public.resenas
  ADD COLUMN IF NOT EXISTS sitio text NOT NULL DEFAULT 'handroll';

-- Permitir solo los 3 sitios válidos.
ALTER TABLE public.resenas DROP CONSTRAINT IF EXISTS resenas_sitio_check;
ALTER TABLE public.resenas ADD CONSTRAINT resenas_sitio_check
  CHECK (sitio IN ('handroll', 'cafe', 'fuente'));

-- Índice para filtrado rápido por sitio.
CREATE INDEX IF NOT EXISTS resenas_sitio_creado_idx
  ON public.resenas (sitio, creado_at DESC);
