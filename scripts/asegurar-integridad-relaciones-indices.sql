-- =====================================================
-- ASEGURAR INTEGRIDAD / ÍNDICES (CRM Farmadescanso)
-- =====================================================
-- Objetivo:
-- - Crear índices críticos (si faltan) para que la aplicación funcione fluida
--   y para mantener coherencia en relaciones (clientes↔pedidos↔líneas, etc.)
-- - Compatible con tablas case-sensitive y columnas que pueden variar (Id vs id).
--
-- IMPORTANTE:
-- - Ejecuta en la BD correcta (p.ej. `crm_farmadescanso`).
-- - Este script NO borra datos ni elimina tablas.
-- - Este script NO crea FKs (por compatibilidad con instalaciones que tienen
--   tablas duplicadas en mayúsculas/minúsculas). Si quieres FKs, lo añadimos
--   una vez normalizada la BD.
-- =====================================================

SET @db := DATABASE();

-- Resolver nombres reales (preferimos minúsculas si existen duplicadas)
SET @t_clientes := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='clientes'
  ORDER BY (table_name='clientes') DESC, table_name ASC
  LIMIT 1
);
SET @t_pedidos := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='pedidos'
  ORDER BY (table_name='pedidos') DESC, table_name ASC
  LIMIT 1
);
SET @t_pedidos_articulos := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='pedidos_articulos'
  ORDER BY (table_name='pedidos_articulos') DESC, table_name ASC
  LIMIT 1
);
SET @t_articulos := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='articulos'
  ORDER BY (table_name='articulos') DESC, table_name ASC
  LIMIT 1
);
SET @t_comerciales := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='comerciales'
  ORDER BY (table_name='comerciales') DESC, table_name ASC
  LIMIT 1
);
SET @t_marcas := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='marcas'
  ORDER BY (table_name='marcas') DESC, table_name ASC
  LIMIT 1
);
SET @t_provincias := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='provincias'
  ORDER BY (table_name='provincias') DESC, table_name ASC
  LIMIT 1
);
SET @t_cp := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='codigos_postales'
  ORDER BY (table_name='codigos_postales') DESC, table_name ASC
  LIMIT 1
);
SET @t_asig := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='comerciales_codigos_postales_marcas'
  ORDER BY (table_name='comerciales_codigos_postales_marcas') DESC, table_name ASC
  LIMIT 1
);
SET @t_comisiones := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='comisiones'
  ORDER BY (table_name='comisiones') DESC, table_name ASC
  LIMIT 1
);
SET @t_comisiones_detalle := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='comisiones_detalle'
  ORDER BY (table_name='comisiones_detalle') DESC, table_name ASC
  LIMIT 1
);
SET @t_tarifas := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='tarifasclientes'
  ORDER BY (table_name='tarifasClientes') DESC, table_name ASC
  LIMIT 1
);
SET @t_tarifas_precios := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)='tarifasclientes_precios'
  ORDER BY (table_name='tarifasClientes_precios') DESC, table_name ASC
  LIMIT 1
);

-- Direcciones de envío (nuevo)
SET @t_direcciones_envio := (
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = @db AND LOWER(table_name)=LOWER('direccionesEnvio')
  ORDER BY (table_name='direccionesEnvio') DESC, table_name ASC
  LIMIT 1
);

-- Helpers (sin IF/THEN): usar variables + SQL dinámico con SELECT IF(...)
-- Nota: CREATE INDEX no soporta IF NOT EXISTS, así que usamos INFORMATION_SCHEMA.

-- =====================================================
-- 1) CLIENTES
-- =====================================================
-- Índices recomendados:
-- - clientes(Id_Cial) para filtrar por comercial
-- - clientes(Id_Provincia) para filtros por provincia
-- - clientes(Id_CodigoPostal) si usas el nuevo sistema de códigos postales
-- - clientes(CodigoPostal) para fallback legacy

SET @t := @t_clientes;

-- idx_clientes_id_cial
SET @idx := 'idx_clientes_id_cial';
SET @col := 'Id_Cial';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_clientes_id_provincia
SET @idx := 'idx_clientes_id_provincia';
SET @col := 'Id_Provincia';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_clientes_id_codigo_postal
SET @idx := 'idx_clientes_id_codigo_postal';
SET @col := 'Id_CodigoPostal';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_clientes_codigo_postal (legacy)
SET @idx := 'idx_clientes_codigo_postal';
SET @col := 'CodigoPostal';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =====================================================
-- 2) PEDIDOS
-- =====================================================
SET @t := @t_pedidos;

-- idx_pedidos_id_cliente
SET @idx := 'idx_pedidos_id_cliente';
SET @col := 'Id_Cliente';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_pedidos_id_direccion_envio (si existe)
SET @idx := 'idx_pedidos_id_direccion_envio';
SET @col := 'Id_DireccionEnvio';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =====================================================
-- 2.1) DIRECCIONES ENVÍO
-- =====================================================
SET @t := @t_direcciones_envio;

-- idx_direcciones_envio_cliente
SET @idx := 'idx_direcciones_envio_cliente';
SET @col := 'Id_Cliente';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_direcciones_envio_cliente_activa
SET @idx := 'idx_direcciones_envio_cliente_activa';
SET @col1 := 'Id_Cliente';
SET @col2 := 'Activa';
SET @has1 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col1);
SET @has2 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col2);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has1>0 AND @has2>0 AND @has_idx=0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col1, '`,`', @col2, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_pedidos_id_cliente_fecha (si existe FechaPedido)
SET @idx := 'idx_pedidos_id_cliente_fecha';
SET @col1 := 'Id_Cliente';
SET @col2 := 'FechaPedido';
SET @has1 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col1);
SET @has2 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col2);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has1>0 AND @has2>0 AND @has_idx=0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col1, '`,`', @col2, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_pedidos_cliente_id (compat: Cliente_id)
SET @idx := 'idx_pedidos_cliente_id';
SET @col := 'Cliente_id';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col>0 AND @has_idx=0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_pedidos_num_pedido
SET @idx := 'idx_pedidos_num_pedido';
SET @col := 'NumPedido';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_pedidos_fecha
SET @idx := 'idx_pedidos_fecha';
SET @col := 'FechaPedido';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_pedidos_estado (si existe)
SET @idx := 'idx_pedidos_estado';
SET @col := 'EstadoPedido';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =====================================================
-- 3) PEDIDOS_ARTICULOS
-- =====================================================
SET @t := @t_pedidos_articulos;

-- idx_pa_id_num_pedido
SET @idx := 'idx_pa_id_num_pedido';
SET @col := 'Id_NumPedido';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_pa_num_pedido
SET @idx := 'idx_pa_num_pedido';
SET @col := 'NumPedido';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_pa_id_articulo
SET @idx := 'idx_pa_id_articulo';
SET @col := 'Id_Articulo';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =====================================================
-- 4) ARTICULOS
-- =====================================================
SET @t := @t_articulos;
SET @idx := 'idx_articulos_id_marca';
SET @col := 'Id_Marca';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col > 0 AND @has_idx = 0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =====================================================
-- 5) COMISIONES / COMISIONES_DETALLE
-- =====================================================
SET @t := @t_comisiones;
SET @idx := 'idx_comisiones_comercial_periodo';
SET @col1 := 'comercial_id';
SET @col2 := 'año';
SET @col3 := 'mes';
SET @has1 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col1);
SET @has2 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col2);
SET @has3 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col3);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has1>0 AND @has2>0 AND @has3>0 AND @has_idx=0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col1, '`,`', @col2, '`,`', @col3, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @t := @t_comisiones_detalle;
SET @idx := 'idx_comisiones_detalle_comision';
SET @col := 'comision_id';
SET @has_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has_col>0 AND @has_idx=0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =====================================================
-- 6) TARIFAS (precios)
-- =====================================================
SET @t := @t_tarifas_precios;
SET @idx := 'idx_tarifa_precio_tarifa_articulo';
SET @col1 := 'Id_Tarifa';
SET @col2 := 'Id_Articulo';
SET @has1 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col1);
SET @has2 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@db AND table_name=@t AND column_name=@col2);
SET @has_idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=@db AND table_name=@t AND index_name=@idx);
SET @sql := (SELECT IF(@t IS NOT NULL AND @has1>0 AND @has2>0 AND @has_idx=0, CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col1, '`,`', @col2, '`)'), 'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =====================================================
-- 7) CHECK rápido de duplicados (mayúsculas/minúsculas)
-- =====================================================
-- Si tienes pares duplicados (p.ej. Codigos_Postales y codigos_postales),
-- conviene consolidar a una sola tabla para evitar comportamientos inesperados.
-- Este bloque SOLO muestra conteos para comparar.

-- Nota:
-- - Si has borrado las tablas duplicadas en MAYÚSCULAS, este bloque NO debe fallar.
-- - MySQL lanzaría #1146 si intentamos contar una tabla que no existe, así que lo resolvemos con SQL dinámico.
SET @has_cp_upper := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = @db AND table_name = 'Codigos_Postales'
);
SET @has_asig_upper := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = @db AND table_name = 'Comerciales_Codigos_Postales_Marcas'
);

SET @sql := CONCAT(
  "SELECT 'codigos_postales' AS tabla, ",
  IF(@t_cp IS NOT NULL, CONCAT("(SELECT COUNT(*) FROM `", @t_cp, "`)"), "0"),
  " AS filas ",
  "UNION ALL ",
  IF(@has_cp_upper > 0,
    "SELECT 'Codigos_Postales' AS tabla, (SELECT COUNT(*) FROM `Codigos_Postales`) AS filas ",
    "SELECT 'Codigos_Postales' AS tabla, 0 AS filas "
  ),
  "UNION ALL ",
  "SELECT 'comerciales_codigos_postales_marcas' AS tabla, ",
  IF(@t_asig IS NOT NULL, CONCAT("(SELECT COUNT(*) FROM `", @t_asig, "`)"), "0"),
  " AS filas ",
  "UNION ALL ",
  IF(@has_asig_upper > 0,
    "SELECT 'Comerciales_Codigos_Postales_Marcas' AS tabla, (SELECT COUNT(*) FROM `Comerciales_Codigos_Postales_Marcas`) AS filas ",
    "SELECT 'Comerciales_Codigos_Postales_Marcas' AS tabla, 0 AS filas "
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

