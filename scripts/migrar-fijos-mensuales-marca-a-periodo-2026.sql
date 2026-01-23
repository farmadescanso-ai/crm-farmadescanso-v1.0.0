-- =====================================================
-- MIGRAR fijos_mensuales_marca (sin periodo) -> fijos_mensuales_marca_periodo
-- Ejemplo: duplicar valores para TODOS los meses de 2026
-- =====================================================

USE farmadescanso;

-- Asegúrate de haber creado antes la tabla:
--   scripts/crear-tabla-fijos-mensuales-marca-periodo.sql

-- Crear una tabla temporal de meses (1..12)
DROP TEMPORARY TABLE IF EXISTS tmp_meses;
CREATE TEMPORARY TABLE tmp_meses (mes int NOT NULL);
INSERT INTO tmp_meses (mes) VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12);

-- Insertar/actualizar para 2026 todos los meses con el importe actual (tabla antigua)
INSERT INTO fijos_mensuales_marca_periodo (comercial_id, marca_id, año, mes, importe, activo)
SELECT
  fmm.comercial_id,
  fmm.marca_id,
  2026 AS año,
  tm.mes AS mes,
  fmm.importe,
  fmm.activo
FROM fijos_mensuales_marca fmm
CROSS JOIN tmp_meses tm
ON DUPLICATE KEY UPDATE
  importe = VALUES(importe),
  activo = VALUES(activo),
  fecha_actualizacion = CURRENT_TIMESTAMP;

