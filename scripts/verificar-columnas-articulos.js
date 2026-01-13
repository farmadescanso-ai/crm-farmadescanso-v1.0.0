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

    const [rows] = await connection.execute('DESCRIBE articulos');
    console.log('✅ Columnas en la tabla articulos:');
    rows.forEach(col => {
      console.log(`  ${col.Field} (${col.Type})${col.Null === 'YES' ? ' NULL' : ' NOT NULL'}`);
    });

    // Verificar un artículo de ejemplo
    const [articulo] = await connection.execute('SELECT * FROM articulos WHERE Id = 15 LIMIT 1');
    if (articulo.length > 0) {
      console.log('\n✅ Artículo ID 15:');
      console.log('  Columnas disponibles:', Object.keys(articulo[0]));
      console.log('  OK_KO existe?:', 'OK_KO' in articulo[0] || 'OK/KO' in articulo[0]);
      console.log('  Estado column:', Object.keys(articulo[0]).filter(k => k.toLowerCase().includes('ok') || k.toLowerCase().includes('ko') || k.toLowerCase().includes('estado') || k.toLowerCase().includes('activo')));
    }

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();

