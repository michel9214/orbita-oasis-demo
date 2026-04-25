-- Migración 004: múltiples direcciones por cliente.
-- Guardamos un array JSON de strings en la columna orbita_clientes.direcciones.
-- Mantiene direccion_entrega como "principal" (primera del array) por backward-compat.
-- Idempotente.

ALTER TABLE public.orbita_clientes
  ADD COLUMN IF NOT EXISTS direcciones jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Poblar direcciones con direccion_entrega existente (una sola vez, solo filas sin direcciones aún).
UPDATE public.orbita_clientes
SET direcciones = to_jsonb(ARRAY[direccion_entrega])
WHERE direccion_entrega IS NOT NULL
  AND direccion_entrega <> ''
  AND jsonb_array_length(direcciones) = 0;
