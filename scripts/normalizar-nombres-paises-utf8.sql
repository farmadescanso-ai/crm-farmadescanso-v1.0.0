-- ============================================================
-- Normalizar nombres de países a UTF-8 (paises.Nombre_pais)
-- Objetivo:
-- - Corregir mojibake típico (EspaÃ±a, MÃ©xico, etc.)
-- - NO tocar filas que ya están correctas
--
-- IMPORTANTE:
-- - Haz backup antes si vas a ejecutar en producción.
-- - Este script aplica una corrección estándar: interpretar el texto como latin1
--   y convertir a utf8mb4. Solo se ejecuta sobre filas "sospechosas".
-- ============================================================

-- 1) Previsualización (antes/después) para revisar
SELECT
  id,
  Id_pais,
  Nombre_pais AS before,
  CONVERT(BINARY CONVERT(Nombre_pais USING latin1) USING utf8mb4) AS after
FROM paises
WHERE
  Nombre_pais REGEXP 'Ã|Â|├|�'
  OR Nombre_pais LIKE '%Ã%'
  OR Nombre_pais LIKE '%Â%'
  OR Nombre_pais LIKE '%├%';

-- 2) Aplicar solo a filas sospechosas
UPDATE paises
SET Nombre_pais = CONVERT(BINARY CONVERT(Nombre_pais USING latin1) USING utf8mb4)
WHERE
  Nombre_pais REGEXP 'Ã|Â|├|�'
  OR Nombre_pais LIKE '%Ã%'
  OR Nombre_pais LIKE '%Â%'
  OR Nombre_pais LIKE '%├%';

-- 3) (Opcional) Asegurar collation consistente (si tu servidor mezcla collations)
-- ALTER TABLE paises CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ALTER TABLE paises MODIFY Nombre_pais VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

