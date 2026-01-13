/**
 * Script para explorar la estructura real de las páginas de MurciaSalud
 */

const puppeteer = require('puppeteer');

async function explorarMurciaSalud() {
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Probar con Murcia
    const url = 'https://www.murciasalud.es/farmacias.php?accion=oficinasporlocalidad&localidad=Murcia';
    console.log(`📄 Accediendo a: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Analizar estructura completa
    const estructura = await page.evaluate(() => {
      const info = {
        titulo: document.title,
        h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()),
        h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()),
        enlaces: [],
        textoVisible: document.body.innerText.substring(0, 5000)
      };
      
      // Buscar todos los enlaces
      document.querySelectorAll('a').forEach((enlace, idx) => {
        const href = enlace.getAttribute('href') || '';
        const texto = enlace.textContent?.trim() || '';
        
        if (href.includes('farmacias') || href.includes('accion=') || texto.length > 5) {
          info.enlaces.push({
            indice: idx,
            texto: texto.substring(0, 100),
            href: href.substring(0, 150)
          });
        }
      });
      
      return info;
    });
    
    console.log('\n📊 Estructura de la página:');
    console.log('Título:', estructura.titulo);
    console.log('H1:', estructura.h1);
    console.log('H2:', estructura.h2);
    console.log('\n📝 Primeros 20 enlaces:');
    estructura.enlaces.slice(0, 20).forEach((e, i) => {
      console.log(`${i + 1}. "${e.texto}" -> ${e.href}`);
    });
    
    console.log('\n📄 Primeros 2000 caracteres del texto visible:');
    console.log(estructura.textoVisible);
    
    await page.screenshot({ path: 'exploracion-murcia.png', fullPage: true });
    console.log('\n📸 Captura guardada: exploracion-murcia.png');
    
    console.log('\n⏳ Esperando 10 segundos...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

explorarMurciaSalud();

