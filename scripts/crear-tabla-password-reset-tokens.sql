-- Script SQL para crear la tabla de tokens de recuperación de contraseña
-- Ejecutar en phpMyAdmin o en MySQL

USE `crm_farmadescanso`;

-- Crear tabla para tokens de recuperación de contraseña
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comercial_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_token` (`token`),
  KEY `idx_comercial_id` (`comercial_id`),
  KEY `idx_email` (`email`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `fk_password_reset_comercial` FOREIGN KEY (`comercial_id`) REFERENCES `comerciales` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
