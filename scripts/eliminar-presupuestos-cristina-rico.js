// Script para eliminar todos los presupuestos de Cristina Rico del año 2025

const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');

async function eliminarPresupuestosCristinaRico() {
  try {
    await crm.connect();
    await comisionesCRM.connect();

    console.log('🔄 Eliminando presupuestos de Cristina Rico para el año 2025...\n');

    // 1. Obtener ID de Cristina Rico
    const comerciales = await crm.getComerciales();
    const cristina = comerciales.find(c => 
      (c.Nombre || c.nombre || '').includes('Cristina') && 
      (c.Nombre || c.nombre || '').includes('Rico')
    );

    if (!cristina) {
      console.error('❌ No se encontró el comercial Cristina Rico');
      return;
    }

    const cristinaId = cristina.id || cristina.Id;
    console.log(`✅ Comercial encontrado: ${cristina.Nombre || cristina.nombre} (ID: ${cristinaId})\n`);

    // 2. Obtener todos los presupuestos de Cristina Rico para 2025
    const presupuestos = await comisionesCRM.getPresupuestos({
      comercial_id: cristinaId,
      año: 2025
    });

    if (presupuestos.length === 0) {
      console.log('ℹ️  No se encontraron presupuestos de Cristina Rico para el año 2025');
      return;
    }

    console.log(`📊 Encontrados ${presupuestos.length} presupuestos para eliminar:\n`);

    // Mostrar resumen de presupuestos
    const presupuestosPorMes = {};
    presupuestos.forEach(p => {
      const mes = p.mes ? `${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][p.mes - 1]}` : 'Anual';
      if (!presupuestosPorMes[mes]) {
        presupuestosPorMes[mes] = 0;
      }
      presupuestosPorMes[mes]++;
    });

    console.log('📅 Presupuestos por mes:');
    for (const mes in presupuestosPorMes) {
      console.log(`   - ${mes}: ${presupuestosPorMes[mes]} presupuesto(s)`);
    }
    console.log('');

    // 3. Confirmar eliminación
    console.log('⚠️  Se eliminarán todos los presupuestos de Cristina Rico para 2025');
    console.log(`   Total: ${presupuestos.length} presupuesto(s)\n`);

    // 4. Eliminar presupuestos
    let eliminados = 0;
    let errores = 0;

    for (const presupuesto of presupuestos) {
      try {
        await comisionesCRM.deletePresupuesto(presupuesto.id);
        eliminados++;
        
        const mes = presupuesto.mes ? `${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][presupuesto.mes - 1]}` : 'Anual';
        const articuloNombre = presupuesto.articulo_nombre || `Artículo ID ${presupuesto.articulo_id}`;
        console.log(`   ✅ Eliminado: ${mes} - ${articuloNombre} (ID: ${presupuesto.id})`);
      } catch (error) {
        errores++;
        console.error(`   ❌ Error eliminando presupuesto ID ${presupuesto.id}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE ELIMINACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Presupuestos eliminados: ${eliminados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📦 Total procesado: ${presupuestos.length}`);
    console.log('='.repeat(60));

    console.log('\n✅ Eliminación completada exitosamente');

  } catch (error) {
    console.error('❌ Error en la eliminación:', error);
    console.error('Stack:', error.stack);
  } finally {
    await crm.disconnect();
    console.log('🔌 Desconectado de MySQL');
    process.exit(0);
  }
}

// Ejecutar el script
eliminarPresupuestosCristinaRico();

