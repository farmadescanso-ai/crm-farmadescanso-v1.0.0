const crm = require('../config/mysql-crm');

async function corregirForeignKeys() {
  let connection = null;
  
  try {
    await crm.connect();
    connection = await crm.pool.getConnection();
    
    console.log('🔧 Corrigiendo Foreign Keys de fijos_mensuales_marca...\n');
    
    await connection.query('START TRANSACTION');
    
    // 1. Eliminar Foreign Keys existentes si apuntan a tablas incorrectas
    console.log('🔍 Verificando Foreign Keys existentes...');
    const [fks] = await connection.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'fijos_mensuales_marca'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    // Eliminar Foreign Keys existentes
    for (const fk of fks) {
      console.log(`🗑️  Eliminando Foreign Key: ${fk.CONSTRAINT_NAME}`);
      try {
        await connection.query(`ALTER TABLE fijos_mensuales_marca DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        console.log(`   ✅ Eliminada: ${fk.CONSTRAINT_NAME}`);
      } catch (error) {
        console.warn(`   ⚠️  No se pudo eliminar ${fk.CONSTRAINT_NAME}: ${error.message}`);
      }
    }
    console.log('');
    
    // 2. Verificar nombres correctos de las tablas
    console.log('🔍 Verificando nombres correctos de las tablas...');
    const [tablas] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('Comerciales', 'comerciales', 'Marcas', 'marcas')
      ORDER BY TABLE_NAME
    `);
    
    let tablaComerciales = null;
    let tablaMarcas = null;
    
    tablas.forEach(t => {
      if (t.TABLE_NAME === 'Comerciales' || t.TABLE_NAME === 'comerciales') {
        tablaComerciales = t.TABLE_NAME;
      }
      if (t.TABLE_NAME === 'Marcas' || t.TABLE_NAME === 'marcas') {
        tablaMarcas = t.TABLE_NAME;
      }
    });
    
    console.log(`   Tabla de comerciales: ${tablaComerciales || 'NO ENCONTRADA'}`);
    console.log(`   Tabla de marcas: ${tablaMarcas || 'NO ENCONTRADA'}`);
    console.log('');
    
    if (!tablaComerciales || !tablaMarcas) {
      throw new Error('No se encontraron las tablas Comerciales o Marcas');
    }
    
    // 3. Verificar columnas de las tablas referenciadas
    console.log('🔍 Verificando columnas de las tablas referenciadas...');
    const [columnasComerciales] = await connection.query(`DESCRIBE ${tablaComerciales}`);
    const colIdComerciales = columnasComerciales.find(c => c.Field.toLowerCase() === 'id');
    console.log(`   Columna ID en ${tablaComerciales}: ${colIdComerciales ? colIdComerciales.Field : 'NO ENCONTRADA'}`);
    
    const [columnasMarcas] = await connection.query(`DESCRIBE ${tablaMarcas}`);
    const colIdMarcas = columnasMarcas.find(c => c.Field.toLowerCase() === 'id');
    console.log(`   Columna ID en ${tablaMarcas}: ${colIdMarcas ? colIdMarcas.Field : 'NO ENCONTRADA'}`);
    console.log('');
    
    if (!colIdComerciales || !colIdMarcas) {
      throw new Error('No se encontró la columna id en las tablas referenciadas');
    }
    
    // 4. Crear Foreign Keys correctas
    console.log('📝 Creando Foreign Keys correctas...');
    
    console.log(`   Creando FK para comercial_id -> ${tablaComerciales}.${colIdComerciales.Field}...`);
    try {
      await connection.query(`
        ALTER TABLE fijos_mensuales_marca
        ADD CONSTRAINT fk_fijos_comercial 
        FOREIGN KEY (comercial_id) 
        REFERENCES ${tablaComerciales}(${colIdComerciales.Field}) 
        ON DELETE CASCADE 
        ON UPDATE RESTRICT
      `);
      console.log('   ✅ Foreign Key para comercial_id creada correctamente');
    } catch (error) {
      if (error.code === 'ER_DUP_KEY' || error.message.includes('Duplicate')) {
        console.log('   ℹ️  La Foreign Key ya existe');
      } else {
        throw error;
      }
    }
    
    console.log(`   Creando FK para marca_id -> ${tablaMarcas}.${colIdMarcas.Field}...`);
    try {
      await connection.query(`
        ALTER TABLE fijos_mensuales_marca
        ADD CONSTRAINT fk_fijos_marca 
        FOREIGN KEY (marca_id) 
        REFERENCES ${tablaMarcas}(${colIdMarcas.Field}) 
        ON DELETE CASCADE 
        ON UPDATE RESTRICT
      `);
      console.log('   ✅ Foreign Key para marca_id creada correctamente');
    } catch (error) {
      if (error.code === 'ER_DUP_KEY' || error.message.includes('Duplicate')) {
        console.log('   ℹ️  La Foreign Key ya existe');
      } else {
        throw error;
      }
    }
    console.log('');
    
    // 5. Verificar Foreign Keys creadas
    console.log('🔍 Verificando Foreign Keys creadas...');
    const [fksFinales] = await connection.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'fijos_mensuales_marca'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    fksFinales.forEach(fk => {
      console.log(`   ✅ ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
    });
    console.log('');
    
    await connection.query('COMMIT');
    console.log('✅ Transacción confirmada\n');
    
    console.log('='.repeat(80));
    console.log('✅ FOREIGN KEYS CORREGIDAS');
    console.log('='.repeat(80));
    
    connection.release();
    await crm.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    
    if (connection) {
      try {
        await connection.query('ROLLBACK');
        console.log('🔄 Transacción revertida');
        connection.release();
      } catch (rollbackError) {
        console.error('⚠️  Error al hacer rollback:', rollbackError.message);
        connection.release();
      }
    }
    
    await crm.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Ejecutar
corregirForeignKeys();
