// Rutas para la vista de comparativa de presupuestos vs ventas
const express = require('express');
const router = express.Router();
const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');

// Middleware de autenticación (se aplicará desde server-crm-completo.js)

// Función helper para verificar si es admin
const isAdmin = (req) => {
  const user = req.comercial || req.session?.comercial;
  const roll = user?.roll || user?.Roll || '';
  return roll.toLowerCase().includes('administrador') || roll.toLowerCase().includes('admin');
};

/**
 * Obtener datos de presupuestos vs ventas por comercial y mes
 */
async function obtenerDatosPresupuestosVentas(comercialId = null, año = null, mesesFiltro = null, mostrarTotales = false) {
  try {
    const añoActual = año || new Date().getFullYear();
    
    // Obtener todos los comerciales (o solo el especificado)
    let comerciales;
    if (comercialId) {
      const comercial = await crm.getComercialById(comercialId);
      comerciales = comercial ? [comercial] : [];
    } else {
      comerciales = await crm.getComerciales();
    }
    
    // Si hay filtro de meses, convertir a array de números
    let mesesAFiltrar = null;
    if (mesesFiltro) {
      if (Array.isArray(mesesFiltro)) {
        mesesAFiltrar = mesesFiltro.map(m => parseInt(m)).filter(m => m >= 1 && m <= 12);
      } else if (typeof mesesFiltro === 'string') {
        mesesAFiltrar = mesesFiltro.split(',').map(m => parseInt(m.trim())).filter(m => m >= 1 && m <= 12);
      }
    }

    const datos = [];

    for (const comercial of comerciales) {
      const comercialId = comercial.id || comercial.Id;
      
      // Obtener presupuestos del comercial para el año
      const presupuestos = await comisionesCRM.getPresupuestos({
        comercial_id: comercialId,
        año: añoActual,
        activo: 1
      });

      // Calcular presupuesto total por mes (suma de todos los artículos)
      const presupuestoPorMes = {};
      
      // Separar presupuestos mensuales y anuales
      const presupuestosMensuales = presupuestos.filter(p => p.mes && p.mes > 0);
      const presupuestosAnuales = presupuestos.filter(p => !p.mes || p.mes === null);
      
      // Procesar presupuestos mensuales
      for (const presupuesto of presupuestosMensuales) {
        const mes = parseInt(presupuesto.mes);
        if (mes >= 1 && mes <= 12) {
          if (!presupuestoPorMes[mes]) {
            presupuestoPorMes[mes] = 0;
          }
          presupuestoPorMes[mes] += parseFloat(presupuesto.importe_presupuestado || 0);
        }
      }
      
      // Procesar presupuestos anuales (distribuir entre los 12 meses)
      for (const presupuesto of presupuestosAnuales) {
        const importeMensual = parseFloat(presupuesto.importe_presupuestado || 0) / 12;
        for (let mes = 1; mes <= 12; mes++) {
          if (!presupuestoPorMes[mes]) {
            presupuestoPorMes[mes] = 0;
          }
          presupuestoPorMes[mes] += importeMensual;
        }
      }

      // Calcular ventas por mes (solo los meses filtrados si hay filtro)
      const mesesACalcular = mesesAFiltrar || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const ventasPorMes = {};
      for (const mes of mesesACalcular) {
        const pedidos = await crm.query(`
          SELECT p.id, p.NumPedido, p.FechaPedido
          FROM pedidos p
          WHERE p.Id_Cial = ?
          AND YEAR(p.FechaPedido) = ?
          AND MONTH(p.FechaPedido) = ?
          AND p.EstadoPedido != 'Anulado'
        `, [comercialId, añoActual, mes]);

        let ventasMes = 0;
        for (const pedido of pedidos) {
          const lineas = await crm.query(
            'SELECT Subtotal FROM pedidos_articulos WHERE Id_NumPedido = ?',
            [pedido.id]
          );
          for (const linea of lineas) {
            ventasMes += parseFloat(linea.Subtotal || 0);
          }
        }
        ventasPorMes[mes] = ventasMes;
      }

      // Calcular porcentaje de cumplimiento por mes (solo meses filtrados)
      const cumplimientoPorMes = {};
      for (const mes of mesesACalcular) {
        const presupuesto = presupuestoPorMes[mes] || 0;
        const ventas = ventasPorMes[mes] || 0;
        const porcentaje = presupuesto > 0 ? (ventas / presupuesto) * 100 : 0;
        cumplimientoPorMes[mes] = {
          presupuesto: presupuesto,
          ventas: ventas,
          porcentaje: porcentaje,
          diferencia: ventas - presupuesto
        };
      }
      
      // Calcular totales si se solicita
      let presupuestoTotal = 0;
      let ventasTotal = 0;
      if (mostrarTotales || mesesAFiltrar) {
        // Si hay filtro de meses, calcular solo para esos meses
        for (const mes of mesesACalcular) {
          presupuestoTotal += presupuestoPorMes[mes] || 0;
          ventasTotal += ventasPorMes[mes] || 0;
        }
      } else {
        // Sin filtro, usar los totales anuales
        presupuestoTotal = presupuestos.reduce((sum, p) => sum + parseFloat(p.importe_presupuestado || 0), 0);
        ventasTotal = Object.values(ventasPorMes).reduce((sum, v) => sum + v, 0);
      }

      datos.push({
        comercial_id: comercialId,
        comercial_nombre: comercial.Nombre || comercial.nombre,
        presupuesto_anual: presupuestos.reduce((sum, p) => sum + parseFloat(p.importe_presupuestado || 0), 0),
        ventas_anuales: Object.values(ventasPorMes).reduce((sum, v) => sum + v, 0),
        presupuesto_filtrado: presupuestoTotal,
        ventas_filtradas: ventasTotal,
        cumplimiento_por_mes: cumplimientoPorMes,
        meses_filtrados: mesesAFiltrar
      });
    }

    return datos;
  } catch (error) {
    console.error('❌ Error obteniendo datos de presupuestos vs ventas:', error);
    throw error;
  }
}

// Vista principal de presupuestos vs ventas
router.get('/', async (req, res) => {
  try {
    const esAdmin = isAdmin(req);
    let comercialId = esAdmin ? (req.query.comercial ? parseInt(req.query.comercial) : null) : (req.comercialId || req.session?.comercialId);
    const año = parseInt(req.query.año) || new Date().getFullYear();
    const mesFiltro = req.query.mes ? parseInt(req.query.mes) : null;
    const mostrarTotales = req.query.totales === 'true' || req.query.totales === '1';

    // Obtener lista de comerciales para el filtro
    const comerciales = await crm.getComerciales();

    // Si hay filtro de mes, convertir a array para la función
    const mesesFiltro = mesFiltro ? [mesFiltro] : null;

    const datos = await obtenerDatosPresupuestosVentas(comercialId, año, mesesFiltro, mostrarTotales);

    res.render('dashboard/presupuestos-vs-ventas', {
      title: 'Presupuestos vs Ventas - Farmadescaso',
      user: req.comercial || req.session.comercial,
      datos: datos,
      comerciales: comerciales,
      año: año,
      comercialFiltro: comercialId,
      mesFiltro: mesFiltro,
      mostrarTotales: mostrarTotales,
      esAdmin: esAdmin,
      currentPage: 'presupuestos-vs-ventas',
      req: req
    });
  } catch (error) {
    console.error('❌ Error en vista presupuestos vs ventas:', error);
    res.status(500).render('error', {
      error: 'Error cargando datos',
      message: error.message
    });
  }
});

module.exports = router;

