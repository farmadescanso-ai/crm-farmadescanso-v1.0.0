-- ============================================================================
-- Script para crear/actualizar la tabla Provincias con estructura mejorada
-- El ID será el número de provincia (1-52 para España)
-- ============================================================================

-- Eliminar tabla si existe (CUIDADO: Esto eliminará los datos existentes)
-- Descomentar solo si quieres recrear la tabla desde cero
-- DROP TABLE IF EXISTS `provincias`;

-- Crear tabla Provincias con estructura mejorada
CREATE TABLE IF NOT EXISTS `provincias` (
  `id` INT(11) NOT NULL COMMENT 'ID numérico de la provincia (coincide con el código: 1=01, 2=02, etc.)',
  `Codigo` VARCHAR(2) NOT NULL COMMENT 'Código de provincia (01, 02, 03, etc.)',
  `Nombre` VARCHAR(100) NOT NULL COMMENT 'Nombre de la provincia',
  `Pais` VARCHAR(50) NOT NULL DEFAULT 'España' COMMENT 'Nombre del país',
  `CodigoPais` VARCHAR(3) NOT NULL DEFAULT 'ES' COMMENT 'Código ISO del país',
  `ComunidadAutonoma` VARCHAR(100) NULL COMMENT 'Comunidad autónoma a la que pertenece',
  `Activo` TINYINT(1) DEFAULT 1 COMMENT 'Si la provincia está activa',
  `CreadoEn` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
  `ActualizadoEn` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_provincia_codigo` (`Codigo`),
  UNIQUE KEY `uk_provincia_codigo_pais` (`Codigo`, `CodigoPais`),
  INDEX `idx_provincia_pais` (`Pais`),
  INDEX `idx_provincia_codigo_pais` (`CodigoPais`),
  INDEX `idx_provincia_activo` (`Activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Provincias de España y otros países';

-- ============================================================================
-- Insertar provincias de España (52 provincias: 50 + Ceuta + Melilla)
-- El ID será el número de provincia (1-52)
-- ============================================================================

-- Insertar provincias usando INSERT IGNORE para evitar duplicados
INSERT IGNORE INTO `provincias` (`id`, `Codigo`, `Nombre`, `Pais`, `CodigoPais`, `ComunidadAutonoma`) VALUES
-- Andalucía
(4, '04', 'Almería', 'España', 'ES', 'Andalucía'),
(11, '11', 'Cádiz', 'España', 'ES', 'Andalucía'),
(14, '14', 'Córdoba', 'España', 'ES', 'Andalucía'),
(18, '18', 'Granada', 'España', 'ES', 'Andalucía'),
(21, '21', 'Huelva', 'España', 'ES', 'Andalucía'),
(23, '23', 'Jaén', 'España', 'ES', 'Andalucía'),
(29, '29', 'Málaga', 'España', 'ES', 'Andalucía'),
(41, '41', 'Sevilla', 'España', 'ES', 'Andalucía'),

-- Aragón
(22, '22', 'Huesca', 'España', 'ES', 'Aragón'),
(44, '44', 'Teruel', 'España', 'ES', 'Aragón'),
(50, '50', 'Zaragoza', 'España', 'ES', 'Aragón'),

-- Principado de Asturias
(33, '33', 'Asturias', 'España', 'ES', 'Principado de Asturias'),

-- Islas Baleares
(7, '07', 'Baleares', 'España', 'ES', 'Islas Baleares'),

-- País Vasco
(1, '01', 'Álava', 'España', 'ES', 'País Vasco'),
(20, '20', 'Guipúzcoa', 'España', 'ES', 'País Vasco'),
(48, '48', 'Vizcaya', 'España', 'ES', 'País Vasco'),

-- Canarias
(35, '35', 'Las Palmas', 'España', 'ES', 'Canarias'),
(38, '38', 'Santa Cruz de Tenerife', 'España', 'ES', 'Canarias'),

-- Cantabria
(39, '39', 'Cantabria', 'España', 'ES', 'Cantabria'),

-- Castilla-La Mancha
(2, '02', 'Albacete', 'España', 'ES', 'Castilla-La Mancha'),
(13, '13', 'Ciudad Real', 'España', 'ES', 'Castilla-La Mancha'),
(16, '16', 'Cuenca', 'España', 'ES', 'Castilla-La Mancha'),
(19, '19', 'Guadalajara', 'España', 'ES', 'Castilla-La Mancha'),
(45, '45', 'Toledo', 'España', 'ES', 'Castilla-La Mancha'),

-- Castilla y León
(5, '05', 'Ávila', 'España', 'ES', 'Castilla y León'),
(9, '09', 'Burgos', 'España', 'ES', 'Castilla y León'),
(24, '24', 'León', 'España', 'ES', 'Castilla y León'),
(34, '34', 'Palencia', 'España', 'ES', 'Castilla y León'),
(37, '37', 'Salamanca', 'España', 'ES', 'Castilla y León'),
(40, '40', 'Segovia', 'España', 'ES', 'Castilla y León'),
(42, '42', 'Soria', 'España', 'ES', 'Castilla y León'),
(47, '47', 'Valladolid', 'España', 'ES', 'Castilla y León'),
(49, '49', 'Zamora', 'España', 'ES', 'Castilla y León'),

-- Cataluña
(8, '08', 'Barcelona', 'España', 'ES', 'Cataluña'),
(17, '17', 'Girona', 'España', 'ES', 'Cataluña'),
(25, '25', 'Lérida', 'España', 'ES', 'Cataluña'),
(43, '43', 'Tarragona', 'España', 'ES', 'Cataluña'),

-- Comunidad Valenciana
(3, '03', 'Alicante', 'España', 'ES', 'Comunidad Valenciana'),
(12, '12', 'Castellón', 'España', 'ES', 'Comunidad Valenciana'),
(46, '46', 'Valencia', 'España', 'ES', 'Comunidad Valenciana'),

-- Extremadura
(6, '06', 'Badajoz', 'España', 'ES', 'Extremadura'),
(10, '10', 'Cáceres', 'España', 'ES', 'Extremadura'),

-- Galicia
(15, '15', 'La Coruña', 'España', 'ES', 'Galicia'),
(27, '27', 'Lugo', 'España', 'ES', 'Galicia'),
(32, '32', 'Ourense', 'España', 'ES', 'Galicia'),
(36, '36', 'Pontevedra', 'España', 'ES', 'Galicia'),

-- Comunidad de Madrid
(28, '28', 'Madrid', 'España', 'ES', 'Comunidad de Madrid'),

-- Región de Murcia
(30, '30', 'Murcia', 'España', 'ES', 'Región de Murcia'),

-- Comunidad Foral de Navarra
(31, '31', 'Navarra', 'España', 'ES', 'Comunidad Foral de Navarra'),

-- La Rioja
(26, '26', 'La Rioja', 'España', 'ES', 'La Rioja'),

-- Ciudades Autónomas
(51, '51', 'Ceuta', 'España', 'ES', 'Ceuta'),
(52, '52', 'Melilla', 'España', 'ES', 'Melilla');

-- ============================================================================
-- Verificar que se insertaron todas las provincias
-- ============================================================================
SELECT 
    COUNT(*) as TotalProvincias,
    COUNT(DISTINCT Codigo) as CodigosUnicos,
    GROUP_CONCAT(Nombre ORDER BY id SEPARATOR ', ') as Provincias
FROM provincias 
WHERE CodigoPais = 'ES';
