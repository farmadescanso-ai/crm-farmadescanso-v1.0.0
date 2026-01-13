// Script para verificar el cálculo de comisión por presupuesto
const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');

async function verificarComisionPresupuesto() {
  try {
    await crm.connect();
    await comisionesCRM.connect();

    const comisionId = 7;
    const comision = await crm.query('SELECT * FROM comisiones WHERE id = ?', [comisionId]);
    
    if (comision.length === 0) {
      console.log('❌ Comisión no encontrada');
      return;
    }

    const c = comision[0];
    console.log('📊 Comisión ID 7:');
    console.log('  Comercial ID:', c.comercial_id);
    console.log('  Mes:', c.mes);
    console.log('  Año:', c.año);
    console.log('  Comisión Presupuesto:', c.comision_presupuesto);
    console.log('  Total Ventas:', c.total_ventas);
    console.log('');

    // Obtener presupuestos
    const presupuestos = await comisionesCRM.query(
      'SELECT * FROM presupuestos WHERE comercial_id = ? AND año = ? AND activo = 1',
      [c.comercial_id, c.año]
    );

    console.log('📋 Presupuestos activos:', presupuestos.length);
    let presupuestoAcumulado = 0;
    presupuestos.forEach(p => {
      console.log(`  - Artículo ID ${p.articulo_id}: €${parseFloat(p.importe_presupuestado || 0).toFixed(2)}`);
      presupuestoAcumulado += parseFloat(p.importe_presupuestado || 0);
    });
    console.log('  Total Presupuesto Acumulado: €' + presupuestoAcumulado.toFixed(2));
    console.log('');

    // Calcular trimestre
    const trimestre = Math.ceil(c.mes / 3);
    const mesInicioTrimestre = (trimestre - 1) * 3 + 1;
    const mesFinTrimestre = trimestre * 3;
    
    console.log(`📅 Trimestre ${trimestre} (meses ${mesInicioTrimestre} a ${mesFinTrimestre})`);

    // Calcular ventas acumuladas del trimestre
    const ventasTrimestre = await crm.query(`
      SELECT SUM(pa.Subtotal) as total
      FROM pedidos p
      JOIN pedidos_articulos pa ON p.id = pa.Id_NumPedido
      WHERE p.Id_Cial = ?
      AND YEAR(p.FechaPedido) = ?
      AND MONTH(p.FechaPedido) >= ?
      AND MONTH(p.FechaPedido) <= ?
      AND p.EstadoPedido != 'Anulado'
    `, [c.comercial_id, c.año, mesInicioTrimestre, mesFinTrimestre]);

    const ventasAcumuladas = parseFloat(ventasTrimestre[0].total || 0);
    console.log('  Ventas acumuladas del trimestre: €' + ventasAcumuladas.toFixed(2));
    console.log('');

    // Verificar si supera el presupuesto
    if (ventasAcumuladas > presupuestoAcumulado) {
      const comisionCalculada = (ventasAcumuladas * 1) / 100;
      console.log('✅ Supera presupuesto!');
      console.log('  Diferencia: €' + (ventasAcumuladas - presupuestoAcumulado).toFixed(2));
      console.log('  Comisión calculada (1% sobre ventas acumuladas): €' + comisionCalculada.toFixed(2));
      console.log('  Comisión registrada: €' + parseFloat(c.comision_presupuesto || 0).toFixed(2));
    } else {
      console.log('❌ No supera presupuesto');
      console.log('  Faltan: €' + (presupuestoAcumulado - ventasAcumuladas).toFixed(2) + ' para alcanzar el presupuesto');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await crm.disconnect();
  }
}

verificarComisionPresupuesto();

