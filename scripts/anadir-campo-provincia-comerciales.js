/**
 * Script para añadir el campo Id_Provincia a la tabla comerciales
 */

const crm = require('../config/mysql-crm');

async function anadirCampoProvincia() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await crm.connect();
    
    // Verificar si el campo ya existe
    const check = await crm.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'farmadescanso' 
      AND TABLE_NAME = 'comerciales' 
      AND COLUMN_NAME = 'Id_Provincia'
    `);
    
    if (check.length > 0) {
      console.log('✅ Campo Id_Provincia ya existe en la tabla comerciales');
    } else {
      console.log('⚠️ Campo Id_Provincia no existe, añadiéndolo...');
      
      // Añadir el campo
      await crm.query(`
        ALTER TABLE comerciales 
        ADD COLUMN Id_Provincia INT(11) NULL AFTER Poblacion
      `);
      
      // Crear índice
      try {
        await crm.query(`
          CREATE INDEX idx_comerciales_id_provincia ON comerciales(Id_Provincia)
        `);
        console.log('✅ Índice creado correctamente');
      } catch (error) {
        if (error.message.includes('Duplicate key') || error.message.includes('already exists')) {
          console.log('ℹ️ Índice ya existe');
        } else {
          console.warn('⚠️ Error creando índice:', error.message);
        }
      }
      
      console.log('✅ Campo Id_Provincia añadido correctamente');
    }
    
    await crm.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

anadirCampoProvincia();
