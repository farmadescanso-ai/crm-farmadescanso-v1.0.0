// Script para verificar pedidos y comisiones por año
const crm = require('../config/mysql-crm-comisiones');

(async () => {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    console.log('🔍 Verificando pedidos por año...\n');
    const pedidosPorAnio = await crm.query(`
      SELECT YEAR(FechaPedido) as año, COUNT(*) as total
      FROM pedidos
      GROUP BY YEAR(FechaPedido)
      ORDER BY año DESC
    `);
    
    console.log('Pedidos por año:');
    pedidosPorAnio.forEach(p => {
      console.log(`  ${p.año}: ${p.total} pedidos`);
    });

    console.log('\n🔍 Verificando comisiones calculadas por año...\n');
    const comisionesPorAnio = await crm.query(`
      SELECT año, 
             COUNT(*) as total, 
             SUM(comision_ventas) as total_ventas, 
             SUM(comision_presupuesto) as total_presupuesto
      FROM comisiones
      GROUP BY año
      ORDER BY año DESC
    `);
    
    if (comisionesPorAnio.length === 0) {
      console.log('  No hay comisiones calculadas aún.\n');
    } else {
      console.log('Comisiones calculadas por año:');
      comisionesPorAnio.forEach(c => {
        console.log(`  ${c.año}: ${c.total} comisiones | Ventas: ${parseFloat(c.total_ventas || 0).toFixed(2)}€ | Presupuesto: ${parseFloat(c.total_presupuesto || 0).toFixed(2)}€`);
      });
    }

    // Verificar pedidos en 2026 por comercial
    console.log('\n🔍 Pedidos en 2026 por comercial:\n');
    const pedidos2026 = await crm.query(`
      SELECT co.id, co.Nombre, COUNT(*) as total_pedidos
      FROM pedidos p
      INNER JOIN comerciales co ON p.Id_Cial = co.id
      WHERE YEAR(p.FechaPedido) = 2026
      GROUP BY co.id, co.Nombre
      ORDER BY total_pedidos DESC
    `);
    
    if (pedidos2026.length === 0) {
      console.log('  No hay pedidos en 2026.\n');
    } else {
      pedidos2026.forEach(p => {
        console.log(`  ${p.Nombre} (ID: ${p.id}): ${p.total_pedidos} pedidos`);
      });
    }

    console.log('\n✅ Verificación completada\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
})();
