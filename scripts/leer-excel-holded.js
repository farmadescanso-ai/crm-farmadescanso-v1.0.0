// Script para leer y analizar el Excel de Holded
const XLSX = require('xlsx');
const path = require('path');

const EXCEL_FILE = 'C:\\Users\\pacol\\Downloads\\FARMADESCANSO 2021 SL - Contactos (2).xlsx';

console.log('📖 Leyendo archivo Excel...');
const workbook = XLSX.readFile(EXCEL_FILE);

console.log(`✅ Archivo leído. Hojas: ${workbook.SheetNames.join(', ')}\n`);

// Leer la primera hoja
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convertir a JSON con encabezados
const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });

console.log(`📊 Total de filas: ${data.length}\n`);

if (data.length > 0) {
  console.log('📋 Columnas encontradas:');
  console.log('═══════════════════════════════════════════════════════════');
  const columnas = Object.keys(data[0]);
  columnas.forEach((col, index) => {
    console.log(`${index + 1}. ${col}`);
  });
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📋 Primeras 3 filas de ejemplo:');
  console.log('═══════════════════════════════════════════════════════════');
  data.slice(0, 3).forEach((row, index) => {
    console.log(`\nFila ${index + 1}:`);
    Object.keys(row).forEach(key => {
      const valor = row[key];
      if (valor !== null && valor !== undefined && valor !== '') {
        console.log(`  ${key}: ${String(valor).substring(0, 100)}`);
      }
    });
  });
  console.log('═══════════════════════════════════════════════════════════\n');

  // Buscar columnas relacionadas con DNI/CIF, País, etc.
  console.log('🔍 Análisis de columnas clave:');
  const columnasDNI = columnas.filter(c => 
    c.toLowerCase().includes('dni') || 
    c.toLowerCase().includes('cif') || 
    c.toLowerCase().includes('nif') ||
    c.toLowerCase().includes('identificador')
  );
  const columnasPais = columnas.filter(c => 
    c.toLowerCase().includes('pais') || 
    c.toLowerCase().includes('country') ||
    c.toLowerCase().includes('país')
  );
  const columnasNombre = columnas.filter(c => 
    c.toLowerCase().includes('nombre') || 
    c.toLowerCase().includes('name') ||
    c.toLowerCase().includes('razon') ||
    c.toLowerCase().includes('razón')
  );

  console.log(`  Columnas DNI/CIF: ${columnasDNI.join(', ') || 'No encontradas'}`);
  console.log(`  Columnas País: ${columnasPais.join(', ') || 'No encontradas'}`);
  console.log(`  Columnas Nombre: ${columnasNombre.join(', ') || 'No encontradas'}`);

  // Contar filas con DNI/CIF
  let conDNI = 0;
  let espanoles = 0;
  data.forEach(row => {
    const dni = columnasDNI.find(c => row[c] && String(row[c]).trim() !== '');
    if (dni && row[dni]) {
      conDNI++;
    }
    const pais = columnasPais.find(c => row[c] && String(row[c]).trim() !== '');
    if (pais && row[pais]) {
      const paisValor = String(row[pais]).toLowerCase();
      if (paisValor.includes('españa') || paisValor.includes('spain') || paisValor.includes('es')) {
        espanoles++;
      }
    }
  });

  console.log(`\n📊 Estadísticas:`);
  console.log(`  Filas con DNI/CIF: ${conDNI}`);
  console.log(`  Filas españolas: ${espanoles}`);
}

