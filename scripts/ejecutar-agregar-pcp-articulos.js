// Script para agregar la columna PCP a la tabla articulos
const mysql = require('mysql2/promise');
require('dotenv').config();

async function agregarPCPArticulos() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      multipleStatements: true
    });

    console.log('📝 Agregando columna PCP a la tabla articulos...');

    // Verificar si el campo PCP ya existe
    const [columns] = await connection.query('SHOW COLUMNS FROM articulos LIKE "PCP"');
    if (columns.length > 0) {
      console.log('ℹ️  El campo PCP ya existe, omitiendo...');
    } else {
      // Agregar el campo PCP después de PVL
      await connection.query(`
        ALTER TABLE articulos 
        ADD COLUMN PCP DECIMAL(10,2) NULL COMMENT 'Precio de Compra del producto' 
        AFTER PVL
      `);
      console.log('✅ Campo PCP agregado');
    }

    // Verificar si el índice ya existe
    const [indexes] = await connection.query(`
      SHOW INDEXES FROM articulos 
      WHERE Key_name = 'idx_articulo_pcp'
    `);
    
    if (indexes.length === 0) {
      // Agregar índice para búsquedas por PCP
      await connection.query(`
        ALTER TABLE articulos 
        ADD INDEX idx_articulo_pcp (PCP)
      `);
      console.log('✅ Índice de PCP creado');
    } else {
      console.log('ℹ️  El índice de PCP ya existe, omitiendo...');
    }

    console.log('✅ Proceso completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

agregarPCPArticulos()
  .then(() => {
    console.log('✅ Script ejecutado correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error ejecutando script:', error);
    process.exit(1);
  });

