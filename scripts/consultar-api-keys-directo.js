// Script para consultar las API Keys guardadas en la base de datos
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

    // Verificar si la tabla existe
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND (TABLE_NAME = 'API_Keys' OR TABLE_NAME = 'api_keys')
    `, [config.database]);

    if (tables.length === 0) {
      console.log('❌ La tabla API_Keys no existe en la base de datos.');
      console.log('   Ejecuta primero el script: scripts/crear-tabla-api-keys.sql');
      return;
    }

    const tableName = tables[0].TABLE_NAME;
    console.log(`📋 Tabla encontrada: ${tableName}\n`);

    // Consultar todas las API Keys
    const [keys] = await connection.query(`
      SELECT 
        id,
        api_key,
        nombre,
        descripcion,
        activa,
        creado_por,
        creado_en,
        ultimo_uso
      FROM \`${tableName}\`
      ORDER BY creado_en DESC
    `);

    if (keys.length === 0) {
      console.log('📝 No hay API Keys guardadas en la base de datos.');
      console.log('   Puedes generar una desde: /dashboard/ajustes/api-keys');
    } else {
      console.log(`📝 Se encontraron ${keys.length} API Key(s) en la base de datos:\n`);
      console.log('═'.repeat(100));
      
      keys.forEach((key, index) => {
        console.log(`\n🔑 API Key #${index + 1}:`);
        console.log(`   ID: ${key.id}`);
        console.log(`   Nombre: ${key.nombre || 'Sin nombre'}`);
        console.log(`   Descripción: ${key.descripcion || 'Sin descripción'}`);
        console.log(`   🔐 API Key: ${key.api_key}`);
        console.log(`   Estado: ${key.activa ? '✅ Activa' : '❌ Inactiva'}`);
        console.log(`   Creada: ${key.creado_en ? new Date(key.creado_en).toLocaleString('es-ES') : 'N/A'}`);
        console.log(`   Último uso: ${key.ultimo_uso ? new Date(key.ultimo_uso).toLocaleString('es-ES') : 'Nunca'}`);
        console.log(`   Creada por (ID): ${key.creado_por || 'N/A'}`);
        console.log('─'.repeat(100));
      });
      
      console.log(`\n📊 Resumen:`);
      console.log(`   Total: ${keys.length}`);
      console.log(`   Activas: ${keys.filter(k => k.activa).length}`);
      console.log(`   Inactivas: ${keys.filter(k => !k.activa).length}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('   La tabla API_Keys no existe. Ejecuta el script de creación primero.');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

consultarApiKeys();

