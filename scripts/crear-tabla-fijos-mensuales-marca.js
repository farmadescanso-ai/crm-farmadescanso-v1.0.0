const crm = require('../config/mysql-crm');

async function crearTablaFijosMensualesMarca() {
  let connection = null;
  
  try {
    await crm.connect();
    connection = await crm.pool.getConnection();
    
    console.log('🔄 Creando tabla fijos_mensuales_marca...\n');
    
    // Iniciar transacción
    await connection.query('START TRANSACTION');
    console.log('✅ Transacción iniciada\n');
    
    // 1. Crear tabla
    console.log('📝 Creando tabla fijos_mensuales_marca...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS fijos_mensuales_marca (
        id int NOT NULL AUTO_INCREMENT,
        comercial_id int NOT NULL,
        marca_id int NOT NULL,
        importe decimal(10,2) NOT NULL DEFAULT '0.00',
        activo tinyint(1) NOT NULL DEFAULT '1',
        fecha_creacion datetime DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_comercial_marca (comercial_id, marca_id),
        KEY idx_comercial (comercial_id),
        KEY idx_marca (marca_id),
        CONSTRAINT fk_fijos_comercial FOREIGN KEY (comercial_id) REFERENCES Comerciales (id) ON DELETE CASCADE ON UPDATE RESTRICT,
        CONSTRAINT fk_fijos_marca FOREIGN KEY (marca_id) REFERENCES Marcas (id) ON DELETE CASCADE ON UPDATE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla creada correctamente\n');
    
    // 2. Verificar si hay datos existentes en comerciales.fijo_mensual
    console.log('🔍 Verificando fijos mensuales existentes en comerciales...');
    const [comercialesConFijo] = await connection.query(`
      SELECT id, fijo_mensual 
      FROM comerciales 
      WHERE fijo_mensual IS NOT NULL AND fijo_mensual > 0
    `);
    
    console.log(`📊 Comerciales con fijo_mensual: ${comercialesConFijo.length}\n`);
    
    // 3. Obtener todas las marcas
    const [marcas] = await connection.query('SELECT id, Nombre FROM marcas ORDER BY Nombre');
    console.log(`📋 Marcas encontradas: ${marcas.length}`);
    marcas.forEach(m => {
      console.log(`   - ID: ${m.id}, Nombre: ${m.Nombre}`);
    });
    console.log('');
    
    // 4. Migrar datos existentes si hay
    if (comercialesConFijo.length > 0 && marcas.length > 0) {
      console.log('📝 Migrando datos existentes...');
      let migrados = 0;
      
      for (const comercial of comercialesConFijo) {
        const fijoMensual = parseFloat(comercial.fijo_mensual || 0);
        const importePorMarca = fijoMensual / marcas.length;
        
        for (const marca of marcas) {
          try {
            await connection.query(`
              INSERT INTO fijos_mensuales_marca (comercial_id, marca_id, importe, activo)
              VALUES (?, ?, ?, 1)
              ON DUPLICATE KEY UPDATE 
                importe = VALUES(importe),
                fecha_actualizacion = CURRENT_TIMESTAMP
            `, [comercial.id, marca.id, importePorMarca]);
            migrados++;
          } catch (err) {
            console.warn(`⚠️  Error migrando comercial ${comercial.id} marca ${marca.id}:`, err.message);
          }
        }
      }
      
      console.log(`✅ ${migrados} registros migrados\n`);
    } else {
      console.log('ℹ️  No hay datos para migrar\n');
    }
    
    // 5. Verificar resultado
    const [totalRegistros] = await connection.query('SELECT COUNT(*) as count FROM fijos_mensuales_marca');
    console.log(`📊 Total de registros en fijos_mensuales_marca: ${totalRegistros[0].count}\n`);
    
    // Confirmar transacción
    await connection.query('COMMIT');
    console.log('✅ Transacción confirmada\n');
    
    console.log('='.repeat(80));
    console.log('📊 RESUMEN');
    console.log('='.repeat(80));
    console.log('✅ Tabla fijos_mensuales_marca creada correctamente');
    console.log(`✅ ${totalRegistros[0].count} registros en la tabla`);
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
crearTablaFijosMensualesMarca();
