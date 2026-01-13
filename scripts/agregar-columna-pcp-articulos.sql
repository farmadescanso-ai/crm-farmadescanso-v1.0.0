-- Agregar columna PCP (Precio de Compra) a la tabla articulos
-- Para calcular la rentabilidad de cada producto

ALTER TABLE articulos 
ADD COLUMN IF NOT EXISTS PCP DECIMAL(10,2) NULL COMMENT 'Precio de Compra del producto' 
AFTER PVL;

-- Agregar índice para búsquedas por PCP
ALTER TABLE articulos 
ADD INDEX IF NOT EXISTS idx_articulo_pcp (PCP);

