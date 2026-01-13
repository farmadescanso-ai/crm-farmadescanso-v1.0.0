/**
 * Script para asignar Id_TipoCliente a los clientes según su nombre
 * - "Farmacia - " -> Farmacia
 * - "Parafarmacia" -> Parafarmacia
 * - "RPM" -> RPM
 * - etc.
 */

const crm = require('../config/mysql-crm');

async function asignarTiposClientes() {
  try {
    console.log('🚀 Iniciando asignación de tipos de clientes...\n');
    
    // Conectar a MySQL
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Obtener tipos de clientes
    const tiposClientes = await crm.query('SELECT id, Tipo FROM tipos_clientes ORDER BY id');
    console.log(`✅ ${tiposClientes.length} tipos de clientes encontrados:`);
    tiposClientes.forEach(t => console.log(`   - ID ${t.id}: ${t.Tipo}`));
    console.log('');
    
    // Crear mapa de tipos
    const tiposMap = new Map();
    tiposClientes.forEach(t => {
      tiposMap.set(t.Tipo.toLowerCase(), t.id);
    });
    
    // Obtener todos los clientes
    const clientes = await crm.getClientes();
    console.log(`📊 Procesando ${clientes.length} clientes...\n`);
    
    let actualizados = 0;
    let sinCambio = 0;
    const errores = [];
    
    for (const cliente of clientes) {
      try {
        const nombre = (cliente.Nombre_Razon_Social || cliente.Nombre || '').trim();
        const idCliente = cliente.Id || cliente.id;
        let tipoClienteId = null;
        let tipoEncontrado = null;
        
        if (!nombre) {
          sinCambio++;
          continue;
        }
        
        // Buscar tipo según el nombre
        const nombreLower = nombre.toLowerCase();
        
        // 1. Farmacia - nombres que comienzan con "Farmacia -"
        if (nombreLower.startsWith('farmacia -')) {
          tipoClienteId = tiposMap.get('farmacia');
          tipoEncontrado = 'Farmacia';
        }
        // 2. Parafarmacia
        else if (nombreLower.includes('parafarmacia')) {
          tipoClienteId = tiposMap.get('parafarmacia');
          tipoEncontrado = 'Parafarmacia';
        }
        // 3. RPM
        else if (nombreLower.includes('rpm') || nombreLower.includes('imas rpm')) {
          tipoClienteId = tiposMap.get('rpm');
          tipoEncontrado = 'RPM';
        }
        // 4. Clínica Dental
        else if (nombreLower.includes('clínica dental') || nombreLower.includes('clinica dental') || nombreLower.includes('dental')) {
          tipoClienteId = tiposMap.get('clínica dental');
          tipoEncontrado = 'Clínica Dental';
        }
        // 5. Distribuidor
        else if (nombreLower.includes('distribuidor') || nombreLower.includes('distribución') || nombreLower.includes('distribucion')) {
          tipoClienteId = tiposMap.get('distribuidor');
          tipoEncontrado = 'Distribuidor';
        }
        // 6. Web
        else if (nombreLower.includes('web') || nombreLower.includes('.com') || nombreLower.includes('online') || nombreLower.includes('ecommerce')) {
          tipoClienteId = tiposMap.get('web');
          tipoEncontrado = 'Web';
        }
        // 7. Particular (si no coincide con ningún otro)
        // Solo asignar si claramente es un particular (tiene nombre de persona sin "Farmacia")
        else if (!nombreLower.includes('farmacia') && !nombreLower.includes('parafarmacia') && 
                 !nombreLower.includes('sl') && !nombreLower.includes('sa') && !nombreLower.includes('cb') &&
                 !nombreLower.includes('sociedad') && !nombreLower.includes('limitada')) {
          // Puede ser particular, pero no lo asignamos automáticamente por ahora
          // tipoClienteId = tiposMap.get('particular');
          // tipoEncontrado = 'Particular';
        }
        
        // Solo actualizar si encontramos un tipo y es diferente del actual
        if (tipoClienteId && cliente.Id_TipoCliente !== tipoClienteId) {
          await crm.updateCliente(idCliente, { Id_TipoCliente: tipoClienteId });
          console.log(`✅ [${actualizados + 1}] Cliente ID ${idCliente}: "${nombre.substring(0, 50)}" -> ${tipoEncontrado} (ID: ${tipoClienteId})`);
          actualizados++;
        } else {
          sinCambio++;
        }
      } catch (error) {
        errores.push({
          cliente: cliente.Id || cliente.id,
          nombre: cliente.Nombre_Razon_Social || cliente.Nombre,
          error: error.message
        });
        console.error(`❌ Error actualizando cliente ID ${cliente.Id || cliente.id}: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ ASIGNACIÓN COMPLETADA');
    console.log('='.repeat(80));
    console.log(`📊 Resumen:`);
    console.log(`   ✅ Clientes actualizados: ${actualizados}`);
    console.log(`   ⏭️  Clientes sin cambios: ${sinCambio}`);
    console.log(`   ❌ Errores: ${errores.length}`);
    
    if (errores.length > 0) {
      console.log('\n❌ Errores encontrados:');
      errores.slice(0, 10).forEach(e => {
        console.log(`   - Cliente ID ${e.cliente}: ${e.nombre} - ${e.error}`);
      });
      if (errores.length > 10) {
        console.log(`   ... y ${errores.length - 10} errores más`);
      }
    }
    
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  }
}

asignarTiposClientes();

