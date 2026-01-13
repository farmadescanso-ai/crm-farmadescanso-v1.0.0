const crm = require('../config/mysql-crm');

async function testConsultaFiltroMarca() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await crm.connect();
    console.log('✅ Conectado a la base de datos');
    
    // Consulta SQL
    const sql = `
      SELECT DISTINCT p.*
      FROM pedidos p
      INNER JOIN pedidos_articulos pa ON (pa.Id_NumPedido = p.Id OR pa.NumPedido = p.NumPedido)
      INNER JOIN articulos a ON a.id = pa.Id_Articulo
      WHERE a.Id_Marca = 1
      ORDER BY p.Id DESC
    `;
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 EJECUTANDO CONSULTA SQL:');
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
      console.log(`✅ Total: ${rows.length} pedidos con artículos de la marca ID = 1 (Youbelle)`);
      console.log('═══════════════════════════════════════════════════════════\n');
    } else {
      console.log('⚠️ No se encontraron pedidos con artículos de la marca ID = 1 (Youbelle)');
      console.log('\n🔍 Verificando si hay artículos con Id_Marca = 1...');
      
      const articulos = await crm.query(
        'SELECT COUNT(*) as total FROM articulos WHERE Id_Marca = 1'
      );
      console.log(`   Total artículos con Id_Marca = 1: ${articulos[0]?.total || 0}`);
      
      const lineas = await crm.query(`
        SELECT COUNT(*) as total 
        FROM pedidos_articulos pa
        INNER JOIN articulos a ON a.id = pa.Id_Articulo
        WHERE a.Id_Marca = 1
      `);
      console.log(`   Total líneas de pedidos con artículos de marca 1: ${lineas[0]?.total || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
  }
}

// Ejecutar
testConsultaFiltroMarca();
