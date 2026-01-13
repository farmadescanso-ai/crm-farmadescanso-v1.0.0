/**
 * Script para scrapear clínicas dentales en Jaén por código postal
 * Busca en todos los códigos postales que comienzan por 23 (provincia de Jaén)
 */

const puppeteer = require('puppeteer');
const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');
const MAX_RESULTS_PER_CP = parseInt(process.argv.find(arg => arg.startsWith('--max-cp='))?.split('=')[1]) || 5;
const MAX_CP = parseInt(process.argv.find(arg => arg.startsWith('--max-codigos='))?.split('=')[1]) || null;
const DEBUG = process.argv.includes('--debug');

// Códigos postales principales de Jaén (capital y principales localidades)
const GENERAR_TODOS_LOS_CP = process.argv.includes('--todos-cp');

let CODIGOS_POSTALES_JAEN = [];

if (GENERAR_TODOS_LOS_CP) {
  // Generar todos los códigos postales 23xxx (23000-23999)
  console.log('📮 Generando todos los códigos postales 23xxx...');
  for (let i = 0; i <= 999; i++) {
    const cp = `23${String(i).padStart(3, '0')}`;
    CODIGOS_POSTALES_JAEN.push(cp);
  }
} else {
  // Solo códigos postales principales (más eficiente)
  CODIGOS_POSTALES_JAEN = [
    // Jaén capital (principales)
    '23001', '23002', '23003', '23004', '23005', '23006', '23007', '23008', '23009', '23010',
    '23011', '23012', '23013', '23014', '23015', '23016', '23017', '23018', '23019', '23020',
    // Principales localidades
    '23400', // Úbeda
    '23440', // Baeza
    '23700', // Linares
    '23200', // La Carolina
    '23220', // Andújar
    '23600', // Martos
    '23680', // Alcalá la Real
    '23420', // Villacarrillo
    '23460', // Cazorla
    '23470', // Quesada
    '23480', // Peal de Becerro
    '23500', // Jódar
    '23520', // Huelma
    '23530', // Cambil
    '23540', // Huesa
    '23550', // Jimena
    '23560', // Mancha Real
    '23570', // Pegalajar
    '23580', // Torres
    '23590', // Villanueva de la Reina
    '23610', // Fuensanta de Martos
    '23620', // Valdepeñas de Jaén
    '23630', // Villardompardo
    '23640', // Alcaudete
    '23650', // Torredonjimeno
    '23660', // Fuente-Tójar
    '23670', // Alcalá la Real
    '23710', // Bailén
    '23720', // Baños de la Encina
    '23730', // Guarromán
    '23740', // Carboneros
    '23750', // La Carolina
    '23760', // Santa Elena
    '23770', // Vilches
    '23780', // Aldeaquemada
    '23790', // Navas de San Juan
    '23800', // Arquillos
    '23810', // Begíjar
    '23820', // Canena
    '23830', // Ibros
    '23840', // Lupión
    '23850', // Rus
    '23860', // Sabiote
    '23870', // Torreperogil
    '23880', // Villanueva del Arzobispo
    '23890', // Villatorres
    '23900', // Villacarrillo
    '23910', // Cazorla
    '23920', // Chilluévar
    '23930', // Hinojares
    '23940', // Huesa
    '23950', // La Iruela
    '23960', // Peal de Becerro
    '23970', // Pozo Alcón
    '23980', // Quesada
    '23990'  // Santo Tomé
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
    
    // Provincias - buscar Jaén
    provinciasDB = await crm.getProvincias();
    const jaenProv = provinciasDB.find(p => {
      const nombre = p.Nombre || '';
      return nombre.toLowerCase().includes('jaén') || nombre.toLowerCase().includes('jaen');
    });
    console.log(`  ✅ ${provinciasDB.length} provincias cargadas (Jaén: ID ${jaenProv?.id || 'no encontrada'})`);
    
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
    // Búsqueda específica con código postal
    const busquedas = [
      `clínica dental ${codigoPostal} Jaén`,
      `dentista ${codigoPostal} Jaén`
    ];
    
    for (const busqueda of busquedas) {
      const url = `https://www.google.com/search?q=${encodeURIComponent(busqueda)}&num=10`;
      
      if (DEBUG) {
        console.log(`      🔍 Búsqueda: ${busqueda}`);
      }
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
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
              await new Promise(resolve => setTimeout(resolve, 500));
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
              /\d{5}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+(?:Jaén|Jaen)/i,
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
            
            // Extraer CIF/DNI del snippet si está disponible
            let cif = '';
            const textoCompleto = (snippet + ' ' + nombre).toUpperCase();
            const cifPatterns = [
              /\b([A-Z]\d{8})\b/,  // CIF: A12345678
              /\b(\d{8}[A-Z])\b/,  // DNI: 12345678A
              /\b([A-Z]{2}\d{7}[A-Z0-9])\b/,  // CIF alternativo
              /CIF[:\s]+([A-Z]?\d{8}[A-Z]?)/i,
              /NIF[:\s]+([A-Z]?\d{8}[A-Z]?)/i,
              /DNI[:\s]+(\d{8}[A-Z])/i
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
      await new Promise(resolve => setTimeout(resolve, 1000));
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
  const provinciaJaen = provinciasDB?.find(p => {
    const nombre = p.Nombre || '';
    return nombre.toLowerCase().includes('jaén') || nombre.toLowerCase().includes('jaen');
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
  let provinciaId = provinciaJaen?.id || null;
  if (datos.codigoPostal && provinciasDB && !provinciaId) {
    provinciaId = obtenerProvinciaPorCodigoPostal(datos.codigoPostal, provinciasDB);
  }
  if (!provinciaId && provinciaJaen) {
    provinciaId = provinciaJaen.id;
  }
  
  // Extraer población del código postal o dirección
  let poblacion = 'Jaén';
  if (datos.direccion) {
    const localidadesJaen = [
      'Úbeda', 'Baeza', 'Linares', 'La Carolina', 'Andújar', 'Martos',
      'Alcalá la Real', 'Villacarrillo', 'Cazorla', 'Quesada', 'Jódar'
    ];
    for (const localidad of localidadesJaen) {
      if (datos.direccion.toLowerCase().includes(localidad.toLowerCase())) {
        poblacion = localidad;
        break;
      }
    }
  }
  
  const cliente = {
    Id_Cial: comercialesMap || 1,
    DNI_CIF: datos.cif || null,
    Nombre_Razon_Social: toTitleCase(datos.nombre),
    Nombre_Cial: toTitleCase(datos.nombre),
    NumeroFarmacia: null,
    Direccion: datos.direccion ? toTitleCase(datos.direccion) : null,
    Poblacion: poblacion,
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
async function scrapearClinicasJaen() {
  let browser = null;
  
  try {
    console.log('🚀 Iniciando scraping por código postal (23xxx - Jaén)...');
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
    const codigosAProcesar = MAX_CP ? CODIGOS_POSTALES_JAEN.slice(0, MAX_CP) : CODIGOS_POSTALES_JAEN;
    
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
      
      // Pausa entre códigos postales
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
            if (cliente.DNI_CIF) {
              console.log(`     📋 CIF/DNI: ${cliente.DNI_CIF}`);
            }
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
  scrapearClinicasJaen()
    .then(() => {
      console.log('\n✅ Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { scrapearClinicasJaen };
