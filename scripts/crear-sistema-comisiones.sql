-- =====================================================
-- SISTEMA DE COMISIONES Y PRESUPUESTOS
-- =====================================================
-- Este script crea todas las tablas necesarias para el sistema de comisiones

USE farmadescanso;

-- =====================================================
-- 1. AGREGAR CAMPO FIJO MENSUAL A COMERCIALES
-- =====================================================
ALTER TABLE comerciales
ADD COLUMN IF NOT EXISTS fijo_mensual DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Fijo mensual del comercial' AFTER Roll;

-- =====================================================
-- 2. TABLA DE PRESUPUESTOS
-- =====================================================
-- Presupuesto por comercial, artículo y año
CREATE TABLE IF NOT EXISTS presupuestos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comercial_id INT NOT NULL COMMENT 'ID del comercial',
  articulo_id INT NOT NULL COMMENT 'ID del artículo',
  año INT NOT NULL COMMENT 'Año del presupuesto (ej: 2025)',
  cantidad_presupuestada DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Cantidad de unidades presupuestadas',
  importe_presupuestado DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Importe presupuestado en euros',
  porcentaje_comision DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Porcentaje de comisión sobre este presupuesto',
  activo TINYINT(1) DEFAULT 1 COMMENT 'Si el presupuesto está activo',
  observaciones TEXT COMMENT 'Observaciones sobre el presupuesto',
  creado_por INT COMMENT 'ID del usuario que creó el presupuesto',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (comercial_id) REFERENCES comerciales(id) ON DELETE CASCADE,
  FOREIGN KEY (articulo_id) REFERENCES articulos(id) ON DELETE CASCADE,
  FOREIGN KEY (creado_por) REFERENCES comerciales(id) ON DELETE SET NULL,
  
  UNIQUE KEY uk_presupuesto_comercial_articulo_año (comercial_id, articulo_id, año),
  INDEX idx_presupuesto_comercial (comercial_id),
  INDEX idx_presupuesto_articulo (articulo_id),
  INDEX idx_presupuesto_año (año)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Presupuestos por comercial, artículo y año';

-- =====================================================
-- 3. TABLA DE COMISIONES
-- =====================================================
-- Comisiones mensuales pagadas a los comerciales
CREATE TABLE IF NOT EXISTS comisiones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comercial_id INT NOT NULL COMMENT 'ID del comercial',
  mes INT NOT NULL COMMENT 'Mes de la comisión (1-12)',
  año INT NOT NULL COMMENT 'Año de la comisión',
  fijo_mensual DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Fijo mensual del comercial',
  comision_ventas DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Comisión por ventas',
  comision_presupuesto DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Comisión por cumplimiento de presupuesto',
  total_ventas DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Total de ventas del mes',
  total_comision DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Total de comisión (fijo + comisiones)',
  estado ENUM('Pendiente', 'Calculada', 'Pagada', 'Anulada') DEFAULT 'Pendiente' COMMENT 'Estado de la comisión',
  fecha_pago DATE NULL COMMENT 'Fecha en que se pagó la comisión',
  observaciones TEXT COMMENT 'Observaciones sobre la comisión',
  calculado_por INT COMMENT 'ID del usuario que calculó la comisión',
  pagado_por INT COMMENT 'ID del usuario que marcó como pagada',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (comercial_id) REFERENCES comerciales(id) ON DELETE CASCADE,
  FOREIGN KEY (calculado_por) REFERENCES comerciales(id) ON DELETE SET NULL,
  FOREIGN KEY (pagado_por) REFERENCES comerciales(id) ON DELETE SET NULL,
  
  UNIQUE KEY uk_comision_comercial_mes_año (comercial_id, mes, año),
  INDEX idx_comision_comercial (comercial_id),
  INDEX idx_comision_mes_año (mes, año),
  INDEX idx_comision_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Comisiones mensuales de los comerciales';

-- =====================================================
-- 4. TABLA DE DETALLE DE COMISIONES
-- =====================================================
-- Detalle de cómo se calculó cada comisión (por pedido/artículo)
CREATE TABLE IF NOT EXISTS comisiones_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comision_id INT NOT NULL COMMENT 'ID de la comisión padre',
  pedido_id INT COMMENT 'ID del pedido que generó esta comisión',
  articulo_id INT COMMENT 'ID del artículo',
  cantidad DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Cantidad vendida',
  importe_venta DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Importe de la venta',
  porcentaje_comision DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Porcentaje aplicado',
  importe_comision DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Importe de comisión calculado',
  tipo_comision ENUM('Venta', 'Presupuesto', 'Rapel') DEFAULT 'Venta' COMMENT 'Tipo de comisión',
  observaciones TEXT COMMENT 'Observaciones',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (comision_id) REFERENCES comisiones(id) ON DELETE CASCADE,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL,
  FOREIGN KEY (articulo_id) REFERENCES articulos(id) ON DELETE SET NULL,
  
  INDEX idx_comision_detalle_comision (comision_id),
  INDEX idx_comision_detalle_pedido (pedido_id),
  INDEX idx_comision_detalle_articulo (articulo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Detalle de cálculo de comisiones';

-- =====================================================
-- 5. TABLA DE RAPELES
-- =====================================================
-- Rapeles trimestrales por marca y comercial
CREATE TABLE IF NOT EXISTS rapeles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comercial_id INT NOT NULL COMMENT 'ID del comercial',
  marca VARCHAR(255) NOT NULL COMMENT 'Marca del producto',
  trimestre INT NOT NULL COMMENT 'Trimestre (1-4)',
  año INT NOT NULL COMMENT 'Año del rapel',
  ventas_trimestre DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Total de ventas del trimestre',
  objetivo_trimestre DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Objetivo de ventas del trimestre',
  porcentaje_cumplimiento DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Porcentaje de cumplimiento',
  porcentaje_rapel DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Porcentaje de rapel aplicable',
  importe_rapel DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Importe del rapel calculado',
  estado ENUM('Pendiente', 'Calculado', 'Pagado', 'Anulada') DEFAULT 'Pendiente' COMMENT 'Estado del rapel',
  fecha_pago DATE NULL COMMENT 'Fecha en que se pagó el rapel',
  observaciones TEXT COMMENT 'Observaciones sobre el rapel',
  calculado_por INT COMMENT 'ID del usuario que calculó el rapel',
  pagado_por INT COMMENT 'ID del usuario que marcó como pagado',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (comercial_id) REFERENCES comerciales(id) ON DELETE CASCADE,
  FOREIGN KEY (calculado_por) REFERENCES comerciales(id) ON DELETE SET NULL,
  FOREIGN KEY (pagado_por) REFERENCES comerciales(id) ON DELETE SET NULL,
  
  UNIQUE KEY uk_rapel_comercial_marca_trimestre_año (comercial_id, marca, trimestre, año),
  INDEX idx_rapel_comercial (comercial_id),
  INDEX idx_rapel_marca (marca),
  INDEX idx_rapel_trimestre_año (trimestre, año),
  INDEX idx_rapel_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Rapeles trimestrales por marca y comercial';

-- =====================================================
-- 6. TABLA DE CONFIGURACIÓN DE RAPELES
-- =====================================================
-- Configuración de porcentajes de rapel por nivel de cumplimiento
CREATE TABLE IF NOT EXISTS rapeles_configuracion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  marca VARCHAR(255) NOT NULL COMMENT 'Marca del producto',
  porcentaje_cumplimiento_min DECIMAL(5,2) NOT NULL COMMENT 'Porcentaje mínimo de cumplimiento',
  porcentaje_cumplimiento_max DECIMAL(5,2) NOT NULL COMMENT 'Porcentaje máximo de cumplimiento',
  porcentaje_rapel DECIMAL(5,2) NOT NULL COMMENT 'Porcentaje de rapel aplicable',
  activo TINYINT(1) DEFAULT 1 COMMENT 'Si la configuración está activa',
  observaciones TEXT COMMENT 'Observaciones',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_rapel_config_marca (marca),
  INDEX idx_rapel_config_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración de porcentajes de rapel por nivel de cumplimiento';

-- =====================================================
-- 7. TABLA DE OBJETIVOS POR MARCA Y TRIMESTRE
-- =====================================================
-- Objetivos de ventas por marca, comercial y trimestre
CREATE TABLE IF NOT EXISTS objetivos_marca (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comercial_id INT NOT NULL COMMENT 'ID del comercial',
  marca VARCHAR(255) NOT NULL COMMENT 'Marca del producto',
  trimestre INT NOT NULL COMMENT 'Trimestre (1-4)',
  año INT NOT NULL COMMENT 'Año del objetivo',
  objetivo DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Objetivo de ventas en euros',
  activo TINYINT(1) DEFAULT 1 COMMENT 'Si el objetivo está activo',
  observaciones TEXT COMMENT 'Observaciones',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (comercial_id) REFERENCES comerciales(id) ON DELETE CASCADE,
  
  UNIQUE KEY uk_objetivo_comercial_marca_trimestre_año (comercial_id, marca, trimestre, año),
  INDEX idx_objetivo_comercial (comercial_id),
  INDEX idx_objetivo_marca (marca),
  INDEX idx_objetivo_trimestre_año (trimestre, año)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Objetivos de ventas por marca, comercial y trimestre';

-- =====================================================
-- 8. TABLA DE CONDICIONES ESPECIALES
-- =====================================================
-- Condiciones especiales de comisión por artículo o comercial
CREATE TABLE IF NOT EXISTS condiciones_especiales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comercial_id INT NULL COMMENT 'ID del comercial (NULL = aplica a todos)',
  articulo_id INT NULL COMMENT 'ID del artículo (NULL = aplica a todos)',
  porcentaje_comision DECIMAL(5,2) NOT NULL COMMENT 'Porcentaje de comisión especial',
  descripcion TEXT COMMENT 'Descripción de la condición especial',
  activo TINYINT(1) DEFAULT 1 COMMENT 'Si la condición está activa',
  fecha_inicio DATE NULL COMMENT 'Fecha de inicio de la condición',
  fecha_fin DATE NULL COMMENT 'Fecha de fin de la condición',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (comercial_id) REFERENCES comerciales(id) ON DELETE CASCADE,
  FOREIGN KEY (articulo_id) REFERENCES articulos(id) ON DELETE CASCADE,
  
  INDEX idx_condicion_comercial (comercial_id),
  INDEX idx_condicion_articulo (articulo_id),
  INDEX idx_condicion_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Condiciones especiales de comisión por artículo o comercial';

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================

