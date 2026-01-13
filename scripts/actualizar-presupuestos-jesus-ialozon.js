// Script para actualizar presupuestos de Jesús Francisco Ros Medina
// - Enero a Octubre: 0 unidades por artículo (marca IALOZON)
// - Noviembre y Diciembre: 50 unidades por artículo (marca IALOZON)

const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');

async function actualizarPresupuestosJesusIalozon() {
  try {
    await crm.connect();
    await comisionesCRM.connect();

    console.log('🔄 Actualizando presupuestos de Jesús Francisco Ros Medina para marca IALOZON...\n');

    // 1. Obtener ID de Jesús Francisco Ros Medina
    const comerciales = await crm.getComerciales();
    const jesus = comerciales.find(c => 
      (c.Nombre || c.nombre || '').includes('Jesús') && 
      (c.Nombre || c.nombre || '').includes('Ros')
    );

    if (!jesus) {
      console.error('❌ No se encontró el comercial Jesús Francisco Ros Medina');
      return;
    }

    const jesusId = jesus.id || jesus.Id;
    console.log(`✅ Comercial encontrado: ${jesus.Nombre || jesus.nombre} (ID: ${jesusId})\n`);

    // 2. Obtener artículos de la marca IALOZON
    const articulos = await crm.getArticulos();
    const articulosIalozon = articulos.filter(a => 
      (a.Marca || a.marca || '').toUpperCase() === 'IALOZON'
    );

    if (articulosIalozon.length === 0) {
      console.error('❌ No se encontraron artículos de la marca IALOZON');
      return;
    }

    console.log(`✅ Encontrados ${articulosIalozon.length} artículos de la marca IALOZON:\n`);
    articulosIalozon.forEach(a => {
      console.log(`   - ${a.Nombre || a.nombre} (ID: ${a.id || a.Id}, PVL: €${parseFloat(a.PVL || a.Pvl || a.pvl || 0).toFixed(2)})`);
    });
    console.log('');

    const año = 2025;
    const mesesEneroOctubre = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 0 unidades
    const mesesNovDic = [11, 12]; // 50 unidades

    let presupuestosCreados = 0;
    let presupuestosActualizados = 0;
    let errores = 0;

    // 3. Procesar meses de Enero a Octubre (0 unidades)
    console.log('📅 Procesando meses de Enero a Octubre (0 unidades)...');
    for (const mes of mesesEneroOctubre) {
      const nombreMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mes - 1];
      
      for (const articulo of articulosIalozon) {
        const articuloId = articulo.id || articulo.Id;
        const pvl = parseFloat(articulo.PVL || articulo.Pvl || articulo.pvl || 0);
        const cantidad = 0;
        const importe = cantidad * pvl;

        try {
          // Verificar si ya existe un presupuesto
          const presupuestosExistentes = await comisionesCRM.getPresupuestos({
            comercial_id: jesusId,
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
            console.log(`   ✅ Actualizado: ${nombreMes} - ${articulo.Nombre || articulo.nombre} (0 unidades)`);
          } else {
            // Crear nuevo presupuesto
            await comisionesCRM.createPresupuesto({
              comercial_id: jesusId,
              articulo_id: articuloId,
              año: año,
              mes: mes,
              cantidad_presupuestada: cantidad,
              importe_presupuestado: importe,
              porcentaje_comision: 0,
              activo: 1,
              observaciones: `Presupuesto mensual ${nombreMes} - 0 unidades`,
              creado_por: 1
            });
            presupuestosCreados++;
            console.log(`   ✅ Creado: ${nombreMes} - ${articulo.Nombre || articulo.nombre} (0 unidades)`);
          }
        } catch (error) {
          errores++;
          console.error(`   ❌ Error procesando ${nombreMes} - ${articulo.Nombre || articulo.nombre}:`, error.message);
        }
      }
    }

    console.log('');

    // 4. Procesar meses de Noviembre y Diciembre (50 unidades)
    console.log('📅 Procesando meses de Noviembre y Diciembre (50 unidades)...');
    for (const mes of mesesNovDic) {
      const nombreMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mes - 1];
      
      for (const articulo of articulosIalozon) {
        const articuloId = articulo.id || articulo.Id;
        const pvl = parseFloat(articulo.PVL || articulo.Pvl || articulo.pvl || 0);
        const cantidad = 50;
        const importe = cantidad * pvl;

        try {
          // Verificar si ya existe un presupuesto
          const presupuestosExistentes = await comisionesCRM.getPresupuestos({
            comercial_id: jesusId,
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
            console.log(`   ✅ Actualizado: ${nombreMes} - ${articulo.Nombre || articulo.nombre} (50 unidades, €${importe.toFixed(2)})`);
          } else {
            // Crear nuevo presupuesto
            await comisionesCRM.createPresupuesto({
              comercial_id: jesusId,
              articulo_id: articuloId,
              año: año,
              mes: mes,
              cantidad_presupuestada: cantidad,
              importe_presupuestado: importe,
              porcentaje_comision: 0,
              activo: 1,
              observaciones: `Presupuesto mensual ${nombreMes} - 50 unidades`,
              creado_por: 1
            });
            presupuestosCreados++;
            console.log(`   ✅ Creado: ${nombreMes} - ${articulo.Nombre || articulo.nombre} (50 unidades, €${importe.toFixed(2)})`);
          }
        } catch (error) {
          errores++;
          console.error(`   ❌ Error procesando ${nombreMes} - ${articulo.Nombre || articulo.nombre}:`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE ACTUALIZACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Presupuestos creados: ${presupuestosCreados}`);
    console.log(`🔄 Presupuestos actualizados: ${presupuestosActualizados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📦 Total procesado: ${presupuestosCreados + presupuestosActualizados}`);
    console.log('='.repeat(60));

    console.log('\n✅ Actualización completada exitosamente');

  } catch (error) {
    console.error('❌ Error en la actualización:', error);
    console.error('Stack:', error.stack);
  } finally {
    await crm.disconnect();
    console.log('🔌 Desconectado de MySQL');
    process.exit(0);
  }
}

// Ejecutar el script
actualizarPresupuestosJesusIalozon();

