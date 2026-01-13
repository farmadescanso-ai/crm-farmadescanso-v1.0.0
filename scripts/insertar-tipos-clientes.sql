-- Insertar tipos de clientes en la tabla tipos_clientes
INSERT INTO `tipos_clientes` (`Tipo`) VALUES
('Farmacia'),
('Parafarmacia'),
('RPM'),
('Clínica Dental'),
('Distribuidor'),
('Particular'),
('Web')
ON DUPLICATE KEY UPDATE `Tipo` = VALUES(`Tipo`);

