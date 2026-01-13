const crm = require('../config/mysql-crm');

(async () => {
  try {
    await crm.connect();
    
    // Total de clientes
    const [total] = await crm.query('SELECT COUNT(*) as total FROM clientes');
    
    // Pendientes (sin Movil, Email o DNI_CIF)
    const [pendientes] = await crm.query(`SELECT COUNT(*) as pendientes FROM clientes WHERE (Movil IS NULL OR Email IS NULL OR DNI_CIF IS NULL OR DNI_CIF = '')`);
    
    // Con todos los datos (Movil, Email y DNI_CIF)
    const [conTodos] = await crm.query(`SELECT COUNT(*) as conTodos FROM clientes WHERE Movil IS NOT NULL AND Email IS NOT NULL AND DNI_CIF IS NOT NULL AND DNI_CIF != ''`);
    
    // Revisados parcialmente (tienen al menos uno de los campos)
    const revisadosParcialmente = total.total - pendientes.pendientes;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 RESUMEN DE REVISIÓN DE CLIENTES');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total clientes: ${total.total}`);
    console.log(`Pendientes de revisar: ${pendientes.pendientes}`);
    console.log(`Revisados (parcial o completo): ${revisadosParcialmente}`);
    console.log(`  - Con todos los datos (Movil + Email + DNI_CIF): ${conTodos.conTodos}`);
    console.log(`  - Con datos parciales: ${revisadosParcialmente - conTodos.conTodos}`);
    console.log('═══════════════════════════════════════════════════════');
    
    // Calcular cuántos hemos procesado en los lotes
    const [conMovil] = await crm.query('SELECT COUNT(*) as conMovil FROM clientes WHERE Movil IS NOT NULL');
    const [conEmail] = await crm.query('SELECT COUNT(*) as conEmail FROM clientes WHERE Email IS NOT NULL');
    const [conDNI] = await crm.query(`SELECT COUNT(*) as conDNI FROM clientes WHERE DNI_CIF IS NOT NULL AND DNI_CIF != ''`);
    
    console.log(`\n📈 Desglose por campo:`);
    console.log(`  - Con teléfono/móvil: ${conMovil.conMovil} (${((conMovil.conMovil/total.total)*100).toFixed(1)}%)`);
    console.log(`  - Con email: ${conEmail.conEmail} (${((conEmail.conEmail/total.total)*100).toFixed(1)}%)`);
    console.log(`  - Con DNI/CIF: ${conDNI.conDNI} (${((conDNI.conDNI/total.total)*100).toFixed(1)}%)`);
    
    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
})();
