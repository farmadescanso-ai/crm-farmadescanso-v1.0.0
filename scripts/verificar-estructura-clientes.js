/**
 * Script para verificar la estructura de la tabla clientes
 */

require('dotenv').config();
const crm = require('../config/mysql-crm');

async function verificarEstructura() {
  try {
    console.log('🔌 Conectando a la base de datos...');
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener algunos clientes
    console.log('📋 Obteniendo algunos clientes de ejemplo...');
    const clientes = await crm.getClientes();
    console.log(`✅ Obtenidos ${clientes.length} clientes\n`);
    
    if (clientes.length > 0) {
      console.log('📝 Estructura del primer cliente:\n');
      const primerCliente = clientes[0];
      console.log('Campos disponibles:');
      Object.keys(primerCliente).forEach(campo => {
        const valor = primerCliente[campo];
        const tipo = typeof valor;
        const muestra = String(valor).substring(0, 50);
        console.log(`  - ${campo}: ${tipo} = "${muestra}${String(valor).length > 50 ? '...' : ''}"`);
      });
      
      console.log('\n📝 Primeros 5 clientes con sus nombres:\n');
      clientes.slice(0, 5).forEach((cliente, index) => {
        console.log(`${index + 1}. ID: ${cliente.Id || cliente.id}`);
        console.log(`   Objeto completo:`, JSON.stringify(cliente, null, 2));
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error en el proceso:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (crm && crm.pool) {
      await crm.disconnect();
      console.log('\n🔌 Desconectado de la base de datos');
    }
  }
}

// Ejecutar el script
verificarEstructura()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });

