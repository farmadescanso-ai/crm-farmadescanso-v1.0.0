// Script para recalcular todas las comisiones con la nueva lógica de presupuestos mensuales
const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');
const calculadorComisiones = require('../utils/calcular-comisiones');

async function recalcularComisiones() {
  try {
    console.log('🔄 Iniciando recálculo de comisiones con nueva lógica de presupuestos mensuales...\n');

    // Obtener todos los comerciales
    const comerciales = await crm.getComerciales();
    console.log(`📊 Encontrados ${comerciales.length} comerciales\n`);

    // Obtener todos los pedidos para identificar qué meses tienen ventas
    const pedidos = await crm.query(`
      SELECT DISTINCT 
        p.Id_Cial as comercial_id,
        YEAR(p.FechaPedido) as año,
        MONTH(p.FechaPedido) as mes
      FROM pedidos p
      WHERE p.FechaPedido IS NOT NULL
        AND p.Id_Cial IS NOT NULL
      ORDER BY p.Id_Cial, YEAR(p.FechaPedido), MONTH(p.FechaPedido)
    `);

    console.log(`📦 Encontrados ${pedidos.length} combinaciones comercial/año/mes con pedidos\n`);

    // Agrupar por comercial y mes
    const comisionesACalcular = {};
    for (const pedido of pedidos) {
      const comercialId = pedido.comercial_id;
      const año = pedido.año;
      const mes = pedido.mes;
      
      const key = `${comercialId}-${año}-${mes}`;
      if (!comisionesACalcular[key]) {
        comisionesACalcular[key] = {
          comercial_id: comercialId,
          año: año,
          mes: mes
        };
      }
    }

    const totalComisiones = Object.keys(comisionesACalcular).length;
    console.log(`💰 Se calcularán ${totalComisiones} comisiones\n`);

    let calculadas = 0;
    let errores = 0;

    // Calcular comisiones para cada combinación
    for (const key in comisionesACalcular) {
      const { comercial_id, año, mes } = comisionesACalcular[key];
      
      try {
        const comercial = comerciales.find(c => (c.id || c.Id) === comercial_id);
        const nombreComercial = comercial ? (comercial.Nombre || comercial.nombre) : `ID ${comercial_id}`;
        
        console.log(`🔄 Calculando comisión para ${nombreComercial} - ${mes}/${año}...`);
        
        // Calcular comisión mensual
        await calculadorComisiones.calcularComisionMensual(
          comercial_id,
          mes,
          año,
          1 // calculado_por: sistema
        );
        
        calculadas++;
        console.log(`✅ Comisión calculada para ${nombreComercial} - ${mes}/${año}\n`);
      } catch (error) {
        errores++;
        console.error(`❌ Error calculando comisión para comercial ${comercial_id} - ${mes}/${año}:`, error.message);
        console.error(`   Detalles:`, error);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DEL RECÁLCULO');
    console.log('='.repeat(60));
    console.log(`✅ Comisiones calculadas exitosamente: ${calculadas}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📦 Total procesado: ${totalComisiones}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error fatal en el recálculo:', error);
    throw error;
  }
}

// Ejecutar el recálculo
recalcularComisiones()
  .then(() => {
    console.log('\n✅ Recálculo completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el recálculo:', error);
    process.exit(1);
  });

