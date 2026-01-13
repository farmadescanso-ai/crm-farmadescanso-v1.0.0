-- =====================================================
-- INSERTAR VALORES DE CONFIGURACIÓN DE COMISIONES PARA 2026
-- =====================================================
-- Valores finales confirmados:
-- - Transfer: 5%
-- - Directo: 10%
-- - Rappel Presupuesto: 2%
-- - Descuento Transporte: ANULADO (no se aplica)
-- =====================================================

USE farmadescanso;

-- =====================================================
-- 1. CONFIGURACIÓN DE COMISIONES POR TIPO DE PEDIDO
-- =====================================================
-- Transfer: 5%, Directo: 10%
-- Se insertan configuraciones generales y por marca

-- Transfer - General (todas las marcas)
INSERT INTO config_comisiones_tipo_pedido (
  marca, nombre_tipo_pedido, porcentaje_comision, descripcion, activo, año_aplicable
) VALUES (
  NULL, 'Transfer', 5.00, 
  'Comisión para pedidos tipo Transfer (Hefame, Alliance, Cofares) - 5% sobre Base Imponible - Aplica a todas las marcas',
  1, 2026
) ON DUPLICATE KEY UPDATE
  porcentaje_comision = 5.00,
  descripcion = VALUES(descripcion),
  actualizado_en = CURRENT_TIMESTAMP;

-- Transfer - Por marca (inserta para todas las marcas)
INSERT INTO config_comisiones_tipo_pedido (
  marca, nombre_tipo_pedido, porcentaje_comision, descripcion, activo, año_aplicable
)
SELECT 
  UPPER(m.Nombre) as marca,
  'Transfer' as nombre_tipo_pedido,
  5.00 as porcentaje_comision,
  CONCAT('Comisión para pedidos tipo Transfer - 5% sobre Base Imponible - Marca ', UPPER(m.Nombre)) as descripcion,
  1 as activo,
  2026 as año_aplicable
FROM Marcas m
WHERE NOT EXISTS (
  SELECT 1 FROM config_comisiones_tipo_pedido c
  WHERE c.marca = UPPER(m.Nombre)
  AND c.nombre_tipo_pedido = 'Transfer'
  AND c.año_aplicable = 2026
);

-- Directo - General (todas las marcas)
INSERT INTO config_comisiones_tipo_pedido (
  marca, nombre_tipo_pedido, porcentaje_comision, descripcion, activo, año_aplicable
) VALUES (
  NULL, 'Directo', 10.00,
  'Comisión para pedidos tipo Directo/Normal - 10% sobre Base Imponible - Aplica a todas las marcas',
  1, 2026
) ON DUPLICATE KEY UPDATE
  porcentaje_comision = 10.00,
  descripcion = VALUES(descripcion),
  actualizado_en = CURRENT_TIMESTAMP;

-- Directo - Por marca (inserta para todas las marcas)
INSERT INTO config_comisiones_tipo_pedido (
  marca, nombre_tipo_pedido, porcentaje_comision, descripcion, activo, año_aplicable
)
SELECT 
  UPPER(m.Nombre) as marca,
  'Directo' as nombre_tipo_pedido,
  10.00 as porcentaje_comision,
  CONCAT('Comisión para pedidos tipo Directo/Normal - 10% sobre Base Imponible - Marca ', UPPER(m.Nombre)) as descripcion,
  1 as activo,
  2026 as año_aplicable
FROM Marcas m
WHERE NOT EXISTS (
  SELECT 1 FROM config_comisiones_tipo_pedido c
  WHERE c.marca = UPPER(m.Nombre)
  AND c.nombre_tipo_pedido = 'Directo'
  AND c.año_aplicable = 2026
);

-- Normal - General (todas las marcas) - Mismo que Directo
INSERT INTO config_comisiones_tipo_pedido (
  marca, nombre_tipo_pedido, porcentaje_comision, descripcion, activo, año_aplicable
) VALUES (
  NULL, 'Normal', 10.00,
  'Comisión para pedidos tipo Normal - 10% sobre Base Imponible - Aplica a todas las marcas',
  1, 2026
) ON DUPLICATE KEY UPDATE
  porcentaje_comision = 10.00,
  descripcion = VALUES(descripcion),
  actualizado_en = CURRENT_TIMESTAMP;

-- =====================================================
-- 2. CONFIGURACIÓN DE RAPPEL POR PRESUPUESTO
-- =====================================================
-- Rappel: 2% sobre ventas acumuladas del trimestre

-- General (todas las marcas)
INSERT INTO config_rappel_presupuesto (
  marca, porcentaje_rappel, descripcion, activo, año_aplicable
) VALUES (
  NULL, 2.00,
  'Rappel de 2% sobre ventas acumuladas del trimestre cuando se supera el presupuesto acumulado - Aplica a todas las marcas',
  1, 2026
) ON DUPLICATE KEY UPDATE
  porcentaje_rappel = 2.00,
  descripcion = VALUES(descripcion),
  actualizado_en = CURRENT_TIMESTAMP;

-- Por marca (inserta para todas las marcas)
INSERT INTO config_rappel_presupuesto (
  marca, porcentaje_rappel, descripcion, activo, año_aplicable
)
SELECT 
  UPPER(m.Nombre) as marca,
  2.00 as porcentaje_rappel,
  CONCAT('Rappel de 2% sobre ventas acumuladas del trimestre cuando se supera el presupuesto acumulado - Marca ', UPPER(m.Nombre)) as descripcion,
  1 as activo,
  2026 as año_aplicable
FROM Marcas m
WHERE NOT EXISTS (
  SELECT 1 FROM config_rappel_presupuesto r
  WHERE r.marca = UPPER(m.Nombre)
  AND r.año_aplicable = 2026
);

-- =====================================================
-- 3. CONFIGURACIÓN DE FIJO MENSUAL
-- =====================================================
-- Reglas generales: Hasta 2026 se paga siempre, a partir de 2027 requiere 25% mínimo

INSERT INTO config_fijo_mensual (
  año_limite, porcentaje_minimo_ventas, descripcion, activo
) VALUES (
  2026, 25.00,
  'Reglas de fijo mensual: Hasta 2026 (inclusive) se paga siempre. A partir de 2027, solo se paga si las ventas mensuales alcanzan al menos el 25% del presupuesto mensual',
  1
) ON DUPLICATE KEY UPDATE
  año_limite = 2026,
  porcentaje_minimo_ventas = 25.00,
  descripcion = VALUES(descripcion),
  actualizado_en = CURRENT_TIMESTAMP;

-- =====================================================
-- 4. CONFIGURACIÓN DE DESCUENTO DE TRANSPORTE
-- =====================================================
-- ANULADO: No se aplica descuento de transporte

-- Marcar todas las configuraciones de transporte como inactivas o insertar con 0%
INSERT INTO config_descuento_transporte (
  marca, porcentaje_descuento, descripcion, activo, año_aplicable
) VALUES (
  NULL, 0.00,
  'Descuento de transporte ANULADO para 2026 - No se aplica descuento de transporte',
  0, 2026
) ON DUPLICATE KEY UPDATE
  porcentaje_descuento = 0.00,
  activo = 0,
  descripcion = VALUES(descripcion),
  actualizado_en = CURRENT_TIMESTAMP;

-- Por marca (todas inactivas/0%)
INSERT INTO config_descuento_transporte (
  marca, porcentaje_descuento, descripcion, activo, año_aplicable
)
SELECT 
  UPPER(m.Nombre) as marca,
  0.00 as porcentaje_descuento,
  CONCAT('Descuento de transporte ANULADO para 2026 - Marca ', UPPER(m.Nombre)) as descripcion,
  0 as activo,
  2026 as año_aplicable
FROM Marcas m
WHERE NOT EXISTS (
  SELECT 1 FROM config_descuento_transporte t
  WHERE t.marca = UPPER(m.Nombre)
  AND t.año_aplicable = 2026
);

-- =====================================================
-- 5. CONFIGURACIÓN DE RAPPEL POR MARCA (Tabla existente)
-- =====================================================
-- Mantener los valores existentes (80-99%: 2%, 100-119%: 3%, 120%+: 5%)

INSERT INTO rapeles_configuracion (
  marca, porcentaje_cumplimiento_min, porcentaje_cumplimiento_max, porcentaje_rapel, observaciones, activo
)
SELECT 
  '*' as marca,
  80.00 as porcentaje_cumplimiento_min,
  99.99 as porcentaje_cumplimiento_max,
  2.00 as porcentaje_rapel,
  'Rappel del 2% sobre el exceso cuando el cumplimiento está entre 80% y 99%' as observaciones,
  1 as activo
WHERE NOT EXISTS (
  SELECT 1 FROM rapeles_configuracion 
  WHERE marca = '*' 
  AND porcentaje_cumplimiento_min = 80.00 
  AND porcentaje_cumplimiento_max = 99.99
);

INSERT INTO rapeles_configuracion (
  marca, porcentaje_cumplimiento_min, porcentaje_cumplimiento_max, porcentaje_rapel, observaciones, activo
)
SELECT 
  '*' as marca,
  100.00, 119.99, 3.00,
  'Rappel del 3% sobre el exceso cuando el cumplimiento está entre 100% y 119%',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM rapeles_configuracion 
  WHERE marca = '*' 
  AND porcentaje_cumplimiento_min = 100.00 
  AND porcentaje_cumplimiento_max = 119.99
);

INSERT INTO rapeles_configuracion (
  marca, porcentaje_cumplimiento_min, porcentaje_cumplimiento_max, porcentaje_rapel, observaciones, activo
)
SELECT 
  '*' as marca,
  120.00, 999.99, 5.00,
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
