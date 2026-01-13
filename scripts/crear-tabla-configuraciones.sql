-- Crear tabla de configuraciones para el CRM
-- Almacena configuraciones del sistema como webhooks, API keys, etc.

USE farmadescanso;

CREATE TABLE IF NOT EXISTS `Configuraciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clave` varchar(100) NOT NULL UNIQUE,
  `valor` text,
  `descripcion` varchar(255) DEFAULT NULL,
  `tipo` varchar(50) DEFAULT 'text',
  `creado_en` timestamp DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clave` (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar configuraciones iniciales
INSERT INTO `Configuraciones` (`clave`, `valor`, `descripcion`, `tipo`) VALUES
('n8n_webhook_nombre', '', 'Nombre identificativo del webhook de N8N', 'text'),
('n8n_webhook_url', '', 'URL del webhook de N8N para comunicación con Holded', 'url'),
('n8n_webhook_auth_header_key', '', 'Clave del header de autenticación para el webhook de N8N', 'text'),
('n8n_webhook_auth_header_value', '', 'Valor del header de autenticación para el webhook de N8N', 'text'),
('n8n_webhook_observaciones', '', 'Observaciones sobre el funcionamiento del webhook de N8N', 'text'),
('prestashop_url', '', 'URL de la tienda Prestashop', 'url'),
('prestashop_api_key', '', 'Clave API de Prestashop', 'text'),
('prestashop_webservice_key', '', 'Clave del webservice de Prestashop', 'text'),
('prestashop_observaciones', '', 'Observaciones sobre la configuración de Prestashop', 'text')
ON DUPLICATE KEY UPDATE 
  `descripcion` = VALUES(`descripcion`),
  `tipo` = VALUES(`tipo`);

