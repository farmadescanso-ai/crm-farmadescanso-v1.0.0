/**
 * Script completo para crear tablas y cargar códigos postales
 * Ejecutar: node scripts/cargar-completo-codigos-postales.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Configuración de conexión
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'farmadescanso',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function cargarCompleto() {
  let connection;
  
  try {
    console.log('🔍 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos\n');

    // Paso 1: Verificar/Crear tabla provincias
    console.log('📋 Paso 1: Verificando tabla provincias...');
    const [provinciasTables] = await connection.execute(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = 'provincias'`
    );

    if (provinciasTables[0].count === 0) {
      console.log('⚠️  La tabla provincias no existe. Creando...');
      const sqlProvincias = fs.readFileSync(
        path.join(__dirname, 'crear-tabla-provincias.sql'),
        'utf8'
      );
      await connection.query(sqlProvincias);
      console.log('✅ Tabla provincias creada y datos cargados\n');
    } else {
      const [provinciasCount] = await connection.execute('SELECT COUNT(*) as count FROM provincias');
      console.log(`✅ Tabla provincias existe con ${provinciasCount[0].count} registros\n`);
    }

    // Paso 2: Crear tabla Codigos_Postales
    console.log('📋 Paso 2: Verificando tabla Codigos_Postales...');
    const [codigosTables] = await connection.execute(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = 'Codigos_Postales'`
    );

    if (codigosTables[0].count === 0) {
      console.log('⚠️  La tabla Codigos_Postales no existe. Creando...');
      const sqlCrearTabla = fs.readFileSync(
        path.join(__dirname, 'crear-tabla-codigos-postales.sql'),
        'utf8'
      );
      
      // Ejecutar el script SQL completo
      await connection.query(sqlCrearTabla);
      console.log('✅ Tabla Codigos_Postales creada\n');
    } else {
      console.log('✅ Tabla Codigos_Postales existe\n');
    }

    // Paso 3: Verificar si hay códigos postales
    console.log('📋 Paso 3: Verificando códigos postales existentes...');
    const [codigosCount] = await connection.execute('SELECT COUNT(*) as count FROM Codigos_Postales');
    console.log(`📊 Códigos postales actuales: ${codigosCount[0].count}`);

    if (codigosCount[0].count === 0) {
      console.log('⚠️  No hay códigos postales. Cargando códigos postales de Murcia...');
      
      const sqlMurcia = fs.readFileSync(
        path.join(__dirname, 'insertar-codigos-postales-murcia-completo.sql'),
        'utf8'
      );
      
      // Ejecutar el script SQL
      await connection.query(sqlMurcia);
      
      const [codigosCountAfter] = await connection.execute('SELECT COUNT(*) as count FROM Codigos_Postales');
      console.log(`✅ Códigos postales de Murcia cargados: ${codigosCountAfter[0].count}\n`);
    } else {
      console.log('✅ Ya hay códigos postales en la base de datos\n');
    }

    // Paso 4: Actualizar relaciones Id_Provincia
    console.log('📋 Paso 4: Actualizando relaciones Id_Provincia...');
    const [updateResult] = await connection.execute(`
      UPDATE Codigos_Postales cp
      INNER JOIN provincias p ON cp.Provincia = p.Nombre
      SET cp.Id_Provincia = p.id
      WHERE cp.Id_Provincia IS NULL
    `);
    console.log(`✅ ${updateResult.affectedRows} códigos postales actualizados con Id_Provincia\n`);

    // Paso 5: Estadísticas finales
    console.log('📊 Estadísticas finales:');
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT Provincia) as provincias,
        COUNT(DISTINCT Localidad) as localidades,
        COUNT(DISTINCT Id_Provincia) as provincias_con_id,
        MIN(CodigoPostal) as codigo_min,
        MAX(CodigoPostal) as codigo_max
      FROM Codigos_Postales
    `);
    
    console.log(`   Total códigos postales: ${stats[0].total}`);
    console.log(`   Provincias diferentes: ${stats[0].provincias}`);
    console.log(`   Localidades diferentes: ${stats[0].localidades}`);
    console.log(`   Provincias con Id_Provincia: ${stats[0].provincias_con_id}`);
    console.log(`   Rango códigos: ${stats[0].codigo_min} - ${stats[0].codigo_max}\n`);

    // Verificar provincias
    const [provinciasCount] = await connection.execute('SELECT COUNT(*) as count FROM provincias');
    console.log(`   Total provincias: ${provinciasCount[0].count}\n`);

    console.log('✅ Proceso completado exitosamente\n');
    console.log('💡 Ahora puedes acceder a:');
    console.log('   http://localhost:3000/dashboard/ajustes/asignaciones-comerciales');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql.substring(0, 200));
    }
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar
cargarCompleto();
