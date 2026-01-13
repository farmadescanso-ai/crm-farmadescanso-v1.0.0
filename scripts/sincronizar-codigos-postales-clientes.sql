-- =====================================================
-- SINCRONIZAR CÓDIGOS POSTALES DE CLIENTES
-- =====================================================
-- Este script sincroniza los códigos postales existentes
-- en la tabla Clientes con la nueva tabla Codigos_Postales
-- =====================================================

USE farmadescanso;

-- =====================================================
-- 1. ACTUALIZAR Id_CodigoPostal EN CLIENTES
-- =====================================================
-- Buscar y actualizar Id_CodigoPostal basándose en el campo CodigoPostal
-- y la localidad/provincia del cliente

UPDATE `Clientes` c
INNER JOIN `Codigos_Postales` cp ON c.`CodigoPostal` = cp.`CodigoPostal`
SET c.`Id_CodigoPostal` = cp.`id`
WHERE c.`CodigoPostal` IS NOT NULL 
  AND c.`CodigoPostal` != ''
  AND c.`Id_CodigoPostal` IS NULL;

-- Si hay múltiples códigos postales con el mismo código pero diferente localidad,
-- intentar hacer match por provincia también
UPDATE `Clientes` c
INNER JOIN `Codigos_Postales` cp ON c.`CodigoPostal` = cp.`CodigoPostal`
INNER JOIN `provincias` p ON c.`Id_Provincia` = p.`id`
INNER JOIN `provincias` pp ON cp.`Id_Provincia` = pp.`id`
SET c.`Id_CodigoPostal` = cp.`id`
WHERE c.`CodigoPostal` IS NOT NULL 
  AND c.`CodigoPostal` != ''
  AND c.`Id_CodigoPostal` IS NULL
  AND p.`Codigo` = pp.`Codigo`;

-- =====================================================
-- 2. ACTUALIZAR Id_CodigoPostal EN COMERCIALES
-- =====================================================
-- Buscar y actualizar Id_CodigoPostal basándose en el campo CodigoPostal
-- y la población del comercial

UPDATE `Comerciales` c
INNER JOIN `Codigos_Postales` cp ON c.`CodigoPostal` = cp.`CodigoPostal`
SET c.`Id_CodigoPostal` = cp.`id`
WHERE c.`CodigoPostal` IS NOT NULL 
  AND c.`CodigoPostal` != ''
  AND c.`Id_CodigoPostal` IS NULL;

-- =====================================================
-- 3. REPORTE DE CLIENTES SIN CÓDIGO POSTAL ASIGNADO
-- =====================================================
-- Mostrar clientes que tienen CodigoPostal pero no Id_CodigoPostal
-- (códigos postales que no están en la tabla Codigos_Postales)

SELECT 
    c.`id` AS Id_Cliente,
    c.`Nombre_Razon_Social`,
    c.`CodigoPostal`,
    c.`Poblacion`,
    c.`Provincia` AS ProvinciaCliente,
    c.`Id_Provincia`,
    COUNT(*) AS Total
FROM `Clientes` c
WHERE c.`CodigoPostal` IS NOT NULL 
  AND c.`CodigoPostal` != ''
  AND c.`Id_CodigoPostal` IS NULL
GROUP BY c.`CodigoPostal`, c.`Poblacion`
ORDER BY Total DESC
LIMIT 50;

-- =====================================================
-- 4. REPORTE DE COMERCIALES SIN CÓDIGO POSTAL ASIGNADO
-- =====================================================
-- Mostrar comerciales que tienen CodigoPostal pero no Id_CodigoPostal

SELECT 
    c.`id` AS Id_Comercial,
    c.`Nombre`,
    c.`CodigoPostal`,
    c.`Poblacion`
FROM `Comerciales` c
WHERE c.`CodigoPostal` IS NOT NULL 
  AND c.`CodigoPostal` != ''
  AND c.`Id_CodigoPostal` IS NULL;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
