-- ============================================
-- Limpieza: eliminar duplicados y renumerar IDs
-- Tabla: tarifasClientes_precios
--
-- 1) Eliminar duplicados por (Id_Tarifa, Id_Articulo) dejando el Id menor.
-- 2) Renumerar Id (solo si NO hay FKs que referencien esta tabla).
--
-- Recomendación: haz backup antes.
-- ============================================

START TRANSACTION;

-- 1) Eliminar duplicados (si existieran)
DELETE p2
FROM tarifasClientes_precios p1
JOIN tarifasClientes_precios p2
  ON p1.Id_Tarifa = p2.Id_Tarifa
 AND p1.Id_Articulo = p2.Id_Articulo
 AND p1.Id < p2.Id;

-- 2) Renumerar IDs SOLO si nadie referencia tarifasClientes_precios(Id)
SET @__refs := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND REFERENCED_TABLE_NAME = 'tarifasClientes_precios'
);

-- phpMyAdmin/MySQL: PREPARE no soporta múltiples sentencias.
-- Así que mostramos el contador y la renumeración se ejecuta SOLO si @__refs = 0.
SELECT @__refs AS referencias_a_tarifasClientes_precios;

-- Si referencias_a_tarifasClientes_precios > 0: NO renumeres (sería peligroso).
-- Si referencias_a_tarifasClientes_precios = 0: ejecuta estas 2 sentencias:
--   SET @i := 0;
--   UPDATE tarifasClientes_precios SET Id = (@i := @i + 1) ORDER BY Id;

-- Reajustar AUTO_INCREMENT al final (si la renumeración se hizo)
SET @__max_id := (SELECT COALESCE(MAX(Id), 0) FROM tarifasClientes_precios);
SET @__sql_ai := CONCAT('ALTER TABLE tarifasClientes_precios AUTO_INCREMENT = ', @__max_id + 1, ';');
PREPARE stmt FROM @__sql_ai; EXECUTE stmt; DEALLOCATE PREPARE stmt;

COMMIT;

