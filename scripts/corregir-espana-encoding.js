/**
 * Script para corregir el problema de codificación "Espa├▒a" -> "España"
 * en las tablas Paises y Provincias
 * 
 * Uso: node scripts/corregir-espana-encoding.js
 */

const crm = require('../config/mysql-crm');

async function corregirEspanaEncoding() {
  try {
    console.log('🚀 Iniciando corrección de codificación "Espa├▒a" -> "España"\n');
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Obtener una conexión directa para las transacciones
    const connection = await crm.pool.getConnection();
    
    try {
      // Iniciar transacción
      console.log('🔄 Iniciando transacción...');
      await connection.query('START TRANSACTION');
      
      // 1. Buscar y contar registros con "Espa├▒a" en la tabla paises
      console.log('🔍 Buscando registros en tabla `paises`...');
      const [paisesAfectados] = await connection.query(
        "SELECT * FROM `paises` WHERE `Nombre_pais` LIKE '%Espa├▒a%' OR `Nombre_pais` = 'Espa├▒a'"
      );
      
      console.log(`   Encontrados ${paisesAfectados.length} registros con problema de codificación`);
      
      if (paisesAfectados.length > 0) {
        console.log('   Registros encontrados:');
        paisesAfectados.forEach(p => {
          console.log(`     - ID: ${p.id}, Id_pais: ${p.Id_pais}, Nombre_pais: "${p.Nombre_pais}"`);
        });
        
        // Actualizar registros en paises
        console.log('\n🗑️  Corrigiendo registros en tabla `paises`...');
        const [resultPaises] = await connection.query(
          "UPDATE `paises` SET `Nombre_pais` = REPLACE(`Nombre_pais`, 'Espa├▒a', 'España') WHERE `Nombre_pais` LIKE '%Espa├▒a%' OR `Nombre_pais` = 'Espa├▒a'"
        );
        console.log(`   ✅ ${resultPaises.affectedRows} registros actualizados en 'paises'`);
      } else {
        console.log('   ✅ No se encontraron registros con problema en `paises`');
      }
      
      // 2. Buscar y contar registros con "Espa├▒a" en la tabla provincias
      console.log('\n🔍 Buscando registros en tabla `provincias`...');
      const [provinciasAfectadas] = await connection.query(
        "SELECT * FROM `provincias` WHERE `Pais` LIKE '%Espa├▒a%' OR `Pais` = 'Espa├▒a'"
      );
      
      console.log(`   Encontrados ${provinciasAfectadas.length} registros con problema de codificación`);
      
      if (provinciasAfectadas.length > 0) {
        console.log('   Registros encontrados:');
        provinciasAfectadas.forEach(p => {
          console.log(`     - ID: ${p.id}, Nombre: ${p.Nombre}, Pais: "${p.Pais}"`);
        });
        
        // Actualizar registros en provincias
        console.log('\n🗑️  Corrigiendo registros en tabla `provincias`...');
        const [resultProvincias] = await connection.query(
          "UPDATE `provincias` SET `Pais` = REPLACE(`Pais`, 'Espa├▒a', 'España') WHERE `Pais` LIKE '%Espa├▒a%' OR `Pais` = 'Espa├▒a'"
        );
        console.log(`   ✅ ${resultProvincias.affectedRows} registros actualizados en 'provincias'`);
      } else {
        console.log('   ✅ No se encontraron registros con problema en `provincias`');
      }
      
      // Confirmar transacción
      await connection.query('COMMIT');
      console.log('\n✅ Transacción confirmada\n');
      
      // Verificar que los cambios se aplicaron correctamente
      console.log('🔍 Verificando cambios...');
      
      const [paisesVerificados] = await connection.query(
        "SELECT COUNT(*) as total FROM `paises` WHERE `Nombre_pais` LIKE '%Espa├▒a%' OR `Nombre_pais` = 'Espa├▒a'"
      );
      
      const [provinciasVerificadas] = await connection.query(
        "SELECT COUNT(*) as total FROM `provincias` WHERE `Pais` LIKE '%Espa├▒a%' OR `Pais` = 'Espa├▒a'"
      );
      
      const [paisesCorrectos] = await connection.query(
        "SELECT COUNT(*) as total FROM `paises` WHERE `Nombre_pais` LIKE '%España%'"
      );
      
      const [provinciasCorrectas] = await connection.query(
        "SELECT COUNT(*) as total FROM `provincias` WHERE `Pais` = 'España'"
      );
      
      console.log(`   Registros con "Espa├▒a" restantes en paises: ${paisesVerificados[0].total}`);
      console.log(`   Registros con "España" correctos en paises: ${paisesCorrectos[0].total}`);
      console.log(`   Registros con "Espa├▒a" restantes en provincias: ${provinciasVerificadas[0].total}`);
      console.log(`   Registros con "España" correctos en provincias: ${provinciasCorrectas[0].total}`);
      
      if (paisesVerificados[0].total === 0 && provinciasVerificadas[0].total === 0) {
        console.log('\n✅ Corrección completada exitosamente');
      } else {
        console.log('\n⚠️  ADVERTENCIA: Aún quedan registros con problema de codificación');
      }
      
      // Liberar conexión
      connection.release();
      
    } catch (error) {
      // Revertir transacción en caso de error
      console.error('❌ Error durante la corrección:', error.message);
      await connection.query('ROLLBACK');
      console.log('🔄 Transacción revertida');
      connection.release();
      throw error;
    }
    
    // Desconectar
    await crm.disconnect();
    console.log('🔌 Desconectado de MySQL');
    
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar el script
corregirEspanaEncoding();
