/**
 * Script para monitorear el proceso de scraping de Badajoz y Cáceres
 * Verifica periódicamente si el proceso ha terminado
 */

const crm = require('../config/mysql-crm');

let estadoAnterior = {
  badajoz: 0,
  caceres: 0,
  badajozConCIF: 0,
  caceresConCIF: 0
};

async function verificarEstado() {
  try {
    await crm.connect();
    
    // Badajoz
    const badajozTotal = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '06%'
    `);
    
    const badajozConCIF = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '06%'
         AND DNI_CIF IS NOT NULL 
         AND DNI_CIF != ''
    `);
    
    // Cáceres
    const caceresTotal = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '10%'
    `);
    
    const caceresConCIF = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '10%'
         AND DNI_CIF IS NOT NULL 
         AND DNI_CIF != ''
    `);
    
    const ahora = {
      badajoz: badajozTotal[0].total,
      caceres: caceresTotal[0].total,
      badajozConCIF: badajozConCIF[0].total,
      caceresConCIF: caceresConCIF[0].total
    };
    
    const cambios = {
      badajoz: ahora.badajoz - estadoAnterior.badajoz,
      caceres: ahora.caceres - estadoAnterior.caceres,
      badajozConCIF: ahora.badajozConCIF - estadoAnterior.badajozConCIF,
      caceresConCIF: ahora.caceresConCIF - estadoAnterior.caceresConCIF
    };
    
    const hora = new Date().toLocaleTimeString('es-ES');
    console.log(`\n[${hora}] Estado actual:`);
    console.log(`   Badajoz: ${ahora.badajoz} clínicas (${ahora.badajozConCIF} con CIF/DNI)`);
    console.log(`   Cáceres: ${ahora.caceres} clínicas (${ahora.caceresConCIF} con CIF/DNI)`);
    
    if (cambios.badajoz > 0 || cambios.caceres > 0) {
      console.log(`   📈 Cambios: +${cambios.badajoz} Badajoz, +${cambios.caceres} Cáceres`);
    }
    
    estadoAnterior = ahora;
    
    await crm.disconnect();
    
    return ahora;
    
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

async function monitorear() {
  console.log('🔍 Iniciando monitoreo del proceso de scraping de Badajoz y Cáceres...');
  console.log('   Verificando cada 3 minutos. Presiona Ctrl+C para detener.\n');
  
  let iteracion = 0;
  const maxIteraciones = 200; // Máximo 10 horas
  
  while (iteracion < maxIteraciones) {
    iteracion++;
    const estado = await verificarEstado();
    
    // Esperar 3 minutos
    await new Promise(resolve => setTimeout(resolve, 180000));
  }
  
  console.log('\n📊 Monitoreo finalizado.');
}

if (require.main === module) {
  monitorear().catch(console.error);
}

module.exports = { verificarEstado };
