-- =====================================================
-- MEJORAR RELACIONES CON COMISIONES PARA LIQUIDAR POR CÓDIGO POSTAL
-- =====================================================
-- Este script mejora las relaciones entre comisiones y códigos postales
-- para permitir liquidar comisiones por código postal
-- =====================================================

USE farmadescanso;

-- =====================================================
-- 1. AÑADIR ÍNDICES PARA MEJORAR CONSULTAS DE COMISIONES POR CÓDIGO POSTAL
-- =====================================================

-- Índice en Pedidos para mejorar consultas por cliente y código postal
SET @dbname = DATABASE();
SET @tablename = 'Pedidos';
SET @indexname = 'idx_pedidos_cliente_codigo_postal';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, ' (Id_Cliente, Id_Cial)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- =====================================================
-- 2. VISTA PARA COMISIONES POR CÓDIGO POSTAL
-- =====================================================
-- Vista que relaciona comisiones con códigos postales a través de clientes

CREATE OR REPLACE VIEW `v_comisiones_por_codigo_postal` AS
SELECT 
    c.id AS Id_Comision,
    c.comercial_id AS Id_Comercial,
    com.Nombre AS NombreComercial,
    c.mes,
    c.año,
    cp.id AS Id_CodigoPostal,
    cp.CodigoPostal,
    cp.Localidad,
    cp.Provincia,
    COUNT(DISTINCT p.id) AS TotalPedidos,
    COUNT(DISTINCT cl.id) AS TotalClientes,
    SUM(COALESCE(p.Total, 0)) AS TotalVentas,
    SUM(COALESCE(cd.importe_comision, 0)) AS TotalComision
FROM comisiones c
INNER JOIN comerciales com ON c.comercial_id = com.id
INNER JOIN pedidos p ON p.Id_Cial = c.comercial_id
INNER JOIN clientes cl ON p.Id_Cliente = cl.id
INNER JOIN codigos_postales cp ON cl.Id_CodigoPostal = cp.id
LEFT JOIN comisiones_detalle cd ON cd.comision_id = c.id AND cd.pedido_id = p.id
WHERE YEAR(p.FechaPedido) = c.año
  AND MONTH(p.FechaPedido) = c.mes
GROUP BY c.id, cp.id, cp.CodigoPostal, cp.Localidad, cp.Provincia
ORDER BY c.año DESC, c.mes DESC, cp.Provincia, cp.Localidad;

-- =====================================================
-- 3. VISTA PARA ASIGNACIONES Y COMISIONES
-- =====================================================
-- Vista que muestra las asignaciones de códigos postales y las comisiones relacionadas

CREATE OR REPLACE VIEW `v_asignaciones_comisiones` AS
SELECT 
    ccp.id AS Id_Asignacion,
    ccp.Id_Comercial,
    c.Nombre AS NombreComercial,
    ccp.Id_CodigoPostal,
    cp.CodigoPostal,
    cp.Localidad,
    cp.Provincia,
    ccp.Id_Marca,
    m.Nombre AS NombreMarca,
    ccp.FechaInicio,
    ccp.FechaFin,
    ccp.Prioridad,
    ccp.Activo,
    COUNT(DISTINCT cl.id) AS TotalClientes,
    COUNT(DISTINCT p.id) AS TotalPedidos,
    SUM(COALESCE(p.Total, 0)) AS TotalVentas
FROM Comerciales_Codigos_Postales_Marcas ccp
INNER JOIN Comerciales c ON ccp.Id_Comercial = c.id
INNER JOIN Codigos_Postales cp ON ccp.Id_CodigoPostal = cp.id
INNER JOIN Marcas m ON ccp.Id_Marca = m.id
LEFT JOIN Clientes cl ON cl.Id_CodigoPostal = cp.id AND cl.Id_Cial = ccp.Id_Comercial
LEFT JOIN Pedidos p ON p.Id_Cliente = cl.id AND p.Id_Cial = ccp.Id_Comercial
WHERE ccp.Activo = 1
GROUP BY ccp.id, ccp.Id_Comercial, ccp.Id_CodigoPostal, ccp.Id_Marca
ORDER BY cp.Provincia, cp.Localidad, m.Nombre, ccp.Prioridad DESC;

-- =====================================================
-- 4. FUNCIÓN AUXILIAR: OBTENER COMISIONES POR CÓDIGO POSTAL Y MARCA
-- =====================================================
-- Esta consulta puede usarse para liquidar comisiones por código postal

-- Ejemplo de consulta para liquidar comisiones por código postal:
/*
SELECT 
    cp.CodigoPostal,
    cp.Localidad,
    cp.Provincia,
    m.Nombre AS Marca,
    c.Nombre AS Comercial,
    COUNT(DISTINCT p.id) AS TotalPedidos,
    SUM(COALESCE(p.Total, 0)) AS TotalVentas,
    SUM(COALESCE(cd.importe_comision, 0)) AS TotalComision
FROM comisiones com
INNER JOIN comerciales c ON com.comercial_id = c.id
INNER JOIN Comerciales_Codigos_Postales_Marcas ccp ON ccp.Id_Comercial = c.id
INNER JOIN Codigos_Postales cp ON ccp.Id_CodigoPostal = cp.id
INNER JOIN Marcas m ON ccp.Id_Marca = m.id
INNER JOIN Clientes cl ON cl.Id_CodigoPostal = cp.id AND cl.Id_Cial = c.id
INNER JOIN Pedidos p ON p.Id_Cliente = cl.id AND p.Id_Cial = c.id
LEFT JOIN comisiones_detalle cd ON cd.comision_id = com.id AND cd.pedido_id = p.id
WHERE com.mes = ?
  AND com.año = ?
  AND com.estado = 'Calculada'
  AND ccp.Activo = 1
GROUP BY cp.CodigoPostal, cp.Localidad, cp.Provincia, m.Nombre, c.Nombre
ORDER BY cp.Provincia, cp.Localidad, m.Nombre;
*/

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
