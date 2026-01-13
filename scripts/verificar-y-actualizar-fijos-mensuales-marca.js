const crm = require('../config/mysql-crm');

async function verificarYActualizarTabla() {
  let connection = null;
  
  try {
    await crm.connect();
    connection = await crm.pool.getConnection();
    
    console.log('🔍 Verificando estructura de la tabla fijos_mensuales_marca...\n');
    
    // 1. Verificar si la tabla existe
    const [tablas] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'fijos_mensuales_marca'
    `);
    
    if (tablas.length === 0) {
      console.log('❌ La tabla fijos_mensuales_marca no existe. Ejecuta primero crear-tabla-fijos-mensuales-marca.js');
      connection.release();
      await crm.disconnect();
      process.exit(1);
    }
    
    console.log('✅ La tabla fijos_mensuales_marca existe\n');
    
    // 2. Verificar estructura de la tabla
    console.log('📋 Estructura actual de la tabla:');
    const [columnas] = await connection.query('DESCRIBE fijos_mensuales_marca');
    columnas.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });
    console.log('');
    
    // 3. Verificar índices
    console.log('📊 Índices de la tabla:');
    const [indices] = await connection.query('SHOW INDEX FROM fijos_mensuales_marca');
    const indicesUnicos = {};
    indices.forEach(idx => {
      if (!indicesUnicos[idx.Key_name]) {
        indicesUnicos[idx.Key_name] = {
          nombre: idx.Key_name,
          unico: idx.Non_unique === 0,
          columnas: []
        };
      }
      indicesUnicos[idx.Key_name].columnas.push(idx.Column_name);
    });
    Object.values(indicesUnicos).forEach(idx => {
      console.log(`   - ${idx.nombre} (${idx.unico ? 'UNIQUE' : 'INDEX'}): ${idx.columnas.join(', ')}`);
    });
    console.log('');
    
    // 4. Verificar Foreign Keys
    console.log('🔗 Foreign Keys:');
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
    
    if (fks.length === 0) {
      console.log('   ⚠️  No se encontraron Foreign Keys. Se crearán...\n');
      
      // Crear Foreign Keys
      await connection.query('START TRANSACTION');
      
      try {
        // Verificar si ya existen las constraints (por si acaso)
        const [constraints] = await connection.query(`
          SELECT CONSTRAINT_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'fijos_mensuales_marca'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        `);
        
        if (constraints.length === 0) {
          console.log('   📝 Creando Foreign Key para comercial_id...');
          await connection.query(`
            ALTER TABLE fijos_mensuales_marca
            ADD CONSTRAINT fk_fijos_comercial 
            FOREIGN KEY (comercial_id) 
            REFERENCES Comerciales(id) 
            ON DELETE CASCADE 
            ON UPDATE RESTRICT
          `);
          console.log('   ✅ Foreign Key para comercial_id creada');
          
          console.log('   📝 Creando Foreign Key para marca_id...');
          await connection.query(`
            ALTER TABLE fijos_mensuales_marca
            ADD CONSTRAINT fk_fijos_marca 
            FOREIGN KEY (marca_id) 
            REFERENCES Marcas(id) 
            ON DELETE CASCADE 
            ON UPDATE RESTRICT
          `);
          console.log('   ✅ Foreign Key para marca_id creada\n');
        } else {
          console.log('   ℹ️  Las Foreign Keys ya existen\n');
        }
        
        await connection.query('COMMIT');
      } catch (fkError) {
        await connection.query('ROLLBACK');
        console.error('   ❌ Error creando Foreign Keys:', fkError.message);
        // Continuar aunque falle, puede que ya existan
      }
    } else {
      fks.forEach(fk => {
        console.log(`   ✅ ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });
      console.log('');
    }
    
    // 5. Verificar que las tablas referenciadas existen
    console.log('🔍 Verificando tablas referenciadas...');
    const [tablaComerciales] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Comerciales'
    `);
    if (tablaComerciales.length > 0) {
      console.log('   ✅ Tabla Comerciales existe');
    } else {
      console.log('   ❌ Tabla Comerciales NO existe');
    }
    
    const [tablaMarcas] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Marcas'
    `);
    if (tablaMarcas.length > 0) {
      console.log('   ✅ Tabla Marcas existe');
    } else {
      console.log('   ❌ Tabla Marcas NO existe');
    }
    console.log('');
    
    // 6. Verificar datos de ejemplo
    console.log('📊 Datos de ejemplo (primeros 5 registros):');
    const [datos] = await connection.query(`
      SELECT fmm.*, 
             c.Nombre as comercial_nombre,
             m.Nombre as marca_nombre
      FROM fijos_mensuales_marca fmm
      LEFT JOIN Comerciales c ON fmm.comercial_id = c.id
      LEFT JOIN Marcas m ON fmm.marca_id = m.id
      LIMIT 5
    `);
    
    if (datos.length > 0) {
      datos.forEach((d, i) => {
        console.log(`   ${i + 1}. Comercial: ${d.comercial_nombre || 'N/A'}, Marca: ${d.marca_nombre || 'N/A'}, Importe: €${d.importe}`);
      });
    } else {
      console.log('   ℹ️  No hay datos en la tabla');
    }
    console.log('');
    
    // 7. Verificar integridad referencial
    console.log('🔍 Verificando integridad referencial...');
    const [registrosInvalidos] = await connection.query(`
      SELECT fmm.id, fmm.comercial_id, fmm.marca_id
      FROM fijos_mensuales_marca fmm
      LEFT JOIN Comerciales c ON fmm.comercial_id = c.id
      LEFT JOIN Marcas m ON fmm.marca_id = m.id
      WHERE c.id IS NULL OR m.id IS NULL
    `);
    
    if (registrosInvalidos.length > 0) {
      console.log(`   ⚠️  Se encontraron ${registrosInvalidos.length} registros con referencias inválidas:`);
      registrosInvalidos.forEach(r => {
        console.log(`      - ID: ${r.id}, comercial_id: ${r.comercial_id}, marca_id: ${r.marca_id}`);
      });
    } else {
      console.log('   ✅ Todos los registros tienen referencias válidas');
    }
    console.log('');
    
    console.log('='.repeat(80));
    console.log('✅ VERIFICACIÓN COMPLETA');
    console.log('='.repeat(80));
    
    connection.release();
    await crm.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    
    if (connection) {
      connection.release();
    }
    
    await crm.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Ejecutar
verificarYActualizarTabla();
