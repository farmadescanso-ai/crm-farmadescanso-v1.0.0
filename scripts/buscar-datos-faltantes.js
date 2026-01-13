/**
 * Script para buscar datos faltantes de clientes en Google, BORM y otras fuentes públicas
 * 
 * Este script:
 * 1. Identifica clientes con campos faltantes
 * 2. Busca información en Google, BORM, directorios de farmacias, etc.
 * 3. Actualiza los registros con la información encontrada
 * 
 * Uso: node scripts/buscar-datos-faltantes.js [--dry-run] [--limit N]
 */

const crm = require('../config/mysql-crm');

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : null;

// Campos que queremos completar si faltan
const CAMPOS_IMPORTANTES = {
  Email: 'email',
  Telefono: 'teléfono',
  Movil: 'móvil',
  Direccion: 'dirección',
  CodigoHefame: 'código Hefame',
  CodigoAlliance: 'código Alliance',
  CodigoCofares: 'código Cofares',
  IBAN: 'IBAN',
  NumeroFarmacia: 'número de farmacia'
};

/**
 * Verifica si un campo está vacío o faltante
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
 * Identifica qué campos faltan en un cliente
 */
function identificarCamposFaltantes(cliente) {
  const faltantes = [];
  
  for (const [campo, descripcion] of Object.entries(CAMPOS_IMPORTANTES)) {
    if (campoVacio(cliente[campo])) {
      faltantes.push({ campo, descripcion });
    }
  }
  
  return faltantes;
}

/**
 * Construye una búsqueda de Google para un cliente
 */
function construirBusqueda(cliente) {
  const nombre = cliente.Nombre || '';
  const direccion = cliente.Direccion || '';
  const poblacion = cliente.Poblacion || 'Murcia';
  
  // Limpiar el nombre (quitar "Farmacia -" si existe)
  const nombreLimpio = nombre.replace(/^Farmacia\s*-\s*/i, '').trim();
  
  // Construir búsquedas específicas
  const busquedas = [];
  
  // Búsqueda principal: nombre + población
  if (nombreLimpio && poblacion) {
    busquedas.push(`farmacia ${nombreLimpio} ${poblacion} Murcia`);
  }
  
  // Búsqueda con dirección si existe
  if (direccion && poblacion) {
    busquedas.push(`farmacia ${direccion} ${poblacion}`);
  }
  
  // Búsqueda genérica si no hay mucha info
  if (nombreLimpio) {
    busquedas.push(`farmacia ${nombreLimpio} Murcia`);
  }
  
  return busquedas;
}

/**
 * Extrae información de un texto de búsqueda (simulado - en producción usarías APIs reales)
 */
function extraerInformacion(texto, cliente) {
  const info = {};
  
  // Buscar email
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/gi;
  const emails = texto.match(emailRegex);
  if (emails && emails.length > 0) {
    info.Email = emails[0];
  }
  
  // Buscar teléfonos (formato español)
  const telefonoRegex = /(\+34|0034)?[\s-]?[6-9]\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}/g;
  const telefonos = texto.match(telefonoRegex);
  if (telefonos && telefonos.length > 0) {
    const telefonoLimpio = telefonos[0].replace(/[\s-]/g, '').replace(/^\+34|^0034/, '');
    if (telefonoLimpio.length >= 9) {
      info.Telefono = telefonoLimpio;
    }
  }
  
  // Buscar códigos de distribuidoras
  const hefameRegex = /hefame[\s:]*(\d+)/i;
  const allianceRegex = /alliance[\s:]*(\d+)/i;
  const cofaresRegex = /cofares[\s:]*(\d+)/i;
  
  const hefameMatch = texto.match(hefameRegex);
  if (hefameMatch) {
    info.CodigoHefame = hefameMatch[1];
  }
  
  const allianceMatch = texto.match(allianceRegex);
  if (allianceMatch) {
    info.CodigoAlliance = allianceMatch[1];
  }
  
  const cofaresMatch = texto.match(cofaresRegex);
  if (cofaresMatch) {
    info.CodigoCofares = cofaresMatch[1];
  }
  
  // Buscar IBAN
  const ibanRegex = /ES\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/gi;
  const ibans = texto.match(ibanRegex);
  if (ibans && ibans.length > 0) {
    info.IBAN = ibans[0].replace(/\s/g, '');
  }
  
  return info;
}

/**
 * Busca información de un cliente en fuentes públicas
 */
async function buscarInformacionCliente(cliente) {
  const camposFaltantes = identificarCamposFaltantes(cliente);
  
  if (camposFaltantes.length === 0) {
    return { encontrado: false, razon: 'No hay campos faltantes' };
  }
  
  console.log(`\n🔍 Buscando información para: ${cliente.Nombre || 'Sin nombre'}`);
  console.log(`   📋 Campos faltantes: ${camposFaltantes.map(f => f.descripcion).join(', ')}`);
  
  const busquedas = construirBusqueda(cliente);
  const informacionEncontrada = {};
  
  // Nota: En un entorno real, aquí harías búsquedas web reales
  // Por ahora, simulamos la búsqueda y mostramos qué se buscaría
  
  for (const busqueda of busquedas) {
    console.log(`   🔎 Búsqueda: "${busqueda}"`);
    
    // En producción, aquí usarías:
    // - Google Custom Search API
    // - Scraping de páginas web (con permisos)
    // - APIs de directorios de farmacias
    // - BORM API o scraping
    
    // Por ahora, solo registramos la búsqueda
    // En un entorno real, procesarías los resultados aquí
  }
  
  // Simulación: retornamos información vacía
  // En producción, aquí procesarías los resultados reales de las búsquedas
  
  return {
    encontrado: false,
    razon: 'Búsqueda simulada (implementar búsquedas reales)',
    busquedas: busquedas,
    camposFaltantes: camposFaltantes
  };
}

/**
 * Función principal
 */
async function buscarDatosFaltantes() {
  try {
    console.log('🚀 Iniciando búsqueda de datos faltantes...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales');
    }
    console.log('');
    
    // 1. Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // 2. Obtener todos los clientes
    console.log('📊 Obteniendo clientes de MySQL...');
    let clientes = await crm.getClientes();
    console.log(`✅ ${clientes.length} clientes obtenidos\n`);
    
    // 3. Filtrar clientes con campos faltantes
    console.log('🔍 Identificando clientes con campos faltantes...');
    const clientesConFaltantes = [];
    
    for (const cliente of clientes) {
      const faltantes = identificarCamposFaltantes(cliente);
      if (faltantes.length > 0) {
        clientesConFaltantes.push({
          cliente,
          faltantes
        });
      }
    }
    
    console.log(`✅ ${clientesConFaltantes.length} clientes con campos faltantes encontrados\n`);
    
    if (clientesConFaltantes.length === 0) {
      console.log('✅ Todos los clientes tienen los campos importantes completos');
      return;
    }
    
    // 4. Limitar si se especificó
    const clientesAProcesar = LIMIT 
      ? clientesConFaltantes.slice(0, LIMIT)
      : clientesConFaltantes;
    
    if (LIMIT) {
      console.log(`⚠️  Procesando solo los primeros ${LIMIT} clientes (usa --limit=N para cambiar)\n`);
    }
    
    // 5. Procesar cada cliente
    console.log('🔄 Procesando clientes...\n');
    
    let procesados = 0;
    let actualizados = 0;
    let errores = 0;
    
    for (let i = 0; i < clientesAProcesar.length; i++) {
      const { cliente, faltantes } = clientesAProcesar[i];
      const numero = i + 1;
      
      try {
        console.log(`[${numero}/${clientesAProcesar.length}] Procesando: ${cliente.Nombre || 'Sin nombre'} (ID: ${cliente.Id})`);
        console.log(`   Campos faltantes: ${faltantes.map(f => f.campo).join(', ')}`);
        
        // Buscar información
        const resultado = await buscarInformacionCliente(cliente);
        
        if (resultado.encontrado && resultado.informacion) {
          // Actualizar cliente
          const clienteId = cliente.Id || cliente.id;
          console.log(`   ✅ Información encontrada, actualizando...`);
          
          if (!DRY_RUN) {
            await crm.updateCliente(clienteId, resultado.informacion);
            actualizados++;
          } else {
            console.log(`   📝 [SIMULACIÓN] Se actualizarían los campos:`, Object.keys(resultado.informacion).join(', '));
            actualizados++;
          }
        } else {
          console.log(`   ⚠️  ${resultado.razon || 'No se encontró información'}`);
        }
        
        procesados++;
        
        // Pausa para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`   ❌ Error procesando cliente:`, error.message);
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
    console.log(`📊 Total con campos faltantes: ${clientesConFaltantes.length}`);
    console.log('='.repeat(60));
    
    if (DRY_RUN) {
      console.log('\n✅ Simulación completada');
      console.log('💡 Para aplicar los cambios, ejecuta el script sin el flag --dry-run');
      console.log('⚠️  NOTA: Este script necesita implementar búsquedas reales en Google/BORM');
    } else {
      if (errores === 0) {
        console.log('\n✅ Búsqueda completada exitosamente');
      } else {
        console.log(`\n⚠️ Búsqueda completada con ${errores} error(es)`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error en la búsqueda:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  buscarDatosFaltantes()
    .then(() => {
      console.log('\n🏁 Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { buscarDatosFaltantes, identificarCamposFaltantes };

