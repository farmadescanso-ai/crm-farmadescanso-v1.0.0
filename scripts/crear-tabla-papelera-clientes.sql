-- Crear tabla Papelera-Clientes idéntica a la tabla Clientes
-- Esta tabla almacenará los clientes eliminados (soft delete)

USE farmadescanso;

-- Crear la tabla Papelera-Clientes con la misma estructura que Clientes
CREATE TABLE IF NOT EXISTS `Papelera-Clientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `Id_Cial` int(11) NOT NULL,
  `DNI_CIF` varchar(15) DEFAULT NULL,
  `Nombre_Razon_Social` varchar(255) NOT NULL,
  `Nombre_Cial` varchar(255) DEFAULT NULL,
  `NumeroFarmacia` varchar(255) DEFAULT NULL,
  `Direccion` varchar(255) DEFAULT NULL,
  `Poblacion` varchar(255) DEFAULT NULL,
  `Id_Provincia` int(11) DEFAULT NULL,
  `CodigoPostal` varchar(8) DEFAULT NULL,
  `Movil` varchar(13) DEFAULT NULL,
  `Telefono` varchar(13) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `TipoCliente` varchar(255) DEFAULT NULL,
  `Id_TipoCliente` int(11) DEFAULT NULL,
  `CodPais` varchar(3) DEFAULT NULL,
  `Id_Pais` int(11) DEFAULT NULL,
  `Pais` varchar(255) DEFAULT NULL,
  `Idioma` varchar(15) DEFAULT NULL,
  `Id_Idioma` int(11) DEFAULT NULL,
  `Moneda` varchar(4) DEFAULT NULL,
  `Id_Moneda` int(11) DEFAULT NULL,
  `NomContacto` varchar(255) DEFAULT NULL,
  `Tarifa` varchar(255) DEFAULT NULL,
  `Id_FormaPago` int(11) DEFAULT NULL,
  `Dto` decimal(5,2) DEFAULT 0.00,
  `CuentaContable` int(11) DEFAULT NULL,
  `RE` decimal(5,2) DEFAULT NULL,
  `Banco` varchar(255) DEFAULT NULL,
  `Swift` varchar(255) DEFAULT NULL,
  `IBAN` varchar(34) DEFAULT NULL,
  `Modelo_347` tinyint(1) DEFAULT 1,
  `FechaEliminacion` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha en que se movió a la papelera',
  `EliminadoPor` int(11) DEFAULT NULL COMMENT 'ID del comercial que eliminó el registro',
  PRIMARY KEY (`id`),
  KEY `idx_papelera_id_cial` (`Id_Cial`),
  KEY `idx_papelera_dni_cif` (`DNI_CIF`),
  KEY `idx_papelera_email` (`Email`),
  KEY `idx_papelera_fecha_eliminacion` (`FechaEliminacion`),
  KEY `idx_papelera_eliminado_por` (`EliminadoPor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nota: No se crean foreign keys para evitar problemas con referencias
-- ya que los registros en la papelera pueden tener referencias a datos eliminados

