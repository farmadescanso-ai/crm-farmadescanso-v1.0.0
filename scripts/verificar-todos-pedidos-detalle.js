const crm = require('../config/mysql-crm');

/**
 * Script para verificar todos los pedidos con detalle completo
 * Incluye pedidos cancelados, anulados, etc.
 */

async function verificarTodosPedidos() {
  try {
    await crm.connect();
    
    console.log('🔍 Verificando TODOS los pedidos con detalle completo...\n');
    
    // 1. Obtener TODOS los pedidos sin filtros
    const todosLosPedidos = await crm.query(`
      SELECT 
        id,
        NumPedido,
        FechaPedido,
        EstadoPedido,
        Id_Cliente,
        Id_Cial,
        Serie,
        TotalPedido,
        BaseImponible
      FROM pedidos
      ORDER BY id ASC
    `);
    
    console.log('='.repeat(80));
    console.log('📊 LISTADO COMPLETO DE PEDIDOS');
    console.log('='.repeat(80));
    console.log(`Total de pedidos: ${todosLosPedidos.length}\n`);
    
    // Agrupar por estado
    const porEstado = {};
    todosLosPedidos.forEach(p => {
      const estado = p.EstadoPedido || 'Sin estado';
      if (!porEstado[estado]) {
        porEstado[estado] = [];
      }
      porEstado[estado].push(p);
    });
    
    console.log('📋 Pedidos agrupados por estado:');
    Object.keys(porEstado).forEach(estado => {
      console.log(`   ${estado}: ${porEstado[estado].length} pedido(s)`);
    });
    console.log('');
    
    // Agrupar por fecha
    const conFecha = todosLosPedidos.filter(p => p.FechaPedido !== null);
    const sinFecha = todosLosPedidos.filter(p => p.FechaPedido === null);
    
    console.log('📅 Pedidos por fecha:');
    console.log(`   Con fecha: ${conFecha.length}`);
    console.log(`   Sin fecha: ${sinFecha.length}`);
    console.log('');
    
    // Mostrar todos los pedidos
    console.log('='.repeat(80));
    console.log('📋 LISTADO DETALLADO DE TODOS LOS PEDIDOS');
    console.log('='.repeat(80));
    
    todosLosPedidos.forEach((pedido, index) => {
      console.log(`\n${index + 1}. ID: ${pedido.id}`);
      console.log(`   Número: ${pedido.NumPedido}`);
      console.log(`   Fecha: ${pedido.FechaPedido ? new Date(pedido.FechaPedido).toLocaleDateString('es-ES') : 'NULL'}`);
      console.log(`   Estado: ${pedido.EstadoPedido || 'N/A'}`);
      console.log(`   Serie: ${pedido.Serie || 'N/A'}`);
      console.log(`   Cliente ID: ${pedido.Id_Cliente || 'N/A'}`);
      console.log(`   Comercial ID: ${pedido.Id_Cial || 'N/A'}`);
      console.log(`   Total: €${pedido.TotalPedido || '0.00'}`);
      
      // Verificar líneas
      return crm.query('SELECT COUNT(*) as count FROM pedidos_articulos WHERE Id_NumPedido = ?', [pedido.id])
        .then(result => {
          const count = result[0]?.count || 0;
          console.log(`   Líneas: ${count}`);
        })
        .catch(() => {
          console.log(`   Líneas: Error al obtener`);
        });
    });
    
    // Esperar a que todas las consultas de líneas terminen
    await Promise.all(
      todosLosPedidos.map(pedido => 
        crm.query('SELECT COUNT(*) as count FROM pedidos_articulos WHERE Id_NumPedido = ?', [pedido.id])
          .catch(() => ({ count: 0 }))
      )
    );
    
    // Verificar números de pedidos
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VERIFICACIÓN DE NÚMEROS DE PEDIDOS');
    console.log('='.repeat(80));
    
    const numerosPedidos = todosLosPedidos.map(p => p.NumPedido);
    const numerosUnicos = [...new Set(numerosPedidos)];
    const duplicados = numerosPedidos.filter((num, index) => numerosPedidos.indexOf(num) !== index);
    
    console.log(`Total números únicos: ${numerosUnicos.length}`);
    console.log(`Total pedidos: ${numerosPedidos.length}`);
    
    if (duplicados.length > 0) {
      console.log(`\n❌ Números duplicados encontrados: ${duplicados.length}`);
      const duplicadosUnicos = [...new Set(duplicados)];
      duplicadosUnicos.forEach(num => {
        const pedidosConNum = todosLosPedidos.filter(p => p.NumPedido === num);
        console.log(`   - ${num}: ${pedidosConNum.length} pedido(s)`);
        pedidosConNum.forEach(p => {
          console.log(`     * ID: ${p.id}, Estado: ${p.EstadoPedido || 'N/A'}`);
        });
      });
    } else {
      console.log('✅ No hay números duplicados');
    }
    
    // Verificar rango P250001-P250034
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VERIFICACIÓN DE RANGO P250001-P250034');
    console.log('='.repeat(80));
    
    const numerosEnRango = numerosUnicos.filter(num => {
      const match = num.match(/^P25(\d{4})$/);
      if (!match) return false;
      const numero = parseInt(match[1], 10);
      return numero >= 1 && numero <= 34;
    });
    
    console.log(`Números en rango P250001-P250034: ${numerosEnRango.length}`);
    console.log(`Números esperados: 34`);
    console.log(`Diferencia: ${34 - numerosEnRango.length}`);
    
    if (numerosEnRango.length < 34) {
      console.log('\n📋 Números faltantes en el rango:');
      for (let i = 1; i <= 34; i++) {
        const numEsperado = `P25${String(i).padStart(4, '0')}`;
        if (!numerosUnicos.includes(numEsperado)) {
          console.log(`   - ${numEsperado} (NO EXISTE)`);
        }
      }
    }
    
    // Resumen final
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(80));
    console.log(`Total pedidos en BD: ${todosLosPedidos.length}`);
    console.log(`Pedidos con fecha: ${conFecha.length}`);
    console.log(`Pedidos sin fecha: ${sinFecha.length}`);
    console.log(`Números únicos: ${numerosUnicos.length}`);
    console.log(`Números en rango P250001-P250034: ${numerosEnRango.length}`);
    console.log(`\n💡 CONCLUSIÓN:`);
    if (todosLosPedidos.length === 32) {
      console.log(`   Hay 32 pedidos en la base de datos, no 34.`);
      console.log(`   Puede que 2 pedidos hayan sido eliminados o nunca se crearon.`);
    } else {
      console.log(`   Se encontraron ${todosLosPedidos.length} pedidos.`);
    }
    console.log('');
    
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
verificarTodosPedidos();
