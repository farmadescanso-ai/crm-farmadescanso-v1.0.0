-- ============================================================
-- CRM Farmadescanso - Aplicación en Producción (IDEMPOTENTE)
-- Ejecuta esto en phpMyAdmin (producción) EN UNA SOLA VEZ:
-- 1) Crea tabla direccionesEnvio (si no existe)
-- 2) Asegura columna/índice/FK en pedidos (si faltan)
-- ============================================================

-- 1) Crear tabla direccionesEnvio (si no existe)
CREATE TABLE IF NOT EXISTS `direccionesEnvio` (
  `id` INT NOT NULL AUTO_INCREMENT,

  `Id_Cliente` INT NOT NULL,
  `Id_Contacto` INT NULL,

  `Alias` VARCHAR(120) NULL,
  `Nombre_Destinatario` VARCHAR(255) NULL,

  `Direccion` VARCHAR(255) NULL,
  `Direccion2` VARCHAR(255) NULL,
  `Poblacion` VARCHAR(255) NULL,
  `CodigoPostal` VARCHAR(12) NULL,

  `Id_Provincia` INT NULL,
  `Id_CodigoPostal` INT NULL,
  `Id_Pais` INT NULL,
  `Pais` VARCHAR(255) NULL,

  `Telefono` VARCHAR(20) NULL,
  `Email` VARCHAR(255) NULL,

  `Observaciones` TEXT NULL,

  `Es_Principal` TINYINT(1) NOT NULL DEFAULT 0,
  `Activa` TINYINT(1) NOT NULL DEFAULT 1,

  `CreadoEn` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ActualizadoEn` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  `PrincipalKey` TINYINT GENERATED ALWAYS AS (IF(`Activa` = 1 AND `Es_Principal` = 1, 1, NULL)) STORED,

  PRIMARY KEY (`id`),

  UNIQUE KEY `ux_direcciones_envio_principal_unica` (`Id_Cliente`, `PrincipalKey`),
  KEY `idx_direcciones_envio_cliente` (`Id_Cliente`),
  KEY `idx_direcciones_envio_contacto` (`Id_Contacto`),
  KEY `idx_direcciones_envio_cp` (`CodigoPostal`),
  KEY `idx_direcciones_envio_provincia` (`Id_Provincia`),
  KEY `idx_direcciones_envio_pais` (`Id_Pais`),
  KEY `idx_direcciones_envio_activa` (`Id_Cliente`, `Activa`),

  CONSTRAINT `fk_direcciones_envio_cliente`
    FOREIGN KEY (`Id_Cliente`) REFERENCES `clientes` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT `fk_direcciones_envio_contacto`
    FOREIGN KEY (`Id_Contacto`) REFERENCES `contactos` (`Id`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT `fk_direcciones_envio_provincia`
    FOREIGN KEY (`Id_Provincia`) REFERENCES `provincias` (`id`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT `fk_direcciones_envio_codigo_postal`
    FOREIGN KEY (`Id_CodigoPostal`) REFERENCES `codigos_postales` (`id`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT `fk_direcciones_envio_pais`
    FOREIGN KEY (`Id_Pais`) REFERENCES `paises` (`id`)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Asegurar columna/índice/FK en pedidos (idempotente)
SET @db := DATABASE();

SET @t_pedidos := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='pedidos'
  ORDER BY (table_name='pedidos') DESC, table_name ASC
  LIMIT 1
);

SET @t_dir := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)=LOWER('direccionesEnvio')
  ORDER BY (table_name='direccionesEnvio') DESC, table_name ASC
  LIMIT 1
);

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name=@t_pedidos AND column_name='Id_DireccionEnvio'
);
SET @sql := (SELECT IF(@t_pedidos IS NOT NULL AND @has_col=0,
  CONCAT('ALTER TABLE `', @t_pedidos, '` ADD COLUMN `Id_DireccionEnvio` INT NULL AFTER `Id_Cliente`'),
  'SELECT 1'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema=@db AND table_name=@t_pedidos AND index_name='idx_pedidos_id_direccion_envio'
);
SET @sql := (SELECT IF(@t_pedidos IS NOT NULL AND @has_idx=0,
  CONCAT('ALTER TABLE `', @t_pedidos, '` ADD KEY `idx_pedidos_id_direccion_envio` (`Id_DireccionEnvio`)'),
  'SELECT 1'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_fk := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema=@db AND table_name=@t_pedidos
    AND constraint_name='fk_pedidos_direccion_envio'
    AND constraint_type='FOREIGN KEY'
);
SET @sql := (SELECT IF(@t_pedidos IS NOT NULL AND @t_dir IS NOT NULL AND @has_fk=0,
  CONCAT(
    'ALTER TABLE `', @t_pedidos, '` ',
    'ADD CONSTRAINT `fk_pedidos_direccion_envio` FOREIGN KEY (`Id_DireccionEnvio`) ',
    'REFERENCES `', @t_dir, '` (`id`) ',
    'ON UPDATE CASCADE ON DELETE SET NULL'
  ),
  'SELECT 1'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

