-- =====================================================
-- ELIMINAR CONFIGURACIONES GENERALES (marca = NULL)
-- =====================================================
-- Este script elimina todas las configuraciones con marca = NULL
-- para forzar que todas las configuraciones sean por marca específica

USE farmadescanso;

-- Eliminar configuraciones generales de comisiones por tipo pedido
DELETE FROM config_comisiones_tipo_pedido 
WHERE marca IS NULL;

-- Eliminar configuraciones generales de descuento transporte
DELETE FROM config_descuento_transporte 
WHERE marca IS NULL;

-- NOTA: Las configuraciones de rappel presupuesto pueden mantenerse como generales
-- ya que el rappel no depende de la marca del artículo

-- Verificar que solo quedan configuraciones por marca específica
SELECT 'Configuraciones por tipo pedido restantes:' as Info;
SELECT marca, nombre_tipo_pedido, año_aplicable, COUNT(*) as total
FROM config_comisiones_tipo_pedido
GROUP BY marca, nombre_tipo_pedido, año_aplicable
ORDER BY año_aplicable DESC, marca, nombre_tipo_pedido;

SELECT 'Configuraciones descuento transporte restantes:' as Info;
SELECT marca, año_aplicable, COUNT(*) as total
FROM config_descuento_transporte
GROUP BY marca, año_aplicable
ORDER BY año_aplicable DESC, marca;
