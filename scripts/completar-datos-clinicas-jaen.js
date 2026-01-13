/**
 * Script para completar datos faltantes (emails, direcciones completas, CIF) 
 * de las clínicas dentales de Jaén insertadas
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
 * Construye búsqueda optimizada para clínicas dentales de Jaén
 */
function construirBusqueda(cliente) {
  const nombre = cliente.Nombre_Razon_Social || cliente.Nombre || '';
  const direccion = cliente.Direccion || '';
  const poblacion = cliente.Poblacion || 'Jaén';
  
  // Limpiar nombre
  const nombreLimpio = nombre
    .replace(/\s*-\s*Jaén.*$/i, '')
    .replace(/\s*\|\s*.*$/i, '')
    .replace(/\s*\.\.\..*$/i, '')
    .trim();
  
  // Construir búsquedas variadas
  const busquedas = [];
  
  if (nombreLimpio && direccion && direccion !== 'Jaén' && direccion !== 'Código Postal') {
    busquedas.push(`"${nombreLimpio}" "${direccion}" ${poblacion} teléfono email contacto`);
    busquedas.push(`"${nombreLimpio}" clínica dental ${poblacion} contacto`);
  } else if (nombreLimpio && poblacion) {
    busquedas.push(`"${nombreLimpio}" clínica dental ${poblacion} teléfono email contacto`);
    busquedas.push(`"${nombreLimpio}" dentista ${poblacion} contacto`);
  } else if (nombreLimpio) {
    busquedas.push(`"${nombreLimpio}" clínica dental Jaén contacto`);
  }
  
  return busquedas;
}

/**
 * Extrae información de un texto (email, teléfono, dirección, CIF)
 */
function extraerInformacion(texto, cliente) {
  const info = {};
  
  if (!texto) return info;
  
  // Buscar email (filtrar emails genéricos)
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/gi;
  const emails = texto.match(emailRegex);
  if (emails && emails.length > 0) {
    const emailsFiltrados = emails.filter(email => {
      const emailLower = email.toLowerCase();
      return !emailLower.includes('example.com') && 
             !emailLower.includes('test.com') &&
             !emailLower.includes('gmail.com') &&
             !emailLower.includes('hotmail.com') &&
             !emailLower.includes('yahoo.com') &&
             !emailLower.includes('outlook.com');
    });
    
    if (emailsFiltrados.length > 0 && campoVacio(cliente.Email)) {
      info.Email = emailsFiltrados[0].toLowerCase();
    }
  }
  
  // Buscar teléfono (solo si no tiene)
  if (campoVacio(cliente.Movil) && campoVacio(cliente.Telefono)) {
    const telefonoRegex = /(\+34|0034)?[\s-]?([6-9]\d{2})[\s-]?(\d{2})[\s-]?(\d{2})[\s-]?(\d{2})/g;
    const telefonos = texto.match(telefonoRegex);
    if (telefonos && telefonos.length > 0) {
      const telefonoLimpio = telefonos[0]
        .replace(/[\s-]/g, '')
        .replace(/^\+34|^0034/, '')
        .substring(0, 9);
      if (telefonoLimpio.length === 9) {
        info.Movil = telefonoLimpio;
      }
    }
  }
  
  // Buscar dirección completa (con código postal)
  if (campoVacio(cliente.Direccion) || cliente.Direccion === 'Jaén' || cliente.Direccion.includes('Código Postal')) {
    // Buscar patrones de dirección
    const direccionPatterns = [
      /(C\/|Calle|Av\.|Avenida|Plaza|Paseo|Ronda)[^,]{0,60},?\s*\d{5}/i,
      /\d{5}\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+(?:Jaén|Jaen)/i,
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
  
  // Buscar código postal de Jaén (23xxx)
  if (campoVacio(cliente.CodigoPostal)) {
    const cpPattern = /\b(23\d{3})\b/;
    const cpMatch = texto.match(cpPattern);
    if (cpMatch) {
      info.CodigoPostal = cpMatch[1];
    }
  }
  
  // Buscar CIF/DNI
  if (campoVacio(cliente.DNI_CIF)) {
    const textoUpper = texto.toUpperCase();
    const cifPatterns = [
      /\b([A-Z]\d{8})\b/,  // CIF: A12345678
      /\b(\d{8}[A-Z])\b/,  // DNI: 12345678A
      /\b([A-Z]{2}\d{7}[A-Z0-9])\b/,
      /CIF[:\s]+([A-Z]?\d{8}[A-Z]?)/i,
      /NIF[:\s]+([A-Z]?\d{8}[A-Z]?)/i,
      /DNI[:\s]+(\d{8}[A-Z])/i
    ];
    
    for (const pattern of cifPatterns) {
      const match = textoUpper.match(pattern);
      if (match) {
        const cif = match[1];
        if (cif.length >= 8 && cif.length <= 9) {
          info.DNI_CIF = cif;
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
      
      // Extraer texto de resultados
      const selectores = [
        '.g', '.result', '.search-result', 
        '[data-sokoban-container]', '.tF2Cxc', '.MjjYud'
      ];
      
      for (const selector of selectores) {
        const elementos = document.querySelectorAll(selector);
        if (elementos.length > 0) {
          elementos.forEach(el => {
            const texto = el.textContent || el.innerText || '';
            if (texto.length > 50) {
              info.texto += texto + ' ';
            }
          });
          break;
        }
      }
      
      return info;
    });
    
    return informacion.texto;
    
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
      if (info.Direccion && (campoVacio(cliente.Direccion) || cliente.Direccion === 'Jaén' || cliente.Direccion.includes('Código Postal'))) {
        informacionEncontrada.Direccion = info.Direccion;
      }
      if (info.CodigoPostal && campoVacio(cliente.CodigoPostal)) {
        informacionEncontrada.CodigoPostal = info.CodigoPostal;
      }
      if (info.DNI_CIF && campoVacio(cliente.DNI_CIF)) {
        informacionEncontrada.DNI_CIF = info.DNI_CIF;
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
async function completarDatosClinicasJaen() {
  let browser = null;
  
  try {
    console.log('🚀 Iniciando completado de datos de clínicas dentales de Jaén...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener clínicas dentales de Jaén con datos faltantes
    console.log('📊 Obteniendo clínicas dentales de Jaén...');
    const todasLasClinicas = await crm.query(`
      SELECT id, Nombre_Razon_Social, Direccion, Poblacion, Movil, Email, CodigoPostal, DNI_CIF
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND Poblacion LIKE '%Jaén%'
      ORDER BY id DESC
      LIMIT 200
    `);
    
    console.log(`✅ ${todasLasClinicas.length} clínicas encontradas\n`);
    
    // Filtrar clínicas con datos faltantes
    const clinicasConFaltantes = todasLasClinicas.filter(clinica => {
      return campoVacio(clinica.Email) || 
             campoVacio(clinica.Direccion) || 
             clinica.Direccion === 'Jaén' ||
             clinica.Direccion.includes('Código Postal') ||
             campoVacio(clinica.CodigoPostal) ||
             campoVacio(clinica.DNI_CIF) ||
             campoVacio(clinica.Movil);
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
    
    for (let i = 0; i < clinicasAProcesar.length; i++) {
      const clinica = clinicasAProcesar[i];
      const numero = i + 1;
      
      try {
        const faltantes = [];
        if (campoVacio(clinica.DNI_CIF)) faltantes.push('DNI/CIF');
        if (campoVacio(clinica.Email)) faltantes.push('Email');
        if (campoVacio(clinica.Direccion) || clinica.Direccion === 'Jaén' || clinica.Direccion.includes('Código Postal')) faltantes.push('Dirección');
        if (campoVacio(clinica.CodigoPostal)) faltantes.push('Código Postal');
        if (campoVacio(clinica.Movil)) faltantes.push('Teléfono');
        
        console.log(`[${numero}/${clinicasAProcesar.length}] ${clinica.Nombre_Razon_Social} (ID: ${clinica.id})`);
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
    console.log(`📊 Resumen:`);
    console.log(`   ✅ Clínicas procesadas: ${procesados}`);
    console.log(`   🔄 Clínicas actualizadas: ${actualizados}`);
    console.log(`   ❌ Errores: ${errores}`);
    console.log(`   📋 Total con datos faltantes: ${clinicasConFaltantes.length}`);
    
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
  completarDatosClinicasJaen()
    .then(() => {
      console.log('\n✅ Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { completarDatosClinicasJaen };
