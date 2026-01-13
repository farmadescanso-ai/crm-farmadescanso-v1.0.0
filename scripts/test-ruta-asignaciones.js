/**
 * Script para probar la ruta de asignaciones comerciales
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/dashboard/ajustes/asignaciones-comerciales',
  method: 'GET',
  headers: {
    'User-Agent': 'Test-Script'
  }
};

console.log('🔍 Probando ruta: GET /dashboard/ajustes/asignaciones-comerciales');
console.log('📡 Enviando petición a:', `http://${options.hostname}:${options.port}${options.path}\n`);

const req = http.request(options, (res) => {
  console.log(`✅ Estado de respuesta: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  console.log(`\n📄 Contenido de respuesta (primeros 500 caracteres):`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Ruta accesible correctamente');
      // Buscar si hay provincias en el HTML
      const tieneProvincias = data.includes('provincias') || data.includes('Provincia');
      console.log(`   - ¿Contiene referencias a provincias?: ${tieneProvincias ? 'Sí' : 'No'}`);
      
      // Buscar el select de provincias
      const tieneSelectProvincia = data.includes('Id_Provincia') || data.includes('filtroProvincia');
      console.log(`   - ¿Contiene select de provincias?: ${tieneSelectProvincia ? 'Sí' : 'No'}`);
      
      // Mostrar un fragmento del HTML
      const fragmento = data.substring(0, 500);
      console.log(`\n📝 Fragmento HTML:`);
      console.log(fragmento);
    } else if (res.statusCode === 302 || res.statusCode === 301) {
      console.log('⚠️ Redirección detectada (probablemente requiere autenticación)');
      console.log(`   - Location: ${res.headers.location}`);
    } else if (res.statusCode === 404) {
      console.log('❌ Ruta no encontrada (404)');
      console.log('   - Verifica que la ruta esté registrada en server-crm-completo.js');
    } else {
      console.log(`⚠️ Respuesta inesperada: ${res.statusCode}`);
    }
    
    console.log(`\n📊 Tamaño de respuesta: ${data.length} bytes`);
  });
});

req.on('error', (error) => {
  console.error('❌ Error en la petición:', error.message);
  console.error('   - Verifica que el servidor esté corriendo en el puerto 3000');
});

req.end();
