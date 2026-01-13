/**
 * Script para verificar y cargar datos de provincias y códigos postales
 * Ejecutar: node scripts/verificar-y-cargar-datos-codigos-postales.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Configuración de conexión (ajustar según tu configuración)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'farmadescanso',
  charset: 'utf8mb4'
};

async function verificarYCargarDatos() {
  let connection;
  
  try {
    console.log('🔍 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos\n');

    // Verificar tabla provincias
    console.log('📋 Verificando tabla provincias...');
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
      // Ejecutar solo las sentencias CREATE e INSERT
      const statements = sqlProvincias
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
      
      for (const statement of statements) {
        if (statement.length > 0) {
          try {
            await connection.execute(statement);
          } catch (error) {
            if (!error.message.includes('already exists')) {
              console.error('❌ Error ejecutando:', statement.substring(0, 50), '...');
              console.error('   ', error.message);
            }
          }
        }
      }
      console.log('✅ Tabla provincias creada\n');
    } else {
      console.log('✅ Tabla provincias existe');
    }

    // Verificar datos en provincias
    const [provinciasCount] = await connection.execute('SELECT COUNT(*) as count FROM provincias');
    console.log(`📊 Provincias en la base de datos: ${provinciasCount[0].count}`);
    
    if (provinciasCount[0].count === 0) {
      console.log('⚠️  No hay provincias. Cargando datos...');
      const sqlProvincias = fs.readFileSync(
        path.join(__dirname, 'crear-tabla-provincias.sql'),
        'utf8'
      );
      const insertStatements = sqlProvincias
        .split('INSERT INTO')
        .filter(s => s.trim().length > 0)
        .map(s => 'INSERT INTO' + s.trim());
      
      for (const statement of insertStatements) {
        try {
          await connection.execute(statement);
        } catch (error) {
          if (!error.message.includes('Duplicate entry')) {
            console.error('❌ Error:', error.message);
          }
        }
      }
      console.log('✅ Provincias cargadas\n');
    }

    // Verificar tabla Codigos_Postales
    console.log('📋 Verificando tabla Codigos_Postales...');
    const [codigosTables] = await connection.execute(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = 'Codigos_Postales'`
    );

    if (codigosTables[0].count === 0) {
      console.log('⚠️  La tabla Codigos_Postales no existe.');
      console.log('   Ejecuta primero: scripts/crear-tabla-codigos-postales.sql\n');
    } else {
      console.log('✅ Tabla Codigos_Postales existe');
      
      // Verificar datos en Codigos_Postales
      const [codigosCount] = await connection.execute('SELECT COUNT(*) as count FROM Codigos_Postales');
      console.log(`📊 Códigos postales en la base de datos: ${codigosCount[0].count}`);
      
      if (codigosCount[0].count === 0) {
        console.log('⚠️  No hay códigos postales.');
        console.log('   Para cargar códigos postales de Murcia, ejecuta:');
        console.log('   scripts/insertar-codigos-postales-murcia-completo.sql\n');
      } else {
        // Mostrar estadísticas
        const [stats] = await connection.execute(`
          SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT Provincia) as provincias,
            COUNT(DISTINCT Localidad) as localidades,
            MIN(CodigoPostal) as codigo_min,
            MAX(CodigoPostal) as codigo_max
          FROM Codigos_Postales
        `);
        console.log('📊 Estadísticas de códigos postales:');
        console.log(`   Total: ${stats[0].total}`);
        console.log(`   Provincias diferentes: ${stats[0].provincias}`);
        console.log(`   Localidades diferentes: ${stats[0].localidades}`);
        console.log(`   Rango: ${stats[0].codigo_min} - ${stats[0].codigo_max}\n`);
      }
    }

    // Verificar relación entre provincias y códigos postales
    console.log('🔗 Verificando relación provincias - códigos postales...');
    const [relacion] = await connection.execute(`
      SELECT 
        COUNT(*) as total_codigos,
        COUNT(DISTINCT cp.Id_Provincia) as provincias_con_relacion,
        COUNT(DISTINCT cp.Provincia) as provincias_por_nombre
      FROM Codigos_Postales cp
    `);
    
    if (relacion[0].total_codigos > 0) {
      console.log(`📊 Códigos postales con Id_Provincia: ${relacion[0].provincias_con_relacion}`);
      console.log(`📊 Provincias diferentes por nombre: ${relacion[0].provincias_por_nombre}`);
      
      if (relacion[0].provincias_con_relacion === 0) {
        console.log('⚠️  Los códigos postales no tienen Id_Provincia asignado.');
        console.log('   Actualizando relaciones...');
        
        // Actualizar Id_Provincia basándose en el nombre de la provincia
        const [updateResult] = await connection.execute(`
          UPDATE Codigos_Postales cp
          INNER JOIN provincias p ON cp.Provincia = p.Nombre
          SET cp.Id_Provincia = p.id
          WHERE cp.Id_Provincia IS NULL
        `);
        
        console.log(`✅ ${updateResult.affectedRows} códigos postales actualizados con Id_Provincia\n`);
      }
    }

    console.log('✅ Verificación completada\n');
    console.log('📝 Resumen:');
    console.log(`   - Provincias: ${provinciasCount[0].count}`);
    if (codigosTables[0].count > 0) {
      const [codigosCount] = await connection.execute('SELECT COUNT(*) as count FROM Codigos_Postales');
      console.log(`   - Códigos postales: ${codigosCount[0].count}`);
    } else {
      console.log(`   - Códigos postales: Tabla no existe`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar
verificarYCargarDatos();
