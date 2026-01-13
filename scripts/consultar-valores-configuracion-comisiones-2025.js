// =====================================================
// SCRIPT PARA CONSULTAR VALORES ACTUALES DE 2025
// =====================================================
// Este script consulta los valores que se están usando en 2025
// para poder compararlos y configurar los de 2026
// =====================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

async function consultarValores2025() {
  let connection;
  
  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      charset: 'utf8mb4'
    });

    console.log('✅ Conectado a la base de datos\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 VALORES ACTUALES DEL CÓDIGO (HARDCODEADOS)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // =====================================================
    // 1. CONFIGURACIÓN DE COMISIONES POR TIPO DE PEDIDO
    // =====================================================
    console.log('1️⃣  CONFIGURACIÓN DE COMISIONES POR TIPO DE PEDIDO');
    console.log('─────────────────────────────────────────────────────────');
    console.log('   • Transfer (incluye "transfer" en el nombre): 5%');
    console.log('   • Directo/Normal: 15%');
    console.log('   • Por defecto (si no se especifica tipo): 15%\n');

    // Consultar tipos de pedidos existentes
    const [tiposPedido] = await connection.execute('SELECT * FROM tipos_pedidos ORDER BY id');
    console.log('   📋 Tipos de pedidos existentes en la BD:');
    tiposPedido.forEach(tipo => {
      const porcentaje = tipo.Tipo.toLowerCase().includes('transfer') ? '5%' : '15%';
      console.log(`      - ID ${tipo.id}: "${tipo.Tipo}" → ${porcentaje}`);
    });
    console.log('');

    // =====================================================
    // 2. CONFIGURACIÓN DE RAPPEL POR PRESUPUESTO
    // =====================================================
    console.log('2️⃣  CONFIGURACIÓN DE RAPPEL POR PRESUPUESTO');
    console.log('─────────────────────────────────────────────────────────');
    console.log('   • Porcentaje de rappel: 1%');
    console.log('   • Se aplica sobre: Ventas acumuladas del trimestre');
    console.log('   • Condición: Solo si Ventas > Presupuesto acumulado del trimestre\n');

    // Consultar si hay datos de presupuestos y comisiones del 2025
    const [comisiones2025] = await connection.execute(
      'SELECT COUNT(*) as total FROM comisiones WHERE año = 2025'
    );
    console.log(`   📊 Comisiones calculadas en 2025: ${comisiones2025[0].total}`);
    
    const [presupuestos2025] = await connection.execute(
      'SELECT COUNT(*) as total FROM presupuestos WHERE año = 2025'
    );
    console.log(`   📊 Presupuestos configurados en 2025: ${presupuestos2025[0].total}\n`);

    // =====================================================
    // 3. CONFIGURACIÓN DE RAPPEL POR MARCA
    // =====================================================
    console.log('3️⃣  CONFIGURACIÓN DE RAPPEL POR MARCA');
    console.log('─────────────────────────────────────────────────────────');
    console.log('   • 80% - 99% de cumplimiento: 2% sobre el exceso');
    console.log('   • 100% - 119% de cumplimiento: 3% sobre el exceso');
    console.log('   • 120% o más de cumplimiento: 5% sobre el exceso\n');

    // Consultar configuración de rapeles por marca
    const [rapelesConfig] = await connection.execute(
      'SELECT * FROM rapeles_configuracion WHERE activo = 1 ORDER BY porcentaje_cumplimiento_min'
    );
    if (rapelesConfig.length > 0) {
      console.log('   📋 Configuración actual en BD (tabla rapeles_configuracion):');
      rapelesConfig.forEach(config => {
        console.log(`      - ${config.marca || 'Todas'}: ${config.porcentaje_cumplimiento_min}% - ${config.porcentaje_cumplimiento_max}% → ${config.porcentaje_rapel}%`);
      });
      console.log('');
    } else {
      console.log('   ⚠️  No hay configuración en la tabla rapeles_configuracion\n');
    }

    // =====================================================
    // 4. CONFIGURACIÓN DE FIJO MENSUAL
    // =====================================================
    console.log('4️⃣  CONFIGURACIÓN DE FIJO MENSUAL');
    console.log('─────────────────────────────────────────────────────────');
    console.log('   • Año límite: 2026 (inclusive)');
    console.log('   • Hasta 2026: Se paga siempre');
    console.log('   • A partir de 2027: Solo se paga si ventas mensuales ≥ 25% del presupuesto mensual\n');

    // Consultar fijos mensuales de comerciales
    const [comercialesConFijo] = await connection.execute(
      'SELECT id, Nombre, fijo_mensual FROM comerciales WHERE fijo_mensual > 0'
    );
    if (comercialesConFijo.length > 0) {
      console.log('   📋 Comerciales con fijo mensual configurado:');
      comercialesConFijo.forEach(comercial => {
        console.log(`      - ${comercial.Nombre} (ID: ${comercial.id}): ${comercial.fijo_mensual}€`);
      });
      console.log('');
    }

    // =====================================================
    // 5. CONFIGURACIÓN DE DESCUENTO DE TRANSPORTE
    // =====================================================
    console.log('5️⃣  CONFIGURACIÓN DE DESCUENTO DE TRANSPORTE');
    console.log('─────────────────────────────────────────────────────────');
    console.log('   • Porcentaje de descuento: 10%');
    console.log('   • Se aplica sobre: El importe de transporte (diferencia entre TotalPedido y BaseImponible + TotalIva)');
    console.log('   • Se distribuye: Proporcionalmente en cada línea del pedido\n');

    // =====================================================
    // RESUMEN DE VALORES PARA 2026
    // =====================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 RESUMEN: VALORES PROPUESTOS PARA 2026');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('1. Comisiones por Tipo de Pedido:');
    console.log('   • Transfer: 5%');
    console.log('   • Directo/Normal: 15%\n');
    
    console.log('2. Rappel por Presupuesto:');
    console.log('   • Porcentaje: 1% sobre ventas acumuladas del trimestre\n');
    
    console.log('3. Rappel por Marca:');
    console.log('   • 80-99%: 2%');
    console.log('   • 100-119%: 3%');
    console.log('   • 120%+: 5%\n');
    
    console.log('4. Fijo Mensual:');
    console.log('   • Año límite: 2026');
    console.log('   • % mínimo ventas: 25%\n');
    
    console.log('5. Descuento Transporte:');
    console.log('   • Porcentaje: 10%\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Consulta completada');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar la consulta
consultarValores2025();
