// Script para verificar la estructura de la tabla formas_pago
const crm = require('./config/mysql-crm');

async function verificarEstructura() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Obtener estructura de la tabla
    console.log('🔍 Verificando estructura de la tabla formas_pago...\n');
    const estructura = await crm.query('DESCRIBE formas_pago');
    
    console.log('📋 Columnas de la tabla formas_pago:');
    console.log('═══════════════════════════════════════════════════════════');
    estructura.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) - Null: ${col.Null}, Key: ${col.Key}, Default: ${col.Default}`);
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    // Obtener datos de ejemplo
    console.log('📋 Datos de ejemplo de formas_pago:');
    console.log('═══════════════════════════════════════════════════════════');
    const datos = await crm.query('SELECT * FROM formas_pago LIMIT 5');
    datos.forEach((row, index) => {
      console.log(`\nRegistro ${index + 1}:`);
      Object.keys(row).forEach(key => {
        console.log(`  ${key}: ${row[key]}`);
      });
    });
    console.log('\n═══════════════════════════════════════════════════════════');

    await crm.disconnect();
    console.log('\n✅ Verificación completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

verificarEstructura();

