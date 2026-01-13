-- ============================================
-- Script para añadir campo NumClientes a Codigos_Postales
-- y calcular el número de clientes activos por código postal
-- ============================================

-- Añadir columna NumClientes si no existe
ALTER TABLE Codigos_Postales 
ADD COLUMN IF NOT EXISTS NumClientes INT(11) NOT NULL DEFAULT 0 COMMENT 'Número de clientes activos con este código postal';

-- Añadir índice para mejorar las consultas
CREATE INDEX IF NOT EXISTS idx_codigos_postales_numclientes ON Codigos_Postales(NumClientes);

-- Calcular y actualizar el número de clientes activos por código postal
-- OK_KO puede ser 1, 'OK', 'Activo', o NULL para clientes activos
UPDATE Codigos_Postales cp
SET cp.NumClientes = (
    SELECT COUNT(*) 
    FROM Clientes c
    WHERE (c.Id_CodigoPostal = cp.id OR c.CodigoPostal = cp.CodigoPostal)
      AND (
        CAST(c.OK_KO AS CHAR) = '1'
        OR CAST(c.OK_KO AS CHAR) = 'OK'
        OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'OK'
        OR UPPER(TRIM(CAST(c.OK_KO AS CHAR))) = 'ACTIVO'
        OR c.OK_KO IS NULL
      )
);

-- Verificar los resultados
SELECT 
    cp.CodigoPostal,
    cp.Localidad,
    cp.Provincia,
    cp.NumClientes,
    (SELECT COUNT(*) 
     FROM Clientes c
     WHERE (c.Id_CodigoPostal = cp.id OR c.CodigoPostal = cp.CodigoPostal)
       AND (c.OK_KO = 1 OR c.OK_KO IS NULL)
    ) AS NumClientesVerificado
FROM Codigos_Postales cp
WHERE cp.NumClientes > 0
ORDER BY cp.NumClientes DESC
LIMIT 10;
