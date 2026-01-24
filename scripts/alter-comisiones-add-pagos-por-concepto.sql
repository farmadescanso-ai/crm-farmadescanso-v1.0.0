USE crm_farmadescanso;

/*
  Pagos separados por concepto en comisiones mensuales:
  - Ventas (comision_ventas)
  - Fijo mensual (fijo_mensual)

  Motivo:
  - Se pueden pagar en fechas distintas, y necesitamos auditar quién/cuándo paga cada parte.
*/

ALTER TABLE `comisiones`
  ADD COLUMN IF NOT EXISTS `fecha_pago_ventas` DATE NULL AFTER `fecha_pago`,
  ADD COLUMN IF NOT EXISTS `pagado_ventas_por` INT NULL AFTER `fecha_pago_ventas`,
  ADD COLUMN IF NOT EXISTS `fecha_pago_fijo` DATE NULL AFTER `pagado_ventas_por`,
  ADD COLUMN IF NOT EXISTS `pagado_fijo_por` INT NULL AFTER `fecha_pago_fijo`;

-- FKs (si ya existen, ignora el error o ajusta el nombre del constraint)
-- Nota: MySQL/MariaDB no soportan IF NOT EXISTS para ADD CONSTRAINT de forma estándar.
-- Ejecuta estas 2 líneas solo si no existen (compruébalo con SHOW CREATE TABLE comisiones).
-- ALTER TABLE `comisiones` ADD CONSTRAINT `fk_comisiones_pagado_ventas_por` FOREIGN KEY (`pagado_ventas_por`) REFERENCES `comerciales`(`id`) ON DELETE SET NULL;
-- ALTER TABLE `comisiones` ADD CONSTRAINT `fk_comisiones_pagado_fijo_por`  FOREIGN KEY (`pagado_fijo_por`)  REFERENCES `comerciales`(`id`) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS `idx_comisiones_fecha_pago_ventas` ON `comisiones` (`fecha_pago_ventas`);
CREATE INDEX IF NOT EXISTS `idx_comisiones_fecha_pago_fijo`  ON `comisiones` (`fecha_pago_fijo`);

