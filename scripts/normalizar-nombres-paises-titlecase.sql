-- ============================================================
-- Normalizar "Title Case" en paises.Nombre_pais (España, Afganistán, Antártida…)
-- Objetivo:
-- - Corregir casos como: ESPAÑa -> España, AFGANISTÁn -> Afganistán
-- - Funciona con tildes/ñ (UTF-8).
--
-- Recomendación:
-- 1) Ejecuta antes el script de mojibake si lo necesitas:
--    scripts/normalizar-nombres-paises-utf8.sql
-- 2) Ejecuta este script para corregir capitalización.
--
-- Nota:
-- - Mantiene en minúscula conectores comunes: de, del, la, las, el, los, y, o (salvo al inicio).
-- - Mantiene acrónimos 2-4 caracteres (p.ej. USA) tal cual.
-- ============================================================

DROP FUNCTION IF EXISTS title_es;

DELIMITER $$
CREATE FUNCTION title_es(s VARCHAR(255))
RETURNS VARCHAR(255)
DETERMINISTIC
BEGIN
  DECLARE orig VARCHAR(255);
  DECLARE x VARCHAR(255);
  DECLARE out VARCHAR(255) DEFAULT '';
  DECLARE token VARCHAR(255);
  DECLARE rest VARCHAR(255);
  DECLARE firstWord TINYINT DEFAULT 1;

  DECLARE sub VARCHAR(255);
  DECLARE subRest VARCHAR(255);
  DECLARE builtToken VARCHAR(255);
  DECLARE firstSub TINYINT;

  SET orig = TRIM(COALESCE(s, ''));
  IF orig = '' THEN
    RETURN orig;
  END IF;

  -- Preservar acrónimos cortos (USA, UAE, etc.)
  IF orig REGEXP '^[A-Z0-9]{2,4}$' THEN
    RETURN orig;
  END IF;

  -- Normalizar espacios y pasar a minúsculas
  SET x = LOWER(orig);
  SET x = REGEXP_REPLACE(x, '[[:space:]]+', ' ');
  SET x = TRIM(x);

  WHILE x <> '' DO
    IF LOCATE(' ', x) > 0 THEN
      SET token = SUBSTRING_INDEX(x, ' ', 1);
      SET rest = SUBSTRING(x, CHAR_LENGTH(token) + 2);
    ELSE
      SET token = x;
      SET rest = '';
    END IF;

    -- Conectores: mantener en minúscula si no es la primera palabra
    IF firstWord = 0 AND token IN ('de','del','la','las','el','los','y','o') THEN
      SET builtToken = token;
    ELSE
      -- Title case dentro del token, respetando guiones (p.ej. "guinea-bisáu")
      SET builtToken = '';
      SET subRest = token;
      SET firstSub = 1;
      WHILE subRest <> '' DO
        IF LOCATE('-', subRest) > 0 THEN
          SET sub = SUBSTRING_INDEX(subRest, '-', 1);
          SET subRest = SUBSTRING(subRest, CHAR_LENGTH(sub) + 2);
        ELSE
          SET sub = subRest;
          SET subRest = '';
        END IF;

        IF sub = '' THEN
          -- nada
        ELSE
          SET sub = CONCAT(UPPER(LEFT(sub, 1)), SUBSTRING(sub, 2));
        END IF;

        IF builtToken = '' THEN
          SET builtToken = sub;
        ELSE
          SET builtToken = CONCAT(builtToken, '-', sub);
        END IF;

        SET firstSub = 0;
      END WHILE;
    END IF;

    IF out = '' THEN
      SET out = builtToken;
    ELSE
      SET out = CONCAT(out, ' ', builtToken);
    END IF;

    SET firstWord = 0;
    SET x = rest;
  END WHILE;

  RETURN out;
END$$
DELIMITER ;

-- Aplicar a todos los países (seguro: NO deja NULL)
UPDATE paises
SET Nombre_pais = title_es(Nombre_pais)
WHERE Nombre_pais IS NOT NULL AND TRIM(Nombre_pais) <> '';

-- (Opcional) Verificar ejemplos concretos
-- SELECT Id_pais, Nombre_pais FROM paises WHERE Id_pais IN ('ES','PT') OR Nombre_pais LIKE '%España%';

