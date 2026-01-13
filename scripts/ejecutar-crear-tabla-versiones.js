/**
 * Script para ejecutar el script SQL que crea la tabla de versiones
 * CRM Farmadescanso - Sistema de Gestión de Versiones
 * 
 * Uso: node scripts/ejecutar-crear-tabla-versiones.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
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

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'farmadescanso',
  charset: 'utf8mb4',
  multipleStatements: true // Permitir múltiples sentencias SQL
};

async function ejecutarScriptSQL() {
  let connection;
  
  try {
    console.log(`${colors.cyan}🚀 Iniciando creación de tabla de versiones...${colors.reset}\n`);
    
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'crear-tabla-versiones.sql');
    console.log(`${colors.blue}📖 Leyendo archivo SQL: ${sqlPath}${colors.reset}`);
    
    if (!fs.existsSync(sqlPath)) {
      console.error(`${colors.red}❌ Error: No se encontró el archivo SQL${colors.reset}`);
      process.exit(1);
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log(`${colors.green}✓ Archivo SQL leído correctamente${colors.reset}\n`);
    
    // Conectar a la base de datos
    console.log(`${colors.cyan}📡 Conectando a MySQL...${colors.reset}`);
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Database: ${dbConfig.database}\n`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log(`${colors.green}✓ Conectado a MySQL${colors.reset}\n`);
    
    // Ejecutar todo el SQL de una vez (con multipleStatements: true)
    console.log(`${colors.cyan}⚙️  Ejecutando script SQL...${colors.reset}`);
    
    try {
      // Ejecutar todas las sentencias SQL
      await connection.query(sqlContent);
      console.log(`${colors.green}✓ Script SQL ejecutado correctamente${colors.reset}\n`);
    } catch (error) {
      // Ignorar errores de "ya existe" para CREATE TABLE IF NOT EXISTS
      if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_ENTRY') {
        console.log(`${colors.yellow}⚠️  Advertencia: ${error.message.substring(0, 80)}...${colors.reset}\n`);
      } else {
        throw error; // Re-lanzar otros errores
      }
    }
    
    // Verificar que la tabla se creó correctamente
    console.log(`${colors.cyan}🔍 Verificando tabla de versiones...${colors.reset}`);
    
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'versiones'"
    );
    
    if (tables.length > 0) {
      console.log(`${colors.green}✓ Tabla 'versiones' existe${colors.reset}`);
      
      // Verificar la versión inicial
      const [versiones] = await connection.execute(
        "SELECT * FROM versiones WHERE numero_version = '1.0.0'"
      );
      
      if (versiones.length > 0) {
        console.log(`${colors.green}✓ Versión inicial 1.0.0 creada${colors.reset}`);
        console.log(`   Descripción: ${versiones[0].descripcion}`);
        console.log(`   Tipo: ${versiones[0].tipo_version}`);
        console.log(`   Estable: ${versiones[0].estable ? 'Sí' : 'No'}`);
      }
      
      // Verificar vistas
      const [vistas] = await connection.execute(
        "SHOW FULL TABLES WHERE Table_type = 'VIEW'"
      );
      
      const vistasNombres = vistas.map(v => Object.values(v)[0]);
      if (vistasNombres.includes('v_ultima_version_estable')) {
        console.log(`${colors.green}✓ Vista 'v_ultima_version_estable' creada${colors.reset}`);
      }
      if (vistasNombres.includes('v_version_produccion')) {
        console.log(`${colors.green}✓ Vista 'v_version_produccion' creada${colors.reset}`);
      }
      
      // Probar la vista
      const [ultimaEstable] = await connection.execute(
        "SELECT * FROM v_ultima_version_estable"
      );
      
      if (ultimaEstable.length > 0) {
        console.log(`${colors.green}✓ Vista funciona correctamente${colors.reset}`);
        console.log(`   Última versión estable: ${ultimaEstable[0].numero_version}`);
      }
    } else {
      console.log(`${colors.red}❌ La tabla 'versiones' no se encontró${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`\n${colors.bright}${colors.green}✅ Sistema de versiones creado correctamente${colors.reset}`);
    console.log(`\n${colors.cyan}Próximos pasos:${colors.reset}`);
    console.log(`  1. Consultar versiones: SELECT * FROM versiones;`);
    console.log(`  2. Ver última versión estable: SELECT * FROM v_ultima_version_estable;`);
    console.log(`  3. Ver versión en producción: SELECT * FROM v_version_produccion;`);
    console.log(`  4. Crear nuevas versiones usando: node scripts/crear-nueva-version.js`);
    
  } catch (error) {
    console.error(`\n${colors.red}❌ Error general:${colors.reset}`, error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(`${colors.yellow}   Verifica las credenciales de la base de datos${colors.reset}`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error(`${colors.yellow}   No se pudo conectar a MySQL. Verifica que el servidor esté ejecutándose${colors.reset}`);
    } else {
      console.error(`${colors.red}   Código de error: ${error.code}${colors.reset}`);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log(`\n${colors.blue}🔌 Conexión cerrada${colors.reset}`);
    }
  }
}

// Ejecutar
ejecutarScriptSQL();