// Script para verificar la estructura de la tabla pedidos
const crm = require('./config/mysql-crm');

async function verificarEstructura() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Obtener estructura de la tabla pedidos
    console.log('🔍 Verificando estructura de la tabla pedidos...\n');
    const estructura = await crm.query('DESCRIBE pedidos');
    
    console.log('📋 Columnas de la tabla pedidos:');
    console.log('═══════════════════════════════════════════════════════════');
    estructura.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) - Null: ${col.Null}, Key: ${col.Key}, Default: ${col.Default || 'NULL'}`);
      if (col.Null === 'NO' && !col.Default && col.Key !== 'PRI') {
        console.log(`    ⚠️ REQUERIDO SIN DEFAULT`);
      }
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    // Verificar si existe tabla tipos_pedido
    console.log('🔍 Verificando si existe tabla tipos_pedido...\n');
    try {
      const tipos = await crm.query('SELECT * FROM tipos_pedido LIMIT 5');
      console.log('✅ Tabla tipos_pedido existe:');
      tipos.forEach((tipo, index) => {
        console.log(`  ${index + 1}. ID: ${tipo.Id || tipo.id}, Nombre: ${tipo.Nombre || tipo.nombre || tipo.TipoPedido || 'N/A'}`);
      });
    } catch (error) {
      console.log('⚠️ No se encontró tabla tipos_pedido o error:', error.message);
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

