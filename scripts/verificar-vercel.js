/**
 * Script para verificar el estado del despliegue en Vercel
 * 
 * Este script verifica:
 * 1. La configuración de Vercel (vercel.json)
 * 2. El estado del repositorio Git
 * 3. Los archivos necesarios para el despliegue
 * 4. La configuración del servidor
 * 
 * Uso: node scripts/verificar-vercel.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración para Vercel...\n');

let errores = [];
let advertencias = [];
let exitos = [];

// 1. Verificar vercel.json
console.log('1️⃣ Verificando vercel.json...');
try {
  const vercelJsonPath = path.join(__dirname, '..', 'vercel.json');
  if (fs.existsSync(vercelJsonPath)) {
    const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    
    // Verificar que apunta al archivo correcto
    if (vercelJson.builds && vercelJson.builds[0] && vercelJson.builds[0].src === 'server-crm-completo.js') {
      exitos.push('✅ vercel.json apunta a server-crm-completo.js');
    } else {
      errores.push('❌ vercel.json no apunta a server-crm-completo.js');
    }
    
    // Verificar rutas
    if (vercelJson.routes && vercelJson.routes[0] && vercelJson.routes[0].dest === 'server-crm-completo.js') {
      exitos.push('✅ vercel.json tiene rutas configuradas correctamente');
    } else {
      advertencias.push('⚠️ vercel.json podría no tener rutas configuradas correctamente');
    }
    
    // Verificar NODE_ENV
    if (vercelJson.env && vercelJson.env.NODE_ENV === 'production') {
      exitos.push('✅ vercel.json tiene NODE_ENV=production');
    } else {
      advertencias.push('⚠️ vercel.json no tiene NODE_ENV=production (se puede configurar en Vercel Dashboard)');
    }
  } else {
    errores.push('❌ vercel.json no existe');
  }
} catch (error) {
  errores.push(`❌ Error leyendo vercel.json: ${error.message}`);
}

// 2. Verificar server-crm-completo.js
console.log('2️⃣ Verificando server-crm-completo.js...');
try {
  const serverPath = path.join(__dirname, '..', 'server-crm-completo.js');
  if (fs.existsSync(serverPath)) {
    exitos.push('✅ server-crm-completo.js existe');
    
    // Verificar que tiene la configuración de trust proxy
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    if (serverContent.includes('trust proxy')) {
      exitos.push('✅ server-crm-completo.js tiene configuración de trust proxy');
    } else {
      advertencias.push('⚠️ server-crm-completo.js podría no tener trust proxy configurado');
    }
    
    // Verificar configuración de sesiones
    if (serverContent.includes('express-session')) {
      exitos.push('✅ server-crm-completo.js usa express-session');
    } else {
      errores.push('❌ server-crm-completo.js no usa express-session');
    }
    
    // Verificar configuración de cookies seguras
    if (serverContent.includes('secure') && serverContent.includes('isProduction')) {
      exitos.push('✅ server-crm-completo.js tiene configuración de cookies seguras para producción');
    } else {
      advertencias.push('⚠️ server-crm-completo.js podría no tener configuración de cookies seguras');
    }
  } else {
    errores.push('❌ server-crm-completo.js no existe');
  }
} catch (error) {
  errores.push(`❌ Error verificando server-crm-completo.js: ${error.message}`);
}

// 3. Verificar package.json
console.log('3️⃣ Verificando package.json...');
try {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Verificar que tiene el script start
    if (packageJson.scripts && packageJson.scripts.start) {
      exitos.push('✅ package.json tiene script start');
    } else {
      errores.push('❌ package.json no tiene script start');
    }
    
    // Verificar dependencias importantes
    const dependenciasRequeridas = ['express', 'express-session', 'ejs'];
    const dependencias = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    dependenciasRequeridas.forEach(dep => {
      if (dependencias[dep]) {
        exitos.push(`✅ package.json tiene dependencia ${dep}`);
      } else {
        errores.push(`❌ package.json no tiene dependencia ${dep}`);
      }
    });
  } else {
    errores.push('❌ package.json no existe');
  }
} catch (error) {
  errores.push(`❌ Error verificando package.json: ${error.message}`);
}

// 4. Verificar config/farmadescaso-crm.js
console.log('4️⃣ Verificando config/farmadescaso-crm.js...');
try {
  const configPath = path.join(__dirname, '..', 'config', 'farmadescaso-crm.js');
  if (fs.existsSync(configPath)) {
    exitos.push('✅ config/farmadescaso-crm.js existe');
    
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Verificar que tiene el método createCliente
    if (configContent.includes('createCliente')) {
      exitos.push('✅ config/farmadescaso-crm.js tiene método createCliente');
    } else {
      advertencias.push('⚠️ config/farmadescaso-crm.js podría no tener método createCliente');
    }
    
    // Verificar configuración de NocoDB
    if (configContent.includes('baseUrl') && configContent.includes('apiToken')) {
      exitos.push('✅ config/farmadescaso-crm.js tiene configuración de NocoDB');
    } else {
      errores.push('❌ config/farmadescaso-crm.js no tiene configuración de NocoDB');
    }
  } else {
    errores.push('❌ config/farmadescaso-crm.js no existe');
  }
} catch (error) {
  errores.push(`❌ Error verificando config/farmadescaso-crm.js: ${error.message}`);
}

// 5. Verificar Git
console.log('5️⃣ Verificando estado de Git...');
try {
  const { execSync } = require('child_process');
  
  // Verificar que estamos en un repositorio Git
  try {
    const gitRemote = execSync('git remote get-url origin', { encoding: 'utf8', stdio: 'pipe' });
    exitos.push(`✅ Repositorio Git configurado: ${gitRemote.trim()}`);
  } catch (error) {
    advertencias.push('⚠️ No se pudo verificar el repositorio Git remoto');
  }
  
  // Verificar último commit
  try {
    const lastCommit = execSync('git log -1 --oneline', { encoding: 'utf8', stdio: 'pipe' });
    exitos.push(`✅ Último commit: ${lastCommit.trim()}`);
  } catch (error) {
    advertencias.push('⚠️ No se pudo verificar el último commit');
  }
  
  // Verificar si hay cambios sin commitear
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8', stdio: 'pipe' });
    if (gitStatus.trim() === '') {
      exitos.push('✅ No hay cambios sin commitear');
    } else {
      advertencias.push('⚠️ Hay cambios sin commitear (considera hacer commit y push)');
    }
  } catch (error) {
    advertencias.push('⚠️ No se pudo verificar el estado de Git');
  }
} catch (error) {
  advertencias.push('⚠️ No se pudo verificar Git (puede que no esté instalado)');
}

// 6. Verificar archivos de views
console.log('6️⃣ Verificando archivos de views...');
try {
  const viewsPath = path.join(__dirname, '..', 'views');
  if (fs.existsSync(viewsPath)) {
    exitos.push('✅ Directorio views existe');
    
    // Verificar archivos importantes
    const archivosImportantes = ['auth/login.ejs', 'dashboard/index.ejs'];
    archivosImportantes.forEach(archivo => {
      const archivoPath = path.join(viewsPath, archivo);
      if (fs.existsSync(archivoPath)) {
        exitos.push(`✅ ${archivo} existe`);
      } else {
        advertencias.push(`⚠️ ${archivo} no existe`);
      }
    });
  } else {
    errores.push('❌ Directorio views no existe');
  }
} catch (error) {
  errores.push(`❌ Error verificando views: ${error.message}`);
}

// Mostrar resumen
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN DE VERIFICACIÓN');
console.log('='.repeat(60));

if (exitos.length > 0) {
  console.log('\n✅ Éxitos:');
  exitos.forEach(msg => console.log(`  ${msg}`));
}

if (advertencias.length > 0) {
  console.log('\n⚠️ Advertencias:');
  advertencias.forEach(msg => console.log(`  ${msg}`));
}

if (errores.length > 0) {
  console.log('\n❌ Errores:');
  errores.forEach(msg => console.log(`  ${msg}`));
}

console.log('\n' + '='.repeat(60));

// Resultado final
if (errores.length === 0) {
  console.log('✅ La configuración parece correcta para Vercel');
  console.log('\n📋 Próximos pasos:');
  console.log('1. Verifica que el proyecto está conectado a Vercel');
  console.log('2. Ve a https://vercel.com/dashboard');
  console.log('3. Busca tu proyecto y verifica el último despliegue');
  console.log('4. Revisa los logs si hay errores');
  console.log('5. Prueba el login con: paco@fralabu.com / 27451524N');
  process.exit(0);
} else {
  console.log('❌ Hay errores que deben corregirse antes del despliegue');
  process.exit(1);
}

