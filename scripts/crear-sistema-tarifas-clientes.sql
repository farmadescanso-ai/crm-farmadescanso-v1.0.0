-- ============================================
-- Sistema de Tarifas por Cliente (Tarifas + Precios por Artículo)
-- CRM Farmadescanso
-- ============================================
-- Objetivo:
-- - Crear tabla de tarifas (`tarifasClientes`)
-- - Crear tabla de precios por tarifa y artículo (`tarifasClientes_precios`)
-- - Crear tarifa General (Id=0) y poblarla con los PVL actuales de `articulos`
-- - Convertir `clientes.Tarifa` (actualmente varchar) a INT y relacionarla por FK
--
-- Notas:
-- - Se inserta explícitamente Id=0 usando NO_AUTO_VALUE_ON_ZERO solo para esta sesión.
-- - Si tu BD tiene nombres/casing distintos en tablas/columnas, adapta los nombres.
-- ============================================

SET @__old_sql_mode := @@SESSION.sql_mode;
-- Permitir insertar 0 en AUTO_INCREMENT sin que MySQL lo convierta a "siguiente id"
SET SESSION sql_mode = CONCAT(@@SESSION.sql_mode, ',NO_AUTO_VALUE_ON_ZERO');

-- 1) Tabla maestra de tarifas
CREATE TABLE IF NOT EXISTS `tarifasClientes` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `NombreTarifa` varchar(100) NOT NULL,
  `Activa` tinyint(1) NOT NULL DEFAULT 1,
  `FechaInicio` date DEFAULT NULL,
  `FechaFin` date DEFAULT NULL,
  `Observaciones` text DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `uq_tarifasClientes_nombre` (`NombreTarifa`),
  KEY `idx_tarifasClientes_activa` (`Activa`),
  KEY `idx_tarifasClientes_fechas` (`FechaInicio`, `FechaFin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Tabla de precios por tarifa y artículo (un artículo solo puede tener un precio por tarifa)
-- Detectar PK de articulos (algunas BD usan `Id`, otras `id`)
SET @__articulos_pk := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'articulos'
        AND COLUMN_NAME = 'Id'
    ),
    'Id',
    'id'
  )
);

SET @__sql_create_precios := CONCAT(
  'CREATE TABLE IF NOT EXISTS `tarifasClientes_precios` (',
  '  `Id` int NOT NULL AUTO_INCREMENT,',
  '  `Id_Tarifa` int NOT NULL,',
  '  `Id_Articulo` int NOT NULL,',
  '  `Precio` decimal(10,2) NOT NULL DEFAULT 0.00,',
  '  PRIMARY KEY (`Id`),',
  '  UNIQUE KEY `uq_tarifa_articulo` (`Id_Tarifa`, `Id_Articulo`),',
  '  KEY `idx_tarifasClientes_precios_articulo` (`Id_Articulo`),',
  '  CONSTRAINT `fk_tarifasClientes_precios_tarifa`',
  '    FOREIGN KEY (`Id_Tarifa`) REFERENCES `tarifasClientes` (`Id`)',
  '    ON UPDATE CASCADE ON DELETE RESTRICT,',
  '  CONSTRAINT `fk_tarifasClientes_precios_articulo`',
  '    FOREIGN KEY (`Id_Articulo`) REFERENCES `articulos` (`', @__articulos_pk, '`)',
  '    ON UPDATE CASCADE ON DELETE RESTRICT',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
);
PREPARE stmt FROM @__sql_create_precios; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Crear Tarifa General (Id=0)
INSERT INTO `tarifasClientes` (`Id`, `NombreTarifa`, `Activa`, `FechaInicio`, `FechaFin`, `Observaciones`)
VALUES (0, 'General', 1, CURDATE(), NULL, 'Tarifa por defecto. Precios iniciales copiados desde PVL de Artículos.')
ON DUPLICATE KEY UPDATE
  `NombreTarifa` = VALUES(`NombreTarifa`);

-- 4) Poblar precios "General" con el PVL actual de cada artículo
-- Si ya existe un precio para el artículo en General, lo actualiza.
SET @__sql_insert_general_precios := CONCAT(
  'INSERT INTO `tarifasClientes_precios` (`Id_Tarifa`, `Id_Articulo`, `Precio`) ',
  'SELECT 0, a.`', @__articulos_pk, '`, COALESCE(a.`PVL`, 0.00) ',
  'FROM `articulos` a ',
  'ON DUPLICATE KEY UPDATE `Precio` = VALUES(`Precio`);'
);
PREPARE stmt FROM @__sql_insert_general_precios; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5) Preparar y migrar clientes.Tarifa a INT (FK a tarifasClientes.Id)
-- IMPORTANTE:
-- En esta BD existe el campo legacy `clientes.Tarifa` como varchar y puede contener texto (ej. "FACE").
-- Antes de convertir a INT:
-- - Creamos tarifas automáticamente para esos nombres legacy (excepto "General")
-- - Asignamos el ID creado a los clientes que tenían el nombre
-- - Lo que no se pueda mapear, se fuerza a 0 (General)

-- 5.1) Normalizar vacíos y "General" (cualquier casing) a 0
UPDATE `clientes`
SET `Tarifa` = '0'
WHERE `Tarifa` IS NULL
   OR TRIM(`Tarifa`) = ''
   OR LOWER(TRIM(`Tarifa`)) = 'general';

-- 5.2) Crear tarifas desde valores legacy (texto) que existan en clientes.Tarifa
INSERT IGNORE INTO `tarifasClientes` (`NombreTarifa`, `Activa`, `FechaInicio`, `FechaFin`, `Observaciones`)
SELECT DISTINCT
  TRIM(c.`Tarifa`) AS NombreTarifa,
  1 AS Activa,
  CURDATE() AS FechaInicio,
  NULL AS FechaFin,
  'Tarifa creada automáticamente desde valores legacy en clientes.Tarifa' AS Observaciones
FROM `clientes` c
WHERE c.`Tarifa` IS NOT NULL
  AND TRIM(c.`Tarifa`) <> ''
  AND LOWER(TRIM(c.`Tarifa`)) <> 'general'
  AND TRIM(c.`Tarifa`) NOT REGEXP '^[0-9]+$';

-- 5.3) Reasignar clientes: nombre legacy -> Id de tarifasClientes
UPDATE `clientes` c
JOIN `tarifasClientes` t
  ON t.`NombreTarifa` = (CONVERT(TRIM(c.`Tarifa`) USING utf8mb4) COLLATE utf8mb4_unicode_ci)
SET c.`Tarifa` = t.`Id`
WHERE c.`Tarifa` IS NOT NULL
  AND TRIM(c.`Tarifa`) <> ''
  AND TRIM(c.`Tarifa`) NOT REGEXP '^[0-9]+$';

-- 5.4) Asegurar que no queda nada no-numérico
UPDATE `clientes`
SET `Tarifa` = '0'
WHERE `Tarifa` IS NULL
   OR TRIM(`Tarifa`) = ''
   OR TRIM(`Tarifa`) NOT REGEXP '^[0-9]+$';

-- Convertir tipo de columna (si ya es numérica, esta operación puede fallar según engine/constraints.
-- Para hacerlo idempotente, usamos SQL dinámico según el tipo actual.)
SET @__tarifa_col_type := (
  SELECT DATA_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'clientes'
    AND COLUMN_NAME = 'Tarifa'
  LIMIT 1
);

SET @__sql_modify_tarifa := IF(
  @__tarifa_col_type IN ('int','bigint','smallint','mediumint','tinyint'),
  'SELECT "INFO: clientes.Tarifa ya es numérico" AS info;',
  'ALTER TABLE `clientes` MODIFY COLUMN `Tarifa` INT NOT NULL DEFAULT 0;'
);
PREPARE stmt FROM @__sql_modify_tarifa; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Añadir índice si no existe
SET @__tarifa_has_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'clientes'
    AND COLUMN_NAME = 'Tarifa'
);
SET @__sql_add_index := IF(
  @__tarifa_has_index > 0,
  'SELECT "INFO: Índice clientes.Tarifa ya existe" AS info;',
  'ALTER TABLE `clientes` ADD INDEX `idx_clientes_tarifa` (`Tarifa`);'
);
PREPARE stmt FROM @__sql_add_index; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Añadir FK si no existe
SET @__fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'clientes'
    AND COLUMN_NAME = 'Tarifa'
    AND REFERENCED_TABLE_NAME = 'tarifasClientes'
);
SET @__sql_add_fk := IF(
  @__fk_exists > 0,
  'SELECT "INFO: FK clientes.Tarifa -> tarifasClientes.Id ya existe" AS info;',
  'ALTER TABLE `clientes` ADD CONSTRAINT `fk_clientes_tarifa` FOREIGN KEY (`Tarifa`) REFERENCES `tarifasClientes`(`Id`) ON UPDATE CASCADE ON DELETE RESTRICT;'
);
PREPARE stmt FROM @__sql_add_fk; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Restaurar sql_mode original
SET SESSION sql_mode = @__old_sql_mode;

