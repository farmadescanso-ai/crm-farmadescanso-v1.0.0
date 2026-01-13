const crm = require('../config/mysql-crm');

(async () => {
  try {
    await crm.connect();
    const offset = process.argv[2] ? parseInt(process.argv[2]) : 0;
    const limit = process.argv[3] ? parseInt(process.argv[3]) : 20;
    
    // Priorizar clientes sin DNI/CIF, pero también buscar los demás campos
    const clientes = await crm.query(`SELECT id, Nombre_Razon_Social, Poblacion, Movil, Email, DNI_CIF FROM clientes WHERE (DNI_CIF IS NULL OR DNI_CIF = '') ORDER BY id LIMIT ? OFFSET ?`, [limit, offset]);
    
    console.log(JSON.stringify(clientes.map(c => ({
      id: c.id, 
      nombre: c.Nombre_Razon_Social, 
      poblacion: c.Poblacion, 
      movil: c.Movil || 'SIN MOVIL',
      email: c.Email || 'SIN EMAIL',
      dni: c.DNI_CIF || 'SIN DNI'
    })), null, 2));
    
    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
})();
