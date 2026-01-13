/**
 * Script para probar el login con las credenciales proporcionadas
 * 
 * Este script verifica:
 * 1. Que el comercial existe en la base de datos
 * 2. Que las credenciales son correctas
 * 3. Que el login funcionaría correctamente
 * 
 * Uso: node scripts/test-login.js
 */

const crm = require('../config/mysql-crm');

async function testLogin() {
  try {
    console.log('🧪 Probando login con credenciales...\n');
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Credenciales a probar
    const email = 'paco@fralabu.com';
    const password = '27451524N';
    
    console.log('🔍 Buscando comercial...');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}\n`);
    
    // Normalizar email
    const emailNormalizado = String(email).toLowerCase().trim();
    
    // Buscar comercial
    const comercial = await crm.getComercialByEmail(emailNormalizado);
    
    if (!comercial) {
      console.log('❌ ERROR: Comercial no encontrado');
      console.log(`   Email buscado: ${emailNormalizado}`);
      process.exit(1);
    }
    
    console.log('✅ Comercial encontrado:');
    console.log(`   ID: ${comercial.Id || comercial.id}`);
    console.log(`   Nombre: ${comercial.Nombre || comercial.nombre}`);
    console.log(`   Email: ${comercial.Email || comercial.email}`);
    console.log(`   DNI: ${comercial.DNI || comercial.dni || 'No disponible'}\n`);
    
    // Buscar campo de contraseña
    const passwordField = comercial.password || 
                         comercial.Password || 
                         comercial.contraseña || 
                         comercial.Contraseña || 
                         comercial.DNI || 
                         comercial.dni || 
                         null;
    
    console.log('🔑 Verificando contraseña...');
    console.log(`   Campo encontrado: ${passwordField ? 'Sí' : 'No'}`);
    
    if (passwordField) {
      const campoNombre = Object.keys(comercial).find(k => 
        comercial[k] === passwordField && (k.toLowerCase().includes('password') || k.toLowerCase().includes('contraseña') || k.toLowerCase() === 'dni')
      );
      console.log(`   Nombre del campo: ${campoNombre || 'DNI (por defecto)'}`);
      console.log(`   Valor del campo: ${passwordField}\n`);
    } else {
      console.log('❌ ERROR: No se encontró campo de contraseña');
      process.exit(1);
    }
    
    // Comparar contraseñas
    const passwordNormalizada = String(password).trim();
    const passwordFieldNormalizada = passwordField ? String(passwordField).trim() : '';
    
    console.log('🔐 Comparando contraseñas...');
    console.log(`   Contraseña ingresada: "${passwordNormalizada}"`);
    console.log(`   Contraseña en BD: "${passwordFieldNormalizada}"`);
    console.log(`   Coinciden: ${passwordNormalizada === passwordFieldNormalizada ? '✅ SÍ' : '❌ NO'}\n`);
    
    if (passwordNormalizada === passwordFieldNormalizada) {
      console.log('✅ LOGIN EXITOSO');
      console.log('\n📊 Datos que se guardarían en la sesión:');
      console.log(`   ID: ${comercial.Id || comercial.id}`);
      console.log(`   Nombre: ${comercial.Nombre || comercial.nombre}`);
      console.log(`   Email: ${comercial.Email || comercial.email}`);
      console.log(`   Zona: ${comercial.Zona || comercial.zona || 'Sin zona asignada'}`);
      console.log(`   DNI: ${comercial.DNI || comercial.dni || 'No disponible'}`);
      console.log(`   Roll: ${comercial.Roll || comercial.roll || 'Comercial'}\n`);
      
      console.log('✅ El login funcionaría correctamente en la aplicación\n');
      process.exit(0);
    } else {
      console.log('❌ ERROR: Las contraseñas NO coinciden');
      console.log(`   Esperado: "${passwordFieldNormalizada}"`);
      console.log(`   Recibido: "${passwordNormalizada}"`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar la prueba
testLogin();

