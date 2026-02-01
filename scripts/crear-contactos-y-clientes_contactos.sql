-- ============================================================
-- CRM Farmadescanso - Contactos (personas) + relación M:N con clientes (historial)
-- Objetivo:
-- 1) Crear tabla `contactos` (persona global, no dependiente de cliente)
-- 2) Crear tabla puente `clientes_contactos` (relación M:N con vigencia/histórico)
-- 3) Impedir duplicados de contactos por MÓVIL (sin bloquear emails genéricos tipo info@...)
-- 4) Impedir duplicado ACTIVO de la relación (cliente, contacto)
-- 5) Impedir más de 1 contacto PRINCIPAL activo por cliente
--
-- Notas:
-- - Este script está pensado para MySQL 8+ (usa columnas generadas STORED).
-- - FK a `clientes.Id` (confirmado).
-- - ON DELETE RESTRICT para conservar historial (no borrar físicamente clientes/contactos).
-- ============================================================

-- 1) Tabla contactos (persona global)
CREATE TABLE IF NOT EXISTS `contactos` (
  `Id` INT NOT NULL AUTO_INCREMENT,

  `Nombre` VARCHAR(120) NOT NULL,
  `Apellidos` VARCHAR(180) NULL,
  `Cargo` VARCHAR(120) NULL,
  `Especialidad` VARCHAR(120) NULL,
  `Empresa` VARCHAR(180) NULL,

  `Email` VARCHAR(255) NULL,
  `Movil` VARCHAR(20) NULL,
  `Telefono` VARCHAR(20) NULL,
  `Extension` VARCHAR(10) NULL,

  `Notas` TEXT NULL,
  `Activo` TINYINT(1) NOT NULL DEFAULT 1,

  `CreadoEn` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ActualizadoEn` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  -- Normalización para deduplicación por móvil:
  -- - eliminamos separadores comunes
  -- - convertimos vacío => NULL para que UNIQUE permita múltiples "vacíos"
  `MovilNorm` VARCHAR(20) GENERATED ALWAYS AS (
    NULLIF(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        TRIM(`Movil`),
      ' ', ''), '-', ''), '.', ''), '(', ''), ')', ''), '+', ''), '/', ''), '\\', ''), '\t', ''),
      ''
    )
  ) STORED,

  PRIMARY KEY (`Id`),

  -- Dedupe: permitir emails genéricos repetidos, pero impedir mismo móvil repetido
  UNIQUE KEY `ux_contactos_movilnorm` (`MovilNorm`),

  KEY `idx_contactos_email` (`Email`),
  KEY `idx_contactos_empresa` (`Empresa`),
  KEY `idx_contactos_nombre` (`Apellidos`, `Nombre`),
  FULLTEXT KEY `ft_contactos_busqueda` (`Nombre`, `Apellidos`, `Empresa`, `Email`, `Movil`, `Telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2) Tabla puente con histórico
CREATE TABLE IF NOT EXISTS `clientes_contactos` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,

  `Id_Cliente` INT NOT NULL,
  `Id_Contacto` INT NOT NULL,

  `Rol` VARCHAR(80) NULL,
  `Es_Principal` TINYINT(1) NOT NULL DEFAULT 0,
  `Notas` TEXT NULL,

  `VigenteDesde` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `VigenteHasta` DATETIME NULL,
  `MotivoBaja` VARCHAR(200) NULL,

  `CreadoEn` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ActualizadoEn` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  -- Claves generadas para constraints “parciales”:
  -- - ActivoKey: solo 1 relación ACTIVA por (cliente, contacto)
  -- - PrincipalKey: solo 1 PRINCIPAL ACTIVO por cliente
  `ActivoKey` TINYINT GENERATED ALWAYS AS (IF(`VigenteHasta` IS NULL, 1, NULL)) STORED,
  `PrincipalKey` TINYINT GENERATED ALWAYS AS (IF(`VigenteHasta` IS NULL AND `Es_Principal` = 1, 1, NULL)) STORED,

  PRIMARY KEY (`Id`),

  UNIQUE KEY `ux_cli_contactos_activo_unico` (`Id_Cliente`, `Id_Contacto`, `ActivoKey`),
  UNIQUE KEY `ux_cli_contactos_principal_unico` (`Id_Cliente`, `PrincipalKey`),

  KEY `idx_cli_contactos_cliente` (`Id_Cliente`),
  KEY `idx_cli_contactos_contacto` (`Id_Contacto`),
  KEY `idx_cli_contactos_cliente_activos` (`Id_Cliente`, `VigenteHasta`),

  CONSTRAINT `fk_clientes_contactos_cliente`
    -- Nota: en este proyecto la PK de clientes suele ser `id` (minúscula).
    FOREIGN KEY (`Id_Cliente`) REFERENCES `clientes` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT `fk_clientes_contactos_contacto`
    FOREIGN KEY (`Id_Contacto`) REFERENCES `contactos` (`Id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

