const comisionesCRM = require('../config/mysql-crm-comisiones');
const crm = require('../config/mysql-crm');

async function listarPresupuestos() {
  try {
    await comisionesCRM.connect();
    await crm.connect();
    
    console.log('\n========================================');
    console.log('📊 LISTADO DE PRESUPUESTOS PARA 2026');
    console.log('========================================\n');
    
    // Obtener presupuestos del 2026
    const presupuestos = await comisionesCRM.getPresupuestos({ año: 2026 });
    
    if (presupuestos && presupuestos.length > 0) {
      console.log(`✅ Encontrados ${presupuestos.length} presupuesto(s) para el año 2026:\n`);
      
      // Obtener información de comerciales y artículos para mostrar nombres
      const comerciales = await crm.getComerciales();
      const articulos = await crm.getArticulos();
      
      // Crear mapas para búsqueda rápida
      const comercialesMap = {};
      comerciales.forEach(c => {
        const id = c.id || c.Id || c.ID;
        comercialesMap[id] = c;
      });
      
      const articulosMap = {};
      articulos.forEach(a => {
        const id = a.id || a.Id || a.ID;
        articulosMap[id] = a;
      });
      
      presupuestos.forEach((p, index) => {
        const comercial = comercialesMap[p.comercial_id || p.Comercial_id || p.COMERCIAL_ID];
        const articulo = articulosMap[p.articulo_id || p.Articulo_id || p.ARTICULO_ID];
        
        console.log(`--- Presupuesto ${index + 1} ---`);
        console.log(`   ID: ${p.id || p.Id || p.ID}`);
        console.log(`   Comercial ID: ${p.comercial_id || p.Comercial_id || p.COMERCIAL_ID}`);
        console.log(`   Comercial Nombre: ${comercial ? (comercial.Nombre || comercial.nombre || 'N/A') : 'NO ENCONTRADO'}`);
        console.log(`   Artículo ID: ${p.articulo_id || p.Articulo_id || p.ARTICULO_ID}`);
        console.log(`   Artículo Nombre: ${articulo ? (articulo.Nombre || articulo.nombre || 'N/A') : 'NO ENCONTRADO'}`);
        console.log(`   Artículo SKU: ${articulo ? (articulo.SKU || articulo.sku || 'N/A') : 'N/A'}`);
        console.log(`   Año: ${p.año || p.Año || p.AÑO}`);
        console.log(`   Mes: ${p.mes || p.Mes || p.MES || 'Anual (todos los meses)'}`);
        console.log(`   Cantidad Presupuestada: ${(p.cantidad_presupuestada || p.Cantidad_presupuestada || 0).toLocaleString('es-ES', {minimumFractionDigits: 0, maximumFractionDigits: 2})}`);
        console.log(`   Importe Presupuestado: ${(p.importe_presupuestado || p.Importe_presupuestado || 0).toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2})} €`);
        console.log(`   % Comisión: ${(p.porcentaje_comision || p.Porcentaje_comision || 0).toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`);
        console.log(`   Activo: ${p.activo !== undefined ? (p.activo ? 'Sí' : 'No') : p.Activo !== undefined ? (p.Activo ? 'Sí' : 'No') : 'N/A'}`);
        console.log(`   Observaciones: ${p.observaciones || p.Observaciones || 'Sin observaciones'}`);
        console.log(`   Creado por: ${p.creado_por || p.Creado_por || 'N/A'}`);
        console.log(`   Creado en: ${p.creado_en || p.Creado_en || 'N/A'}`);
        console.log(`   Actualizado en: ${p.actualizado_en || p.Actualizado_en || 'N/A'}`);
        console.log('');
      });
      
      // Resumen
      const totalCantidad = presupuestos.reduce((sum, p) => sum + (parseFloat(p.cantidad_presupuestada || p.Cantidad_presupuestada || 0)), 0);
      const totalImporte = presupuestos.reduce((sum, p) => sum + (parseFloat(p.importe_presupuestado || p.Importe_presupuestado || 0)), 0);
      
      console.log('--- RESUMEN ---');
      console.log(`   Total Presupuestos: ${presupuestos.length}`);
      console.log(`   Total Cantidad Presupuestada: ${totalCantidad.toLocaleString('es-ES', {minimumFractionDigits: 0, maximumFractionDigits: 2})}`);
      console.log(`   Total Importe Presupuestado: ${totalImporte.toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2})} €`);
      
      // Agrupar por comercial
      console.log('\n--- POR COMERCIAL ---');
      const porComercial = {};
      presupuestos.forEach(p => {
        const comercialId = p.comercial_id || p.Comercial_id || p.COMERCIAL_ID;
        const comercial = comercialesMap[comercialId];
        const nombreComercial = comercial ? (comercial.Nombre || comercial.nombre) : `ID ${comercialId}`;
        
        if (!porComercial[nombreComercial]) {
          porComercial[nombreComercial] = {
            cantidad: 0,
            importe: 0,
            count: 0
          };
        }
        
        porComercial[nombreComercial].cantidad += parseFloat(p.cantidad_presupuestada || p.Cantidad_presupuestada || 0);
        porComercial[nombreComercial].importe += parseFloat(p.importe_presupuestado || p.Importe_presupuestado || 0);
        porComercial[nombreComercial].count += 1;
      });
      
      Object.keys(porComercial).sort().forEach(nombre => {
        const datos = porComercial[nombre];
        console.log(`   ${nombre}:`);
        console.log(`      Presupuestos: ${datos.count}`);
        console.log(`      Cantidad Total: ${datos.cantidad.toLocaleString('es-ES', {minimumFractionDigits: 0, maximumFractionDigits: 2})}`);
        console.log(`      Importe Total: ${datos.importe.toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2})} €`);
      });
      
    } else {
      console.log('❌ No se encontraron presupuestos para el año 2026');
    }
    
    console.log('\n========================================');
    console.log('✅ LISTADO COMPLETADO');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('❌ Error obteniendo presupuestos:', error);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

listarPresupuestos();
