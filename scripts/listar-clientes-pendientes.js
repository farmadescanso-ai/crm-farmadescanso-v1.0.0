const crm = require('../config/mysql-crm');

(async () => {
  try {
    await crm.connect();
    const offset = process.argv[2] ? parseInt(process.argv[2]) : 35;
    const limit = process.argv[3] ? parseInt(process.argv[3]) : 10;
    const clientes = await crm.query(`SELECT id, Nombre_Razon_Social, Poblacion, DNI_CIF FROM clientes WHERE (Movil IS NULL OR Email IS NULL OR DNI_CIF IS NULL OR DNI_CIF = '') ORDER BY id LIMIT ? OFFSET ?`, [limit, offset]);
    console.log(JSON.stringify(clientes.map(c => ({id: c.id, nombre: c.Nombre_Razon_Social, poblacion: c.Poblacion, dni: c.DNI_CIF || 'SIN DNI'})), null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
})();
