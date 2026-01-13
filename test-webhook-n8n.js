// Script de prueba para verificar la configuración del webhook de N8N
require('dotenv').config();

console.log('🧪 [TEST] Verificando configuración del webhook de N8N...\n');

const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

if (!n8nWebhookUrl) {
  console.error('❌ [TEST] N8N_WEBHOOK_URL no está configurado en el archivo .env');
  console.log('\n📝 [TEST] Por favor, agrega esta línea a tu archivo .env:');
  console.log('   N8N_WEBHOOK_URL=https://farmadescanso-n8n.6f4r35.easypanel.host/webhook/37497208-9f96-40d7-a1da-0bfbd957c9d0\n');
  process.exit(1);
}

console.log('✅ [TEST] N8N_WEBHOOK_URL está configurado:');
console.log(`   ${n8nWebhookUrl}\n`);

// Verificar que la URL sea válida
try {
  const url = new URL(n8nWebhookUrl);
  console.log('✅ [TEST] La URL es válida:');
  console.log(`   - Protocolo: ${url.protocol}`);
  console.log(`   - Host: ${url.host}`);
  console.log(`   - Path: ${url.pathname}\n`);
  
  // Hacer una petición de prueba (sin enviar datos reales)
  console.log('📤 [TEST] Probando conexión con el webhook...');
  
  const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
  
  // Payload de prueba mínimo
  const testPayload = {
    test: true,
    procesoId: 'test_connection_' + Date.now(),
    timestamp: new Date().toISOString()
  };
  
  fetch(n8nWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testPayload)
  })
  .then(async (response) => {
    const responseText = await response.text();
    console.log(`\n✅ [TEST] Conexión exitosa!`);
    console.log(`   - Status: ${response.status} ${response.statusText}`);
    console.log(`   - Response: ${responseText.substring(0, 200)}...\n`);
    
    if (response.ok) {
      console.log('🎉 [TEST] El webhook de N8N está funcionando correctamente!\n');
      process.exit(0);
    } else {
      console.warn('⚠️ [TEST] El webhook respondió pero con un código de estado no exitoso.\n');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(`\n❌ [TEST] Error al conectar con el webhook:`);
    console.error(`   ${error.message}\n`);
    
    if (error.code === 'ENOTFOUND') {
      console.log('💡 [TEST] Sugerencia: Verifica que la URL del webhook sea correcta.\n');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 [TEST] Sugerencia: Verifica que el servidor de N8N esté accesible.\n');
    }
    
    process.exit(1);
  });
  
} catch (error) {
  console.error('❌ [TEST] La URL no es válida:');
  console.error(`   ${error.message}\n`);
  process.exit(1);
}

