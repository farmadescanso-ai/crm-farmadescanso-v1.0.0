-- =====================================================
-- SISTEMA DE CÓDIGOS POSTALES Y ASIGNACIÓN DE COMERCIALES
-- =====================================================
-- Este script crea las tablas necesarias para gestionar
-- los códigos postales de España y asignar comerciales
-- a códigos postales por marca
-- Fecha: 2026-01-XX
-- =====================================================

-- IMPORTANTE:
-- - Ejecuta este script en la base de datos correcta (p.ej. `crm_farmadescanso`).
-- - En algunos servidores los nombres de tablas son case-sensitive y/o están en minúsculas.
--   Este script resuelve automáticamente los nombres reales desde INFORMATION_SCHEMA.

-- =====================================================
-- 0) RESOLVER NOMBRES REALES DE TABLAS (case-insensitive)
-- =====================================================
SET @db := DATABASE();

SET @t_clientes := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name) = 'clientes' LIMIT 1
);
SET @t_comerciales := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name) = 'comerciales' LIMIT 1
);
SET @t_marcas := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name) = 'marcas' LIMIT 1
);
SET @t_provincias := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name) = 'provincias' LIMIT 1
);
SET @t_cp := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name) = 'codigos_postales' LIMIT 1
);
SET @t_asig := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name) = 'comerciales_codigos_postales_marcas' LIMIT 1
);

-- =====================================================
-- 1. TABLA DE CÓDIGOS POSTALES
-- =====================================================
-- Almacena todos los códigos postales de España
SET @sql_create_cp := (
  SELECT IF(
    @t_cp IS NULL,
    'CREATE TABLE IF NOT EXISTS `codigos_postales` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `CodigoPostal` VARCHAR(5) NOT NULL COMMENT ''Código postal (5 dígitos)'',
      `Localidad` VARCHAR(255) NOT NULL COMMENT ''Nombre de la localidad/municipio'',
      `Provincia` VARCHAR(100) NOT NULL COMMENT ''Nombre de la provincia'',
      `Id_Provincia` INT NULL COMMENT ''ID de la provincia (relación con tabla provincias)'',
      `ComunidadAutonoma` VARCHAR(100) NULL COMMENT ''Nombre de la comunidad autónoma'',
      `Latitud` DECIMAL(10, 8) NULL COMMENT ''Coordenada geográfica latitud'',
      `Longitud` DECIMAL(11, 8) NULL COMMENT ''Coordenada geográfica longitud'',
      `Activo` TINYINT(1) DEFAULT 1 COMMENT ''Si el código postal está activo'',
      `CreadoEn` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      `ActualizadoEn` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY `uk_codigo_postal` (`CodigoPostal`, `Localidad`, `Provincia`),
      INDEX `idx_codigo_postal` (`CodigoPostal`),
      INDEX `idx_localidad` (`Localidad`),
      INDEX `idx_provincia` (`Provincia`),
      INDEX `idx_id_provincia` (`Id_Provincia`),
      INDEX `idx_activo` (`Activo`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT=''Códigos postales de España'';',
    'SELECT 1;'
  )
);
PREPARE stmt_cp FROM @sql_create_cp;
EXECUTE stmt_cp;
DEALLOCATE PREPARE stmt_cp;

-- Refrescar nombre real creado (si se creó ahora)
SET @t_cp := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name) = 'codigos_postales' LIMIT 1
);

-- =====================================================
-- 2. TABLA DE ASIGNACIÓN COMERCIALES - CÓDIGOS POSTALES - MARCAS
-- =====================================================
-- Relación muchos a muchos: permite asignar un comercial
-- a un código postal para una marca específica
SET @sql_create_asig := (
  SELECT IF(
    @t_asig IS NULL,
    'CREATE TABLE IF NOT EXISTS `comerciales_codigos_postales_marcas` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `Id_Comercial` INT NOT NULL COMMENT ''ID del comercial'',
      `Id_CodigoPostal` INT NOT NULL COMMENT ''ID del código postal'',
      `Id_Marca` INT NOT NULL COMMENT ''ID de la marca'',
      `FechaInicio` DATE NULL COMMENT ''Fecha de inicio de la asignación'',
      `FechaFin` DATE NULL COMMENT ''Fecha de fin de la asignación (NULL = sin fecha de fin)'',
      `Activo` TINYINT(1) DEFAULT 1 COMMENT ''Si la asignación está activa'',
      `Prioridad` INT DEFAULT 0 COMMENT ''Prioridad de la asignación (mayor número = mayor prioridad)'',
      `Observaciones` TEXT NULL COMMENT ''Observaciones sobre la asignación'',
      `CreadoPor` INT NULL COMMENT ''ID del usuario que creó la asignación'',
      `CreadoEn` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      `ActualizadoEn` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY `uk_comercial_codigo_marca` (`Id_Comercial`, `Id_CodigoPostal`, `Id_Marca`, `FechaInicio`),
      INDEX `idx_comercial` (`Id_Comercial`),
      INDEX `idx_codigo_postal` (`Id_CodigoPostal`),
      INDEX `idx_marca` (`Id_Marca`),
      INDEX `idx_activo` (`Activo`),
      INDEX `idx_fechas` (`FechaInicio`, `FechaFin`),
      INDEX `idx_prioridad` (`Prioridad`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT=''Asignación de comerciales a códigos postales por marca'';',
    'SELECT 1;'
  )
);
PREPARE stmt_asig FROM @sql_create_asig;
EXECUTE stmt_asig;
DEALLOCATE PREPARE stmt_asig;

SET @t_asig := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name) = 'comerciales_codigos_postales_marcas' LIMIT 1
);

-- =====================================================
-- 3. MODIFICAR TABLA CLIENTES
-- =====================================================
-- Añadir relación con la tabla de códigos postales
-- Mantener el campo CodigoPostal como varchar para compatibilidad
-- pero añadir Id_CodigoPostal como clave foránea

-- Añadir columna Id_CodigoPostal si no existe
-- Nota: MySQL no soporta IF NOT EXISTS en ALTER TABLE, 
-- por lo que si la columna ya existe, el comando fallará (es normal)
SET @dbname = DATABASE();
SET @tablename = @t_clientes;
SET @columnname = 'Id_CodigoPostal';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  IF(@tablename IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN ', @columnname, ' INT NULL COMMENT ''ID del código postal (relación con codigos_postales)'' AFTER `CodigoPostal`'))
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Crear índice para la nueva columna (si no existe)
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = 'idx_clientes_id_codigo_postal')
  ) > 0,
  'SELECT 1',
  IF(@tablename IS NULL, 'SELECT 1', CONCAT('CREATE INDEX idx_clientes_id_codigo_postal ON `', @tablename, '` (', @columnname, ')'))
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- FKs omitidas a propósito (compatibilidad con case/nombres de tablas distintos).

-- =====================================================
-- 4. MODIFICAR TABLA COMERCIALES
-- =====================================================
-- Añadir relación con la tabla de códigos postales
-- Mantener el campo CodigoPostal como varchar para compatibilidad
-- pero añadir Id_CodigoPostal como clave foránea

-- Añadir columna Id_CodigoPostal si no existe
SET @dbname = DATABASE();
SET @tablename = @t_comerciales;
SET @columnname = 'Id_CodigoPostal';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  IF(@tablename IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN ', @columnname, ' INT NULL COMMENT ''ID del código postal (relación con codigos_postales)'' AFTER `CodigoPostal`'))
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Crear índice para la nueva columna (si no existe)
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = 'idx_comerciales_id_codigo_postal')
  ) > 0,
  'SELECT 1',
  IF(@tablename IS NULL, 'SELECT 1', CONCAT('CREATE INDEX idx_comerciales_id_codigo_postal ON `', @tablename, '` (', @columnname, ')'))
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- FKs omitidas a propósito (compatibilidad con case/nombres de tablas distintos).

-- =====================================================
-- 5. REVISAR Y MEJORAR RELACIONES CON COMISIONES
-- =====================================================
-- La tabla Comisiones ya tiene relación con Comerciales
-- Podemos añadir un índice compuesto para mejorar consultas
-- que filtren por comercial y código postal del cliente

-- Añadir índice compuesto en Comisiones si no existe
-- (Esto ayudará en consultas que relacionen comisiones con códigos postales)
SET @dbname = DATABASE();
SET @tablename = 'comisiones';
SET @indexname = 'idx_comisiones_comercial_mes_año_estado';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, ' (comercial_id, mes, año, estado)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- =====================================================
-- 6. TABLA DE PEDIDOS
-- =====================================================
-- Los pedidos ya tienen relación con Clientes (que ahora tiene Id_CodigoPostal)
-- No es necesario modificar directamente, pero podemos añadir un índice
-- para mejorar consultas que filtren por código postal

-- Añadir índice en Pedidos para mejorar consultas por cliente
SET @tablename = 'Pedidos';
SET @indexname = 'idx_pedidos_cliente_fecha';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, ' (Id_Cliente, FechaPedido)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- =====================================================
-- 7. TABLA DE VISITAS
-- =====================================================
-- Las visitas tienen relación con Clientes (que ahora tiene Id_CodigoPostal)
-- Podemos añadir un índice para mejorar consultas

-- Añadir índice en Visitas para mejorar consultas por cliente
SET @tablename = 'Visitas';
SET @indexname = 'idx_visitas_cliente_fecha';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, ' (Id_Cliente, Fecha)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- =====================================================
-- 8. FUNCIÓN AUXILIAR: OBTENER COMERCIAL POR CÓDIGO POSTAL Y MARCA
-- =====================================================
-- Esta función/vista puede ser útil para consultas rápidas
-- Crear una vista para facilitar consultas

CREATE OR REPLACE VIEW `v_comerciales_por_codigo_postal_marca` AS
SELECT 
    ccp.Id_CodigoPostal,
    cp.CodigoPostal,
    cp.Localidad,
    cp.Provincia,
    ccp.Id_Marca,
    m.Nombre AS NombreMarca,
    ccp.Id_Comercial,
    c.Nombre AS NombreComercial,
    c.Email AS EmailComercial,
    ccp.FechaInicio,
    ccp.FechaFin,
    ccp.Activo,
    ccp.Prioridad
FROM `Comerciales_Codigos_Postales_Marcas` ccp
INNER JOIN `Codigos_Postales` cp ON ccp.Id_CodigoPostal = cp.id
INNER JOIN `Marcas` m ON ccp.Id_Marca = m.id
INNER JOIN `Comerciales` c ON ccp.Id_Comercial = c.id
WHERE ccp.Activo = 1
  AND cp.Activo = 1
  AND (ccp.FechaFin IS NULL OR ccp.FechaFin >= CURDATE())
  AND (ccp.FechaInicio IS NULL OR ccp.FechaInicio <= CURDATE())
ORDER BY ccp.Prioridad DESC, ccp.Id_CodigoPostal, ccp.Id_Marca;

-- =====================================================
-- 9. FUNCIÓN AUXILIAR: OBTENER COMERCIAL DE UN CLIENTE POR MARCA
-- =====================================================
-- Vista para obtener el comercial asignado a un cliente según su código postal y marca

CREATE OR REPLACE VIEW `v_comercial_cliente_marca` AS
SELECT 
    cl.id AS Id_Cliente,
    cl.Nombre_Razon_Social,
    cl.CodigoPostal AS CodigoPostalCliente,
    cl.Id_CodigoPostal,
    cp.CodigoPostal,
    cp.Localidad,
    cp.Provincia,
    m.id AS Id_Marca,
    m.Nombre AS NombreMarca,
    c.id AS Id_Comercial,
    c.Nombre AS NombreComercial,
    c.Email AS EmailComercial,
    ccp.FechaInicio,
    ccp.FechaFin,
    ccp.Prioridad
FROM `Clientes` cl
LEFT JOIN `Codigos_Postales` cp ON cl.Id_CodigoPostal = cp.id
LEFT JOIN `Comerciales_Codigos_Postales_Marcas` ccp ON cp.id = ccp.Id_CodigoPostal
LEFT JOIN `Marcas` m ON ccp.Id_Marca = m.id
LEFT JOIN `Comerciales` c ON ccp.Id_Comercial = c.id
WHERE ccp.Activo = 1
  AND (ccp.FechaFin IS NULL OR ccp.FechaFin >= CURDATE())
  AND (ccp.FechaInicio IS NULL OR ccp.FechaInicio <= CURDATE())
ORDER BY ccp.Prioridad DESC;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
