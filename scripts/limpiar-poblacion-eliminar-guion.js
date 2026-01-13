/**
 * Script para limpiar la columna Población eliminando el texto desde el guion "-" hasta el final
 * 
 * Ejemplos:
 * - "Nonduermas-murcia" → "Nonduermas"
 * - "Pozo Estrecho-Cartagena" → "Pozo Estrecho"
 * - "Santiago de la Ribera-San Javier" → "Santiago de la Ribera"
 * 
 * Uso: node scripts/limpiar-poblacion-eliminar-guion.js [--dry-run]
 */

const crm = require('../config/mysql-crm');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');

/**
 * Limpia el nombre de población eliminando todo desde el guion hasta el final
 */
function limpiarPoblacion(poblacion) {
  if (!poblacion || typeof poblacion !== 'string') return poblacion;
  
  // Buscar el guion y eliminar todo desde ahí hasta el final
  const indiceGuion = poblacion.indexOf('-');
  if (indiceGuion !== -1) {
    return poblacion.substring(0, indiceGuion).trim();
  }
  
  return poblacion.trim();
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando limpieza de columna Población...\n');
    
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios en la BD\n');
    }
    
    // Conectar a la BD
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener todos los clientes
    const clientes = await crm.getClientes();
    console.log(`📊 Total de clientes: ${clientes.length}\n`);
    
    // Estadísticas
    let clientesProcesados = 0;
    let clientesActualizados = 0;
    
    console.log('🔍 Procesando clientes...\n');
    
    // Procesar cada cliente
    for (const cliente of clientes) {
      const clienteId = cliente.Id || cliente.id;
      const poblacionOriginal = cliente.Poblacion || cliente.poblacion || null;
      
      if (poblacionOriginal && typeof poblacionOriginal === 'string') {
        const poblacionLimpia = limpiarPoblacion(poblacionOriginal);
        
        // Solo actualizar si hubo cambios
        if (poblacionLimpia !== poblacionOriginal) {
          clientesActualizados++;
          
          console.log(`📝 Cliente ID ${clienteId}: ${cliente.Nombre_Razon_Social || cliente.Nombre || 'Sin nombre'}`);
          console.log(`   Población: "${poblacionOriginal}" -> "${poblacionLimpia}"`);
          
          if (!DRY_RUN) {
            const sql = `UPDATE clientes SET Poblacion = ? WHERE Id = ?`;
            await crm.query(sql, [poblacionLimpia, clienteId]);
            console.log(`   ✅ Actualizado en BD`);
          } else {
            console.log(`   ⚠️  [SIMULACIÓN] No se actualizó`);
          }
          console.log('');
        }
      }
      
      clientesProcesados++;
      
      // Mostrar progreso cada 100 clientes
      if (clientesProcesados % 100 === 0) {
        console.log(`📊 Progreso: ${clientesProcesados}/${clientes.length} clientes procesados\n`);
      }
    }
    
    console.log('='.repeat(60));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(60));
    console.log(`Total de clientes procesados: ${clientesProcesados}`);
    console.log(`Clientes actualizados: ${clientesActualizados}`);
    console.log('='.repeat(60));
    
    if (DRY_RUN) {
      console.log('\n⚠️  MODO SIMULACIÓN: No se realizaron cambios reales');
      console.log('   Ejecuta sin --dry-run para aplicar los cambios\n');
    } else {
      console.log('\n✅ Proceso completado exitosamente\n');
    }
    
    await crm.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await crm.disconnect();
    process.exit(1);
  }
}

// Ejecutar
main();
