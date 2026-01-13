// Script para verificar cómo calcular el PCP de un pedido completo
const crm = require('../config/mysql-crm');

async function verificarPedidoCompleto() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Obtener un pedido de ejemplo
    console.log('🔍 Obteniendo un pedido de ejemplo...\n');
    let pedidos;
    try {
      pedidos = await crm.query('SELECT * FROM Pedidos ORDER BY id DESC LIMIT 1');
    } catch (error) {
      pedidos = await crm.query('SELECT * FROM pedidos ORDER BY id DESC LIMIT 1');
    }
    
    if (!pedidos || pedidos.length === 0) {
      console.log('❌ No se encontraron pedidos');
      await crm.disconnect();
      return;
    }

    const pedido = pedidos[0];
    console.log('📦 Pedido de ejemplo:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  ID: ${pedido.id || pedido.Id}`);
    console.log(`  NumPedido: ${pedido.NumPedido || pedido.Numero_Pedido}`);
    console.log(`  BaseImponible: ${pedido.BaseImponible || pedido.Base_Imponible}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    const pedidoId = pedido.id || pedido.Id;
    const numPedido = pedido.NumPedido || pedido.Numero_Pedido;

    // Obtener las líneas del pedido
    console.log('🔍 Obteniendo líneas del pedido...\n');
    let lineas;
    try {
      lineas = await crm.query(`
        SELECT 
          pa.id,
          pa.Id_NumPedido,
          pa.NumPedido,
          pa.Id_Articulo,
          pa.Articulo,
          pa.Cantidad,
          pa.PVP,
          pa.Subtotal,
          a.PCP,
          a.Nombre as ArticuloNombre
        FROM Pedidos_Articulos pa
        INNER JOIN Articulos a ON a.id = pa.Id_Articulo
        WHERE pa.Id_NumPedido = ?
      `, [pedidoId]);
    } catch (error) {
      console.log('⚠️ Error con nombres capitalizados, intentando minúsculas...');
      lineas = await crm.query(`
        SELECT 
          pa.id,
          pa.Id_NumPedido,
          pa.NumPedido,
          pa.Id_Articulo,
          pa.Articulo,
          pa.Cantidad,
          pa.PVP,
          pa.Subtotal,
          a.PCP,
          a.Nombre as ArticuloNombre
        FROM pedidos_articulos pa
        INNER JOIN articulos a ON a.id = pa.Id_Articulo
        WHERE pa.Id_NumPedido = ?
      `, [pedidoId]);
    }

    if (!lineas || lineas.length === 0) {
      console.log('⚠️ No se encontraron líneas con Id_NumPedido, intentando con NumPedido...');
      try {
        lineas = await crm.query(`
          SELECT 
            pa.id,
            pa.Id_NumPedido,
            pa.NumPedido,
            pa.Id_Articulo,
            pa.Articulo,
            pa.Cantidad,
            pa.PVP,
            pa.Subtotal,
            a.PCP,
            a.Nombre as ArticuloNombre
          FROM Pedidos_Articulos pa
          INNER JOIN Articulos a ON a.id = pa.Id_Articulo
          WHERE pa.NumPedido = ?
        `, [numPedido]);
      } catch (error) {
        lineas = await crm.query(`
          SELECT 
            pa.id,
            pa.Id_NumPedido,
            pa.NumPedido,
            pa.Id_Articulo,
            pa.Articulo,
            pa.Cantidad,
            pa.PVP,
            pa.Subtotal,
            a.PCP,
            a.Nombre as ArticuloNombre
          FROM pedidos_articulos pa
          INNER JOIN articulos a ON a.id = pa.Id_Articulo
          WHERE pa.NumPedido = ?
        `, [numPedido]);
      }
    }

    if (!lineas || lineas.length === 0) {
      console.log('❌ No se encontraron líneas para este pedido');
      await crm.disconnect();
      return;
    }

    console.log(`📋 Líneas del pedido (${lineas.length} líneas):`);
    console.log('═══════════════════════════════════════════════════════════');
    
    let totalPCP = 0;
    lineas.forEach((linea, index) => {
      const cantidad = parseFloat(linea.Cantidad || 0);
      const pcp = parseFloat(linea.PCP || 0);
      const subtotalPCP = cantidad * pcp;
      totalPCP += subtotalPCP;
      
      console.log(`\nLínea ${index + 1}:`);
      console.log(`  Artículo: ${linea.ArticuloNombre || linea.Articulo} (ID: ${linea.Id_Articulo})`);
      console.log(`  Cantidad: ${cantidad}`);
      console.log(`  PCP unitario: ${pcp || 'NULL'}`);
      console.log(`  PCP línea (Cantidad × PCP): ${subtotalPCP.toFixed(2)}`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`💰 TOTAL PCP DEL PEDIDO: ${totalPCP.toFixed(2)}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    await crm.disconnect();
    console.log('✅ Verificación completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

verificarPedidoCompleto();
