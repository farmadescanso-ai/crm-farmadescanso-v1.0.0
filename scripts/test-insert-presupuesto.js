const comisionesCRM = require('../config/mysql-crm-comisiones');

async function testInsert() {
  try {
    await comisionesCRM.connect();
    
    console.log('\n========================================');
    console.log('🧪 TEST: Insertar presupuesto directamente');
    console.log('========================================\n');
    
    // Datos de prueba
    const testData = {
      comercial_id: 4,
      articulo_id: 6,
      año: 2026,
      mes: null,
      cantidad_presupuestada: 100,
      importe_presupuestado: 500,
      porcentaje_comision: 10,
      activo: true,
      observaciones: 'Test desde script',
      creado_por: 1
    };
    
    console.log('📝 Datos de prueba:', JSON.stringify(testData, null, 2));
    
    // Verificar que el comercial existe
    console.log('\n🔍 Verificando comercial ID=4...');
    const pool = await comisionesCRM.connect();
    const [comercial] = await pool.execute('SELECT id, Nombre FROM comerciales WHERE id = ?', [4]);
    console.log('Comercial encontrado:', comercial.length > 0 ? comercial[0] : 'NO ENCONTRADO');
    
    // Verificar que el artículo existe
    console.log('\n🔍 Verificando artículo ID=6...');
    const [articulo] = await pool.execute('SELECT id, Nombre FROM articulos WHERE id = ?', [6]);
    console.log('Artículo encontrado:', articulo.length > 0 ? articulo[0] : 'NO ENCONTRADO');
    
    if (comercial.length === 0) {
      console.error('❌ El comercial ID=4 NO existe');
      return;
    }
    
    if (articulo.length === 0) {
      console.error('❌ El artículo ID=6 NO existe');
      return;
    }
    
    // Intentar insertar
    console.log('\n💾 Intentando insertar presupuesto...');
    try {
      const result = await comisionesCRM.createPresupuesto(testData);
      console.log('✅ Presupuesto insertado exitosamente:', result);
    } catch (error) {
      console.error('❌ Error al insertar:', error.message);
      console.error('Stack:', error.stack);
      if (error.originalError) {
        console.error('Error original:', error.originalError);
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    process.exit(0);
  }
}

testInsert();
