/**
 * Script para analizar el contenido de una factura PDF
 * y entender su estructura antes de extraer datos
 */
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');

const FACTURA = process.argv[2] || "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\01 FACTURAS\\00-2025\\COMPRAS\\20251217 FT A_3406_Fourmag.pdf";

async function analizarFactura() {
  try {
    console.log(`📄 Analizando factura: ${path.basename(FACTURA)}\n`);
    
    const dataBuffer = await fs.readFile(FACTURA);
    const data = await pdfParse(dataBuffer);
    
    console.log('📊 Información del PDF:');
    console.log(`   Páginas: ${data.numpages}`);
    console.log(`   Título: ${data.info?.Title || 'N/A'}`);
    console.log(`   Autor: ${data.info?.Author || 'N/A'}`);
    console.log(`   Creado: ${data.info?.CreationDate || 'N/A'}`);
    
    console.log('\n📝 Contenido completo del PDF:');
    console.log('='.repeat(80));
    console.log(data.text);
    console.log('='.repeat(80));
    
    // Buscar patrones comunes
    console.log('\n🔍 Patrones encontrados:');
    
    // Buscar totales
    const totales = data.text.match(/TOTAL[:\s]+([\d.,]+)/gi);
    if (totales) {
      console.log('   Totales encontrados:', totales);
    }
    
    // Buscar portes
    const portes = data.text.match(/(PORTES?|TRANSPORTE?|SPEDIZIONE?)[:\s]+([\d.,]+)/gi);
    if (portes) {
      console.log('   Portes encontrados:', portes);
    }
    
    // Buscar números de factura
    const facturaNum = data.text.match(/(FACTURA|FATTURA|INVOICE)[:\s#]+([A-Z0-9-]+)/gi);
    if (facturaNum) {
      console.log('   Números de factura:', facturaNum);
    }
    
    // Buscar fechas
    const fechas = data.text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g);
    if (fechas) {
      console.log('   Fechas encontradas:', fechas);
    }
    
    // Buscar líneas que parecen productos (contienen números y texto)
    const lineas = data.text.split('\n');
    const lineasProductos = lineas.filter(linea => {
      const tieneNumero = /\d/.test(linea);
      const tieneTexto = /[A-Za-z]{3,}/.test(linea);
      const longitud = linea.trim().length;
      return tieneNumero && tieneTexto && longitud > 10 && longitud < 200;
    });
    
    console.log(`\n📦 Líneas que parecen productos (${lineasProductos.length}):`);
    lineasProductos.slice(0, 20).forEach((linea, i) => {
      console.log(`   ${i + 1}. ${linea.trim()}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analizarFactura();

