-- =====================================================
-- SISTEMA DE CONFIGURACIÓN DE COMISIONES
-- =====================================================
-- Este script crea las tablas de configuración necesarias
-- para gestionar los parámetros de comisiones fuera del código
-- Fecha: 2026-01-XX
-- =====================================================

USE farmadescanso;

-- =====================================================
-- 1. TABLA DE CONFIGURACIÓN DE COMISIONES POR TIPO DE PEDIDO
-- =====================================================
-- Almacena los porcentajes de comisión según el tipo de pedido y marca
CREATE TABLE IF NOT EXISTS config_comisiones_tipo_pedido (
  id INT AUTO_INCREMENT PRIMARY KEY,
  marca VARCHAR(255) NULL COMMENT 'Marca del artículo (debe existir en tabla Marcas, NULL = todas las marcas). Se normaliza a mayúsculas.',
  tipo_pedido_id INT NULL COMMENT 'ID del tipo de pedido (NULL = tipo por nombre)',
  nombre_tipo_pedido VARCHAR(255) NULL COMMENT 'Nombre del tipo de pedido (ej: Transfer, Directo, Normal)',
  porcentaje_comision DECIMAL(5,2) NOT NULL COMMENT 'Porcentaje de comisión a aplicar',
  descripcion TEXT COMMENT 'Descripción de la configuración',
  activo TINYINT(1) DEFAULT 1 COMMENT 'Si la configuración está activa',
  fecha_inicio DATE NULL COMMENT 'Fecha de inicio de validez',
  fecha_fin DATE NULL COMMENT 'Fecha de fin de validez',
  año_aplicable INT NULL COMMENT 'Año específico para aplicar (NULL = todos los años)',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tipo_pedido_id) REFERENCES tipos_pedidos(id) ON DELETE SET NULL,
  
  INDEX idx_config_marca (marca),
  INDEX idx_config_tipo_pedido_id (tipo_pedido_id),
  INDEX idx_config_nombre_tipo (nombre_tipo_pedido),
  INDEX idx_config_activo (activo),
  INDEX idx_config_año (año_aplicable),
  UNIQUE KEY uk_config_comision_marca_tipo_año (marca, nombre_tipo_pedido, año_aplicable)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración de porcentajes de comisión por tipo de pedido y marca';

-- =====================================================
-- 2. TABLA DE CONFIGURACIÓN DE RAPPEL POR PRESUPUESTO
-- =====================================================
-- Almacena el porcentaje de rappel cuando se supera el presupuesto por marca
CREATE TABLE IF NOT EXISTS config_rappel_presupuesto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  marca VARCHAR(255) NULL COMMENT 'Marca del artículo (debe existir en tabla Marcas, NULL = todas las marcas). Se normaliza a mayúsculas.',
  porcentaje_rappel DECIMAL(5,2) NOT NULL COMMENT 'Porcentaje de rappel sobre ventas acumuladas (ej: 1%)',
  descripcion TEXT COMMENT 'Descripción de la configuración',
  activo TINYINT(1) DEFAULT 1 COMMENT 'Si la configuración está activa',
  fecha_inicio DATE NULL COMMENT 'Fecha de inicio de validez',
  fecha_fin DATE NULL COMMENT 'Fecha de fin de validez',
  año_aplicable INT NULL COMMENT 'Año específico para aplicar (NULL = todos los años)',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_config_rappel_marca (marca),
  INDEX idx_config_rappel_activo (activo),
  INDEX idx_config_rappel_año (año_aplicable),
  UNIQUE KEY uk_config_rappel_marca_año (marca, año_aplicable)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración del porcentaje de rappel por cumplimiento de presupuesto por marca';

-- =====================================================
-- 3. TABLA DE CONFIGURACIÓN DE FIJO MENSUAL
-- =====================================================
-- Almacena las reglas para el pago del fijo mensual
CREATE TABLE IF NOT EXISTS config_fijo_mensual (
  id INT AUTO_INCREMENT PRIMARY KEY,
  año_limite INT NOT NULL COMMENT 'Año límite hasta el cual se paga el fijo siempre (ej: 2026)',
  porcentaje_minimo_ventas DECIMAL(5,2) NOT NULL DEFAULT 25.00 COMMENT 'Porcentaje mínimo de ventas respecto al presupuesto para pagar el fijo (ej: 25%)',
  descripcion TEXT COMMENT 'Descripción de la configuración',
  activo TINYINT(1) DEFAULT 1 COMMENT 'Si la configuración está activa',
  fecha_inicio DATE NULL COMMENT 'Fecha de inicio de validez',
  fecha_fin DATE NULL COMMENT 'Fecha de fin de validez',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_config_fijo_activo (activo),
  INDEX idx_config_fijo_año_limite (año_limite)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración de reglas para el pago del fijo mensual';

-- =====================================================
-- 4. TABLA DE CONFIGURACIÓN DE DESCUENTO DE TRANSPORTE
-- =====================================================
-- Almacena el porcentaje de descuento de transporte a aplicar por marca
CREATE TABLE IF NOT EXISTS config_descuento_transporte (
  id INT AUTO_INCREMENT PRIMARY KEY,
  marca VARCHAR(255) NULL COMMENT 'Marca del artículo (debe existir en tabla Marcas, NULL = todas las marcas). Se normaliza a mayúsculas.',
  porcentaje_descuento DECIMAL(5,2) NOT NULL COMMENT 'Porcentaje de descuento de transporte (ej: 10%)',
  descripcion TEXT COMMENT 'Descripción de la configuración',
  activo TINYINT(1) DEFAULT 1 COMMENT 'Si la configuración está activa',
  fecha_inicio DATE NULL COMMENT 'Fecha de inicio de validez',
  fecha_fin DATE NULL COMMENT 'Fecha de fin de validez',
  año_aplicable INT NULL COMMENT 'Año específico para aplicar (NULL = todos los años)',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_config_transporte_marca (marca),
  INDEX idx_config_transporte_activo (activo),
  INDEX idx_config_transporte_año (año_aplicable),
  UNIQUE KEY uk_config_transporte_marca_año (marca, año_aplicable)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración del porcentaje de descuento de transporte por marca';

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
