/**
 * Script para verificar qué países tienen problemas de codificación UTF-8
 */

const crm = require('../config/mysql-crm');

async function verificarPaises() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await crm.connect();
    
    console.log('📋 Obteniendo todos los países...');
    const paises = await crm.getPaises();
    console.log(`✅ Se encontraron ${paises.length} países\n`);
    
    const problemas = [];
    
    for (const pais of paises) {
      const nombre = pais.Nombre_pais || '';
      // Buscar caracteres mal codificados comunes
      if (nombre.includes('Ã') || nombre.includes('├')) {
        problemas.push({
          id: pais.id,
          codigo: pais.Id_pais,
          nombre: nombre
        });
      }
    }
    
    if (problemas.length > 0) {
      console.log(`⚠️ Se encontraron ${problemas.length} países con posibles problemas de codificación:\n`);
      problemas.forEach(p => {
        console.log(`   ID: ${p.id}, Código: ${p.codigo}, Nombre: "${p.nombre}"`);
      });
    } else {
      console.log('✅ Todos los países tienen codificación UTF-8 correcta');
    }
    
    await crm.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verificarPaises();
