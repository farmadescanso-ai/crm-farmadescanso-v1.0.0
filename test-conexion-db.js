// Script para verificar la conexión a la base de datos y probar operaciones críticas
const crm = require('./config/mysql-crm');

async function testOperaciones() {
  try {
    console.log('🔍 [TEST] Conectando a la base de datos...');
    await crm.connect();
    console.log('✅ [TEST] Conectado correctamente\n');

    // Test 1: Obtener artículos
    console.log('📦 [TEST] Test 1: Obteniendo artículos...');
    const inicioArticulos = Date.now();
    try {
      const articulos = await Promise.race([
        crm.getArticulos(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (10s)')), 10000))
      ]);
      const tiempoArticulos = Date.now() - inicioArticulos;
      console.log(`✅ [TEST] Artículos obtenidos en ${tiempoArticulos}ms (total: ${articulos?.length || 0})`);
    } catch (error) {
      console.error(`❌ [TEST] Error obteniendo artículos: ${error.message}`);
    }

    // Test 2: Obtener siguiente número de pedido
    console.log('\n📝 [TEST] Test 2: Obteniendo siguiente número de pedido...');
    const inicioNumero = Date.now();
    try {
      const numero = await Promise.race([
        crm.getNextNumeroPedido(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (5s)')), 5000))
      ]);
      const tiempoNumero = Date.now() - inicioNumero;
      console.log(`✅ [TEST] Siguiente número obtenido en ${tiempoNumero}ms: ${numero}`);
    } catch (error) {
      console.error(`❌ [TEST] Error obteniendo número: ${error.message}`);
    }

    // Test 3: Obtener formas de pago
    console.log('\n💳 [TEST] Test 3: Obteniendo formas de pago...');
    const inicioFormasPago = Date.now();
    try {
      const formasPago = await Promise.race([
        crm.getFormasPago(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (5s)')), 5000))
      ]);
      const tiempoFormasPago = Date.now() - inicioFormasPago;
      console.log(`✅ [TEST] Formas de pago obtenidas en ${tiempoFormasPago}ms (total: ${formasPago?.length || 0})`);
      if (formasPago && formasPago.length > 0) {
        console.log(`   Primera forma de pago: ID=${formasPago[0].Id}, Nombre=${formasPago[0].Nombre}`);
      }
    } catch (error) {
      console.error(`❌ [TEST] Error obteniendo formas de pago: ${error.message}`);
    }

    // Test 4: Obtener cooperativas por cliente
    console.log('\n🔗 [TEST] Test 4: Obteniendo cooperativas del cliente 808...');
    const inicioCoop = Date.now();
    try {
      const cooperativas = await Promise.race([
        crm.getCooperativasByClienteId(808),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (10s)')), 10000))
      ]);
      const tiempoCoop = Date.now() - inicioCoop;
      console.log(`✅ [TEST] Cooperativas obtenidas en ${tiempoCoop}ms (total: ${cooperativas?.length || 0})`);
    } catch (error) {
      console.error(`❌ [TEST] Error obteniendo cooperativas: ${error.message}`);
    }

    // Test 5: Query simple
    console.log('\n🔍 [TEST] Test 5: Ejecutando query simple...');
    const inicioQuery = Date.now();
    try {
      const resultado = await Promise.race([
        crm.query('SELECT COUNT(*) as total FROM pedidos'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (5s)')), 5000))
      ]);
      const tiempoQuery = Date.now() - inicioQuery;
      console.log(`✅ [TEST] Query ejecutada en ${tiempoQuery}ms`);
      console.log(`   Resultado: ${resultado[0]?.total || 0} pedidos en la base de datos`);
    } catch (error) {
      console.error(`❌ [TEST] Error ejecutando query: ${error.message}`);
    }

    await crm.disconnect();
    console.log('\n✅ [TEST] Todas las pruebas completadas');
  } catch (error) {
    console.error('❌ [TEST] Error general:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testOperaciones();

