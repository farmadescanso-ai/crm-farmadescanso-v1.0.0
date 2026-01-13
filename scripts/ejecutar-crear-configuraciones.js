// Script para crear la tabla Configuraciones
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function crearTablaConfiguraciones() {
  let connection;
  
  try {
    // Configuración de conexión
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
    console.log('✅ Conectado a la base de datos');

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'crear-tabla-configuraciones.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Dividir el SQL en sentencias individuales
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE'));

    console.log(`📝 Ejecutando ${statements.length} sentencias SQL...`);

    // Ejecutar cada sentencia
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.query(statement);
          console.log('✅ Sentencia ejecutada correctamente');
        } catch (error) {
          // Ignorar errores de "table already exists" o "duplicate key"
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_ENTRY') {
            console.log('⚠️  La tabla o registro ya existe, continuando...');
          } else {
            throw error;
          }
        }
      }
    }

    console.log('✅ Tabla Configuraciones creada exitosamente');
    console.log('✅ Configuraciones iniciales insertadas');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar
crearTablaConfiguraciones();

