-- Script SQL para crear usuario de prueba en la base de datos
-- Ejecutar en phpMyAdmin o en MySQL

-- Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS `crm_farmadescanso` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Usar la base de datos
USE `crm_farmadescanso`;

-- Crear tabla comerciales si no existe
CREATE TABLE IF NOT EXISTS `comerciales` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(255) NOT NULL,
  `Email` varchar(255) NOT NULL,
  `Password` varchar(255) DEFAULT NULL,
  `DNI` varchar(20) DEFAULT NULL,
  `Telefono` varchar(50) DEFAULT NULL,
  `Direccion` varchar(255) DEFAULT NULL,
  `Poblacion` varchar(100) DEFAULT NULL,
  `Provincia` varchar(100) DEFAULT NULL,
  `Roll` varchar(50) DEFAULT 'Comercial',
  `FechaCreacion` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `idx_email` (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertar usuario de prueba
-- Email: admin@farmadescanso.com
-- Contraseña: admin123
-- DNI: 12345678A (también se puede usar como contraseña)

INSERT INTO `comerciales` (`Nombre`, `Email`, `Password`, `DNI`, `Telefono`, `Roll`) 
VALUES ('Administrador', 'admin@farmadescanso.com', 'admin123', '12345678A', '666123456', 'Administrador')
ON DUPLICATE KEY UPDATE `Password` = 'admin123';

-- Insertar usuario alternativo (por si el primero ya existe)
INSERT INTO `comerciales` (`Nombre`, `Email`, `Password`, `DNI`, `Telefono`, `Roll`) 
VALUES ('Usuario Prueba', 'prueba@farmadescanso.com', 'prueba123', '87654321B', '666654321', 'Comercial')
ON DUPLICATE KEY UPDATE `Password` = 'prueba123';

-- Verificar que se crearon
SELECT * FROM `comerciales`;

