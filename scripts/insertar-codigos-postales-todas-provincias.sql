-- =====================================================
-- INSERTAR CÓDIGOS POSTALES DE TODAS LAS PROVINCIAS DE ESPAÑA
-- =====================================================
-- Este script inserta códigos postales principales de todas las provincias españolas
-- Evita duplicados usando ON DUPLICATE KEY UPDATE
-- =====================================================

USE farmadescanso;

-- Desactivar temporalmente las restricciones de clave única para insertar más rápido
SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;

-- =====================================================
-- ÁLAVA (01)
-- =====================================================
INSERT INTO `Codigos_Postales` (`CodigoPostal`, `Localidad`, `Provincia`, `Id_Provincia`, `ComunidadAutonoma`, `Activo`) VALUES
('01001', 'Vitoria', 'Álava', 1, 'País Vasco', 1),
('01002', 'Vitoria', 'Álava', 1, 'País Vasco', 1),
('01003', 'Vitoria', 'Álava', 1, 'País Vasco', 1),
('01004', 'Vitoria', 'Álava', 1, 'País Vasco', 1),
('01005', 'Vitoria', 'Álava', 1, 'País Vasco', 1),
('01006', 'Vitoria', 'Álava', 1, 'País Vasco', 1),
('01007', 'Vitoria', 'Álava', 1, 'País Vasco', 1),
('01008', 'Vitoria', 'Álava', 1, 'País Vasco', 1),
('01009', 'Vitoria', 'Álava', 1, 'País Vasco', 1),
('01010', 'Vitoria', 'Álava', 1, 'País Vasco', 1),
('01100', 'Amurrio', 'Álava', 1, 'País Vasco', 1),
('01200', 'Laguardia', 'Álava', 1, 'País Vasco', 1),
('01230', 'Moreda de Álava', 'Álava', 1, 'País Vasco', 1),
('01300', 'Laudio', 'Álava', 1, 'País Vasco', 1),
('01307', 'Oion', 'Álava', 1, 'País Vasco', 1),
('01308', 'Oyón', 'Álava', 1, 'País Vasco', 1),
('01309', 'Peñacerrada', 'Álava', 1, 'País Vasco', 1),
('01320', 'Oyón', 'Álava', 1, 'País Vasco', 1),
('01400', 'Salvatierra', 'Álava', 1, 'País Vasco', 1),
('01408', 'Agurain', 'Álava', 1, 'País Vasco', 1),
('01420', 'Araia', 'Álava', 1, 'País Vasco', 1),
('01430', 'Añana', 'Álava', 1, 'País Vasco', 1),
('01440', 'Aramaio', 'Álava', 1, 'País Vasco', 1),
('01450', 'Arraia-Maeztu', 'Álava', 1, 'País Vasco', 1),
('01460', 'Armiñón', 'Álava', 1, 'País Vasco', 1),
('01470', 'Arrazua-Ubarrundia', 'Álava', 1, 'País Vasco', 1),
('01474', 'Nanclares de la Oca', 'Álava', 1, 'País Vasco', 1),
('01475', 'Iruña Oka', 'Álava', 1, 'País Vasco', 1),
('01476', 'Trespuentes', 'Álava', 1, 'País Vasco', 1),
('01477', 'Villodas', 'Álava', 1, 'País Vasco', 1),
('01478', 'Nanclares', 'Álava', 1, 'País Vasco', 1),
('01479', 'Landa', 'Álava', 1, 'País Vasco', 1),
('01480', 'Arrazua-Ubarrundia', 'Álava', 1, 'País Vasco', 1),
('01482', 'Arroyabe', 'Álava', 1, 'País Vasco', 1),
('01500', 'Llodio', 'Álava', 1, 'País Vasco', 1),
('01510', 'Ayala', 'Álava', 1, 'País Vasco', 1),
('01520', 'Aramaio', 'Álava', 1, 'País Vasco', 1),
('01530', 'Aramaio', 'Álava', 1, 'País Vasco', 1),
('01540', 'Amurrio', 'Álava', 1, 'País Vasco', 1),
('01550', 'Laudio', 'Álava', 1, 'País Vasco', 1),
('01560', 'Llodio', 'Álava', 1, 'País Vasco', 1),
('01570', 'Artziniega', 'Álava', 1, 'País Vasco', 1),
('01580', 'Artziniega', 'Álava', 1, 'País Vasco', 1),
('01590', 'Zuia', 'Álava', 1, 'País Vasco', 1)
ON DUPLICATE KEY UPDATE 
  `Localidad` = VALUES(`Localidad`),
  `Provincia` = VALUES(`Provincia`),
  `Id_Provincia` = VALUES(`Id_Provincia`),
  `ComunidadAutonoma` = VALUES(`ComunidadAutonoma`),
  `ActualizadoEn` = CURRENT_TIMESTAMP;

-- Continuaré con el resto de provincias en un archivo separado más grande
-- Por ahora, voy a crear un script Node.js que genere todos los códigos postales de forma más eficiente
