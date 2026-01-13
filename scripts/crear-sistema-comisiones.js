// Script para crear el sistema de comisiones y presupuestos
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function crearSistemaComisiones() {
  let connection;
  
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      charset: 'utf8mb4',
      multipleStatements: true // Permitir múltiples statements
    };

    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado a la base de datos\n');

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'crear-sistema-comisiones.sql');
    console.log(`📖 Leyendo archivo SQL: ${sqlFile}`);
    
    let sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Reemplazar IF NOT EXISTS para MySQL (que no lo soporta en ALTER TABLE)
    sql = sql.replace(/ADD COLUMN IF NOT EXISTS/g, 'ADD COLUMN');
    
    // Dividir en statements individuales
    // Primero eliminar comentarios de bloque
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
    
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Filtrar líneas vacías, solo comentarios, o muy cortas
        const clean = s.replace(/--.*$/gm, '').trim();
        return clean.length > 10 && !clean.match(/^USE\s+/i);
      });

    console.log(`📝 Ejecutando ${statements.length} statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Saltar statements muy cortos
      
      try {
        // Detectar el tipo de statement
        const statementType = statement.substring(0, 20).toUpperCase();
        let description = '';
        
        if (statementType.includes('ALTER TABLE')) {
          description = 'Agregando campo fijo_mensual a comerciales';
        } else if (statementType.includes('CREATE TABLE')) {
          const tableMatch = statement.match(/CREATE TABLE.*?(\w+)/i);
          if (tableMatch) {
            description = `Creando tabla: ${tableMatch[1]}`;
          }
        }
        
        console.log(`[${i + 1}/${statements.length}] ${description || 'Ejecutando statement...'}`);
        
        await connection.execute(statement);
        console.log(`✅ ${description || 'Statement ejecutado correctamente'}\n`);
        
      } catch (error) {
        // Si el error es que la columna ya existe o la tabla ya existe, continuar
        if (error.message.includes('Duplicate column name') || 
            error.message.includes('already exists') ||
            error.message.includes('Duplicate key name')) {
          console.log(`⚠️ ${error.message.split('\n')[0]} - Continuando...\n`);
        } else {
          console.error(`❌ Error ejecutando statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n✅ Sistema de comisiones creado exitosamente');
    console.log('\n📋 Tablas creadas:');
    console.log('   - presupuestos (Presupuestos por comercial, artículo y año)');
    console.log('   - comisiones (Comisiones mensuales)');
    console.log('   - comisiones_detalle (Detalle de cálculo de comisiones)');
    console.log('   - rapeles (Rapeles trimestrales por marca)');
    console.log('   - rapeles_configuracion (Configuración de porcentajes de rapel)');
    console.log('\n📋 Campo agregado:');
    console.log('   - comerciales.fijo_mensual (Fijo mensual de cada comercial)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

crearSistemaComisiones();

