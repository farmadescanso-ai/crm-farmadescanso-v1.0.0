/**
 * Script para crear la columna OK_KO en la tabla clientes si no existe
 * Uso: node scripts/crear-columna-okko.js
 */

require('dotenv').config();
const crm = require('../config/mysql-crm');

async function crearColumnaOkKo() {
  try {
    console.log('🔄 Verificando/creando columna OK_KO...');
    
    // Verificar si existe la columna
    const columns = await crm.query('DESCRIBE clientes');
    const tieneOkKo = columns.some(c => c.Field === 'OK_KO' || c.Field === 'OK/KO');
    
    if (!tieneOkKo) {
      console.log('📝 Creando columna OK_KO...');
      await crm.query('ALTER TABLE clientes ADD COLUMN `OK_KO` VARCHAR(2) DEFAULT "OK"');
      console.log('✅ Columna OK_KO creada');
    } else {
      console.log('✅ La columna OK_KO ya existe');
    }
    
    // Verificar si existe OK/KO (con barra)
    const tieneOkKoBarra = columns.some(c => c.Field === 'OK/KO');
    if (!tieneOkKoBarra) {
      console.log('📝 Creando columna OK/KO...');
      await crm.query('ALTER TABLE clientes ADD COLUMN `OK/KO` VARCHAR(2) DEFAULT "OK"');
      console.log('✅ Columna OK/KO creada');
    } else {
      console.log('✅ La columna OK/KO ya existe');
    }
    
    // Poner todos los clientes en OK
    console.log('🔄 Actualizando todos los clientes a estado OK...');
    await crm.query('UPDATE clientes SET `OK_KO` = "OK", `OK/KO` = "OK"');
    
    const result = await crm.query('SELECT COUNT(*) as total FROM clientes');
    console.log(`✅ Todos los clientes actualizados a estado OK (Total: ${result[0].total})`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

crearColumnaOkKo();

