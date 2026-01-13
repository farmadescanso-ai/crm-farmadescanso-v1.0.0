// ============================================
// Script para aplicar NumClientes a Codigos_Postales
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

    // Paso 1: Añadir columna NumClientes
    console.log('\n📝 Paso 1: Añadiendo columna NumClientes...');
    const sqlFile1 = path.join(__dirname, 'anadir-numclientes-codigos-postales.sql');
    const sql1 = fs.readFileSync(sqlFile1, 'utf8');
    
    await connection.query(sql1);
    console.log('✅ Columna NumClientes añadida y valores calculados');

    // Paso 2: Crear triggers (sin DELIMITER, ejecutarlos uno por uno)
    console.log('\n📝 Paso 2: Creando triggers para actualización automática...');
    
    // Eliminar triggers existentes
    await connection.query('DROP TRIGGER IF EXISTS trg_clientes_insert_numclientes');
    await connection.query('DROP TRIGGER IF EXISTS trg_clientes_update_numclientes');
    await connection.query('DROP TRIGGER IF EXISTS trg_clientes_delete_numclientes');
    
    // Crear trigger INSERT
    const sqlFileInsert = path.join(__dirname, 'crear-triggers-actualizar-numclientes-individual.sql');
    const sqlInsert = fs.readFileSync(sqlFileInsert, 'utf8');
    await connection.query(sqlInsert);
    console.log('✅ Trigger INSERT creado');
    
    // Crear trigger UPDATE
    const sqlFileUpdate = path.join(__dirname, 'crear-triggers-actualizar-numclientes-update.sql');
    const sqlUpdate = fs.readFileSync(sqlFileUpdate, 'utf8');
    await connection.query(sqlUpdate);
    console.log('✅ Trigger UPDATE creado');
    
    // Crear trigger DELETE
    const sqlFileDelete = path.join(__dirname, 'crear-triggers-actualizar-numclientes-delete.sql');
    const sqlDelete = fs.readFileSync(sqlFileDelete, 'utf8');
    await connection.query(sqlDelete);
    console.log('✅ Trigger DELETE creado');

    // Verificar los resultados
    console.log('\n📊 Verificando resultados...');
    const [verificacion] = await connection.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Codigos_Postales'
        AND COLUMN_NAME = 'NumClientes'
    `);

    if (verificacion && verificacion.length > 0) {
      console.log('✅ Columna NumClientes verificada:');
      console.log(JSON.stringify(verificacion[0], null, 2));
    }

    // Mostrar estadísticas
    const [estadisticas] = await connection.query(`
      SELECT 
        COUNT(*) as total_codigos,
        SUM(NumClientes) as total_clientes,
        AVG(NumClientes) as promedio_clientes,
        MAX(NumClientes) as max_clientes,
        MIN(NumClientes) as min_clientes
      FROM Codigos_Postales
    `);

    console.log('\n📊 Estadísticas:');
    console.log(`   - Total códigos postales: ${estadisticas[0].total_codigos}`);
    console.log(`   - Total clientes: ${estadisticas[0].total_clientes}`);
    console.log(`   - Promedio clientes por código: ${parseFloat(estadisticas[0].promedio_clientes).toFixed(2)}`);
    console.log(`   - Máximo clientes en un código: ${estadisticas[0].max_clientes}`);
    console.log(`   - Mínimo clientes en un código: ${estadisticas[0].min_clientes}`);

    // Mostrar top 10 códigos postales con más clientes
    const [top10] = await connection.query(`
      SELECT 
        CodigoPostal,
        Localidad,
        Provincia,
        NumClientes
      FROM Codigos_Postales
      WHERE NumClientes > 0
      ORDER BY NumClientes DESC
      LIMIT 10
    `);

    console.log('\n🏆 Top 10 códigos postales con más clientes:');
    top10.forEach((cp, index) => {
      console.log(`   ${index + 1}. ${cp.CodigoPostal} - ${cp.Localidad} (${cp.Provincia}): ${cp.NumClientes} clientes`);
    });

    // Verificar triggers
    const [triggers] = await connection.query(`
      SELECT 
        TRIGGER_NAME,
        EVENT_MANIPULATION,
        EVENT_OBJECT_TABLE,
        ACTION_TIMING
      FROM INFORMATION_SCHEMA.TRIGGERS
      WHERE TRIGGER_SCHEMA = DATABASE()
        AND TRIGGER_NAME LIKE 'trg_clientes_%_numclientes'
      ORDER BY TRIGGER_NAME
    `);

    console.log('\n🔧 Triggers creados:');
    triggers.forEach(trigger => {
      console.log(`   - ${trigger.TRIGGER_NAME} (${trigger.EVENT_MANIPULATION} ${trigger.ACTION_TIMING})`);
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
