require('dotenv').config();
const crm = require('../config/mysql-crm');

async function crearTablaPasswordReset() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    console.log('🔍 Verificando si existe la tabla password_reset_tokens...\n');
    
    try {
      // Intentar consultar la tabla para ver si existe
      await crm.query('SELECT 1 FROM password_reset_tokens LIMIT 1');
      console.log('✅ La tabla password_reset_tokens ya existe\n');
    } catch (error) {
      console.log('⚠️ La tabla no existe. Creándola...\n');
      
      // Crear la tabla
      const sql = `
        CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`comercial_id\` int(11) NOT NULL,
          \`token\` varchar(255) NOT NULL,
          \`email\` varchar(255) NOT NULL,
          \`expires_at\` datetime NOT NULL,
          \`used\` tinyint(1) DEFAULT 0,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`idx_token\` (\`token\`),
          KEY \`idx_comercial_id\` (\`comercial_id\`),
          KEY \`idx_email\` (\`email\`),
          KEY \`idx_expires_at\` (\`expires_at\`),
          CONSTRAINT \`fk_password_reset_comercial\` FOREIGN KEY (\`comercial_id\`) REFERENCES \`comerciales\` (\`Id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      
      await crm.query(sql);
      console.log('✅ Tabla password_reset_tokens creada correctamente\n');
    }
    
    // Verificar estructura
    console.log('📋 Estructura de la tabla:');
    const estructura = await crm.query('DESCRIBE password_reset_tokens');
    estructura.forEach(col => {
      console.log(`   ${col.Field.padEnd(20)} ${col.Type.padEnd(20)} ${col.Null} ${col.Key}`);
    });
    
    console.log('\n✅ Proceso completado correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Intentar crear sin foreign key si falla
    if (error.message.includes('foreign key') || error.message.includes('FOREIGN KEY')) {
      console.log('\n⚠️ Error con foreign key. Intentando crear sin constraint...\n');
      try {
        const sqlSimple = `
          CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
            \`id\` int(11) NOT NULL AUTO_INCREMENT,
            \`comercial_id\` int(11) NOT NULL,
            \`token\` varchar(255) NOT NULL,
            \`email\` varchar(255) NOT NULL,
            \`expires_at\` datetime NOT NULL,
            \`used\` tinyint(1) DEFAULT 0,
            \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            UNIQUE KEY \`idx_token\` (\`token\`),
            KEY \`idx_comercial_id\` (\`comercial_id\`),
            KEY \`idx_email\` (\`email\`),
            KEY \`idx_expires_at\` (\`expires_at\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;
        await crm.query(sqlSimple);
        console.log('✅ Tabla creada sin foreign key constraint\n');
        process.exit(0);
      } catch (error2) {
        console.error('❌ Error creando tabla sin constraint:', error2.message);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
}

crearTablaPasswordReset();
