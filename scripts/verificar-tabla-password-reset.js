require('dotenv').config();
const crm = require('../config/mysql-crm');

async function verificarTabla() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    const result = await crm.query("SHOW TABLES LIKE 'password_reset_tokens'");
    console.log('Tabla existe:', result.length > 0 ? 'SÍ' : 'NO');
    
    if (result.length > 0) {
      const count = await crm.query('SELECT COUNT(*) as count FROM password_reset_tokens');
      console.log('Registros en la tabla:', count[0].count);
      console.log('\n✅ La tabla está lista para usar');
    } else {
      console.log('❌ La tabla no existe. Ejecuta: node scripts/crear-tabla-password-reset.js');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verificarTabla();
