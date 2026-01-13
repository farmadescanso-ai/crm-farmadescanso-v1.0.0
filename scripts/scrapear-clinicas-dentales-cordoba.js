/**
 * Script para scrapear clínicas dentales, odontólogos y dentistas en Córdoba
 * y darlos de alta en la base de datos de Clientes
 */

const puppeteer = require('puppeteer');
const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');
const MAX_RESULTS = parseInt(process.argv.find(arg => arg.startsWith('--max='))?.split('=')[1]) || 100;
const DEBUG = process.argv.includes('--debug');

// Cache para lookups
let comercialesMap = null;
let formasPagoMap = null;
let tiposClientesMap = null;
let idiomasMap = null;
let monedasMap = null;
let provinciasDB = null;
let paisesDB = null;

/**
 * Carga los datos de lookup necesarios
 */
async function cargarLookups() {
  console.log('📚 Cargando datos de lookup...');
  
  try {
    await crm.connect();
    
    // Comerciales - usar el primero disponible o ID 1 por defecto
    const comerciales = await crm.query('SELECT id FROM comerciales LIMIT 1');
    comercialesMap = comerciales.length > 0 ? comerciales[0].id : 1;
    console.log(`  ✅ Comercial por defecto: ID ${comercialesMap}`);
    
    // Formas de Pago - usar la primera disponible
    const formasPago = await crm.query('SELECT id, FormaPago FROM formas_pago LIMIT 10');
    formasPagoMap = new Map();
    formasPago.forEach(fp => {
      if (fp.FormaPago) {
        formasPagoMap.set(fp.FormaPago.toLowerCase(), fp.id);
      }
    });
    console.log(`  ✅ ${formasPagoMap.size} formas de pago cargadas`);
    
    // Tipos de Cliente - buscar "Clínica Dental" o similar
    const tiposClientes = await crm.query('SELECT id, Tipo FROM tipos_clientes');
    tiposClientesMap = new Map();
    tiposClientes.forEach(tc => {
      if (tc.Tipo) {
        tiposClientesMap.set(tc.Tipo.toLowerCase(), tc.id);
      }
    });
    console.log(`  ✅ ${tiposClientesMap.size} tipos de cliente cargados`);
    
    // Idiomas - usar español por defecto
    const idiomas = await crm.query('SELECT id, Codigo, Nombre FROM idiomas WHERE Codigo = "es" OR Nombre LIKE "%español%" LIMIT 1');
    idiomasMap = idiomas.length > 0 ? idiomas[0].id : null;
    console.log(`  ✅ Idioma por defecto: ID ${idiomasMap || 'null'}`);
    
    // Monedas - usar EUR por defecto
    const monedas = await crm.query('SELECT id, Codigo FROM monedas WHERE Codigo = "EUR" LIMIT 1');
    monedasMap = monedas.length > 0 ? monedas[0].id : null;
    console.log(`  ✅ Moneda por defecto: ID ${monedasMap || 'null'}`);
    
    // Provincias - buscar Córdoba
    provinciasDB = await crm.getProvincias();
    const cordobaProv = provinciasDB.find(p => {
      const nombre = p.Nombre || '';
      return nombre.toLowerCase().includes('córdoba') || nombre.toLowerCase().includes('cordoba');
    });
    console.log(`  ✅ ${provinciasDB.length} provincias cargadas (Córdoba: ID ${cordobaProv?.id || 'no encontrada'})`);
    
    // Países - España (usar método del CRM)
    paisesDB = await crm.getPaises();
    const espana = await crm.getPaisByCodigoISO('ES');
    console.log(`  ✅ ${paisesDB.length} países cargados (España: ID ${espana?.id || 'no encontrada'})`);
    
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
 * Extrae código postal de una dirección (solo códigos de Córdoba: 14xxx)
 */
function extraerCodigoPostal(texto, codigoPostalExtraido) {
  // Si ya se extrajo un código postal válido, usarlo
  if (codigoPostalExtraido && codigoPostalExtraido.startsWith('14')) {
    return codigoPostalExtraido;
  }
  
  if (!texto) return null;
  // Buscar código postal de Córdoba (debe empezar con 14)
  const match = texto.match(/\b(14\d{3})\b/);
  return match ? match[0] : null;
}

/**
 * Extrae población de una dirección o texto
 */
function extraerPoblacion(texto, direccion) {
  if (!texto && !direccion) return null;
  const textoCompleto = (texto || '') + ' ' + (direccion || '');
  
  // Buscar "Córdoba" o nombres de localidades comunes en Córdoba
  const localidades = [
    'Córdoba', 'Cordoba', 'Lucena', 'Puente Genil', 'Montilla', 
    'Priego de Córdoba', 'Cabra', 'Baena', 'Peñarroya-Pueblonuevo',
    'Rute', 'Villanueva de Córdoba', 'La Carlota', 'Fuente Palmera'
  ];
  
  for (const localidad of localidades) {
    if (textoCompleto.toLowerCase().includes(localidad.toLowerCase())) {
      return localidad;
    }
  }
  
  return 'Córdoba'; // Por defecto
}

/**
 * Normaliza texto a Title Case
 */
function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Busca clínicas dentales en Google Search (más rápido y efectivo)
 */
async function buscarEnGoogleSearch(page, termino, maxResultados = 20) {
  const resultados = [];
  
  try {
    // Usar búsqueda de Google Search (el término ya incluye Córdoba)
    const busqueda = termino.includes('Córdoba') ? termino : `${termino} Córdoba`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(busqueda)}&num=20`;
    console.log(`  🔍 Buscando: ${busqueda} en Google Search...`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Esperar a que cargue el contenido
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Intentar aceptar cookies si aparece
    try {
      const cookieSelectors = [
        'button:has-text("Aceptar")',
        'button:has-text("Accept")',
        '#L2AGLb',
        'button[id*="accept"]',
        'button[aria-label*="Accept"]'
      ];
      
      for (const selector of cookieSelectors) {
        try {
          const cookieButton = await page.$(selector);
          if (cookieButton) {
            await cookieButton.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
            break;
          }
        } catch (e) {}
      }
    } catch (e) {
      // Ignorar si no hay botón de cookies
    }
    
    // Guardar captura para debugging
    if (DEBUG) {
      try {
        await page.screenshot({ path: `debug-google-search-${Date.now()}.png`, fullPage: true });
        console.log('  📸 Captura de pantalla guardada para debugging');
      } catch (e) {}
    }
    
    // Intentar hacer scroll para cargar más resultados
    await page.evaluate(() => {
      return new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight || totalHeight > 3000) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Intentar hacer clic en "Más resultados" si existe
    try {
      const masResultados = await page.$('button:has-text("Más resultados"), button:has-text("More results")');
      if (masResultados) {
        await masResultados.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (e) {
      // Ignorar
    }
    
    // Extraer resultados de Google Search - método optimizado
    const datos = await page.evaluate((max) => {
      const items = [];
      
      // Selectores para resultados de búsqueda de Google
      const selectoresResultados = [
        '.g',                    // Resultado estándar
        '.tF2Cxc',               // Resultado moderno
        '[data-sokoban-container]', // Contenedor de resultados
        '.MjjYud',               // Resultado nuevo
        '.hlcw0c'                // Resultado alternativo
      ];
      
      let elementos = [];
      for (const selector of selectoresResultados) {
        elementos = Array.from(document.querySelectorAll(selector));
        if (elementos.length > 0) {
          console.log(`Encontrados ${elementos.length} resultados con selector: ${selector}`);
          break;
        }
      }
      
      elementos.forEach((el, idx) => {
        if (idx >= max) return;
        
        try {
          // Nombre/Título del resultado
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
          
          // Si no hay título, buscar en enlaces
          if (!nombre) {
            const linkEl = el.querySelector('a');
            if (linkEl) {
              nombre = linkEl.textContent?.trim() || linkEl.getAttribute('aria-label') || '';
            }
          }
          
          // Filtrar resultados no relevantes
          if (!nombre || nombre.length < 3) return;
          
          // Filtrar páginas de directorios, listados, artículos, etc.
          const nombreLower = nombre.toLowerCase();
          const filtros = [
            'wikipedia', 'facebook', 'instagram', 'twitter',
            'los 20', 'los 10', 'mejor valorados', 'más recomendados',
            'directorio', 'listado', 'ranking', 'top',
            'ver más', 'ver todos', 'buscar', 'resultados',
            'cómo', 'cuánto', 'cuál', 'qué', 'guía', 'tips',
            'universidad', 'colegio oficial', 'junta de',
            'necesito', 'precio', 'actualizado', 'bogotá',
            'biogasteiz', 'uniscopio', 'cleardent'
          ];
          
          if (filtros.some(filtro => nombreLower.includes(filtro))) return;
          
          // Filtrar si empieza con signos de interrogación (artículos)
          if (nombre.trim().startsWith('¿') || nombre.trim().startsWith('?')) return;
          
          // Snippet/Descripción (puede contener dirección y teléfono)
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
          
          // Extraer dirección del snippet o del nombre
          let direccion = '';
          let codigoPostal = '';
          
          // Buscar código postal de Córdoba (debe empezar con 14)
          const cpPattern = /\b(14\d{3})\b/;
          const cpMatch = (snippet + ' ' + nombre).match(cpPattern);
          if (cpMatch) {
            codigoPostal = cpMatch[1];
          }
          
          // Buscar patrones de dirección (códigos postales, calles, etc.)
          const direccionPatterns = [
            /(C\/|Calle|Av\.|Avenida|Plaza|Paseo)[^,]{0,50},?\s*\d{5}/i,
            /\d{5}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+(?:Córdoba|Cordoba)/i,
            /(C\/|Calle|Av\.|Avenida|Plaza|Paseo)[^,]{0,50}/i
          ];
          
          for (const pattern of direccionPatterns) {
            const match = snippet.match(pattern) || nombre.match(pattern);
            if (match) {
              direccion = match[0];
              break;
            }
          }
          
          // Si no hay dirección en el snippet, intentar extraer de todo el texto
          if (!direccion) {
            const textoCompleto = el.textContent || '';
            const direccionMatch = textoCompleto.match(/(C\/|Calle|Av\.|Avenida)[^,]{0,80}/i);
            if (direccionMatch) {
              direccion = direccionMatch[0].trim();
            } else if (textoCompleto.includes('Córdoba')) {
              direccion = 'Córdoba';
            }
          }
          
          // Si hay código postal pero no es de Córdoba, limpiarlo
          if (codigoPostal && !codigoPostal.startsWith('14')) {
            codigoPostal = '';
          }
          
          // Extraer teléfono del snippet
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
          
          // Si no hay teléfono en snippet, buscar en todo el elemento
          if (!telefono) {
            const textoCompleto = el.textContent || '';
            const telefonoMatch = textoCompleto.match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
            if (telefonoMatch) {
              telefono = telefonoMatch[1].replace(/[\s-]/g, '');
            }
          }
          
          // Solo agregar si tiene nombre válido y parece ser una clínica dental REAL
          // Excluir si es claramente un listado, directorio, artículo o página informativa
          const snippetLower = snippet.toLowerCase();
          const esListado = nombreLower.includes('los ') && 
                           (nombreLower.includes('mejor') || nombreLower.includes('recomendados') || nombreLower.includes('top'));
          
          // Verificar que realmente sea una clínica (debe tener palabras clave específicas)
          const esClinicaReal = (
            (nombreLower.includes('clínica') && (nombreLower.includes('dental') || nombreLower.includes('odontolog'))) ||
            (nombreLower.includes('dentista') && !nombreLower.includes('cómo') && !nombreLower.includes('cuánto')) ||
            (nombreLower.includes('odontolog') && !nombreLower.includes('universidad'))
          );
          
          if (!esListado && esClinicaReal && nombre && (
            nombreLower.includes('dental') ||
            nombreLower.includes('odontolog') ||
            (nombreLower.includes('dentista') && !nombreLower.startsWith('¿'))
          )) {
            items.push({
              nombre: nombre.substring(0, 255),
              direccion: direccion.substring(0, 255) || 'Córdoba',
              telefono: telefono || '',
              codigoPostal: codigoPostal || ''
            });
          }
        } catch (e) {
          // Ignorar errores en elementos individuales
          console.error('Error procesando elemento:', e);
        }
      });
      
      return items;
    }, maxResultados);
    
    if (DEBUG) {
      console.log(`  🔍 [DEBUG] Elementos encontrados: ${datos.length}`);
      console.log(`  🔍 [DEBUG] Primeros datos:`, JSON.stringify(datos.slice(0, 3), null, 2));
    }
    
    // Los datos ya están extraídos directamente de los resultados de búsqueda
    datos.forEach(item => {
      if (item.nombre) {
        resultados.push({
          nombre: item.nombre,
          direccion: item.direccion || 'Córdoba',
          telefono: limpiarTelefono(item.telefono),
          codigoPostal: item.codigoPostal || '',
          web: '',
          fuente: 'Google Search'
        });
      }
    });
    
    console.log(`  ✅ Encontrados ${resultados.length} resultados en Google Search`);
    return resultados;
    
  } catch (error) {
    console.error(`  ⚠️  Error en Google Search: ${error.message}`);
    return resultados;
  }
}

/**
 * Busca en páginas amarillas
 */
async function buscarEnPaginasAmarillas(page, termino) {
  const resultados = [];
  
  try {
    const url = `https://www.paginasamarillas.es/search/clinica-dental/all-ma/${encodeURIComponent('Córdoba')}/all-is`;
    console.log(`  🔍 Buscando en Páginas Amarillas...`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const datos = await page.evaluate(() => {
      const items = [];
      const elementos = document.querySelectorAll('.listing-item, .result-item, [data-qa="result-item"]');
      
      elementos.forEach(el => {
        try {
          const nombreEl = el.querySelector('h2, .listing-name, [data-qa="name"]');
          const nombre = nombreEl ? nombreEl.textContent.trim() : '';
          
          if (!nombre) return;
          
          const direccionEl = el.querySelector('.listing-address, [data-qa="address"]');
          const direccion = direccionEl ? direccionEl.textContent.trim() : '';
          
          const telefonoEl = el.querySelector('.listing-phone, [data-qa="phone"]');
          const telefono = telefonoEl ? telefonoEl.textContent.trim() : '';
          
          items.push({
            nombre,
            direccion,
            telefono
          });
        } catch (e) {}
      });
      
      return items;
    });
    
    datos.forEach(item => {
      if (item.nombre) {
        resultados.push({
          nombre: item.nombre,
          direccion: item.direccion,
          telefono: limpiarTelefono(item.telefono),
          web: '',
          fuente: 'Páginas Amarillas'
        });
      }
    });
    
    console.log(`  ✅ Encontrados ${resultados.length} resultados en Páginas Amarillas`);
    return resultados;
    
  } catch (error) {
    console.error(`  ⚠️  Error en Páginas Amarillas: ${error.message}`);
    return resultados;
  }
}

/**
 * Obtiene el siguiente número de cuenta contable disponible
 */
async function obtenerSiguienteCuentaContable() {
  try {
    const resultado = await crm.query('SELECT MAX(CuentaContable) as maxCuenta FROM clientes WHERE CuentaContable IS NOT NULL');
    const maxCuenta = resultado[0]?.maxCuenta || 0;
    return maxCuenta + 1;
  } catch (error) {
    console.warn('  ⚠️  Error obteniendo siguiente cuenta contable:', error.message);
    return null;
  }
}

/**
 * Adapta los datos extraídos a la estructura de la tabla Clientes
 */
async function adaptarDatosACliente(datos, siguienteCuentaContable) {
  const codigoPostal = extraerCodigoPostal(datos.direccion, datos.codigoPostal);
  const poblacion = extraerPoblacion(datos.direccion, '');
  
  // Buscar provincia de Córdoba
  const provinciaCordoba = provinciasDB?.find(p => {
    const nombre = p.Nombre || '';
    return nombre.toLowerCase().includes('córdoba') || 
           nombre.toLowerCase().includes('cordoba');
  });
  
  // Buscar España (usar método del CRM)
  const espana = await crm.getPaisByCodigoISO('ES');
  
  // Buscar tipo de cliente "Clínica Dental" o similar
  let tipoClienteId = null;
  let tipoClienteNombre = 'Clínica Dental';
  
  // Intentar encontrar tipo de cliente relacionado
  for (const [nombre, id] of tiposClientesMap.entries()) {
    if (nombre.includes('dental') || nombre.includes('odontolog') || nombre.includes('clinic')) {
      tipoClienteId = id;
      tipoClienteNombre = nombre;
      break;
    }
  }
  
  // Si no hay tipo específico, usar el primero disponible o null
  if (!tipoClienteId && tiposClientesMap.size > 0) {
    tipoClienteId = Array.from(tiposClientesMap.values())[0];
  }
  
  // Forma de pago por defecto
  let formaPagoId = null;
  if (formasPagoMap.size > 0) {
    // Intentar encontrar "Transferencia" o similar
    for (const [nombre, id] of formasPagoMap.entries()) {
      if (nombre.includes('transferencia') || nombre.includes('transfer')) {
        formaPagoId = id;
        break;
      }
    }
    // Si no, usar la primera disponible
    if (!formaPagoId) {
      formaPagoId = Array.from(formasPagoMap.values())[0];
    }
  }
  
  // Asociar provincia por código postal si es posible
  let provinciaId = provinciaCordoba?.id || null;
  if (codigoPostal && provinciasDB && !provinciaId) {
    provinciaId = obtenerProvinciaPorCodigoPostal(codigoPostal, provinciasDB);
  }
  // Si aún no hay provincia, usar Córdoba por defecto
  if (!provinciaId && provinciaCordoba) {
    provinciaId = provinciaCordoba.id;
  }
  
  const cliente = {
    Id_Cial: comercialesMap || 1,
    DNI_CIF: null, // No disponible en scraping
    Nombre_Razon_Social: toTitleCase(datos.nombre),
    Nombre_Cial: toTitleCase(datos.nombre),
    NumeroFarmacia: null,
    Direccion: datos.direccion ? toTitleCase(datos.direccion) : null,
    Poblacion: poblacion ? toTitleCase(poblacion) : 'Córdoba',
    Id_Provincia: provinciaId,
    CodigoPostal: codigoPostal,
    Movil: datos.telefono,
    Email: null, // No disponible en scraping básico
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
    CuentaContable: siguienteCuentaContable,
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
    // Buscar por nombre y dirección
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
    console.error('  ⚠️  Error verificando cliente existente:', error.message);
    return false;
  }
}

/**
 * Inserta un cliente en la base de datos
 */
async function insertarCliente(cliente) {
  try {
    // Verificar si ya existe
    const existe = await clienteExiste(cliente);
    if (existe) {
      return { insertado: false, motivo: 'Ya existe' };
    }
    
    if (DRY_RUN) {
      console.log(`  [SIMULACIÓN] Se insertaría: ${cliente.Nombre_Razon_Social}`);
      return { insertado: true, motivo: 'Simulación' };
    }
    
    // Usar el método createCliente del CRM
    const resultado = await crm.createCliente(cliente);
    return { insertado: true, id: resultado.insertId };
    
  } catch (error) {
    console.error(`  ❌ Error insertando cliente: ${error.message}`);
    return { insertado: false, motivo: error.message };
  }
}

/**
 * Función principal
 */
async function scrapearClinicasDentales() {
  let browser = null;
  
  try {
    console.log('🚀 Iniciando scraping de clínicas dentales en Córdoba...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    
    // Cargar lookups
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
    
    // Configurar user agent para evitar detección
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const todosLosResultados = [];
    
    // Términos de búsqueda optimizados para Google Search
    const terminos = [
      'clínicas dentales Córdoba',
      'odontólogos Córdoba',
      'dentistas Córdoba',
      'clínica odontológica Córdoba',
      'dentista Córdoba'
    ];
    
    // Buscar en Google Search (más rápido y efectivo)
    console.log('📡 Buscando en Google Search...\n');
    for (const termino of terminos) {
      const resultados = await buscarEnGoogleSearch(page, termino, Math.floor(MAX_RESULTS / terminos.length));
      todosLosResultados.push(...resultados);
      
      // Pausa entre búsquedas para evitar bloqueos
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Buscar en Páginas Amarillas (opcional, comentado por ahora)
    // console.log('\n📡 Buscando en Páginas Amarillas...\n');
    // const resultadosPA = await buscarEnPaginasAmarillas(page, 'clínica dental');
    // todosLosResultados.push(...resultadosPA);
    
    // Eliminar duplicados por nombre
    const resultadosUnicos = [];
    const nombresVistos = new Set();
    
    for (const resultado of todosLosResultados) {
      const nombreNormalizado = resultado.nombre.toLowerCase().trim();
      if (!nombresVistos.has(nombreNormalizado)) {
        nombresVistos.add(nombreNormalizado);
        resultadosUnicos.push(resultado);
      }
    }
    
    console.log(`\n📊 Total de resultados únicos encontrados: ${resultadosUnicos.length}`);
    console.log(`📊 Procesando hasta ${MAX_RESULTS} resultados...\n`);
    
    // Obtener siguiente cuenta contable inicial
    let siguienteCuentaContable = await obtenerSiguienteCuentaContable();
    console.log(`📊 Siguiente cuenta contable disponible: ${siguienteCuentaContable || 'N/A'}\n`);
    
    // Procesar y insertar
    let insertados = 0;
    let duplicados = 0;
    let errores = 0;
    
    const resultadosAProcesar = resultadosUnicos.slice(0, MAX_RESULTS);
    
    for (let i = 0; i < resultadosAProcesar.length; i++) {
      const resultado = resultadosAProcesar[i];
      console.log(`[${i + 1}/${resultadosAProcesar.length}] Procesando: ${resultado.nombre}`);
      
      try {
        // Obtener cuenta contable para este cliente
        if (!siguienteCuentaContable) {
          siguienteCuentaContable = await obtenerSiguienteCuentaContable();
        }
        
        const cliente = await adaptarDatosACliente(resultado, siguienteCuentaContable);
        
        // Incrementar cuenta contable para el siguiente cliente
        if (cliente.CuentaContable) {
          siguienteCuentaContable = cliente.CuentaContable + 1;
        }
        
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
      
      // Pausa pequeña entre inserciones
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
    console.log(`   📋 Total procesados: ${resultadosAProcesar.length}`);
    
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
  scrapearClinicasDentales()
    .then(() => {
      console.log('\n✅ Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { scrapearClinicasDentales };
