-- Agregar campo mes a la tabla presupuestos
-- Permite generar presupuestos por comercial, año y mes

-- Primero, eliminar la clave única antigua
ALTER TABLE presupuestos DROP INDEX IF EXISTS uk_presupuesto_comercial_articulo_año;

-- Agregar el campo mes (1-12, NULL para presupuestos anuales)
ALTER TABLE presupuestos 
ADD COLUMN mes INT NULL COMMENT 'Mes del presupuesto (1-12). NULL para presupuestos anuales' 
AFTER año;

-- Crear nueva clave única que incluye mes
-- Si mes es NULL, se permite un solo presupuesto anual por comercial/artículo/año
-- Si mes tiene valor, se permite un presupuesto mensual por comercial/artículo/año/mes
ALTER TABLE presupuestos 
ADD UNIQUE KEY uk_presupuesto_comercial_articulo_año_mes (comercial_id, articulo_id, año, mes);

-- Agregar índice para búsquedas por mes
ALTER TABLE presupuestos 
ADD INDEX idx_presupuesto_mes (mes);

