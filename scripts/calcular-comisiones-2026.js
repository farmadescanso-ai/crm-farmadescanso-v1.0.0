// Script para calcular comisiones de 2026
// Uso: node scripts/calcular-comisiones-2026.js [comercial_id] [mes] [año]
// Ejemplo: node scripts/calcular-comisiones-2026.js 1 1 2026

const calculadorComisiones = require('../utils/calcular-comisiones');
const crm = require('../config/mysql-crm-comisiones');

(async () => {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Obtener parámetros de línea de comandos o usar valores por defecto
    const comercialId = process.argv[2] ? parseInt(process.argv[2]) : null;
    const mes = process.argv[3] ? parseInt(process.argv[3]) : null;
    const año = process.argv[4] ? parseInt(process.argv[4]) : 2026;

    // Si no se especifica comercial, listar todos
    if (!comercialId) {
      console.log('📋 Obteniendo lista de comerciales...\n');
      const comerciales = await crm.query('SELECT id, Nombre FROM comerciales ORDER BY id');
      
      if (comerciales.length === 0) {
        console.log('❌ No se encontraron comerciales');
        process.exit(1);
      }

      console.log('Comerciales disponibles:');
      comerciales.forEach(c => console.log(`  ID: ${c.id} - ${c.Nombre}`));
      console.log('\n💡 Uso: node scripts/calcular-comisiones-2026.js [comercial_id] [mes] [año]');
      console.log('   Ejemplo: node scripts/calcular-comisiones-2026.js 1 1 2026\n');
      
      // Verificar si hay pedidos para 2026
      const pedidos = await crm.query(`
        SELECT COUNT(*) as total
        FROM pedidos
        WHERE YEAR(FechaPedido) = ?
      `, [año]);
      
      console.log(`📊 Pedidos en ${año}: ${pedidos[0]?.total || 0}`);
      
      if (pedidos[0]?.total === 0) {
        console.log(`\n⚠️ No hay pedidos en ${año}. No se pueden calcular comisiones.\n`);
      }
      
      await crm.disconnect();
      process.exit(0);
    }

    // Validar mes
    if (!mes || mes < 1 || mes > 12) {
      console.log('❌ Debe especificar un mes válido (1-12)');
      console.log('   Ejemplo: node scripts/calcular-comisiones-2026.js 1 1 2026');
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

    console.log(`📊 Calculando comisiones para:`);
    console.log(`   Comercial: ${comercial[0].Nombre} (ID: ${comercialId})`);
    console.log(`   Período: ${mes}/${año}\n`);

    // Verificar si hay pedidos para este comercial en este período
    const pedidos = await crm.query(`
      SELECT COUNT(*) as total
      FROM pedidos
      WHERE Id_Cial = ?
      AND YEAR(FechaPedido) = ?
      AND MONTH(FechaPedido) = ?
    `, [comercialId, año, mes]);

    console.log(`   Pedidos encontrados: ${pedidos[0]?.total || 0}\n`);

    if (pedidos[0]?.total === 0) {
      console.log('⚠️ No hay pedidos para este comercial en el período especificado.');
      console.log('   No se calculará ninguna comisión.\n');
      await crm.disconnect();
      process.exit(0);
    }

    // Calcular comisión
    console.log('🔄 Calculando comisión...\n');
    const resultado = await calculadorComisiones.calcularComisionMensual(
      comercialId,
      mes,
      año,
      1 // Calculado por admin (ID: 1)
    );

    console.log('✅ Comisión calculada exitosamente\n');
    console.log('📊 Resumen:');
    console.log(`   Comisión de ventas: ${parseFloat(resultado.comision_ventas || 0).toFixed(2)}€`);
    console.log(`   Comisión presupuesto: ${parseFloat(resultado.comision_presupuesto || 0).toFixed(2)}€`);
    console.log(`   Fijo mensual: ${parseFloat(resultado.fijo_mensual || 0).toFixed(2)}€`);
    console.log(`   Total ventas: ${parseFloat(resultado.total_ventas || 0).toFixed(2)}€`);
    console.log(`   Total comisión: ${parseFloat(resultado.total_comision || 0).toFixed(2)}€`);
    console.log(`   Estado: ${resultado.estado || 'Pendiente'}`);
    
    if (resultado.id) {
      console.log(`\n✅ Comisión guardada con ID: ${resultado.id}`);
      console.log(`   Ver en: http://localhost:3000/dashboard/comisiones/comisiones/${resultado.id}`);
    }

    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('\n❌ Error calculando comisión:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await crm.disconnect();
    process.exit(0);
  }
})();
