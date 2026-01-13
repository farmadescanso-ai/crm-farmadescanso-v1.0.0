// Script para actualizar el tamaño de la columna api_key
const mysql = require('mysql2/promise');
require('dotenv').config();

async function actualizarColumna() {
  let connection;
  
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      charset: 'utf8mb4'
    };

    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado a la base de datos\n');

    // Verificar el tamaño actual de la columna
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM api_keys WHERE Field = 'api_key'
    `);
    
    if (columns.length > 0) {
      console.log(`📋 Tamaño actual de la columna api_key: ${columns[0].Type}`);
    }

    // Actualizar el tamaño de la columna a 100 caracteres (suficiente para 'farma_' + 64 caracteres hex)
    console.log('📝 Actualizando tamaño de columna api_key a VARCHAR(100)...');
    await connection.query(`
      ALTER TABLE \`api_keys\` 
      MODIFY COLUMN \`api_key\` VARCHAR(100) NOT NULL
    `);
    
    console.log('✅ Columna actualizada correctamente');
    
    // Verificar el nuevo tamaño
    const [newColumns] = await connection.query(`
      SHOW COLUMNS FROM api_keys WHERE Field = 'api_key'
    `);
    
    if (newColumns.length > 0) {
      console.log(`✅ Nuevo tamaño: ${newColumns[0].Type}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

actualizarColumna();

