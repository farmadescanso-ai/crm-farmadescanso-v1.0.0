// Rutas para el informe de rentabilidad por pedido
const express = require('express');
const router = express.Router();
const crm = require('../config/mysql-crm');
const calculadorComisiones = require('../utils/calcular-comisiones');

/**
 * PASO 1: Obtener pedidos básicos (sin cálculos complejos)
 */
async function obtenerPedidosBasicos(filtros = {}) {
  try {
    let sql = `
      SELECT 
        p.Id as id,
        p.NumPedido,
        p.FechaPedido,
        p.EstadoPedido,
        p.BaseImponible,
        p.TotalPedido,
        p.TotalIva,
        p.Id_Cial as comercial_id,
        p.Id_Cliente as cliente_id,
        c.Nombre_Razon_Social as cliente_nombre,
        com.Nombre as comercial_nombre,
        tp.Tipo as tipo_pedido
      FROM Pedidos p
      LEFT JOIN Clientes c ON p.Id_Cliente = c.Id
      LEFT JOIN Comerciales com ON p.Id_Cial = com.Id
      LEFT JOIN tipos_pedidos tp ON p.Id_TipoPedido = tp.id
      WHERE p.EstadoPedido != 'Anulado'
    `;
    
    const params = [];
    
    if (filtros.comercial_id) {
      sql += ' AND p.Id_Cial = ?';
      params.push(filtros.comercial_id);
    }
    
    if (filtros.fecha_desde) {
      sql += ' AND DATE(p.FechaPedido) >= ?';
      params.push(filtros.fecha_desde);
    }
    
    if (filtros.fecha_hasta) {
      sql += ' AND DATE(p.FechaPedido) <= ?';
      params.push(filtros.fecha_hasta);
    }
    
    sql += ' ORDER BY p.FechaPedido DESC, p.Id DESC';
    
    const resultado = await crm.query(sql, params);
    const pedidos = Array.isArray(resultado) ? resultado : (resultado?.rows || resultado || []);
    
    return pedidos;
  } catch (error) {
    console.error('❌ Error obteniendo pedidos básicos:', error);
    throw error;
  }
}

/**
 * PASO 2: Obtener líneas de un pedido
 */
async function obtenerLineasPedido(pedidoId) {
  try {
    // Intentar primero con Id_NumPedido
    let sql = `
      SELECT 
        pa.Id_Articulo,
        pa.Cantidad,
        pa.PVP,
        pa.Subtotal,
        a.Nombre as Articulo,
        a.PCP
      FROM Pedidos_Articulos pa
      LEFT JOIN Articulos a ON pa.Id_Articulo = a.Id
      WHERE pa.Id_NumPedido = ?
    `;
    
    let resultado = await crm.query(sql, [pedidoId]);
    let lineas = Array.isArray(resultado) ? resultado : (resultado?.rows || resultado || []);
    
    // Si no hay resultados, intentar con NumPedido
    if (!lineas || lineas.length === 0) {
      // Obtener el NumPedido del pedido
      const pedidoInfo = await crm.query('SELECT NumPedido FROM Pedidos WHERE Id = ?', [pedidoId]);
      const numPedido = pedidoInfo && pedidoInfo.length > 0 ? pedidoInfo[0].NumPedido : null;
      
      if (numPedido) {
        sql = `
          SELECT 
            pa.Id_Articulo,
            pa.Cantidad,
            pa.PVP,
            pa.Subtotal,
            a.Nombre as Articulo,
            a.PCP
          FROM Pedidos_Articulos pa
          LEFT JOIN Articulos a ON pa.Id_Articulo = a.Id
          WHERE pa.NumPedido = ?
        `;
        resultado = await crm.query(sql, [numPedido]);
        lineas = Array.isArray(resultado) ? resultado : (resultado?.rows || resultado || []);
      }
    }
    
    return lineas || [];
  } catch (error) {
    console.error(`❌ Error obteniendo líneas del pedido ${pedidoId}:`, error.message);
    console.error(`❌ Stack:`, error.stack);
    return [];
  }
}

/**
 * PASO 3: Calcular comisión para una línea usando el sistema existente
 */
async function calcularComisionLinea(pedido, linea, baseImponibleTotalPedido) {
  try {
    // Obtener condiciones especiales
    let condicionesEspeciales = [];
    try {
      const resultadoCondiciones = await calculadorComisiones.obtenerCondicionesEspeciales(pedido.comercial_id);
      condicionesEspeciales = Array.isArray(resultadoCondiciones) ? resultadoCondiciones : (resultadoCondiciones?.rows || resultadoCondiciones || []);
    } catch (error) {
      console.warn(`⚠️ Error obteniendo condiciones especiales:`, error.message);
    }
    
    // Determinar porcentaje según tipo de pedido
    const tipoPedidoNombre = (pedido.tipo_pedido || '').toLowerCase().trim();
    let porcentajeComision = 15; // Por defecto 15% (Directo)
    
    if (tipoPedidoNombre.includes('transfer')) {
      porcentajeComision = 5; // 5% para Transfer
    }
    
    // Verificar condición especial
    const articuloId = linea.Id_Articulo;
    const condicionEspecial = condicionesEspeciales.find(c => 
      (c.articulo_id === articuloId || c.articulo_id === null) &&
      (c.comercial_id === pedido.comercial_id || c.comercial_id === null)
    );
    
    if (condicionEspecial) {
      porcentajeComision = parseFloat(condicionEspecial.porcentaje_comision || porcentajeComision);
    }
    
    // Calcular base imponible ajustada (descontando 10% del transporte)
    const totalPedido = parseFloat(pedido.TotalPedido || 0);
    const baseImponiblePedido = parseFloat(pedido.BaseImponible || 0);
    const totalIvaPedido = parseFloat(pedido.TotalIva || 0);
    const transporte = totalPedido - baseImponiblePedido - totalIvaPedido;
    const descuentoTransporte = transporte > 0 ? (transporte * 10) / 100 : 0;
    
    // Calcular proporción de esta línea
    const subtotal = parseFloat(linea.Subtotal || 0);
    let baseImponible = subtotal;
    
    if (baseImponibleTotalPedido > 0 && descuentoTransporte > 0) {
      const proporcion = subtotal / baseImponibleTotalPedido;
      const descuentoLinea = descuentoTransporte * proporcion;
      baseImponible = baseImponible - descuentoLinea;
    }
    
    // Calcular comisión
    const comision = (baseImponible * porcentajeComision) / 100;
    
    return {
      porcentajeComision,
      baseImponible,
      comision
    };
  } catch (error) {
    console.error(`❌ Error calculando comisión para línea:`, error.message);
    return {
      porcentajeComision: 0,
      baseImponible: parseFloat(linea.Subtotal || 0),
      comision: 0
    };
  }
}

/**
 * PASO 4: Calcular rentabilidad para un pedido completo
 */
async function calcularRentabilidadPedido(pedido) {
  try {
    // Obtener líneas del pedido
    const lineas = await obtenerLineasPedido(pedido.id);
    
    if (!lineas || lineas.length === 0) {
      console.warn(`⚠️ Pedido ${pedido.id} no tiene líneas`);
      return {
        ...pedido,
        total_ventas: 0,
        total_costo: 0,
        total_comisiones: 0,
        margen_bruto: 0,
        margen_neto: 0,
        porcentaje_rentabilidad: 0,
        lineas: []
      };
    }
    
    // Calcular base imponible total del pedido para distribuir el descuento
    let baseImponibleTotalPedido = 0;
    for (const linea of lineas) {
      baseImponibleTotalPedido += parseFloat(linea.Subtotal || 0);
    }
    
    let totalVentas = 0;
    let totalCosto = 0;
    let totalComisiones = 0;
    const lineasDetalle = [];
    
    for (const linea of lineas) {
      const articuloId = linea.Id_Articulo;
      if (!articuloId) {
        console.warn(`⚠️ Línea sin artículo ID, saltando:`, linea);
        continue;
      }
      
      const cantidad = parseFloat(linea.Cantidad || 0);
      const subtotal = parseFloat(linea.Subtotal || 0);
      const pcp = parseFloat(linea.PCP || 0);
      
      // Calcular comisión
      const { porcentajeComision, baseImponible, comision } = await calcularComisionLinea(pedido, linea, baseImponibleTotalPedido);
      
      // Calcular costo
      const costoTotal = pcp * cantidad;
      
      // Calcular márgenes
      const margenBruto = baseImponible - costoTotal;
      const margenNeto = margenBruto - comision;
      
      totalVentas += baseImponible;
      totalCosto += costoTotal;
      totalComisiones += comision;
      
      lineasDetalle.push({
        articulo_id: articuloId,
        articulo_nombre: linea.Articulo || 'Artículo desconocido',
        cantidad: cantidad,
        precio_venta: parseFloat(linea.PVP || 0),
        subtotal: subtotal,
        base_imponible: baseImponible,
        pcp: pcp,
        costo_total: costoTotal,
        porcentaje_comision: porcentajeComision,
        comision: comision,
        margen_bruto: margenBruto,
        margen_neto: margenNeto
      });
    }
    
    const margenBrutoTotal = totalVentas - totalCosto;
    const margenNetoTotal = margenBrutoTotal - totalComisiones;
    const porcentajeRentabilidad = totalCosto > 0 ? (margenNetoTotal / totalCosto) * 100 : 0;
    
    return {
      ...pedido,
      total_ventas: totalVentas,
      total_costo: totalCosto,
      total_comisiones: totalComisiones,
      margen_bruto: margenBrutoTotal,
      margen_neto: margenNetoTotal,
      porcentaje_rentabilidad: porcentajeRentabilidad,
      lineas: lineasDetalle
    };
  } catch (error) {
    console.error(`❌ Error calculando rentabilidad del pedido ${pedido.id}:`, error.message);
    console.error(`❌ Stack:`, error.stack);
    return {
      ...pedido,
      total_ventas: 0,
      total_costo: 0,
      total_comisiones: 0,
      margen_bruto: 0,
      margen_neto: 0,
      porcentaje_rentabilidad: 0,
      lineas: []
    };
  }
}

/**
 * FUNCIÓN PRINCIPAL: Obtener rentabilidad de todos los pedidos
 */
async function obtenerRentabilidadPedidos(filtros = {}) {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 [obtenerRentabilidadPedidos] Iniciando con filtros:', JSON.stringify(filtros));
    
    // PASO 1: Obtener pedidos básicos
    console.log('📋 [PASO 1] Obteniendo pedidos básicos...');
    let pedidosBasicos = [];
    try {
      pedidosBasicos = await obtenerPedidosBasicos(filtros);
      console.log(`✅ [PASO 1] Se obtuvieron ${pedidosBasicos.length} pedidos básicos`);
    } catch (error) {
      console.error('❌ [PASO 1] Error obteniendo pedidos básicos:', error.message);
      console.error('❌ Stack:', error.stack);
      throw error;
    }
    
    if (!pedidosBasicos || pedidosBasicos.length === 0) {
      console.log('⚠️ No se encontraron pedidos con los filtros especificados');
      return [];
    }
    
    // PASO 2-4: Calcular rentabilidad para cada pedido
    console.log('💰 [PASO 2-4] Calculando rentabilidad para cada pedido...');
    const pedidosConRentabilidad = [];
    
    for (let index = 0; index < pedidosBasicos.length; index++) {
      const pedido = pedidosBasicos[index];
      try {
        console.log(`  📊 Procesando pedido ${index + 1}/${pedidosBasicos.length} (${pedido.NumPedido || pedido.id})`);
        const pedidoConRentabilidad = await calcularRentabilidadPedido(pedido);
        pedidosConRentabilidad.push(pedidoConRentabilidad);
      } catch (error) {
        console.error(`  ❌ Error procesando pedido ${pedido.id}:`, error.message);
        console.error(`  ❌ Stack:`, error.stack);
        // Agregar pedido con valores por defecto
        pedidosConRentabilidad.push({
          ...pedido,
          total_ventas: 0,
          total_costo: 0,
          total_comisiones: 0,
          margen_bruto: 0,
          margen_neto: 0,
          porcentaje_rentabilidad: 0,
          lineas: []
        });
      }
    }
    
    console.log(`✅ [obtenerRentabilidadPedidos] Se procesaron ${pedidosConRentabilidad.length} pedidos`);
    console.log('═══════════════════════════════════════════════════════════');
    
    return pedidosConRentabilidad;
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ [obtenerRentabilidadPedidos] Error completo:');
    console.error('❌ Mensaje:', error.message);
    console.error('❌ Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════════');
    throw error;
  }
}

/**
 * Obtener detalle completo de rentabilidad de un pedido específico
 */
async function obtenerDetalleRentabilidadPedido(pedidoId) {
  try {
    // Obtener pedido básico
    const pedidosBasicos = await obtenerPedidosBasicos({});
    const pedido = pedidosBasicos.find(p => p.id == pedidoId);
    
    if (!pedido) {
      return null;
    }
    
    // Calcular rentabilidad completa
    return await calcularRentabilidadPedido(pedido);
  } catch (error) {
    console.error('❌ Error obteniendo detalle de rentabilidad de pedido:', error);
    throw error;
  }
}

/**
 * Obtener rentabilidad por comercial
 */
async function obtenerRentabilidadPorComercial(filtros = {}) {
  try {
    const pedidos = await obtenerRentabilidadPedidos(filtros);
    
    // Agrupar por comercial
    const comercialesMap = new Map();
    
    for (const pedido of pedidos) {
      const comercialId = pedido.comercial_id;
      const comercialNombre = pedido.comercial_nombre || 'Sin comercial';
      
      if (!comercialesMap.has(comercialId)) {
        comercialesMap.set(comercialId, {
          comercial_id: comercialId,
          comercial_nombre: comercialNombre,
          total_ventas: 0,
          total_costo: 0,
          total_comisiones: 0,
          margen_bruto: 0,
          margen_neto: 0,
          porcentaje_rentabilidad: 0,
          num_pedidos: 0
        });
      }
      
      const comercial = comercialesMap.get(comercialId);
      comercial.total_ventas += pedido.total_ventas || 0;
      comercial.total_costo += pedido.total_costo || 0;
      comercial.total_comisiones += pedido.total_comisiones || 0;
      comercial.margen_bruto += pedido.margen_bruto || 0;
      comercial.margen_neto += pedido.margen_neto || 0;
      comercial.num_pedidos += 1;
    }
    
    // Calcular porcentaje de rentabilidad para cada comercial
    const comerciales = Array.from(comercialesMap.values()).map(comercial => ({
      ...comercial,
      porcentaje_rentabilidad: comercial.total_costo > 0 
        ? (comercial.margen_neto / comercial.total_costo) * 100 
        : 0
    }));
    
    return comerciales;
  } catch (error) {
    console.error('❌ Error obteniendo rentabilidad por comercial:', error);
    throw error;
  }
}

// Vista principal de rentabilidad por pedido
router.get('/', async (req, res) => {
  try {
    const filtros = {
      comercial_id: req.query.comercial_id || null,
      fecha_desde: req.query.fecha_desde || null,
      fecha_hasta: req.query.fecha_hasta || null
    };
    
    const pedidos = await obtenerRentabilidadPedidos(filtros);
    const comerciales = await crm.getComerciales();
    
    const user = req.comercial || req.session?.comercial || req.user;
    
    res.render('dashboard/ajustes-rentabilidad-pedidos', {
      title: 'Rentabilidad por Pedido - Farmadescaso',
      user: user,
      pedidos: pedidos,
      comerciales: comerciales || [],
      filtros: filtros,
      currentPage: 'ajustes-rentabilidad-pedidos',
      req: req
    });
  } catch (error) {
    console.error('❌ Error en vista de rentabilidad por pedido:', error);
    res.status(500).render('error', {
      error: 'Error cargando rentabilidad',
      message: error.message
    });
  }
});

// Vista de detalle del pedido
router.get('/pedido/:id', async (req, res) => {
  try {
    const pedidoId = req.params.id;
    const pedido = await obtenerDetalleRentabilidadPedido(pedidoId);
    
    if (!pedido) {
      return res.status(404).render('error', {
        error: 'Pedido no encontrado',
        message: 'El pedido solicitado no existe'
      });
    }
    
    const user = req.comercial || req.session?.comercial || req.user;
    
    res.render('dashboard/ajustes-rentabilidad-pedido-detalle', {
      title: `Rentabilidad Pedido ${pedido.NumPedido} - Farmadescaso`,
      user: user,
      pedido: pedido,
      currentPage: 'ajustes-rentabilidad-pedidos',
      req: req
    });
  } catch (error) {
    console.error('❌ Error en vista de detalle de pedido:', error);
    res.status(500).render('error', {
      error: 'Error cargando detalle',
      message: error.message
    });
  }
});

// Vista de rentabilidad por comercial
router.get('/comerciales', async (req, res) => {
  try {
    const filtros = {
      comercial_id: req.query.comercial_id || null,
      fecha_desde: req.query.fecha_desde || null,
      fecha_hasta: req.query.fecha_hasta || null
    };
    
    const comerciales = await obtenerRentabilidadPorComercial(filtros);
    const todosComerciales = await crm.getComerciales();
    
    const user = req.comercial || req.session?.comercial || req.user;
    
    res.render('dashboard/ajustes-rentabilidad-comerciales', {
      title: 'Rentabilidad por Comercial - Farmadescaso',
      user: user,
      comerciales: comerciales,
      todosComerciales: todosComerciales || [],
      filtros: filtros,
      currentPage: 'ajustes-rentabilidad-pedidos',
      req: req
    });
  } catch (error) {
    console.error('❌ Error en vista de rentabilidad por comercial:', error);
    res.status(500).render('error', {
      error: 'Error cargando rentabilidad',
      message: error.message
    });
  }
});

// Exportar las funciones directamente (el router no se usa en server-crm-completo.js)
module.exports = {
  obtenerRentabilidadPedidos,
  obtenerDetalleRentabilidadPedido,
  obtenerRentabilidadPorComercial,
  router // Por si se necesita en el futuro
};
