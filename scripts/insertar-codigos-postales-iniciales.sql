-- =====================================================
-- INSERTAR CÓDIGOS POSTALES INICIALES
-- =====================================================
-- Este script inserta códigos postales de ejemplo
-- Para una carga completa, usar el script de importación
-- =====================================================

USE farmadescanso;

-- Insertar algunos códigos postales de ejemplo de diferentes provincias
-- Nota: Estos son ejemplos. Para una carga completa, usar un archivo CSV
-- o el script de importación correspondiente

-- Códigos postales de Murcia (provincia 30)
INSERT INTO `Codigos_Postales` (`CodigoPostal`, `Localidad`, `Provincia`, `Id_Provincia`, `ComunidadAutonoma`, `Activo`) VALUES
('30001', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30002', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30003', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30004', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30005', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30006', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30007', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30008', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30009', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30010', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30011', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30012', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30100', 'Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30193', 'Yéchar', 'Murcia', 30, 'Región de Murcia', 1),
('30500', 'Molina de Segura', 'Murcia', 30, 'Región de Murcia', 1),
('30510', 'Yecla', 'Murcia', 30, 'Región de Murcia', 1),
('30520', 'Jumilla', 'Murcia', 30, 'Región de Murcia', 1),
('30530', 'Cieza', 'Murcia', 30, 'Región de Murcia', 1),
('30540', 'Archena', 'Murcia', 30, 'Región de Murcia', 1),
('30550', 'Alhama de Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30560', 'Lorca', 'Murcia', 30, 'Región de Murcia', 1),
('30570', 'Totana', 'Murcia', 30, 'Región de Murcia', 1),
('30580', 'Mazarrón', 'Murcia', 30, 'Región de Murcia', 1),
('30590', 'Águilas', 'Murcia', 30, 'Región de Murcia', 1),
('30600', 'Cartagena', 'Murcia', 30, 'Región de Murcia', 1),
('30700', 'Torre-Pacheco', 'Murcia', 30, 'Región de Murcia', 1),
('30710', 'San Javier', 'Murcia', 30, 'Región de Murcia', 1),
('30720', 'San Pedro del Pinatar', 'Murcia', 30, 'Región de Murcia', 1),
('30730', 'Los Alcázares', 'Murcia', 30, 'Región de Murcia', 1),
('30800', 'Lorca', 'Murcia', 30, 'Región de Murcia', 1),
('30820', 'Alcantarilla', 'Murcia', 30, 'Región de Murcia', 1),
('30830', 'Beniel', 'Murcia', 30, 'Región de Murcia', 1),
('30840', 'Alhama de Murcia', 'Murcia', 30, 'Región de Murcia', 1),
('30850', 'Totana', 'Murcia', 30, 'Región de Murcia', 1),
('30860', 'Mazarrón', 'Murcia', 30, 'Región de Murcia', 1),
('30870', 'Águilas', 'Murcia', 30, 'Región de Murcia', 1),
('30880', 'Puerto Lumbreras', 'Murcia', 30, 'Región de Murcia', 1),
('30890', 'Librilla', 'Murcia', 30, 'Región de Murcia', 1),
('30900', 'Mula', 'Murcia', 30, 'Región de Murcia', 1),
('30910', 'Bullas', 'Murcia', 30, 'Región de Murcia', 1),
('30920', 'Caravaca de la Cruz', 'Murcia', 30, 'Región de Murcia', 1),
('30930', 'Moratalla', 'Murcia', 30, 'Región de Murcia', 1),
('30940', 'Cehegín', 'Murcia', 30, 'Región de Murcia', 1),
('30950', 'Calasparra', 'Murcia', 30, 'Región de Murcia', 1),
('30960', 'Cieza', 'Murcia', 30, 'Región de Murcia', 1),
('30970', 'Abarán', 'Murcia', 30, 'Región de Murcia', 1),
('30980', 'Blanca', 'Murcia', 30, 'Región de Murcia', 1),
('30990', 'Fortuna', 'Murcia', 30, 'Región de Murcia', 1)
ON DUPLICATE KEY UPDATE 
  `Localidad` = VALUES(`Localidad`),
  `Provincia` = VALUES(`Provincia`),
  `Id_Provincia` = VALUES(`Id_Provincia`),
  `ComunidadAutonoma` = VALUES(`ComunidadAutonoma`),
  `ActualizadoEn` = CURRENT_TIMESTAMP;

-- Códigos postales de Sevilla (provincia 41)
INSERT INTO `Codigos_Postales` (`CodigoPostal`, `Localidad`, `Provincia`, `Id_Provincia`, `ComunidadAutonoma`, `Activo`) VALUES
('41001', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41002', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41003', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41004', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41005', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41010', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41011', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41012', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41013', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41014', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41015', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41020', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41080', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1),
('41092', 'Sevilla', 'Sevilla', 41, 'Andalucía', 1)
ON DUPLICATE KEY UPDATE 
  `Localidad` = VALUES(`Localidad`),
  `Provincia` = VALUES(`Provincia`),
  `Id_Provincia` = VALUES(`Id_Provincia`),
  `ComunidadAutonoma` = VALUES(`ComunidadAutonoma`),
  `ActualizadoEn` = CURRENT_TIMESTAMP;

-- Códigos postales de Madrid (provincia 28)
INSERT INTO `Codigos_Postales` (`CodigoPostal`, `Localidad`, `Provincia`, `Id_Provincia`, `ComunidadAutonoma`, `Activo`) VALUES
('28001', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28002', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28003', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28004', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28005', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28006', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28007', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28008', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28009', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28010', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28013', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28014', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28015', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28016', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28020', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28028', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28036', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1),
('28045', 'Madrid', 'Madrid', 28, 'Comunidad de Madrid', 1)
ON DUPLICATE KEY UPDATE 
  `Localidad` = VALUES(`Localidad`),
  `Provincia` = VALUES(`Provincia`),
  `Id_Provincia` = VALUES(`Id_Provincia`),
  `ComunidadAutonoma` = VALUES(`ComunidadAutonoma`),
  `ActualizadoEn` = CURRENT_TIMESTAMP;

-- Códigos postales de Barcelona (provincia 08)
INSERT INTO `Codigos_Postales` (`CodigoPostal`, `Localidad`, `Provincia`, `Id_Provincia`, `ComunidadAutonoma`, `Activo`) VALUES
('08001', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08002', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08003', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08004', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08005', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08006', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08007', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08008', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08009', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08010', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08011', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08012', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08013', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08014', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08015', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08020', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08021', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08022', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08025', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08028', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08029', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08030', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08034', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08035', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08036', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08037', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08038', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08039', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08040', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08041', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1),
('08042', 'Barcelona', 'Barcelona', 8, 'Cataluña', 1)
ON DUPLICATE KEY UPDATE 
  `Localidad` = VALUES(`Localidad`),
  `Provincia` = VALUES(`Provincia`),
  `Id_Provincia` = VALUES(`Id_Provincia`),
  `ComunidadAutonoma` = VALUES(`ComunidadAutonoma`),
  `ActualizadoEn` = CURRENT_TIMESTAMP;

-- Códigos postales de Valencia (provincia 46)
INSERT INTO `Codigos_Postales` (`CodigoPostal`, `Localidad`, `Provincia`, `Id_Provincia`, `ComunidadAutonoma`, `Activo`) VALUES
('46001', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46002', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46003', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46004', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46005', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46006', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46007', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46008', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46009', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46010', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46011', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46012', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46013', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46014', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46015', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46020', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46021', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46022', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46023', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46024', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46025', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1),
('46026', 'Valencia', 'Valencia', 46, 'Comunidad Valenciana', 1)
ON DUPLICATE KEY UPDATE 
  `Localidad` = VALUES(`Localidad`),
  `Provincia` = VALUES(`Provincia`),
  `Id_Provincia` = VALUES(`Id_Provincia`),
  `ComunidadAutonoma` = VALUES(`ComunidadAutonoma`),
  `ActualizadoEn` = CURRENT_TIMESTAMP;

-- Nota: Este script inserta solo algunos códigos postales de ejemplo.
-- Para una carga completa de todos los códigos postales de España,
-- se recomienda usar un archivo CSV o un script de importación masiva.
