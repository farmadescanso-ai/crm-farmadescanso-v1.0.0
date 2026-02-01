-- ============================================================
-- CRM Farmadescanso - Direcciones de envío: añadir columna Movil
-- Objetivo:
-- - Añadir `Movil` a `direccionesEnvio` (idempotente)
-- ============================================================

SET @db := DATABASE();
SET @t_dir := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)=LOWER('direccionesEnvio')
  ORDER BY (table_name='direccionesEnvio') DESC, table_name ASC
  LIMIT 1
);

SET @has_movil := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name=@t_dir AND column_name='Movil'
);

SET @sql := (SELECT IF(@t_dir IS NOT NULL AND @has_movil=0,
  CONCAT('ALTER TABLE `', @t_dir, '` ADD COLUMN `Movil` VARCHAR(20) NULL AFTER `Telefono`'),
  'SELECT 1'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

