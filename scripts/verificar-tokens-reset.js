require('dotenv').config();
const crm = require('../config/mysql-crm');

async function verificarTokens() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    const tokens = await crm.query("SELECT * FROM password_reset_tokens WHERE email = 'paco@fralabu.com' ORDER BY created_at DESC LIMIT 5");
    console.log('Tokens encontrados:', tokens.length);
    
    if (tokens.length > 0) {
      tokens.forEach((t, i) => {
        console.log(`\nToken ${i+1}:`);
        console.log('  ID:', t.id);
        console.log('  Email:', t.email);
        console.log('  Token:', t.token.substring(0, 20) + '...');
        console.log('  Expira:', t.expires_at);
        console.log('  Usado:', t.used);
        console.log('  Creado:', t.created_at);
      });
    } else {
      console.log('\n⚠️ No se encontraron tokens para este email');
      console.log('   Esto significa que el proceso de recuperación no se completó o hubo un error');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verificarTokens();
