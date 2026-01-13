/**
 * Script para aplicar la estructura mejorada de provincias
 * - Crea/actualiza la tabla provincias con ID = número de provincia
 * - Inserta todas las provincias de España (52 provincias)
 * - Actualiza las relaciones en otras tablas
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
  multipleStatements: true
};

async function aplicarEstructuraProvincias() {
  let connection;
  
  try {
    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión establecida\n');

    // 1. Leer y ejecutar script de creación de tabla
    console.log('📋 Paso 1: Creando/actualizando tabla provincias...');
    const sqlCrearTabla = fs.readFileSync(
      path.join(__dirname, 'crear-tabla-provincias-estructurada.sql'),
      'utf8'
    );
    
    // Dividir en statements individuales
    const statements = sqlCrearTabla
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
    
    for (const statement of statements) {
      if (statement.length > 10) { // Ignorar statements muy cortos
        try {
          await connection.query(statement);
        } catch (error) {
          // Ignorar errores de "ya existe" o similares
          if (!error.message.includes('already exists') && 
              !error.message.includes('Duplicate') &&
              !error.message.includes('Duplicate entry')) {
            console.warn(`⚠️  Advertencia en statement: ${error.message}`);
          }
        }
      }
    }
    console.log('✅ Tabla provincias creada/actualizada\n');

    // 2. Verificar provincias insertadas
    console.log('📊 Paso 2: Verificando provincias insertadas...');
    const [provincias] = await connection.query(
      'SELECT COUNT(*) as total, COUNT(DISTINCT Codigo) as codigos FROM provincias WHERE CodigoPais = ?',
      ['ES']
    );
    console.log(`✅ Provincias de España: ${provincias[0].total} (códigos únicos: ${provincias[0].codigos})\n`);

    // 3. Aplicar relaciones
    console.log('🔗 Paso 3: Actualizando relaciones en otras tablas...');
    const sqlRelaciones = fs.readFileSync(
      path.join(__dirname, 'actualizar-relaciones-provincias.sql'),
      'utf8'
    );
    
    const statementsRel = sqlRelaciones
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
    
    for (const statement of statementsRel) {
      if (statement.length > 10) {
        try {
          await connection.query(statement);
        } catch (error) {
          // Ignorar errores esperados
          if (!error.message.includes('Duplicate') &&
              !error.message.includes('already exists') &&
              !error.message.includes('Unknown column')) {
            console.warn(`⚠️  Advertencia: ${error.message}`);
          }
        }
      }
    }
    console.log('✅ Relaciones actualizadas\n');

    // 4. Mostrar resumen (verificando si las columnas existen)
    console.log('📈 Resumen final:');
    
    const resumen = [];
    
    // Verificar Codigos_Postales
    try {
      const [cp] = await connection.query(`
        SELECT 
          'Codigos_Postales' as Tabla,
          COUNT(*) as Total,
          COUNT(Id_Provincia) as ConProvincia
        FROM Codigos_Postales
      `);
      resumen.push(cp[0]);
    } catch (error) {
      if (error.message.includes('Unknown column')) {
        const [cp] = await connection.query('SELECT COUNT(*) as Total FROM Codigos_Postales');
        resumen.push({ Tabla: 'Codigos_Postales', Total: cp[0].Total, ConProvincia: 0 });
      }
    }
    
    // Verificar Clientes
    try {
      const [cl] = await connection.query(`
        SELECT 
          'Clientes' as Tabla,
          COUNT(*) as Total,
          COUNT(Id_Provincia) as ConProvincia
        FROM Clientes
      `);
      resumen.push(cl[0]);
    } catch (error) {
      if (error.message.includes('Unknown column')) {
        const [cl] = await connection.query('SELECT COUNT(*) as Total FROM Clientes');
        resumen.push({ Tabla: 'Clientes', Total: cl[0].Total, ConProvincia: 0 });
      }
    }
    
    // Verificar Comerciales
    try {
      const [co] = await connection.query(`
        SELECT 
          'Comerciales' as Tabla,
          COUNT(*) as Total,
          COUNT(Id_Provincia) as ConProvincia
        FROM Comerciales
      `);
      resumen.push(co[0]);
    } catch (error) {
      if (error.message.includes('Unknown column')) {
        const [co] = await connection.query('SELECT COUNT(*) as Total FROM Comerciales');
        resumen.push({ Tabla: 'Comerciales', Total: co[0].Total, ConProvincia: 0 });
      }
    }
    
    console.table(resumen);
    
    // Mostrar algunas provincias de ejemplo
    try {
      const [ejemplos] = await connection.query(
        'SELECT id, Codigo, Nombre, ComunidadAutonoma FROM provincias WHERE CodigoPais = ? ORDER BY id LIMIT 10',
        ['ES']
      );
      console.log('\n📋 Primeras 10 provincias:');
      console.table(ejemplos);
    } catch (error) {
      // Si ComunidadAutonoma no existe, consultar sin ella
      const [ejemplos] = await connection.query(
        'SELECT id, Codigo, Nombre FROM provincias WHERE CodigoPais = ? ORDER BY id LIMIT 10',
        ['ES']
      );
      console.log('\n📋 Primeras 10 provincias:');
      console.table(ejemplos);
    }

    console.log('\n✅ Proceso completado exitosamente');

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

// Ejecutar
if (require.main === module) {
  aplicarEstructuraProvincias()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { aplicarEstructuraProvincias };
