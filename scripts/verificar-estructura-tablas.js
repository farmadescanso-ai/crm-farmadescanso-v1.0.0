require('dotenv').config();
const crm = require('../config/mysql-crm');

async function verificarEstructura() {
  try {
    await crm.connect();
    console.log('🔍 Verificando estructura de tablas...\n');

    console.log('📋 Estructura de la tabla PEDIDOS:');
    const estructuraPedidos = await crm.query('DESCRIBE pedidos');
    estructuraPedidos.forEach(col => {
      console.log(`   ${col.Field.padEnd(25)} ${col.Type.padEnd(20)} ${col.Null} ${col.Key} ${col.Default || 'NULL'}`);
    });
    console.log('');

    console.log('📋 Estructura de la tabla PEDIDOS_ARTICULOS:');
    const estructuraLineas = await crm.query('DESCRIBE pedidos_articulos');
    estructuraLineas.forEach(col => {
      console.log(`   ${col.Field.padEnd(25)} ${col.Type.padEnd(20)} ${col.Null} ${col.Key} ${col.Default || 'NULL'}`);
    });
    console.log('');

    // Verificar últimos pedidos
    console.log('📊 Últimos 3 pedidos:');
    const ultimosPedidos = await crm.query('SELECT * FROM pedidos ORDER BY id DESC LIMIT 3');
    if (ultimosPedidos.length > 0) {
      ultimosPedidos.forEach((pedido, idx) => {
        console.log(`\nPedido ${idx + 1}:`);
        Object.keys(pedido).forEach(key => {
          console.log(`   ${key}: ${pedido[key]}`);
        });
      });
    } else {
      console.log('   No hay pedidos en la base de datos');
    }

    // Verificar últimas líneas
    console.log('\n📊 Últimas 3 líneas de pedidos:');
    const ultimasLineas = await crm.query('SELECT * FROM pedidos_articulos ORDER BY Id DESC LIMIT 3');
    if (ultimasLineas.length > 0) {
      ultimasLineas.forEach((linea, idx) => {
        console.log(`\nLínea ${idx + 1}:`);
        Object.keys(linea).forEach(key => {
          console.log(`   ${key}: ${linea[key]}`);
        });
      });
    } else {
      console.log('   No hay líneas en la base de datos');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await crm.disconnect();
  }
}

verificarEstructura();

