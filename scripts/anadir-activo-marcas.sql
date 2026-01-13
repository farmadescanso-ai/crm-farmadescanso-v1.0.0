-- ============================================
-- Script para añadir columna Activo a la tabla Marcas
-- ============================================

-- Añadir columna Activo si no existe
ALTER TABLE Marcas 
ADD COLUMN IF NOT EXISTS Activo TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Indica si la marca está activa (1) o inactiva (0)';

-- Actualizar todos los registros existentes a activo por defecto
UPDATE Marcas 
SET Activo = 1 
WHERE Activo IS NULL OR Activo = 0;

-- Añadir índice para mejorar las consultas por estado activo
CREATE INDEX IF NOT EXISTS idx_marcas_activo ON Marcas(Activo);

-- Verificar los cambios
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Marcas'
  AND COLUMN_NAME = 'Activo';

-- Mostrar resumen de marcas
SELECT 
    Activo,
    COUNT(*) as Total
FROM Marcas
GROUP BY Activo;
