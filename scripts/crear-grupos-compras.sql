-- ============================================================
-- CRM Farmadescanso - Crear tabla `gruposCompras` (idempotente)
-- Objetivo:
-- - Crear entidad "Grupos de compra" (centrales / grupos)
-- - Preparado para entornos con case-sensitive table names
-- ============================================================

SET @db := DATABASE();
SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name) = LOWER('gruposCompras')
);

SET @sql := (
  SELECT IF(@exists = 0,
    'CREATE TABLE `gruposCompras` (
      `id` INT NOT NULL AUTO_INCREMENT,
      `Nombre` VARCHAR(255) NOT NULL,
      `CIF` VARCHAR(20) NULL,
      `Email` VARCHAR(255) NULL,
      `Telefono` VARCHAR(20) NULL,
      `Contacto` VARCHAR(255) NULL,
      `Direccion` VARCHAR(255) NULL,
      `Poblacion` VARCHAR(255) NULL,
      `CodigoPostal` VARCHAR(12) NULL,
      `Provincia` VARCHAR(255) NULL,
      `Pais` VARCHAR(255) NULL,
      `Observaciones` TEXT NULL,
      `Activo` TINYINT(1) NOT NULL DEFAULT 1,
      `CreadoEn` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `ActualizadoEn` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `ux_gruposCompras_nombre` (`Nombre`),
      UNIQUE KEY `ux_gruposCompras_cif` (`CIF`),
      KEY `idx_gruposCompras_activo` (`Activo`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    'SELECT 1'
  )
);

PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

