// Script para calcular comisiones de todos los meses de un año para un comercial
// Uso: node scripts/calcular-comisiones-todos-meses.js [comercial_id] [año]
// Ejemplo: node scripts/calcular-comisiones-todos-meses.js 1 2026

const calculadorComisiones = require('../utils/calcular-comisiones');
const crm = require('../config/mysql-crm-comisiones');

(async () => {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    const comercialId = process.argv[2] ? parseInt(process.argv[2]) : null;
    const año = process.argv[3] ? parseInt(process.argv[3]) : 2026;

    if (!comercialId) {
      console.log('❌ Debe especificar el ID del comercial');
      console.log('   Uso: node scripts/calcular-comisiones-todos-meses.js [comercial_id] [año]');
      console.log('   Ejemplo: node scripts/calcular-comisiones-todos-meses.js 1 2026');
      await crm.disconnect();
      process.exit(1);
    }

    // Obtener información del comercial
    const comercial = await crm.query('SELECT id, Nombre FROM comerciales WHERE id = ?', [comercialId]);
    if (comercial.length === 0) {
      console.log(`❌ Comercial con ID ${comercialId} no encontrado`);
      await crm.disconnect();
      process.exit(1);
    }

    console.log(`📊 Calculando comisiones para ${comercial[0].Nombre} (ID: ${comercialId}) en ${año}\n`);

    const meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const resultados = [];

    for (const mes of meses) {
      try {
        // Verificar si hay pedidos
        const pedidos = await crm.query(`
          SELECT COUNT(*) as total
          FROM pedidos
          WHERE Id_Cial = ?
          AND YEAR(FechaPedido) = ?
          AND MONTH(FechaPedido) = ?
        `, [comercialId, año, mes]);

        if (pedidos[0]?.total === 0) {
          console.log(`   Mes ${mes}: Sin pedidos (omitido)`);
          continue;
        }

        console.log(`   Mes ${mes}: Calculando...`);
        const resultado = await calculadorComisiones.calcularComisionMensual(
          comercialId,
          mes,
          año,
          1 // Calculado por admin
        );

        resultados.push({
          mes,
          ...resultado
        });

        console.log(`     ✅ Comisión: ${parseFloat(resultado.total_comision || 0).toFixed(2)}€`);
      } catch (error) {
        console.error(`     ❌ Error en mes ${mes}: ${error.message}`);
      }
    }

    console.log('\n📊 Resumen de comisiones calculadas:');
    console.log('═'.repeat(60));
    
    let totalVentas = 0;
    let totalComision = 0;
    
    resultados.forEach(r => {
      totalVentas += parseFloat(r.total_ventas || 0);
      totalComision += parseFloat(r.total_comision || 0);
      console.log(`   Mes ${r.mes.toString().padStart(2, '0')}: ${parseFloat(r.total_comision || 0).toFixed(2).padStart(10, ' ')}€ (Ventas: ${parseFloat(r.total_ventas || 0).toFixed(2)}€)`);
    });

    console.log('═'.repeat(60));
    console.log(`   TOTAL: ${totalComision.toFixed(2).padStart(10, ' ')}€ (Ventas: ${totalVentas.toFixed(2)}€)`);
    console.log(`   Meses calculados: ${resultados.length}/12\n`);

    console.log('✅ Proceso completado');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await crm.disconnect();
    process.exit(0);
  }
})();
