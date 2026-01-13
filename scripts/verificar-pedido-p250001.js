require('dotenv').config();
const crm = require('../config/mysql-crm');

async function verificarPedido() {
  try {
    await crm.connect();
    console.log('🔍 Conectado a la base de datos\n');

    // Buscar pedido por número
    const numeroPedido = 'P250001';
    console.log(`📋 Buscando pedido: ${numeroPedido}\n`);

    // Primero verificar la estructura de la tabla
    const estructura = await crm.query('DESCRIBE pedidos');
    console.log('📋 Columnas de la tabla pedidos:');
    const columnasNumero = [];
    estructura.forEach(col => {
      const nombreCol = col.Field;
      console.log(`   - ${nombreCol} (${col.Type})`);
      if (nombreCol.toLowerCase().includes('numero') || nombreCol.toLowerCase().includes('número') || nombreCol.toLowerCase().includes('pedido')) {
        columnasNumero.push(nombreCol);
      }
    });
    console.log('');
    console.log('🔍 Columnas relacionadas con número de pedido:', columnasNumero.join(', '));
    console.log('');

    // Buscar por todas las columnas posibles
    let sqlPedido = 'SELECT * FROM pedidos WHERE ';
    const condiciones = columnasNumero.map(col => `\`${col}\` = ?`).join(' OR ');
    sqlPedido += condiciones || 'Id = -1'; // Si no hay columnas, buscar algo que no existe
    sqlPedido += ' LIMIT 1';
    
    const params = columnasNumero.length > 0 ? new Array(columnasNumero.length).fill(numeroPedido) : [];
    const pedidos = params.length > 0 ? await crm.query(sqlPedido, params) : [];

    if (pedidos.length === 0) {
      console.log('❌ No se encontró el pedido P250001\n');
      
      // Buscar el último pedido creado
      console.log('🔍 Buscando los últimos 5 pedidos creados...\n');
      const ultimosPedidos = await crm.query('SELECT * FROM pedidos ORDER BY Id DESC LIMIT 5');
      
      if (ultimosPedidos.length > 0) {
        console.log(`📊 Últimos ${ultimosPedidos.length} pedidos encontrados:\n`);
        ultimosPedidos.forEach((pedido, index) => {
          console.log(`${index + 1}. ID: ${pedido.Id || pedido.id}`);
          console.log(`   Número: ${pedido.Número_Pedido || pedido.Numero_Pedido || pedido.numero_pedido || '—'}`);
          console.log(`   Fecha: ${pedido.Fecha_Pedido || pedido.Fecha || pedido.fecha || '—'}`);
          console.log(`   Cliente ID: ${pedido.Cliente_id || pedido.ClienteId || pedido.cliente_id || '—'}`);
          console.log(`   Total: ${pedido.Total_pedido_ || pedido.Total_pedido || pedido.total || '—'}`);
          console.log('');
        });
      } else {
        console.log('❌ No hay pedidos en la base de datos\n');
      }
    } else {
      const pedido = pedidos[0];
      const pedidoId = pedido.Id || pedido.id;
      
      console.log('✅ Pedido encontrado:');
      console.log(`   ID: ${pedidoId}`);
      console.log(`   Número: ${pedido.Número_Pedido || pedido.Numero_Pedido || pedido.numero_pedido || '—'}`);
      console.log(`   Fecha: ${pedido.Fecha_Pedido || pedido.Fecha || pedido.fecha || '—'}`);
      console.log(`   Cliente ID: ${pedido.Cliente_id || pedido.ClienteId || pedido.cliente_id || '—'}`);
      console.log(`   Comercial ID: ${pedido.Comercial_id || pedido.ComercialId || pedido.comercial_id || '—'}`);
      console.log(`   Estado: ${pedido.Estado || pedido.estado || '—'}`);
      console.log(`   Total: ${pedido.Total_pedido_ || pedido.Total_pedido || pedido.total || '—'}`);
      console.log('');

      // Buscar líneas del pedido
      console.log(`📦 Buscando líneas del pedido ID: ${pedidoId}\n`);
      const sqlLineas = 'SELECT * FROM pedidos_articulos WHERE PedidoId = ? ORDER BY Id ASC';
      const lineas = await crm.query(sqlLineas, [pedidoId]);

      if (lineas.length === 0) {
        console.log('❌ No se encontraron líneas para este pedido\n');
        
        // Verificar si hay líneas sin pedido asignado
        const lineasSinPedido = await crm.query('SELECT COUNT(*) as count FROM pedidos_articulos WHERE PedidoId IS NULL OR PedidoId = 0');
        console.log(`⚠️  Líneas sin pedido asignado: ${lineasSinPedido[0]?.count || 0}\n`);
      } else {
        console.log(`✅ Se encontraron ${lineas.length} líneas:\n`);
        lineas.forEach((linea, index) => {
          console.log(`Línea ${index + 1}:`);
          console.log(`   ID: ${linea.Id || linea.id}`);
          console.log(`   PedidoId: ${linea.PedidoId || linea.pedidoId || '—'}`);
          console.log(`   ArticuloId: ${linea.ArticuloId || linea.articuloId || linea.Artículo_id || '—'}`);
          console.log(`   Cantidad: ${linea.Cantidad || linea.cantidad || '—'}`);
          console.log(`   Precio: ${linea.Precio || linea.precio || '—'}`);
          console.log(`   IVA: ${linea.IVA || linea.iva || '—'}`);
          console.log(`   Descuento: ${linea.Descuento || linea.descuento || '—'}`);
          console.log(`   Subtotal: ${linea.Subtotal || linea.subtotal || '—'}`);
          console.log(`   Total: ${linea.Total || linea.total || '—'}`);
          console.log('');
        });
      }
    }

    // Estadísticas generales
    console.log('📊 Estadísticas de la base de datos:');
    const totalPedidos = await crm.query('SELECT COUNT(*) as count FROM pedidos');
    const totalLineas = await crm.query('SELECT COUNT(*) as count FROM pedidos_articulos');
    console.log(`   Total pedidos: ${totalPedidos[0]?.count || 0}`);
    console.log(`   Total líneas: ${totalLineas[0]?.count || 0}`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    await crm.disconnect();
    console.log('\n🔌 Desconectado de MySQL');
  }
}

verificarPedido();

