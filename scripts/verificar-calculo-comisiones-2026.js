// Script para verificar que el cálculo de comisiones funciona correctamente para 2026
const crm = require('../config/mysql-crm-comisiones');
const calculadorComisiones = require('../utils/calcular-comisiones');

(async () => {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // 1. Verificar configuraciones para 2026
    console.log('🔍 Verificando configuraciones para 2026...');
    const configs = await crm.query(`
      SELECT marca, nombre_tipo_pedido, porcentaje_comision, activo
      FROM config_comisiones_tipo_pedido
      WHERE año_aplicable = 2026
      ORDER BY marca, nombre_tipo_pedido
    `);
    
    console.log(`   Configuraciones encontradas: ${configs.length}`);
    const porMarca = configs.filter(c => c.marca && c.marca !== null);
    const generales = configs.filter(c => !c.marca || c.marca === null);
    console.log(`   - Por marca específica: ${porMarca.length}`);
    console.log(`   - Generales (marca NULL): ${generales.length}`);
    
    if (porMarca.length > 0) {
      console.log('\n   Configuraciones por marca:');
      porMarca.forEach(c => {
        console.log(`     - ${c.marca || '(sin marca)'} / ${c.nombre_tipo_pedido}: ${c.porcentaje_comision}%`);
      });
    }

    // 2. Verificar si hay pedidos en 2026
    console.log('\n🔍 Verificando pedidos en 2026...');
    const pedidos = await crm.query(`
      SELECT COUNT(*) as total
      FROM pedidos
      WHERE YEAR(FechaPedido) = 2026
    `);
    console.log(`   Total pedidos en 2026: ${pedidos[0]?.total || 0}`);

    // 3. Verificar si hay artículos con marca asignada
    console.log('\n🔍 Verificando artículos con marca...');
    const articulosConMarca = await crm.query(`
      SELECT COUNT(*) as total
      FROM articulos
      WHERE Id_Marca IS NOT NULL
    `);
    const articulosSinMarca = await crm.query(`
      SELECT COUNT(*) as total
      FROM articulos
      WHERE Id_Marca IS NULL
    `);
    console.log(`   Artículos con marca: ${articulosConMarca[0]?.total || 0}`);
    console.log(`   Artículos sin marca: ${articulosSinMarca[0]?.total || 0}`);

    // 4. Obtener comerciales
    console.log('\n🔍 Obteniendo comerciales...');
    const comerciales = await crm.query('SELECT id, Nombre FROM comerciales WHERE id > 0');
    console.log(`   Comerciales encontrados: ${comerciales.length}`);
    
    if (comerciales.length > 0 && pedidos[0]?.total > 0) {
      // 5. Intentar calcular comisión de prueba para el primer comercial
      const comercialTest = comerciales[0];
      console.log(`\n🧪 Calculando comisión de prueba para ${comercialTest.Nombre} (ID: ${comercialTest.id}), mes 1, año 2026...`);
      
      try {
        const resultado = await calculadorComisiones.calcularComisionMensual(
          comercialTest.id,
          1, // enero
          2026,
          1 // calculado por admin
        );
        console.log('✅ Cálculo completado exitosamente');
        console.log(`   Comisión de ventas: ${resultado.comision_ventas || 0}€`);
        console.log(`   Comisión presupuesto: ${resultado.comision_presupuesto || 0}€`);
        console.log(`   Total: ${resultado.total_comision || 0}€`);
      } catch (error) {
        console.error('❌ Error calculando comisión:', error.message);
        console.error('   Stack:', error.stack);
      }
    } else {
      console.log('\n⚠️ No se puede hacer cálculo de prueba:');
      if (comerciales.length === 0) console.log('   - No hay comerciales');
      if (pedidos[0]?.total === 0) console.log('   - No hay pedidos en 2026');
    }

    console.log('\n✅ Verificación completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
})();
