/**
 * Script para revisar y actualizar todos los clientes de la BD
 * 
 * Para cada cliente:
 * 1. Busca información adicional (dirección, teléfono, email, web, etc.)
 * 2. Cualifica el Tipo de Cliente (si no existe, lo crea)
 * 3. Actualiza el registro con todos los datos encontrados
 * 
 * Uso: node scripts/revisar-y-actualizar-clientes-completo.js [--dry-run] [--limit N] [--start N]
 */

const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : null; // null = todos
const START_ARG = args.find(arg => arg.startsWith('--start='));
const START = START_ARG ? parseInt(START_ARG.split('=')[1]) : 1; // Por defecto empezar desde el ID 1

// Cache para lookups
let tiposClientesMap = null;
let provinciasDB = null;

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
 * Carga los datos de lookup necesarios
 */
async function cargarLookups() {
  console.log('📚 Cargando datos de lookup...\n');
  
  // Tipos de Cliente
  try {
    const tiposClientes = await crm.query('SELECT id, Tipo FROM tipos_clientes ORDER BY id');
    tiposClientesMap = new Map();
    tiposClientes.forEach(tc => {
      if (tc.Tipo) {
        tiposClientesMap.set(tc.Tipo.toLowerCase(), tc.id);
      }
    });
    console.log(`  ✅ ${tiposClientesMap.size} tipos de cliente cargados`);
    tiposClientes.forEach(t => console.log(`     - ID ${t.id}: ${t.Tipo}`));
  } catch (error) {
    console.log(`  ⚠️  Error cargando tipos_clientes: ${error.message}`);
    tiposClientesMap = new Map();
  }
  
  // Provincias
  try {
    provinciasDB = await crm.getProvincias();
    console.log(`  ✅ ${provinciasDB.length} provincias cargadas\n`);
  } catch (error) {
    console.log(`  ⚠️  Error cargando provincias: ${error.message}`);
    provinciasDB = [];
  }
}

/**
 * Busca o crea un tipo de cliente
 */
async function obtenerOCrearTipoCliente(nombreTipo) {
  if (!nombreTipo) return null;
  
  const nombreLower = nombreTipo.toLowerCase().trim();
  
  // Buscar en el mapa existente
  if (tiposClientesMap.has(nombreLower)) {
    return tiposClientesMap.get(nombreLower);
  }
  
  // Si no existe, intentar crear (solo si no es DRY_RUN)
  if (!DRY_RUN) {
    try {
      const resultado = await crm.query('INSERT INTO tipos_clientes (Tipo) VALUES (?)', [nombreTipo]);
      const nuevoId = resultado.insertId;
      tiposClientesMap.set(nombreLower, nuevoId);
      console.log(`  ✅ Nuevo tipo de cliente creado: "${nombreTipo}" (ID: ${nuevoId})`);
      return nuevoId;
    } catch (error) {
      console.log(`  ⚠️  Error creando tipo de cliente "${nombreTipo}": ${error.message}`);
      return null;
    }
  } else {
    console.log(`  📝 [SIMULACIÓN] Se crearía tipo de cliente: "${nombreTipo}"`);
    return null;
  }
}

/**
 * Determina el tipo de cliente según el nombre
 */
async function determinarTipoCliente(nombre) {
  if (!nombre) return null;
  
  const nombreLower = nombre.toLowerCase().trim();
  
  // 1. Farmacia
  if (nombreLower.startsWith('farmacia -') || nombreLower.includes('farmacia ')) {
    return await obtenerOCrearTipoCliente('Farmacia');
  }
  
  // 2. Parafarmacia
  if (nombreLower.includes('parafarmacia')) {
    return await obtenerOCrearTipoCliente('Parafarmacia');
  }
  
  // 3. RPM
  if (nombreLower.includes('rpm') || nombreLower.includes('imas rpm')) {
    return await obtenerOCrearTipoCliente('RPM');
  }
  
  // 4. Clínica Dental
  if (nombreLower.includes('clínica dental') || nombreLower.includes('clinica dental') || 
      nombreLower.includes('dental') || nombreLower.includes('odontolog')) {
    return await obtenerOCrearTipoCliente('Clínica Dental');
  }
  
  // 5. Distribuidor
  if (nombreLower.includes('distribuidor') || nombreLower.includes('distribución') || 
      nombreLower.includes('distribucion')) {
    return await obtenerOCrearTipoCliente('Distribuidor');
  }
  
  // 6. Web
  if (nombreLower.includes('web') || nombreLower.includes('.com') || 
      nombreLower.includes('online') || nombreLower.includes('ecommerce')) {
    return await obtenerOCrearTipoCliente('Web');
  }
  
  // 7. Particular (si no coincide con ningún otro)
  if (!nombreLower.includes('sl') && !nombreLower.includes('sa') && 
      !nombreLower.includes('cb') && !nombreLower.includes('sociedad') && 
      !nombreLower.includes('limitada')) {
    // Podría ser particular, pero no lo asignamos automáticamente
  }
  
  return null;
}

/**
 * Construye búsqueda optimizada para web
 */
function construirBusqueda(cliente) {
  const nombre = (cliente.Nombre_Razon_Social || cliente.Nombre || '').trim();
  const poblacion = (cliente.Poblacion || '').trim();
  const direccion = (cliente.Direccion || '').trim();
  
  if (!nombre) return null;
  
  // Construir búsqueda con nombre y población si está disponible
  let busqueda = nombre;
  if (poblacion) {
    busqueda += ` ${poblacion}`;
  }
  
  return busqueda;
}

/**
 * Función principal - Procesa clientes uno por uno
 */
async function revisarYActualizarClientes() {
  try {
    console.log('🚀 Iniciando revisión y actualización de clientes...\n');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Cargar lookups
    await cargarLookups();
    
    // Obtener todos los clientes
    let query = 'SELECT * FROM clientes WHERE id >= ? ORDER BY id';
    let params = [START];
    
    if (LIMIT) {
      query += ' LIMIT ?';
      params.push(LIMIT);
    }
    
    const clientes = await crm.query(query, params);
    console.log(`📊 Total de clientes a procesar: ${clientes.length}\n`);
    
    if (clientes.length === 0) {
      console.log('⚠️  No hay clientes para procesar');
      return;
    }
    
    let procesados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    const errores = [];
    
    for (const cliente of clientes) {
      try {
        const clienteId = cliente.id || cliente.Id;
        const nombre = (cliente.Nombre_Razon_Social || cliente.Nombre || '').trim();
        
        console.log(`\n[${procesados + 1}/${clientes.length}] Cliente ID ${clienteId}: ${nombre}`);
        
        const actualizaciones = {};
        let tieneCambios = false;
        
        // 1. Determinar tipo de cliente si no tiene
        if (!cliente.Id_TipoCliente || campoVacio(cliente.Id_TipoCliente)) {
          const tipoClienteId = await determinarTipoCliente(nombre);
          if (tipoClienteId) {
            actualizaciones.Id_TipoCliente = tipoClienteId;
            const tipoNombre = Array.from(tiposClientesMap.entries())
              .find(([k, v]) => v === tipoClienteId)?.[0] || 'N/A';
            console.log(`  ✅ Tipo de cliente asignado: ${tipoNombre} (ID: ${tipoClienteId})`);
            tieneCambios = true;
          }
        }
        
        // 2. Asociar provincia por código postal si no tiene
        if (cliente.CodigoPostal && !cliente.Id_Provincia) {
          const provinciaId = obtenerProvinciaPorCodigoPostal(cliente.CodigoPostal, provinciasDB);
          if (provinciaId) {
            actualizaciones.Id_Provincia = provinciaId;
            console.log(`  ✅ Provincia asignada: ID ${provinciaId} (CP: ${cliente.CodigoPostal})`);
            tieneCambios = true;
          }
        }
        
        // NOTA: Las búsquedas web se harán en el contexto de ejecución
        // que tenga acceso a web_search. Por ahora, solo procesamos datos locales.
        
        // 3. Actualizar si hay cambios
        if (tieneCambios && Object.keys(actualizaciones).length > 0) {
          if (!DRY_RUN) {
            await crm.updateCliente(clienteId, actualizaciones);
            console.log(`  ✅ Cliente actualizado`);
            actualizados++;
          } else {
            console.log(`  📝 [SIMULACIÓN] Se actualizarían:`, JSON.stringify(actualizaciones, null, 2));
            actualizados++;
          }
        } else {
          console.log(`  ⏭️  Sin cambios necesarios`);
          sinCambios++;
        }
        
        procesados++;
        
      } catch (error) {
        errores.push({
          clienteId: cliente.id || cliente.Id,
          nombre: cliente.Nombre_Razon_Social || cliente.Nombre,
          error: error.message
        });
        console.error(`  ❌ Error procesando cliente ID ${cliente.id || cliente.Id}: ${error.message}`);
        procesados++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ REVISIÓN COMPLETADA');
    console.log('='.repeat(80));
    console.log(`📊 Resumen:`);
    console.log(`   ✅ Clientes procesados: ${procesados}`);
    console.log(`   ✅ Clientes actualizados: ${actualizados}`);
    console.log(`   ⏭️  Clientes sin cambios: ${sinCambios}`);
    console.log(`   ❌ Errores: ${errores.length}`);
    
    if (errores.length > 0) {
      console.log('\n❌ Errores encontrados (primeros 10):');
      errores.slice(0, 10).forEach(e => {
        console.log(`   - Cliente ID ${e.clienteId}: ${e.nombre} - ${e.error}`);
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

// Ejecutar si es el script principal
if (require.main === module) {
  revisarYActualizarClientes();
}

module.exports = { revisarYActualizarClientes, determinarTipoCliente, obtenerOCrearTipoCliente };
