-- Índices recomendados para mejorar rendimiento de /dashboard/clientes y /api/clientes/buscar
-- Objetivo: escalar a 6.000+ clientes sin bloquear varios segundos por request.
--
-- NOTA:
-- - Ejecuta en phpMyAdmin/MySQL.
-- - Si un índice ya existe, MySQL dará error; en ese caso, ignora ese índice concreto.
-- - Antes de ejecutar en producción, revisa el nombre real de columnas/tablas si difiere (Clientes vs clientes).

-- Filtros típicos del listado:
CREATE INDEX idx_clientes_id_cial ON clientes (Id_Cial);
CREATE INDEX idx_clientes_id_provincia ON clientes (Id_Provincia);
CREATE INDEX idx_clientes_id_tipocliente ON clientes (Id_TipoCliente);

-- Estado:
CREATE INDEX idx_clientes_ok_ko ON clientes (OK_KO);

-- Tarifa (FK/int en entornos nuevos):
CREATE INDEX idx_clientes_tarifa ON clientes (Tarifa);

-- Búsqueda rápida / campos frecuentes:
CREATE INDEX idx_clientes_nombre ON clientes (Nombre_Razon_Social);
CREATE INDEX idx_clientes_email ON clientes (Email);
CREATE INDEX idx_clientes_dni_cif ON clientes (DNI_CIF);
CREATE INDEX idx_clientes_codigo_postal ON clientes (CodigoPostal);

-- Si NumeroFarmacia es UNIQUE ya existe un índice implícito. Si no existe:
-- CREATE UNIQUE INDEX uq_clientes_numero_farmacia ON clientes (NumeroFarmacia);

