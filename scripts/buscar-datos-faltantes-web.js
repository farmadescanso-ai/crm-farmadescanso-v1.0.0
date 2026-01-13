/**
 * Script para buscar datos faltantes de clientes usando búsquedas web reales
 * 
 * Este script:
 * 1. Identifica clientes con campos faltantes
 * 2. Busca información en Google, directorios de farmacias, etc.
 * 3. Actualiza los registros con la información encontrada
 * 
 * Uso: node scripts/buscar-datos-faltantes-web.js [--dry-run] [--limit N]
 * 
 * NOTA: Este script requiere que se ejecute manualmente con búsquedas web
 * ya que las APIs de búsqueda requieren configuración específica
 */

const crm = require('../config/mysql-crm');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 10; // Por defecto 10 para no sobrecargar

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
  
  // Construir búsqueda principal
  let busqueda = '';
  
  if (nombreLimpio && poblacion) {
    busqueda = `farmacia ${nombreLimpio} ${poblacion} Murcia`;
  } else if (nombreLimpio) {
    busqueda = `farmacia ${nombreLimpio} Murcia`;
  } else if (direccion && poblacion) {
    busqueda = `farmacia ${direccion} ${poblacion}`;
  }
  
  return busqueda;
}

/**
 * Extrae información de un texto
 */
function extraerInformacion(texto, cliente) {
  const info = {};
  
  if (!texto) return info;
  
  // Buscar email
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/gi;
  const emails = texto.match(emailRegex);
  if (emails && emails.length > 0) {
    const email = emails[0].toLowerCase();
    // Filtrar emails genéricos o de dominios comunes no relevantes
    if (!email.includes('example.com') && !email.includes('test.com')) {
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
      info.Telefono = telefonoLimpio;
    }
  }
  
  // Buscar códigos de distribuidoras (patrones comunes)
  const hefameRegex = /(?:hefame|hef)[\s:]*(\d{4,8})/i;
  const allianceRegex = /(?:alliance)[\s:]*(\d{4,8})/i;
  const cofaresRegex = /(?:cofares)[\s:]*(\d{4,8})/i;
  
  const hefameMatch = texto.match(hefameRegex);
  if (hefameMatch && hefameMatch[1]) {
    info.CodigoHefame = hefameMatch[1];
  }
  
  const allianceMatch = texto.match(allianceRegex);
  if (allianceMatch && allianceMatch[1]) {
    info.CodigoAlliance = allianceMatch[1];
  }
  
  const cofaresMatch = texto.match(cofaresRegex);
  if (cofaresMatch && cofaresMatch[1]) {
    info.CodigoCofares = cofaresMatch[1];
  }
  
  // Buscar IBAN (formato español)
  const ibanRegex = /ES\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/gi;
  const ibans = texto.match(ibanRegex);
  if (ibans && ibans.length > 0) {
    info.IBAN = ibans[0].replace(/[\s-]/g, '').toUpperCase();
  }
  
  // Buscar dirección mejorada
  const direccionRegex = /(?:calle|avenida|av\.?|c\/?|plaza|paseo)[\s,]+([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+(?:\d+)?)/i;
  const direccionMatch = texto.match(direccionRegex);
  if (direccionMatch && direccionMatch[1] && campoVacio(cliente.Direccion)) {
    info.Direccion = direccionMatch[1].trim();
  }
  
  return info;
}

/**
 * Busca información usando DuckDuckGo Instant Answer API (gratuita, sin API key)
 */
async function buscarEnDuckDuckGo(busqueda) {
  try {
    // DuckDuckGo no tiene API oficial, pero podemos usar su HTML
    // Por ahora, retornamos null para indicar que necesitamos otra fuente
    return null;
  } catch (error) {
    console.error(`   ⚠️  Error en búsqueda DuckDuckGo:`, error.message);
    return null;
  }
}

/**
 * Busca información de un cliente
 */
async function buscarInformacionCliente(cliente) {
  const camposFaltantes = identificarCamposFaltantes(cliente);
  
  if (camposFaltantes.length === 0) {
    return { encontrado: false, razon: 'No hay campos faltantes' };
  }
  
  const busqueda = construirBusqueda(cliente);
  
  if (!busqueda) {
    return { encontrado: false, razon: 'No hay suficiente información para buscar' };
  }
  
  console.log(`\n🔍 Buscando: "${busqueda}"`);
  console.log(`   📋 Campos faltantes: ${camposFaltantes.map(f => f.descripcion).join(', ')}`);
  
  // Construir URLs de búsqueda para que el usuario pueda buscarlas manualmente
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(busqueda)}`;
  const bormUrl = `https://www.borm.es/borm/documento?obj=bus&id=${encodeURIComponent(busqueda)}`;
  const paginasAmarillasUrl = `https://www.paginasamarillas.es/search/farmacia/all-ma/${encodeURIComponent(cliente.Poblacion || 'Murcia')}`;
  
  console.log(`   🔗 Google: ${googleUrl}`);
  console.log(`   🔗 BORM: ${bormUrl}`);
  console.log(`   🔗 Páginas Amarillas: ${paginasAmarillasUrl}`);
  
  // Por ahora, retornamos información vacía
  // En producción, aquí procesarías los resultados reales de las búsquedas
  // usando APIs de búsqueda o scraping (con permisos y respetando robots.txt)
  
  return {
    encontrado: false,
    razon: 'Búsqueda manual requerida (ver URLs arriba)',
    busqueda: busqueda,
    camposFaltantes: camposFaltantes,
    urls: {
      google: googleUrl,
      borm: bormUrl,
      paginasAmarillas: paginasAmarillasUrl
    }
  };
}

/**
 * Función principal
 */
async function buscarDatosFaltantes() {
  try {
    console.log('🚀 Iniciando búsqueda de datos faltantes...');
    console.log('⚠️  NOTA: Este script genera URLs de búsqueda para búsqueda manual');
    console.log('   Para búsquedas automáticas, se requiere configuración de APIs');
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
    
    // 4. Limitar
    const clientesAProcesar = clientesConFaltantes.slice(0, LIMIT);
    
    console.log(`⚠️  Procesando los primeros ${LIMIT} clientes (usa --limit=N para cambiar)\n`);
    
    // 5. Procesar cada cliente
    console.log('🔄 Generando URLs de búsqueda para cada cliente...\n');
    
    const resultados = [];
    
    for (let i = 0; i < clientesAProcesar.length; i++) {
      const { cliente, faltantes } = clientesAProcesar[i];
      const numero = i + 1;
      
      try {
        console.log(`[${numero}/${clientesAProcesar.length}] ${cliente.Nombre || 'Sin nombre'} (ID: ${cliente.Id})`);
        console.log(`   Campos faltantes: ${faltantes.map(f => f.campo).join(', ')}`);
        
        // Buscar información
        const resultado = await buscarInformacionCliente(cliente);
        resultados.push({
          cliente,
          resultado
        });
        
        // Pausa para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Error:`, error.message);
      }
    }
    
    // 6. Generar reporte
    console.log('\n' + '='.repeat(60));
    console.log('📊 REPORTE DE BÚSQUEDAS');
    console.log('='.repeat(60));
    console.log(`✅ Clientes procesados: ${resultados.length}`);
    console.log(`📊 Total con campos faltantes: ${clientesConFaltantes.length}`);
    console.log('='.repeat(60));
    
    console.log('\n📝 INSTRUCCIONES:');
    console.log('1. Usa las URLs generadas arriba para buscar información manualmente');
    console.log('2. Para búsquedas automáticas, configura:');
    console.log('   - Google Custom Search API (requiere API key)');
    console.log('   - Scraping de páginas (respetando robots.txt y términos de uso)');
    console.log('   - APIs de directorios de farmacias');
    console.log('3. Una vez encontrada la información, actualiza los registros manualmente');
    console.log('   o implementa la lógica de actualización automática');
    
    console.log('\n🏁 Proceso finalizado');
    
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
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { buscarDatosFaltantes, identificarCamposFaltantes };

