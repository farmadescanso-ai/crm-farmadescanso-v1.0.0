/**
 * Script mejorado para procesar TODOS los clientes sin DNI/CIF
 * - Busca DNI/CIF para TODOS los tipos de clientes (farmacias, clínicas, centros de salud, etc.)
 * - Completa todos los campos posibles (DNI/CIF, teléfono, email, web, Tipo de Cliente)
 * - Crea Tipo de Cliente si no existe
 * - NO repite búsquedas: procesa clientes ordenados por ID y mantiene registro del último ID procesado
 * 
 * NOTA: Las búsquedas web se realizan externamente usando web_search tool.
 * Este script gestiona el tracking y actualiza los datos encontrados.
 */

const crm = require('../config/mysql-crm');
const fs = require('fs');
const path = require('path');

const ARCHIVO_ULTIMO_ID = path.join(__dirname, '.ultimo-id-procesado.txt');
const LOTES_TAMANIO = 100;

let tiposClientesMap = null;

/**
 * Carga los tipos de clientes desde la base de datos
 */
async function cargarTiposClientes() {
  try {
    const tiposClientes = await crm.query('SELECT id, Tipo FROM tipos_clientes ORDER BY id');
    tiposClientesMap = new Map();
    tiposClientes.forEach(tc => {
      tiposClientesMap.set(tc.Tipo.toLowerCase(), tc.id);
    });
    console.log(`  ✅ ${tiposClientesMap.size} tipos de cliente cargados`);
    return tiposClientesMap;
  } catch (error) {
    console.log(`  ⚠️  Error cargando tipos_clientes: ${error.message}`);
    tiposClientesMap = new Map();
    return tiposClientesMap;
  }
}

/**
 * Busca o crea un tipo de cliente
 */
async function obtenerOCrearTipoCliente(nombreTipo) {
  if (!nombreTipo) return null;
  
  const nombreLower = nombreTipo.toLowerCase().trim();
  
  // Si ya existe en el mapa, retornar su ID
  if (tiposClientesMap.has(nombreLower)) {
    return tiposClientesMap.get(nombreLower);
  }
  
  try {
    // Intentar crear el tipo de cliente
    const resultado = await crm.query('INSERT INTO tipos_clientes (Tipo) VALUES (?)', [nombreTipo]);
    const nuevoId = resultado.insertId;
    tiposClientesMap.set(nombreLower, nuevoId);
    console.log(`  ✅ Nuevo tipo de cliente creado: "${nombreTipo}" (ID: ${nuevoId})`);
    return nuevoId;
  } catch (error) {
    // Si ya existe (duplicate key), buscarlo
    const existente = await crm.query('SELECT id, Tipo FROM tipos_clientes WHERE Tipo = ?', [nombreTipo]);
    if (existente && existente.length > 0) {
      const id = existente[0].id;
      tiposClientesMap.set(nombreLower, id);
      return id;
    }
    console.log(`  ⚠️  Error creando tipo de cliente "${nombreTipo}": ${error.message}`);
    return null;
  }
}

/**
 * Determina el tipo de cliente según el nombre
 */
async function determinarTipoCliente(nombre) {
  if (!nombre) return null;
  
  const nombreLower = nombre.toLowerCase().trim();
  
  // 1. Centro de Salud (prioritario - normalmente empiezan con "Cs ")
  if (nombreLower.startsWith('cs ') || nombreLower.includes('centro de salud')) {
    return await obtenerOCrearTipoCliente('Centro de Salud');
  }
  
  // 2. Farmacia
  if (nombreLower.startsWith('farmacia -') || nombreLower.match(/\bfarmacia\b/)) {
    return await obtenerOCrearTipoCliente('Farmacia');
  }
  
  // 3. Parafarmacia
  if (nombreLower.includes('parafarmacia')) {
    return await obtenerOCrearTipoCliente('Parafarmacia');
  }
  
  // 4. Clínica Dental
  if (nombreLower.includes('clínica dental') || nombreLower.includes('clinica dental') || 
      nombreLower.includes('dental') || nombreLower.includes('odontolog')) {
    return await obtenerOCrearTipoCliente('Clínica Dental');
  }
  
  // 5. RPM
  if (nombreLower.includes('rpm') || nombreLower.includes('imas rpm')) {
    return await obtenerOCrearTipoCliente('RPM');
  }
  
  // 6. Distribuidor
  if (nombreLower.includes('distribuidor') || nombreLower.includes('distribución') || 
      nombreLower.includes('distribucion')) {
    return await obtenerOCrearTipoCliente('Distribuidor');
  }
  
  // 7. Web
  if (nombreLower.includes('web') || nombreLower.includes('.com') || 
      nombreLower.includes('online') || nombreLower.includes('ecommerce')) {
    return await obtenerOCrearTipoCliente('Web');
  }
  
  return null;
}

/**
 * Lee el último ID procesado
 */
function leerUltimoId() {
  try {
    if (fs.existsSync(ARCHIVO_ULTIMO_ID)) {
      const contenido = fs.readFileSync(ARCHIVO_ULTIMO_ID, 'utf8').trim();
      const id = parseInt(contenido);
      return isNaN(id) ? 0 : id;
    }
    return 0;
  } catch (error) {
    console.log(`  ⚠️  Error leyendo último ID: ${error.message}`);
    return 0;
  }
}

/**
 * Guarda el último ID procesado
 */
function guardarUltimoId(id) {
  try {
    fs.writeFileSync(ARCHIVO_ULTIMO_ID, String(id), 'utf8');
  } catch (error) {
    console.log(`  ⚠️  Error guardando último ID: ${error.message}`);
  }
}

/**
 * Lista los clientes del siguiente lote para búsqueda web
 */
async function listarClientesParaBusqueda() {
  try {
    await crm.connect();
    
    const ultimoId = leerUltimoId();
    
    const clientes = await crm.query(
      `SELECT id, Nombre_Razon_Social, Poblacion, Movil, Email, DNI_CIF, TipoCliente, Id_TipoCliente, Direccion, CodigoPostal
       FROM clientes 
       WHERE (DNI_CIF IS NULL OR DNI_CIF = '') 
       AND id > ?
       ORDER BY id 
       LIMIT ?`,
      [ultimoId, LOTES_TAMANIO]
    );
    
    return clientes;
  } catch (error) {
    console.error('❌ Error listando clientes:', error.message);
    throw error;
  }
}

/**
 * Actualiza clientes con datos encontrados
 * IMPORTANTE: Procesa TODOS los clientes del lote actual, no solo los que tienen datos encontrados
 * Esto asegura que el tracking avance correctamente y no se repitan búsquedas
 */
async function actualizarClientesConDatos(datosEncontrados) {
  try {
    await crm.connect();
    await cargarTiposClientes();
    
    let actualizados = 0;
    const ultimoId = leerUltimoId();
    let maxIdProcesado = ultimoId;
    
    // Obtener TODOS los clientes del lote actual (no solo los que tienen datos)
    const clientesLote = await listarClientesParaBusqueda();
    
    if (clientesLote.length === 0) {
      console.log('  ⚠️  No hay clientes en el lote actual');
      return 0;
    }
    
    console.log(`  📋 Procesando ${clientesLote.length} clientes del lote...\n`);
    
    // Procesar TODOS los clientes del lote
    for (const cliente of clientesLote) {
      try {
        const clienteId = cliente.id;
        const nombre = cliente.Nombre_Razon_Social;
        const datos = datosEncontrados[nombre] || {};
        
        const actualizaciones = {};
        
        // 1. DNI/CIF
        if (datos.DNI_CIF && (!cliente.DNI_CIF || cliente.DNI_CIF === '')) {
          actualizaciones.DNI_CIF = datos.DNI_CIF;
        }
        
        // 2. Móvil
        if (datos.Movil !== undefined && (!cliente.Movil || cliente.Movil === '')) {
          actualizaciones.Movil = datos.Movil;
        }
        
        // 3. Email
        if (datos.Email && (!cliente.Email || cliente.Email === '')) {
          actualizaciones.Email = datos.Email;
        }
        
        // 4. Web
        if (datos.Web && (!cliente.Web || cliente.Web === '')) {
          actualizaciones.Web = datos.Web;
        }
        
        // 5. Tipo de Cliente (SIEMPRE intentar determinar si no tiene)
        if (!cliente.Id_TipoCliente || !cliente.TipoCliente) {
          const tipoClienteId = await determinarTipoCliente(nombre);
          if (tipoClienteId) {
            actualizaciones.Id_TipoCliente = tipoClienteId;
            const tipoNombre = Array.from(tiposClientesMap.entries())
              .find(([k, v]) => v === tipoClienteId)?.[0] || '';
            if (tipoNombre) {
              // Capitalizar correctamente
              const palabras = tipoNombre.split(' ');
              const tipoCapitalizado = palabras.map(p => 
                p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
              ).join(' ');
              actualizaciones.TipoCliente = tipoCapitalizado;
            }
          }
        }
        
        // Actualizar si hay cambios
        if (Object.keys(actualizaciones).length > 0) {
          await crm.updateCliente(clienteId, actualizaciones);
          console.log(`  ✅ Actualizado ID ${clienteId}: ${nombre.substring(0, 50)}${nombre.length > 50 ? '...' : ''} - ${Object.keys(actualizaciones).join(', ')}`);
          actualizados++;
        }
        
        // SIEMPRE actualizar último ID procesado (incluso si no hubo cambios)
        maxIdProcesado = Math.max(maxIdProcesado, clienteId);
        
      } catch (error) {
        console.log(`  ⚠️  Error procesando ID ${cliente.id}: ${error.message}`);
        // Aún así, actualizar el ID para no repetir
        maxIdProcesado = Math.max(maxIdProcesado, cliente.id);
      }
    }
    
    // Guardar último ID procesado (el máximo del lote)
    guardarUltimoId(maxIdProcesado);
    
    console.log(`\n  📍 Último ID procesado actualizado: ${maxIdProcesado}`);
    
    return actualizados;
  } catch (error) {
    console.error('❌ Error actualizando clientes:', error.message);
    throw error;
  }
}

/**
 * Función principal para listar clientes y obtener estadísticas
 */
async function obtenerEstadisticas() {
  try {
    await crm.connect();
    
    const ultimoId = leerUltimoId();
    
    // Obtener total de clientes sin DNI/CIF que no han sido procesados
    const [totalResult] = await crm.query(
      `SELECT COUNT(*) as total FROM clientes 
       WHERE (DNI_CIF IS NULL OR DNI_CIF = '') 
       AND id > ?`,
      [ultimoId]
    );
    const total = totalResult.total;
    const lotesEstimados = Math.ceil(total / LOTES_TAMANIO);
    
    // Obtener estadísticas generales
    const estadisticasResult = await crm.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN DNI_CIF IS NOT NULL AND DNI_CIF != '' THEN 1 ELSE 0 END) as conDNI,
        SUM(CASE WHEN Movil IS NOT NULL AND Movil != '' THEN 1 ELSE 0 END) as conMovil,
        SUM(CASE WHEN Email IS NOT NULL AND Email != '' THEN 1 ELSE 0 END) as conEmail
       FROM clientes`
    );
    
    const estadisticas = estadisticasResult[0] || { total: 0, conDNI: 0, conMovil: 0, conEmail: 0 };
    
    return {
      ultimoIdProcesado: ultimoId,
      pendientesSinDNI: total,
      lotesEstimados: lotesEstimados,
      estadisticas: estadisticas
    };
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error.message);
    throw error;
  }
}

// Ejecutar función según argumentos
if (require.main === module) {
  const comando = process.argv[2];
  
  if (comando === 'listar') {
    listarClientesParaBusqueda().then(clientes => {
      console.log(JSON.stringify(clientes.map(c => ({
        id: c.id,
        nombre: c.Nombre_Razon_Social,
        poblacion: c.Poblacion,
        movil: c.Movil || '',
        email: c.Email || '',
        dni: c.DNI_CIF || ''
      })), null, 2));
      process.exit(0);
    }).catch(e => {
      console.error(e.message);
      process.exit(1);
    });
  } else if (comando === 'estadisticas') {
    obtenerEstadisticas().then(stats => {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📊 ESTADÍSTICAS DEL PROCESAMIENTO');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`📍 Último ID procesado: ${stats.ultimoIdProcesado}`);
      console.log(`📊 Pendientes sin DNI/CIF: ${stats.pendientesSinDNI}`);
      console.log(`📦 Lotes estimados restantes: ${stats.lotesEstimados}`);
      console.log(`\n📈 Estadísticas generales:`);
      console.log(`   Total clientes: ${stats.estadisticas.total}`);
      console.log(`   Con DNI/CIF: ${stats.estadisticas.conDNI} (${((stats.estadisticas.conDNI/stats.estadisticas.total)*100).toFixed(1)}%)`);
      console.log(`   Con teléfono: ${stats.estadisticas.conMovil} (${((stats.estadisticas.conMovil/stats.estadisticas.total)*100).toFixed(1)}%)`);
      console.log(`   Con email: ${stats.estadisticas.conEmail} (${((stats.estadisticas.conEmail/stats.estadisticas.total)*100).toFixed(1)}%)`);
      console.log('═══════════════════════════════════════════════════════\n');
      process.exit(0);
    }).catch(e => {
      console.error(e.message);
      process.exit(1);
    });
  } else {
    console.log('Uso:');
    console.log('  node procesar-clientes-completo-mejorado.js listar       - Lista clientes para búsqueda');
    console.log('  node procesar-clientes-completo-mejorado.js estadisticas - Muestra estadísticas');
    process.exit(0);
  }
}

module.exports = { 
  listarClientesParaBusqueda, 
  actualizarClientesConDatos, 
  obtenerEstadisticas,
  determinarTipoCliente, 
  obtenerOCrearTipoCliente 
};
