/**
 * Script para eliminar clientes que no son clínicas dentales reales
 * (artículos, universidades, páginas informativas, etc.)
 */

const crm = require('../config/mysql-crm');

// IDs de clientes incorrectos a eliminar (de la ejecución anterior)
const IDs_INCORRECTOS = [
  1137, // ¿Cómo saber si un dentista es bueno o malo? Guía útil - Biogasteiz
  1138, // ¿Cómo elegir a un buen dentista? Pasos a seguir para elegirlo
  1139, // Salitre – Bogotá - Odontología de Marlon Becerra
  1140, // ¿Cómo saber si un dentista es bueno? 7 claves para reconocerlo
  1141, // Universidades de Odontología - 【Actualizado 2025 】 - Uniscopio
  1142, // Cuánto cobra un dentista en España |2025| - Cleardent
  1145, // Necesito un tratamiento dental pero no tengo dinero
  1146, // ¿Cómo elegir un buen dentista? Te damos los TIPS - Solución Dental
  1148  // ¿Cuál es el precio de los implantes dentales en 2025?
];

// Patrones de nombres que indican que NO es una clínica real
const PATRONES_INCORRECTOS = [
  /^¿/i, // Empieza con signo de interrogación
  /cómo/i,
  /cuánto/i,
  /cuál/i,
  /qué/i,
  /guía/i,
  /tips/i,
  /universidad/i,
  /colegio oficial/i,
  /junta de/i,
  /necesito/i,
  /precio/i,
  /actualizado/i,
  /bogotá/i,
  /biogasteiz/i,
  /uniscopio/i,
  /cleardent/i,
  /solución dental/i
];

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');

/**
 * Verifica si un nombre parece ser incorrecto (no es una clínica real)
 */
function esNombreIncorrecto(nombre) {
  if (!nombre) return true;
  const nombreLower = nombre.toLowerCase();
  return PATRONES_INCORRECTOS.some(patron => patron.test(nombre));
}

/**
 * Función principal
 */
async function limpiarClientesIncorrectos() {
  try {
    console.log('🧹 Iniciando limpieza de clientes incorrectos...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    let eliminados = 0;
    let errores = 0;
    
    // Eliminar por IDs específicos
    console.log('📋 Eliminando clientes por IDs específicos...\n');
    for (const id of IDs_INCORRECTOS) {
      try {
        // Verificar que existe
        const cliente = await crm.query('SELECT id, Nombre_Razon_Social FROM clientes WHERE id = ?', [id]);
        
        if (cliente.length === 0) {
          console.log(`  ⚠️  Cliente ID ${id} no encontrado`);
          continue;
        }
        
        const nombre = cliente[0].Nombre_Razon_Social;
        console.log(`  🗑️  Eliminando: ${nombre} (ID: ${id})`);
        
        if (!DRY_RUN) {
          await crm.query('DELETE FROM clientes WHERE id = ?', [id]);
          console.log(`  ✅ Eliminado: ${nombre}`);
        } else {
          console.log(`  [SIMULACIÓN] Se eliminaría: ${nombre}`);
        }
        
        eliminados++;
      } catch (error) {
        errores++;
        console.error(`  ❌ Error eliminando cliente ID ${id}: ${error.message}`);
      }
    }
    
    // Buscar y eliminar por patrones
    console.log('\n📋 Buscando clientes con patrones incorrectos...\n');
    const todosLosClientes = await crm.query(`
      SELECT id, Nombre_Razon_Social 
      FROM clientes 
      WHERE Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%'
      ORDER BY id DESC
      LIMIT 100
    `);
    
    console.log(`  🔍 Encontrados ${todosLosClientes.length} clientes relacionados con dental/odontología\n`);
    
    for (const cliente of todosLosClientes) {
      // Saltar si ya está en la lista de IDs incorrectos
      if (IDs_INCORRECTOS.includes(cliente.id)) {
        continue;
      }
      
      if (esNombreIncorrecto(cliente.Nombre_Razon_Social)) {
        try {
          console.log(`  🗑️  Eliminando: ${cliente.Nombre_Razon_Social} (ID: ${cliente.id})`);
          
          if (!DRY_RUN) {
            await crm.query('DELETE FROM clientes WHERE id = ?', [cliente.id]);
            console.log(`  ✅ Eliminado: ${cliente.Nombre_Razon_Social}`);
          } else {
            console.log(`  [SIMULACIÓN] Se eliminaría: ${cliente.Nombre_Razon_Social}`);
          }
          
          eliminados++;
        } catch (error) {
          errores++;
          console.error(`  ❌ Error eliminando cliente ID ${cliente.id}: ${error.message}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Limpieza completada');
    console.log('='.repeat(80));
    console.log(`📊 Resumen:`);
    console.log(`   🗑️  Clientes eliminados: ${eliminados}`);
    console.log(`   ❌ Errores: ${errores}`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  MODO SIMULACIÓN: Ejecuta sin --dry-run para eliminar realmente');
    }
    
  } catch (error) {
    console.error('\n❌ Error en limpieza:', error);
    console.error('Stack:', error.stack);
  } finally {
    await crm.disconnect();
  }
}

// Ejecutar
if (require.main === module) {
  limpiarClientesIncorrectos()
    .then(() => {
      console.log('\n✅ Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { limpiarClientesIncorrectos };
