-- Permitir NULL en DNI_CIF y actualizar valores vacíos a NULL
-- Script para modificar la tabla clientes

USE farmadescanso;

-- Modificar la columna para permitir NULL
ALTER TABLE `clientes` MODIFY COLUMN `DNI_CIF` varchar(15) NULL;

-- Actualizar valores vacíos o 'Pendiente' a NULL (opcional, si ya hay datos)
-- UPDATE `clientes` SET `DNI_CIF` = NULL WHERE `DNI_CIF` = '' OR `DNI_CIF` = 'Pendiente';

