/**
 * Script de prueba para ver la estructura de una página de detalle de farmacia
 */

const puppeteer = require('puppeteer');

async function testFarmaciaDetalle() {
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Probar con una localidad específica
    const url = 'https://www.murciasalud.es/farmacias.php?accion=oficinasporlocalidad&localidad=Murcia';
    console.log(`📄 Accediendo a: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Guardar captura
    await page.screenshot({ path: 'test-murcia-detalle.png', fullPage: true });
    console.log('📸 Captura guardada: test-murcia-detalle.png');
    
    // Buscar todos los enlaces que puedan ser farmacias
    const enlaces = await page.evaluate(() => {
      const resultados = [];
      const todosEnlaces = document.querySelectorAll('a');
      
      todosEnlaces.forEach((enlace, idx) => {
        const href = enlace.getAttribute('href') || '';
        const texto = enlace.textContent?.trim() || '';
        const padre = enlace.closest('li, div, p, td, tr');
        const textoPadre = padre ? padre.textContent?.trim() : '';
        
        // Filtrar enlaces relevantes
        if (href.includes('farmacias.php') && 
            !href.includes('listalocalidades') &&
            texto.length > 5 && 
            texto.length < 200 &&
            !texto.toLowerCase().includes('listado') &&
            !texto.toLowerCase().includes('localidad')) {
          resultados.push({
            indice: idx,
            texto: texto,
            href: href,
            textoPadre: textoPadre.substring(0, 200),
            tieneCod: href.includes('cod='),
            tieneAccion: href.includes('accion=')
          });
        }
      });
      
      return resultados;
    });
    
    console.log(`\n📊 Enlaces encontrados: ${enlaces.length}`);
    console.log('\n📝 Primeros 10 enlaces:');
    enlaces.slice(0, 10).forEach((enlace, i) => {
      console.log(`\n${i + 1}. ${enlace.texto.substring(0, 80)}`);
      console.log(`   URL: ${enlace.href.substring(0, 100)}`);
      console.log(`   Contexto: ${enlace.textoPadre.substring(0, 100)}`);
    });
    
    // Si hay enlaces, probar acceder a uno
    if (enlaces.length > 0 && enlaces[0].href) {
      const urlDetalle = enlaces[0].href.startsWith('http') 
        ? enlaces[0].href 
        : `https://www.murciasalud.es/${enlaces[0].href}`;
      
      console.log(`\n🔍 Accediendo a detalle: ${urlDetalle}`);
      await page.goto(urlDetalle, {
        waitUntil: 'networkidle2',
        timeout: 20000
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await page.screenshot({ path: 'test-farmacia-detalle.png', fullPage: true });
      console.log('📸 Captura de detalle guardada: test-farmacia-detalle.png');
      
      // Extraer información de la página de detalle
      const detalle = await page.evaluate(() => {
        const info = {
          titulo: document.querySelector('h1, h2, .titulo, .title')?.textContent?.trim() || '',
          textoCompleto: document.body.textContent.substring(0, 2000),
          tablas: document.querySelectorAll('table').length,
          listas: document.querySelectorAll('ul, ol').length
        };
        
        // Buscar datos específicos
        const texto = document.body.textContent || '';
        info.telefono = texto.match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
        info.codigoPostal = texto.match(/\b\d{5}\b/);
        info.email = texto.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
        
        return info;
      });
      
      console.log('\n📊 Información de la página de detalle:');
      console.log(JSON.stringify(detalle, null, 2));
    }
    
    console.log('\n⏳ Esperando 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testFarmaciaDetalle();

