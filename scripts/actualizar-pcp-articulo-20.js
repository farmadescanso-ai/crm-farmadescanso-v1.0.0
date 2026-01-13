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

    const articuloId = 20;
    const nuevoPCP = 5.38;

    console.log(`✅ Actualizando PCP del artículo ${articuloId} a ${nuevoPCP}€...`);

    const [result] = await connection.execute(
      'UPDATE articulos SET PCP = ? WHERE Id = ?',
      [nuevoPCP, articuloId]
    );

    console.log(`✅ Resultado:`, result);
    console.log(`✅ Filas afectadas:`, result.affectedRows);
    console.log(`✅ Cambios:`, result.changedRows);

    // Verificar que se actualizó correctamente
    const [rows] = await connection.execute(
      'SELECT Id, SKU, Nombre, PVL, PCP FROM articulos WHERE Id = ?',
      [articuloId]
    );

    if (rows.length > 0) {
      const art = rows[0];
      console.log('\n✅ Verificación:');
      console.log('  ID:', art.Id);
      console.log('  SKU:', art.SKU);
      console.log('  Nombre:', art.Nombre);
      console.log('  PVL:', art.PVL);
      console.log('  PCP:', art.PCP !== null && art.PCP !== undefined ? art.PCP + '€' : 'NULL');
    }

    await connection.end();
    console.log('\n✅ Actualización completada');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();

