-- ============================================================
-- CRM Farmadescanso - Direcciones de Envío
-- Objetivo:
-- - Tabla `direccionesEnvio`: múltiples direcciones por cliente
-- - Enlace opcional a `contactos` (persona de recepción)
-- - Campos habituales de envío + observaciones
-- - Soporte para “una principal activa” por cliente
-- ============================================================

CREATE TABLE IF NOT EXISTS `direccionesEnvio` (
  `id` INT NOT NULL AUTO_INCREMENT,

  `Id_Cliente` INT NOT NULL,
  `Id_Contacto` INT NULL,

  -- Etiqueta para que el usuario la identifique al seleccionar
  `Alias` VARCHAR(120) NULL,
  `Nombre_Destinatario` VARCHAR(255) NULL,

  -- Dirección
  `Direccion` VARCHAR(255) NULL,
  `Direccion2` VARCHAR(255) NULL,
  `Poblacion` VARCHAR(255) NULL,
  `CodigoPostal` VARCHAR(12) NULL,

  -- Relaciones opcionales a catálogos (si existen)
  `Id_Provincia` INT NULL,
  `Id_CodigoPostal` INT NULL,
  `Id_Pais` INT NULL,
  `Pais` VARCHAR(255) NULL,

  -- Contacto para la entrega
  `Telefono` VARCHAR(20) NULL,
  `Movil` VARCHAR(20) NULL,
  `Email` VARCHAR(255) NULL,

  `Observaciones` TEXT NULL,

  `Es_Principal` TINYINT(1) NOT NULL DEFAULT 0,
  `Activa` TINYINT(1) NOT NULL DEFAULT 1,

  `CreadoEn` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ActualizadoEn` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  -- Un único "principal" activo por cliente (unique parcial vía columna generada)
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

