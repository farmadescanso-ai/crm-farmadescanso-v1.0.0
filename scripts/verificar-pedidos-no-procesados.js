const crm = require('../config/mysql-crm');

/**
 * Script para verificar qué pedidos no se procesaron en el reordenamiento
 * Identifica pedidos sin fecha o con otros problemas
 */

async function verificarPedidosNoProcesados() {
  try {
    await crm.connect();
    
    console.log('🔍 Verificando pedidos no procesados...\n');
    
    // 1. Obtener TODOS los pedidos (incluyendo los sin fecha)
    console.log('📋 Obteniendo todos los pedidos...');
    const todosLosPedidos = await crm.query(`
      SELECT 
        id,
        NumPedido,
        FechaPedido,
        DATE(FechaPedido) as FechaPedidoDate,
        EstadoPedido,
        Id_Cliente,
        Id_Cial,
        Serie
      FROM pedidos
      ORDER BY id ASC
    `);
    
    console.log(`✅ Total de pedidos en la base de datos: ${todosLosPedidos.length}\n`);
    
    // 2. Separar pedidos con y sin fecha
    const pedidosConFecha = todosLosPedidos.filter(p => p.FechaPedido !== null);
    const pedidosSinFecha = todosLosPedidos.filter(p => p.FechaPedido === null);
    
    console.log('='.repeat(80));
    console.log('📊 ESTADÍSTICAS');
    console.log('='.repeat(80));
    console.log(`✅ Pedidos con fecha: ${pedidosConFecha.length}`);
    console.log(`⚠️  Pedidos sin fecha: ${pedidosSinFecha.length}`);
    console.log(`📋 Total de pedidos: ${todosLosPedidos.length}\n`);
    
    // 3. Verificar si hay pedidos con números fuera del rango esperado
    console.log('🔍 Verificando números de pedidos...');
    const numerosEsperados = Array.from({ length: pedidosConFecha.length }, (_, i) => `P25${String(i + 1).padStart(4, '0')}`);
    const numerosActuales = pedidosConFecha.map(p => p.NumPedido);
    
    const numerosFueraDeRango = numerosActuales.filter(num => !numerosEsperados.includes(num));
    const numerosDuplicados = numerosActuales.filter((num, index) => numerosActuales.indexOf(num) !== index);
    
    if (numerosFueraDeRango.length > 0) {
      console.log(`\n⚠️  Pedidos con números fuera del rango esperado (${numerosFueraDeRango.length}):`);
      numerosFueraDeRango.forEach(num => {
        const pedido = pedidosConFecha.find(p => p.NumPedido === num);
        if (pedido) {
          console.log(`   - ${num} (ID: ${pedido.id}, Fecha: ${pedido.FechaPedido || 'N/A'})`);
        }
      });
    }
    
    if (numerosDuplicados.length > 0) {
      console.log(`\n❌ Pedidos con números duplicados (${numerosDuplicados.length}):`);
      numerosDuplicados.forEach(num => {
        const pedidosDuplicados = pedidosConFecha.filter(p => p.NumPedido === num);
        console.log(`   - ${num}: ${pedidosDuplicados.length} pedidos`);
        pedidosDuplicados.forEach(p => {
          console.log(`     * ID: ${p.id}, Fecha: ${p.FechaPedido || 'N/A'}`);
        });
      });
    }
    
    // 4. Mostrar pedidos sin fecha
    if (pedidosSinFecha.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('⚠️  PEDIDOS SIN FECHA (NO PROCESADOS)');
      console.log('='.repeat(80));
      pedidosSinFecha.forEach((pedido, index) => {
        console.log(`\n${index + 1}. Pedido ID: ${pedido.id}`);
        console.log(`   Número: ${pedido.NumPedido}`);
        console.log(`   Fecha: NULL`);
        console.log(`   Estado: ${pedido.EstadoPedido || 'N/A'}`);
        console.log(`   Serie: ${pedido.Serie || 'N/A'}`);
        console.log(`   Cliente ID: ${pedido.Id_Cliente || 'N/A'}`);
        console.log(`   Comercial ID: ${pedido.Id_Cial || 'N/A'}`);
        
        // Verificar si tiene líneas de pedido
        crm.query('SELECT COUNT(*) as count FROM pedidos_articulos WHERE Id_NumPedido = ?', [pedido.id])
          .then(result => {
            const count = result[0]?.count || 0;
            if (count > 0) {
              console.log(`   ⚠️  Tiene ${count} línea(s) de pedido asociada(s)`);
            }
          })
          .catch(() => {});
      });
    } else {
      console.log('\n✅ No hay pedidos sin fecha');
    }
    
    // 5. Verificar pedidos con fechas pero que podrían tener problemas
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VERIFICACIÓN ADICIONAL');
    console.log('='.repeat(80));
    
    // Pedidos con fecha pero fuera del rango esperado de números
    const pedidosConFechaFueraRango = pedidosConFecha.filter(p => {
      const num = p.NumPedido;
      return !num.startsWith('P25') || !/^P25\d{4}$/.test(num);
    });
    
    if (pedidosConFechaFueraRango.length > 0) {
      console.log(`\n⚠️  Pedidos con fecha pero con formato de número inesperado (${pedidosConFechaFueraRango.length}):`);
      pedidosConFechaFueraRango.forEach(p => {
        console.log(`   - ID: ${p.id}, NumPedido: ${p.NumPedido}, Fecha: ${p.FechaPedido}`);
      });
    }
    
    // 6. Resumen final
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(80));
    console.log(`Total pedidos en BD: ${todosLosPedidos.length}`);
    console.log(`Pedidos procesados (con fecha): ${pedidosConFecha.length}`);
    console.log(`Pedidos NO procesados (sin fecha): ${pedidosSinFecha.length}`);
    console.log(`Diferencia esperada: ${todosLosPedidos.length - pedidosConFecha.length} pedidos\n`);
    
    if (pedidosSinFecha.length > 0) {
      console.log('💡 RECOMENDACIÓN:');
      console.log('   Los pedidos sin fecha no se pueden ordenar cronológicamente.');
      console.log('   Puedes:');
      console.log('   1. Asignarles una fecha manualmente');
      console.log('   2. Eliminarlos si son pedidos de prueba o erróneos');
      console.log('   3. Dejarlos con su número actual si no necesitan reordenarse\n');
    }
    
    await crm.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    await crm.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Ejecutar
verificarPedidosNoProcesados();
