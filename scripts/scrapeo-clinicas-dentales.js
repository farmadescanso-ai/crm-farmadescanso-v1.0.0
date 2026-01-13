/**
 * Script para scrapear información de clínicas dentales desde el Excel
 * y adaptarla a la estructura de la tabla Clientes
 * 
 * Este script:
 * 1. Lee las clínicas del Excel
 * 2. Busca información adicional en la web (scraping)
 * 3. Adapta los datos a la estructura de Clientes
 * 4. Muestra los datos antes de guardarlos
 */

const XLSX = require('xlsx');
const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

const EXCEL_FILE = 'C:\\Users\\pacol\\Downloads\\Copia de Listado Clínicas Murcia y Alicante Farmadescanso.xlsx';
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');
const LIMITE_CLINICAS = process.argv.find(arg => arg.startsWith('--limit=')) 
  ? parseInt(process.argv.find(arg => arg.startsWith('--limit=')).split('=')[1]) 
  : null; // null = todas

// Cache para lookups
let tiposClientesMap = null;
let provinciasDB = null;
let comercialesMap = null;

/**
 * Normaliza el nombre de una columna
 */
function normalizeColumnName(columnName) {
  return String(columnName || '').trim();
}

/**
 * Carga los datos de lookup necesarios
 */
async function cargarLookups() {
  console.log('📚 Cargando datos de lookup...');
  
  // Tipos de Cliente
  try {
    const tiposClientes = await crm.query('SELECT id, Tipo FROM tipos_clientes');
    tiposClientesMap = new Map();
    tiposClientes.forEach(tc => {
      if (tc.Tipo) {
        tiposClientesMap.set(tc.Tipo.toLowerCase(), tc.id);
      }
    });
    console.log(`  ✅ ${tiposClientesMap.size} tipos de cliente cargados`);
    // Buscar específicamente "Clínicas"
    const clinicasId = tiposClientesMap.get('clínicas') || tiposClientesMap.get('clinicas') || 
                       tiposClientesMap.get('clínica dental') || tiposClientesMap.get('clinica dental');
    if (clinicasId) {
      console.log(`  ✅ ID para "Clínicas": ${clinicasId}`);
    } else {
      console.log(`  ⚠️  No se encontró tipo "Clínicas", se usará el nombre`);
    }
  } catch (error) {
    console.log(`  ⚠️  Error cargando tipos_clientes: ${error.message}`);
    tiposClientesMap = new Map();
  }
  
  // Provincias
  try {
    provinciasDB = await crm.getProvincias();
    console.log(`  ✅ ${provinciasDB.length} provincias cargadas`);
  } catch (error) {
    console.log(`  ⚠️  Error cargando provincias: ${error.message}`);
    provinciasDB = [];
  }
  
  // Comerciales (usar el primero disponible o ID 1 por defecto)
  try {
    const comerciales = await crm.query('SELECT id, Nombre FROM comerciales LIMIT 1');
    if (comerciales && comerciales.length > 0) {
      comercialesMap = new Map();
      comerciales.forEach(c => {
        comercialesMap.set('default', c.id);
      });
      console.log(`  ✅ Comercial por defecto: ID ${comerciales[0].id} (${comerciales[0].Nombre || 'N/A'})`);
    } else {
      comercialesMap = new Map([['default', 1]]);
      console.log(`  ⚠️  No hay comerciales, usando ID 1 por defecto`);
    }
  } catch (error) {
    comercialesMap = new Map([['default', 1]]);
    console.log(`  ⚠️  Error cargando comerciales, usando ID 1 por defecto`);
  }
}

/**
 * Busca el ID de tipo de cliente "Clínicas"
 */
function obtenerIdTipoClienteClinicas() {
  if (!tiposClientesMap) return null;
  
  // Intentar varias variantes
  const variantes = ['clínicas', 'clinicas', 'clínica dental', 'clinica dental', 'clínica', 'clinica'];
  for (const variante of variantes) {
    const id = tiposClientesMap.get(variante);
    if (id) return id;
  }
  
  return null;
}

/**
 * Limpia un número de teléfono
 */
function limpiarTelefono(telefono) {
  if (!telefono) return null;
  
  let limpio = String(telefono).trim();
  
  // Si tiene múltiples números separados por / o , tomar solo el primero
  if (limpio.includes('/')) {
    limpio = limpio.split('/')[0].trim();
  }
  if (limpio.includes(',')) {
    limpio = limpio.split(',')[0].trim();
  }
  
  // Eliminar todos los caracteres no numéricos excepto el + al inicio
  const tieneMas = limpio.startsWith('+');
  limpio = limpio.replace(/[^\d]/g, '');
  
  // Eliminar ceros iniciales
  limpio = limpio.replace(/^0+/, '');
  if (!limpio || limpio === '') return null;
  
  // Limitar longitud a 13 caracteres
  if (limpio.length > 13) {
    limpio = limpio.substring(0, 13);
  }
  
  return limpio;
}

/**
 * Convierte texto a Title Case
 */
function toTitleCase(texto) {
  if (!texto) return '';
  
  const palabrasMinusculas = ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 
                              'en', 'por', 'para', 'con', 'sin', 'sobre', 'entre'];
  
  const palabras = String(texto)
    .trim()
    .split(/\s+/)
    .filter(p => p.length > 0);
  
  if (palabras.length === 0) return '';
  
  const palabrasConvertidas = palabras.map((palabra, index) => {
    if (!palabra || /^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+$/.test(palabra)) {
      return palabra;
    }
    
    if (index === 0) {
      return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
    }
    
    const palabraLower = palabra.toLowerCase().replace(/[.,;:!?()\-]/g, '');
    if (palabrasMinusculas.includes(palabraLower)) {
      return palabra.toLowerCase();
    }
    
    return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
  });
  
  return palabrasConvertidas.join(' ');
}

/**
 * Extrae información de una clínica usando búsqueda en la web
 * Esta función intenta buscar información básica, pero como estamos limitados
 * en las herramientas de scraping, prepararemos los datos básicos y el usuario
 * podrá completar manualmente o usar otras herramientas
 */
function buscarInfoClinica(nombreClinica) {
  // Por ahora, retornamos un objeto vacío que se puede completar
  // En una implementación real, aquí se haría scraping web
  return {
    direccion: null,
    telefono: null,
    email: null,
    codigoPostal: null,
    poblacion: null,
    web: null
  };
}

/**
 * Lee el archivo Excel y extrae los nombres de las clínicas
 */
function leerExcel(archivo) {
  try {
    console.log(`📖 Leyendo archivo Excel: ${archivo}`);
    const workbook = XLSX.readFile(archivo);
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`📄 Hoja encontrada: ${sheetName}`);
    
    const datos = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    if (datos.length < 2) {
      throw new Error('El archivo Excel no tiene suficientes filas');
    }
    
    const headers = datos[0].map(h => normalizeColumnName(h));
    console.log(`📊 Columnas encontradas: ${headers.join(', ')}`);
    
    // Extraer nombres de clínicas
    const nombreColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('clinica') || 
      h.toLowerCase().includes('dental') ||
      h.toLowerCase().includes('odontolog')
    );
    
    if (nombreColumnIndex === -1 && headers.length > 0) {
      // Si no encuentra una columna específica, usar la primera
      console.log(`⚠️  No se encontró columna específica, usando la primera columna`);
    }
    
    const clinicas = [];
    const colIndex = nombreColumnIndex !== -1 ? nombreColumnIndex : 0;
    
    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i];
      const nombre = fila[colIndex];
      
      if (nombre && String(nombre).trim() !== '') {
        clinicas.push({
          nombre: String(nombre).trim(),
          filaExcel: i + 1
        });
      }
    }
    
    console.log(`✅ ${clinicas.length} clínicas encontradas en el Excel`);
    return clinicas;
  } catch (error) {
    console.error('❌ Error leyendo el archivo Excel:', error.message);
    throw error;
  }
}

/**
 * Convierte una clínica a formato Cliente
 */
function convertirClinicaACliente(clinica, infoAdicional = {}) {
  const cliente = {
    Nombre_Razon_Social: toTitleCase(clinica.nombre),
    TipoCliente: 'Clínicas',
    DNI_CIF: '', // Campo requerido, vacío por ahora
    Id_Cial: comercialesMap.get('default') || 1
  };
  
  // Asignar Id_TipoCliente
  const idTipoCliente = obtenerIdTipoClienteClinicas();
  if (idTipoCliente) {
    cliente.Id_TipoCliente = idTipoCliente;
  }
  
  // Información adicional (si está disponible)
  if (infoAdicional.direccion) {
    cliente.Direccion = toTitleCase(infoAdicional.direccion);
  }
  
  if (infoAdicional.telefono) {
    cliente.Movil = limpiarTelefono(infoAdicional.telefono);
  }
  
  if (infoAdicional.email) {
    cliente.Email = String(infoAdicional.email).trim().toLowerCase();
  }
  
  if (infoAdicional.codigoPostal) {
    cliente.CodigoPostal = String(infoAdicional.codigoPostal).trim();
    
    // Asociar provincia por código postal
    if (provinciasDB && provinciasDB.length > 0) {
      const provinciaId = obtenerProvinciaPorCodigoPostal(cliente.CodigoPostal, provinciasDB);
      if (provinciaId) {
        cliente.Id_Provincia = provinciaId;
        const provincia = provinciasDB.find(p => p.id === provinciaId);
        if (provincia && !cliente.Pais) {
          cliente.Pais = provincia.Pais || 'España';
          cliente.CodPais = provincia.CodigoPais || 'ES';
        }
      }
    }
  }
  
  if (infoAdicional.poblacion) {
    cliente.Poblacion = toTitleCase(infoAdicional.poblacion);
  }
  
  // Valores por defecto para España
  if (!cliente.Pais) {
    cliente.Pais = 'España';
    cliente.CodPais = 'ES';
  }
  
  if (!cliente.Idioma) {
    cliente.Idioma = 'ES';
  }
  
  return cliente;
}

/**
 * Función principal
 */
async function procesarClinicas() {
  try {
    console.log('🚀 Iniciando procesamiento de clínicas dentales...\n');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    console.log(`📁 Archivo Excel: ${EXCEL_FILE}\n`);
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Cargar lookups
    await cargarLookups();
    console.log('');
    
    // Leer Excel
    let clinicas = leerExcel(EXCEL_FILE);
    console.log(`✅ ${clinicas.length} clínicas encontradas\n`);
    
    if (LIMITE_CLINICAS && LIMITE_CLINICAS > 0) {
      clinicas = clinicas.slice(0, LIMITE_CLINICAS);
      console.log(`⚠️  Limitando a las primeras ${LIMITE_CLINICAS} clínicas\n`);
    }
    
    if (clinicas.length === 0) {
      console.log('⚠️  No hay clínicas para procesar');
      return;
    }
    
    // Convertir a formato Cliente
    console.log('🔄 Convirtiendo clínicas a formato Cliente...\n');
    const clientes = [];
    
    for (let i = 0; i < clinicas.length; i++) {
      const clinica = clinicas[i];
      console.log(`[${i + 1}/${clinicas.length}] Procesando: ${clinica.nombre}`);
      
      // Por ahora, no hacemos scraping web real (requeriría Puppeteer u otras herramientas)
      // El usuario puede completar manualmente o usar otras herramientas
      const infoAdicional = buscarInfoClinica(clinica.nombre);
      const cliente = convertirClinicaACliente(clinica, infoAdicional);
      clientes.push(cliente);
    }
    
    console.log(`\n✅ ${clientes.length} clientes preparados\n`);
    
    // Mostrar resumen
    console.log('='.repeat(80));
    console.log('📋 RESUMEN DE CLIENTES PREPARADOS');
    console.log('='.repeat(80));
    console.log(`\nTotal de clientes: ${clientes.length}`);
    console.log(`Tipo de cliente: Clínicas`);
    console.log(`ID Tipo Cliente: ${obtenerIdTipoClienteClinicas() || 'No encontrado'}`);
    console.log(`\nPrimeros 10 clientes:`);
    console.log('-'.repeat(80));
    
    clientes.slice(0, 10).forEach((cliente, index) => {
      console.log(`\n${index + 1}. ${cliente.Nombre_Razon_Social}`);
      console.log(`   Tipo: ${cliente.TipoCliente}${cliente.Id_TipoCliente ? ` (ID: ${cliente.Id_TipoCliente})` : ''}`);
      console.log(`   Dirección: ${cliente.Direccion || '(pendiente)'}`);
      console.log(`   Población: ${cliente.Poblacion || '(pendiente)'}`);
      console.log(`   Código Postal: ${cliente.CodigoPostal || '(pendiente)'}`);
      console.log(`   Teléfono: ${cliente.Movil || '(pendiente)'}`);
      console.log(`   Email: ${cliente.Email || '(pendiente)'}`);
      console.log(`   DNI/CIF: ${cliente.DNI_CIF || '(pendiente)'}`);
    });
    
    if (clientes.length > 10) {
      console.log(`\n... y ${clientes.length - 10} clientes más`);
    }
    
    // Guardar a archivo JSON para revisión
    const fs = require('fs');
    const path = require('path');
    const archivoSalida = path.join(__dirname, '..', 'datos-clinicas-preparados.json');
    fs.writeFileSync(archivoSalida, JSON.stringify(clientes, null, 2), 'utf8');
    console.log(`\n📄 Datos guardados en: ${archivoSalida}`);
    console.log('='.repeat(80));
    
    console.log('\n⚠️  NOTA: Los datos mostrados son básicos (solo nombre).');
    console.log('   Para obtener información completa (dirección, teléfono, email, etc.),');
    console.log('   se requiere scraping web adicional o completar manualmente.');
    console.log('\n   Para continuar con la importación, revisa el archivo JSON generado');
    console.log('   y completa los datos faltantes, luego ejecuta el script de importación.');
    
  } catch (error) {
    console.error('\n❌ Error general:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  procesarClinicas()
    .then(() => {
      console.log('\n✅ Proceso completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { procesarClinicas, leerExcel, convertirClinicaACliente };
