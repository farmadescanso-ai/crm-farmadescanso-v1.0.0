// Script para verificar la comisión por presupuesto después del recálculo
const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');

async function verificar() {
  try {
    await crm.connect();
    await comisionesCRM.connect();

    console.log('📊 Verificando comisiones recalculadas con presupuestos...\n');

    // Obtener todas las comisiones de Noviembre y Diciembre
    const comisiones = await crm.query(`
      SELECT c.*, co.Nombre as comercial_nombre
      FROM comisiones c
      LEFT JOIN comerciales co ON c.comercial_id = co.id
      WHERE c.año = 2025 AND c.mes IN (11, 12)
      ORDER BY c.comercial_id, c.mes
    `);

    for (const comision of comisiones) {
      console.log(`\n👤 ${comision.comercial_nombre} - ${comision.mes === 11 ? 'Noviembre' : 'Diciembre'} 2025:`);
      console.log(`   - Fijo Mensual: €${parseFloat(comision.fijo_mensual || 0).toFixed(2)}`);
      console.log(`   - Comisión Ventas: €${parseFloat(comision.comision_ventas || 0).toFixed(2)}`);
      console.log(`   - Comisión Presupuesto: €${parseFloat(comision.comision_presupuesto || 0).toFixed(2)}`);
      console.log(`   - Total Ventas: €${parseFloat(comision.total_ventas || 0).toFixed(2)}`);
      console.log(`   - Total Comisión: €${parseFloat(comision.total_comision || 0).toFixed(2)}`);

      // Verificar presupuestos del comercial
      const presupuestos = await comisionesCRM.query(
        'SELECT SUM(importe_presupuestado) as total FROM presupuestos WHERE comercial_id = ? AND año = 2025 AND activo = 1',
        [comision.comercial_id]
      );
      const presupuestoAnual = parseFloat(presupuestos[0].total || 0);
      console.log(`   - Presupuesto Anual: €${presupuestoAnual.toFixed(2)}`);

      // Verificar ventas del trimestre
      const trimestre = Math.ceil(comision.mes / 3);
      const mesInicio = (trimestre - 1) * 3 + 1;
      const mesFin = trimestre * 3;
      
      const ventasTrimestre = await crm.query(`
        SELECT SUM(pa.Subtotal) as total
        FROM pedidos p
        JOIN pedidos_articulos pa ON p.id = pa.Id_NumPedido
        WHERE p.Id_Cial = ?
        AND YEAR(p.FechaPedido) = 2025
        AND MONTH(p.FechaPedido) >= ?
        AND MONTH(p.FechaPedido) <= ?
        AND p.EstadoPedido != 'Anulado'
      `, [comision.comercial_id, mesInicio, mesFin]);
      
      const ventasAcumuladas = parseFloat(ventasTrimestre[0].total || 0);
      console.log(`   - Ventas Trimestre ${trimestre} (meses ${mesInicio}-${mesFin}): €${ventasAcumuladas.toFixed(2)}`);
      
      if (presupuestoAnual > 0) {
        const presupuestoTrimestre = presupuestoAnual / 4; // Distribución trimestral
        console.log(`   - Presupuesto Trimestre: €${presupuestoTrimestre.toFixed(2)}`);
        
        if (ventasAcumuladas > presupuestoTrimestre) {
          const comisionEsperada = (ventasAcumuladas * 1) / 100;
          console.log(`   ✅ Supera presupuesto! Comisión esperada: €${comisionEsperada.toFixed(2)}`);
        } else {
          console.log(`   ❌ No supera presupuesto (faltan €${(presupuestoTrimestre - ventasAcumuladas).toFixed(2)})`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await crm.disconnect();
  }
}

verificar();

