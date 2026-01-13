// ============================================
// Script para aplicar la columna Activo a la tabla Marcas
// ============================================
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function aplicarCambios() {
  let connection;
  
  try {
    // Leer configuración de conexión
    const config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      multipleStatements: true // Permitir múltiples statements
    };

    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado a la base de datos');

    // Leer el script SQL
    const sqlFile = path.join(__dirname, 'anadir-activo-marcas.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📝 Ejecutando script SQL...');
    console.log('─────────────────────────────────────');
    
    // Ejecutar el script
    const [results] = await connection.query(sql);
    
    console.log('✅ Script ejecutado correctamente');
    console.log('─────────────────────────────────────');

    // Verificar el resultado
    const [verificacion] = await connection.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Marcas'
        AND COLUMN_NAME = 'Activo'
    `);

    if (verificacion && verificacion.length > 0) {
      console.log('✅ Columna Activo añadida correctamente:');
      console.log(JSON.stringify(verificacion[0], null, 2));
    } else {
      console.warn('⚠️ No se pudo verificar la columna Activo');
    }

    // Mostrar resumen de marcas
    const [resumen] = await connection.query(`
      SELECT 
        Activo,
        COUNT(*) as Total
      FROM Marcas
      GROUP BY Activo
    `);

    console.log('\n📊 Resumen de marcas:');
    resumen.forEach(row => {
      console.log(`   - Activo = ${row.Activo}: ${row.Total} marcas`);
    });

    console.log('\n✅ Proceso completado exitosamente');

  } catch (error) {
    console.error('❌ Error ejecutando el script:', error.message);
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
aplicarCambios();
