// Script para crear la tabla API_Keys si no existe y consultar las API Keys
const mysql = require('mysql2/promise');
require('dotenv').config();

async function crearTablaYConsultar() {
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

    // Crear la tabla si no existe
    console.log('📝 Verificando/creando tabla API_Keys...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`API_Keys\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`nombre\` varchar(255) NOT NULL,
        \`api_key\` varchar(64) NOT NULL UNIQUE,
        \`descripcion\` text,
        \`activa\` tinyint(1) DEFAULT 1,
        \`permisos\` json DEFAULT NULL,
        \`ultimo_uso\` timestamp NULL DEFAULT NULL,
        \`creado_en\` timestamp DEFAULT CURRENT_TIMESTAMP,
        \`actualizado_en\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`creado_por\` int DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`api_key\` (\`api_key\`),
        KEY \`idx_activa\` (\`activa\`),
        KEY \`idx_creado_por\` (\`creado_por\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla API_Keys verificada/creada\n');

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
      FROM API_Keys
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
        console.log(`   API Key: ${key.api_key}`);
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
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

crearTablaYConsultar();

