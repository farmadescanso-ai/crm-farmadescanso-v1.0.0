-- ============================================================
-- CRM Farmadescanso - Crear tabla `clientes_gruposCompras` (idempotente)
-- Objetivo:
-- - Relacionar clientes (farmacias) con su grupo de compras
-- - Permitir histórico manteniendo solo 1 relación ACTIVA por cliente
-- ============================================================

SET @db := DATABASE();

-- Asegurar que existe la tabla de gruposCompras
SET @exists_grupos := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name) = LOWER('gruposCompras')
);

SET @sql := (
  SELECT IF(@exists_grupos = 0,
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

-- Crear tabla relación si no existe
SET @exists_rel := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name) = LOWER('clientes_gruposCompras')
);

SET @sql := (
  SELECT IF(@exists_rel = 0,
    'CREATE TABLE `clientes_gruposCompras` (
      `id` INT NOT NULL AUTO_INCREMENT,
      `Id_Cliente` INT NOT NULL,
      `Id_GrupoCompras` INT NOT NULL,
      `NumSocio` VARCHAR(50) NULL,
      `Observaciones` TEXT NULL,
      `Activa` TINYINT(1) NOT NULL DEFAULT 1,
      `Fecha_Alta` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `Fecha_Baja` DATETIME NULL DEFAULT NULL,
      `CreadoEn` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `ActualizadoEn` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      `ActiveKey` TINYINT GENERATED ALWAYS AS (IF(`Activa` = 1, 1, NULL)) STORED,
      PRIMARY KEY (`id`),
      UNIQUE KEY `ux_clientes_gruposCompras_unica_activa` (`Id_Cliente`, `ActiveKey`),
      KEY `idx_clientes_gruposCompras_cliente` (`Id_Cliente`),
      KEY `idx_clientes_gruposCompras_grupo` (`Id_GrupoCompras`),
      KEY `idx_clientes_gruposCompras_activa` (`Activa`),
      CONSTRAINT `fk_clientes_gruposCompras_cliente`
        FOREIGN KEY (`Id_Cliente`) REFERENCES `clientes` (`id`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      CONSTRAINT `fk_clientes_gruposCompras_grupo`
        FOREIGN KEY (`Id_GrupoCompras`) REFERENCES `gruposCompras` (`id`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    'SELECT 1'
  )
);

PREPARE s2 FROM @sql; EXECUTE s2; DEALLOCATE PREPARE s2;

