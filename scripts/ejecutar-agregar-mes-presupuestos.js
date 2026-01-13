// Script para agregar el campo mes a la tabla presupuestos
const mysql = require('mysql2/promise');
require('dotenv').config();

async function agregarMesPresupuestos() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      multipleStatements: true
    });

    console.log('📝 Agregando campo mes a la tabla presupuestos...');

    // Eliminar la clave única antigua si existe
    try {
      await connection.query('ALTER TABLE presupuestos DROP INDEX uk_presupuesto_comercial_articulo_año');
      console.log('✅ Clave única antigua eliminada');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('ℹ️  La clave única antigua no existe, continuando...');
      } else {
        throw error;
      }
    }

    // Verificar si el campo mes ya existe
    const [columns] = await connection.query('SHOW COLUMNS FROM presupuestos LIKE "mes"');
    if (columns.length > 0) {
      console.log('ℹ️  El campo mes ya existe, omitiendo...');
    } else {
      // Agregar el campo mes
      await connection.query(`
        ALTER TABLE presupuestos 
        ADD COLUMN mes INT NULL COMMENT 'Mes del presupuesto (1-12). NULL para presupuestos anuales' 
        AFTER año
      `);
      console.log('✅ Campo mes agregado');
    }

    // Verificar si la nueva clave única ya existe
    const [indexes] = await connection.query(`
      SHOW INDEXES FROM presupuestos 
      WHERE Key_name = 'uk_presupuesto_comercial_articulo_año_mes'
    `);
    
    if (indexes.length === 0) {
      // Crear nueva clave única que incluye mes
      await connection.query(`
        ALTER TABLE presupuestos 
        ADD UNIQUE KEY uk_presupuesto_comercial_articulo_año_mes (comercial_id, articulo_id, año, mes)
      `);
      console.log('✅ Nueva clave única creada');
    } else {
      console.log('ℹ️  La clave única ya existe, omitiendo...');
    }

    // Verificar si el índice de mes ya existe
    const [mesIndexes] = await connection.query(`
      SHOW INDEXES FROM presupuestos 
      WHERE Key_name = 'idx_presupuesto_mes'
    `);
    
    if (mesIndexes.length === 0) {
      // Agregar índice para búsquedas por mes
      await connection.query(`
        ALTER TABLE presupuestos 
        ADD INDEX idx_presupuesto_mes (mes)
      `);
      console.log('✅ Índice de mes creado');
    } else {
      console.log('ℹ️  El índice de mes ya existe, omitiendo...');
    }

    console.log('✅ Proceso completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

agregarMesPresupuestos()
  .then(() => {
    console.log('✅ Script ejecutado correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error ejecutando script:', error);
    process.exit(1);
  });

