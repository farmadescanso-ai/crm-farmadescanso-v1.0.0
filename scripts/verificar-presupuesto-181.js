const comisionesCRM = require('../config/mysql-crm-comisiones');

async function verificar() {
  try {
    await comisionesCRM.connect();
    
    console.log('\n========================================');
    console.log('🔍 VERIFICACIÓN DEL PRESUPUESTO ID=181');
    console.log('========================================\n');
    
    // Obtener el presupuesto 181
    const presupuesto = await comisionesCRM.getPresupuestoById(181);
    
    if (presupuesto) {
      console.log('✅ Presupuesto encontrado:');
      console.log(JSON.stringify(presupuesto, null, 2));
      
      console.log('\n--- Verificando duplicados ---');
      const pool = await comisionesCRM.connect();
      
      // Probar diferentes combinaciones de tipos
      const comercialId = presupuesto.comercial_id || presupuesto.Comercial_id;
      const articuloId = presupuesto.articulo_id || presupuesto.Articulo_id;
      const año = presupuesto.año || presupuesto.Año;
      
      console.log(`Buscando duplicados con:`);
      console.log(`  comercial_id: ${comercialId} (tipo: ${typeof comercialId})`);
      console.log(`  articulo_id: ${articuloId} (tipo: ${typeof articuloId})`);
      console.log(`  año: ${año} (tipo: ${typeof año})`);
      
      // Consulta 1: Con los valores tal cual
      const [result1] = await pool.execute(
        'SELECT id FROM presupuestos WHERE comercial_id = ? AND articulo_id = ? AND año = ?',
        [comercialId, articuloId, año]
      );
      console.log(`\nConsulta 1 (valores originales): ${result1.length} resultado(s)`, result1);
      
      // Consulta 2: Convirtiendo a números
      const [result2] = await pool.execute(
        'SELECT id FROM presupuestos WHERE comercial_id = ? AND articulo_id = ? AND año = ?',
        [Number(comercialId), Number(articuloId), Number(año)]
      );
      console.log(`Consulta 2 (convertidos a número): ${result2.length} resultado(s)`, result2);
      
      // Consulta 3: Con CAST explícito
      const [result3] = await pool.execute(
        'SELECT id FROM presupuestos WHERE comercial_id = CAST(? AS UNSIGNED) AND articulo_id = CAST(? AS UNSIGNED) AND año = CAST(? AS UNSIGNED)',
        [comercialId, articuloId, año]
      );
      console.log(`Consulta 3 (con CAST): ${result3.length} resultado(s)`, result3);
      
      // Consulta 4: Ver todos los presupuestos con ese comercial y artículo
      const [result4] = await pool.execute(
        'SELECT id, comercial_id, articulo_id, año FROM presupuestos WHERE comercial_id = ? AND articulo_id = ?',
        [comercialId, articuloId]
      );
      console.log(`\nTodos los presupuestos con comercial_id=${comercialId} y articulo_id=${articuloId}:`);
      result4.forEach(r => {
        console.log(`  ID: ${r.id}, comercial_id: ${r.comercial_id} (${typeof r.comercial_id}), articulo_id: ${r.articulo_id} (${typeof r.articulo_id}), año: ${r.año} (${typeof r.año})`);
      });
      
    } else {
      console.log('❌ Presupuesto ID=181 NO encontrado');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

verificar();
