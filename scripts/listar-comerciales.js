const crm = require('../config/mysql-crm');

async function listarComerciales() {
  try {
    await crm.connect();
    console.log('🔍 Conectado a la base de datos\n');
    
    // Obtener todos los comerciales
    const comerciales = await crm.getComerciales();
    
    console.log(`📊 Total de comerciales encontrados: ${comerciales.length}\n`);
    console.log('='.repeat(80));
    console.log('LISTADO DE COMERCIALES');
    console.log('='.repeat(80));
    
    if (comerciales.length === 0) {
      console.log('⚠️  No se encontraron comerciales en la base de datos.');
    } else {
      comerciales.forEach((comercial, index) => {
        console.log(`\n${index + 1}. ID: ${comercial.id || comercial.Id || 'N/A'}`);
        console.log(`   Nombre: ${comercial.Nombre || comercial.nombre || 'Sin nombre'}`);
        console.log(`   Email: ${comercial.Email || comercial.email || 'Sin email'}`);
        console.log(`   Campos disponibles: ${Object.keys(comercial).join(', ')}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
    // También hacer una consulta directa para ver todos los campos
    console.log('\n📋 Consulta directa a la tabla comerciales:\n');
    const queryDirecta = await crm.query('SELECT * FROM comerciales ORDER BY id ASC');
    console.log(`Total registros: ${queryDirecta.length}`);
    
    if (queryDirecta.length > 0) {
      console.log('\nEstructura del primer registro:');
      console.log(JSON.stringify(queryDirecta[0], null, 2));
    }
    
    await crm.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listarComerciales();

