// Script para calcular comisiones de Noviembre y Diciembre 2025
// Con fijo de 200€ y comisión según tipo de pedido:
// - Transfer: 5%
// - Directo: 15%

const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');
const calculadorComisiones = require('../utils/calcular-comisiones');

async function calcularComisionesNovDic() {
  try {
    await crm.connect();
    await comisionesCRM.connect();

    console.log('🚀 Iniciando cálculo de comisiones para Noviembre y Diciembre 2025...\n');
    console.log('📋 Parámetros:');
    console.log('   - Fijo mensual: 200€');
    console.log('   - Comisión Transfer: 5%');
    console.log('   - Comisión Directo: 15%\n');

    // Obtener todos los comerciales que tienen pedidos en Noviembre o Diciembre
    const sqlComercialesConPedidos = `
      SELECT DISTINCT p.Id_Cial as comercial_id, c.Nombre, c.Email
      FROM pedidos p
      INNER JOIN comerciales c ON p.Id_Cial = c.id
      WHERE YEAR(p.FechaPedido) = 2025
      AND MONTH(p.FechaPedido) IN (11, 12)
      AND p.EstadoPedido != 'Anulado'
      ORDER BY c.Nombre
    `;

    const comercialesConPedidos = await crm.query(sqlComercialesConPedidos);
    console.log(`📊 Comerciales con pedidos en Nov/Dic: ${comercialesConPedidos.length}\n`);

    if (comercialesConPedidos.length === 0) {
      console.log('⚠️ No se encontraron comerciales con pedidos en Noviembre o Diciembre');
      return;
    }

    // 1. Establecer fijo mensual de 200€ para estos comerciales
    console.log('💰 Estableciendo fijo mensual de 200€...');
    for (const comercial of comercialesConPedidos) {
      try {
        await crm.updateComercial(comercial.comercial_id, { fijo_mensual: 200 });
        console.log(`  ✅ ${comercial.Nombre}: Fijo mensual establecido a 200€`);
      } catch (error) {
        console.error(`  ❌ Error actualizando fijo de ${comercial.Nombre}:`, error.message);
      }
    }
    console.log('');

    // 2. Eliminar condición especial global del 15% si existe (ya no es necesaria)
    // Ahora el cálculo se basa en el tipo de pedido (Transfer: 5%, Directo: 15%)
    console.log('🧹 Limpiando condiciones especiales globales del 15% (ya no necesarias)...');
    try {
      const condicionesExistentes = await comisionesCRM.query(
        'SELECT * FROM condiciones_especiales WHERE comercial_id IS NULL AND articulo_id IS NULL AND porcentaje_comision = 15.00 AND activo = 1'
      );
      if (condicionesExistentes.length > 0) {
        await comisionesCRM.execute(
          'UPDATE condiciones_especiales SET activo = 0 WHERE comercial_id IS NULL AND articulo_id IS NULL AND porcentaje_comision = 15.00'
        );
        console.log(`  ✅ ${condicionesExistentes.length} condición(es) especial(es) desactivada(s)`);
      } else {
        console.log(`  ℹ️ No hay condiciones especiales globales del 15% para desactivar`);
      }
    } catch (error) {
      console.warn(`  ⚠️ Error limpiando condiciones especiales:`, error.message);
    }
    console.log('');

    // 3. Calcular comisiones para Noviembre y Diciembre
    const meses = [11, 12]; // Noviembre y Diciembre
    const año = 2025;

    for (const mes of meses) {
      const nombreMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mes - 1];
      
      console.log(`\n📅 Calculando comisiones para ${nombreMes} ${año}...`);
      console.log('═'.repeat(60));

      for (const comercial of comercialesConPedidos) {
        try {
          console.log(`\n👤 Comercial: ${comercial.Nombre} (ID: ${comercial.comercial_id})`);
          
          // Calcular comisión mensual
          const resultado = await calculadorComisiones.calcularComisionMensual(
            comercial.comercial_id,
            mes,
            año,
            1 // calculado_por: Administrador (ID 1)
          );

          console.log(`  ✅ Comisión calculada:`);
          console.log(`     - Fijo Mensual: € ${parseFloat(resultado.fijo_mensual || 0).toFixed(2)}`);
          console.log(`     - Comisión Ventas: € ${parseFloat(resultado.comision_ventas || 0).toFixed(2)}`);
          console.log(`     - Comisión Presupuesto: € ${parseFloat(resultado.comision_presupuesto || 0).toFixed(2)}`);
          console.log(`     - Total Ventas: € ${parseFloat(resultado.total_ventas || 0).toFixed(2)}`);
          console.log(`     - Total Comisión: € ${parseFloat(resultado.total_comision || 0).toFixed(2)}`);
          console.log(`     - Detalles guardados: ${resultado.detalles?.length || 0}`);

        } catch (error) {
          console.error(`  ❌ Error calculando comisión para ${comercial.Nombre}:`, error.message);
          console.error(`     Stack:`, error.stack);
        }
      }
    }

    console.log('\n\n✅ Cálculo de comisiones completado');
    console.log('═'.repeat(60));
    console.log('\n📋 Resumen:');
    console.log(`   - Comerciales procesados: ${comercialesConPedidos.length}`);
    console.log(`   - Fijo mensual establecido: 200€`);
    console.log(`   - Comisión Transfer: 5% sobre Base Imponible`);
    console.log(`   - Comisión Directo: 15% sobre Base Imponible`);
    console.log(`   - Meses calculados: Noviembre y Diciembre 2025`);

  } catch (error) {
    console.error('❌ Error en el cálculo de comisiones:', error);
    console.error('Stack:', error.stack);
  } finally {
    // Cerrar conexiones
    await crm.disconnect();
    // comisionesCRM usa pool, no necesita desconexión explícita
    console.log('🔌 Desconectado de MySQL');
    process.exit(0);
  }
}

// Ejecutar el script
calcularComisionesNovDic();

