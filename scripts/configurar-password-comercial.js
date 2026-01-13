/**
 * Script para configurar la contraseña del comercial
 * 
 * Este script verifica y configura la contraseña para el comercial paco@fralabu.com
 * 
 * Uso: node scripts/configurar-password-comercial.js
 */

const crm = require('../config/mysql-crm');

async function configurarPassword() {
  try {
    console.log('🔧 Configurando contraseña para comercial...\n');
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Email del comercial
    const email = 'paco@fralabu.com';
    const password = '27451524N'; // DNI como contraseña
    
    console.log('🔍 Buscando comercial...');
    console.log(`   Email: ${email}`);
    
    // Buscar comercial
    const comercial = await crm.getComercialByEmail(email);
    
    if (!comercial) {
      console.log('❌ ERROR: Comercial no encontrado');
      console.log(`   Email buscado: ${email}`);
      process.exit(1);
    }
    
    console.log('✅ Comercial encontrado:');
    console.log(`   ID: ${comercial.Id || comercial.id}`);
    console.log(`   Nombre: ${comercial.Nombre || comercial.nombre}`);
    console.log(`   Email: ${comercial.Email || comercial.email}`);
    console.log(`   DNI: ${comercial.DNI || comercial.dni || 'No disponible'}\n`);
    
    // Verificar campos disponibles
    console.log('📋 Campos disponibles en el comercial:');
    const campos = Object.keys(comercial);
    campos.forEach(campo => {
      const valor = comercial[campo];
      if (valor !== null && valor !== undefined && valor !== '') {
        console.log(`   - ${campo}: ${valor}`);
      }
    });
    console.log('');
    
    // Verificar campos de contraseña
    const passwordFields = {
      password: comercial.password,
      Password: comercial.Password,
      contraseña: comercial.contraseña,
      Contraseña: comercial.Contraseña,
      DNI: comercial.DNI,
      dni: comercial.dni,
      Dni: comercial.Dni
    };
    
    console.log('🔑 Verificando campos de contraseña:');
    let tienePassword = false;
    let campoPassword = null;
    let valorPassword = null;
    
    for (const [campo, valor] of Object.entries(passwordFields)) {
      if (valor !== null && valor !== undefined && valor !== '') {
        console.log(`   ✅ ${campo}: ${valor}`);
        tienePassword = true;
        if (!campoPassword) {
          campoPassword = campo;
          valorPassword = valor;
        }
      } else {
        console.log(`   ❌ ${campo}: vacío o null`);
      }
    }
    console.log('');
    
    if (tienePassword) {
      console.log('✅ El comercial ya tiene contraseña configurada:');
      console.log(`   Campo: ${campoPassword}`);
      console.log(`   Valor: ${valorPassword}`);
      console.log('\n✅ No se requiere configuración adicional');
    } else {
      console.log('⚠️  El comercial NO tiene contraseña configurada');
      console.log('🔧 Configurando contraseña...\n');
      
      // Intentar usar DNI como contraseña
      const dni = comercial.DNI || comercial.dni || comercial.Dni;
      
      if (dni) {
        console.log(`   Usando DNI como contraseña: ${dni}`);
        
        // Intentar actualizar el campo DNI si existe
        const comercialId = comercial.Id || comercial.id;
        
        // Verificar qué columnas existen en la tabla
        const columnas = await crm.query('SHOW COLUMNS FROM comerciales');
        const nombresColumnas = columnas.map(col => col.Field || col.field);
        
        console.log('\n📋 Columnas disponibles en la tabla comerciales:');
        nombresColumnas.forEach(col => console.log(`   - ${col}`));
        console.log('');
        
        // Intentar actualizar el campo password o DNI
        let sqlUpdate = null;
        let valores = [];
        
        if (nombresColumnas.includes('password')) {
          sqlUpdate = 'UPDATE comerciales SET password = ? WHERE id = ?';
          valores = [dni, comercialId];
          console.log('   ✅ Usando columna "password"');
        } else if (nombresColumnas.includes('Password')) {
          sqlUpdate = 'UPDATE comerciales SET Password = ? WHERE id = ?';
          valores = [dni, comercialId];
          console.log('   ✅ Usando columna "Password"');
        } else if (nombresColumnas.includes('DNI')) {
          // Si DNI ya existe, solo verificar que tenga valor
          if (!dni || dni === '') {
            console.log('   ⚠️  DNI está vacío, no se puede usar como contraseña');
          } else {
            console.log('   ✅ DNI ya tiene valor, se usará como contraseña');
            console.log('   ℹ️  El sistema buscará en el campo DNI para la autenticación');
          }
        } else {
          console.log('   ⚠️  No se encontró columna de contraseña');
          console.log('   💡 Se recomienda crear una columna "password" o "Password"');
        }
        
        if (sqlUpdate) {
          await crm.query(sqlUpdate, valores);
          console.log(`\n✅ Contraseña configurada correctamente en el campo "${sqlUpdate.includes('password') ? 'password' : 'Password'}"`);
        } else {
          console.log('\n⚠️  No se pudo configurar automáticamente');
          console.log('   El sistema usará el campo DNI para autenticación si tiene valor');
        }
      } else {
        console.log('❌ ERROR: No se encontró DNI para usar como contraseña');
        console.log('   Por favor, configura manualmente una contraseña en la base de datos');
      }
    }
    
    console.log('\n✅ Proceso completado');
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
configurarPassword();

