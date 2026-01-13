// Script para probar el cálculo completo de comisión mensual con las nuevas tablas
const calculadorComisiones = require('../utils/calcular-comisiones');

async function test() {
  try {
    console.log('🧪 Test: Calcular comisión mensual completa con nuevo método\n');

    const comercialId = 4; // Cristina Rico
    const mes = 11;
    const año = 2025;

    console.log(`📊 Calcular comisión para comercial ${comercialId}, mes ${mes}/${año}\n`);

    const resultado = await calculadorComisiones.calcularComisionMensual(comercialId, mes, año, 1); // ID 1 = Paco Lara

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RESULTADO DEL CÁLCULO:');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`   💰 Total Ventas: ${resultado.total_ventas?.toFixed(2) || '0.00'}€`);
    console.log(`   💵 Comisión Ventas: ${resultado.comision_ventas?.toFixed(2) || '0.00'}€`);
    console.log(`   📌 Fijo Mensual: ${resultado.fijo_mensual?.toFixed(2) || '0.00'}€`);
    console.log(`   🎯 Rappel Presupuesto: ${resultado.comision_presupuesto?.toFixed(2) || '0.00'}€`);
    console.log(`   ✅ Total Comisión: ${resultado.total_comision?.toFixed(2) || '0.00'}€`);
    console.log(`   📋 Estado: ${resultado.estado || 'N/A'}`);
    console.log('\n═══════════════════════════════════════════════════════════\n');

    if (resultado.detalles && resultado.detalles.length > 0) {
      console.log(`📋 Detalles: ${resultado.detalles.length} líneas procesadas`);
      console.log(`   Ejemplo de porcentajes usados: ${[...new Set(resultado.detalles.map(d => d.porcentaje_comision))].join('%, ')}%`);
    }

    console.log('\n✅ Test completado correctamente\n');

  } catch (error) {
    console.error('❌ Error en test:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

test();
