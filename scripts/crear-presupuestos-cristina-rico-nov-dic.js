// Script para crear presupuestos de Cristina Rico
// - Noviembre y Diciembre 2025
// - Marca YOUBELLE: 24 unidades por artículo
// - Marca IALOZON: 36 unidades por artículo

const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');

async function crearPresupuestosCristinaRicoNovDic() {
  try {
    await crm.connect();
    await comisionesCRM.connect();

    console.log('🔄 Creando presupuestos de Cristina Rico para Noviembre y Diciembre 2025...\n');

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

    // 2. Obtener artículos de las marcas YOUBELLE e IALOZON
    const articulos = await crm.getArticulos();
    const articulosYoubelle = articulos.filter(a => 
      (a.Marca || a.marca || '').toUpperCase() === 'YOUBELLE'
    );
    const articulosIalozon = articulos.filter(a => 
      (a.Marca || a.marca || '').toUpperCase() === 'IALOZON'
    );

    console.log(`✅ Encontrados ${articulosYoubelle.length} artículos de la marca YOUBELLE:`);
    articulosYoubelle.forEach(a => {
      console.log(`   - ${a.Nombre || a.nombre} (ID: ${a.id || a.Id}, PVL: €${parseFloat(a.PVL || a.Pvl || a.pvl || 0).toFixed(2)})`);
    });
    console.log('');

    console.log(`✅ Encontrados ${articulosIalozon.length} artículos de la marca IALOZON:`);
    articulosIalozon.forEach(a => {
      console.log(`   - ${a.Nombre || a.nombre} (ID: ${a.id || a.Id}, PVL: €${parseFloat(a.PVL || a.Pvl || a.pvl || 0).toFixed(2)})`);
    });
    console.log('');

    const año = 2025;
    const meses = [11, 12]; // Noviembre y Diciembre
    const cantidadYoubelle = 24;
    const cantidadIalozon = 36;

    let presupuestosCreados = 0;
    let presupuestosActualizados = 0;
    let errores = 0;

    // 3. Crear presupuestos para YOUBELLE (24 unidades)
    console.log(`📅 Creando presupuestos para marca YOUBELLE (${cantidadYoubelle} unidades por artículo)...`);
    for (const mes of meses) {
      const nombreMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mes - 1];
      
      for (const articulo of articulosYoubelle) {
        const articuloId = articulo.id || articulo.Id;
        const pvl = parseFloat(articulo.PVL || articulo.Pvl || articulo.pvl || 0);
        const cantidad = cantidadYoubelle;
        const importe = cantidad * pvl;

        try {
          // Verificar si ya existe un presupuesto
          const presupuestosExistentes = await comisionesCRM.getPresupuestos({
            comercial_id: cristinaId,
            articulo_id: articuloId,
            año: año,
            mes: mes,
            activo: 1
          });

          if (presupuestosExistentes && presupuestosExistentes.length > 0) {
            // Actualizar presupuesto existente
            const presupuestoId = presupuestosExistentes[0].id;
            await comisionesCRM.updatePresupuesto(presupuestoId, {
              cantidad_presupuestada: cantidad,
              importe_presupuestado: importe,
              mes: mes
            });
            presupuestosActualizados++;
            console.log(`   ✅ Actualizado: ${nombreMes} - ${articulo.Nombre || articulo.nombre} (${cantidad} unidades, €${importe.toFixed(2)})`);
          } else {
            // Crear nuevo presupuesto
            await comisionesCRM.createPresupuesto({
              comercial_id: cristinaId,
              articulo_id: articuloId,
              año: año,
              mes: mes,
              cantidad_presupuestada: cantidad,
              importe_presupuestado: importe,
              porcentaje_comision: 0,
              activo: 1,
              observaciones: `Presupuesto mensual ${nombreMes} - ${cantidad} unidades (YOUBELLE)`,
              creado_por: 1
            });
            presupuestosCreados++;
            console.log(`   ✅ Creado: ${nombreMes} - ${articulo.Nombre || articulo.nombre} (${cantidad} unidades, €${importe.toFixed(2)})`);
          }
        } catch (error) {
          errores++;
          console.error(`   ❌ Error procesando ${nombreMes} - ${articulo.Nombre || articulo.nombre}:`, error.message);
        }
      }
    }

    console.log('');

    // 4. Crear presupuestos para IALOZON (36 unidades)
    console.log(`📅 Creando presupuestos para marca IALOZON (${cantidadIalozon} unidades por artículo)...`);
    for (const mes of meses) {
      const nombreMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mes - 1];
      
      for (const articulo of articulosIalozon) {
        const articuloId = articulo.id || articulo.Id;
        const pvl = parseFloat(articulo.PVL || articulo.Pvl || articulo.pvl || 0);
        const cantidad = cantidadIalozon;
        const importe = cantidad * pvl;

        try {
          // Verificar si ya existe un presupuesto
          const presupuestosExistentes = await comisionesCRM.getPresupuestos({
            comercial_id: cristinaId,
            articulo_id: articuloId,
            año: año,
            mes: mes,
            activo: 1
          });

          if (presupuestosExistentes && presupuestosExistentes.length > 0) {
            // Actualizar presupuesto existente
            const presupuestoId = presupuestosExistentes[0].id;
            await comisionesCRM.updatePresupuesto(presupuestoId, {
              cantidad_presupuestada: cantidad,
              importe_presupuestado: importe,
              mes: mes
            });
            presupuestosActualizados++;
            console.log(`   ✅ Actualizado: ${nombreMes} - ${articulo.Nombre || articulo.nombre} (${cantidad} unidades, €${importe.toFixed(2)})`);
          } else {
            // Crear nuevo presupuesto
            await comisionesCRM.createPresupuesto({
              comercial_id: cristinaId,
              articulo_id: articuloId,
              año: año,
              mes: mes,
              cantidad_presupuestada: cantidad,
              importe_presupuestado: importe,
              porcentaje_comision: 0,
              activo: 1,
              observaciones: `Presupuesto mensual ${nombreMes} - ${cantidad} unidades (IALOZON)`,
              creado_por: 1
            });
            presupuestosCreados++;
            console.log(`   ✅ Creado: ${nombreMes} - ${articulo.Nombre || articulo.nombre} (${cantidad} unidades, €${importe.toFixed(2)})`);
          }
        } catch (error) {
          errores++;
          console.error(`   ❌ Error procesando ${nombreMes} - ${articulo.Nombre || articulo.nombre}:`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE CREACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Presupuestos creados: ${presupuestosCreados}`);
    console.log(`🔄 Presupuestos actualizados: ${presupuestosActualizados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📦 Total procesado: ${presupuestosCreados + presupuestosActualizados}`);
    console.log('='.repeat(60));

    console.log('\n✅ Creación completada exitosamente');

  } catch (error) {
    console.error('❌ Error en la creación:', error);
    console.error('Stack:', error.stack);
  } finally {
    await crm.disconnect();
    console.log('🔌 Desconectado de MySQL');
    process.exit(0);
  }
}

// Ejecutar el script
crearPresupuestosCristinaRicoNovDic();

