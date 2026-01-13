const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');

async function testFijosMensuales() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // 1. Verificar que la tabla existe
    console.log('🔍 Verificando tabla fijos_mensuales_marca...');
    try {
      const [tabla] = await crm.pool.query('SHOW TABLES LIKE "fijos_mensuales_marca"');
      if (tabla.length > 0) {
        console.log('✅ Tabla fijos_mensuales_marca existe\n');
      } else {
        console.log('❌ Tabla fijos_mensuales_marca NO existe\n');
        return;
      }
    } catch (error) {
      console.error('❌ Error verificando tabla:', error.message);
      return;
    }
    
    // 2. Verificar marcas
    console.log('🔍 Verificando marcas...');
    try {
      const marcas1 = await crm.query('SELECT id, Nombre FROM Marcas ORDER BY Nombre');
      console.log(`✅ Marcas (con mayúscula): ${marcas1.length} encontradas`);
      console.log('   Marcas:', marcas1.map(m => `${m.id}: ${m.Nombre}`).join(', '));
    } catch (e1) {
      console.log('❌ Error con Marcas (mayúscula):', e1.message);
      try {
        const marcas2 = await crm.query('SELECT id, Nombre FROM marcas ORDER BY Nombre');
        console.log(`✅ Marcas (con minúscula): ${marcas2.length} encontradas`);
      } catch (e2) {
        console.log('❌ Error con marcas (minúscula):', e2.message);
      }
    }
    console.log('');
    
    // 3. Verificar comerciales
    console.log('🔍 Verificando comerciales...');
    const comerciales = await crm.getComerciales();
    console.log(`✅ Comerciales: ${comerciales.length} encontrados\n`);
    
    // 4. Verificar fijos mensuales
    console.log('🔍 Verificando fijos mensuales por marca...');
    try {
      const fijos = await comisionesCRM.getFijosMensualesMarca();
      console.log(`✅ Fijos mensuales: ${fijos.length} encontrados`);
      if (fijos.length > 0) {
        console.log('   Primeros 3 fijos:');
        fijos.slice(0, 3).forEach(f => {
          console.log(`   - Comercial: ${f.comercial_nombre}, Marca: ${f.marca_nombre}, Importe: ${f.importe}`);
        });
      }
    } catch (error) {
      console.error('❌ Error obteniendo fijos mensuales:', error.message);
      console.error('Stack:', error.stack);
    }
    console.log('');
    
    // 5. Probar consulta directa
    console.log('🔍 Probando consulta directa...');
    try {
      const [resultado] = await crm.pool.query(`
        SELECT fmm.*,
               c.Nombre as comercial_nombre,
               c.Email as comercial_email,
               m.Nombre as marca_nombre
        FROM fijos_mensuales_marca fmm
        INNER JOIN comerciales c ON fmm.comercial_id = c.id
        INNER JOIN Marcas m ON fmm.marca_id = m.id
        LIMIT 5
      `);
      console.log(`✅ Consulta directa exitosa: ${resultado.length} registros`);
    } catch (error) {
      console.error('❌ Error en consulta directa:', error.message);
      console.error('SQL Error Code:', error.code);
    }
    
    await crm.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR GENERAL:', error.message);
    console.error('Stack:', error.stack);
    await crm.disconnect().catch(() => {});
    process.exit(1);
  }
}

testFijosMensuales();
