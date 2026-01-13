// Script para verificar la estructura de la tabla visitas
const mysql = require('mysql2/promise');
require('dotenv').config();

async function verificarEstructura() {
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

    // Obtener estructura de la tabla
    const [columnas] = await connection.query('DESCRIBE visitas');
    
    console.log('📋 Columnas de la tabla visitas:');
    console.log('═══════════════════════════════════════════════════════════');
    columnas.forEach(col => {
      console.log(`  ${col.Field} (${col.Type}) - Null: ${col.Null}, Default: ${col.Default || 'NULL'}`);
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    // Verificar si existe columna para enlace de reunión
    const enlaceCol = columnas.find(c => 
      c.Field.toLowerCase().includes('enlace') || 
      c.Field.toLowerCase().includes('reunion') ||
      c.Field.toLowerCase().includes('link')
    );
    
    if (enlaceCol) {
      console.log(`✅ Columna para enlace de reunión encontrada: ${enlaceCol.Field}`);
    } else {
      console.log('⚠️  No se encontró columna específica para enlace de reunión');
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

verificarEstructura();

