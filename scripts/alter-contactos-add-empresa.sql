-- ============================================================
-- CRM Farmadescanso - Alter contactos: añadir Empresa / Organización
-- Objetivo:
-- - Añadir columna `Empresa` a `contactos`
-- - Añadir índices para acelerar búsquedas
-- - Añadir FULLTEXT para búsqueda rápida (MySQL 8+ / InnoDB)
-- ============================================================

-- 1) Columna (nullable)
ALTER TABLE `contactos`
  ADD COLUMN `Empresa` VARCHAR(180) NULL AFTER `Especialidad`;

-- 2) Índice para ordenaciones/filtrados por empresa
ALTER TABLE `contactos`
  ADD KEY `idx_contactos_empresa` (`Empresa`);

-- 3) FULLTEXT (mejora búsquedas tipo contains en varios campos)
-- Nota: si tu MySQL no soporta FULLTEXT (o ya existe), puede fallar: en ese caso omite este bloque.
ALTER TABLE `contactos`
  ADD FULLTEXT KEY `ft_contactos_busqueda` (`Nombre`, `Apellidos`, `Empresa`, `Email`, `Movil`, `Telefono`);

