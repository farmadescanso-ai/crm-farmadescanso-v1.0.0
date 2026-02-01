-- ============================================================
-- CRM Farmadescanso - Migración inicial de contactos desde clientes
-- Objetivo:
-- - Crear registros en `contactos` a partir de `clientes.NomContacto`
-- - Vincularlos a cada cliente en `clientes_contactos` (relación activa)
--
-- Importante:
-- - Diseñado para el modelo M:N (un contacto puede estar en varios clientes).
-- - No usamos Movil/Telefono de `clientes` para no provocar colisiones con UNIQUE(MovilNorm).
-- - Email en `clientes` suele ser genérico (info@...), se permite duplicado.
--
-- Requisitos previos:
-- - Ejecutar antes: scripts/crear-contactos-y-clientes_contactos.sql
-- ============================================================

SET @db := DATABASE();

-- 0) Guardas mínimas: comprobar tablas
-- (Si falla, ejecuta primero el script de creación de tablas)
SELECT 1 AS ok FROM `contactos` LIMIT 1;
SELECT 1 AS ok FROM `clientes_contactos` LIMIT 1;

-- 1) Insertar contactos únicos por (NombreKey, EmailKey)
--    - NombreKey: LOWER(TRIM(NomContacto))
--    - EmailKey: LOWER(TRIM(Email)) (puede ser NULL)
--
-- Nota: no tenemos UNIQUE por email/nombre; esta inserción minimiza duplicados.
INSERT INTO `contactos` (`Nombre`, `Apellidos`, `Empresa`, `Email`, `Activo`)
SELECT
  TRIM(c.NomContacto) AS Nombre,
  NULL AS Apellidos,
  NULLIF(MAX(TRIM(COALESCE(c.Nombre_Razon_Social, c.Nombre, ''))), '') AS Empresa,
  NULLIF(TRIM(c.Email), '') AS Email,
  1 AS Activo
FROM `clientes` c
WHERE c.NomContacto IS NOT NULL
  AND TRIM(c.NomContacto) <> ''
  AND UPPER(TRIM(c.NomContacto)) NOT IN ('PENDIENTE', 'NULL', 'N/A', 'NA')
GROUP BY
  LOWER(TRIM(c.NomContacto)),
  LOWER(TRIM(NULLIF(c.Email, '')));

-- 2) Vincular (relación activa) cada cliente a su contacto migrado
--    - Principal = 1 (es lo único que existía en legacy)
--    - Rol = 'Contacto'
INSERT INTO `clientes_contactos` (`Id_Cliente`, `Id_Contacto`, `Rol`, `Es_Principal`, `Notas`)
SELECT
  cli.Id AS Id_Cliente,
  con.Id AS Id_Contacto,
  'Contacto' AS Rol,
  1 AS Es_Principal,
  'Migrado automáticamente desde clientes.NomContacto' AS Notas
FROM `clientes` cli
INNER JOIN `contactos` con
  ON LOWER(TRIM(con.Nombre)) = LOWER(TRIM(cli.NomContacto))
  AND (
    (con.Email IS NULL AND (cli.Email IS NULL OR TRIM(cli.Email) = ''))
    OR (con.Email IS NOT NULL AND cli.Email IS NOT NULL AND LOWER(TRIM(con.Email)) = LOWER(TRIM(cli.Email)))
  )
WHERE cli.NomContacto IS NOT NULL
  AND TRIM(cli.NomContacto) <> ''
  AND UPPER(TRIM(cli.NomContacto)) NOT IN ('PENDIENTE', 'NULL', 'N/A', 'NA')
  AND NOT EXISTS (
    SELECT 1
    FROM `clientes_contactos` cc
    WHERE cc.Id_Cliente = cli.Id
      AND cc.Id_Contacto = con.Id
      AND cc.VigenteHasta IS NULL
  );

-- 3) Reporte rápido
SELECT
  (SELECT COUNT(*) FROM contactos) AS total_contactos,
  (SELECT COUNT(*) FROM clientes_contactos WHERE VigenteHasta IS NULL) AS vinculos_activos;

