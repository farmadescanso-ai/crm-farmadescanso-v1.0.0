-- =====================================================
-- INSERTAR FIJOS MENSUALES POR MARCA PARA 2026
-- =====================================================
-- Configuración:
-- - YOUBELLE: 0€ para todos los comerciales
-- - IALZON: 200€ para todos excepto Paco Lara (ID: 1) que tiene 500€
-- =====================================================

USE farmadescanso;

-- =====================================================
-- 1. INFORMACIÓN DE IDs
-- =====================================================
-- Marcas:
-- - YOUBELLE: marca_id = 1
-- - IALZON: marca_id = 2
--
-- Comerciales:
-- - Paco Lara: comercial_id = 1 (fijo IALZON: 500€)
-- - Resto: comercial_id = 2, 4, 5, 6, 7, 8... (fijo IALZON: 200€)
--   (Incluye: Jesús Francisco Ros (2), Cristina Rico (4), Alberto Torralba (5),
--    Oscar Lirola (6), Gabriel Vargas (7), Antonio Luque (8))

-- =====================================================
-- 2. INSERTAR FIJOS MENSUALES PARA YOUBELLE
-- =====================================================
-- YOUBELLE (marca_id = 1): 0€ para TODOS los comerciales

INSERT INTO fijos_mensuales_marca (comercial_id, marca_id, importe, activo)
SELECT 
  c.id as comercial_id,
  1 as marca_id, -- YOUBELLE (ID: 1)
  0.00 as importe,
  1 as activo
FROM comerciales c
ON DUPLICATE KEY UPDATE
  importe = 0.00,
  activo = 1,
  fecha_actualizacion = CURRENT_TIMESTAMP;

-- =====================================================
-- 3. INSERTAR FIJOS MENSUALES PARA IALZON
-- =====================================================
-- IALZON (marca_id = 2): 200€ para todos EXCEPTO Paco Lara (comercial_id = 1) que tiene 500€

-- Primero: Paco Lara (comercial_id = 1) con 500€
INSERT INTO fijos_mensuales_marca (comercial_id, marca_id, importe, activo)
VALUES (1, 2, 500.00, 1) -- comercial_id = 1 (Paco Lara), marca_id = 2 (IALZON)
ON DUPLICATE KEY UPDATE
  importe = 500.00,
  activo = 1,
  fecha_actualizacion = CURRENT_TIMESTAMP;

-- Segundo: Resto de comerciales con 200€
INSERT INTO fijos_mensuales_marca (comercial_id, marca_id, importe, activo)
SELECT 
  c.id as comercial_id,
  2 as marca_id, -- IALZON (ID: 2)
  200.00 as importe,
  1 as activo
FROM comerciales c
WHERE c.id != 1 -- Excluir Paco Lara (ID: 1)
ON DUPLICATE KEY UPDATE
  importe = 200.00,
  activo = 1,
  fecha_actualizacion = CURRENT_TIMESTAMP;

-- =====================================================
-- VERIFICACIÓN (opcional - comentado)
-- =====================================================
-- Descomenta las siguientes líneas para verificar los datos insertados:

-- SELECT 
--   c.id,
--   c.Nombre as comercial,
--   m.id as marca_id,
--   m.Nombre as marca,
--   fmm.importe,
--   fmm.activo
-- FROM fijos_mensuales_marca fmm
-- INNER JOIN comerciales c ON fmm.comercial_id = c.id
-- INNER JOIN marcas m ON fmm.marca_id = m.id
-- WHERE fmm.activo = 1
-- ORDER BY c.Nombre, m.Nombre;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
