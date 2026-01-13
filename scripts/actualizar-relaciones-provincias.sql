-- ============================================================================
-- Script para actualizar relaciones de provincias en otras tablas
-- ============================================================================

-- 1. Actualizar tabla Codigos_Postales para relacionar con provincias
-- Asegurar que existe la columna Id_Provincia
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'Codigos_Postales' 
                   AND COLUMN_NAME = 'Id_Provincia');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `Codigos_Postales` ADD COLUMN `Id_Provincia` INT(11) NULL COMMENT ''ID de la provincia (relación con tabla provincias)'' AFTER `Provincia`',
    'SELECT "Columna Id_Provincia ya existe en Codigos_Postales" as mensaje');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Añadir índice si no existe
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'Codigos_Postales' 
                   AND INDEX_NAME = 'idx_codigo_postal_provincia');
SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE `Codigos_Postales` ADD INDEX `idx_codigo_postal_provincia` (`Id_Provincia`)',
    'SELECT "Índice ya existe" as mensaje');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Actualizar Id_Provincia en Codigos_Postales basándose en los dos primeros dígitos del código postal
UPDATE `Codigos_Postales` cp
INNER JOIN `provincias` p ON SUBSTRING(cp.CodigoPostal, 1, 2) = p.Codigo
SET cp.Id_Provincia = p.id
WHERE cp.CodigoPais = 'ES' OR cp.CodigoPais IS NULL OR cp.CodigoPais = '';

-- Añadir foreign key si no existe
-- Nota: Puede fallar si ya existe, es normal
SET @exist := (SELECT COUNT(*) FROM information_schema.table_constraints 
               WHERE constraint_schema = DATABASE() 
               AND table_name = 'Codigos_Postales' 
               AND constraint_name = 'fk_codigos_postales_provincia');
SET @sqlstmt := IF(@exist = 0, 
    'ALTER TABLE `Codigos_Postales` ADD CONSTRAINT `fk_codigos_postales_provincia` FOREIGN KEY (`Id_Provincia`) REFERENCES `provincias` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "Foreign key ya existe" as mensaje');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Actualizar tabla Clientes para relacionar con provincias
-- Asegurar que existe la columna Id_Provincia
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'Clientes' 
                   AND COLUMN_NAME = 'Id_Provincia');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `Clientes` ADD COLUMN `Id_Provincia` INT(11) NULL COMMENT ''ID de la provincia (relación con tabla provincias)'' AFTER `Provincia`',
    'SELECT "Columna Id_Provincia ya existe en Clientes" as mensaje');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Añadir índice si no existe
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'Clientes' 
                   AND INDEX_NAME = 'idx_cliente_provincia');
SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE `Clientes` ADD INDEX `idx_cliente_provincia` (`Id_Provincia`)',
    'SELECT "Índice ya existe" as mensaje');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Actualizar Id_Provincia en Clientes basándose en el nombre de la provincia
UPDATE `Clientes` c
INNER JOIN `provincias` p ON c.Provincia = p.Nombre
SET c.Id_Provincia = p.id
WHERE c.Provincia IS NOT NULL AND c.Provincia != '';

-- Añadir foreign key si no existe
SET @exist := (SELECT COUNT(*) FROM information_schema.table_constraints 
               WHERE constraint_schema = DATABASE() 
               AND table_name = 'Clientes' 
               AND constraint_name = 'fk_clientes_provincia');
SET @sqlstmt := IF(@exist = 0, 
    'ALTER TABLE `Clientes` ADD CONSTRAINT `fk_clientes_provincia` FOREIGN KEY (`Id_Provincia`) REFERENCES `provincias` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "Foreign key ya existe" as mensaje');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Actualizar tabla Comerciales para relacionar con provincias (si aplica)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'Comerciales' 
                   AND COLUMN_NAME = 'Id_Provincia');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `Comerciales` ADD COLUMN `Id_Provincia` INT(11) NULL COMMENT ''ID de la provincia (relación con tabla provincias)'' AFTER `Provincia`',
    'SELECT "Columna Id_Provincia ya existe en Comerciales" as mensaje');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Añadir índice si no existe
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'Comerciales' 
                   AND INDEX_NAME = 'idx_comercial_provincia');
SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE `Comerciales` ADD INDEX `idx_comercial_provincia` (`Id_Provincia`)',
    'SELECT "Índice ya existe" as mensaje');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Actualizar Id_Provincia en Comerciales basándose en el nombre de la provincia
UPDATE `Comerciales` c
INNER JOIN `provincias` p ON c.Provincia = p.Nombre
SET c.Id_Provincia = p.id
WHERE c.Provincia IS NOT NULL AND c.Provincia != '';

-- Añadir foreign key si no existe
SET @exist := (SELECT COUNT(*) FROM information_schema.table_constraints 
               WHERE constraint_schema = DATABASE() 
               AND table_name = 'Comerciales' 
               AND constraint_name = 'fk_comerciales_provincia');
SET @sqlstmt := IF(@exist = 0, 
    'ALTER TABLE `Comerciales` ADD CONSTRAINT `fk_comerciales_provincia` FOREIGN KEY (`Id_Provincia`) REFERENCES `provincias` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "Foreign key ya existe" as mensaje');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Verificar relaciones
-- ============================================================================
SELECT 
    'Codigos_Postales' as Tabla,
    COUNT(*) as Total,
    COUNT(Id_Provincia) as ConProvincia,
    COUNT(*) - COUNT(Id_Provincia) as SinProvincia
FROM Codigos_Postales
UNION ALL
SELECT 
    'Clientes' as Tabla,
    COUNT(*) as Total,
    COUNT(Id_Provincia) as ConProvincia,
    COUNT(*) - COUNT(Id_Provincia) as SinProvincia
FROM Clientes
UNION ALL
SELECT 
    'Comerciales' as Tabla,
    COUNT(*) as Total,
    COUNT(Id_Provincia) as ConProvincia,
    COUNT(*) - COUNT(Id_Provincia) as SinProvincia
FROM Comerciales;
