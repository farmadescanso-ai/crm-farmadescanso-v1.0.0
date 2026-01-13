-- Script para eliminar completamente el cliente con ID = 700
-- y todos sus registros relacionados en todas las tablas
-- 
-- IMPORTANTE: Este script realiza una eliminación permanente (hard delete)
-- Asegúrate de tener un backup antes de ejecutar este script

USE farmadescanso;

-- Desactivar temporalmente las verificaciones de claves foráneas
SET FOREIGN_KEY_CHECKS = 0;

-- Iniciar transacción para asegurar que todo se elimine o nada
START TRANSACTION;

-- 1. Eliminar Pedidos_Articulos relacionados a través de Pedidos del cliente
DELETE pa FROM `Pedidos_Articulos` pa
INNER JOIN `Pedidos` p ON pa.`Id_NumPedido` = p.`id`
WHERE p.`Id_Cliente` = 700;

-- 2. Eliminar Pedidos del cliente
DELETE FROM `Pedidos` WHERE `Id_Cliente` = 700;

-- 3. Eliminar Visitas del cliente
DELETE FROM `Visitas` WHERE `Id_Cliente` = 700;

-- 4. Eliminar relaciones Clientes_Cooperativas del cliente
DELETE FROM `Clientes_Cooperativas` WHERE `Id_Cliente` = 700;

-- 5. Finalmente, eliminar el cliente
DELETE FROM `Clientes` WHERE `id` = 700;

-- Verificar que el cliente fue eliminado
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Cliente eliminado correctamente'
        ELSE '⚠️ El cliente aún existe'
    END AS resultado
FROM `Clientes` WHERE `id` = 700;

-- Verificar que no quedan registros relacionados
SELECT 
    'Pedidos_Articulos' AS tabla,
    COUNT(*) AS registros_restantes
FROM `Pedidos_Articulos` pa
INNER JOIN `Pedidos` p ON pa.`Id_NumPedido` = p.`id`
WHERE p.`Id_Cliente` = 700

UNION ALL

SELECT 
    'Pedidos' AS tabla,
    COUNT(*) AS registros_restantes
FROM `Pedidos` WHERE `Id_Cliente` = 700

UNION ALL

SELECT 
    'Visitas' AS tabla,
    COUNT(*) AS registros_restantes
FROM `Visitas` WHERE `Id_Cliente` = 700

UNION ALL

SELECT 
    'Clientes_Cooperativas' AS tabla,
    COUNT(*) AS registros_restantes
FROM `Clientes_Cooperativas` WHERE `Id_Cliente` = 700;

-- Si todo está correcto, confirmar la transacción
-- Si hay algún problema, descomentar la siguiente línea para revertir:
-- ROLLBACK;

COMMIT;

-- Reactivar las verificaciones de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;
