// Script para leer y analizar el Excel de Holded (versión corregida)
const XLSX = require('xlsx');

const EXCEL_FILE = 'C:\\Users\\pacol\\Downloads\\FARMADESCANSO 2021 SL - Contactos (2).xlsx';

console.log('📖 Leyendo archivo Excel...');
const workbook = XLSX.readFile(EXCEL_FILE);

console.log(`✅ Archivo leído. Hojas: ${workbook.SheetNames.join(', ')}\n`);

// Leer la primera hoja
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Leer como array de arrays para ver la estructura real
const dataArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

console.log(`📊 Total de filas: ${dataArray.length}\n`);

// Buscar la fila de encabezados (debe contener "Nombre", "Email", etc.)
let headerRowIndex = -1;
let headers = [];

for (let i = 0; i < Math.min(10, dataArray.length); i++) {
  const row = dataArray[i];
  if (row && row.length > 0) {
    const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
    if (rowStr.includes('nombre') && rowStr.includes('email') && rowStr.includes('teléfono')) {
      headerRowIndex = i;
      headers = row.map(c => String(c || '').trim());
      break;
    }
  }
}

if (headerRowIndex === -1) {
  console.log('⚠️  No se encontró la fila de encabezados. Mostrando primeras 5 filas:');
  dataArray.slice(0, 5).forEach((row, i) => {
    console.log(`Fila ${i}:`, row);
  });
  process.exit(1);
}

console.log(`✅ Fila de encabezados encontrada en la fila ${headerRowIndex + 1}\n`);
console.log('📋 Encabezados encontrados:');
console.log('═══════════════════════════════════════════════════════════');
headers.forEach((h, i) => {
  if (h && h !== '') {
    console.log(`${i + 1}. ${h}`);
  }
});
console.log('═══════════════════════════════════════════════════════════\n');

// Leer datos desde la fila siguiente a los encabezados
const data = XLSX.utils.sheet_to_json(worksheet, { 
  header: headerRowIndex,
  range: headerRowIndex,
  defval: null 
});

console.log(`📊 Total de registros: ${data.length}\n`);

if (data.length > 0) {
  console.log('📋 Primeras 3 filas de datos:');
  console.log('═══════════════════════════════════════════════════════════');
  data.slice(0, 3).forEach((row, index) => {
    console.log(`\nRegistro ${index + 1}:`);
    Object.keys(row).forEach(key => {
      const valor = row[key];
      if (valor !== null && valor !== undefined && valor !== '') {
        const valorStr = String(valor);
        console.log(`  ${key}: ${valorStr.length > 100 ? valorStr.substring(0, 100) + '...' : valorStr}`);
      }
    });
  });
  console.log('═══════════════════════════════════════════════════════════\n');

  // Buscar columnas relacionadas
  const columnas = Object.keys(data[0]);
  const columnasDNI = columnas.filter(c => 
    c.toLowerCase().includes('dni') || 
    c.toLowerCase().includes('cif') || 
    c.toLowerCase().includes('nif') ||
    c.toLowerCase().includes('identificador') ||
    c.toLowerCase().includes('referencia')
  );
  const columnasPais = columnas.filter(c => 
    c.toLowerCase().includes('pais') || 
    c.toLowerCase().includes('country') ||
    c.toLowerCase().includes('país')
  );
  const columnasNombre = columnas.filter(c => 
    c.toLowerCase().includes('nombre') || 
    c.toLowerCase().includes('name')
  );

  console.log('🔍 Análisis de columnas clave:');
  console.log(`  Columnas DNI/CIF/Referencia: ${columnasDNI.join(', ') || 'No encontradas'}`);
  console.log(`  Columnas País: ${columnasPais.join(', ') || 'No encontradas'}`);
  console.log(`  Columnas Nombre: ${columnasNombre.join(', ') || 'No encontradas'}`);

  // Contar filas con datos relevantes
  let conDNI = 0;
  let espanoles = 0;
  let conNombre = 0;
  
  data.forEach(row => {
    const nombre = columnasNombre.find(c => row[c] && String(row[c]).trim() !== '');
    if (nombre && row[nombre]) {
      conNombre++;
    }
    
    const dni = columnasDNI.find(c => row[c] && String(row[c]).trim() !== '');
    if (dni && row[dni]) {
      conDNI++;
    }
    
    const pais = columnasPais.find(c => row[c] && String(row[c]).trim() !== '');
    if (pais && row[pais]) {
      const paisValor = String(row[pais]).toLowerCase();
      if (paisValor.includes('españa') || paisValor.includes('spain') || paisValor === 'es' || paisValor.includes('españ')) {
        espanoles++;
      }
    }
  });

  console.log(`\n📊 Estadísticas:`);
  console.log(`  Registros con nombre: ${conNombre}`);
  console.log(`  Registros con DNI/CIF/Referencia: ${conDNI}`);
  console.log(`  Registros españoles: ${espanoles}`);
}

