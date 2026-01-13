-- Añadir columna Id_Provincia a la tabla clientes si no existe
ALTER TABLE `clientes` 
ADD COLUMN IF NOT EXISTS `Id_Provincia` int(11) DEFAULT NULL AFTER `Poblacion`,
ADD KEY `fk_clientes_provincia` (`Id_Provincia`),
ADD CONSTRAINT `fk_clientes_provincia` FOREIGN KEY (`Id_Provincia`) REFERENCES `provincias` (`id`) ON DELETE SET NULL;

-- Si la columna ya existe pero no tiene la FK, añadirla
-- (Este comando puede fallar si ya existe, es normal)
-- ALTER TABLE `clientes` ADD CONSTRAINT `fk_clientes_provincia` FOREIGN KEY (`Id_Provincia`) REFERENCES `provincias` (`id`) ON DELETE SET NULL;

