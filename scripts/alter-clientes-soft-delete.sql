-- ============================================================
-- CRM Farmadescanso - Soft delete en `clientes` (conservar historial)
-- Objetivo:
-- - Evitar borrado físico de clientes
-- - Mantener FKs/histórico (p.ej. clientes_contactos con ON DELETE RESTRICT)
--
-- Campos:
-- - Activo: 1 = activo, 0 = dado de baja (soft delete)
-- - FechaBaja: fecha de baja
-- - MotivoBaja: texto libre
-- ============================================================

-- NOTA COMPATIBILIDAD:
-- `ADD COLUMN IF NOT EXISTS` NO existe en muchas versiones de MySQL/MariaDB.
-- Para que sea idempotente, usamos information_schema + SQL dinámico.
SET @db := DATABASE();
SET @t := 'clientes';

-- Columna: Activo
SET @col := 'Activo';
SET @has := (SELECT COUNT(*)
             FROM information_schema.columns
             WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @sql := (SELECT IF(@has=0,
  'ALTER TABLE `clientes` ADD COLUMN `Activo` TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT 1'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Columna: FechaBaja
SET @col := 'FechaBaja';
SET @has := (SELECT COUNT(*)
             FROM information_schema.columns
             WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @sql := (SELECT IF(@has=0,
  'ALTER TABLE `clientes` ADD COLUMN `FechaBaja` DATETIME NULL',
  'SELECT 1'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Columna: MotivoBaja
SET @col := 'MotivoBaja';
SET @has := (SELECT COUNT(*)
             FROM information_schema.columns
             WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @sql := (SELECT IF(@has=0,
  'ALTER TABLE `clientes` ADD COLUMN `MotivoBaja` VARCHAR(200) NULL',
  'SELECT 1'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Índices útiles para listados (idempotente)
SET @db := DATABASE();
SET @t := 'clientes';

SET @idx := 'idx_clientes_activo';
SET @has := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@has=0, 'CREATE INDEX idx_clientes_activo ON clientes (Activo)', 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := 'idx_clientes_fechabaja';
SET @has := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@has=0, 'CREATE INDEX idx_clientes_fechabaja ON clientes (FechaBaja)', 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

