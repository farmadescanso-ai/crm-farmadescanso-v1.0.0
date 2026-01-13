/**
 * Script de ayuda para crear una nueva versión
 * CRM Farmadescanso - Sistema de Gestión de Versiones
 * 
 * Uso: node scripts/crear-nueva-version.js <numero_version> <descripcion> [tipo_version]
 * 
 * Ejemplos:
 *   node scripts/crear-nueva-version.js 1.1.0 "Añadida exportación de reportes" desarrollo
 *   node scripts/crear-nueva-version.js 1.0.1 "Corrección bug crítico" hotfix
 */

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

// Obtener argumentos de la línea de comandos
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(`${colors.red}Error: Faltan argumentos requeridos${colors.reset}`);
  console.log(`\nUso: node scripts/crear-nueva-version.js <numero_version> <descripcion> [tipo_version]`);
  console.log(`\nEjemplos:`);
  console.log(`  node scripts/crear-nueva-version.js 1.1.0 "Añadida exportación de reportes" desarrollo`);
  console.log(`  node scripts/crear-nueva-version.js 1.0.1 "Corrección bug crítico" hotfix`);
  console.log(`  node scripts/crear-nueva-version.js 2.0.0 "Refactorización completa" estable`);
  process.exit(1);
}

const numeroVersion = args[0];
const descripcion = args[1];
const tipoVersion = args[2] || 'desarrollo';

// Validar formato de versión (MAYOR.MENOR.REVISIÓN)
const versionRegex = /^(\d+)\.(\d+)\.(\d+)$/;
const match = numeroVersion.match(versionRegex);

if (!match) {
  console.error(`${colors.red}Error: Formato de versión inválido. Use formato: MAYOR.MENOR.REVISIÓN (ej: 1.0.0)${colors.reset}`);
  process.exit(1);
}

const versionMayor = parseInt(match[1]);
const versionMenor = parseInt(match[2]);
const versionRevision = parseInt(match[3]);

// Validar tipo de versión
const tiposValidos = ['desarrollo', 'beta', 'estable', 'hotfix'];
if (!tiposValidos.includes(tipoVersion)) {
  console.error(`${colors.red}Error: Tipo de versión inválido. Use uno de: ${tiposValidos.join(', ')}${colors.reset}`);
  process.exit(1);
}

const tagGitHub = `v${numeroVersion}`;

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'farmadescanso',
  charset: 'utf8mb4'
};

async function crearVersion() {
  let connection;

  try {
    console.log(`${colors.cyan}Conectando a la base de datos...${colors.reset}`);
    connection = await mysql.createConnection(dbConfig);

    // Verificar si la versión ya existe
    const [existentes] = await connection.execute(
      'SELECT numero_version FROM versiones WHERE numero_version = ?',
      [numeroVersion]
    );

    if (existentes.length > 0) {
      console.error(`${colors.red}Error: La versión ${numeroVersion} ya existe en la base de datos${colors.reset}`);
      process.exit(1);
    }

    // Verificar si el tag ya existe
    const [tagsExistentes] = await connection.execute(
      'SELECT tag_github FROM versiones WHERE tag_github = ?',
      [tagGitHub]
    );

    if (tagsExistentes.length > 0) {
      console.error(`${colors.red}Error: El tag ${tagGitHub} ya existe en la base de datos${colors.reset}`);
      process.exit(1);
    }

    // Determinar si es estable (solo si tipo_version es 'estable' o si se especifica explícitamente)
    const esEstable = tipoVersion === 'estable' ? 1 : 0;

    // Insertar nueva versión
    const [result] = await connection.execute(
      `INSERT INTO versiones (
        numero_version,
        version_mayor,
        version_menor,
        version_revision,
        tipo_version,
        estable,
        tag_github,
        descripcion,
        creado_por,
        activa_produccion,
        rollback_disponible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numeroVersion,
        versionMayor,
        versionMenor,
        versionRevision,
        tipoVersion,
        esEstable,
        tagGitHub,
        descripcion,
        process.env.USER || 'Sistema',
        0, // No activa en producción por defecto
        1  // Rollback disponible por defecto
      ]
    );

    console.log(`${colors.green}✓ Versión creada exitosamente${colors.reset}`);
    console.log(`\n${colors.bright}Detalles de la versión:${colors.reset}`);
    console.log(`  Número: ${colors.cyan}${numeroVersion}${colors.reset}`);
    console.log(`  Tipo: ${colors.yellow}${tipoVersion}${colors.reset}`);
    console.log(`  Tag GitHub: ${colors.blue}${tagGitHub}${colors.reset}`);
    console.log(`  Estable: ${esEstable ? colors.green + 'Sí' : colors.yellow + 'No' + colors.reset}`);
    console.log(`  Descripción: ${descripcion}`);
    console.log(`\n${colors.yellow}Próximos pasos:${colors.reset}`);
    console.log(`  1. Actualizar package.json con la versión ${numeroVersion}`);
    console.log(`  2. Hacer commit de los cambios`);
    console.log(`  3. Crear tag en GitHub: git tag -a ${tagGitHub} -m "${descripcion}"`);
    console.log(`  4. Subir a GitHub: git push origin main && git push origin ${tagGitHub}`);
    console.log(`  5. Actualizar el registro con commit_hash después del push`);
    if (esEstable) {
      console.log(`  6. Realizar pruebas antes de marcar como estable`);
      console.log(`  7. Desplegar a producción si corresponde`);
    }

    // Mostrar última versión estable
    const [ultimaEstable] = await connection.execute(
      `SELECT numero_version, fecha_creacion FROM versiones 
       WHERE estable = 1 
       ORDER BY version_mayor DESC, version_menor DESC, version_revision DESC 
       LIMIT 1`
    );

    if (ultimaEstable.length > 0) {
      console.log(`\n${colors.cyan}Última versión estable: ${ultimaEstable[0].numero_version}${colors.reset}`);
    }

  } catch (error) {
    console.error(`${colors.red}Error al crear la versión:${colors.reset}`, error.message);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error(`${colors.yellow}La tabla 'versiones' no existe. Ejecuta primero el script: scripts/crear-tabla-versiones.sql${colors.reset}`);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
crearVersion();