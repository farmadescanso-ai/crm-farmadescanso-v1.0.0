/**
 * Script de depuración para ver exactamente cómo están estructuradas las líneas de productos
 */
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');

const FACTURA = "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\01 FACTURAS\\00-2025\\COMPRAS\\20251217 FT A_3406_Fourmag.pdf";

async function debugFactura() {
  try {
    const dataBuffer = await fs.readFile(FACTURA);
    const data = await pdfParse(dataBuffer);
    const texto = data.text;
    const lineas = texto.split('\n');
    
    console.log('🔍 Buscando líneas que contengan códigos de producto (formato XX.XXXXX)...\n');
    
    // Buscar bloques de productos (código seguido de varias líneas)
    console.log('📦 Buscando bloques de productos...\n');
    
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      
      // Si encontramos un código de producto
      if (/^\d+\.\d{5}$/.test(linea.trim())) {
        const codigo = linea.trim();
        console.log(`\n🔍 Producto encontrado - Código: ${codigo}`);
        console.log(`   Línea ${i}: ${linea.trim()}`);
        
        // Mostrar las siguientes 5 líneas
        for (let j = 1; j <= 5 && (i + j) < lineas.length; j++) {
          const siguienteLinea = lineas[i + j];
          console.log(`   Línea ${i + j}: ${siguienteLinea.trim()}`);
          
          // Buscar cantidad, precio, etc.
          if (siguienteLinea.includes('UN')) {
            console.log(`   ✅ Contiene UN (cantidad/precio)`);
          }
          if (siguienteLinea.match(/[\d.,]+\s*[€Ôé¼ÔÇ£]/)) {
            console.log(`   ✅ Contiene precio`);
          }
        }
      }
    }
    
    // Intentar extraer datos de la primera línea
    if (lineasConCodigo.length > 0) {
      const primeraLinea = lineasConCodigo[0];
      console.log('\n🔬 Análisis detallado de la primera línea:\n');
      console.log(`Texto completo: "${primeraLinea}"`);
      
      // Intentar diferentes patrones
      const patrones = [
        /^(\d+\.\d+)\s+(.+?)\s+(\d+(?:\s\d+)*(?:,\d+)?)\s+UN\s+([\d.,]+)/,
        /^(\d+\.\d+)\s+(.+?)\s+(\d{1,3}(?:\s\d{3})*(?:,\d+)?)\s+UN\s+([\d.,]+)/,
        /(\d+\.\d{5})\s+(.+?)\s+(\d+(?:\s\d+)*(?:,\d+)?)\s+UN/,
      ];
      
      patrones.forEach((patron, i) => {
        const match = primeraLinea.match(patron);
        if (match) {
          console.log(`\n✅ Patrón ${i + 1} funciona:`);
          console.log(`   Código: ${match[1]}`);
          console.log(`   Descripción: ${match[2]}`);
          console.log(`   Cantidad: ${match[3]}`);
          console.log(`   Precio: ${match[4] || 'N/A'}`);
        } else {
          console.log(`\n❌ Patrón ${i + 1} no funciona`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

debugFactura();

