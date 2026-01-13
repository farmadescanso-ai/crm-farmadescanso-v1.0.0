-- Crear relación entre clientes y países
-- Cambiar CodPais por Id_Pais como clave foránea

USE farmadescanso;

-- Paso 1: Añadir la columna Id_Pais si no existe
ALTER TABLE `clientes` 
ADD COLUMN `Id_Pais` INT(11) NULL AFTER `CodPais`;

-- Paso 2: Migrar datos existentes de CodPais a Id_Pais
-- Si CodPais tiene un valor, buscar el id correspondiente en la tabla paises
UPDATE `clientes` c
LEFT JOIN `paises` p ON c.`CodPais` = p.`Id_pais`
SET c.`Id_Pais` = p.`id`
WHERE c.`CodPais` IS NOT NULL AND c.`CodPais` != '';

-- Paso 3: Crear índice para la columna Id_Pais
CREATE INDEX `idx_id_pais` ON `clientes` (`Id_Pais`);

-- Paso 4: Crear la clave foránea
ALTER TABLE `clientes`
ADD CONSTRAINT `fk_clientes_pais`
FOREIGN KEY (`Id_Pais`) REFERENCES `paises` (`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- Paso 5: Verificar que la relación funciona
SELECT 
    COUNT(*) as total_clientes,
    COUNT(Id_Pais) as clientes_con_pais,
    COUNT(DISTINCT Id_Pais) as paises_diferentes
FROM clientes;

