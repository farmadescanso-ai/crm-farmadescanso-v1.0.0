-- Script SQL para crear tabla de control de versiones
-- CRM Farmadescanso - Sistema de Gestión de Versiones
-- Permite registrar, rastrear y recuperar versiones estables de la aplicación

USE farmadescanso;

-- Crear tabla de versiones si no existe
CREATE TABLE IF NOT EXISTS `versiones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero_version` varchar(20) NOT NULL COMMENT 'Número de versión (ej: 1.0.0, 1.1.0, 2.0.0)',
  `version_mayor` int(11) NOT NULL COMMENT 'Parte mayor de la versión (1.x.x)',
  `version_menor` int(11) NOT NULL COMMENT 'Parte menor de la versión (x.1.x)',
  `version_revision` int(11) NOT NULL COMMENT 'Parte de revisión (x.x.1)',
  `tipo_version` enum('desarrollo','beta','estable','hotfix') NOT NULL DEFAULT 'desarrollo' COMMENT 'Tipo de versión',
  `estable` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 si es versión estable, 0 si no',
  `tag_github` varchar(100) DEFAULT NULL COMMENT 'Tag de GitHub asociado (ej: v1.0.0)',
  `commit_hash` varchar(40) DEFAULT NULL COMMENT 'Hash del commit de GitHub',
  `branch_github` varchar(100) DEFAULT NULL COMMENT 'Rama de GitHub desde la que se creó',
  `descripcion` text COMMENT 'Descripción de los cambios en esta versión',
  `notas_cambio` text COMMENT 'Notas detalladas de cambios (CHANGELOG)',
  `fecha_creacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
  `fecha_despliegue` datetime DEFAULT NULL COMMENT 'Fecha de despliegue a producción',
  `fecha_estable` datetime DEFAULT NULL COMMENT 'Fecha en que se marcó como estable',
  `creado_por` varchar(255) DEFAULT NULL COMMENT 'Usuario que creó esta versión',
  `activa_produccion` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 si está actualmente en producción',
  `rollback_disponible` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1 si se puede hacer rollback',
  `url_release` varchar(500) DEFAULT NULL COMMENT 'URL del release en GitHub',
  `observaciones` text COMMENT 'Observaciones adicionales',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_numero_version` (`numero_version`),
  UNIQUE KEY `idx_tag_github` (`tag_github`),
  KEY `idx_estable` (`estable`),
  KEY `idx_activa_produccion` (`activa_produccion`),
  KEY `idx_tipo_version` (`tipo_version`),
  KEY `idx_fecha_creacion` (`fecha_creacion`),
  KEY `idx_version_numerica` (`version_mayor`, `version_menor`, `version_revision`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabla de control de versiones de la aplicación';

-- Vista para obtener la última versión estable
CREATE OR REPLACE VIEW `v_ultima_version_estable` AS
SELECT 
  id,
  numero_version,
  tipo_version,
  tag_github,
  commit_hash,
  descripcion,
  fecha_creacion,
  fecha_despliegue,
  fecha_estable,
  creado_por,
  activa_produccion
FROM `versiones`
WHERE estable = 1
ORDER BY version_mayor DESC, version_menor DESC, version_revision DESC, fecha_creacion DESC
LIMIT 1;

-- Vista para obtener la versión actual en producción
CREATE OR REPLACE VIEW `v_version_produccion` AS
SELECT 
  id,
  numero_version,
  tipo_version,
  tag_github,
  commit_hash,
  descripcion,
  fecha_creacion,
  fecha_despliegue,
  creado_por
FROM `versiones`
WHERE activa_produccion = 1
ORDER BY fecha_despliegue DESC
LIMIT 1;

-- Insertar versión inicial (1.0.0)
-- IMPORTANTE: Ajustar los datos según la situación actual
INSERT INTO `versiones` (
  `numero_version`,
  `version_mayor`,
  `version_menor`,
  `version_revision`,
  `tipo_version`,
  `estable`,
  `tag_github`,
  `descripcion`,
  `notas_cambio`,
  `creado_por`,
  `activa_produccion`,
  `fecha_estable`,
  `fecha_despliegue`
) VALUES (
  '1.0.0',
  1,
  0,
  0,
  'estable',
  1,
  'v1.0.0',
  'Versión inicial estable del CRM Farmadescanso',
  'Primera versión estable del sistema CRM para comerciales de Farmadescanso 2021 SL.\n\nFuncionalidades principales:\n- Gestión de clientes\n- Gestión de pedidos\n- Gestión de comerciales\n- Sistema de comisiones\n- Integración con APIs externas',
  'Sistema',
  1,
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE 
  `descripcion` = VALUES(`descripcion`),
  `estable` = VALUES(`estable`);

-- Verificar que se creó correctamente
SELECT 'Tabla de versiones creada correctamente' AS resultado;
SELECT * FROM `versiones` WHERE numero_version = '1.0.0';