-- =====================================================
-- ALTER: fijos_mensuales_marca -> añadir año/mes y nueva clave única por periodo
-- Estrategia:
-- - Añadimos `año` y `mes` con DEFAULT 0 (0/0 = "global" para ese comercial+marca)
-- - Cambiamos UNIQUE de (comercial_id, marca_id) a (comercial_id, marca_id, año, mes)
-- - Mantiene integridad referencial existente (FKs ya presentes en muchas instalaciones)
-- =====================================================

USE crm_farmadescanso;

-- 1) Añadir columnas (si no existen)
ALTER TABLE `fijos_mensuales_marca`
  ADD COLUMN IF NOT EXISTS `año` INT NOT NULL DEFAULT 0 AFTER `marca_id`,
  ADD COLUMN IF NOT EXISTS `mes` INT NOT NULL DEFAULT 0 AFTER `año`;

-- 2) Rehacer UNIQUE para permitir múltiples periodos
-- (Los nombres pueden variar, ajusta si tu constraint se llama distinto)
ALTER TABLE `fijos_mensuales_marca`
  DROP INDEX `uk_comercial_marca`,
  ADD UNIQUE KEY `uk_comercial_marca_periodo` (`comercial_id`, `marca_id`, `año`, `mes`);

-- 3) Índices útiles para filtros por periodo
ALTER TABLE `fijos_mensuales_marca`
  ADD INDEX `idx_comercial_periodo` (`comercial_id`, `año`, `mes`),
  ADD INDEX `idx_marca_periodo` (`marca_id`, `año`, `mes`);

-- Nota:
-- - Puedes dejar los registros actuales como globales (año=0, mes=0).
-- - Al editar un mes concreto en la app, se insertará/actualizará (año, mes) específico.

