-- Migración 001: costo de delivery editable por local.
-- Agrega 3 claves en orbita_config con default $2.000.
-- Idempotente: se puede correr varias veces sin efectos colaterales.

INSERT INTO public.orbita_config (clave, valor) VALUES
  ('costo_delivery_handroll', 2000),
  ('costo_delivery_cafe', 2000),
  ('costo_delivery_fuente', 2000)
ON CONFLICT (clave) DO NOTHING;
