const crm = require('../config/mysql-crm');

async function testConsultaFiltroMarca2() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Consulta SQL para marca 2 (Ialozon)
    const sql = `
      SELECT DISTINCT p.*
      FROM pedidos p
      INNER JOIN pedidos_articulos pa ON (pa.Id_NumPedido = p.Id OR pa.NumPedido = p.NumPedido)
      INNER JOIN articulos a ON a.id = pa.Id_Articulo
      WHERE a.Id_Marca = 2
      ORDER BY p.Id DESC
    `;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 EJECUTANDO CONSULTA SQL PARA MARCA 2 (Ialozon):');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(sql);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const rows = await crm.query(sql);
    
    console.log(`✅ RESULTADOS: ${rows.length} pedidos encontrados\n`);
    
    if (rows.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📊 PEDIDOS ENCONTRADOS:');
      console.log('═══════════════════════════════════════════════════════════');
      
      rows.forEach((pedido, index) => {
        console.log(`\n${index + 1}. Pedido ID: ${pedido.Id || pedido.id}`);
        console.log(`   Número de Pedido: ${pedido.NumPedido || pedido.Numero_Pedido || 'N/A'}`);
        console.log(`   Fecha: ${pedido.FechaPedido || 'N/A'}`);
        console.log(`   Base Imponible: ${pedido.BaseImponible || 0}`);
        console.log(`   Total Pedido: ${pedido.TotalPedido || pedido.Total_pedido || 0}`);
      });
      
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log(`✅ Total: ${rows.length} pedidos con artículos de la marca ID = 2 (Ialozon)`);
      console.log('═══════════════════════════════════════════════════════════\n');
    } else {
      console.log('⚠️ No se encontraron pedidos con artículos de la marca ID = 2 (Ialozon)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
  }
}

testConsultaFiltroMarca2();
