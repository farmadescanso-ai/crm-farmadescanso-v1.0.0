-- ============================================
-- Histórico de Tarifa PVL 2025
-- Copia los precios actuales de la Tarifa PVL (Id=0) a una tarifa cerrada:
--   "PVL 2025" (01/01/2025 - 31/12/2025)
--
-- Objetivo:
-- - Evitar que cambios futuros de precios afecten a cálculos/consultas del año 2025
-- ============================================

-- 1) Crear (si no existe) la tarifa histórica
INSERT IGNORE INTO `tarifasClientes` (`NombreTarifa`, `Activa`, `FechaInicio`, `FechaFin`, `Observaciones`)
VALUES (
  'PVL 2025',
  0,
  '2025-01-01',
  '2025-12-31',
  'Histórico: copia de la tarifa PVL (Id=0) para preservar precios del año 2025'
);

-- 2) Obtener el Id de "PVL 2025"
SET @__id_general_2025 := (
  SELECT `Id`
  FROM `tarifasClientes`
  WHERE `NombreTarifa` = 'PVL 2025'
  LIMIT 1
);

-- 3) Copiar precios desde PVL (0) hacia PVL 2025
-- Si ya existían, los actualiza (para permitir re-ejecución controlada).
INSERT INTO `tarifasClientes_precios` (`Id_Tarifa`, `Id_Articulo`, `Precio`)
SELECT @__id_general_2025, p.`Id_Articulo`, p.`Precio`
FROM `tarifasClientes_precios` p
WHERE p.`Id_Tarifa` = 0
ON DUPLICATE KEY UPDATE
  `Precio` = VALUES(`Precio`);

-- 4) Asegurar metadatos correctos (por si existía)
UPDATE `tarifasClientes`
SET
  `Activa` = 0,
  `FechaInicio` = '2025-01-01',
  `FechaFin` = '2025-12-31'
WHERE `Id` = @__id_general_2025;

