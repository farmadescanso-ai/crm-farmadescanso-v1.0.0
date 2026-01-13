/**
 * Script para scrapear clínicas dentales en Córdoba por código postal
 * Busca en todos los códigos postales que comienzan por 14 (provincia de Córdoba)
 */

const puppeteer = require('puppeteer');
const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');
const MAX_RESULTS_PER_CP = parseInt(process.argv.find(arg => arg.startsWith('--max-cp='))?.split('=')[1]) || 5;
const MAX_CP = parseInt(process.argv.find(arg => arg.startsWith('--max-codigos='))?.split('=')[1]) || null; // Limitar número de CPs a procesar
const DEBUG = process.argv.includes('--debug');

// Códigos postales principales de Córdoba (capital y principales localidades)
// Se pueden generar todos los códigos 14xxx o usar solo los principales
const GENERAR_TODOS_LOS_CP = process.argv.includes('--todos-cp');

let CODIGOS_POSTALES_CORDOBA = [];

if (GENERAR_TODOS_LOS_CP) {
  // Generar todos los códigos postales 14xxx (14000-14999)
  console.log('📮 Generando todos los códigos postales 14xxx...');
  for (let i = 0; i <= 999; i++) {
    const cp = `14${String(i).padStart(3, '0')}`;
    CODIGOS_POSTALES_CORDOBA.push(cp);
  }
} else {
  // Solo códigos postales principales (más eficiente)
  CODIGOS_POSTALES_CORDOBA = [
    // Córdoba capital (principales)
    '14001', '14002', '14003', '14004', '14005', '14006', '14007', '14008', '14009', '14010',
    '14011', '14012', '14013', '14014', '14015', '14016', '14017', '14018', '14019', '14020',
    // Principales localidades
    '14900', // Lucena
    '14500', // Puente Genil
    '14520', // Montilla
    '14800', // Priego de Córdoba
    '14940', // Cabra
    '14850', // Baena
    '14200', // Peñarroya-Pueblonuevo
    '14960', // Rute
    '14440', // Villanueva de Córdoba
    '14100', // La Carlota
    '14120', // Fuente Palmera
    '14400', // Pozoblanco
    '14410', // Villaviciosa de Córdoba
    '14270', // Hinojosa del Duque
    '14240', // Belmez
    '14600', // Montoro
    '14700', // Palma del Río
    '14820', // Carcabuey
    '14830', // Iznájar
    '14920', // Aguilar de la Frontera
    '14930', // Benamejí
    '14730', // La Victoria
    '14740', // Fernán-Núñez
    '14750', // Montemayor
    '14760', // Santaella
    '14770', // La Rambla
    '14710', // Almodóvar del Río
    '14720', // Posadas
    '14840', // Luque
    '14890'  // Priego de Córdoba
  ];
}

// Cache para lookups
let comercialesMap = null;
let formasPagoMap = null;
let tiposClientesMap = null;
let idiomasMap = null;
let monedasMap = null;
let provinciasDB = null;
let siguienteCuentaContable = null;

/**
 * Carga los datos de lookup necesarios
 */
async function cargarLookups() {
  console.log('📚 Cargando datos de lookup...');
  
  try {
    await crm.connect();
    
    // Comerciales
    const comerciales = await crm.query('SELECT id FROM comerciales LIMIT 1');
    comercialesMap = comerciales.length > 0 ? comerciales[0].id : 1;
    console.log(`  ✅ Comercial por defecto: ID ${comercialesMap}`);
    
    // Formas de Pago
    const formasPago = await crm.query('SELECT id, FormaPago FROM formas_pago LIMIT 10');
    formasPagoMap = new Map();
    formasPago.forEach(fp => {
      if (fp.FormaPago) {
        formasPagoMap.set(fp.FormaPago.toLowerCase(), fp.id);
      }
    });
    console.log(`  ✅ ${formasPagoMap.size} formas de pago cargadas`);
    
    // Tipos de Cliente
    const tiposClientes = await crm.query('SELECT id, Tipo FROM tipos_clientes');
    tiposClientesMap = new Map();
    tiposClientes.forEach(tc => {
      if (tc.Tipo) {
        tiposClientesMap.set(tc.Tipo.toLowerCase(), tc.id);
      }
    });
    console.log(`  ✅ ${tiposClientesMap.size} tipos de cliente cargados`);
    
    // Idiomas
    const idiomas = await crm.query('SELECT id, Codigo, Nombre FROM idiomas WHERE Codigo = "es" OR Nombre LIKE "%español%" LIMIT 1');
    idiomasMap = idiomas.length > 0 ? idiomas[0].id : null;
    console.log(`  ✅ Idioma por defecto: ID ${idiomasMap || 'null'}`);
    
    // Monedas
    const monedas = await crm.query('SELECT id, Codigo FROM monedas WHERE Codigo = "EUR" LIMIT 1');
    monedasMap = monedas.length > 0 ? monedas[0].id : null;
    console.log(`  ✅ Moneda por defecto: ID ${monedasMap || 'null'}`);
    
    // Provincias
    provinciasDB = await crm.getProvincias();
    const cordobaProv = provinciasDB.find(p => {
      const nombre = p.Nombre || '';
      return nombre.toLowerCase().includes('córdoba') || nombre.toLowerCase().includes('cordoba');
    });
    console.log(`  ✅ ${provinciasDB.length} provincias cargadas (Córdoba: ID ${cordobaProv?.id || 'no encontrada'})`);
    
    // Siguiente cuenta contable
    const resultado = await crm.query('SELECT MAX(CuentaContable) as maxCuenta FROM clientes WHERE CuentaContable IS NOT NULL');
    siguienteCuentaContable = (resultado[0]?.maxCuenta || 0) + 1;
    console.log(`  ✅ Siguiente cuenta contable: ${siguienteCuentaContable}`);
    
  } catch (error) {
    console.error('❌ Error cargando lookups:', error.message);
    throw error;
  }
}

/**
 * Limpia un número de teléfono
 */
function limpiarTelefono(telefono) {
  if (!telefono) return null;
  return String(telefono)
    .replace(/\s+/g, '')
    .replace(/[()\-]/g, '')
    .replace(/^\+34/, '')
    .trim() || null;
}

/**
 * Normaliza texto a Title Case
 */
function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Busca clínicas dentales en Google Search por código postal
 */
async function buscarPorCodigoPostal(page, codigoPostal, maxResultados = 10) {
  const resultados = [];
  
  try {
      // Búsqueda específica con código postal (solo las más efectivas)
      const busquedas = [
        `clínica dental ${codigoPostal} Córdoba`,
        `dentista ${codigoPostal} Córdoba`
      ];
      
      for (const busqueda of busquedas) {
      const url = `https://www.google.com/search?q=${encodeURIComponent(busqueda)}&num=10`;
      
      if (DEBUG) {
        console.log(`      🔍 Búsqueda: ${busqueda}`);
      }
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Intentar aceptar cookies
      try {
        const cookieSelectors = [
          'button:has-text("Aceptar")',
          'button:has-text("Accept")',
          '#L2AGLb',
          'button[id*="accept"]'
        ];
        
        for (const selector of cookieSelectors) {
          try {
            const cookieButton = await page.$(selector);
            if (cookieButton) {
              await cookieButton.click();
              await new Promise(resolve => setTimeout(resolve, 1000));
              break;
            }
          } catch (e) {}
        }
      } catch (e) {}
      
      // Extraer resultados
      const datos = await page.evaluate((max, cp) => {
        const items = [];
        
        // Selectores para resultados de Google
        const selectoresResultados = [
          '.g',
          '.tF2Cxc',
          '[data-sokoban-container]',
          '.MjjYud',
          '.hlcw0c'
        ];
        
        let elementos = [];
        for (const selector of selectoresResultados) {
          elementos = Array.from(document.querySelectorAll(selector));
          if (elementos.length > 0) break;
        }
        
        elementos.forEach((el, idx) => {
          if (idx >= max) return;
          
          try {
            // Nombre/Título
            let nombre = '';
            const tituloSelectores = [
              'h3',
              '.LC20lb',
              '.DKV0Md',
              'a h3',
              '.g h3',
              '[role="heading"]'
            ];
            
            for (const sel of tituloSelectores) {
              const tituloEl = el.querySelector(sel);
              if (tituloEl) {
                nombre = tituloEl.textContent?.trim() || '';
                if (nombre && nombre.length > 3) break;
              }
            }
            
            if (!nombre) {
              const linkEl = el.querySelector('a');
              if (linkEl) {
                nombre = linkEl.textContent?.trim() || linkEl.getAttribute('aria-label') || '';
              }
            }
            
            // Filtrar resultados no relevantes
            if (!nombre || nombre.length < 3) return;
            
            const nombreLower = nombre.toLowerCase();
            const filtros = [
              'wikipedia', 'facebook', 'instagram', 'twitter',
              'los 20', 'los 10', 'mejor valorados', 'más recomendados',
              'directorio', 'listado', 'ranking', 'top',
              'cómo', 'cuánto', 'cuál', 'qué', 'guía', 'tips',
              'universidad', 'colegio oficial', 'junta de',
              'precio', 'actualizado', 'coste', 'tarifa'
            ];
            
            if (filtros.some(filtro => nombreLower.includes(filtro))) return;
            if (nombre.trim().startsWith('¿') || nombre.trim().startsWith('?')) return;
            if (nombreLower.includes('precio') && nombreLower.includes('implante')) return;
            
            // Snippet
            let snippet = '';
            const snippetSelectores = [
              '.VwiC3b',
              '.s',
              '.IsZvec',
              '.st',
              '.aCOpRe'
            ];
            
            for (const sel of snippetSelectores) {
              const snippetEl = el.querySelector(sel);
              if (snippetEl) {
                snippet = snippetEl.textContent?.trim() || '';
                if (snippet) break;
              }
            }
            
            // Verificar que sea una clínica real
            const esClinicaReal = (
              (nombreLower.includes('clínica') && (nombreLower.includes('dental') || nombreLower.includes('odontolog'))) ||
              (nombreLower.includes('dentista') && !nombreLower.includes('cómo') && !nombreLower.includes('cuánto')) ||
              (nombreLower.includes('odontolog') && !nombreLower.includes('universidad'))
            );
            
            if (!esClinicaReal) return;
            
            // Extraer dirección
            let direccion = '';
            const direccionPatterns = [
              /(C\/|Calle|Av\.|Avenida|Plaza|Paseo)[^,]{0,50},?\s*\d{5}/i,
              /\d{5}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+(?:Córdoba|Cordoba)/i,
              new RegExp(`(C\/|Calle|Av\\.|Avenida|Plaza|Paseo)[^,]{0,50},?\\s*${cp}`, 'i')
            ];
            
            for (const pattern of direccionPatterns) {
              const match = snippet.match(pattern) || nombre.match(pattern);
              if (match) {
                direccion = match[0];
                break;
              }
            }
            
            if (!direccion && snippet.includes(cp)) {
              direccion = snippet.substring(0, 100);
            }
            
            // Extraer teléfono
            let telefono = '';
            const telefonoPatterns = [
              /(\+34|0034)?[\s-]?[6-9]\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}/,
              /Tel[\.:]?\s*(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/i,
              /(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/
            ];
            
            for (const pattern of telefonoPatterns) {
              const match = snippet.match(pattern);
              if (match) {
                telefono = match[1] || match[0];
                telefono = telefono.replace(/[\s-]/g, '');
                if (telefono.startsWith('+34')) telefono = telefono.substring(3);
                if (telefono.startsWith('0034')) telefono = telefono.substring(4);
                break;
              }
            }
            
            // Extraer CIF/DNI del snippet si está disponible (rápido)
            let cif = '';
            const textoCompleto = (snippet + ' ' + nombre).toUpperCase();
            const cifPatterns = [
              /\b([A-Z]\d{8})\b/,  // CIF: A12345678
              /\b(\d{8}[A-Z])\b/,  // DNI: 12345678A
              /\b([A-Z]{2}\d{7}[A-Z0-9])\b/,  // CIF alternativo
              /CIF[:\s]+([A-Z]?\d{8}[A-Z]?)/i,  // CIF: A12345678
              /NIF[:\s]+([A-Z]?\d{8}[A-Z]?)/i,  // NIF: A12345678
              /DNI[:\s]+(\d{8}[A-Z])/i  // DNI: 12345678A
            ];
            
            for (const pattern of cifPatterns) {
              const match = textoCompleto.match(pattern);
              if (match) {
                cif = match[1];
                break;
              }
            }
            
            items.push({
              nombre: nombre.substring(0, 255),
              direccion: direccion.substring(0, 255) || `Código Postal ${cp}`,
              telefono: telefono || '',
              codigoPostal: cp,
              cif: cif || ''
            });
          } catch (e) {
            // Ignorar errores
          }
        });
        
        return items;
      }, maxResultados, codigoPostal);
      
      resultados.push(...datos);
      
      // Pausa entre búsquedas
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Eliminar duplicados
    const resultadosUnicos = [];
    const nombresVistos = new Set();
    
    for (const resultado of resultados) {
      const nombreNormalizado = resultado.nombre.toLowerCase().trim();
      if (!nombresVistos.has(nombreNormalizado)) {
        nombresVistos.add(nombreNormalizado);
        resultadosUnicos.push(resultado);
      }
    }
    
    if (DEBUG) {
      console.log(`      ✅ Encontrados ${resultadosUnicos.length} resultados únicos para CP ${codigoPostal}`);
    }
    
    return resultadosUnicos;
    
  } catch (error) {
    console.error(`      ⚠️  Error buscando CP ${codigoPostal}: ${error.message}`);
    return [];
  }
}

/**
 * Adapta los datos a la estructura de Clientes
 */
async function adaptarDatosACliente(datos) {
  const provinciaCordoba = provinciasDB?.find(p => {
    const nombre = p.Nombre || '';
    return nombre.toLowerCase().includes('córdoba') || nombre.toLowerCase().includes('cordoba');
  });
  
  const espana = await crm.getPaisByCodigoISO('ES');
  
  // Tipo de cliente
  let tipoClienteId = null;
  let tipoClienteNombre = 'Clínica Dental';
  
  for (const [nombre, id] of tiposClientesMap.entries()) {
    if (nombre.includes('dental') || nombre.includes('odontolog') || nombre.includes('clinic')) {
      tipoClienteId = id;
      tipoClienteNombre = nombre;
      break;
    }
  }
  
  if (!tipoClienteId && tiposClientesMap.size > 0) {
    tipoClienteId = Array.from(tiposClientesMap.values())[0];
  }
  
  // Forma de pago
  let formaPagoId = null;
  if (formasPagoMap.size > 0) {
    for (const [nombre, id] of formasPagoMap.entries()) {
      if (nombre.includes('transferencia') || nombre.includes('transfer')) {
        formaPagoId = id;
        break;
      }
    }
    if (!formaPagoId) {
      formaPagoId = Array.from(formasPagoMap.values())[0];
    }
  }
  
  // Provincia
  let provinciaId = provinciaCordoba?.id || null;
  if (datos.codigoPostal && provinciasDB && !provinciaId) {
    provinciaId = obtenerProvinciaPorCodigoPostal(datos.codigoPostal, provinciasDB);
  }
  if (!provinciaId && provinciaCordoba) {
    provinciaId = provinciaCordoba.id;
  }
  
  const cliente = {
    Id_Cial: comercialesMap || 1,
    DNI_CIF: datos.cif || null, // Usar CIF si se encontró en el snippet
    Nombre_Razon_Social: toTitleCase(datos.nombre),
    Nombre_Cial: toTitleCase(datos.nombre),
    NumeroFarmacia: null,
    Direccion: datos.direccion ? toTitleCase(datos.direccion) : null,
    Poblacion: 'Córdoba',
    Id_Provincia: provinciaId,
    CodigoPostal: datos.codigoPostal,
    Movil: limpiarTelefono(datos.telefono),
    Email: null,
    TipoCliente: tipoClienteNombre,
    Id_TipoCliente: tipoClienteId,
    CodPais: espana?.Id_pais || 'ES',
    Id_Pais: espana?.id || null,
    Pais: espana?.Nombre_pais || 'España',
    Idioma: 'Español',
    Id_Idioma: idiomasMap,
    Moneda: 'EUR',
    Id_Moneda: monedasMap,
    NomContacto: null,
    Tarifa: null,
    Id_FormaPago: formaPagoId,
    Dto: 0.00,
    CuentaContable: siguienteCuentaContable++,
    RE: null,
    Banco: null,
    Swift: null,
    IBAN: null,
    Modelo_347: 1
  };
  
  return cliente;
}

/**
 * Verifica si un cliente ya existe
 */
async function clienteExiste(cliente) {
  try {
    const sql = `
      SELECT id FROM clientes 
      WHERE Nombre_Razon_Social = ? 
      AND (Direccion = ? OR (? IS NULL AND Direccion IS NULL))
      LIMIT 1
    `;
    const resultados = await crm.query(sql, [
      cliente.Nombre_Razon_Social,
      cliente.Direccion,
      cliente.Direccion
    ]);
    return resultados.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Inserta un cliente
 */
async function insertarCliente(cliente) {
  try {
    const existe = await clienteExiste(cliente);
    if (existe) {
      return { insertado: false, motivo: 'Ya existe' };
    }
    
    if (DRY_RUN) {
      return { insertado: true, motivo: 'Simulación' };
    }
    
    const resultado = await crm.createCliente(cliente);
    return { insertado: true, id: resultado.insertId };
    
  } catch (error) {
    return { insertado: false, motivo: error.message };
  }
}

/**
 * Función principal
 */
async function scrapearPorCodigoPostal() {
  let browser = null;
  
  try {
    console.log('🚀 Iniciando scraping por código postal (14xxx - Córdoba)...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    
    await cargarLookups();
    console.log('');
    
    // Iniciar navegador
    console.log('🌐 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const todosLosResultados = [];
    
    // Limitar códigos postales si se especifica
    const codigosAProcesar = MAX_CP ? CODIGOS_POSTALES_CORDOBA.slice(0, MAX_CP) : CODIGOS_POSTALES_CORDOBA;
    
    console.log(`📡 Buscando en ${codigosAProcesar.length} códigos postales...`);
    if (MAX_CP) {
      console.log(`   ⚠️  Limitado a ${MAX_CP} códigos postales (usa --max-codigos=N para cambiar)\n`);
    } else {
      console.log(`   💡 Usa --max-codigos=N para limitar el número de códigos postales\n`);
    }
    
    // Buscar en cada código postal
    for (let i = 0; i < codigosAProcesar.length; i++) {
      const cp = codigosAProcesar[i];
      console.log(`[${i + 1}/${codigosAProcesar.length}] Buscando en CP ${cp}...`);
      
      const resultados = await buscarPorCodigoPostal(page, cp, MAX_RESULTS_PER_CP);
      todosLosResultados.push(...resultados);
      
      if (resultados.length > 0) {
        console.log(`      ✅ Encontradas ${resultados.length} clínicas en CP ${cp}`);
      }
      
      // Pausa entre códigos postales (más corta para ser más rápido)
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Eliminar duplicados globales
    const resultadosUnicos = [];
    const nombresVistos = new Set();
    
    for (const resultado of todosLosResultados) {
      const nombreNormalizado = resultado.nombre.toLowerCase().trim();
      if (!nombresVistos.has(nombreNormalizado)) {
        nombresVistos.add(nombreNormalizado);
        resultadosUnicos.push(resultado);
      }
    }
    
    console.log(`\n📊 Total de resultados únicos encontrados: ${resultadosUnicos.length}\n`);
    
    // Procesar e insertar
    let insertados = 0;
    let duplicados = 0;
    let errores = 0;
    
    for (let i = 0; i < resultadosUnicos.length; i++) {
      const resultado = resultadosUnicos[i];
      console.log(`[${i + 1}/${resultadosUnicos.length}] Procesando: ${resultado.nombre} (CP: ${resultado.codigoPostal})`);
      
      try {
        const cliente = await adaptarDatosACliente(resultado);
        const resultadoInsercion = await insertarCliente(cliente);
        
        if (resultadoInsercion.insertado) {
          if (resultadoInsercion.motivo === 'Ya existe') {
            duplicados++;
            console.log(`  ⚠️  Duplicado: ${cliente.Nombre_Razon_Social}`);
          } else {
            insertados++;
            console.log(`  ✅ Insertado: ${cliente.Nombre_Razon_Social} (ID: ${resultadoInsercion.id || 'N/A'})`);
          }
        } else {
          errores++;
          console.log(`  ❌ Error: ${resultadoInsercion.motivo}`);
        }
      } catch (error) {
        errores++;
        console.error(`  ❌ Error procesando: ${error.message}`);
      }
      
      if (!DRY_RUN && (i + 1) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Scraping completado');
    console.log('='.repeat(80));
    console.log(`📊 Resumen:`);
    console.log(`   ✅ Clientes insertados: ${insertados}`);
    console.log(`   🔄 Duplicados (ya existían): ${duplicados}`);
    console.log(`   ❌ Errores: ${errores}`);
    console.log(`   📋 Total procesados: ${resultadosUnicos.length}`);
    console.log(`   📮 Códigos postales procesados: ${codigosAProcesar.length}`);
    
  } catch (error) {
    console.error('\n❌ Error en scraping:', error);
    console.error('Stack:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
    await crm.disconnect();
  }
}

// Ejecutar
if (require.main === module) {
  scrapearPorCodigoPostal()
    .then(() => {
      console.log('\n✅ Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { scrapearPorCodigoPostal };
