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

-- Helpers: existe columna / existe índice
SET @sql_has_col := 'SELECT COUNT(*) INTO @c FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?';
SET @sql_has_idx := 'SELECT COUNT(*) INTO @c FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?';

-- =====================================================
-- 1) CLIENTES
-- =====================================================
-- Índices recomendados:
-- - clientes(Id_Cial) para filtrar por comercial
-- - clientes(Id_Provincia) para filtros por provincia
-- - clientes(Id_CodigoPostal) si usas el nuevo sistema de códigos postales
-- - clientes(CodigoPostal) para fallback legacy

-- idx_clientes_id_cial
SET @idx := 'idx_clientes_id_cial';
SET @t := @t_clientes;
SET @col := 'Id_Cial';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- idx_clientes_id_provincia
SET @idx := 'idx_clientes_id_provincia';
SET @col := 'Id_Provincia';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- idx_clientes_id_codigo_postal
SET @idx := 'idx_clientes_id_codigo_postal';
SET @col := 'Id_CodigoPostal';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- idx_clientes_codigo_postal (legacy)
SET @idx := 'idx_clientes_codigo_postal';
SET @col := 'CodigoPostal';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- =====================================================
-- 2) PEDIDOS
-- =====================================================
-- Índices recomendados:
-- - pedidos(Id_Cliente) para joins y búsquedas de pedidos por cliente
-- - pedidos(NumPedido) para resolver pedido por número (PYYxxxx)
-- - pedidos(FechaPedido) para informes por fecha/mes
-- - pedidos(EstadoPedido) para filtros por estado (si existe)

SET @t := @t_pedidos;

-- idx_pedidos_id_cliente
SET @idx := 'idx_pedidos_id_cliente';
SET @col := 'Id_Cliente';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- uk/idx_pedidos_num_pedido (si no existe ya)
SET @idx := 'idx_pedidos_num_pedido';
SET @col := 'NumPedido';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- idx_pedidos_fecha
SET @idx := 'idx_pedidos_fecha';
SET @col := 'FechaPedido';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- idx_pedidos_estado
SET @idx := 'idx_pedidos_estado';
SET @col := 'EstadoPedido';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- =====================================================
-- 3) PEDIDOS_ARTICULOS (líneas)
-- =====================================================
-- Índices recomendados:
-- - pedidos_articulos(Id_NumPedido) para FK por id de pedido (más rápido)
-- - pedidos_articulos(NumPedido) para fallback por número de pedido
-- - pedidos_articulos(Id_Articulo) para joins con artículos

SET @t := @t_pedidos_articulos;

-- idx_pa_id_num_pedido
SET @idx := 'idx_pa_id_num_pedido';
SET @col := 'Id_NumPedido';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- idx_pa_num_pedido
SET @idx := 'idx_pa_num_pedido';
SET @col := 'NumPedido';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- idx_pa_id_articulo
SET @idx := 'idx_pa_id_articulo';
SET @col := 'Id_Articulo';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- =====================================================
-- 4) ARTICULOS / MARCAS
-- =====================================================
-- Índices recomendados:
-- - articulos(Id_Marca) para informes por marca

SET @t := @t_articulos;
SET @idx := 'idx_articulos_id_marca';
SET @col := 'Id_Marca';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- =====================================================
-- 5) COMISIONES / COMISIONES_DETALLE
-- =====================================================
-- Índices recomendados:
-- - comisiones(comercial_id, año, mes) para listados y recalculos
-- - comisiones_detalle(comision_id) para liquidaciones

SET @t := @t_comisiones;
SET @idx := 'idx_comisiones_comercial_periodo';
SET @c := 0;
-- solo si existen columnas
SET @col1 := 'comercial_id';
SET @col2 := 'año';
SET @col3 := 'mes';
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col1; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col2; DEALLOCATE PREPARE hcol;
  IF @c > 0 THEN
    SET @c := 0; PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col3; DEALLOCATE PREPARE hcol;
    IF @c > 0 THEN
      SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
      IF @c = 0 THEN
        SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col1, '`,`', @col2, '`,`', @col3, '`)');
        PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
      END IF;
    END IF;
  END IF;
END IF;

SET @t := @t_comisiones_detalle;
SET @idx := 'idx_comisiones_detalle_comision';
SET @col := 'comision_id';
SET @c := 0;
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
  IF @c = 0 THEN
    SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col, '`)');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END IF;

-- =====================================================
-- 6) TARIFAS
-- =====================================================
-- Índices recomendados:
-- - tarifasClientes_precios(Id_Tarifa, Id_Articulo) para obtener precio por tarifa (muy usado en pedido nuevo/editar)

SET @t := @t_tarifas_precios;
SET @idx := 'idx_tarifa_precio_tarifa_articulo';
SET @c := 0;
SET @col1 := 'Id_Tarifa';
SET @col2 := 'Id_Articulo';
PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col1; DEALLOCATE PREPARE hcol;
IF @c > 0 THEN
  SET @c := 0; PREPARE hcol FROM @sql_has_col; EXECUTE hcol USING @db, @t, @col2; DEALLOCATE PREPARE hcol;
  IF @c > 0 THEN
    SET @c := 0; PREPARE hidx FROM @sql_has_idx; EXECUTE hidx USING @db, @t, @idx; DEALLOCATE PREPARE hidx;
    IF @c = 0 THEN
      SET @sql := CONCAT('CREATE INDEX ', @idx, ' ON `', @t, '` (`', @col1, '`,`', @col2, '`)');
      PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    END IF;
  END IF;
END IF;

-- =====================================================
-- 7) CHECK rápido de duplicados (mayúsculas/minúsculas)
-- =====================================================
-- Si tienes pares duplicados (p.ej. Codigos_Postales y codigos_postales),
-- conviene consolidar a una sola tabla para evitar comportamientos inesperados.
-- Este bloque SOLO muestra conteos para comparar.

SELECT 'codigos_postales' AS tabla, (SELECT COUNT(*) FROM codigos_postales) AS filas
UNION ALL
SELECT 'Codigos_Postales', (SELECT COUNT(*) FROM Codigos_Postales)
UNION ALL
SELECT 'comerciales_codigos_postales_marcas', (SELECT COUNT(*) FROM comerciales_codigos_postales_marcas)
UNION ALL
SELECT 'Comerciales_Codigos_Postales_Marcas', (SELECT COUNT(*) FROM Comerciales_Codigos_Postales_Marcas);

