-- ============================================================
-- CRM Farmadescanso — Activar/desactivar comerciales
-- Activo: 1 = puede iniciar sesión, 0 = bloqueado (sin acceso)
-- ============================================================

SET @db := DATABASE();
SET @t := 'comerciales';

SET @col := 'Activo';
SET @has := (SELECT COUNT(*)
             FROM information_schema.columns
             WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @sql := (SELECT IF(@has=0,
  'ALTER TABLE `comerciales` ADD COLUMN `Activo` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''1=activo, 0=desactivado''',
  'SELECT 1'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Asegurar que filas existentes queden activas
UPDATE `comerciales` SET `Activo` = 1 WHERE `Activo` IS NULL;
