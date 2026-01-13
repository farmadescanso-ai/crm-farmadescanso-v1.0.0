const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');

async function verificar() {
  
  try {
    // Conectar a las bases de datos
    await crm.connect();
    await comisionesCRM.connect();
    
    console.log('\n========================================');
    console.log('🔍 VERIFICACIÓN DE COMERCIAL ID=4');
    console.log('========================================\n');
    
    // Verificar comercial con ID=4
    const comercial = await crm.getComercialById(4);
    
    if (comercial) {
      console.log('✅ Comercial encontrado:');
      console.log(`   ID: ${comercial.id || comercial.Id || comercial.ID}`);
      console.log(`   Nombre: ${comercial.Nombre || comercial.nombre || comercial.NOMBRE || 'N/A'}`);
      console.log(`   Email: ${comercial.Email || comercial.email || comercial.EMAIL || 'N/A'}`);
      console.log(`   Activo: ${comercial.Activo !== undefined ? comercial.Activo : comercial.activo !== undefined ? comercial.activo : 'N/A'}`);
      console.log('\n   Todos los campos del comercial:');
      console.log(JSON.stringify(comercial, null, 2));
    } else {
      console.log('❌ Comercial con ID=4 NO encontrado');
      
      // Listar todos los comerciales disponibles
      console.log('\n📋 Comerciales disponibles:');
      const comerciales = await crm.getComerciales();
      comerciales.forEach(c => {
        const id = c.id || c.Id || c.ID;
        const nombre = c.Nombre || c.nombre || c.NOMBRE || 'Sin nombre';
        console.log(`   ID: ${id} - Nombre: ${nombre}`);
      });
    }
    
    // Buscar comercial por nombre "Cristina Rico" o similar
    console.log('\n========================================');
    console.log('🔍 BUSCANDO COMERCIAL "CRISTINA RICO"');
    console.log('========================================\n');
    
    const sql = `SELECT * FROM comerciales WHERE LOWER(Nombre) LIKE LOWER('%cristina%') OR LOWER(nombre) LIKE LOWER('%cristina%') OR LOWER(Nombre) LIKE LOWER('%crostoma%') OR LOWER(nombre) LIKE LOWER('%crostoma%')`;
    const comercialesCristina = await crm.query(sql);
    
    if (comercialesCristina && comercialesCristina.length > 0) {
      console.log(`✅ Encontrados ${comercialesCristina.length} comercial(es) con "Cristina" o "Crostoma" en el nombre:`);
      comercialesCristina.forEach(c => {
        const id = c.id || c.Id || c.ID;
        const nombre = c.Nombre || c.nombre || c.NOMBRE || 'Sin nombre';
        console.log(`   ID: ${id} - Nombre: ${nombre}`);
      });
    } else {
      console.log('❌ No se encontró ningún comercial con "Cristina" o "Crostoma" en el nombre');
    }
    
    console.log('\n========================================');
    console.log('📊 PRESUPUESTOS DEL AÑO 2026');
    console.log('========================================\n');
    
    // Obtener presupuestos del 2026
    const presupuestos = await comisionesCRM.getPresupuestos({ año: 2026 });
    
    if (presupuestos && presupuestos.length > 0) {
      console.log(`✅ Encontrados ${presupuestos.length} presupuesto(s) para el año 2026:\n`);
      
      presupuestos.forEach((p, index) => {
        console.log(`--- Presupuesto ${index + 1} ---`);
        console.log(`   ID: ${p.id || p.Id || p.ID}`);
        console.log(`   Comercial ID: ${p.comercial_id || p.Comercial_id || p.COMERCIAL_ID}`);
        console.log(`   Artículo ID: ${p.articulo_id || p.Articulo_id || p.ARTICULO_ID}`);
        console.log(`   Año: ${p.año || p.Año || p.AÑO}`);
        console.log(`   Mes: ${p.mes || p.Mes || p.MES || 'Anual'}`);
        console.log(`   Cantidad Presupuestada: ${p.cantidad_presupuestada || p.Cantidad_presupuestada || 0}`);
        console.log(`   Importe Presupuestado: ${p.importe_presupuestado || p.Importe_presupuestado || 0}`);
        console.log(`   % Comisión: ${p.porcentaje_comision || p.Porcentaje_comision || 0}`);
        console.log(`   Activo: ${p.activo !== undefined ? p.activo : p.Activo !== undefined ? p.Activo : 'N/A'}`);
        console.log(`   Creado por: ${p.creado_por || p.Creado_por || 'N/A'}`);
        console.log(`   Creado en: ${p.creado_en || p.Creado_en || 'N/A'}`);
        console.log(`   Actualizado en: ${p.actualizado_en || p.Actualizado_en || 'N/A'}`);
        console.log('');
      });
      
      // Resumen
      const totalCantidad = presupuestos.reduce((sum, p) => sum + (parseFloat(p.cantidad_presupuestada || p.Cantidad_presupuestada || 0)), 0);
      const totalImporte = presupuestos.reduce((sum, p) => sum + (parseFloat(p.importe_presupuestado || p.Importe_presupuestado || 0)), 0);
      
      console.log('--- RESUMEN ---');
      console.log(`   Total Cantidad Presupuestada: ${totalCantidad.toLocaleString('es-ES', {minimumFractionDigits: 0, maximumFractionDigits: 2})}`);
      console.log(`   Total Importe Presupuestado: ${totalImporte.toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2})} €`);
    } else {
      console.log('❌ No se encontraron presupuestos para el año 2026');
    }
    
    // Consulta directa SQL para verificar estructura
    console.log('\n========================================');
    console.log('🔍 ESTRUCTURA DE LA TABLA COMERCIALES');
    console.log('========================================\n');
    
    const estructura = await crm.query('DESCRIBE comerciales');
    console.log('Columnas de la tabla comerciales:');
    estructura.forEach(col => {
      console.log(`   ${col.Field} (${col.Type})`);
    });
    
    console.log('\n========================================');
    console.log('✅ VERIFICACIÓN COMPLETADA');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
    console.error('Stack:', error.stack);
  } finally {
    await crm.disconnect();
    await comisionesCRM.disconnect();
    process.exit(0);
  }
}

verificar();
