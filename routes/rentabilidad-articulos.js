// Rutas para el informe de rentabilidad de artículos
const express = require('express');
const router = express.Router();
const crm = require('../config/mysql-crm');

// Middleware de autenticación (se aplicará desde server-crm-completo.js)
// const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * Obtener datos de rentabilidad de artículos
 */
async function obtenerRentabilidadArticulos(filtros = {}) {
  try {
    // Calcular el porcentaje de comisiones según las reglas establecidas:
    // - Transfer: 5%
    // - Directo: 15%
    // - Condiciones especiales tienen prioridad
    // Considerando que cada pedido lleva una unidad del artículo
    
    // Primero obtener condiciones especiales
    let sqlCondicionesEspeciales = `
      SELECT 
        ce.articulo_id,
        ce.comercial_id,
        ce.porcentaje_comision
      FROM condiciones_especiales ce
      WHERE ce.activo = 1
        AND ce.porcentaje_comision > 0
    `;
    
    const condicionesEspeciales = await crm.query(sqlCondicionesEspeciales);
    const condicionesMap = new Map();
    condicionesEspeciales.forEach(ce => {
      const key = `${ce.articulo_id || 'null'}_${ce.comercial_id || 'null'}`;
      condicionesMap.set(key, parseFloat(ce.porcentaje_comision) || 0);
    });
    
    // Obtener porcentaje de comisiones por artículo desde pedidos
    // Considerando tipo de pedido y condiciones especiales
    // Prioridad: Condición específica > Condición artículo > Condición comercial > Tipo pedido
    let sqlComisiones = `
      SELECT 
        pa.Id_Articulo as articulo_id,
        p.Id_Cial as comercial_id,
        tp.Tipo as tipo_pedido,
        -- Calcular porcentaje según reglas establecidas:
        CASE 
          -- 1. Prioridad: Condición especial específica (artículo + comercial)
          WHEN ce_especifica.porcentaje_comision IS NOT NULL THEN ce_especifica.porcentaje_comision
          -- 2. Condición especial por artículo (para todos los comerciales)
          WHEN ce_articulo.porcentaje_comision IS NOT NULL THEN ce_articulo.porcentaje_comision
          -- 3. Condición especial por comercial (para todos los artículos)
          WHEN ce_comercial.porcentaje_comision IS NOT NULL THEN ce_comercial.porcentaje_comision
          -- 4. Si es Transfer, 5%
          WHEN LOWER(COALESCE(tp.Tipo, '')) LIKE '%transfer%' THEN 5
          -- 5. Si es Directo o Normal, 15%
          WHEN LOWER(COALESCE(tp.Tipo, '')) LIKE '%directo%' 
            OR LOWER(COALESCE(tp.Tipo, '')) LIKE '%normal%' 
            OR tp.Tipo IS NULL 
            OR tp.Tipo = '' THEN 15
          -- 6. Por defecto 15%
          ELSE 15
        END as porcentaje_comision,
        COUNT(*) as total_ventas
      FROM Pedidos_Articulos pa
      INNER JOIN Pedidos p ON pa.Id_NumPedido = p.Id
      LEFT JOIN tipos_pedidos tp ON p.Id_TipoPedido = tp.id
      -- Condición especial específica (artículo + comercial) - Mayor prioridad
      LEFT JOIN condiciones_especiales ce_especifica ON (
        ce_especifica.articulo_id = pa.Id_Articulo
        AND ce_especifica.comercial_id = p.Id_Cial
        AND ce_especifica.activo = 1
        AND (ce_especifica.fecha_inicio IS NULL OR ce_especifica.fecha_inicio <= CURDATE())
        AND (ce_especifica.fecha_fin IS NULL OR ce_especifica.fecha_fin >= CURDATE())
      )
      -- Condición especial por artículo (para todos los comerciales) - Segunda prioridad
      LEFT JOIN condiciones_especiales ce_articulo ON (
        ce_articulo.articulo_id = pa.Id_Articulo
        AND ce_articulo.comercial_id IS NULL
        AND ce_articulo.activo = 1
        AND (ce_articulo.fecha_inicio IS NULL OR ce_articulo.fecha_inicio <= CURDATE())
        AND (ce_articulo.fecha_fin IS NULL OR ce_articulo.fecha_fin >= CURDATE())
        AND ce_especifica.id IS NULL
      )
      -- Condición especial por comercial (para todos los artículos) - Tercera prioridad
      LEFT JOIN condiciones_especiales ce_comercial ON (
        ce_comercial.articulo_id IS NULL
        AND ce_comercial.comercial_id = p.Id_Cial
        AND ce_comercial.activo = 1
        AND (ce_comercial.fecha_inicio IS NULL OR ce_comercial.fecha_inicio <= CURDATE())
        AND (ce_comercial.fecha_fin IS NULL OR ce_comercial.fecha_fin >= CURDATE())
        AND ce_especifica.id IS NULL
        AND ce_articulo.id IS NULL
      )
      WHERE pa.Id_Articulo IS NOT NULL
        AND pa.Cantidad > 0
        AND p.EstadoPedido != 'Anulado'
      GROUP BY pa.Id_Articulo, p.Id_Cial, tp.Tipo,
               ce_especifica.porcentaje_comision,
               ce_articulo.porcentaje_comision,
               ce_comercial.porcentaje_comision
    `;
    
    const comisionesPorArticulo = await crm.query(sqlComisiones);
    
    // Calcular porcentaje promedio por artículo (promedio de todos los comerciales)
    const comisionesMap = new Map();
    const articulosComisiones = new Map();
    
    comisionesPorArticulo.forEach(item => {
      const articuloId = item.articulo_id;
      const porcentaje = parseFloat(item.porcentaje_comision) || 0;
      const ventas = parseInt(item.total_ventas) || 0;
      
      if (!articulosComisiones.has(articuloId)) {
        articulosComisiones.set(articuloId, { totalPorcentaje: 0, totalVentas: 0 });
      }
      
      const acumulado = articulosComisiones.get(articuloId);
      acumulado.totalPorcentaje += porcentaje * ventas;
      acumulado.totalVentas += ventas;
    });
    
    // Calcular promedio ponderado por artículo
    articulosComisiones.forEach((acumulado, articuloId) => {
      if (acumulado.totalVentas > 0) {
        const promedio = acumulado.totalPorcentaje / acumulado.totalVentas;
        comisionesMap.set(articuloId, promedio);
      }
    });

    // Calcular ventas reales y márgenes desde pedidos grabados
    let sqlVentasReales = `
      SELECT 
        pa.Id_Articulo as articulo_id,
        SUM(pa.Cantidad) as total_cantidad_vendida,
        SUM(pa.Subtotal) as total_ventas,
        AVG(pa.PVP) as precio_venta_promedio,
        -- Calcular porcentaje de comisión según reglas
        AVG(
          CASE 
            WHEN ce_especifica.porcentaje_comision IS NOT NULL THEN ce_especifica.porcentaje_comision
            WHEN ce_articulo.porcentaje_comision IS NOT NULL THEN ce_articulo.porcentaje_comision
            WHEN ce_comercial.porcentaje_comision IS NOT NULL THEN ce_comercial.porcentaje_comision
            WHEN LOWER(COALESCE(tp.Tipo, '')) LIKE '%transfer%' THEN 5
            WHEN LOWER(COALESCE(tp.Tipo, '')) LIKE '%directo%' 
              OR LOWER(COALESCE(tp.Tipo, '')) LIKE '%normal%' 
              OR tp.Tipo IS NULL 
              OR tp.Tipo = '' THEN 15
            ELSE 15
          END
        ) as porcentaje_comision_promedio
      FROM Pedidos_Articulos pa
      INNER JOIN Pedidos p ON pa.Id_NumPedido = p.Id
      LEFT JOIN tipos_pedidos tp ON p.Id_TipoPedido = tp.id
      LEFT JOIN condiciones_especiales ce_especifica ON (
        ce_especifica.articulo_id = pa.Id_Articulo
        AND ce_especifica.comercial_id = p.Id_Cial
        AND ce_especifica.activo = 1
        AND (ce_especifica.fecha_inicio IS NULL OR ce_especifica.fecha_inicio <= CURDATE())
        AND (ce_especifica.fecha_fin IS NULL OR ce_especifica.fecha_fin >= CURDATE())
      )
      LEFT JOIN condiciones_especiales ce_articulo ON (
        ce_articulo.articulo_id = pa.Id_Articulo
        AND ce_articulo.comercial_id IS NULL
        AND ce_articulo.activo = 1
        AND (ce_articulo.fecha_inicio IS NULL OR ce_articulo.fecha_inicio <= CURDATE())
        AND (ce_articulo.fecha_fin IS NULL OR ce_articulo.fecha_fin >= CURDATE())
        AND ce_especifica.id IS NULL
      )
      LEFT JOIN condiciones_especiales ce_comercial ON (
        ce_comercial.articulo_id IS NULL
        AND ce_comercial.comercial_id = p.Id_Cial
        AND ce_comercial.activo = 1
        AND (ce_comercial.fecha_inicio IS NULL OR ce_comercial.fecha_inicio <= CURDATE())
        AND (ce_comercial.fecha_fin IS NULL OR ce_comercial.fecha_fin >= CURDATE())
        AND ce_especifica.id IS NULL
        AND ce_articulo.id IS NULL
      )
      WHERE pa.Id_Articulo IS NOT NULL
        AND pa.Cantidad > 0
        AND pa.Subtotal > 0
        AND p.EstadoPedido != 'Anulado'
      GROUP BY pa.Id_Articulo
    `;
    
    const ventasReales = await crm.query(sqlVentasReales);
    const ventasMap = new Map();
    ventasReales.forEach(venta => {
      ventasMap.set(venta.articulo_id, {
        totalCantidad: parseFloat(venta.total_cantidad_vendida) || 0,
        totalVentas: parseFloat(venta.total_ventas) || 0,
        precioPromedio: parseFloat(venta.precio_venta_promedio) || 0,
        porcentajeComision: parseFloat(venta.porcentaje_comision_promedio) || 0
      });
    });

    // Ahora obtener los artículos con su rentabilidad
    // Usar Id (mayúscula) que es el nombre real de la columna en la BD
    let sql = `
      SELECT 
        a.Id as id,
        a.Nombre,
        a.SKU,
        a.Marca,
        a.PVL,
        a.PCP,
        (a.PVL - COALESCE(a.PCP, 0)) as margen_bruto,
        CASE 
          WHEN a.PCP > 0 THEN ((a.PVL - a.PCP) / a.PCP) * 100
          ELSE 0
        END as porcentaje_rentabilidad,
        CASE 
          WHEN a.PCP > 0 AND a.PVL > a.PCP THEN 'Rentable'
          WHEN a.PCP > 0 AND a.PVL = a.PCP THEN 'Sin Margen'
          WHEN a.PCP > 0 AND a.PVL < a.PCP THEN 'Pérdida'
          ELSE 'Sin PCP'
        END as estado_rentabilidad
      FROM articulos a
      WHERE 1=1
    `;
    const params = [];

    // Filtros
    if (filtros.marca) {
      sql += ' AND a.Marca = ?';
      params.push(filtros.marca);
    }

    if (filtros.solo_con_pcp !== undefined && filtros.solo_con_pcp) {
      sql += ' AND a.PCP IS NOT NULL AND a.PCP > 0';
    }

    if (filtros.estado_rentabilidad) {
      if (filtros.estado_rentabilidad === 'Rentable') {
        sql += ' AND a.PCP > 0 AND a.PVL > a.PCP';
      } else if (filtros.estado_rentabilidad === 'Sin Margen') {
        sql += ' AND a.PCP > 0 AND a.PVL = a.PCP';
      } else if (filtros.estado_rentabilidad === 'Pérdida') {
        sql += ' AND a.PCP > 0 AND a.PVL < a.PCP';
      } else if (filtros.estado_rentabilidad === 'Sin PCP') {
        sql += ' AND (a.PCP IS NULL OR a.PCP = 0)';
      }
    }

    // Ordenamiento
    if (filtros.ordenar_por === 'rentabilidad') {
      sql += ' ORDER BY porcentaje_rentabilidad DESC';
    } else if (filtros.ordenar_por === 'margen') {
      sql += ' ORDER BY margen_bruto DESC';
    } else if (filtros.ordenar_por === 'nombre') {
      sql += ' ORDER BY a.Nombre ASC';
    } else {
      sql += ' ORDER BY porcentaje_rentabilidad DESC, a.Nombre ASC';
    }

    const articulos = await crm.query(sql, params);
    
    // Agregar porcentaje de comisiones y recalcular rentabilidad basado en pedidos reales
    articulos.forEach(articulo => {
      const pvl = parseFloat(articulo.PVL || 0);
      const pcp = parseFloat(articulo.PCP || 0);
      
      // Obtener el ID del artículo (puede ser id o Id)
      const articuloId = articulo.id || articulo.Id || articulo.ID;
      
      // Obtener datos de ventas reales desde pedidos
      const ventasReales = ventasMap.get(Number(articuloId));
      
      // Si hay ventas reales, usar esos datos; si no, usar PVL teórico
      let precioVentaReal = pvl;
      let totalVentasReal = 0;
      let totalCantidadVendida = 0;
      
      if (ventasReales && ventasReales.totalCantidad > 0) {
        precioVentaReal = ventasReales.precioPromedio || pvl;
        totalVentasReal = ventasReales.totalVentas;
        totalCantidadVendida = ventasReales.totalCantidad;
      }
      
      // Calcular margen bruto real (basado en ventas reales o PVL teórico)
      const margenBruto = precioVentaReal - pcp;
      articulo.margen_bruto = margenBruto;
      
      // Obtener porcentaje promedio de comisiones para este artículo
      let porcentajeComisiones = 0;
      if (ventasReales && ventasReales.porcentajeComision > 0) {
        porcentajeComisiones = ventasReales.porcentajeComision;
      } else {
        porcentajeComisiones = articuloId ? (comisionesMap.get(Number(articuloId)) || 0) : 0;
      }
      articulo.porcentaje_comisiones = porcentajeComisiones;
      
      // Calcular margen neto (después de comisiones)
      // Margen Neto = Margen Bruto - (Margen Bruto * % Comisiones / 100)
      const margenNeto = margenBruto - (margenBruto * porcentajeComisiones / 100);
      articulo.margen_neto = margenNeto;
      
      // Agregar información de ventas reales
      articulo.total_ventas_real = totalVentasReal;
      articulo.total_cantidad_vendida = totalCantidadVendida;
      articulo.precio_venta_real = precioVentaReal;
      articulo.tiene_ventas_reales = totalCantidadVendida > 0;
      
      // Recalcular porcentaje de rentabilidad considerando comisiones
      // % Rentabilidad = (Margen Neto / PCP) * 100
      if (pcp > 0) {
        articulo.porcentaje_rentabilidad = (margenNeto / pcp) * 100;
        
        // Actualizar estado de rentabilidad basado en el margen neto
        if (margenNeto > 0) {
          articulo.estado_rentabilidad = 'Rentable';
        } else if (margenNeto === 0) {
          articulo.estado_rentabilidad = 'Sin Margen';
        } else {
          articulo.estado_rentabilidad = 'Pérdida';
        }
      } else {
        articulo.porcentaje_rentabilidad = 0;
        articulo.estado_rentabilidad = 'Sin PCP';
      }
    });
    
    return articulos;
  } catch (error) {
    console.error('❌ Error obteniendo rentabilidad de artículos:', error);
    throw error;
  }
}

/**
 * Obtener marcas únicas para filtros
 */
async function obtenerMarcas() {
  try {
    const sql = 'SELECT DISTINCT Marca FROM articulos WHERE Marca IS NOT NULL AND Marca != "" ORDER BY Marca';
    const marcas = await crm.query(sql);
    return marcas.map(m => m.Marca);
  } catch (error) {
    console.error('❌ Error obteniendo marcas:', error);
    return [];
  }
}

// Vista de rentabilidad de artículos
router.get('/', async (req, res) => {
  console.log('✅ [RENTABILIDAD] Ruta GET / accedida');
  try {
    const filtros = {
      marca: req.query.marca || null,
      solo_con_pcp: req.query.solo_con_pcp === 'true',
      estado_rentabilidad: req.query.estado_rentabilidad || null,
      ordenar_por: req.query.ordenar_por || 'rentabilidad'
    };

    const articulos = await obtenerRentabilidadArticulos(filtros);
    const marcas = await obtenerMarcas();

    // Calcular estadísticas generales
    const totalArticulos = articulos.length;
    const articulosConPCP = articulos.filter(a => a.PCP && a.PCP > 0).length;
    const articulosRentables = articulos.filter(a => a.estado_rentabilidad === 'Rentable').length;
    const articulosConPerdida = articulos.filter(a => a.estado_rentabilidad === 'Pérdida').length;
    const articulosSinPCP = articulos.filter(a => a.estado_rentabilidad === 'Sin PCP').length;

    const margenTotal = articulos.reduce((sum, a) => sum + (parseFloat(a.margen_bruto) || 0), 0);
    const rentabilidadPromedio = articulosConPCP > 0
      ? articulos
          .filter(a => a.PCP && a.PCP > 0)
          .reduce((sum, a) => sum + (parseFloat(a.porcentaje_rentabilidad) || 0), 0) / articulosConPCP
      : 0;

    const user = req.comercial || req.session?.comercial || req.user;
    const roll = user?.roll || user?.Roll || '';
    const esAdmin = roll.toLowerCase().includes('administrador') || roll.toLowerCase().includes('admin');

    res.render('dashboard/rentabilidad-articulos', {
      title: 'Rentabilidad de Artículos - Farmadescaso',
      user: user,
      articulos: articulos,
      marcas: marcas,
      filtros: filtros,
      estadisticas: {
        total: totalArticulos,
        con_pcp: articulosConPCP,
        rentables: articulosRentables,
        con_perdida: articulosConPerdida,
        sin_pcp: articulosSinPCP,
        margen_total: margenTotal,
        rentabilidad_promedio: rentabilidadPromedio
      },
      esAdmin: esAdmin,
      currentPage: 'rentabilidad-articulos',
      req: req
    });
  } catch (error) {
    console.error('❌ Error en vista de rentabilidad:', error);
    res.status(500).render('error', {
      error: 'Error cargando rentabilidad',
      message: error.message
    });
  }
});

module.exports = router;

