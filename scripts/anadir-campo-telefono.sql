-- Añadir campo Telefono a la tabla clientes (si no existe)
-- Primero verificar si existe con tilde y renombrarlo, o crear el campo si no existe

-- Opción 1: Si existe 'Teléfono' con tilde, renombrarlo a 'Telefono'
-- ALTER TABLE `clientes` CHANGE COLUMN `Teléfono` `Telefono` VARCHAR(13) NULL DEFAULT NULL AFTER `Movil`;

-- Opción 2: Si no existe, añadirlo
ALTER TABLE `clientes` 
ADD COLUMN IF NOT EXISTS `Telefono` VARCHAR(13) NULL DEFAULT NULL AFTER `Movil`;

-- Si el campo ya existe, el comando anterior dará error pero no afectará la estructura
-- Para verificar: SHOW COLUMNS FROM clientes LIKE '%tele%';

