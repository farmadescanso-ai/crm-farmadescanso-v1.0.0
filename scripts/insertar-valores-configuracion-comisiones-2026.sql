-- =====================================================
-- INSERTAR VALORES INICIALES DE CONFIGURACIÓN DE COMISIONES
-- =====================================================
-- Este script inserta los valores actuales hardcodeados en el código
-- para el año 2026 basándose en los valores del 2025
-- 
-- ⚠️  NOTA: Este script hardcodea las marcas IALZON y YOUBELLE
-- Para un sistema más escalable, usa: insertar-valores-configuracion-comisiones-2026-escalable.sql
-- =====================================================

USE farmadescanso;

-- =====================================================
-- 1. CONFIGURACIÓN DE COMISIONES POR TIPO DE PEDIDO
-- =====================================================
-- Valores actuales del código:
-- - Transfer: 5%
-- - Directo/Normal: 15%
-- Se insertan configuraciones para cada marca (IALZON, YOUBELLE) y general (NULL)

-- Insertar configuración para pedidos Transfer - TODAS LAS MARCAS
INSERT INTO config_comisiones_tipo_pedido (
  marca,
  nombre_tipo_pedido,
  porcentaje_comision,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  NULL, -- NULL = todas las marcas
  'Transfer',
  5.00,
  'Comisión para pedidos tipo Transfer (Hefame, Alliance, Cofares) - 5% sobre Base Imponible - Aplica a todas las marcas',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_comision = 5.00,
  descripcion = 'Comisión para pedidos tipo Transfer (Hefame, Alliance, Cofares) - 5% sobre Base Imponible - Aplica a todas las marcas',
  actualizado_en = CURRENT_TIMESTAMP;

-- Insertar configuración para pedidos Transfer - IALZON
INSERT INTO config_comisiones_tipo_pedido (
  marca,
  nombre_tipo_pedido,
  porcentaje_comision,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  'IALZON',
  'Transfer',
  5.00,
  'Comisión para pedidos tipo Transfer (Hefame, Alliance, Cofares) - 5% sobre Base Imponible - Marca IALZON',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_comision = 5.00,
  descripcion = 'Comisión para pedidos tipo Transfer (Hefame, Alliance, Cofares) - 5% sobre Base Imponible - Marca IALZON',
  actualizado_en = CURRENT_TIMESTAMP;

-- Insertar configuración para pedidos Transfer - YOUBELLE
INSERT INTO config_comisiones_tipo_pedido (
  marca,
  nombre_tipo_pedido,
  porcentaje_comision,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  'YOUBELLE',
  'Transfer',
  5.00,
  'Comisión para pedidos tipo Transfer (Hefame, Alliance, Cofares) - 5% sobre Base Imponible - Marca YOUBELLE',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_comision = 5.00,
  descripcion = 'Comisión para pedidos tipo Transfer (Hefame, Alliance, Cofares) - 5% sobre Base Imponible - Marca YOUBELLE',
  actualizado_en = CURRENT_TIMESTAMP;

-- Insertar configuración para pedidos Directo - TODAS LAS MARCAS
INSERT INTO config_comisiones_tipo_pedido (
  marca,
  nombre_tipo_pedido,
  porcentaje_comision,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  NULL, -- NULL = todas las marcas
  'Directo',
  15.00,
  'Comisión para pedidos tipo Directo/Normal - 15% sobre Base Imponible - Aplica a todas las marcas',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_comision = 15.00,
  descripcion = 'Comisión para pedidos tipo Directo/Normal - 15% sobre Base Imponible - Aplica a todas las marcas',
  actualizado_en = CURRENT_TIMESTAMP;

-- Insertar configuración para pedidos Directo - IALZON
INSERT INTO config_comisiones_tipo_pedido (
  marca,
  nombre_tipo_pedido,
  porcentaje_comision,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  'IALZON',
  'Directo',
  15.00,
  'Comisión para pedidos tipo Directo/Normal - 15% sobre Base Imponible - Marca IALZON',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_comision = 15.00,
  descripcion = 'Comisión para pedidos tipo Directo/Normal - 15% sobre Base Imponible - Marca IALZON',
  actualizado_en = CURRENT_TIMESTAMP;

-- Insertar configuración para pedidos Directo - YOUBELLE
INSERT INTO config_comisiones_tipo_pedido (
  marca,
  nombre_tipo_pedido,
  porcentaje_comision,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  'YOUBELLE',
  'Directo',
  15.00,
  'Comisión para pedidos tipo Directo/Normal - 15% sobre Base Imponible - Marca YOUBELLE',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_comision = 15.00,
  descripcion = 'Comisión para pedidos tipo Directo/Normal - 15% sobre Base Imponible - Marca YOUBELLE',
  actualizado_en = CURRENT_TIMESTAMP;

-- Insertar configuración para pedidos Normal - TODAS LAS MARCAS
INSERT INTO config_comisiones_tipo_pedido (
  marca,
  nombre_tipo_pedido,
  porcentaje_comision,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  NULL, -- NULL = todas las marcas
  'Normal',
  15.00,
  'Comisión para pedidos tipo Normal - 15% sobre Base Imponible - Aplica a todas las marcas',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_comision = 15.00,
  descripcion = 'Comisión para pedidos tipo Normal - 15% sobre Base Imponible - Aplica a todas las marcas',
  actualizado_en = CURRENT_TIMESTAMP;

-- =====================================================
-- 2. CONFIGURACIÓN DE RAPPEL POR PRESUPUESTO
-- =====================================================
-- Valor actual del código: 1%
-- Se insertan configuraciones para cada marca (IALZON, YOUBELLE) y general (NULL)

-- Insertar configuración para rappel presupuesto - TODAS LAS MARCAS
INSERT INTO config_rappel_presupuesto (
  marca,
  porcentaje_rappel,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  NULL, -- NULL = todas las marcas
  1.00,
  'Rappel de 1% sobre ventas acumuladas del trimestre cuando se supera el presupuesto acumulado - Aplica a todas las marcas',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_rappel = 1.00,
  descripcion = 'Rappel de 1% sobre ventas acumuladas del trimestre cuando se supera el presupuesto acumulado - Aplica a todas las marcas',
  actualizado_en = CURRENT_TIMESTAMP;

-- Insertar configuración para rappel presupuesto - IALZON
INSERT INTO config_rappel_presupuesto (
  marca,
  porcentaje_rappel,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  'IALZON',
  1.00,
  'Rappel de 1% sobre ventas acumuladas del trimestre cuando se supera el presupuesto acumulado - Marca IALZON',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_rappel = 1.00,
  descripcion = 'Rappel de 1% sobre ventas acumuladas del trimestre cuando se supera el presupuesto acumulado - Marca IALZON',
  actualizado_en = CURRENT_TIMESTAMP;

-- Insertar configuración para rappel presupuesto - YOUBELLE
INSERT INTO config_rappel_presupuesto (
  marca,
  porcentaje_rappel,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  'YOUBELLE',
  1.00,
  'Rappel de 1% sobre ventas acumuladas del trimestre cuando se supera el presupuesto acumulado - Marca YOUBELLE',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_rappel = 1.00,
  descripcion = 'Rappel de 1% sobre ventas acumuladas del trimestre cuando se supera el presupuesto acumulado - Marca YOUBELLE',
  actualizado_en = CURRENT_TIMESTAMP;

-- =====================================================
-- 3. CONFIGURACIÓN DE FIJO MENSUAL
-- =====================================================
-- Valores actuales del código:
-- - Año límite: 2026 (hasta 2026 inclusive se paga siempre)
-- - Porcentaje mínimo: 25% del presupuesto mensual

INSERT INTO config_fijo_mensual (
  año_limite,
  porcentaje_minimo_ventas,
  descripcion,
  activo
) VALUES (
  2026,
  25.00,
  'Reglas de fijo mensual: Hasta 2026 (inclusive) se paga siempre. A partir de 2027, solo se paga si las ventas mensuales alcanzan al menos el 25% del presupuesto mensual',
  1
) ON DUPLICATE KEY UPDATE
  año_limite = 2026,
  porcentaje_minimo_ventas = 25.00,
  descripcion = 'Reglas de fijo mensual: Hasta 2026 (inclusive) se paga siempre. A partir de 2027, solo se paga si las ventas mensuales alcanzan al menos el 25% del presupuesto mensual',
  actualizado_en = CURRENT_TIMESTAMP;

-- =====================================================
-- 4. CONFIGURACIÓN DE DESCUENTO DE TRANSPORTE
-- =====================================================
-- Valor actual del código: 10%
-- Se insertan configuraciones para cada marca (IALZON, YOUBELLE) y general (NULL)

-- Insertar configuración para descuento transporte - TODAS LAS MARCAS
INSERT INTO config_descuento_transporte (
  marca,
  porcentaje_descuento,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  NULL, -- NULL = todas las marcas
  10.00,
  'Descuento del 10% del transporte sobre el Base Imponible de cada línea de pedido - Aplica a todas las marcas',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_descuento = 10.00,
  descripcion = 'Descuento del 10% del transporte sobre el Base Imponible de cada línea de pedido - Aplica a todas las marcas',
  actualizado_en = CURRENT_TIMESTAMP;

-- Insertar configuración para descuento transporte - IALZON
INSERT INTO config_descuento_transporte (
  marca,
  porcentaje_descuento,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  'IALZON',
  10.00,
  'Descuento del 10% del transporte sobre el Base Imponible de cada línea de pedido - Marca IALZON',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_descuento = 10.00,
  descripcion = 'Descuento del 10% del transporte sobre el Base Imponible de cada línea de pedido - Marca IALZON',
  actualizado_en = CURRENT_TIMESTAMP;

-- Insertar configuración para descuento transporte - YOUBELLE
INSERT INTO config_descuento_transporte (
  marca,
  porcentaje_descuento,
  descripcion,
  activo,
  año_aplicable
) VALUES (
  'YOUBELLE',
  10.00,
  'Descuento del 10% del transporte sobre el Base Imponible de cada línea de pedido - Marca YOUBELLE',
  1,
  2026
) ON DUPLICATE KEY UPDATE
  porcentaje_descuento = 10.00,
  descripcion = 'Descuento del 10% del transporte sobre el Base Imponible de cada línea de pedido - Marca YOUBELLE',
  actualizado_en = CURRENT_TIMESTAMP;

-- =====================================================
-- 5. CONFIGURACIÓN DE RAPPEL POR MARCA (Opcional)
-- =====================================================
-- Valores actuales del código:
-- - 80-99%: 2%
-- - 100-119%: 3%
-- - 120%+: 5%
-- NOTA: Esta tabla ya existe (rapeles_configuracion)
-- Si no hay valores, se insertan los valores por defecto

-- Insertar configuración para rapel 80-99%
-- NOTA: La marca es NOT NULL, así que usamos '*' para indicar "todas las marcas"
-- Verificamos si ya existe antes de insertar
INSERT INTO rapeles_configuracion (
  marca,
  porcentaje_cumplimiento_min,
  porcentaje_cumplimiento_max,
  porcentaje_rapel,
  observaciones,
  activo
) 
SELECT 
  '*', -- '*' = aplica a todas las marcas
  80.00,
  99.99,
  2.00,
  'Rappel del 2% sobre el exceso cuando el cumplimiento está entre 80% y 99%',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM rapeles_configuracion 
  WHERE marca = '*' 
  AND porcentaje_cumplimiento_min = 80.00 
  AND porcentaje_cumplimiento_max = 99.99
);

-- Insertar configuración para rapel 100-119%
INSERT INTO rapeles_configuracion (
  marca,
  porcentaje_cumplimiento_min,
  porcentaje_cumplimiento_max,
  porcentaje_rapel,
  observaciones,
  activo
) 
SELECT 
  '*', -- '*' = aplica a todas las marcas
  100.00,
  119.99,
  3.00,
  'Rappel del 3% sobre el exceso cuando el cumplimiento está entre 100% y 119%',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM rapeles_configuracion 
  WHERE marca = '*' 
  AND porcentaje_cumplimiento_min = 100.00 
  AND porcentaje_cumplimiento_max = 119.99
);

-- Insertar configuración para rapel 120% o más
INSERT INTO rapeles_configuracion (
  marca,
  porcentaje_cumplimiento_min,
  porcentaje_cumplimiento_max,
  porcentaje_rapel,
  observaciones,
  activo
) 
SELECT 
  '*', -- '*' = aplica a todas las marcas
  120.00,
  999.99, -- Valor alto para representar "o más"
  5.00,
  'Rappel del 5% sobre el exceso cuando el cumplimiento es 120% o más',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM rapeles_configuracion 
  WHERE marca = '*' 
  AND porcentaje_cumplimiento_min = 120.00 
  AND porcentaje_cumplimiento_max = 999.99
);

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
