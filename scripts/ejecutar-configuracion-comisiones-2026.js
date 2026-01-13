// Script para ejecutar los scripts SQL de configuración de comisiones para 2026
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function ejecutarScriptSQL(connection, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  
  console.log(`📄 Ejecutando: ${path.basename(filePath)}\n`);
  
  try {
    // Ejecutar el SQL completo usando multipleStatements
    await connection.query(sql);
    console.log(`   ✅ Script ejecutado correctamente\n`);
    return { ejecutadas: 1, errores: 0 };
  } catch (error) {
    // Algunos errores son esperados (tablas ya existen, duplicados, etc.)
    if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
        error.code === 'ER_DUP_ENTRY' ||
        error.message.includes('Duplicate entry') ||
        error.message.includes('already exists')) {
      console.log(`   ⚠️  Advertencia: ${error.message.substring(0, 100)}...`);
      console.log(`   ✅ Continuando (esto es esperado si ya existen datos)\n`);
      return { ejecutadas: 1, errores: 0 };
    } else {
      console.error(`   ❌ Error: ${error.message}`);
      console.error(`   Código: ${error.code}\n`);
      return { ejecutadas: 0, errores: 1 };
    }
  }
}

async function main() {
  let connection;
  
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      charset: 'utf8mb4',
      multipleStatements: true
    };

    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado a la base de datos\n');

    const scripts = [
      'crear-tablas-configuracion-comisiones.sql',
      'insertar-valores-configuracion-comisiones-2026-final.sql',
      'insertar-fijos-mensuales-por-marca-2026.sql'
    ];

    console.log('🚀 Iniciando ejecución de scripts de configuración de comisiones para 2026\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    let totalEjecutadas = 0;
    let totalErrores = 0;

    for (const script of scripts) {
      const scriptPath = path.join(__dirname, script);
      
      if (!fs.existsSync(scriptPath)) {
        console.error(`❌ Archivo no encontrado: ${scriptPath}`);
        continue;
      }

      const result = await ejecutarScriptSQL(connection, scriptPath);
      totalEjecutadas += result.ejecutadas;
      totalErrores += result.errores;
      
      console.log('───────────────────────────────────────────────────────────\n');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Proceso completado`);
    console.log(`   Total sentencias ejecutadas: ${totalEjecutadas}`);
    if (totalErrores > 0) {
      console.log(`   ⚠️  Total errores: ${totalErrores} (algunos pueden ser esperados)`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    // Verificar que las tablas se crearon correctamente
    console.log('🔍 Verificando tablas creadas...\n');
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME LIKE 'config_%'
      ORDER BY TABLE_NAME
    `, [config.database]);
    
    if (tables.length > 0) {
      console.log('✅ Tablas de configuración encontradas:');
      tables.forEach(table => {
        console.log(`   - ${table.TABLE_NAME}`);
      });
    } else {
      console.log('⚠️  No se encontraron tablas de configuración');
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

main();
