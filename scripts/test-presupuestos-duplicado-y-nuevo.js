const comisionesCRM = require('../config/mysql-crm-comisiones');
const crm = require('../config/mysql-crm');

async function testPresupuestos() {
  try {
    await comisionesCRM.connect();
    await crm.connect();
    
    console.log('\n========================================');
    console.log('🧪 TEST: PRESUPUESTO DUPLICADO Y NUEVO');
    console.log('========================================\n');
    
    // Obtener el comercial "Rico Pérez, Cristina" (ID=4)
    const comercial = await crm.getComercialById(4);
    if (!comercial) {
      console.error('❌ No se encontró el comercial con ID=4');
      process.exit(1);
    }
    console.log('✅ Comercial encontrado:', comercial.Nombre || comercial.nombre);
    
    // Obtener los artículos por SKU
    const articulos = await crm.getArticulos();
    const articulo1 = articulos.find(a => (a.SKU || a.sku) === '216959'); // Aceite De Ducha Atopic 500 Ml
    const articulo2 = articulos.find(a => (a.SKU || a.sku) === '220375'); // Ialozon Clean Spray 100 ML
    
    if (!articulo1) {
      console.error('❌ No se encontró el artículo con SKU=216959');
      process.exit(1);
    }
    if (!articulo2) {
      console.error('❌ No se encontró el artículo con SKU=220375');
      process.exit(1);
    }
    
    console.log('✅ Artículo 1 encontrado:', articulo1.Nombre || articulo1.nombre, 'ID:', articulo1.id || articulo1.Id || articulo1.ID);
    console.log('✅ Artículo 2 encontrado:', articulo2.Nombre || articulo2.nombre, 'ID:', articulo2.id || articulo2.Id || articulo2.ID);
    
    const comercialId = comercial.id || comercial.Id || comercial.ID;
    const articulo1Id = articulo1.id || articulo1.Id || articulo1.ID;
    const articulo2Id = articulo2.id || articulo2.Id || articulo2.ID;
    
    // Verificar si ya existe un presupuesto para el artículo 1 (duplicado)
    console.log('\n--- TEST 1: Verificar presupuesto existente (duplicado) ---');
    const presupuestosExistentes = await comisionesCRM.getPresupuestos({
      comercial_id: comercialId,
      articulo_id: articulo1Id,
      año: 2026
    });
    
    if (presupuestosExistentes && presupuestosExistentes.length > 0) {
      console.log(`✅ Presupuesto existente encontrado (ID: ${presupuestosExistentes[0].id})`);
      console.log('   Datos:', JSON.stringify(presupuestosExistentes[0], null, 2));
    } else {
      console.log('ℹ️ No se encontró presupuesto existente para este comercial, artículo y año');
    }
    
    // TEST 1: Intentar crear un presupuesto DUPLICADO (debería actualizar)
    console.log('\n--- TEST 1: Intentar crear presupuesto DUPLICADO (debería actualizar) ---');
    const presupuestoDuplicado = {
      comercial_id: comercialId,
      articulo_id: articulo1Id,
      año: 2026,
      mes: null,
      cantidad_presupuestada: 200,
      importe_presupuestado: 1600.00,
      porcentaje_comision: 10,
      activo: true,
      observaciones: 'Test de duplicado',
      creado_por: 1
    };
    
    console.log('📤 Datos a enviar:', JSON.stringify(presupuestoDuplicado, null, 2));
    
    try {
      const resultadoDuplicado = await comisionesCRM.createPresupuesto(presupuestoDuplicado);
      console.log('✅ Resultado:', JSON.stringify(resultadoDuplicado, null, 2));
      if (resultadoDuplicado.actualizado) {
        console.log('✅✅ Presupuesto DUPLICADO detectado y actualizado correctamente');
      } else {
        console.log('⚠️ Presupuesto creado como nuevo (no se detectó como duplicado)');
      }
    } catch (error) {
      console.error('❌ Error al crear presupuesto duplicado:', error.message);
      console.error('Stack:', error.stack);
    }
    
    // TEST 2: Intentar crear un presupuesto NUEVO
    console.log('\n--- TEST 2: Intentar crear presupuesto NUEVO ---');
    const presupuestoNuevo = {
      comercial_id: comercialId,
      articulo_id: articulo2Id,
      año: 2026,
      mes: null,
      cantidad_presupuestada: 200,
      importe_presupuestado: 2082.00,
      porcentaje_comision: 10,
      activo: true,
      observaciones: 'Test de presupuesto nuevo',
      creado_por: 1
    };
    
    console.log('📤 Datos a enviar:', JSON.stringify(presupuestoNuevo, null, 2));
    
    // Verificar primero si ya existe
    const presupuestosExistentes2 = await comisionesCRM.getPresupuestos({
      comercial_id: comercialId,
      articulo_id: articulo2Id,
      año: 2026
    });
    
    if (presupuestosExistentes2 && presupuestosExistentes2.length > 0) {
      console.log(`⚠️ Ya existe un presupuesto para este artículo (ID: ${presupuestosExistentes2[0].id})`);
      console.log('   Se actualizará en lugar de crear uno nuevo');
    } else {
      console.log('✅ No existe presupuesto previo, se creará uno nuevo');
    }
    
    try {
      const resultadoNuevo = await comisionesCRM.createPresupuesto(presupuestoNuevo);
      console.log('✅ Resultado:', JSON.stringify(resultadoNuevo, null, 2));
      if (resultadoNuevo.actualizado) {
        console.log('⚠️ Presupuesto actualizado (ya existía)');
      } else {
        console.log('✅✅ Presupuesto NUEVO creado correctamente');
      }
    } catch (error) {
      console.error('❌ Error al crear presupuesto nuevo:', error.message);
      console.error('Stack:', error.stack);
    }
    
    console.log('\n========================================');
    console.log('✅ TEST COMPLETADO');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('❌ Error en el test:', error);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testPresupuestos();
