/**
 * Script para añadir el campo Web a la tabla clientes si no existe
 */

const crm = require('../config/mysql-crm');

async function añadirCampoWeb() {
  try {
    console.log('🔍 Verificando si existe el campo Web en la tabla clientes...\n');
    
    await crm.connect();
    
    // Verificar si existe el campo
    const columnas = await crm.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'farmadescanso'
        AND TABLE_NAME = 'clientes'
        AND COLUMN_NAME = 'Web'
    `);
    
    if (columnas && columnas.length > 0) {
      console.log('✅ El campo Web ya existe en la tabla clientes');
      console.log(`   Tipo: ${columnas[0].DATA_TYPE}(${columnas[0].CHARACTER_MAXIMUM_LENGTH || ''})`);
      console.log(`   Nullable: ${columnas[0].IS_NULLABLE}`);
    } else {
      console.log('⚠️  El campo Web NO existe. Creándolo...\n');
      
      // Crear el campo Web después de Email
      await crm.query(`
        ALTER TABLE \`clientes\` 
        ADD COLUMN \`Web\` VARCHAR(255) NULL DEFAULT NULL COMMENT 'URL de la página web' AFTER \`Email\`
      `);
      
      console.log('✅ Campo Web creado exitosamente');
      console.log('   Ubicación: Después del campo Email');
      console.log('   Tipo: VARCHAR(255)');
      console.log('   Nullable: Sí');
    }
    
    console.log('\n✅ Proceso completado');
    
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('✅ El campo Web ya existe (duplicado detectado)');
    } else {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }
}

if (require.main === module) {
  añadirCampoWeb()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { añadirCampoWeb };
