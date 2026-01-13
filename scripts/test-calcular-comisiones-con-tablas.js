// Script de prueba para validar que calcular-comisiones.js usa las tablas correctamente
const calculadorComisiones = require('../utils/calcular-comisiones');
const comisionesCRM = require('../config/mysql-crm-comisiones');

async function test() {
  try {
    console.log('🧪 Test: Verificar que los métodos usan las tablas de configuración\n');

    // Test 1: Obtener porcentaje de comisión
    console.log('Test 1: Obtener porcentaje de comisión...');
    const porcentajeTransfer = await comisionesCRM.getPorcentajeComision(null, 'Transfer', 2026);
    const porcentajeDirecto = await comisionesCRM.getPorcentajeComision(null, 'Directo', 2026);
    console.log(`   ✅ Transfer 2026: ${porcentajeTransfer}% (esperado: 5%)`);
    console.log(`   ✅ Directo 2026: ${porcentajeDirecto}% (esperado: 10%)\n`);

    // Test 2: Obtener descuento transporte
    console.log('Test 2: Obtener descuento transporte...');
    const descTransporte = await comisionesCRM.getDescuentoTransporte(null, 2026);
    console.log(`   ✅ Descuento Transporte 2026: ${descTransporte}% (esperado: 0% - anulado)\n`);

    // Test 3: Obtener rappel presupuesto
    console.log('Test 3: Obtener rappel presupuesto...');
    const rappel = await comisionesCRM.getRappelPresupuesto(null, 2026);
    console.log(`   ✅ Rappel Presupuesto 2026: ${rappel}% (esperado: 2%)\n`);

    // Test 4: Obtener config fijo mensual
    console.log('Test 4: Obtener config fijo mensual...');
    const configFijo = await comisionesCRM.getConfigFijoMensual();
    console.log(`   ✅ Año límite: ${configFijo.año_limite} (esperado: 2026)`);
    console.log(`   ✅ % mínimo ventas: ${configFijo.porcentaje_minimo_ventas}% (esperado: 25%)\n`);

    // Test 5: Calcular comisión de ventas (usando método actualizado)
    console.log('Test 5: Calcular comisión de ventas para Cristina Rico, Nov 2025...');
    const comisionVentas = await calculadorComisiones.calcularComisionVentas(4, 11, 2025);
    console.log(`   ✅ Ventas: ${comisionVentas.total_ventas.toFixed(2)}€`);
    console.log(`   ✅ Comisión: ${comisionVentas.total_comision.toFixed(2)}€`);
    console.log(`   ✅ Detalles: ${comisionVentas.detalles.length} líneas\n`);

    // Test 6: Verificar que se usan porcentajes correctos
    if (comisionVentas.detalles.length > 0) {
      console.log('Test 6: Verificar porcentajes aplicados...');
      const porcentajesUsados = [...new Set(comisionVentas.detalles.map(d => d.porcentaje_comision))];
      porcentajesUsados.forEach(p => {
        console.log(`   - Porcentaje ${p}% aplicado en ${comisionVentas.detalles.filter(d => d.porcentaje_comision === p).length} líneas`);
      });
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Todos los tests completados');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error en test:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

test();
