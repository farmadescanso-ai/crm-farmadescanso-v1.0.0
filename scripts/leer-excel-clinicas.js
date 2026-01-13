/**
 * Script temporal para leer el Excel de clínicas dentales y mostrar sus columnas
 */
const XLSX = require('xlsx');
const path = require('path');

const EXCEL_FILE = 'C:\\Users\\pacol\\Downloads\\Copia de Listado Clínicas Murcia y Alicante Farmadescanso.xlsx';

try {
  console.log(`📖 Leyendo archivo Excel: ${EXCEL_FILE}`);
  const workbook = XLSX.readFile(EXCEL_FILE);
  
  // Obtener todas las hojas
  console.log(`\n📄 Hojas encontradas: ${workbook.SheetNames.join(', ')}`);
  
  // Obtener la primera hoja
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  console.log(`\n📄 Procesando hoja: ${sheetName}`);
  
  // Convertir a JSON con headers
  const datos = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  
  if (datos.length < 2) {
    console.log('⚠️  El archivo no tiene suficientes filas');
    process.exit(1);
  }
  
  // Mostrar encabezados
  const headers = datos[0];
  console.log('\n📊 Columnas encontradas en el Excel:');
  console.log('='.repeat(80));
  headers.forEach((header, index) => {
    console.log(`${index + 1}. ${header || '(vacío)'}`);
  });
  
  // Mostrar primeras filas de datos como ejemplo
  const filasMostrar = Math.min(5, datos.length - 1);
  console.log(`\n📋 Ejemplo de las primeras ${filasMostrar} filas de datos:`);
  console.log('='.repeat(80));
  
  for (let i = 1; i <= filasMostrar; i++) {
    console.log(`\n--- Fila ${i} ---`);
    const fila = datos[i];
    headers.forEach((header, index) => {
      const valor = fila[index];
      console.log(`${header}: ${valor || '(vacío)'}`);
    });
  }
  
  console.log(`\n✅ Total de filas (incluyendo encabezado): ${datos.length}`);
  console.log(`✅ Total de columnas: ${headers.length}`);
  console.log(`✅ Total de registros de datos: ${datos.length - 1}`);
  
} catch (error) {
  console.error('❌ Error leyendo el archivo Excel:', error.message);
  console.error(error.stack);
  process.exit(1);
}
