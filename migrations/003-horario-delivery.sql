-- Migración 003: horario de delivery editable por local.
-- Guardado en minutos desde medianoche (ej. 720 = 12:00, 1200 = 20:00).
-- Si inicio >= fin, el local está considerado cerrado todo el día.
-- Idempotente.

INSERT INTO public.orbita_config (clave, valor) VALUES
  ('delivery_hora_inicio_handroll', 720),
  ('delivery_hora_fin_handroll', 1260),
  ('delivery_hora_inicio_cafe', 540),
  ('delivery_hora_fin_cafe', 1140),
  ('delivery_hora_inicio_fuente', 720),
  ('delivery_hora_fin_fuente', 1320)
ON CONFLICT (clave) DO NOTHING;
