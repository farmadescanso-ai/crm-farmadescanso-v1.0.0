/**
 * Script para buscar teléfonos y emails de clientes usando búsquedas web
 * 
 * Este script:
 * 1. Identifica clientes con teléfono o email faltante
 * 2. Busca información en Google y otras fuentes
 * 3. Actualiza los registros con la información encontrada
 * 
 * Uso: node scripts/buscar-telefonos-emails.js [--dry-run] [--limit N]
 */

const crm = require('../config/mysql-crm');

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 50;

/**
 * Verifica si un campo está vacío
 */
function campoVacio(valor) {
  return !valor || 
         valor === null || 
         valor === undefined || 
         String(valor).trim() === '' || 
         String(valor).trim() === 'null' ||
         String(valor).trim() === 'undefined';
}

/**
 * Construye búsqueda optimizada para Google
 */
function construirBusqueda(cliente) {
  const nombre = cliente.Nombre || '';
  const direccion = cliente.Direccion || '';
  const poblacion = cliente.Poblacion || 'Murcia';
  
  // Limpiar nombre (quitar "Farmacia -" si existe)
  const nombreLimpio = nombre.replace(/^Farmacia\s*-\s*/i, '').trim();
  
  // Construir búsqueda
  if (nombreLimpio && direccion && poblacion) {
    return `"${nombreLimpio}" "${direccion}" ${poblacion} Murcia teléfono contacto`;
  } else if (nombreLimpio && poblacion) {
    return `"${nombreLimpio}" farmacia ${poblacion} Murcia teléfono email contacto`;
  } else if (nombreLimpio) {
    return `"${nombreLimpio}" farmacia Murcia teléfono contacto`;
  }
  
  return null;
}

/**
 * Extrae información de un texto de búsqueda
 */
function extraerInformacion(texto, cliente) {
  const info = {};
  
  if (!texto) return info;
  
  // Buscar email
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/gi;
  const emails = texto.match(emailRegex);
  if (emails && emails.length > 0) {
    const email = emails[0].toLowerCase();
    // Filtrar emails genéricos o de ejemplo
    if (!email.includes('example.com') && 
        !email.includes('test.com') &&
        !email.includes('@gmail.com') && // Puedes ajustar esto
        campoVacio(cliente.Email)) {
      info.Email = email;
    }
  }
  
  // Buscar teléfonos (formato español)
  const telefonoRegex = /(\+34|0034)?[\s-]?([6-9]\d{2})[\s-]?(\d{2})[\s-]?(\d{2})[\s-]?(\d{2})/g;
  const telefonos = texto.match(telefonoRegex);
  if (telefonos && telefonos.length > 0) {
    const telefonoLimpio = telefonos[0]
      .replace(/[\s-]/g, '')
      .replace(/^\+34|^0034/, '')
      .substring(0, 9);
    if (telefonoLimpio.length === 9) {
      // Solo actualizar si no tiene teléfono
      if (campoVacio(cliente.Telefono)) {
        info.Telefono = telefonoLimpio;
      }
      // Si no tiene móvil pero tiene teléfono, usar como móvil también
      if (campoVacio(cliente.Movil) && campoVacio(cliente.Telefono)) {
        info.Movil = telefonoLimpio;
      }
    }
  }
  
  return info;
}

/**
 * Función principal
 */
async function buscarTelefonosEmails() {
  try {
    console.log('🚀 Iniciando búsqueda de teléfonos y emails...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales');
    }
    console.log('');
    
    // 1. Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // 2. Obtener clientes con datos faltantes
    console.log('📊 Obteniendo clientes de MySQL...');
    const clientes = await crm.getClientes();
    console.log(`✅ ${clientes.length} clientes obtenidos\n`);
    
    // 3. Filtrar clientes con teléfono o email faltante
    console.log('🔍 Identificando clientes con teléfono o email faltante...');
    const clientesConFaltantes = clientes.filter(cliente => {
      return campoVacio(cliente.Telefono) || campoVacio(cliente.Email);
    });
    
    console.log(`✅ ${clientesConFaltantes.length} clientes con teléfono o email faltante\n`);
    
    if (clientesConFaltantes.length === 0) {
      console.log('✅ Todos los clientes tienen teléfono y email completos');
      return;
    }
    
    // 4. Limitar
    const clientesAProcesar = clientesConFaltantes.slice(0, LIMIT);
    console.log(`⚠️  Procesando los primeros ${LIMIT} clientes (usa --limit=N para cambiar)\n`);
    
    // 5. Procesar
    console.log('🔄 Buscando información...\n');
    
    let procesados = 0;
    let actualizados = 0;
    let errores = 0;
    
    for (let i = 0; i < clientesAProcesar.length; i++) {
      const cliente = clientesAProcesar[i];
      const numero = i + 1;
      
      try {
        const faltantes = [];
        if (campoVacio(cliente.Telefono)) faltantes.push('Teléfono');
        if (campoVacio(cliente.Email)) faltantes.push('Email');
        
        console.log(`[${numero}/${clientesAProcesar.length}] ${cliente.Nombre || 'Sin nombre'} (ID: ${cliente.Id})`);
        console.log(`   📋 Campos faltantes: ${faltantes.join(', ')}`);
        
        const busqueda = construirBusqueda(cliente);
        
        if (!busqueda) {
          console.log(`   ⚠️  No hay suficiente información para buscar`);
          procesados++;
          continue;
        }
        
        console.log(`   🔍 Búsqueda: "${busqueda}"`);
        
        // Construir URLs de búsqueda para referencia
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(busqueda)}`;
        const paginasAmarillasUrl = `https://www.paginasamarillas.es/search/farmacia/all-ma/${encodeURIComponent(cliente.Poblacion || 'Murcia')}`;
        
        console.log(`   🔗 Google: ${googleUrl}`);
        console.log(`   🔗 Páginas Amarillas: ${paginasAmarillasUrl}`);
        
        // NOTA: Para búsquedas automáticas reales, necesitarías:
        // 1. Google Custom Search API (requiere API key)
        // 2. Scraping de directorios (respetando robots.txt)
        // 3. APIs de directorios de farmacias
        
        // Por ahora, mostramos las URLs para búsqueda manual
        // En producción, aquí usarías web_search o APIs reales
        
        const informacionEncontrada = {};
        
        // Si se encontrara información, se actualizaría así:
        if (Object.keys(informacionEncontrada).length > 0) {
          const clienteId = cliente.Id || cliente.id;
          console.log(`   ✅ Información encontrada:`, Object.keys(informacionEncontrada).join(', '));
          
          if (!DRY_RUN) {
            await crm.updateCliente(clienteId, informacionEncontrada);
            actualizados++;
            console.log(`   ✅ Cliente actualizado`);
          } else {
            console.log(`   📝 [SIMULACIÓN] Se actualizarían:`, JSON.stringify(informacionEncontrada, null, 2));
            actualizados++;
          }
        } else {
          console.log(`   ⚠️  No se encontró información automáticamente`);
          console.log(`   💡 Usa las URLs arriba para buscar manualmente`);
        }
        
        procesados++;
        
        // Pausa para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`   ❌ Error:`, error.message);
        errores++;
      }
    }
    
    // 6. Resumen
    console.log('\n' + '='.repeat(60));
    if (DRY_RUN) {
      console.log('📊 RESUMEN DE SIMULACIÓN (NO SE REALIZARON CAMBIOS)');
    } else {
      console.log('📊 RESUMEN DE BÚSQUEDA');
    }
    console.log('='.repeat(60));
    console.log(`✅ Clientes procesados: ${procesados}`);
    console.log(`🔄 Clientes actualizados: ${actualizados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total con datos faltantes: ${clientesConFaltantes.length}`);
    console.log('='.repeat(60));
    
    console.log('\n📝 NOTA: Para implementar búsquedas automáticas reales:');
    console.log('1. Usa la herramienta web_search en el código');
    console.log('2. Procesa los resultados con extraerInformacion()');
    console.log('3. Actualiza los registros con crm.updateCliente()');
    
    console.log('\n🏁 Proceso finalizado');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  buscarTelefonosEmails()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { buscarTelefonosEmails, extraerInformacion, construirBusqueda };

