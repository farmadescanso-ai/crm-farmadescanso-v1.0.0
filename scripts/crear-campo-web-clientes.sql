-- Crear campo Web en la tabla clientes si no existe

USE farmadescanso;

-- Verificar y crear el campo Web
ALTER TABLE `clientes` 
ADD COLUMN IF NOT EXISTS `Web` VARCHAR(255) NULL DEFAULT NULL COMMENT 'URL de la página web' AFTER `Email`;

-- Verificar que se creó correctamente
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'farmadescanso'
  AND TABLE_NAME = 'clientes'
  AND COLUMN_NAME = 'Web';
