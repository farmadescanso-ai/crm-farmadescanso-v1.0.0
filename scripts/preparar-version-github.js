/**
 * Script para preparar la versión actual para subir a GitHub y Vercel
 * CRM Farmadescanso - Preparación de Release v1.0.0
 * 
 * Uso: node scripts/preparar-version-github.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const VERSION = '1.0.0';
const TAG = `v${VERSION}`;

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'farmadescanso',
  charset: 'utf8mb4'
};

function ejecutarComando(comando, descripcion) {
  try {
    console.log(`${colors.cyan}⚙️  ${descripcion}...${colors.reset}`);
    const resultado = execSync(comando, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    if (resultado) {
      console.log(`${colors.green}✓ ${descripcion} completado${colors.reset}`);
      return resultado.trim();
    }
    return '';
  } catch (error) {
    console.error(`${colors.red}❌ Error en: ${descripcion}${colors.reset}`);
    console.error(`${colors.red}   ${error.message}${colors.reset}`);
    return null;
  }
}

async function verificarGit() {
  console.log(`${colors.cyan}🔍 Verificando estado de Git...${colors.reset}\n`);
  
  // Verificar si Git está instalado
  try {
    ejecutarComando('git --version', 'Verificando Git');
  } catch (error) {
    console.error(`${colors.red}❌ Git no está instalado o no está en el PATH${colors.reset}`);
    return false;
  }
  
  // Verificar si es un repositorio Git
  const gitDir = path.join(__dirname, '..', '.git');
  if (!fs.existsSync(gitDir)) {
    console.log(`${colors.yellow}⚠️  No hay repositorio Git inicializado${colors.reset}`);
    console.log(`${colors.cyan}📦 Inicializando repositorio Git...${colors.reset}`);
    
    ejecutarComando('git init', 'Inicializando Git');
    ejecutarComando('git branch -M main', 'Configurando rama main');
    
    console.log(`${colors.green}✓ Repositorio Git inicializado${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✓ Repositorio Git encontrado${colors.reset}\n`);
  }
  
  return true;
}

async function verificarVersionBD() {
  console.log(`${colors.cyan}🔍 Verificando versión en base de datos...${colors.reset}\n`);
  
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Verificar si existe la tabla versiones
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'versiones'"
    );
    
    if (tables.length === 0) {
      console.log(`${colors.yellow}⚠️  La tabla 'versiones' no existe${colors.reset}`);
      console.log(`${colors.cyan}   Ejecuta primero: node scripts/ejecutar-crear-tabla-versiones.js${colors.reset}\n`);
      return false;
    }
    
    // Verificar si la versión 1.0.0 existe
    const [versiones] = await connection.execute(
      "SELECT * FROM versiones WHERE numero_version = ?",
      [VERSION]
    );
    
    if (versiones.length > 0) {
      console.log(`${colors.green}✓ Versión ${VERSION} encontrada en BD${colors.reset}`);
      console.log(`   Descripción: ${versiones[0].descripcion}`);
      console.log(`   Estable: ${versiones[0].estable ? 'Sí' : 'No'}\n`);
      return true;
    } else {
      console.log(`${colors.yellow}⚠️  Versión ${VERSION} no encontrada en BD${colors.reset}`);
      console.log(`${colors.cyan}   Creando versión en BD...${colors.reset}`);
      
      await connection.execute(
        `INSERT INTO versiones (
          numero_version, version_mayor, version_menor, version_revision,
          tipo_version, estable, tag_github, descripcion, creado_por,
          activa_produccion, fecha_estable, fecha_despliegue
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          VERSION, 1, 0, 0,
          'estable', 1, TAG,
          'Versión inicial estable del CRM Farmadescanso',
          'Sistema', 1
        ]
      );
      
      console.log(`${colors.green}✓ Versión ${VERSION} creada en BD${colors.reset}\n`);
      return true;
    }
  } catch (error) {
    console.error(`${colors.red}❌ Error al verificar BD: ${error.message}${colors.reset}\n`);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

function prepararArchivos() {
  console.log(`${colors.cyan}📝 Preparando archivos para commit...${colors.reset}\n`);
  
  // Verificar package.json
  const packagePath = path.join(__dirname, '..', 'package.json');
  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (packageJson.version !== VERSION) {
      console.log(`${colors.yellow}⚠️  Actualizando versión en package.json${colors.reset}`);
      packageJson.version = VERSION;
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`${colors.green}✓ package.json actualizado${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ package.json ya tiene la versión ${VERSION}${colors.reset}`);
    }
  }
  
  console.log('');
}

function hacerCommit() {
  console.log(`${colors.cyan}💾 Preparando commit...${colors.reset}\n`);
  
  // Verificar estado
  const status = ejecutarComando('git status --porcelain', 'Verificando cambios');
  
  if (!status || status.trim() === '') {
    console.log(`${colors.yellow}⚠️  No hay cambios para commitear${colors.reset}\n`);
    return false;
  }
  
  // Agregar todos los archivos
  ejecutarComando('git add .', 'Agregando archivos');
  
  // Hacer commit
  const mensaje = `Versión ${VERSION}: Versión inicial estable del CRM Farmadescanso`;
  ejecutarComando(
    `git commit -m "${mensaje}"`,
    'Haciendo commit'
  );
  
  console.log('');
  return true;
}

function crearTag() {
  console.log(`${colors.cyan}🏷️  Creando tag de versión...${colors.reset}\n`);
  
  // Verificar si el tag ya existe
  const tags = ejecutarComando('git tag -l', 'Verificando tags existentes');
  
  if (tags && tags.includes(TAG)) {
    console.log(`${colors.yellow}⚠️  El tag ${TAG} ya existe${colors.reset}`);
    const respuesta = ejecutarComando(`git tag -d ${TAG}`, 'Eliminando tag local');
    console.log(`${colors.cyan}   Recreando tag...${colors.reset}`);
  }
  
  const mensaje = `Versión ${VERSION}: Versión inicial estable del CRM Farmadescanso`;
  ejecutarComando(
    `git tag -a ${TAG} -m "${mensaje}"`,
    `Creando tag ${TAG}`
  );
  
  console.log('');
  return true;
}

function verificarRemoto() {
  console.log(`${colors.cyan}🔍 Verificando repositorio remoto...${colors.reset}\n`);
  
  try {
    const remotos = ejecutarComando('git remote -v', 'Listando remotos');
    
    if (!remotos || remotos.trim() === '') {
      console.log(`${colors.yellow}⚠️  No hay repositorio remoto configurado${colors.reset}`);
      console.log(`${colors.cyan}   Para configurar GitHub, ejecuta:${colors.reset}`);
      console.log(`${colors.cyan}   git remote add origin <URL_DEL_REPOSITORIO>${colors.reset}\n`);
      return false;
    }
  
    console.log(`${colors.green}✓ Repositorio remoto encontrado:${colors.reset}`);
    console.log(`   ${remotos}\n`);
    return true;
  } catch (error) {
    return false;
  }
}

function instruccionesPush() {
  console.log(`${colors.bright}${colors.green}✅ Preparación completada${colors.reset}\n`);
  console.log(`${colors.cyan}📤 Próximos pasos para subir a GitHub:${colors.reset}\n`);
  console.log(`  1. Verificar el remoto:`);
  console.log(`     ${colors.yellow}git remote -v${colors.reset}\n`);
  console.log(`  2. Subir commits:`);
  console.log(`     ${colors.yellow}git push origin main${colors.reset}\n`);
  console.log(`  3. Subir tags:`);
  console.log(`     ${colors.yellow}git push origin ${TAG}${colors.reset}\n`);
  console.log(`  4. O subir todo (commits y tags):`);
  console.log(`     ${colors.yellow}git push origin main --tags${colors.reset}\n`);
  console.log(`${colors.cyan}🚀 Para desplegar en Vercel:${colors.reset}\n`);
  console.log(`  1. Si tienes Vercel CLI instalado:`);
  console.log(`     ${colors.yellow}vercel --prod${colors.reset}\n`);
  console.log(`  2. O conecta tu repositorio GitHub a Vercel desde el dashboard`);
  console.log(`     ${colors.cyan}https://vercel.com/dashboard${colors.reset}\n`);
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}🚀 Preparando versión ${VERSION} para GitHub y Vercel${colors.reset}\n`);
  console.log(`${colors.cyan}════════════════════════════════════════════════════${colors.reset}\n`);
  
  // 1. Verificar Git
  const gitOk = await verificarGit();
  if (!gitOk) {
    console.error(`${colors.red}❌ No se puede continuar sin Git${colors.reset}`);
    process.exit(1);
  }
  
  // 2. Verificar versión en BD
  await verificarVersionBD();
  
  // 3. Preparar archivos
  prepararArchivos();
  
  // 4. Hacer commit
  hacerCommit();
  
  // 5. Crear tag
  crearTag();
  
  // 6. Verificar remoto
  const remotoOk = verificarRemoto();
  
  // 7. Instrucciones
  console.log(`${colors.cyan}════════════════════════════════════════════════════${colors.reset}\n`);
  instruccionesPush();
  
  if (remotoOk) {
    console.log(`${colors.cyan}💡 Para obtener la URL de Vercel:${colors.reset}`);
    console.log(`   ${colors.yellow}vercel ls${colors.reset} - Lista todos los proyectos`);
    console.log(`   ${colors.yellow}vercel inspect${colors.reset} - Inspecciona el proyecto actual\n`);
  }
}

// Ejecutar
main().catch(error => {
  console.error(`${colors.red}❌ Error fatal:${colors.reset}`, error);
  process.exit(1);
});