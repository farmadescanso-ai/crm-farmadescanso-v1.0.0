// Script para probar la lógica corregida de OK_KO
console.log('🧪 Probando lógica de OK_KO corregida:\n');

// Simular diferentes valores que pueden venir de MySQL
const valoresPrueba = [
  { valor: 1, tipo: 'number', descripcion: 'Número 1 (activo)' },
  { valor: 0, tipo: 'number', descripcion: 'Número 0 (inactivo)' },
  { valor: '1', tipo: 'string', descripcion: 'String "1" (activo) - CASO PROBLEMÁTICO' },
  { valor: '0', tipo: 'string', descripcion: 'String "0" (inactivo)' },
  { valor: 'OK', tipo: 'string', descripcion: 'String "OK" (activo)' },
  { valor: 'KO', tipo: 'string', descripcion: 'String "KO" (inactivo)' },
  { valor: true, tipo: 'boolean', descripcion: 'Boolean true (activo)' },
  { valor: false, tipo: 'boolean', descripcion: 'Boolean false (inactivo)' },
  { valor: null, tipo: 'null', descripcion: 'NULL (por defecto activo)' },
  { valor: undefined, tipo: 'undefined', descripcion: 'Undefined (por defecto activo)' }
];

valoresPrueba.forEach(({ valor, tipo, descripcion }) => {
  const okKo = valor;
  let estadoActivo = false;
  
  if (okKo === null || okKo === undefined) {
    estadoActivo = true;
  } else if (typeof okKo === 'string') {
    const okKoUpper = okKo.toUpperCase().trim();
    estadoActivo = (okKoUpper === 'OK' || okKoUpper === '1' || okKoUpper === 'TRUE');
  } else if (typeof okKo === 'number') {
    estadoActivo = (okKo === 1);
  } else if (typeof okKo === 'boolean') {
    estadoActivo = okKo;
  } else {
    estadoActivo = true;
  }
  
  const resultado = estadoActivo ? '✅ Activo' : '❌ Inactivo';
  console.log(`${descripcion}:`);
  console.log(`  Valor: ${valor} (${tipo})`);
  console.log(`  Resultado: ${resultado}\n`);
});

console.log('✅ Prueba completada');

