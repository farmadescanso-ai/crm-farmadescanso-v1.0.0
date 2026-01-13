/**
 * Script temporal para leer el Excel y mostrar sus columnas
 */
const XLSX = require('xlsx');
const path = require('path');

const EXCEL_FILE = 'C:\\Users\\pacol\\Downloads\\Clientes_exported_1.xlsx';

try {
  console.log(`📖 Leyendo archivo Excel: ${EXCEL_FILE}`);
  const workbook = XLSX.readFile(EXCEL_FILE);
  
  // Obtener la primera hoja
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  console.log(`📄 Hoja encontrada: ${sheetName}`);
  
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
  
  // Mostrar primera fila de datos como ejemplo
  if (datos.length > 1) {
    console.log('\n📋 Ejemplo de primera fila de datos:');
    console.log('='.repeat(80));
    const primeraFila = datos[1];
    headers.forEach((header, index) => {
      const valor = primeraFila[index];
      console.log(`${header}: ${valor || '(vacío)'}`);
    });
  }
  
  console.log(`\n✅ Total de filas (incluyendo encabezado): ${datos.length}`);
  console.log(`✅ Total de columnas: ${headers.length}`);
  
} catch (error) {
  console.error('❌ Error leyendo el archivo Excel:', error.message);
  process.exit(1);
}

