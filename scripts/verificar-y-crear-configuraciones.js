// Script para verificar y crear la tabla Configuraciones
const mysql = require('mysql2/promise');
require('dotenv').config();

async function verificarYCrearTabla() {
  let connection;
  
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      charset: 'utf8mb4'
    };

    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado a la base de datos');

    // Verificar si la tabla existe
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Configuraciones'
    `, [config.database]);

    if (tables.length > 0) {
      console.log('⚠️  La tabla Configuraciones ya existe');
      
      // Verificar estructura
      const [columns] = await connection.query(`
        SHOW COLUMNS FROM Configuraciones
      `);
      
      console.log('📋 Estructura actual de la tabla:');
      columns.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type})`);
      });
      
      // Verificar si tiene las configuraciones iniciales
      const [configs] = await connection.query(`
        SELECT clave FROM Configuraciones
      `);
      
      console.log(`\n📝 Configuraciones existentes: ${configs.length}`);
      
      // Insertar configuraciones faltantes
      const configuracionesIniciales = [
        ['n8n_webhook_nombre', '', 'Nombre identificativo del webhook de N8N', 'text'],
        ['n8n_webhook_url', '', 'URL del webhook de N8N para comunicación con Holded', 'url'],
        ['n8n_webhook_auth_header_key', '', 'Clave del header de autenticación para el webhook de N8N', 'text'],
        ['n8n_webhook_auth_header_value', '', 'Valor del header de autenticación para el webhook de N8N', 'text'],
        ['n8n_webhook_observaciones', '', 'Observaciones sobre el funcionamiento del webhook de N8N', 'text'],
        ['prestashop_url', '', 'URL de la tienda Prestashop', 'url'],
        ['prestashop_api_key', '', 'Clave API de Prestashop', 'text'],
        ['prestashop_webservice_key', '', 'Clave del webservice de Prestashop', 'text'],
        ['prestashop_observaciones', '', 'Observaciones sobre la configuración de Prestashop', 'text']
      ];
      
      let insertadas = 0;
      for (const [clave, valor, descripcion, tipo] of configuracionesIniciales) {
        try {
          await connection.query(`
            INSERT INTO Configuraciones (clave, valor, descripcion, tipo) 
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
              descripcion = VALUES(descripcion),
              tipo = VALUES(tipo)
          `, [clave, valor, descripcion, tipo]);
          insertadas++;
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') {
            console.error(`❌ Error insertando ${clave}:`, error.message);
          }
        }
      }
      
      console.log(`✅ ${insertadas} configuraciones verificadas/insertadas`);
      
    } else {
      console.log('📝 Creando tabla Configuraciones...');
      
      // Crear la tabla
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`Configuraciones\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`clave\` varchar(100) NOT NULL,
          \`valor\` text,
          \`descripcion\` varchar(255) DEFAULT NULL,
          \`tipo\` varchar(50) DEFAULT 'text',
          \`creado_en\` timestamp DEFAULT CURRENT_TIMESTAMP,
          \`actualizado_en\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_clave\` (\`clave\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      console.log('✅ Tabla creada');
      
      // Insertar configuraciones iniciales
      const configuracionesIniciales = [
        ['n8n_webhook_nombre', '', 'Nombre identificativo del webhook de N8N', 'text'],
        ['n8n_webhook_url', '', 'URL del webhook de N8N para comunicación con Holded', 'url'],
        ['n8n_webhook_auth_header_key', '', 'Clave del header de autenticación para el webhook de N8N', 'text'],
        ['n8n_webhook_auth_header_value', '', 'Valor del header de autenticación para el webhook de N8N', 'text'],
        ['n8n_webhook_observaciones', '', 'Observaciones sobre el funcionamiento del webhook de N8N', 'text'],
        ['prestashop_url', '', 'URL de la tienda Prestashop', 'url'],
        ['prestashop_api_key', '', 'Clave API de Prestashop', 'text'],
        ['prestashop_webservice_key', '', 'Clave del webservice de Prestashop', 'text'],
        ['prestashop_observaciones', '', 'Observaciones sobre la configuración de Prestashop', 'text']
      ];
      
      for (const [clave, valor, descripcion, tipo] of configuracionesIniciales) {
        await connection.query(`
          INSERT INTO Configuraciones (clave, valor, descripcion, tipo) 
          VALUES (?, ?, ?, ?)
        `, [clave, valor, descripcion, tipo]);
      }
      
      console.log('✅ Configuraciones iniciales insertadas');
    }

    console.log('\n✅ Proceso completado exitosamente');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

verificarYCrearTabla();

