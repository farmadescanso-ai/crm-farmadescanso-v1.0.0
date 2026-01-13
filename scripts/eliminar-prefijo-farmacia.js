/**
 * Script para eliminar el prefijo "Farmacia - " de los nombres de clientes
 * 
 * Busca todos los clientes que tengan "Farmacia - " al inicio del nombre
 * y elimina ese prefijo, dejando solo el nombre.
 * 
 * Uso:
 *   node scripts/eliminar-prefijo-farmacia.js          # Modo simulación (por defecto)
 *   node scripts/eliminar-prefijo-farmacia.js --apply  # Aplicar cambios reales
 */

require('dotenv').config();
const crm = require('../config/mysql-crm');

const PREFIJO = 'Farmacia - ';
const DRY_RUN = !process.argv.includes('--apply');

async function eliminarPrefijoFarmacia() {
  
  try {
    console.log('🔌 Conectando a la base de datos...');
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    if (DRY_RUN) {
      console.log('🔍 MODO SIMULACIÓN - No se realizarán cambios reales\n');
    } else {
      console.log('⚠️  MODO REAL - Se aplicarán los cambios\n');
    }
    
    // Obtener todos los clientes
    console.log('📋 Obteniendo lista de clientes...');
    const clientes = await crm.getClientes();
    console.log(`✅ Obtenidos ${clientes.length} clientes\n`);
    
    // Filtrar clientes que tienen el prefijo (buscando variaciones)
    const clientesConPrefijo = clientes.filter(cliente => {
      const nombre = cliente.Nombre_Razon_Social || cliente.Nombre || cliente.nombre || '';
      const nombreTrim = nombre.trim();
      // Buscar variaciones del prefijo
      return nombreTrim.startsWith(PREFIJO) ||
             nombreTrim.startsWith('Farmacia-') ||
             nombreTrim.startsWith('FARMACIA -') ||
             nombreTrim.startsWith('FARMACIA-') ||
             nombreTrim.startsWith('farmacia -') ||
             nombreTrim.startsWith('farmacia-');
    });
    
    console.log(`🔍 Encontrados ${clientesConPrefijo.length} clientes con el prefijo "${PREFIJO}"\n`);
    
    if (clientesConPrefijo.length === 0) {
      console.log('✅ No hay clientes que actualizar.');
      console.log('\n📋 Mostrando algunos nombres de ejemplo para verificación:\n');
      const ejemplos = clientes.slice(0, 10);
      ejemplos.forEach((cliente, index) => {
        const nombre = cliente.Nombre_Razon_Social || cliente.Nombre || cliente.nombre || '';
        console.log(`${index + 1}. ID: ${cliente.Id || cliente.id} - "${nombre.substring(0, 60)}${nombre.length > 60 ? '...' : ''}"`);
      });
      return;
    }
    
    // Mostrar lista de clientes a actualizar
    console.log('📝 Clientes que se actualizarán:\n');
    clientesConPrefijo.forEach((cliente, index) => {
      const nombreActual = cliente.Nombre_Razon_Social || cliente.Nombre || cliente.nombre || '';
      // Eliminar cualquier variación del prefijo
      let nombreNuevo = nombreActual.trim();
      const prefijos = [
        'Farmacia - ',
        'Farmacia-',
        'FARMACIA -',
        'FARMACIA-',
        'farmacia -',
        'farmacia-'
      ];
      for (const prefijo of prefijos) {
        if (nombreNuevo.startsWith(prefijo)) {
          nombreNuevo = nombreNuevo.substring(prefijo.length).trim();
          break;
        }
      }
      console.log(`${index + 1}. ID: ${cliente.Id || cliente.id}`);
      console.log(`   Antes: "${nombreActual}"`);
      console.log(`   Después: "${nombreNuevo}"`);
      console.log('');
    });
    
    if (DRY_RUN) {
      console.log('💡 Para aplicar estos cambios, ejecuta el script con --apply:');
      console.log('   node scripts/eliminar-prefijo-farmacia.js --apply\n');
      return;
    }
    
    // Confirmar antes de aplicar
    console.log('⚠️  ¿Deseas continuar con la actualización? (Ctrl+C para cancelar)');
    console.log('   Presiona Enter para continuar...\n');
    
    // Esperar un momento para que el usuario pueda cancelar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Actualizar cada cliente
    let actualizados = 0;
    let errores = 0;
    
    console.log('🔄 Actualizando clientes...\n');
    
    for (const cliente of clientesConPrefijo) {
      try {
        const nombreActual = cliente.Nombre_Razon_Social || cliente.Nombre || cliente.nombre || '';
        // Eliminar cualquier variación del prefijo
        let nombreNuevo = nombreActual.trim();
        const prefijos = [
          'Farmacia - ',
          'Farmacia-',
          'FARMACIA -',
          'FARMACIA-',
          'farmacia -',
          'farmacia-'
        ];
        for (const prefijo of prefijos) {
          if (nombreNuevo.startsWith(prefijo)) {
            nombreNuevo = nombreNuevo.substring(prefijo.length).trim();
            break;
          }
        }
        const clienteId = cliente.Id || cliente.id;
        
        console.log(`[${actualizados + errores + 1}/${clientesConPrefijo.length}] Actualizando cliente ID ${clienteId}...`);
        console.log(`   "${nombreActual}" → "${nombreNuevo}"`);
        
        await crm.updateCliente(clienteId, { Nombre_Razon_Social: nombreNuevo });
        
        console.log(`   ✅ Actualizado correctamente\n`);
        actualizados++;
        
        // Pequeña pausa para no sobrecargar la base de datos
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`   ❌ Error actualizando cliente ID ${cliente.Id || cliente.id}:`, error.message);
        console.error(`   Stack:`, error.stack);
        console.error('');
        errores++;
      }
    }
    
    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN');
    console.log('='.repeat(60));
    console.log(`✅ Clientes actualizados: ${actualizados}`);
    if (errores > 0) {
      console.log(`❌ Errores: ${errores}`);
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error en el proceso:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (crm && crm.pool) {
      await crm.disconnect();
      console.log('\n🔌 Desconectado de la base de datos');
    }
  }
}

// Ejecutar el script
eliminarPrefijoFarmacia()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });

