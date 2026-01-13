const crm = require('../config/mysql-crm');

(async () => {
  try {
    await crm.connect();
    const [stats] = await crm.query(`SELECT COUNT(*) as total, SUM(CASE WHEN Movil IS NOT NULL THEN 1 ELSE 0 END) as conTel, SUM(CASE WHEN Email IS NOT NULL THEN 1 ELSE 0 END) as conEmail, SUM(CASE WHEN DNI_CIF IS NOT NULL AND DNI_CIF != '' THEN 1 ELSE 0 END) as conDNI FROM clientes`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 RESUMEN PROGRESO TOTAL');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Total clientes:', stats.total);
    console.log('Con teléfono:', stats.conTel, '(' + ((stats.conTel/stats.total)*100).toFixed(1) + '%)');
    console.log('Con email:', stats.conEmail, '(' + ((stats.conEmail/stats.total)*100).toFixed(1) + '%)');
    console.log('Con DNI/CIF:', stats.conDNI, '(' + ((stats.conDNI/stats.total)*100).toFixed(1) + '%)');
    console.log('Pendientes sin teléfono:', (stats.total - stats.conTel));
    console.log('Pendientes sin email:', (stats.total - stats.conEmail));
    console.log('Pendientes sin DNI/CIF:', (stats.total - stats.conDNI));
    console.log('═══════════════════════════════════════════════════════');
    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
})();
