const crm = require('../config/mysql-crm');

(async () => {
  try {
    await crm.connect();
    
    // Córdoba (14xxx)
    const cordobaConCIF = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '14%'
         AND DNI_CIF IS NOT NULL 
         AND DNI_CIF != ''
    `);
    
    const cordobaSinCIF = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '14%'
         AND (DNI_CIF IS NULL OR DNI_CIF = '')
    `);
    
    const cordobaTotal = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '14%'
    `);
    
    // Jaén (23xxx)
    const jaenConCIF = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '23%'
         AND DNI_CIF IS NOT NULL 
         AND DNI_CIF != ''
    `);
    
    const jaenSinCIF = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '23%'
         AND (DNI_CIF IS NULL OR DNI_CIF = '')
    `);
    
    const jaenTotal = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '23%'
    `);
    
    console.log('\n📊 Estado CIF/DNI por Provincia:');
    console.log('='.repeat(70));
    console.log(`\n🏛️  CÓRDOBA (Códigos Postales 14xxx):`);
    console.log(`   Total de clínicas: ${cordobaTotal[0].total}`);
    console.log(`   ✅ Con CIF/DNI: ${cordobaConCIF[0].total} (${((cordobaConCIF[0].total / cordobaTotal[0].total) * 100).toFixed(1)}%)`);
    console.log(`   ⚠️  Sin CIF/DNI: ${cordobaSinCIF[0].total} (${((cordobaSinCIF[0].total / cordobaTotal[0].total) * 100).toFixed(1)}%)`);
    
    console.log(`\n🏛️  JAÉN (Códigos Postales 23xxx):`);
    console.log(`   Total de clínicas: ${jaenTotal[0].total}`);
    console.log(`   ✅ Con CIF/DNI: ${jaenConCIF[0].total} (${((jaenConCIF[0].total / jaenTotal[0].total) * 100).toFixed(1)}%)`);
    console.log(`   ⚠️  Sin CIF/DNI: ${jaenSinCIF[0].total} (${((jaenSinCIF[0].total / jaenTotal[0].total) * 100).toFixed(1)}%)`);
    
    // Resumen total
    const totalClinicas = cordobaTotal[0].total + jaenTotal[0].total;
    const totalConCIF = cordobaConCIF[0].total + jaenConCIF[0].total;
    const totalSinCIF = cordobaSinCIF[0].total + jaenSinCIF[0].total;
    
    console.log(`\n📈 RESUMEN TOTAL:`);
    console.log(`   Total de clínicas: ${totalClinicas}`);
    console.log(`   ✅ Con CIF/DNI: ${totalConCIF} (${((totalConCIF / totalClinicas) * 100).toFixed(1)}%)`);
    console.log(`   ⚠️  Sin CIF/DNI: ${totalSinCIF} (${((totalSinCIF / totalClinicas) * 100).toFixed(1)}%)`);
    console.log('='.repeat(70));
    
    await crm.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
