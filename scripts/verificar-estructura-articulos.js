// Script para verificar la estructura de la tabla Articulos y buscar PCP
const crm = require('../config/mysql-crm');

async function verificarEstructura() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Obtener estructura de la tabla Articulos
    console.log('🔍 Verificando estructura de la tabla Articulos...\n');
    let estructura;
    try {
      estructura = await crm.query('DESCRIBE Articulos');
    } catch (error) {
      console.log('⚠️ Error con nombre capitalizado, intentando minúscula...');
      estructura = await crm.query('DESCRIBE articulos');
    }
    
    console.log('📋 Columnas de la tabla Articulos:');
    console.log('═══════════════════════════════════════════════════════════');
    estructura.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) - Null: ${col.Null}, Key: ${col.Key}, Default: ${col.Default || 'NULL'}`);
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    // Buscar si existe PCP en alguna columna
    const tienePCP = estructura.some(col => col.Field.toLowerCase() === 'pcp');
    console.log(`¿Tiene columna PCP? ${tienePCP ? '✅ SÍ' : '❌ NO'}\n`);

    // Obtener un artículo de ejemplo para ver sus valores
    console.log('🔍 Obteniendo un artículo de ejemplo...\n');
    let articulo;
    try {
      articulo = await crm.query('SELECT * FROM Articulos LIMIT 1');
    } catch (error) {
      articulo = await crm.query('SELECT * FROM articulos LIMIT 1');
    }
    
    if (articulo && articulo.length > 0) {
      console.log('📦 Artículo de ejemplo:');
      console.log('═══════════════════════════════════════════════════════════');
      Object.keys(articulo[0]).forEach(key => {
        console.log(`  ${key}: ${articulo[0][key]}`);
      });
      console.log('═══════════════════════════════════════════════════════════\n');
    }

    // Verificar estructura de Pedidos_Articulos
    console.log('🔍 Verificando estructura de la tabla Pedidos_Articulos...\n');
    let estructuraPA;
    try {
      estructuraPA = await crm.query('DESCRIBE Pedidos_Articulos');
    } catch (error) {
      estructuraPA = await crm.query('DESCRIBE pedidos_articulos');
    }
    
    console.log('📋 Columnas de la tabla Pedidos_Articulos:');
    console.log('═══════════════════════════════════════════════════════════');
    estructuraPA.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) - Null: ${col.Null}, Key: ${col.Key}, Default: ${col.Default || 'NULL'}`);
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    // Obtener una línea de pedido de ejemplo
    console.log('🔍 Obteniendo una línea de pedido de ejemplo...\n');
    let lineaPedido;
    try {
      lineaPedido = await crm.query('SELECT * FROM Pedidos_Articulos LIMIT 1');
    } catch (error) {
      lineaPedido = await crm.query('SELECT * FROM pedidos_articulos LIMIT 1');
    }
    
    if (lineaPedido && lineaPedido.length > 0) {
      console.log('📦 Línea de pedido de ejemplo:');
      console.log('═══════════════════════════════════════════════════════════');
      Object.keys(lineaPedido[0]).forEach(key => {
        console.log(`  ${key}: ${lineaPedido[0][key]}`);
      });
      console.log('═══════════════════════════════════════════════════════════\n');
    }

    await crm.disconnect();
    console.log('\n✅ Verificación completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

verificarEstructura();
