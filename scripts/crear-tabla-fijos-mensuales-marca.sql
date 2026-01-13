-- Script para crear la tabla de fijos mensuales por marca
-- Esta tabla reemplaza el campo fijo_mensual de la tabla comerciales

USE farmadescanso;

-- Crear tabla para fijos mensuales por marca
CREATE TABLE IF NOT EXISTS `fijos_mensuales_marca` (
  `id` int NOT NULL AUTO_INCREMENT,
  `comercial_id` int NOT NULL,
  `marca_id` int NOT NULL,
  `importe` decimal(10,2) NOT NULL DEFAULT '0.00',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `fecha_creacion` datetime DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_comercial_marca` (`comercial_id`, `marca_id`),
  KEY `idx_comercial` (`comercial_id`),
  KEY `idx_marca` (`marca_id`),
  CONSTRAINT `fk_fijos_comercial` FOREIGN KEY (`comercial_id`) REFERENCES `Comerciales` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_fijos_marca` FOREIGN KEY (`marca_id`) REFERENCES `Marcas` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrar datos existentes de fijo_mensual a la nueva tabla
-- Si un comercial tiene fijo_mensual, se distribuirá entre todas las marcas
INSERT INTO `fijos_mensuales_marca` (`comercial_id`, `marca_id`, `importe`, `activo`)
SELECT 
    c.id as comercial_id,
    m.id as marca_id,
    CASE 
        WHEN c.fijo_mensual IS NOT NULL AND c.fijo_mensual > 0 THEN
            -- Distribuir el fijo_mensual entre todas las marcas
            ROUND(c.fijo_mensual / (SELECT COUNT(*) FROM marcas), 2)
        ELSE 0.00
    END as importe,
    1 as activo
FROM comerciales c
CROSS JOIN marcas m
WHERE c.fijo_mensual IS NOT NULL AND c.fijo_mensual > 0
ON DUPLICATE KEY UPDATE 
    `importe` = VALUES(`importe`),
    `fecha_actualizacion` = CURRENT_TIMESTAMP;

-- Nota: El campo fijo_mensual en comerciales se puede mantener por compatibilidad
-- o eliminarse más adelante si se confirma que ya no se usa
