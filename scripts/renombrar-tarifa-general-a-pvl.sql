-- ============================================
-- Renombrar tarifa "General" -> "PVL"
-- Mantiene integridad: Id=0 sigue siendo la tarifa base.
-- También renombra "General 2025" -> "PVL 2025" para consistencia.
--
-- Recomendación: ejecutar en crm_farmadescanso con backup previo.
-- ============================================

START TRANSACTION;

-- Evitar colisión si ya existe una tarifa llamada "PVL" con Id distinto de 0
SET @__pvl_exists_other := (
  SELECT COUNT(*)
  FROM tarifasClientes
  WHERE NombreTarifa = 'PVL'
    AND Id <> 0
);

-- Si hay conflicto, abortar
SET @__abort := IF(@__pvl_exists_other > 0, 1, 0);

-- MySQL SIGNAL (si está permitido en tu versión)
SET @__msg := CONCAT('Existe ya una tarifa llamada PVL con Id distinto de 0 (conflicto). Renombra/elimina esa tarifa antes. Count=', @__pvl_exists_other);
SET @__sql_signal := IF(@__abort = 1, CONCAT("SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '", REPLACE(@__msg, "'", "''"), "';"), 'SELECT "OK" AS info;');
PREPARE stmt FROM @__sql_signal; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Renombrar la base (Id=0) y cualquier nombre legacy "General"
UPDATE tarifasClientes
SET NombreTarifa = 'PVL'
WHERE Id = 0
   OR NombreTarifa = 'General';

-- Renombrar histórico 2025 si existe
UPDATE tarifasClientes
SET NombreTarifa = 'PVL 2025'
WHERE NombreTarifa = 'General 2025';

COMMIT;

