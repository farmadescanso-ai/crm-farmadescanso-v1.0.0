// Script para obtener todos los emails de comerciales para agregarlos como usuarios de prueba en Google Cloud Console
const crm = require('../config/mysql-crm');
require('dotenv').config();

async function obtenerEmailsComerciales() {
  try {
    await crm.connect();
    console.log('🔌 Conectado a la base de datos\n');

    const comerciales = await crm.getComerciales();
    
    if (comerciales.length === 0) {
      console.log('⚠️ No se encontraron comerciales en la base de datos');
      return;
    }

    console.log('📋 Emails de comerciales para agregar como usuarios de prueba en Google Cloud Console:\n');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const emails = [];
    comerciales.forEach((comercial, index) => {
      const email = comercial.Email || comercial.email;
      const nombre = comercial.Nombre || comercial.nombre || 'Sin nombre';
      
      if (email) {
        emails.push(email);
        console.log(`${index + 1}. ${email} (${nombre})`);
      } else {
        console.log(`${index + 1}. ⚠️ ${nombre} - Sin email configurado`);
      }
    });
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\n✅ Total de emails encontrados: ${emails.length}`);
    
    // Agregar emails adicionales que puedan estar configurados en meet_email o teams_email
    const emailsAdicionales = ['farmadescanso@gmail.com']; // Email compartido/administrador
    
    console.log('\n📝 Lista de emails de comerciales (copia y pega en Google Cloud Console):\n');
    emails.forEach(email => console.log(email));
    
    if (emailsAdicionales.length > 0) {
      console.log('\n📝 Emails adicionales que también deben agregarse:\n');
      emailsAdicionales.forEach(email => {
        if (!emails.includes(email.toLowerCase())) {
          console.log(email);
          emails.push(email.toLowerCase());
        }
      });
    }
    
    console.log('\n📋 Lista completa de emails (incluyendo adicionales):\n');
    emails.forEach(email => console.log(email));
    
    console.log('\n📋 Instrucciones para agregar usuarios de prueba:');
    console.log('1. Ve a https://console.cloud.google.com/');
    console.log('2. Selecciona tu proyecto: crmfaramadescanso');
    console.log('3. Ve a APIs & Services > OAuth consent screen');
    console.log('4. Verifica que la app esté en modo "Testing" (no "In production")');
    console.log('5. En la sección "Test users", haz clic en "+ ADD USERS"');
    console.log('6. Pega TODOS los emails de arriba (uno por línea o separados por comas)');
    console.log('7. Haz clic en "ADD"');
    console.log('8. Guarda los cambios (SAVE AND CONTINUE o SAVE)');
    console.log('\n⚠️ IMPORTANTE:');
    console.log('   - La aplicación debe estar en modo "Testing" para que estos usuarios puedan acceder');
    console.log('   - Incluye farmadescanso@gmail.com si algún comercial lo usa');
    console.log('   - Espera 1-2 minutos después de agregar los emails antes de intentar conectar');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await crm.disconnect();
    console.log('\n🔌 Conexión cerrada');
  }
}

obtenerEmailsComerciales();

