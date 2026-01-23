-- =====================================================
-- CREAR TABLA: fijos_mensuales_marca_periodo
-- Soporta fijos por (comercial_id, marca_id, año, mes)
-- Mantiene integridad referencial con comerciales/marcas
-- =====================================================

USE farmadescanso;

CREATE TABLE IF NOT EXISTS `fijos_mensuales_marca_periodo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `comercial_id` int NOT NULL,
  `marca_id` int NOT NULL,
  `año` int NOT NULL,
  `mes` int NOT NULL,
  `importe` decimal(10,2) NOT NULL DEFAULT '0.00',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `fecha_creacion` datetime DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_comercial_marca_periodo` (`comercial_id`, `marca_id`, `año`, `mes`),
  KEY `idx_comercial_periodo` (`comercial_id`, `año`, `mes`),
  KEY `idx_marca_periodo` (`marca_id`, `año`, `mes`),
  CONSTRAINT `fk_fijos_periodo_comercial` FOREIGN KEY (`comercial_id`) REFERENCES `comerciales` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_fijos_periodo_marca` FOREIGN KEY (`marca_id`) REFERENCES `marcas` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

