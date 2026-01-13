const crm = require('../config/mysql-crm');

(async () => {
  await crm.connect();
  const sql = `SELECT DISTINCT Poblacion FROM clientes WHERE Poblacion IS NOT NULL AND Poblacion != '' AND (Id_Provincia IS NULL OR CodigoPostal IS NULL OR CodigoPostal = '') ORDER BY Poblacion`;
  const result = await crm.query(sql);
  console.log('Poblaciones restantes sin datos:');
  result.forEach(r => console.log(`  - "${r.Poblacion}"`));
  await crm.disconnect();
})();
