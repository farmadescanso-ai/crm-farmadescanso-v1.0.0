const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'farmadescanso'
    });

    const [rows] = await connection.execute(
      'SELECT Id, SKU, Nombre, Marca, PVL, PCP FROM articulos WHERE Id = 20 OR SKU = ? LIMIT 1',
      ['220377']
    );

    console.log('✅ Consulta directa a la base de datos:');
    console.log('✅ Filas encontradas:', rows.length);
    if (rows.length > 0) {
      const art = rows[0];
      console.log('  ID:', art.Id);
      console.log('  SKU:', art.SKU);
      console.log('  Nombre:', art.Nombre);
      console.log('  Marca:', art.Marca);
      console.log('  PVL:', art.PVL);
      console.log('  PCP:', art.PCP !== null && art.PCP !== undefined ? art.PCP + '€' : 'NULL');
      console.log('  Tipo PCP:', typeof art.PCP);
      console.log('  PCP raw:', art.PCP);
    } else {
      console.log('  ❌ No se encontró el artículo');
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();

