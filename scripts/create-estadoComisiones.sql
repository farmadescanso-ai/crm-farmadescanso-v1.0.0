USE crm_farmadescanso;

/*
  Tabla de estados de comisiones (1 registro por comisión).
  Estados permitidos:
    - Pendiente
    - Calculado
    - Pagado

  Nota: la aplicación ya usa `comisiones.estado`. Esta tabla sirve para:
    - Normalizar el estado en una entidad propia
    - Garantizar integridad (FK + UNIQUE por comision_id)
    - Auditoría básica (quién/cuándo cambió)
*/

CREATE TABLE IF NOT EXISTS `estadoComisiones` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `comision_id` INT NOT NULL,
  `estado` ENUM('Pendiente','Calculado','Pagado') NOT NULL DEFAULT 'Pendiente',
  `fecha_estado` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_por` INT NULL,
  `notas` TEXT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_estadoComisiones_comision_id` (`comision_id`),
  KEY `idx_estadoComisiones_estado` (`estado`),
  KEY `idx_estadoComisiones_fecha_estado` (`fecha_estado`),
  KEY `idx_estadoComisiones_actualizado_por` (`actualizado_por`),
  CONSTRAINT `fk_estadoComisiones_comision`
    FOREIGN KEY (`comision_id`) REFERENCES `comisiones` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_estadoComisiones_actualizado_por`
    FOREIGN KEY (`actualizado_por`) REFERENCES `comerciales` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed/Backfill: crear un estado por cada comisión existente (idempotente).
INSERT INTO estadoComisiones (comision_id, estado, fecha_estado, actualizado_por, notas)
SELECT
  c.id AS comision_id,
  CASE
    WHEN c.estado IN ('Pagada','Pagado') THEN 'Pagado'
    WHEN c.estado IN ('Calculada','Calculado') THEN 'Calculado'
    ELSE 'Pendiente'
  END AS estado,
  COALESCE(
    -- si existe fecha_pago, úsala como referencia
    CASE WHEN c.fecha_pago IS NULL OR c.fecha_pago = '' THEN NULL ELSE CONCAT(c.fecha_pago, ' 00:00:00') END,
    CURRENT_TIMESTAMP
  ) AS fecha_estado,
  COALESCE(c.pagado_por, c.calculado_por) AS actualizado_por,
  NULL AS notas
FROM comisiones c
ON DUPLICATE KEY UPDATE
  estado = VALUES(estado),
  fecha_estado = VALUES(fecha_estado),
  actualizado_por = VALUES(actualizado_por),
  actualizado_en = CURRENT_TIMESTAMP;

