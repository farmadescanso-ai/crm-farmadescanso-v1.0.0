// Script para agregar campo emails_invitados a la tabla visitas
const mysql = require('mysql2/promise');
require('dotenv').config();

async function agregarCampo() {
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

    console.log('📝 Agregando campo emails_invitados a visitas...');
    try {
      await connection.query(`
        ALTER TABLE \`visitas\` 
        ADD COLUMN \`emails_invitados\` TEXT NULL COMMENT 'Emails de los invitados a la reunión, separados por comas'
      `);
      console.log('✅ Campo emails_invitados agregado exitosamente\n');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('✅ Campo emails_invitados ya existe\n');
      } else {
        throw error;
      }
    }

    console.log('✅ Proceso completado');

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

agregarCampo();

