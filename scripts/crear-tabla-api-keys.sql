-- Crear tabla de API Keys para autenticación de la API REST
-- Almacena las claves API generadas para acceso a los endpoints

USE farmadescanso;

CREATE TABLE IF NOT EXISTS `API_Keys` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `api_key` varchar(64) NOT NULL UNIQUE,
  `descripcion` text,
  `activa` tinyint(1) DEFAULT 1,
  `permisos` json DEFAULT NULL,
  `ultimo_uso` timestamp NULL DEFAULT NULL,
  `creado_en` timestamp DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `creado_por` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_key` (`api_key`),
  KEY `idx_activa` (`activa`),
  KEY `idx_creado_por` (`creado_por`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

