/**
 * Script de prueba para ver la estructura de las páginas de MurciaSalud
 */

const puppeteer = require('puppeteer');

async function testMurciaSalud() {
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: false, // Mostrar navegador para ver qué pasa
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Probar con Murcia directamente
    const url = 'https://www.murciasalud.es/farmacias.php?accion=oficinasporlocalidad&localidad=Murcia';
    console.log(`📄 Accediendo a: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Guardar captura
    await page.screenshot({ path: 'test-murcia.png', fullPage: true });
    console.log('📸 Captura guardada: test-murcia.png');
    
    // Extraer HTML para análisis
    const html = await page.content();
    console.log(`📄 HTML obtenido: ${html.length} caracteres`);
    
    // Buscar estructura
    const estructura = await page.evaluate(() => {
      const info = {
        tablas: document.querySelectorAll('table').length,
        listas: document.querySelectorAll('ul, ol').length,
        enlaces: document.querySelectorAll('a').length,
        divs: document.querySelectorAll('div').length,
        textoCompleto: document.body.textContent.substring(0, 1000)
      };
      
      // Buscar cualquier mención de "farmacia"
      const texto = document.body.textContent || '';
      const mencionesFarmacia = texto.match(/farmacia/gi);
      info.mencionesFarmacia = mencionesFarmacia ? mencionesFarmacia.length : 0;
      
      // Buscar tablas y su contenido
      const tablas = [];
      document.querySelectorAll('table').forEach((tabla, idx) => {
        const filas = tabla.querySelectorAll('tr');
        const celdas = tabla.querySelectorAll('td, th');
        tablas.push({
          indice: idx,
          filas: filas.length,
          celdas: celdas.length,
          primeraFila: filas[0] ? filas[0].textContent.substring(0, 200) : '',
          segundaFila: filas[1] ? filas[1].textContent.substring(0, 200) : ''
        });
      });
      info.detalleTablas = tablas;
      
      return info;
    });
    
    console.log('\n📊 Estructura de la página:');
    console.log(JSON.stringify(estructura, null, 2));
    
    // Esperar para que el usuario pueda ver el navegador
    console.log('\n⏳ Esperando 10 segundos para que puedas ver el navegador...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testMurciaSalud();

