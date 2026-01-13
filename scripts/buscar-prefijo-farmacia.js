/**
 * Script para buscar clientes que contengan "Farmacia" en el nombre
 * para identificar el formato exacto del prefijo
 */

require('dotenv').config();
const crm = require('../config/mysql-crm');

async function buscarPrefijoFarmacia() {
  try {
    console.log('🔌 Conectando a la base de datos...');
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener todos los clientes
    console.log('📋 Obteniendo lista de clientes...');
    const clientes = await crm.getClientes();
    console.log(`✅ Obtenidos ${clientes.length} clientes\n`);
    
    // Buscar clientes que contengan "Farmacia" en el nombre
    const clientesConFarmacia = clientes.filter(cliente => {
      const nombre = (cliente.Nombre || cliente.nombre || '').toLowerCase();
      return nombre.includes('farmacia');
    });
    
    console.log(`🔍 Encontrados ${clientesConFarmacia.length} clientes que contienen "Farmacia" en el nombre\n`);
    
    if (clientesConFarmacia.length > 0) {
      console.log('📝 Primeros 20 clientes encontrados:\n');
      clientesConFarmacia.slice(0, 20).forEach((cliente, index) => {
        const nombre = cliente.Nombre || cliente.nombre || '';
        console.log(`${index + 1}. ID: ${cliente.Id || cliente.id}`);
        console.log(`   Nombre: "${nombre}"`);
        console.log(`   Longitud: ${nombre.length} caracteres`);
        console.log(`   Empieza con: "${nombre.substring(0, 15)}..."`);
        console.log('');
      });
      
      // Buscar variaciones del prefijo
      console.log('\n🔍 Analizando variaciones del prefijo:\n');
      const variaciones = new Set();
      clientesConFarmacia.forEach(cliente => {
        const nombre = cliente.Nombre || cliente.nombre || '';
        if (nombre.toLowerCase().startsWith('farmacia')) {
          const primerosCaracteres = nombre.substring(0, 20);
          variaciones.add(primerosCaracteres);
        }
      });
      
      console.log('Variaciones encontradas:');
      Array.from(variaciones).sort().forEach((variacion, index) => {
        console.log(`${index + 1}. "${variacion}"`);
      });
    } else {
      console.log('✅ No se encontraron clientes con "Farmacia" en el nombre.');
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
buscarPrefijoFarmacia()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });

