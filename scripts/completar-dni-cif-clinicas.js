/**
 * Script para completar DNI/CIF de clínicas dentales en una segunda pasada
 * Busca específicamente el CIF/DNI usando búsquedas optimizadas
 */

const crm = require('../config/mysql-crm');
const puppeteer = require('puppeteer');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || 50;
const DELAY = parseInt(process.argv.find(arg => arg.startsWith('--delay='))?.split('=')[1]) || 2000;

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
 * Busca CIF/DNI en Google con búsqueda específica
 */
async function buscarCIFEnGoogle(page, nombreClinica, poblacion = null) {
  try {
    // Búsqueda específica para CIF
    // Si hay población, incluirla; si no, buscar sin especificar provincia
    const busquedas = poblacion && poblacion.trim() !== '' 
      ? [
          `"${nombreClinica}" CIF ${poblacion}`,
          `"${nombreClinica}" NIF ${poblacion}`,
          `${nombreClinica} CIF ${poblacion} empresa`
        ]
      : [
          `"${nombreClinica}" CIF`,
          `"${nombreClinica}" NIF`,
          `${nombreClinica} CIF empresa`
        ];
    
    for (const busqueda of busquedas) {
      const url = `https://www.google.com/search?q=${encodeURIComponent(busqueda)}&num=5`;
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Intentar aceptar cookies rápidamente
      try {
        const cookieButton = await page.$('#L2AGLb, button:has-text("Aceptar")');
        if (cookieButton) {
          await cookieButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (e) {}
      
      const cif = await page.evaluate(() => {
        // Buscar CIF/DNI en los primeros resultados
        const texto = document.body.textContent || '';
        const textoUpper = texto.toUpperCase();
        
        // Patrones de CIF/DNI
        const cifPatterns = [
          /\b([A-Z]\d{8})\b/,  // CIF: A12345678
          /\b(\d{8}[A-Z])\b/,  // DNI: 12345678A
          /\b([A-Z]{2}\d{7}[A-Z0-9])\b/,  // CIF alternativo
          /CIF[:\s]+([A-Z]?\d{8}[A-Z]?)/i,
          /NIF[:\s]+([A-Z]?\d{8}[A-Z]?)/i,
          /DNI[:\s]+(\d{8}[A-Z])/i
        ];
        
        for (const pattern of cifPatterns) {
          const match = textoUpper.match(pattern);
          if (match) {
            const cifEncontrado = match[1];
            // Validar que parece un CIF/DNI válido
            if (cifEncontrado.length >= 8 && cifEncontrado.length <= 9) {
              return cifEncontrado;
            }
          }
        }
        
        return null;
      });
      
      if (cif) {
        return cif;
      }
      
      // Pausa corta entre búsquedas
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return null;
    
  } catch (error) {
    return null;
  }
}

/**
 * Busca CIF/DNI en Axesor (método rápido)
 */
async function buscarCIFEnAxesor(page, nombreClinica, poblacion = null) {
  try {
    const nombreLimpio = nombreClinica
      .replace(/\s*-\s*Córdoba.*$/i, '')
      .replace(/\s*-\s*Jaén.*$/i, '')
      .replace(/\s*\|\s*.*$/i, '')
      .trim();
    
    // Usar la población si está disponible, si no, intentar detectar por el nombre
    let localidad = poblacion || 'Córdoba';
    if (!poblacion) {
      if (nombreClinica.toLowerCase().includes('jaén') || nombreClinica.toLowerCase().includes('jaen')) {
        localidad = 'Jaén';
      }
    }
    
    const busqueda = `${nombreLimpio} ${localidad}`;
    const url = `https://www.axesor.es/busqueda?q=${encodeURIComponent(busqueda)}`;
    
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Intentar aceptar cookies
    try {
      const cookieButton = await page.$('button:has-text("Aceptar"), #didomi-notice-agree-button');
      if (cookieButton) {
        await cookieButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (e) {}
    
    const cif = await page.evaluate((nombreBusqueda) => {
      const texto = document.body.textContent || '';
      const textoUpper = texto.toUpperCase();
      
      // Buscar CIF/DNI
      const cifPatterns = [
        /\b([A-Z]\d{8})\b/,
        /\b(\d{8}[A-Z])\b/,
        /\b([A-Z]{2}\d{7}[A-Z0-9])\b/,
        /CIF[:\s]+([A-Z]?\d{8}[A-Z]?)/i,
        /NIF[:\s]+([A-Z]?\d{8}[A-Z]?)/i
      ];
      
      for (const pattern of cifPatterns) {
        const match = textoUpper.match(pattern);
        if (match) {
          const cifEncontrado = match[1];
          if (cifEncontrado.length >= 8 && cifEncontrado.length <= 9) {
            return cifEncontrado;
          }
        }
      }
      
      return null;
    }, nombreLimpio);
    
    return cif;
    
  } catch (error) {
    return null;
  }
}

/**
 * Función principal
 */
async function completarDNICIF() {
  let browser = null;
  
  try {
    console.log('🚀 Iniciando completado de DNI/CIF para clínicas dentales...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener clínicas sin DNI/CIF de Córdoba (14xxx), Jaén (23xxx), Badajoz (06xxx) y Cáceres (10xxx)
    console.log('📊 Obteniendo clínicas dentales sin DNI/CIF (Córdoba, Jaén, Badajoz y Cáceres)...');
    const todasLasClinicas = await crm.query(`
      SELECT id, Nombre_Razon_Social, Direccion, Movil, Poblacion, Id_Provincia, CodigoPostal
      FROM clientes 
      WHERE (Nombre_Razon_Social LIKE '%dental%' 
         OR Nombre_Razon_Social LIKE '%odontolog%'
         OR Nombre_Razon_Social LIKE '%dentista%')
         AND (DNI_CIF IS NULL OR DNI_CIF = '')
         AND (CodigoPostal LIKE '14%' OR CodigoPostal LIKE '23%' OR CodigoPostal LIKE '06%' OR CodigoPostal LIKE '10%')
      ORDER BY id DESC
      LIMIT ${LIMIT * 2}
    `);
    
    // Filtrar clínicas reales (excluir listados, artículos, etc.)
    const clinicas = todasLasClinicas.filter(c => {
      const nombre = (c.Nombre_Razon_Social || '').toLowerCase();
      const filtros = [
        'los 7', 'los 10', 'los 20', 'mejores', 'mejor',
        'cómo', 'cuánto', 'cuál', 'qué', 'guía', 'tips',
        'precio', 'actualizado', 'ranking', 'top'
      ];
      return !filtros.some(filtro => nombre.includes(filtro)) &&
             !nombre.startsWith('¿') &&
             !nombre.startsWith('?');
    }).slice(0, LIMIT);
    
    console.log(`✅ ${clinicas.length} clínicas sin DNI/CIF encontradas\n`);
    
    if (clinicas.length === 0) {
      console.log('✅ Todas las clínicas tienen DNI/CIF');
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
    console.log('🔄 Buscando DNI/CIF...\n');
    
    let procesados = 0;
    let actualizados = 0;
    let errores = 0;
    
    for (let i = 0; i < clinicas.length; i++) {
      const clinica = clinicas[i];
      const numero = i + 1;
      
      try {
        console.log(`[${numero}/${clinicas.length}] ${clinica.Nombre_Razon_Social} (ID: ${clinica.id})`);
        if (clinica.Poblacion) {
          console.log(`   📍 Población: ${clinica.Poblacion}`);
        }
        if (clinica.CodigoPostal) {
          console.log(`   📮 Código Postal: ${clinica.CodigoPostal}`);
        }
        
        // Determinar población para la búsqueda (puede ser null si no hay población)
        const poblacion = clinica.Poblacion || null;
        
        // 1. Intentar en Google (más rápido)
        let cif = await buscarCIFEnGoogle(page, clinica.Nombre_Razon_Social, poblacion);
        
        // 2. Si no se encuentra, intentar en Axesor
        if (!cif) {
          cif = await buscarCIFEnAxesor(page, clinica.Nombre_Razon_Social, poblacion);
        }
        
        if (cif) {
          console.log(`   ✅ CIF/DNI encontrado: ${cif}`);
          
          if (!DRY_RUN) {
            await crm.updateCliente(clinica.id, { DNI_CIF: cif });
            actualizados++;
            console.log(`   ✅ Cliente actualizado`);
          } else {
            console.log(`   📝 [SIMULACIÓN] Se actualizaría DNI_CIF: ${cif}`);
            actualizados++;
          }
        } else {
          console.log(`   ⚠️  No se encontró CIF/DNI`);
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
  completarDNICIF()
    .then(() => {
      console.log('\n✅ Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { completarDNICIF };
