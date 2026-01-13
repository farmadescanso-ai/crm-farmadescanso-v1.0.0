/**
 * Script para verificar que las rutas de códigos postales están registradas
 * Ejecutar: node scripts/verificar-rutas-codigos-postales.js
 */

const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '..', 'server-crm-completo.js');
const content = fs.readFileSync(serverFile, 'utf8');

const rutasEsperadas = [
  '/test-codigos-postales',
  '/test-ajustes-codigos-postales',
  '/dashboard/ajustes/codigos-postales',
  '/dashboard/ajustes/asignaciones-comerciales'
];

console.log('🔍 Verificando rutas de códigos postales...\n');

let todasEncontradas = true;

rutasEsperadas.forEach(ruta => {
  const metodo = ruta.startsWith('/test') ? 'app.get' : ruta.includes('asignaciones') ? 'app.get' : 'app.get';
  const patron = new RegExp(`${metodo}\\('${ruta.replace(/\//g, '\\/')}'`);
  
  if (content.match(patron)) {
    console.log(`✅ Ruta encontrada: ${ruta}`);
  } else {
    console.log(`❌ Ruta NO encontrada: ${ruta}`);
    todasEncontradas = false;
  }
});

// Verificar métodos en mysql-crm.js
const mysqlCrmFile = path.join(__dirname, '..', 'config', 'mysql-crm.js');
const mysqlContent = fs.readFileSync(mysqlCrmFile, 'utf8');

const metodosEsperados = [
  'getCodigosPostales',
  'getCodigoPostalById',
  'createCodigoPostal',
  'updateCodigoPostal',
  'deleteCodigoPostal',
  'getAsignaciones',
  'getAsignacionById',
  'createAsignacion',
  'updateAsignacion',
  'deleteAsignacion'
];

console.log('\n🔍 Verificando métodos en mysql-crm.js...\n');

metodosEsperados.forEach(metodo => {
  const patron = new RegExp(`async ${metodo}\\(`);
  
  if (mysqlContent.match(patron)) {
    console.log(`✅ Método encontrado: ${metodo}`);
  } else {
    console.log(`❌ Método NO encontrado: ${metodo}`);
    todasEncontradas = false;
  }
});

// Verificar vistas
const vistaCodigos = path.join(__dirname, '..', 'views', 'dashboard', 'ajustes-codigos-postales.ejs');
const vistaAsignaciones = path.join(__dirname, '..', 'views', 'dashboard', 'ajustes-asignaciones-comerciales.ejs');

console.log('\n🔍 Verificando vistas...\n');

if (fs.existsSync(vistaCodigos)) {
  console.log('✅ Vista encontrada: ajustes-codigos-postales.ejs');
} else {
  console.log('❌ Vista NO encontrada: ajustes-codigos-postales.ejs');
  todasEncontradas = false;
}

if (fs.existsSync(vistaAsignaciones)) {
  console.log('✅ Vista encontrada: ajustes-asignaciones-comerciales.ejs');
} else {
  console.log('❌ Vista NO encontrada: ajustes-asignaciones-comerciales.ejs');
  todasEncontradas = false;
}

console.log('\n' + '='.repeat(50));
if (todasEncontradas) {
  console.log('✅ Todas las rutas, métodos y vistas están correctamente implementados');
  console.log('\n💡 Próximos pasos:');
  console.log('   1. Reinicia el servidor: node server-crm-completo.js');
  console.log('   2. Ejecuta el script SQL: scripts/crear-tabla-codigos-postales.sql');
  console.log('   3. Accede a: http://localhost:3000/dashboard/ajustes/codigos-postales');
} else {
  console.log('❌ Hay problemas que necesitan ser corregidos');
}
console.log('='.repeat(50));
