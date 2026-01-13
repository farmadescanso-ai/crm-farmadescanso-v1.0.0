/**
 * Script para buscar un cliente específico por nombre
 */

require('dotenv').config();
const crm = require('../config/mysql-crm');

async function buscarClienteEspecifico() {
  try {
    console.log('🔌 Conectando a la base de datos...');
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener todos los clientes
    console.log('📋 Obteniendo lista de clientes...');
    const clientes = await crm.getClientes();
    console.log(`✅ Obtenidos ${clientes.length} clientes\n`);
    
    // Buscar el cliente específico mencionado
    const busqueda = 'Ramos-Lorca';
    const clientesEncontrados = clientes.filter(cliente => {
      const nombre = (cliente.Nombre || cliente.nombre || '').toLowerCase();
      return nombre.includes(busqueda.toLowerCase());
    });
    
    console.log(`🔍 Buscando clientes que contengan "${busqueda}"...`);
    console.log(`   Encontrados: ${clientesEncontrados.length} clientes\n`);
    
    if (clientesEncontrados.length > 0) {
      clientesEncontrados.forEach((cliente, index) => {
        const nombre = cliente.Nombre || cliente.nombre || '';
        console.log(`${index + 1}. ID: ${cliente.Id || cliente.id}`);
        console.log(`   Nombre completo: "${nombre}"`);
        console.log(`   Empieza con: "${nombre.substring(0, 30)}..."`);
        console.log('');
      });
    } else {
      console.log(`❌ No se encontró ningún cliente con "${busqueda}" en el nombre.`);
      console.log('\n🔍 Buscando variaciones...\n');
      
      // Buscar clientes que empiecen con "Farmacia" o contengan "Ramos"
      const variaciones = clientes.filter(cliente => {
        const nombre = (cliente.Nombre || cliente.nombre || '').toLowerCase();
        return nombre.includes('ramos') || nombre.startsWith('farmacia');
      });
      
      if (variaciones.length > 0) {
        console.log(`Encontrados ${variaciones.length} clientes con variaciones:\n`);
        variaciones.slice(0, 10).forEach((cliente, index) => {
          const nombre = cliente.Nombre || cliente.nombre || '';
          console.log(`${index + 1}. ID: ${cliente.Id || cliente.id}`);
          console.log(`   Nombre: "${nombre}"`);
          console.log('');
        });
      }
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
buscarClienteEspecifico()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });

