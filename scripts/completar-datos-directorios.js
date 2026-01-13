/**
 * Script para completar datos de clínicas dentales buscando en directorios específicos
 * (Páginas Amarillas, Yelp, Google My Business, etc.)
 */

const crm = require('../config/mysql-crm');
const puppeteer = require('puppeteer');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || 20;
const DELAY = parseInt(process.argv.find(arg => arg.startsWith('--delay='))?.split('=')[1]) || 3000;
const DEBUG = process.argv.includes('--debug');

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
 * Busca en Páginas Amarillas
 */
async function buscarEnPaginasAmarillas(page, nombreClinica) {
  const informacion = {};
  
  try {
    const busqueda = `${nombreClinica} Córdoba`;
    const url = `https://www.paginasamarillas.es/search/clinica-dental/all-ma/${encodeURIComponent('Córdoba')}/all-is?what=${encodeURIComponent(busqueda)}`;
    
    console.log(`      📇 Buscando en Páginas Amarillas...`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Intentar aceptar cookies
    try {
      const cookieButton = await page.$('button:has-text("Aceptar"), button:has-text("Accept"), #didomi-notice-agree-button');
      if (cookieButton) {
        await cookieButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (e) {}
    
    const datos = await page.evaluate(() => {
      const info = {
        nombre: '',
        direccion: '',
        telefono: '',
        email: '',
        web: ''
      };
      
      // Buscar resultados
      const resultados = document.querySelectorAll('.listing-item, .result-item, [data-qa="result-item"], .card-business');
      
      if (resultados.length > 0) {
        const primerResultado = resultados[0];
        
        // Nombre
        const nombreEl = primerResultado.querySelector('h2, .listing-name, [data-qa="name"], .business-name');
        if (nombreEl) info.nombre = nombreEl.textContent?.trim() || '';
        
        // Dirección
        const direccionEl = primerResultado.querySelector('.listing-address, [data-qa="address"], .address');
        if (direccionEl) info.direccion = direccionEl.textContent?.trim() || '';
        
        // Teléfono
        const telefonoEl = primerResultado.querySelector('.listing-phone, [data-qa="phone"], .phone');
        if (telefonoEl) {
          info.telefono = telefonoEl.textContent?.trim() || telefonoEl.getAttribute('href')?.replace('tel:', '') || '';
        }
        
        // Email
        const emailEl = primerResultado.querySelector('.listing-email, [data-qa="email"], .email');
        if (emailEl) {
          info.email = emailEl.textContent?.trim() || emailEl.getAttribute('href')?.replace('mailto:', '') || '';
        }
        
        // Web
        const webEl = primerResultado.querySelector('.listing-website, [data-qa="website"], .website a');
        if (webEl) {
          info.web = webEl.href || webEl.getAttribute('href') || '';
        }
      }
      
      return info;
    });
    
    if (datos.telefono) {
      informacion.Movil = limpiarTelefono(datos.telefono);
    }
    if (datos.email && !datos.email.includes('@paginasamarillas')) {
      informacion.Email = datos.email.toLowerCase();
    }
    if (datos.direccion && datos.direccion.length > 5) {
      informacion.Direccion = datos.direccion;
    }
    
    if (Object.keys(informacion).length > 0) {
      console.log(`      ✅ Datos encontrados en Páginas Amarillas: ${Object.keys(informacion).join(', ')}`);
    }
    
  } catch (error) {
    console.error(`      ⚠️  Error en Páginas Amarillas: ${error.message}`);
  }
  
  return informacion;
}

/**
 * Busca en Google My Business / Google Maps
 */
async function buscarEnGoogleMaps(page, nombreClinica) {
  const informacion = {};
  
  try {
    const busqueda = `${nombreClinica} Córdoba`;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(busqueda)}`;
    
    console.log(`      🗺️  Buscando en Google Maps...`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Intentar hacer clic en el primer resultado
    try {
      const primerResultado = await page.$('[role="article"], .Nv2PK, .hfpxzc');
      if (primerResultado) {
        await primerResultado.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (e) {}
    
    const datos = await page.evaluate(() => {
      const info = {
        telefono: '',
        direccion: '',
        web: ''
      };
      
      // Teléfono
      const telefonoEl = document.querySelector('[data-value="phone"], button[data-item-id^="phone"]');
      if (telefonoEl) {
        info.telefono = telefonoEl.textContent?.trim() || telefonoEl.getAttribute('aria-label') || '';
      }
      
      // Dirección
      const direccionEl = document.querySelector('[data-value="address"], button[data-item-id="address"]');
      if (direccionEl) {
        info.direccion = direccionEl.textContent?.trim() || direccionEl.getAttribute('aria-label') || '';
      }
      
      // Web
      const webEl = document.querySelector('[data-value="website"], a[data-item-id="authority"]');
      if (webEl) {
        info.web = webEl.href || webEl.textContent?.trim() || '';
      }
      
      return info;
    });
    
    if (datos.telefono) {
      informacion.Movil = limpiarTelefono(datos.telefono);
    }
    if (datos.direccion && datos.direccion.length > 5) {
      informacion.Direccion = datos.direccion;
    }
    
    // Si hay web, intentar extraer email de la web
    if (datos.web && !datos.web.includes('google.com')) {
      informacion.Web = datos.web;
    }
    
    if (Object.keys(informacion).length > 0) {
      console.log(`      ✅ Datos encontrados en Google Maps: ${Object.keys(informacion).join(', ')}`);
    }
    
  } catch (error) {
    console.error(`      ⚠️  Error en Google Maps: ${error.message}`);
  }
  
  return informacion;
}

/**
 * Busca en Axesor (información empresarial: CIF, dirección, teléfono, etc.)
 */
async function buscarEnAxesor(page, nombreClinica) {
  const informacion = {};
  
  try {
    const nombreLimpio = nombreClinica
      .replace(/\s*-\s*Córdoba.*$/i, '')
      .replace(/\s*\|\s*.*$/i, '')
      .trim();
    
    const busqueda = `${nombreLimpio} Córdoba`;
    const url = `https://www.axesor.es/busqueda?q=${encodeURIComponent(busqueda)}`;
    
    console.log(`      🏢 Buscando en Axesor...`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Guardar captura para debugging
    if (DEBUG) {
      try {
        await page.screenshot({ path: `debug-axesor-${Date.now()}.png`, fullPage: true });
        console.log(`      📸 Captura guardada: debug-axesor-${Date.now()}.png`);
      } catch (e) {}
    }
    
    // Intentar aceptar cookies - múltiples selectores
    try {
      const cookieSelectors = [
        'button:has-text("Aceptar")',
        'button:has-text("Accept")',
        '#didomi-notice-agree-button',
        '[id*="accept"]',
        '[class*="accept"]',
        'button[id*="cookie"]',
        '.cookie-accept',
        '#cookie-accept'
      ];
      
      for (const selector of cookieSelectors) {
        try {
          const cookieButton = await page.$(selector);
          if (cookieButton) {
            await cookieButton.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (DEBUG) console.log(`      ✅ Cookies aceptadas con selector: ${selector}`);
            break;
          }
        } catch (e) {}
      }
    } catch (e) {
      if (DEBUG) console.log(`      ⚠️  No se pudo aceptar cookies: ${e.message}`);
    }
    
    // Esperar a que cargue el contenido
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const datos = await page.evaluate((nombreBusqueda, debugMode) => {
      const info = {
        cif: '',
        nombre: '',
        direccion: '',
        telefono: '',
        email: '',
        web: ''
      };
      
      // Buscar resultados - múltiples selectores (más exhaustivos)
      const selectoresResultados = [
        '.result-item',
        '.company-card',
        '[class*="result"]',
        '[class*="company"]',
        '.search-result',
        '[data-company]',
        '.empresa',
        '[class*="empresa"]',
        '.list-item',
        '[class*="list-item"]',
        'article',
        '.card',
        '[class*="card"]',
        'div[class*="business"]',
        'div[class*="listing"]'
      ];
      
      let resultados = [];
      for (const selector of selectoresResultados) {
        resultados = Array.from(document.querySelectorAll(selector));
        if (resultados.length > 0) {
          if (debugMode) console.log(`[DEBUG] Encontrados ${resultados.length} resultados con selector: ${selector}`);
          break;
        }
      }
      
      // Si no hay resultados estructurados, buscar en toda la página
      if (resultados.length === 0) {
        if (debugMode) console.log('[DEBUG] No se encontraron resultados estructurados, buscando en toda la página');
        resultados = [document.body];
      }
      
      // Verificar si hay un mensaje de login o registro (Axesor requiere autenticación)
      const tieneLogin = document.body.textContent?.toLowerCase().includes('login') ||
                         document.body.textContent?.toLowerCase().includes('iniciar sesión') ||
                         document.body.textContent?.toLowerCase().includes('registro') ||
                         document.querySelector('[class*="login"], [id*="login"], form[action*="login"]');
      
      if (tieneLogin && debugMode) {
        console.log('[DEBUG] Axesor parece requerir autenticación');
      }
      
      // Buscar el resultado que más coincida con el nombre buscado
      let mejorResultado = null;
      let mejorCoincidencia = 0;
      
      resultados.forEach(resultado => {
        const textoResultado = resultado.textContent?.toLowerCase() || '';
        const nombreLower = nombreBusqueda.toLowerCase();
        const palabrasNombre = nombreLower.split(/\s+/).filter(p => p.length > 3);
        
        let coincidencias = 0;
        palabrasNombre.forEach(palabra => {
          if (textoResultado.includes(palabra)) {
            coincidencias++;
          }
        });
        
        if (coincidencias > mejorCoincidencia) {
          mejorCoincidencia = coincidencias;
          mejorResultado = resultado;
        }
      });
      
      const resultadoFinal = mejorResultado || resultados[0];
      
      if (resultadoFinal) {
        // CIF/DNI - buscar en múltiples lugares y formatos
        const textoCompleto = resultadoFinal.textContent || '';
        const htmlCompleto = resultadoFinal.innerHTML || '';
        
        // Patrones de CIF/DNI más completos
        const cifPatterns = [
          /\b([A-Z]\d{8})\b/,  // CIF: A12345678
          /\b(\d{8}[A-Z])\b/,  // DNI: 12345678A
          /\b([A-Z]{2}\d{7}[A-Z0-9])\b/,  // CIF con formato alternativo
          /CIF[:\s]+([A-Z]\d{8}|\d{8}[A-Z])/i,  // CIF: A12345678
          /NIF[:\s]+([A-Z]\d{8}|\d{8}[A-Z])/i,  // NIF: A12345678
          /DNI[:\s]+(\d{8}[A-Z])/i,  // DNI: 12345678A
          /\b([A-Z]\d{7}[A-Z0-9])\b/,  // CIF formato B1234567A
          /\b([A-Z]\d{6}[A-Z0-9])\b/   // CIF formato alternativo
        ];
        
        for (const pattern of cifPatterns) {
          const match = (textoCompleto + ' ' + htmlCompleto).match(pattern);
          if (match) {
            info.cif = match[1];
            if (debugMode) console.log(`[DEBUG] CIF encontrado: ${info.cif}`);
            break;
          }
        }
        
        // Nombre - filtrar mensajes genéricos
        const nombreEl = resultadoFinal.querySelector('h2, h3, h4, [class*="name"], .company-name, [class*="title"]');
        if (nombreEl) {
          const nombreTexto = nombreEl.textContent?.trim() || '';
          // Filtrar mensajes genéricos
          if (!nombreTexto.toLowerCase().includes('estimado usuario') &&
              !nombreTexto.toLowerCase().includes('bienvenido') &&
              !nombreTexto.toLowerCase().includes('login') &&
              !nombreTexto.toLowerCase().includes('registro') &&
              nombreTexto.length > 3) {
            info.nombre = nombreTexto;
          }
        }
        
        // Dirección - buscar patrones de dirección
        const direccionPatterns = [
          /(C\/|Calle|Av\.|Avenida|Plaza|Paseo|Ronda)[^,]{0,60},?\s*\d{5}/i,
          /\d{5}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+(?:Córdoba|Cordoba)/i
        ];
        
        for (const pattern of direccionPatterns) {
          const match = textoCompleto.match(pattern);
          if (match) {
            info.direccion = match[0].trim();
            break;
          }
        }
        
        // Si no hay dirección con patrón, buscar elemento de dirección
        if (!info.direccion) {
          const direccionEl = resultadoFinal.querySelector('[class*="address"], .address, [class*="direccion"], [class*="location"]');
          if (direccionEl) {
            info.direccion = direccionEl.textContent?.trim() || '';
          }
        }
        
        // Teléfono - buscar múltiples formatos
        const telefonoPatterns = [
          /(\+34|0034)?[\s-]?([6-9]\d{2})[\s-]?(\d{2})[\s-]?(\d{2})[\s-]?(\d{2})/,
          /Tel[\.:]?\s*(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/i
        ];
        
        for (const pattern of telefonoPatterns) {
          const match = textoCompleto.match(pattern);
          if (match) {
            info.telefono = match[0].replace(/[\s-]/g, '').replace(/^\+34|^0034/, '');
            if (info.telefono.length === 9) break;
          }
        }
        
        // Si no hay teléfono con patrón, buscar elemento
        if (!info.telefono) {
          const telefonoEl = resultadoFinal.querySelector('[class*="phone"], .phone, [class*="telefono"], [href^="tel:"]');
          if (telefonoEl) {
            info.telefono = telefonoEl.textContent?.trim() || telefonoEl.getAttribute('href')?.replace('tel:', '') || '';
            info.telefono = info.telefono.replace(/[\s-]/g, '').replace(/^\+34|^0034/, '');
          }
        }
        
        // Email
        const emailPattern = /([\w\.-]+@[\w\.-]+\.\w+)/;
        const emailMatch = textoCompleto.match(emailPattern);
        if (emailMatch && !emailMatch[0].includes('@axesor')) {
          info.email = emailMatch[0].toLowerCase();
        }
        
        // Web
        const webEl = resultadoFinal.querySelector('a[href^="http"]:not([href*="axesor"]):not([href*="google"])');
        if (webEl) {
          info.web = webEl.href || webEl.getAttribute('href') || '';
        }
      }
      
      return info;
    }, nombreLimpio, DEBUG); // Pasar nombreLimpio y DEBUG como parámetros
    
    if (DEBUG) {
      console.log(`      🔍 [DEBUG] Datos extraídos de Axesor:`, JSON.stringify(datos, null, 2));
    }
    
    if (datos.cif) {
      informacion.DNI_CIF = datos.cif;
      console.log(`      ✅ CIF/DNI encontrado: ${datos.cif}`);
    }
    // Filtrar teléfonos genéricos conocidos de Axesor
    const telefonosGenericos = ['958011480', '900123456', '902123456'];
    
    if (datos.telefono) {
      const telefonoLimpio = limpiarTelefono(datos.telefono);
      if (telefonoLimpio && 
          telefonoLimpio.length === 9 && 
          !telefonosGenericos.includes(telefonoLimpio) &&
          !datos.nombre.toLowerCase().includes('estimado usuario')) {
        informacion.Movil = telefonoLimpio;
        console.log(`      ✅ Teléfono encontrado: ${telefonoLimpio}`);
      } else if (DEBUG && telefonosGenericos.includes(telefonoLimpio)) {
        console.log(`      ⚠️  [DEBUG] Teléfono genérico filtrado: ${telefonoLimpio}`);
      }
    }
    if (datos.email && !datos.email.includes('@axesor') && !datos.email.includes('@example')) {
      informacion.Email = datos.email.toLowerCase();
      console.log(`      ✅ Email encontrado: ${datos.email}`);
    }
    if (datos.direccion && datos.direccion.length > 5 && datos.direccion !== 'Córdoba') {
      informacion.Direccion = datos.direccion;
      console.log(`      ✅ Dirección encontrada: ${datos.direccion}`);
    }
    if (datos.web && !datos.web.includes('axesor') && !datos.web.includes('google')) {
      informacion.Web = datos.web;
      console.log(`      ✅ Web encontrada: ${datos.web}`);
    }
    
    // Verificar si los datos son válidos (no genéricos)
    const datosValidos = Object.keys(informacion).filter(key => {
      if (key === 'Movil') {
        return !telefonosGenericos.includes(informacion[key]);
      }
      return true;
    });
    
    if (datosValidos.length > 0) {
      // Filtrar solo datos válidos
      const informacionFiltrada = {};
      datosValidos.forEach(key => {
        informacionFiltrada[key] = informacion[key];
      });
      Object.assign(informacion, informacionFiltrada);
      
      console.log(`      ✅ Datos encontrados en Axesor: ${Object.keys(informacion).join(', ')}`);
    } else {
      if (DEBUG) {
        console.log(`      ⚠️  [DEBUG] No se encontraron datos válidos en Axesor (posiblemente requiere autenticación)`);
      }
      // Limpiar información si no es válida
      Object.keys(informacion).forEach(key => delete informacion[key]);
    }
    
  } catch (error) {
    console.error(`      ⚠️  Error en Axesor: ${error.message}`);
  }
  
  return informacion;
}

/**
 * Busca en Yelp
 */
async function buscarEnYelp(page, nombreClinica) {
  const informacion = {};
  
  try {
    const busqueda = `${nombreClinica} Córdoba`;
    const url = `https://www.yelp.es/search?find_desc=${encodeURIComponent(busqueda)}&find_loc=${encodeURIComponent('Córdoba, España')}`;
    
    console.log(`      ⭐ Buscando en Yelp...`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const datos = await page.evaluate(() => {
      const info = {
        telefono: '',
        direccion: '',
        web: ''
      };
      
      // Buscar primer resultado
      const resultado = document.querySelector('.businessName, .css-1m051bw, [class*="business"]');
      if (resultado) {
        const card = resultado.closest('div[class*="container"], div[class*="result"]');
        if (card) {
          // Teléfono
          const telefonoEl = card.querySelector('[href^="tel:"], .phone');
          if (telefonoEl) {
            info.telefono = telefonoEl.textContent?.trim() || telefonoEl.getAttribute('href')?.replace('tel:', '') || '';
          }
          
          // Dirección
          const direccionEl = card.querySelector('.address, [class*="address"]');
          if (direccionEl) {
            info.direccion = direccionEl.textContent?.trim() || '';
          }
          
          // Web
          const webEl = card.querySelector('a[href*="biz"], a[href*="yelp"]');
          if (webEl) {
            info.web = webEl.href || '';
          }
        }
      }
      
      return info;
    });
    
    if (datos.telefono) {
      informacion.Movil = limpiarTelefono(datos.telefono);
    }
    if (datos.direccion && datos.direccion.length > 5) {
      informacion.Direccion = datos.direccion;
    }
    
    if (Object.keys(informacion).length > 0) {
      console.log(`      ✅ Datos encontrados en Yelp: ${Object.keys(informacion).join(', ')}`);
    }
    
  } catch (error) {
    console.error(`      ⚠️  Error en Yelp: ${error.message}`);
  }
  
  return informacion;
}

/**
 * Busca email en la web de la clínica
 */
async function buscarEmailEnWeb(page, urlWeb) {
  if (!urlWeb || urlWeb.includes('google.com') || urlWeb.includes('yelp')) {
    return null;
  }
  
  try {
    console.log(`      🌐 Buscando email en: ${urlWeb}`);
    
    await page.goto(urlWeb, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const email = await page.evaluate(() => {
      // Buscar emails en la página
      const texto = document.body.textContent || '';
      const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/gi;
      const emails = texto.match(emailRegex);
      
      if (emails && emails.length > 0) {
        // Filtrar emails genéricos
        const emailsFiltrados = emails.filter(e => {
          const eLower = e.toLowerCase();
          return !eLower.includes('example.com') && 
                 !eLower.includes('test.com') &&
                 !eLower.includes('noreply') &&
                 !eLower.includes('no-reply');
        });
        
        return emailsFiltrados.length > 0 ? emailsFiltrados[0].toLowerCase() : null;
      }
      
      return null;
    });
    
    if (email) {
      console.log(`      ✅ Email encontrado: ${email}`);
      return email;
    }
    
  } catch (error) {
    console.error(`      ⚠️  Error buscando email en web: ${error.message}`);
  }
  
  return null;
}

/**
 * Busca información completa en múltiples directorios
 */
async function buscarEnDirectorios(page, clinica) {
  const informacionCompleta = {};
  const nombreLimpio = (clinica.Nombre_Razon_Social || '')
    .replace(/\s*-\s*Córdoba.*$/i, '')
    .replace(/\s*\|\s*.*$/i, '')
    .trim();
  
  // 1. Buscar en Axesor (prioridad: tiene CIF/DNI y datos empresariales)
  const infoAxesor = await buscarEnAxesor(page, nombreLimpio);
  Object.assign(informacionCompleta, infoAxesor);
  
  // Si ya tenemos CIF y los datos principales, podemos continuar para completar
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 2. Buscar en Páginas Amarillas
  const infoPA = await buscarEnPaginasAmarillas(page, nombreLimpio);
  if (!campoVacio(infoPA.Movil) && campoVacio(informacionCompleta.Movil)) {
    informacionCompleta.Movil = infoPA.Movil;
  }
  if (!campoVacio(infoPA.Email) && campoVacio(informacionCompleta.Email)) {
    informacionCompleta.Email = infoPA.Email;
  }
  if (!campoVacio(infoPA.Direccion) && (campoVacio(informacionCompleta.Direccion) || informacionCompleta.Direccion === 'Córdoba')) {
    informacionCompleta.Direccion = infoPA.Direccion;
  }
  
  // Si ya tenemos todo, no continuar
  if (!campoVacio(informacionCompleta.Movil) && 
      !campoVacio(informacionCompleta.Email) && 
      !campoVacio(informacionCompleta.Direccion) && 
      informacionCompleta.Direccion !== 'Córdoba' &&
      !campoVacio(informacionCompleta.DNI_CIF)) {
    return informacionCompleta;
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 3. Buscar en Google Maps
  const infoGM = await buscarEnGoogleMaps(page, nombreLimpio);
  if (!campoVacio(infoGM.Movil) && campoVacio(informacionCompleta.Movil)) {
    informacionCompleta.Movil = infoGM.Movil;
  }
  if (!campoVacio(infoGM.Direccion) && (campoVacio(informacionCompleta.Direccion) || informacionCompleta.Direccion === 'Córdoba')) {
    informacionCompleta.Direccion = infoGM.Direccion;
  }
  if (infoGM.Web && campoVacio(clinica.Email) && campoVacio(informacionCompleta.Email)) {
    // Intentar buscar email en la web
    const email = await buscarEmailEnWeb(page, infoGM.Web);
    if (email) {
      informacionCompleta.Email = email;
    }
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 4. Buscar en Yelp (solo si aún faltan datos)
  if (campoVacio(informacionCompleta.Movil) || 
      (campoVacio(informacionCompleta.Direccion) || informacionCompleta.Direccion === 'Córdoba')) {
    const infoYelp = await buscarEnYelp(page, nombreLimpio);
    if (!campoVacio(infoYelp.Movil) && campoVacio(informacionCompleta.Movil)) {
      informacionCompleta.Movil = infoYelp.Movil;
    }
    if (!campoVacio(infoYelp.Direccion) && (campoVacio(informacionCompleta.Direccion) || informacionCompleta.Direccion === 'Córdoba')) {
      informacionCompleta.Direccion = infoYelp.Direccion;
    }
  }
  
  return informacionCompleta;
}

/**
 * Función principal
 */
async function completarDatosDirectorios() {
  let browser = null;
  
  try {
    console.log('🚀 Iniciando búsqueda en directorios específicos...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener clínicas con datos faltantes (incluyendo DNI_CIF)
    console.log('📊 Obteniendo clínicas dentales con datos faltantes...');
    const clinicas = await crm.query(`
      SELECT id, Nombre_Razon_Social, Direccion, Poblacion, Movil, Email, CodigoPostal, DNI_CIF
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND Poblacion LIKE '%Córdoba%'
         AND (Email IS NULL OR Email = '' OR 
              Direccion IS NULL OR Direccion = '' OR Direccion = 'Córdoba' OR
              Movil IS NULL OR Movil = '' OR
              DNI_CIF IS NULL OR DNI_CIF = '')
      ORDER BY id DESC
      LIMIT ${LIMIT}
    `);
    
    console.log(`✅ ${clinicas.length} clínicas con datos faltantes encontradas\n`);
    
    if (clinicas.length === 0) {
      console.log('✅ Todas las clínicas tienen datos completos');
      return;
    }
    
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
    
    // Procesar clínicas
    console.log('🔄 Buscando información en directorios...\n');
    
    let procesados = 0;
    let actualizados = 0;
    let errores = 0;
    
    for (let i = 0; i < clinicas.length; i++) {
      const clinica = clinicas[i];
      const numero = i + 1;
      
      try {
        const faltantes = [];
        if (campoVacio(clinica.DNI_CIF)) faltantes.push('DNI/CIF');
        if (campoVacio(clinica.Email)) faltantes.push('Email');
        if (campoVacio(clinica.Direccion) || clinica.Direccion === 'Córdoba') faltantes.push('Dirección');
        if (campoVacio(clinica.Movil)) faltantes.push('Teléfono');
        
        console.log(`[${numero}/${clinicas.length}] ${clinica.Nombre_Razon_Social} (ID: ${clinica.id})`);
        console.log(`   📋 Campos faltantes: ${faltantes.join(', ')}`);
        
        const informacionEncontrada = await buscarEnDirectorios(page, clinica);
        
        if (Object.keys(informacionEncontrada).length > 0) {
          console.log(`   ✅ Información encontrada:`, Object.keys(informacionEncontrada).join(', '));
          
          if (!DRY_RUN) {
            await crm.updateCliente(clinica.id, informacionEncontrada);
            actualizados++;
            console.log(`   ✅ Cliente actualizado`);
          } else {
            console.log(`   📝 [SIMULACIÓN] Se actualizarían:`, JSON.stringify(informacionEncontrada, null, 2));
            actualizados++;
          }
        } else {
          console.log(`   ⚠️  No se encontró información en los directorios`);
        }
        
        procesados++;
        
        // Pausa para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, DELAY));
        
      } catch (error) {
        console.error(`   ❌ Error:`, error.message);
        errores++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Proceso completado');
    console.log('='.repeat(80));
    console.log(`📊 Resumen:`);
    console.log(`   ✅ Clínicas procesadas: ${procesados}`);
    console.log(`   🔄 Clínicas actualizadas: ${actualizados}`);
    console.log(`   ❌ Errores: ${errores}`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  MODO SIMULACIÓN: Ejecuta sin --dry-run para actualizar realmente');
    }
    
  } catch (error) {
    console.error('\n❌ Error en proceso:', error);
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
  completarDatosDirectorios()
    .then(() => {
      console.log('\n✅ Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { completarDatosDirectorios };
