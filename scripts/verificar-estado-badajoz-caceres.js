const crm = require('../config/mysql-crm');

(async () => {
  try {
    await crm.connect();
    
    // Badajoz (06xxx)
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
    
    const badajozConWeb = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '06%'
         AND Web IS NOT NULL 
         AND Web != ''
    `);
    
    const badajozConEmail = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '06%'
         AND Email IS NOT NULL 
         AND Email != ''
    `);
    
    const badajozConDireccion = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '06%'
         AND Direccion IS NOT NULL 
         AND Direccion != ''
         AND Direccion NOT LIKE 'Código Postal%'
    `);
    
    const badajozConTelefono = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '06%'
         AND (Movil IS NOT NULL AND Movil != '' OR Telefono IS NOT NULL AND Telefono != '')
    `);
    
    // Cáceres (10xxx)
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
    
    const caceresConWeb = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '10%'
         AND Web IS NOT NULL 
         AND Web != ''
    `);
    
    const caceresConEmail = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '10%'
         AND Email IS NOT NULL 
         AND Email != ''
    `);
    
    const caceresConDireccion = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '10%'
         AND Direccion IS NOT NULL 
         AND Direccion != ''
         AND Direccion NOT LIKE 'Código Postal%'
    `);
    
    const caceresConTelefono = await crm.query(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND CodigoPostal LIKE '10%'
         AND (Movil IS NOT NULL AND Movil != '' OR Telefono IS NOT NULL AND Telefono != '')
    `);
    
    const total = badajozTotal[0].total + caceresTotal[0].total;
    const totalConCIF = badajozConCIF[0].total + caceresConCIF[0].total;
    const totalConWeb = badajozConWeb[0].total + caceresConWeb[0].total;
    const totalConEmail = badajozConEmail[0].total + caceresConEmail[0].total;
    const totalConDireccion = badajozConDireccion[0].total + caceresConDireccion[0].total;
    const totalConTelefono = badajozConTelefono[0].total + caceresConTelefono[0].total;
    
    console.log('\n📊 RESUMEN COMPLETO - BADAJOZ Y CÁCERES');
    console.log('='.repeat(80));
    
    console.log(`\n🏛️  BADAJOZ (Códigos Postales 06xxx):`);
    console.log(`   Total de clínicas: ${badajozTotal[0].total}`);
    console.log(`   ✅ Con CIF/DNI: ${badajozConCIF[0].total} (${badajozTotal[0].total > 0 ? ((badajozConCIF[0].total / badajozTotal[0].total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Web: ${badajozConWeb[0].total} (${badajozTotal[0].total > 0 ? ((badajozConWeb[0].total / badajozTotal[0].total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Email: ${badajozConEmail[0].total} (${badajozTotal[0].total > 0 ? ((badajozConEmail[0].total / badajozTotal[0].total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Dirección completa: ${badajozConDireccion[0].total} (${badajozTotal[0].total > 0 ? ((badajozConDireccion[0].total / badajozTotal[0].total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Teléfono: ${badajozConTelefono[0].total} (${badajozTotal[0].total > 0 ? ((badajozConTelefono[0].total / badajozTotal[0].total) * 100).toFixed(1) : 0}%)`);
    
    console.log(`\n🏛️  CÁCERES (Códigos Postales 10xxx):`);
    console.log(`   Total de clínicas: ${caceresTotal[0].total}`);
    console.log(`   ✅ Con CIF/DNI: ${caceresConCIF[0].total} (${caceresTotal[0].total > 0 ? ((caceresConCIF[0].total / caceresTotal[0].total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Web: ${caceresConWeb[0].total} (${caceresTotal[0].total > 0 ? ((caceresConWeb[0].total / caceresTotal[0].total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Email: ${caceresConEmail[0].total} (${caceresTotal[0].total > 0 ? ((caceresConEmail[0].total / caceresTotal[0].total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Dirección completa: ${caceresConDireccion[0].total} (${caceresTotal[0].total > 0 ? ((caceresConDireccion[0].total / caceresTotal[0].total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Teléfono: ${caceresConTelefono[0].total} (${caceresTotal[0].total > 0 ? ((caceresConTelefono[0].total / caceresTotal[0].total) * 100).toFixed(1) : 0}%)`);
    
    console.log(`\n📈 RESUMEN TOTAL:`);
    console.log(`   Total de clínicas: ${total}`);
    console.log(`   ✅ Con CIF/DNI: ${totalConCIF} (${total > 0 ? ((totalConCIF / total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Web: ${totalConWeb} (${total > 0 ? ((totalConWeb / total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Email: ${totalConEmail} (${total > 0 ? ((totalConEmail / total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Dirección completa: ${totalConDireccion} (${total > 0 ? ((totalConDireccion / total) * 100).toFixed(1) : 0}%)`);
    console.log(`   ✅ Con Teléfono: ${totalConTelefono} (${total > 0 ? ((totalConTelefono / total) * 100).toFixed(1) : 0}%)`);
    console.log('='.repeat(80));
    
    await crm.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
