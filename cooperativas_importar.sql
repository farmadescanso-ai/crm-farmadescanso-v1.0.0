-- Importar datos de Cooperativas
-- Adaptado para MySQL local (cambiada collation si es necesario)

USE farmadescanso;

-- Verificar si la tabla existe, si no, crearla
CREATE TABLE IF NOT EXISTS `Cooperativas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(255) NOT NULL,
  `Email` varchar(255) NOT NULL,
  `Telefono` varchar(15) DEFAULT NULL,
  `Contacto` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar datos (ignorar si ya existen)
INSERT INTO `Cooperativas` (`id`, `Nombre`, `Email`, `Telefono`, `Contacto`) VALUES
(1, 'HEFAME', 'lopd@hefame.es', '+34968277500', 'Departamento Comercial'),
(2, 'COFARES', 'comercial@cofares.es', '+34917408700', 'Departamento Comercial'),
(3, 'Alliance Healthcare España', 'info@alliance-healthcare.es', '+34900533721', 'Departamento Comercial'),
(4, 'Bidafarma', 'portalweb@bidafarma.es', '+34952248900', 'Departamento Comercial'),
(5, 'Fedefarma', 'info@fedefarma.com', '+34937060371', 'Departamento Comercial'),
(6, 'Novaltia', 'rgpd@novaltia.es', '+34976459400', 'Departamento Comercial')
ON DUPLICATE KEY UPDATE 
  `Nombre` = VALUES(`Nombre`),
  `Email` = VALUES(`Email`),
  `Telefono` = VALUES(`Telefono`),
  `Contacto` = VALUES(`Contacto`);

