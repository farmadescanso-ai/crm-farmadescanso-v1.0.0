// Script para consultar las API Keys en todas las variantes posibles de nombre de tabla
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

    // Listar todas las tablas que contengan "api" o "key"
    const [allTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND (TABLE_NAME LIKE '%api%' OR TABLE_NAME LIKE '%key%')
      ORDER BY TABLE_NAME
    `, [config.database]);

    console.log(`📋 Tablas relacionadas encontradas: ${allTables.length > 0 ? allTables.map(t => t.TABLE_NAME).join(', ') : 'Ninguna'}\n`);

    // Intentar consultar en diferentes variantes de nombre
    const posiblesNombres = ['API_Keys', 'api_keys', 'API_keys', 'api_Keys'];
    
    for (const tableName of posiblesNombres) {
      try {
        console.log(`🔍 Intentando consultar tabla: ${tableName}`);
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

        if (keys.length > 0) {
          console.log(`\n✅ Tabla encontrada: ${tableName}`);
          console.log(`📝 Se encontraron ${keys.length} API Key(s):\n`);
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
          return; // Salir si encontramos datos
        } else {
          console.log(`   📝 Tabla ${tableName} existe pero está vacía.\n`);
        }
      } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          console.log(`   ❌ Tabla ${tableName} no existe.\n`);
        } else {
          console.log(`   ⚠️  Error: ${error.message}\n`);
        }
      }
    }

    console.log('📝 No se encontraron API Keys en ninguna tabla.');

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

