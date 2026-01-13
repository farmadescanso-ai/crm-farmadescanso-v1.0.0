/**
 * Script para probar la ruta de asignaciones y ver los errores
 */

const http = require('http');

// Primero probar sin autenticación (debería redirigir)
console.log('🔍 Test 1: Sin autenticación (debería redirigir a login)');
const req1 = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/dashboard/ajustes/asignaciones-comerciales',
  method: 'GET'
}, (res) => {
  console.log(`   Estado: ${res.statusCode}`);
  if (res.statusCode === 302) {
    console.log('   ✅ Redirección correcta (requiere autenticación)');
  } else if (res.statusCode === 500) {
    console.log('   ❌ Error 500 detectado');
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('   Respuesta:', data.substring(0, 200));
    });
  }
});

req1.on('error', (error) => {
  console.error('   ❌ Error de conexión:', error.message);
  console.error('   Verifica que el servidor esté corriendo en el puerto 3000');
});

req1.end();

// Esperar un poco y mostrar instrucciones
setTimeout(() => {
  console.log('\n📋 Para ver los logs del servidor:');
  console.log('   1. Abre la terminal donde está corriendo el servidor');
  console.log('   2. Busca los logs que empiezan con:');
  console.log('      ✅ [ASIGNACIONES] ========== INICIO ==========');
  console.log('      ❌ [ASIGNACIONES] ========== ERROR ... ==========');
  console.log('   3. Copia y pega esos logs aquí');
}, 2000);
