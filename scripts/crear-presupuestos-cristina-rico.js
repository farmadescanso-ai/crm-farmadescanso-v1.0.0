// Script para crear presupuestos para Cristina Rico
// 48 unidades de cada artículo para Diciembre 2025

const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');

async function crearPresupuestosCristinaRico() {
  try {
    await crm.connect();
    await comisionesCRM.connect();

    console.log('🚀 Creando presupuestos para Cristina Rico...\n');

    // 1. Obtener el comercial Cristina Rico
    const comerciales = await crm.query(
      'SELECT id, Nombre FROM comerciales WHERE Nombre LIKE ? OR Nombre LIKE ?',
      ['%Cristina%Rico%', '%Rico%Cristina%']
    );

    if (comerciales.length === 0) {
      console.log('❌ No se encontró el comercial Cristina Rico');
      return;
    }

    const comercial = comerciales[0];
    console.log(`✅ Comercial encontrado: ${comercial.Nombre} (ID: ${comercial.id})\n`);

    // 2. Obtener todos los artículos
    const articulos = await crm.query('SELECT id, Nombre, PVL FROM articulos ORDER BY id');

    if (articulos.length === 0) {
      console.log('❌ No se encontraron artículos');
      return;
    }

    console.log(`📦 Artículos encontrados: ${articulos.length}\n`);

    // 3. Crear presupuestos
    // Nota: Los presupuestos son anuales, no mensuales
    // Se crea un presupuesto para Diciembre 2025, pero la tabla solo tiene año
    const cantidadPresupuestada = 48;
    const año = 2025;
    let presupuestosCreados = 0;
    let presupuestosActualizados = 0;
    let errores = 0;

    console.log('📝 Creando presupuestos para Diciembre 2025...\n');
    console.log('ℹ️ Nota: Los presupuestos son anuales. Se creará un presupuesto para el año 2025.\n');

    for (const articulo of articulos) {
      try {
        const importePresupuestado = parseFloat(articulo.PVL || 0) * cantidadPresupuestada;

        // Verificar si ya existe un presupuesto para este comercial, artículo y año
        const presupuestosExistentes = await comisionesCRM.query(
          'SELECT id FROM presupuestos WHERE comercial_id = ? AND articulo_id = ? AND año = ?',
          [comercial.id, articulo.id, año]
        );

        if (presupuestosExistentes.length > 0) {
          // Actualizar presupuesto existente
          const presupuestoId = presupuestosExistentes[0].id;
          await comisionesCRM.updatePresupuesto(presupuestoId, {
            cantidad_presupuestada: cantidadPresupuestada,
            importe_presupuestado: importePresupuestado,
            activo: true
          });
          presupuestosActualizados++;
          console.log(`  ✅ Actualizado: ${articulo.Nombre} (ID: ${articulo.id}) - ${cantidadPresupuestada} unidades × €${parseFloat(articulo.PVL || 0).toFixed(2)} = €${importePresupuestado.toFixed(2)}`);
        } else {
          // Crear nuevo presupuesto
          const presupuestoData = {
            comercial_id: comercial.id,
            articulo_id: articulo.id,
            año: año,
            cantidad_presupuestada: cantidadPresupuestada,
            importe_presupuestado: importePresupuestado,
            activo: true,
            observaciones: `Presupuesto creado para Diciembre 2025: ${cantidadPresupuestada} unidades`
          };

          await comisionesCRM.createPresupuesto(presupuestoData);
          presupuestosCreados++;
          console.log(`  ✅ Creado: ${articulo.Nombre} (ID: ${articulo.id}) - ${cantidadPresupuestada} unidades × €${parseFloat(articulo.PVL || 0).toFixed(2)} = €${importePresupuestado.toFixed(2)}`);
        }
      } catch (error) {
        errores++;
        console.error(`  ❌ Error con artículo ${articulo.Nombre} (ID: ${articulo.id}):`, error.message);
      }
    }

    console.log('\n✅ Proceso completado');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`📊 Resumen:`);
    console.log(`   - Comercial: ${comercial.Nombre}`);
    console.log(`   - Año: ${año}`);
    console.log(`   - Cantidad por artículo: ${cantidadPresupuestada} unidades`);
    console.log(`   - Presupuestos creados: ${presupuestosCreados}`);
    console.log(`   - Presupuestos actualizados: ${presupuestosActualizados}`);
    console.log(`   - Errores: ${errores}`);
    console.log(`   - Total artículos procesados: ${articulos.length}`);

  } catch (error) {
    console.error('❌ Error general:', error);
    console.error('Stack:', error.stack);
  } finally {
    await crm.disconnect();
    console.log('🔌 Desconectado de MySQL');
    process.exit(0);
  }
}

crearPresupuestosCristinaRico();

