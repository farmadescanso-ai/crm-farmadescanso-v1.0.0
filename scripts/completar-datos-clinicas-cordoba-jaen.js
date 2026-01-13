/**
 * Script para completar datos faltantes (emails, direcciones completas, teléfonos) 
 * de las clínicas dentales de Córdoba (14xxx) y Jaén (23xxx)
 */

const crm = require('../config/mysql-crm');
const puppeteer = require('puppeteer');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || 50;
const DELAY = parseInt(process.argv.find(arg => arg.startsWith('--delay='))?.split('=')[1]) || 3000;

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
 * Construye búsqueda optimizada para clínicas dentales
 */
function construirBusqueda(cliente) {
  const nombre = cliente.Nombre_Razon_Social || cliente.Nombre || '';
  const direccion = cliente.Direccion || '';
  const poblacion = cliente.Poblacion || '';
  const codigoPostal = cliente.CodigoPostal || '';
  
  // Limpiar nombre
  const nombreLimpio = nombre
    .replace(/\s*-\s*(Córdoba|Jaén|Jaen).*$/i, '')
    .replace(/\s*\|\s*.*$/i, '')
    .replace(/\s*\.\.\..*$/i, '')
    .trim();
  
  // Determinar provincia por código postal
  let provincia = '';
  if (codigoPostal && codigoPostal.startsWith('14')) {
    provincia = 'Córdoba';
  } else if (codigoPostal && codigoPostal.startsWith('23')) {
    provincia = 'Jaén';
  } else if (codigoPostal && codigoPostal.startsWith('06')) {
    provincia = 'Badajoz';
  } else if (codigoPostal && codigoPostal.startsWith('10')) {
    provincia = 'Cáceres';
  } else if (poblacion) {
    provincia = poblacion;
  }
  
  // Construir búsquedas variadas
  const busquedas = [];
  
  if (nombreLimpio && direccion && direccion !== provincia && !direccion.includes('Código Postal')) {
    busquedas.push(`"${nombreLimpio}" "${direccion}" ${provincia} teléfono email contacto`);
    busquedas.push(`"${nombreLimpio}" clínica dental ${provincia} contacto`);
  } else if (nombreLimpio && provincia) {
    busquedas.push(`"${nombreLimpio}" clínica dental ${provincia} teléfono email contacto`);
    busquedas.push(`"${nombreLimpio}" dentista ${provincia} contacto`);
  } else if (nombreLimpio) {
    busquedas.push(`"${nombreLimpio}" clínica dental contacto`);
  }
  
  return busquedas;
}

/**
 * Extrae información de un texto (email, teléfono, dirección, CIF)
 */
function extraerInformacion(texto, cliente) {
  const info = {};
  
  if (!texto) return info;
  
  // Buscar email (mejorado - más permisivo)
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/gi;
  const emails = texto.match(emailRegex);
  if (emails && emails.length > 0) {
    // Filtrar emails genéricos pero aceptar más variantes
    const emailsFiltrados = emails.filter(email => {
      const emailLower = email.toLowerCase();
      // Solo rechazar emails claramente genéricos o de prueba
      return !emailLower.includes('example.com') && 
             !emailLower.includes('test.com') &&
             !emailLower.includes('noreply') &&
             !emailLower.includes('no-reply') &&
             emailLower.length > 5; // Mínimo de longitud razonable
    });
    
    if (emailsFiltrados.length > 0 && campoVacio(cliente.Email)) {
      // Tomar el primer email válido
      info.Email = emailsFiltrados[0].toLowerCase().trim();
    }
  }
  
  // Buscar teléfono (mejorado - más patrones)
  if (campoVacio(cliente.Movil) && campoVacio(cliente.Telefono)) {
    // Múltiples patrones de teléfono
    const telefonoPatterns = [
      /(\+34|0034)?[\s-]?([6-9]\d{2})[\s-]?(\d{2})[\s-]?(\d{2})[\s-]?(\d{2})/g,
      /Tel[\.:]\s*(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/gi,
      /Telf[\.:]\s*(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/gi,
      /Teléfono[\.:]\s*(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/gi,
      /(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/g
    ];
    
    for (const pattern of telefonoPatterns) {
      const telefonos = texto.match(pattern);
      if (telefonos && telefonos.length > 0) {
        const telefono = telefonos[0];
        const telefonoLimpio = telefono
          .replace(/[\s-]/g, '')
          .replace(/^\+34|^0034/, '')
          .replace(/^Tel[\.:]?|^Telf[\.:]?|^Teléfono[\.:]?/i, '')
          .replace(/[\s-]/g, '')
          .substring(0, 9);
        
        if (telefonoLimpio.length === 9 && telefonoLimpio.startsWith('6') || telefonoLimpio.startsWith('7') || telefonoLimpio.startsWith('8') || telefonoLimpio.startsWith('9')) {
          info.Movil = telefonoLimpio;
          break;
        }
      }
    }
  }
  
  // Buscar dirección completa (con código postal)
  if (campoVacio(cliente.Direccion) || cliente.Direccion === cliente.Poblacion || cliente.Direccion.includes('Código Postal')) {
    // Buscar patrones de dirección
    const direccionPatterns = [
      /(C\/|Calle|Av\.|Avenida|Plaza|Paseo|Ronda)[^,]{0,60},?\s*\d{5}/i,
      /\d{5}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+(?:Córdoba|Jaén|Jaen)/i,
      /(C\/|Calle|Av\.|Avenida|Plaza|Paseo)[^,]{0,80}/i
    ];
    
    for (const pattern of direccionPatterns) {
      const match = texto.match(pattern);
      if (match) {
        const direccion = match[0].trim();
        if (direccion.length > 5 && direccion.length < 255) {
          info.Direccion = direccion;
          break;
        }
      }
    }
  }
  
  // Buscar código postal (14xxx, 23xxx, 06xxx o 10xxx)
  if (campoVacio(cliente.CodigoPostal)) {
    const cpPattern = /\b(1[4-9]\d{3}|2[3-9]\d{3}|0[6-9]\d{3}|1[0-9]\d{3})\b/;
    const cpMatch = texto.match(cpPattern);
    if (cpMatch) {
      info.CodigoPostal = cpMatch[1];
    }
  }
  
  // Buscar Web/URL si no tiene
  if (campoVacio(cliente.Web)) {
    const urlPatterns = [
      /(https?:\/\/[^\s]+)/gi,
      /(www\.[^\s]+)/gi,
      /([a-z0-9-]+\.(es|com|net|org)[^\s]*)/gi
    ];
    
    for (const pattern of urlPatterns) {
      const matches = texto.match(pattern);
      if (matches && matches.length > 0) {
        let url = matches[0];
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }
        // Filtrar URLs genéricas
        if (!url.includes('google.com') && !url.includes('facebook.com') && !url.includes('instagram.com')) {
          info.Web = url.substring(0, 255);
          break;
        }
      }
    }
  }
  
  return info;
}

/**
 * Busca información usando Puppeteer en Google
 */
async function buscarConPuppeteer(page, busqueda) {
  try {
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(busqueda)}`;
    
    await page.goto(googleUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Intentar aceptar cookies
    try {
      const cookieButton = await page.$('button:has-text("Aceptar"), button:has-text("Accept"), #L2AGLb');
      if (cookieButton) {
        await cookieButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (e) {}
    
    // Extraer información de los resultados
    const informacion = await page.evaluate(() => {
      const info = {
        texto: ''
      };
      
      // Extraer texto de resultados (mejorado - más selectores y snippets)
      const selectores = [
        '.g', '.result', '.search-result', 
        '[data-sokoban-container]', '.tF2Cxc', '.MjjYud',
        '.yuRUbf', '.IsZvec', '.VwiC3b', '.s', '.st'
      ];
      
      // Intentar con cada selector
      for (const selector of selectores) {
        const elementos = document.querySelectorAll(selector);
        if (elementos.length > 0) {
          elementos.forEach(el => {
            const texto = el.textContent || el.innerText || '';
            if (texto.length > 30) { // Reducido el mínimo para capturar más
              info.texto += texto + ' ';
            }
          });
        }
      }
      
      // También extraer de snippets específicos
      const snippets = document.querySelectorAll('.VwiC3b, .s, .st, .IsZvec, .aCOpRe');
      snippets.forEach(snippet => {
        const texto = snippet.textContent || snippet.innerText || '';
        if (texto.length > 20) {
          info.texto += texto + ' ';
        }
      });
      
      // Intentar obtener la URL del primer resultado relevante
      const primerEnlace = document.querySelector('.yuRUbf a, .g a[href^="http"]');
      if (primerEnlace) {
        const href = primerEnlace.getAttribute('href');
        if (href && !href.includes('google.com') && !href.includes('youtube.com')) {
          info.urlPrimera = href;
        }
      }
      
      return info;
    });
    
    let textoCompleto = informacion.texto;
    
    // Si encontramos una URL relevante, visitarla para obtener más información
    if (informacion.urlPrimera) {
      try {
        await page.goto(informacion.urlPrimera, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Extraer información de la página web
        const infoPagina = await page.evaluate(() => {
          let texto = '';
          
          // Buscar en elementos comunes de contacto
          const selectores = [
            'footer', '[class*="contact"]', '[id*="contact"]',
            '[class*="footer"]', '[class*="info"]', '[class*="datos"]',
            'address', '.contacto', '.contact', '.info-contacto'
          ];
          
          selectores.forEach(selector => {
            try {
              const elementos = document.querySelectorAll(selector);
              elementos.forEach(el => {
                const textoEl = el.textContent || el.innerText || '';
                if (textoEl.length > 20) {
                  texto += textoEl + ' ';
                }
              });
            } catch (e) {}
          });
          
          // Si no encontramos mucho, tomar todo el body
          if (texto.length < 500) {
            const body = document.body;
            if (body) {
              texto = body.textContent || body.innerText || '';
            }
          }
          
          return texto;
        });
        
        if (infoPagina && infoPagina.length > 100) {
          textoCompleto += ' ' + infoPagina;
        }
      } catch (error) {
        // Si falla al visitar la página, continuar con lo que tenemos de Google
      }
    }
    
    return textoCompleto;
    
  } catch (error) {
    console.error(`      ⚠️  Error en búsqueda Puppeteer: ${error.message}`);
    return '';
  }
}

/**
 * Busca información completa de una clínica
 */
async function buscarInformacionCompleta(page, cliente) {
  const informacionEncontrada = {};
  const busquedas = construirBusqueda(cliente);
  
  if (busquedas.length === 0) {
    return informacionEncontrada;
  }
  
  // Intentar con la primera búsqueda (más específica)
  const busquedaPrincipal = busquedas[0];
  console.log(`      🔍 Búsqueda: "${busquedaPrincipal}"`);
  
  try {
    // Buscar con Puppeteer
    const textoEncontrado = await buscarConPuppeteer(page, busquedaPrincipal);
    
    if (textoEncontrado) {
      const info = extraerInformacion(textoEncontrado, cliente);
      
      // Combinar información encontrada
      if (info.Email && campoVacio(cliente.Email)) {
        informacionEncontrada.Email = info.Email;
      }
      if (info.Movil && campoVacio(cliente.Movil) && campoVacio(cliente.Telefono)) {
        informacionEncontrada.Movil = info.Movil;
      }
      if (info.Direccion && (campoVacio(cliente.Direccion) || cliente.Direccion === cliente.Poblacion || cliente.Direccion.includes('Código Postal'))) {
        informacionEncontrada.Direccion = info.Direccion;
      }
      if (info.CodigoPostal && campoVacio(cliente.CodigoPostal)) {
        informacionEncontrada.CodigoPostal = info.CodigoPostal;
      }
      if (info.Web && campoVacio(cliente.Web)) {
        informacionEncontrada.Web = info.Web;
      }
    }
  } catch (error) {
    console.error(`      ⚠️  Error en búsqueda: ${error.message}`);
  }
  
  return informacionEncontrada;
}

/**
 * Función principal
 */
async function completarDatosClinicas() {
  let browser = null;
  
  try {
    console.log('🚀 Iniciando completado de datos de clínicas dentales (Córdoba, Jaén, Badajoz y Cáceres)...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener clínicas dentales de Córdoba, Jaén, Badajoz y Cáceres con datos faltantes
    console.log('📊 Obteniendo clínicas dentales de Córdoba, Jaén, Badajoz y Cáceres...');
    const todasLasClinicas = await crm.query(`
      SELECT id, Nombre_Razon_Social, Direccion, Poblacion, Movil, Email, CodigoPostal, DNI_CIF, Web
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND (CodigoPostal LIKE '14%' OR CodigoPostal LIKE '23%' OR CodigoPostal LIKE '06%' OR CodigoPostal LIKE '10%')
      ORDER BY id DESC
      LIMIT 500
    `);
    
    console.log(`✅ ${todasLasClinicas.length} clínicas encontradas\n`);
    
    // Filtrar clínicas con datos faltantes
    const clinicasConFaltantes = todasLasClinicas.filter(clinica => {
      return campoVacio(clinica.Email) || 
             campoVacio(clinica.Direccion) || 
             clinica.Direccion === clinica.Poblacion ||
             clinica.Direccion.includes('Código Postal') ||
             campoVacio(clinica.CodigoPostal) ||
             campoVacio(clinica.Movil) ||
             campoVacio(clinica.Web);
    });
    
    console.log(`📋 ${clinicasConFaltantes.length} clínicas con datos faltantes\n`);
    
    if (clinicasConFaltantes.length === 0) {
      console.log('✅ Todas las clínicas tienen datos completos');
      return;
    }
    
    // Limitar con LIMIT
    const clinicasAProcesar = clinicasConFaltantes.slice(0, LIMIT);
    console.log(`⚠️  Procesando ${clinicasAProcesar.length} clínicas (usa --limit=N para cambiar)\n`);
    
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
    console.log('🔄 Buscando información...\n');
    
    let procesados = 0;
    let actualizados = 0;
    let errores = 0;
    let ultimoReporte = Date.now();
    const intervaloReporte = 3 * 60 * 1000; // 3 minutos en milisegundos
    
    for (let i = 0; i < clinicasAProcesar.length; i++) {
      const clinica = clinicasAProcesar[i];
      const numero = i + 1;
      
      // Mostrar progreso cada 3 minutos
      const ahora = Date.now();
      if (ahora - ultimoReporte >= intervaloReporte) {
        const porcentaje = ((i / clinicasAProcesar.length) * 100).toFixed(1);
        console.log(`\n📊 Progreso: ${i}/${clinicasAProcesar.length} clínicas procesadas (${porcentaje}%)`);
        console.log(`   ✅ Actualizadas: ${actualizados} | ❌ Errores: ${errores}\n`);
        ultimoReporte = ahora;
      }
      
      try {
        const faltantes = [];
        if (campoVacio(clinica.Email)) faltantes.push('Email');
        if (campoVacio(clinica.Direccion) || clinica.Direccion === clinica.Poblacion || clinica.Direccion.includes('Código Postal')) faltantes.push('Dirección');
        if (campoVacio(clinica.CodigoPostal)) faltantes.push('Código Postal');
        if (campoVacio(clinica.Movil)) faltantes.push('Teléfono');
        if (campoVacio(clinica.Web)) faltantes.push('Web');
        
        let provincia = '';
        if (clinica.CodigoPostal?.startsWith('14')) provincia = 'Córdoba';
        else if (clinica.CodigoPostal?.startsWith('23')) provincia = 'Jaén';
        else if (clinica.CodigoPostal?.startsWith('06')) provincia = 'Badajoz';
        else if (clinica.CodigoPostal?.startsWith('10')) provincia = 'Cáceres';
        
        console.log(`[${numero}/${clinicasAProcesar.length}] ${clinica.Nombre_Razon_Social} (ID: ${clinica.id})`);
        if (provincia) {
          console.log(`   📍 ${provincia} - CP: ${clinica.CodigoPostal || 'N/A'}`);
        }
        console.log(`   📋 Campos faltantes: ${faltantes.join(', ')}`);
        
        const informacionEncontrada = await buscarInformacionCompleta(page, clinica);
        
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
          console.log(`   ⚠️  No se encontró información adicional`);
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
    
    // Obtener estadísticas finales de la base de datos
    const estadisticasFinales = await crm.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN Email IS NOT NULL AND Email != '' THEN 1 ELSE 0 END) as conEmail,
        SUM(CASE WHEN Movil IS NOT NULL AND Movil != '' THEN 1 ELSE 0 END) as conTelefono,
        SUM(CASE WHEN Direccion IS NOT NULL AND Direccion != '' AND Direccion NOT LIKE 'Código Postal%' AND Direccion != Poblacion THEN 1 ELSE 0 END) as conDireccion,
        SUM(CASE WHEN CodigoPostal IS NOT NULL AND CodigoPostal != '' THEN 1 ELSE 0 END) as conCodigoPostal,
        SUM(CASE WHEN Web IS NOT NULL AND Web != '' THEN 1 ELSE 0 END) as conWeb
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND (CodigoPostal LIKE '14%' OR CodigoPostal LIKE '23%' OR CodigoPostal LIKE '06%' OR CodigoPostal LIKE '10%')
    `);
    
    const stats = estadisticasFinales[0];
    const totalClinicas = stats.total;
    
    console.log(`\n📊 RESUMEN FINAL:`);
    console.log(`   Total de clínicas (Córdoba + Jaén + Badajoz + Cáceres): ${totalClinicas}`);
    console.log(`   ✅ Con Email: ${stats.conEmail} (${((stats.conEmail / totalClinicas) * 100).toFixed(1)}%)`);
    console.log(`   ✅ Con Teléfono: ${stats.conTelefono} (${((stats.conTelefono / totalClinicas) * 100).toFixed(1)}%)`);
    console.log(`   ✅ Con Dirección completa: ${stats.conDireccion} (${((stats.conDireccion / totalClinicas) * 100).toFixed(1)}%)`);
    console.log(`   ✅ Con Código Postal: ${stats.conCodigoPostal} (${((stats.conCodigoPostal / totalClinicas) * 100).toFixed(1)}%)`);
    console.log(`   ✅ Con Web: ${stats.conWeb} (${((stats.conWeb / totalClinicas) * 100).toFixed(1)}%)`);
    
    console.log(`\n📈 PROCESO:`);
    console.log(`   ✅ Clínicas procesadas: ${procesados}`);
    console.log(`   🔄 Clínicas actualizadas en esta ejecución: ${actualizados}`);
    console.log(`   ❌ Errores: ${errores}`);
    console.log(`   📋 Total con datos faltantes detectados: ${clinicasConFaltantes.length}`);
    
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
  completarDatosClinicas()
    .then(() => {
      console.log('\n✅ Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { completarDatosClinicas };
