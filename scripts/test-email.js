require('dotenv').config();
const nodemailer = require('nodemailer');

const mailTransport = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'com1008.raiolanetworks.es',
  port: Number(process.env.MAIL_PORT || 465),
  secure: true,
  auth: {
    user: process.env.MAIL_USER || 'pedidos@farmadescanso.com',
    pass: process.env.MAIL_PASS || 'FarmaPedidos-1964'
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function testEmail() {
  try {
    console.log('📧 Configuración de email:');
    console.log('   Host:', process.env.MAIL_HOST || 'com1008.raiolanetworks.es');
    console.log('   Port:', process.env.MAIL_PORT || 465);
    console.log('   User:', process.env.MAIL_USER || 'pedidos@farmadescanso.com');
    console.log('   Pass:', process.env.MAIL_PASS ? '***' : 'FarmaPedidos-1964 (default)');
    console.log('');
    
    console.log('🔍 Verificando conexión con el servidor de email...');
    await mailTransport.verify();
    console.log('✅ Conexión con el servidor de email exitosa\n');
    
    console.log('📧 Enviando email de prueba a paco@fralabu.com...');
    const result = await mailTransport.sendMail({
      from: process.env.MAIL_USER || 'pedidos@farmadescanso.com',
      to: 'paco@fralabu.com',
      subject: 'Prueba de Email - Recuperación de Contraseña',
      html: `
        <h1>Prueba de Email</h1>
        <p>Este es un email de prueba para verificar que el sistema de envío de emails funciona correctamente.</p>
        <p>Si recibes este email, el sistema está funcionando.</p>
      `
    });
    
    console.log('✅ Email enviado correctamente');
    console.log('   MessageId:', result.messageId);
    console.log('   Response:', result.response || 'N/A');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error enviando email:');
    console.error('   Mensaje:', error.message);
    console.error('   Código:', error.code);
    console.error('   Command:', error.command);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testEmail();
