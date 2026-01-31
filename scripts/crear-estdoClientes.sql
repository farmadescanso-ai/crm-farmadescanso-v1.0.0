-- ============================================================
-- CRM Farmadescanso - Estados de Cliente (estdoClientes)
-- Objetivo:
-- 1) Crear tabla catálogo `estdoClientes`
-- 2) Añadir FK en `clientes` -> `Id_EstdoCliente`
-- 3) Migrar datos:
--    - Inactivo si OK_KO es KO/0
--    - Si NO está inactivo:
--        * DNI/CIF inválido => Potencial
--        * DNI/CIF válido   => Activo
-- ============================================================

-- 1) Catálogo de estados
CREATE TABLE IF NOT EXISTS `estdoClientes` (
  `id` INT NOT NULL,
  `Nombre` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_estdoClientes_nombre` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `estdoClientes` (`id`, `Nombre`) VALUES
  (1, 'Potencial'),
  (2, 'Activo'),
  (3, 'Inactivo');

-- 2) Añadir columna + índice + FK en clientes
-- Nota: si ya existe la columna, MySQL fallará. En ese caso, omite este bloque.
ALTER TABLE `clientes`
  ADD COLUMN `Id_EstdoCliente` INT NULL,
  ADD INDEX `idx_clientes_Id_EstdoCliente` (`Id_EstdoCliente`),
  ADD CONSTRAINT `fk_clientes_estdoClientes`
    FOREIGN KEY (`Id_EstdoCliente`) REFERENCES `estdoClientes` (`id`);

-- 3) Normalización básica de DNI/CIF en SQL (upper + quitar espacios/guiones)
--    Validaciones:
--    - DNI: 8 dígitos + letra
--    - NIE: X/Y/Z + 7 dígitos + letra
--    - CIF: letra + 7 dígitos + [0-9A-J]
SET @dni_pat = '^[0-9]{8}[A-Z]$';
SET @nie_pat = '^[XYZ][0-9]{7}[A-Z]$';
SET @cif_pat = '^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$';

-- 3.1) Inactivos (OK_KO=0 o KO) -> Inactivo (3)
UPDATE `clientes`
SET `Id_EstdoCliente` = 3
WHERE
  (`OK_KO` = 0 OR `OK_KO` = '0' OR UPPER(TRIM(COALESCE(`OK_KO`, ''))) = 'KO');

-- 3.2) No inactivos: Potencial vs Activo según DNI/CIF válido
UPDATE `clientes`
SET `Id_EstdoCliente` = CASE
  WHEN (
    -- Normalizar el valor
    -- (Pendiente, null, vacío, SIN_DNI_* -> inválido)
    COALESCE(TRIM(`DNI_CIF`), '') = ''
    OR UPPER(TRIM(`DNI_CIF`)) IN ('PENDIENTE', 'NULL', 'N/A', 'NA')
    OR UPPER(TRIM(`DNI_CIF`)) LIKE 'SIN_DNI%'
    OR NOT (
      REPLACE(REPLACE(UPPER(TRIM(`DNI_CIF`)), ' ', ''), '-', '') REGEXP @dni_pat
      OR REPLACE(REPLACE(UPPER(TRIM(`DNI_CIF`)), ' ', ''), '-', '') REGEXP @nie_pat
      OR REPLACE(REPLACE(UPPER(TRIM(`DNI_CIF`)), ' ', ''), '-', '') REGEXP @cif_pat
    )
  )
  THEN 1
  ELSE 2
END
WHERE COALESCE(`Id_EstdoCliente`, 0) <> 3;

-- 4) (Opcional) Hacer NOT NULL una vez migrado
-- ALTER TABLE `clientes`
--   MODIFY COLUMN `Id_EstdoCliente` INT NOT NULL DEFAULT 2;

-- ============================================================
-- IMPORTANTE:
-- - Este script crea la tabla y migra datos, pero NO puede ejecutarse
--   automáticamente desde Vercel si no lo aplicas en tu MySQL.
-- - Pásalo por phpMyAdmin/CLI en la BD correcta (crm_farmadescanso).
-- ============================================================

