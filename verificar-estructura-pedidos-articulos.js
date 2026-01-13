// Script para verificar la estructura de la tabla pedidos_articulos
const crm = require('./config/mysql-crm');

async function verificarEstructura() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Obtener estructura de la tabla pedidos_articulos
    console.log('🔍 Verificando estructura de la tabla pedidos_articulos...\n');
    const estructura = await crm.query('DESCRIBE pedidos_articulos');
    
    console.log('📋 Columnas de la tabla pedidos_articulos:');
    console.log('═══════════════════════════════════════════════════════════');
    estructura.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) - Null: ${col.Null}, Key: ${col.Key}, Default: ${col.Default || 'NULL'}`);
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    // Buscar líneas del pedido 2 usando diferentes nombres de columna posibles
    console.log('🔍 Buscando líneas del pedido 2...\n');
    
    const posiblesColumnas = ['PedidoId', 'Id_Pedido', 'pedido_id', 'Pedido_id', 'IdPedido'];
    
    for (const columna of posiblesColumnas) {
      try {
        const lineas = await crm.query(`SELECT * FROM pedidos_articulos WHERE ${columna} = 2 LIMIT 5`);
        if (lineas && lineas.length > 0) {
          console.log(`✅ Líneas encontradas usando columna "${columna}":`);
          lineas.forEach((linea, index) => {
            console.log(`\nLínea ${index + 1}:`);
            Object.keys(linea).forEach(key => {
              console.log(`  ${key}: ${linea[key]}`);
            });
          });
          break;
        }
      } catch (error) {
        // Continuar con la siguiente columna
      }
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

