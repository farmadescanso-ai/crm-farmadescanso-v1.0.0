-- =====================================================
-- EJEMPLO: ASIGNAR COMERCIALES A CÓDIGOS POSTALES POR MARCA
-- =====================================================
-- Este script muestra ejemplos de cómo asignar comerciales
-- a códigos postales para diferentes marcas
-- =====================================================

USE farmadescanso;

-- =====================================================
-- EJEMPLO 1: Asignar un comercial a un código postal específico para una marca
-- =====================================================
-- Asignar el comercial con ID 2 (Cristina Rico) al código postal 30012 (Murcia)
-- para la marca con ID 1 (Youbelle)

INSERT INTO `Comerciales_Codigos_Postales_Marcas` 
  (`Id_Comercial`, `Id_CodigoPostal`, `Id_Marca`, `FechaInicio`, `Activo`, `Prioridad`, `CreadoPor`)
SELECT 
  2 AS Id_Comercial,  -- Cristina Rico
  cp.id AS Id_CodigoPostal,
  1 AS Id_Marca,  -- Youbelle
  CURDATE() AS FechaInicio,
  1 AS Activo,
  10 AS Prioridad,
  1 AS CreadoPor  -- Administrador
FROM `Codigos_Postales` cp
WHERE cp.`CodigoPostal` = '30012'
  AND cp.`Localidad` = 'Murcia'
LIMIT 1
ON DUPLICATE KEY UPDATE
  `Activo` = 1,
  `FechaInicio` = CURDATE(),
  `ActualizadoEn` = CURRENT_TIMESTAMP;

-- =====================================================
-- EJEMPLO 2: Asignar un comercial a múltiples códigos postales de una provincia
-- =====================================================
-- Asignar el comercial con ID 3 (Jesús Francisco Ros) a todos los códigos postales
-- de Murcia (provincia 30) para la marca con ID 2 (Ialozon)

INSERT INTO `Comerciales_Codigos_Postales_Marcas` 
  (`Id_Comercial`, `Id_CodigoPostal`, `Id_Marca`, `FechaInicio`, `Activo`, `Prioridad`, `CreadoPor`)
SELECT 
  3 AS Id_Comercial,  -- Jesús Francisco Ros
  cp.id AS Id_CodigoPostal,
  2 AS Id_Marca,  -- Ialozon
  CURDATE() AS FechaInicio,
  1 AS Activo,
  5 AS Prioridad,
  1 AS CreadoPor  -- Administrador
FROM `Codigos_Postales` cp
WHERE cp.`Id_Provincia` = 30  -- Murcia
  AND cp.`Activo` = 1
ON DUPLICATE KEY UPDATE
  `Activo` = 1,
  `FechaInicio` = CURDATE(),
  `ActualizadoEn` = CURRENT_TIMESTAMP;

-- =====================================================
-- EJEMPLO 3: Asignar un comercial a un rango de códigos postales
-- =====================================================
-- Asignar el comercial con ID 4 (Óscar Lirola Mesa) a códigos postales
-- de Sevilla (41001-41015) para la marca con ID 1 (Youbelle)

INSERT INTO `Comerciales_Codigos_Postales_Marcas` 
  (`Id_Comercial`, `Id_CodigoPostal`, `Id_Marca`, `FechaInicio`, `Activo`, `Prioridad`, `CreadoPor`)
SELECT 
  4 AS Id_Comercial,  -- Óscar Lirola Mesa
  cp.id AS Id_CodigoPostal,
  1 AS Id_Marca,  -- Youbelle
  CURDATE() AS FechaInicio,
  1 AS Activo,
  10 AS Prioridad,
  1 AS CreadoPor  -- Administrador
FROM `Codigos_Postales` cp
WHERE cp.`CodigoPostal` >= '41001'
  AND cp.`CodigoPostal` <= '41015'
  AND cp.`Provincia` = 'Sevilla'
  AND cp.`Activo` = 1
ON DUPLICATE KEY UPDATE
  `Activo` = 1,
  `FechaInicio` = CURDATE(),
  `ActualizadoEn` = CURRENT_TIMESTAMP;

-- =====================================================
-- EJEMPLO 4: Asignar múltiples comerciales al mismo código postal
-- (útil cuando hay varios comerciales trabajando en la misma zona)
-- =====================================================
-- Asignar dos comerciales al código postal 30001 (Murcia) para diferentes marcas

-- Comercial 2 para marca 1
INSERT INTO `Comerciales_Codigos_Postales_Marcas` 
  (`Id_Comercial`, `Id_CodigoPostal`, `Id_Marca`, `FechaInicio`, `Activo`, `Prioridad`, `CreadoPor`)
SELECT 
  2 AS Id_Comercial,  -- Cristina Rico
  cp.id AS Id_CodigoPostal,
  1 AS Id_Marca,  -- Youbelle
  CURDATE() AS FechaInicio,
  1 AS Activo,
  10 AS Prioridad,
  1 AS CreadoPor
FROM `Codigos_Postales` cp
WHERE cp.`CodigoPostal` = '30001'
  AND cp.`Localidad` = 'Murcia'
LIMIT 1
ON DUPLICATE KEY UPDATE
  `Activo` = 1,
  `ActualizadoEn` = CURRENT_TIMESTAMP;

-- Comercial 3 para marca 2 (mismo código postal)
INSERT INTO `Comerciales_Codigos_Postales_Marcas` 
  (`Id_Comercial`, `Id_CodigoPostal`, `Id_Marca`, `FechaInicio`, `Activo`, `Prioridad`, `CreadoPor`)
SELECT 
  3 AS Id_Comercial,  -- Jesús Francisco Ros
  cp.id AS Id_CodigoPostal,
  2 AS Id_Marca,  -- Ialozon
  CURDATE() AS FechaInicio,
  1 AS Activo,
  10 AS Prioridad,
  1 AS CreadoPor
FROM `Codigos_Postales` cp
WHERE cp.`CodigoPostal` = '30001'
  AND cp.`Localidad` = 'Murcia'
LIMIT 1
ON DUPLICATE KEY UPDATE
  `Activo` = 1,
  `ActualizadoEn` = CURRENT_TIMESTAMP;

-- =====================================================
-- EJEMPLO 5: Desactivar una asignación (soft delete)
-- =====================================================
-- Marcar como inactiva una asignación existente

UPDATE `Comerciales_Codigos_Postales_Marcas`
SET `Activo` = 0,
    `FechaFin` = CURDATE(),
    `ActualizadoEn` = CURRENT_TIMESTAMP
WHERE `Id_Comercial` = 2
  AND `Id_CodigoPostal` = (SELECT id FROM `Codigos_Postales` WHERE `CodigoPostal` = '30012' LIMIT 1)
  AND `Id_Marca` = 1;

-- =====================================================
-- EJEMPLO 6: Consultar asignaciones activas
-- =====================================================
-- Ver todas las asignaciones activas de un comercial

SELECT 
    c.Nombre AS Comercial,
    cp.CodigoPostal,
    cp.Localidad,
    cp.Provincia,
    m.Nombre AS Marca,
    ccp.FechaInicio,
    ccp.FechaFin,
    ccp.Prioridad,
    ccp.Activo
FROM `Comerciales_Codigos_Postales_Marcas` ccp
INNER JOIN `Comerciales` c ON ccp.Id_Comercial = c.id
INNER JOIN `Codigos_Postales` cp ON ccp.Id_CodigoPostal = cp.id
INNER JOIN `Marcas` m ON ccp.Id_Marca = m.id
WHERE ccp.Id_Comercial = 2  -- Cristina Rico
  AND ccp.Activo = 1
ORDER BY cp.Provincia, cp.Localidad, m.Nombre;

-- =====================================================
-- EJEMPLO 7: Consultar qué comercial está asignado a un cliente por marca
-- =====================================================
-- Ver qué comercial está asignado a un cliente específico según su código postal y marca

SELECT 
    cl.Nombre_Razon_Social AS Cliente,
    cl.CodigoPostal AS CodigoPostalCliente,
    cp.CodigoPostal,
    cp.Localidad,
    m.Nombre AS Marca,
    c.Nombre AS ComercialAsignado,
    c.Email AS EmailComercial,
    ccp.Prioridad
FROM `Clientes` cl
INNER JOIN `Codigos_Postales` cp ON cl.Id_CodigoPostal = cp.id
INNER JOIN `Comerciales_Codigos_Postales_Marcas` ccp ON cp.id = ccp.Id_CodigoPostal
INNER JOIN `Marcas` m ON ccp.Id_Marca = m.id
INNER JOIN `Comerciales` c ON ccp.Id_Comercial = c.id
WHERE cl.id = 1  -- ID del cliente
  AND ccp.Activo = 1
  AND (ccp.FechaFin IS NULL OR ccp.FechaFin >= CURDATE())
  AND (ccp.FechaInicio IS NULL OR ccp.FechaInicio <= CURDATE())
ORDER BY ccp.Prioridad DESC, m.Nombre;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
