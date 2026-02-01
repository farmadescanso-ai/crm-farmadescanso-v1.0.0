-- ============================================================
-- CRM Farmadescanso - Pedidos: enlazar Dirección de Envío
-- Objetivo:
-- - Añadir `Id_DireccionEnvio` (nullable) a `pedidos`
-- - Index + FK a `direccionesEnvio`
-- ============================================================

-- Este script es IDEMPOTENTE (se puede ejecutar varias veces).
SET @db := DATABASE();

-- Resolver tabla pedidos real (case-insensitive)
SET @t_pedidos := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='pedidos'
  ORDER BY (table_name='pedidos') DESC, table_name ASC
  LIMIT 1
);

-- Resolver tabla direccionesEnvio real (case-insensitive)
SET @t_dir := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)=LOWER('direccionesEnvio')
  ORDER BY (table_name='direccionesEnvio') DESC, table_name ASC
  LIMIT 1
);

-- 1) Columna (solo si no existe)
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name=@t_pedidos AND column_name='Id_DireccionEnvio'
);
SET @sql := (SELECT IF(@t_pedidos IS NOT NULL AND @has_col=0,
  CONCAT('ALTER TABLE `', @t_pedidos, '` ADD COLUMN `Id_DireccionEnvio` INT NULL AFTER `Id_Cliente`'),
  'SELECT 1'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) Índice (solo si no existe)
SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema=@db AND table_name=@t_pedidos AND index_name='idx_pedidos_id_direccion_envio'
);
SET @sql := (SELECT IF(@t_pedidos IS NOT NULL AND @has_idx=0,
  CONCAT('ALTER TABLE `', @t_pedidos, '` ADD KEY `idx_pedidos_id_direccion_envio` (`Id_DireccionEnvio`)'),
  'SELECT 1'
));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3) FK (solo si existe direccionesEnvio y la FK no existe)
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

