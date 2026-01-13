// Script para probar la generación del siguiente número de pedido
const crm = require('../config/mysql-crm');

async function probarGeneracion() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Obtener el siguiente número de pedido
    console.log('📝 Generando siguiente número de pedido...');
    const siguienteNumero = await crm.getNextNumeroPedido();
    console.log(`✅ Siguiente número de pedido: ${siguienteNumero}\n`);

    // Verificar que el formato es correcto
    const formatoCorrecto = /^P\d{2}\d{4}$/.test(siguienteNumero);
    if (formatoCorrecto) {
      console.log('✅ El formato es correcto (P25 + 4 dígitos)');
    } else {
      console.log('⚠️  El formato no es correcto');
    }

    // Verificar que no existe ya
    const [existentes] = await crm.query(
      'SELECT Id FROM pedidos WHERE NumPedido = ?',
      [siguienteNumero]
    );

    if (existentes.length > 0) {
      console.log(`⚠️  El número ${siguienteNumero} ya existe (ID: ${existentes[0].Id})`);
    } else {
      console.log(`✅ El número ${siguienteNumero} está disponible`);
    }

    await crm.disconnect();
    console.log('\n✅ Prueba completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

probarGeneracion();

