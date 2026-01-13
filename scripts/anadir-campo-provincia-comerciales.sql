-- Añadir campo Id_Provincia a la tabla comerciales
-- Este campo se establecerá automáticamente por el código postal

USE farmadescanso;

-- Verificar si el campo ya existe
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'farmadescanso' 
    AND TABLE_NAME = 'comerciales' 
    AND COLUMN_NAME = 'Id_Provincia'
);

-- Añadir el campo si no existe
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE comerciales ADD COLUMN Id_Provincia INT(11) NULL AFTER Poblacion',
    'SELECT "Campo Id_Provincia ya existe" AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Crear índice para mejorar las consultas
CREATE INDEX IF NOT EXISTS idx_comerciales_id_provincia ON comerciales(Id_Provincia);

-- Verificar que se añadió correctamente
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'farmadescanso' 
AND TABLE_NAME = 'comerciales' 
AND COLUMN_NAME = 'Id_Provincia';
