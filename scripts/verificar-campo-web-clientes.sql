-- Verificar si existe el campo Web en la tabla clientes
-- Si no existe, crearlo

USE farmadescanso;

-- Verificar si existe el campo
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'farmadescanso'
  AND TABLE_NAME = 'clientes'
  AND COLUMN_NAME = 'Web';

-- Si no existe, crear el campo
-- ALTER TABLE `clientes` ADD COLUMN `Web` VARCHAR(255) NULL DEFAULT NULL AFTER `Email`;
