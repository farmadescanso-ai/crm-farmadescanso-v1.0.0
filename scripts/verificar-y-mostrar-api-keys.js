// Script para verificar y mostrar todas las API Keys, intentando con diferentes nombres de tabla
const mysql = require('mysql2/promise');
require('dotenv').config();

async function consultarApiKeys() {
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

    // Obtener el nombre exacto de la tabla desde information_schema
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND (TABLE_NAME LIKE '%api%' AND TABLE_NAME LIKE '%key%')
    `, [config.database]);

    if (tables.length === 0) {
      console.log('❌ No se encontró ninguna tabla de API Keys.');
      return;
    }

    console.log(`📋 Tablas encontradas: ${tables.map(t => t.TABLE_NAME).join(', ')}\n`);

    // Consultar en cada tabla encontrada
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      console.log(`🔍 Consultando: ${tableName}`);
      
      try {
        // Primero verificar la estructura
        const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
        console.log(`   Columnas: ${columns.map(c => c.Field).join(', ')}`);
        
        // Consultar datos
        const [keys] = await connection.query(`
          SELECT * FROM \`${tableName}\` ORDER BY id DESC
        `);

        if (keys.length === 0) {
          console.log(`   📝 La tabla está vacía.\n`);
        } else {
          console.log(`\n✅ Se encontraron ${keys.length} API Key(s) en ${tableName}:\n`);
          console.log('═'.repeat(100));
          
          keys.forEach((key, index) => {
            console.log(`\n🔑 API Key #${index + 1}:`);
            Object.keys(key).forEach(k => {
              if (k === 'api_key') {
                console.log(`   🔐 ${k}: ${key[k]}`);
              } else if (k === 'activa') {
                console.log(`   ${k}: ${key[k] ? '✅ Activa' : '❌ Inactiva'}`);
              } else {
                console.log(`   ${k}: ${key[k] || 'N/A'}`);
              }
            });
            console.log('─'.repeat(100));
          });
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

consultarApiKeys();

