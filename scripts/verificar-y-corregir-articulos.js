const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'farmadescanso'
    });

    console.log('=== VERIFICANDO ESTRUCTURA DE LA TABLA articulos ===\n');

    // Verificar estructura
    const [columns] = await connection.execute('DESCRIBE articulos');
    console.log('Columnas existentes:');
    columns.forEach(col => {
      console.log(`  ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Verificar si existe columna 'Código' o 'Codigo'
    const codigoColumn = columns.find(col => 
      col.Field === 'Código' || col.Field === 'Codigo' || col.Field.toLowerCase() === 'codigo'
    );

    if (codigoColumn) {
      console.log(`\n⚠️  ADVERTENCIA: Se encontró columna '${codigoColumn.Field}'`);
      console.log('   Esta columna puede causar conflictos. Verificando si tiene datos...');
      
      const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM articulos WHERE \`${codigoColumn.Field}\` IS NOT NULL AND \`${codigoColumn.Field}\` != ''`);
      const count = rows[0].count;
      
      if (count > 0) {
        console.log(`   La columna tiene ${count} registros con datos.`);
        console.log('   Opciones:');
        console.log('   1. Copiar datos de Código a SKU si SKU está vacío');
        console.log('   2. Eliminar la columna Código');
        console.log('\n   Ejecutando opción 1: Copiar datos...');
        
        await connection.execute(`
          UPDATE articulos 
          SET SKU = \`${codigoColumn.Field}\`
          WHERE (SKU IS NULL OR SKU = '') 
          AND \`${codigoColumn.Field}\` IS NOT NULL 
          AND \`${codigoColumn.Field}\` != ''
        `);
        
        console.log('   ✅ Datos copiados de Código a SKU');
      }
      
      console.log(`\n   Eliminando columna '${codigoColumn.Field}'...`);
      await connection.execute(`ALTER TABLE articulos DROP COLUMN \`${codigoColumn.Field}\``);
      console.log(`   ✅ Columna '${codigoColumn.Field}' eliminada`);
    } else {
      console.log('\n✅ No se encontró columna Código/Codigo conflictiva');
    }

    // Verificar otras columnas que puedan causar problemas
    const problematicColumns = ['Presentación', 'EAN 13', 'Unidades / Caja', 'OK_KO', 'OK/KO'];
    for (const colName of problematicColumns) {
      const col = columns.find(c => c.Field === colName);
      if (col) {
        console.log(`\n⚠️  ADVERTENCIA: Se encontró columna problemática '${colName}'`);
        console.log(`   Esta columna debería tener otro nombre. Verificando...`);
        
        // Determinar el nombre correcto
        let correctName = '';
        if (colName === 'Presentación') correctName = 'Presentacion';
        else if (colName === 'EAN 13') correctName = 'EAN13';
        else if (colName === 'Unidades / Caja') correctName = 'Unidades_Caja';
        else if (colName === 'OK_KO' || colName === 'OK/KO') correctName = 'Activo';
        
        if (correctName) {
          const correctCol = columns.find(c => c.Field === correctName);
          if (!correctCol) {
            console.log(`   Renombrando '${colName}' a '${correctName}'...`);
            await connection.execute(`ALTER TABLE articulos CHANGE \`${colName}\` \`${correctName}\` ${col.Type}`);
            console.log(`   ✅ Columna renombrada`);
          } else {
            console.log(`   ⚠️  La columna '${correctName}' ya existe. Verificando datos...`);
            const [dataRows] = await connection.execute(`SELECT COUNT(*) as count FROM articulos WHERE \`${colName}\` IS NOT NULL`);
            if (dataRows[0].count > 0) {
              console.log(`   Copiando datos de '${colName}' a '${correctName}'...`);
              await connection.execute(`
                UPDATE articulos 
                SET \`${correctName}\` = \`${colName}\`
                WHERE \`${correctName}\` IS NULL OR \`${correctName}\` = ''
              `);
            }
            console.log(`   Eliminando columna '${colName}'...`);
            await connection.execute(`ALTER TABLE articulos DROP COLUMN \`${colName}\``);
            console.log(`   ✅ Columna eliminada`);
          }
        }
      }
    }

    // Verificar estructura final
    console.log('\n=== ESTRUCTURA FINAL ===');
    const [finalColumns] = await connection.execute('DESCRIBE articulos');
    finalColumns.forEach(col => {
      console.log(`  ${col.Field} (${col.Type})`);
    });

    console.log('\n✅ Verificación y corrección completada');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
})();

