// Script para verificar que las comisiones se calcularon correctamente
// con los nuevos parámetros: Transfer 5%, Directo 15%

const crm = require('../config/mysql-crm');

async function verificarComisiones() {
  try {
    await crm.connect();

    console.log('📊 Verificando comisiones recalculadas...\n');

    // Obtener comisión de ejemplo (ID 5 - Diciembre 2025, Jesús Francisco Ros Medina)
    const comision = await crm.query(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM comisiones_detalle WHERE comision_id = c.id) as num_detalles
      FROM comisiones c 
      WHERE c.id = 5
    `);

    if (comision.length > 0) {
      const c = comision[0];
      console.log('✅ Comisión ID 5 (Diciembre 2025):');
      console.log(`   - Comercial: ${c.comercial_id}`);
      console.log(`   - Fijo Mensual: €${parseFloat(c.fijo_mensual || 0).toFixed(2)}`);
      console.log(`   - Comisión Ventas: €${parseFloat(c.comision_ventas || 0).toFixed(2)}`);
      console.log(`   - Total Ventas: €${parseFloat(c.total_ventas || 0).toFixed(2)}`);
      console.log(`   - Total Comisión: €${parseFloat(c.total_comision || 0).toFixed(2)}`);
      console.log(`   - Detalles: ${c.num_detalles}\n`);

      // Obtener algunos detalles para verificar porcentajes
      const detalles = await crm.query(`
        SELECT cd.*, 
               p.NumPedido,
               tp.Tipo as TipoPedido
        FROM comisiones_detalle cd
        LEFT JOIN pedidos p ON cd.pedido_id = p.id
        LEFT JOIN tipos_pedidos tp ON p.Id_TipoPedido = tp.id
        WHERE cd.comision_id = 5
        ORDER BY cd.id
        LIMIT 5
      `);

      console.log('📋 Primeros 5 detalles:');
      detalles.forEach((d, idx) => {
        console.log(`   ${idx + 1}. Pedido ${d.NumPedido} (${d.TipoPedido || 'N/A'}):`);
        console.log(`      - Importe Venta: €${parseFloat(d.importe_venta || 0).toFixed(2)}`);
        console.log(`      - Porcentaje: ${parseFloat(d.porcentaje_comision || 0).toFixed(2)}%`);
        console.log(`      - Comisión: €${parseFloat(d.importe_comision || 0).toFixed(2)}`);
        console.log(`      - Observaciones: ${d.observaciones || 'N/A'}\n`);
      });

      // Verificar distribución de porcentajes
      const distribucion = await crm.query(`
        SELECT 
          COUNT(*) as total,
          porcentaje_comision,
          SUM(importe_venta) as total_ventas,
          SUM(importe_comision) as total_comision
        FROM comisiones_detalle
        WHERE comision_id = 5
        GROUP BY porcentaje_comision
        ORDER BY porcentaje_comision
      `);

      console.log('📊 Distribución de porcentajes aplicados:');
      distribucion.forEach(d => {
        console.log(`   - ${parseFloat(d.porcentaje_comision || 0).toFixed(2)}%: ${d.total} líneas, €${parseFloat(d.total_ventas || 0).toFixed(2)} ventas, €${parseFloat(d.total_comision || 0).toFixed(2)} comisión`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await crm.disconnect();
  }
}

verificarComisiones();

