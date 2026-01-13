/**
 * Script para scrapear clínicas dentales en Badajoz (06xxx) y Cáceres (10xxx)
 * Busca en todos los códigos postales que comienzan por 06 (Badajoz) y 10 (Cáceres)
 */

const puppeteer = require('puppeteer');
const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');
const MAX_RESULTS_PER_CP = parseInt(process.argv.find(arg => arg.startsWith('--max-cp='))?.split('=')[1]) || 5;
const MAX_CP = parseInt(process.argv.find(arg => arg.startsWith('--max-codigos='))?.split('=')[1]) || null;
const DEBUG = process.argv.includes('--debug');

// Códigos postales principales de Badajoz y Cáceres
const GENERAR_TODOS_LOS_CP = process.argv.includes('--todos-cp');

let CODIGOS_POSTALES_BADAJOZ_CACERES = [];

// Por defecto, generar TODOS los códigos postales de Cáceres (10xxx)
// Para Badajoz solo los principales, a menos que se especifique --todos-cp
if (GENERAR_TODOS_LOS_CP) {
  // Generar todos los códigos postales 06xxx y 10xxx
  console.log('📮 Generando todos los códigos postales 06xxx y 10xxx...');
  for (let i = 0; i <= 999; i++) {
    CODIGOS_POSTALES_BADAJOZ_CACERES.push(`06${String(i).padStart(3, '0')}`);
    CODIGOS_POSTALES_BADAJOZ_CACERES.push(`10${String(i).padStart(3, '0')}`);
  }
} else {
  // Generar TODOS los códigos postales de Cáceres (10xxx)
  console.log('📮 Generando todos los códigos postales de Cáceres (10xxx)...');
  for (let i = 0; i <= 999; i++) {
    CODIGOS_POSTALES_BADAJOZ_CACERES.push(`10${String(i).padStart(3, '0')}`);
  }
  
  // Para Badajoz, solo los principales
  const badajozPrincipales = [
    // Badajoz capital (principales)
    '06001', '06002', '06003', '06004', '06005', '06006', '06007', '06008', '06009', '06010',
    '06011', '06012', '06013', '06014', '06015',
    // Principales localidades Badajoz
    '06200', // Almendralejo
    '06100', // Villanueva de la Serena
    '06400', // Don Benito
    '06380', // Jerez de los Caballeros
    '06140', // Olivenza
    '06120', // Valverde de Leganés
    '06170', // Villafranca de los Barros
    '06110', // Santa Marta de los Barros
    '06440', // Mérida
    '06160', // Talavera la Real
    '06130', // Los Santos de Maimona
    '06420', // Castuera
    '06430', // Puebla de Alcocer
    '06410', // Cabeza del Buey
    '06450'  // Campanario
  ];
  
  CODIGOS_POSTALES_BADAJOZ_CACERES.push(...badajozPrincipales);
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
    
    // Provincias - buscar Badajoz y Cáceres
    provinciasDB = await crm.getProvincias();
    const badajozProv = provinciasDB.find(p => {
      const nombre = p.Nombre || '';
      return nombre.toLowerCase().includes('badajoz');
    });
    const caceresProv = provinciasDB.find(p => {
      const nombre = p.Nombre || '';
      return nombre.toLowerCase().includes('cáceres') || nombre.toLowerCase().includes('caceres');
    });
    console.log(`  ✅ ${provinciasDB.length} provincias cargadas (Badajoz: ID ${badajozProv?.id || 'no encontrada'}, Cáceres: ID ${caceresProv?.id || 'no encontrada'})`);
    
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
    // Determinar provincia por código postal
    const provincia = codigoPostal.startsWith('06') ? 'Badajoz' : 'Cáceres';
    
    // Búsqueda específica con código postal
    const busquedas = [
      `clínica dental ${codigoPostal} ${provincia}`,
      `dentista ${codigoPostal} ${provincia}`
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
      const datos = await page.evaluate((max, cp, prov) => {
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
            
            // URL del enlace
            let url = '';
            const linkEl = el.querySelector('a[href^="http"]');
            if (linkEl) {
              url = linkEl.getAttribute('href') || '';
            }
            
            // Extraer dirección
            let direccion = '';
            const direccionPatterns = [
              /(C\/|Calle|Av\.|Avenida|Plaza|Paseo|Ronda)[^,]{0,50},?\s*\d{5}/i,
              new RegExp(`(C\/|Calle|Av\\.|Avenida|Plaza|Paseo)[^,]{0,50},?\\s*${cp}`, 'i'),
              new RegExp(`${cp}\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ\\s]+(?:${prov}|Badajoz|Cáceres)`, 'i')
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
            
            // Extraer email
            let email = '';
            const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/gi;
            const emails = snippet.match(emailRegex);
            if (emails && emails.length > 0) {
              const emailFiltrado = emails.find(e => {
                const eLower = e.toLowerCase();
                return !eLower.includes('example.com') && !eLower.includes('test.com');
              });
              if (emailFiltrado) {
                email = emailFiltrado.toLowerCase();
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
              email: email || '',
              codigoPostal: cp,
              cif: cif || '',
              url: url || ''
            });
          } catch (e) {
            // Ignorar errores
          }
        });
        
        return items;
      }, maxResultados, codigoPostal, provincia);
      
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
  const provinciaBadajoz = provinciasDB?.find(p => {
    const nombre = p.Nombre || '';
    return nombre.toLowerCase().includes('badajoz');
  });
  
  const provinciaCaceres = provinciasDB?.find(p => {
    const nombre = p.Nombre || '';
    return nombre.toLowerCase().includes('cáceres') || nombre.toLowerCase().includes('caceres');
  });
  
  const espana = await crm.getPaisByCodigoISO('ES');
  
  // Determinar provincia por código postal
  let provinciaId = null;
  let provinciaNombre = '';
  if (datos.codigoPostal.startsWith('06')) {
    provinciaId = provinciaBadajoz?.id || null;
    provinciaNombre = 'Badajoz';
  } else if (datos.codigoPostal.startsWith('10')) {
    provinciaId = provinciaCaceres?.id || null;
    provinciaNombre = 'Cáceres';
  }
  
  // Si no se encontró por código postal, intentar por código postal
  if (!provinciaId && provinciasDB) {
    provinciaId = obtenerProvinciaPorCodigoPostal(datos.codigoPostal, provinciasDB);
  }
  
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
  
  // Extraer población del código postal o dirección
  let poblacion = provinciaNombre;
  if (datos.direccion && datos.direccion !== `Código Postal ${datos.codigoPostal}`) {
    const localidadesBadajoz = ['Badajoz', 'Almendralejo', 'Villanueva de la Serena', 'Don Benito', 'Jerez de los Caballeros', 'Olivenza', 'Mérida', 'Talavera la Real'];
    const localidadesCaceres = ['Cáceres', 'Plasencia', 'Trujillo', 'Coria', 'Navalmoral de la Mata', 'Guadalupe', 'Hervás'];
    const localidades = provinciaNombre === 'Badajoz' ? localidadesBadajoz : localidadesCaceres;
    
    for (const localidad of localidades) {
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
    Email: datos.email || null,
    Web: datos.url || null,
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
async function scrapearClinicasBadajozCaceres() {
  let browser = null;
  
  try {
    console.log('🚀 Iniciando scraping por código postal (06xxx - Badajoz y 10xxx - Cáceres)...');
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
    const codigosAProcesar = MAX_CP ? CODIGOS_POSTALES_BADAJOZ_CACERES.slice(0, MAX_CP) : CODIGOS_POSTALES_BADAJOZ_CACERES;
    
    console.log(`📡 Buscando en ${codigosAProcesar.length} códigos postales...`);
    if (MAX_CP) {
      console.log(`   ⚠️  Limitado a ${MAX_CP} códigos postales (usa --max-codigos=N para cambiar)\n`);
    } else {
      console.log(`   💡 Usa --max-codigos=N para limitar el número de códigos postales\n`);
    }
    
    // Buscar en cada código postal
    for (let i = 0; i < codigosAProcesar.length; i++) {
      const cp = codigosAProcesar[i];
      const provincia = cp.startsWith('06') ? 'Badajoz' : 'Cáceres';
      console.log(`[${i + 1}/${codigosAProcesar.length}] Buscando en CP ${cp} (${provincia})...`);
      
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
      const provincia = resultado.codigoPostal.startsWith('06') ? 'Badajoz' : 'Cáceres';
      console.log(`[${i + 1}/${resultadosUnicos.length}] Procesando: ${resultado.nombre} (CP: ${resultado.codigoPostal}, ${provincia})`);
      
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
            if (cliente.Web) {
              console.log(`     🌐 Web: ${cliente.Web}`);
            }
            if (cliente.Email) {
              console.log(`     📧 Email: ${cliente.Email}`);
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
  scrapearClinicasBadajozCaceres()
    .then(() => {
      console.log('\n✅ Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { scrapearClinicasBadajozCaceres };
