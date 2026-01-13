/**
 * Script mejorado para buscar y actualizar datos faltantes de clientes
 * 
 * Busca información disponible públicamente:
 * - Teléfonos y emails (Google, directorios)
 * - Direcciones completas
 * - Información de contacto
 * 
 * NOTA: Los códigos de distribuidoras (Hefame, Alliance, Cofares) 
 * son internos y generalmente no están disponibles públicamente.
 * 
 * Uso: node scripts/buscar-y-actualizar-datos.js [--dry-run] [--limit N]
 */

const crm = require('../config/mysql-crm');

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 20;

// Campos que podemos buscar públicamente
const CAMPOS_BUSCABLES = {
  Email: 'email',
  Telefono: 'teléfono',
  Movil: 'móvil',
  Direccion: 'dirección completa'
};

// Campos que NO están disponibles públicamente (requieren acceso interno)
const CAMPOS_INTERNOS = {
  CodigoHefame: 'código Hefame (interno)',
  CodigoAlliance: 'código Alliance (interno)',
  CodigoCofares: 'código Cofares (interno)',
  IBAN: 'IBAN (privado)',
  NumeroFarmacia: 'número de farmacia (interno)'
};

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
 * Identifica campos faltantes buscables
 */
function identificarCamposFaltantesBuscables(cliente) {
  const faltantes = [];
  
  for (const [campo, descripcion] of Object.entries(CAMPOS_BUSCABLES)) {
    if (campoVacio(cliente[campo])) {
      faltantes.push({ campo, descripcion });
    }
  }
  
  return faltantes;
}

/**
 * Construye búsqueda optimizada
 */
function construirBusqueda(cliente) {
  const nombre = cliente.Nombre || '';
  const direccion = cliente.Direccion || '';
  const poblacion = cliente.Poblacion || 'Murcia';
  
  // Limpiar nombre
  const nombreLimpio = nombre.replace(/^Farmacia\s*-\s*/i, '').trim();
  
  // Construir búsqueda
  if (nombreLimpio && poblacion) {
    return `"${nombreLimpio}" farmacia ${poblacion} Murcia contacto teléfono email`;
  } else if (nombreLimpio) {
    return `"${nombreLimpio}" farmacia Murcia contacto`;
  }
  
  return null;
}

/**
 * Simula búsqueda y extracción (en producción usarías APIs reales)
 * 
 * Para implementar búsquedas reales, puedes usar:
 * 1. Google Custom Search API (requiere API key)
 * 2. Scraping de directorios (respetando robots.txt)
 * 3. APIs de directorios de farmacias
 */
async function buscarInformacionPublica(cliente) {
  const busqueda = construirBusqueda(cliente);
  
  if (!busqueda) {
    return {
      encontrado: false,
      razon: 'No hay suficiente información para buscar'
    };
  }
  
  // URLs de búsqueda
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(busqueda)}`;
  const farmacontigoUrl = `https://www.farmacontigo.es/murcia/`;
  const paginasAmarillasUrl = `https://www.paginasamarillas.es/search/farmacia/all-ma/${encodeURIComponent(cliente.Poblacion || 'Murcia')}`;
  
  console.log(`   🔗 Google: ${googleUrl}`);
  console.log(`   🔗 Farmacontigo: ${farmacontigoUrl}`);
  console.log(`   🔗 Páginas Amarillas: ${paginasAmarillasUrl}`);
  
  // NOTA: Aquí implementarías la búsqueda real
  // Por ahora, retornamos información vacía para que el usuario
  // pueda buscar manualmente usando las URLs
  
  return {
    encontrado: false,
    razon: 'Búsqueda manual requerida (ver URLs arriba)',
    busqueda: busqueda,
    urls: {
      google: googleUrl,
      farmacontigo: farmacontigoUrl,
      paginasAmarillas: paginasAmarillasUrl
    }
  };
}

/**
 * Función principal
 */
async function buscarYActualizarDatos() {
  try {
    console.log('🚀 Iniciando búsqueda de datos faltantes...');
    console.log('📋 Buscando información públicamente disponible:');
    console.log('   ✅ Email, Teléfono, Móvil, Dirección');
    console.log('   ⚠️  NO disponibles públicamente:');
    console.log('      - Códigos de distribuidoras (Hefame, Alliance, Cofares)');
    console.log('      - IBAN (datos bancarios privados)');
    console.log('      - Número de farmacia (interno)');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales');
    }
    console.log('');
    
    // 1. Conectar a NocoDB
    console.log('📡 Conectando a NocoDB...');
    await crm.connect();
    console.log('✅ Conectado a NocoDB\n');
    
    // 2. Obtener clientes
    console.log('📊 Obteniendo clientes de NocoDB...');
    const clientes = await crm.getClientes();
    console.log(`✅ ${clientes.length} clientes obtenidos\n`);
    
    // 3. Filtrar clientes con campos buscables faltantes
    console.log('🔍 Identificando clientes con campos buscables faltantes...');
    const clientesConFaltantes = [];
    
    for (const cliente of clientes) {
      const faltantes = identificarCamposFaltantesBuscables(cliente);
      if (faltantes.length > 0) {
        clientesConFaltantes.push({
          cliente,
          faltantes
        });
      }
    }
    
    console.log(`✅ ${clientesConFaltantes.length} clientes con campos buscables faltantes\n`);
    
    if (clientesConFaltantes.length === 0) {
      console.log('✅ Todos los clientes tienen los campos buscables completos');
      console.log('\n⚠️  NOTA: Los códigos de distribuidoras deben obtenerse de:');
      console.log('   - Las propias distribuidoras (Hefame, Alliance, Cofares)');
      console.log('   - Los sistemas internos de la empresa');
      console.log('   - Contacto directo con las farmacias');
      return;
    }
    
    // 4. Limitar
    const clientesAProcesar = clientesConFaltantes.slice(0, LIMIT);
    console.log(`⚠️  Procesando los primeros ${LIMIT} clientes (usa --limit=N para cambiar)\n`);
    
    // 5. Procesar
    console.log('🔄 Generando búsquedas...\n');
    
    const resultados = [];
    
    for (let i = 0; i < clientesAProcesar.length; i++) {
      const { cliente, faltantes } = clientesAProcesar[i];
      const numero = i + 1;
      
      try {
        console.log(`[${numero}/${clientesAProcesar.length}] ${cliente.Nombre || 'Sin nombre'} (ID: ${cliente.Id})`);
        console.log(`   📋 Campos faltantes: ${faltantes.map(f => f.descripcion).join(', ')}`);
        
        const resultado = await buscarInformacionPublica(cliente);
        resultados.push({
          cliente,
          faltantes,
          resultado
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Error:`, error.message);
      }
    }
    
    // 6. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN');
    console.log('='.repeat(60));
    console.log(`✅ Clientes procesados: ${resultados.length}`);
    console.log(`📊 Total con campos buscables faltantes: ${clientesConFaltantes.length}`);
    console.log('='.repeat(60));
    
    console.log('\n📝 PRÓXIMOS PASOS:');
    console.log('1. Usa las URLs generadas arriba para buscar información');
    console.log('2. Para búsquedas automáticas, implementa:');
    console.log('   - Google Custom Search API');
    console.log('   - Scraping de directorios (con permisos)');
    console.log('3. Para códigos de distribuidoras, contacta con:');
    console.log('   - Hefame: https://www.hefame.es/');
    console.log('   - Alliance Healthcare: https://www.alliance-healthcare.es/');
    console.log('   - Cofares: https://www.cofares.es/');
    
    console.log('\n🏁 Proceso finalizado');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  buscarYActualizarDatos()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { buscarYActualizarDatos };

