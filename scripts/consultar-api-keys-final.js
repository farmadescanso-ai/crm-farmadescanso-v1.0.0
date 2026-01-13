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

    // Verificar qué tablas existen
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE '%api%key%'
    `, [config.database]);

    if (tables.length === 0) {
      console.log('❌ No se encontró ninguna tabla de API Keys.');
      return;
    }

    console.log(`📋 Tablas encontradas: ${tables.map(t => t.TABLE_NAME).join(', ')}\n`);

    // Consultar en todas las tablas posibles
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      console.log(`🔍 Consultando tabla: ${tableName}`);
      
      try {
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
          console.log(`   📝 No hay API Keys en esta tabla.\n`);
        } else {
          console.log(`   ✅ Se encontraron ${keys.length} API Key(s):\n`);
          console.log('═'.repeat(100));
          
          keys.forEach((key, index) => {
            console.log(`\n🔑 API Key #${index + 1}:`);
            console.log(`   ID: ${key.id}`);
            console.log(`   Nombre: ${key.nombre || 'Sin nombre'}`);
            console.log(`   Descripción: ${key.descripcion || 'Sin descripción'}`);
            console.log(`   🔐 API Key: ${key.api_key}`);
            console.log(`   Estado: ${key.activa ? '✅ Activa' : '❌ Inactiva'}`);
            const fechaCreacion = key.creado_en || key.fecha_creacion;
            console.log(`   Creada: ${fechaCreacion ? new Date(fechaCreacion).toLocaleString('es-ES') : 'N/A'}`);
            console.log(`   Último uso: ${key.ultimo_uso ? new Date(key.ultimo_uso).toLocaleString('es-ES') : 'Nunca'}`);
            console.log(`   Creada por (ID): ${key.creado_por || 'N/A'}`);
            console.log('─'.repeat(100));
          });
          
          console.log(`\n📊 Resumen:`);
          console.log(`   Total: ${keys.length}`);
          console.log(`   Activas: ${keys.filter(k => k.activa).length}`);
          console.log(`   Inactivas: ${keys.filter(k => !k.activa).length}`);
          console.log('');
        }
      } catch (error) {
        console.log(`   ⚠️  Error consultando ${tableName}: ${error.message}\n`);
      }
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

consultarApiKeys();

