// Script para verificar si el pedido se ha grabado correctamente
const crm = require('./config/mysql-crm');

async function verificarPedido() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Buscar el pedido por número
    const numeroPedido = 'P250001';
    console.log(`🔍 Buscando pedido con número: ${numeroPedido}...\n`);

    // Buscar en la tabla pedidos
    const pedidos = await crm.query(
      'SELECT * FROM pedidos WHERE NumPedido = ? ORDER BY Id DESC LIMIT 1',
      [numeroPedido]
    );

    if (pedidos && pedidos.length > 0) {
      const pedido = pedidos[0];
      const pedidoId = pedido.id || pedido.Id || pedido.ID;
      console.log('✅ PEDIDO ENCONTRADO:');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('ID:', pedidoId);
      console.log('Número de pedido:', pedido.NumPedido);
      console.log('Cliente ID:', pedido.Id_Cliente);
      console.log('Comercial ID:', pedido.Id_Cial);
      console.log('Fecha pedido:', pedido.FechaPedido);
      console.log('Fecha entrega:', pedido.FechaEntrega);
      console.log('Estado:', pedido.EstadoPedido);
      console.log('Tipo pedido ID:', pedido.Id_TipoPedido);
      console.log('Forma de pago ID:', pedido.Id_FormaPago);
      console.log('Total pedido:', pedido.TotalPedido);
      console.log('Base imponible:', pedido.BaseImponible);
      console.log('Total descuento:', pedido.TotalDescuento);
      console.log('Total IVA:', pedido.TotalIva);
      console.log('Número cooperativa:', pedido.numero_cooperativa);
      console.log('Cooperativa nombre:', pedido.cooperativa_nombre);
      console.log('Observaciones:', pedido.Observaciones);
      console.log('═══════════════════════════════════════════════════════════\n');

      // Buscar las líneas del pedido usando NumPedido (la tabla usa NumPedido, no Id_Pedido)
      console.log(`🔍 Buscando líneas del pedido (Número: ${pedido.NumPedido})...\n`);

      const lineas = await crm.query(
        `SELECT pa.*, a.Nombre as ArticuloNombre 
         FROM pedidos_articulos pa 
         LEFT JOIN articulos a ON pa.Id_Articulo = a.Id 
         WHERE pa.NumPedido = ? 
         ORDER BY pa.id ASC`,
        [pedido.NumPedido]
      );

      if (lineas && lineas.length > 0) {
        console.log(`✅ LÍNEAS DEL PEDIDO (${lineas.length}):`);
        console.log('═══════════════════════════════════════════════════════════');
        lineas.forEach((linea, index) => {
          console.log(`\nLínea ${index + 1}:`);
          console.log('  ID:', linea.Id);
          console.log('  Artículo ID:', linea.Id_Articulo);
          console.log('  Artículo:', linea.ArticuloNombre || 'N/A');
          console.log('  Cantidad:', linea.Cantidad);
          console.log('  Precio:', linea.Precio);
          console.log('  Descuento:', linea.Descuento, '%');
          console.log('  IVA:', linea.IVA, '%');
          console.log('  Subtotal:', linea.Subtotal);
          console.log('  Total:', linea.Total);
        });
        console.log('\n═══════════════════════════════════════════════════════════');
      } else {
        console.log('⚠️ No se encontraron líneas para este pedido');
      }

      // Verificar datos del cliente
      if (pedido.Id_Cliente) {
        console.log(`\n🔍 Verificando datos del cliente (ID: ${pedido.Id_Cliente})...\n`);
        const clientes = await crm.query(
          'SELECT Id, Nombre, DNI_CIF FROM clientes WHERE Id = ?',
          [pedido.Id_Cliente]
        );
        if (clientes && clientes.length > 0) {
          const cliente = clientes[0];
          console.log('✅ Cliente encontrado:');
          console.log('  Nombre:', cliente.Nombre);
          console.log('  DNI/CIF:', cliente.DNI_CIF);
        }
      }

      // Verificar forma de pago
      if (pedido.Id_FormaPago) {
        console.log(`\n🔍 Verificando forma de pago (ID: ${pedido.Id_FormaPago})...\n`);
        const formasPago = await crm.query(
          'SELECT * FROM formas_pago WHERE Id = ?',
          [pedido.Id_FormaPago]
        );
        if (formasPago && formasPago.length > 0) {
          console.log('✅ Forma de pago encontrada:');
          console.log('  Nombre:', formasPago[0].Nombre);
        }
      }

    } else {
      console.log('❌ NO SE ENCONTRÓ EL PEDIDO con número:', numeroPedido);
      
      // Buscar por cliente y fecha
      console.log('\n🔍 Buscando pedidos del cliente 808 con fecha 2025-12-16...\n');
      const pedidosCliente = await crm.query(
        'SELECT Id, NumPedido, FechaPedido, Id_Cliente, EstadoPedido, TotalPedido FROM pedidos WHERE Id_Cliente = 808 AND FechaPedido = ? ORDER BY Id DESC LIMIT 5',
        ['2025-12-16']
      );

      if (pedidosCliente && pedidosCliente.length > 0) {
        console.log('✅ Pedidos encontrados del cliente 808 con fecha 2025-12-16:');
        console.log('═══════════════════════════════════════════════════════════');
        pedidosCliente.forEach((p, index) => {
          console.log(`${index + 1}. ID: ${p.Id}, Número: ${p.NumPedido}, Fecha: ${p.FechaPedido}, Cliente: ${p.Id_Cliente}, Estado: ${p.EstadoPedido}, Total: ${p.TotalPedido}`);
        });
        console.log('═══════════════════════════════════════════════════════════');
      } else {
        console.log('⚠️ No se encontraron pedidos del cliente 808 con fecha 2025-12-16');
      }
      
      console.log('\n🔍 Buscando pedidos recientes...\n');
      
      // Buscar los últimos 10 pedidos
      const pedidosRecientes = await crm.query(
        'SELECT Id, NumPedido, FechaPedido, Id_Cliente, EstadoPedido, TotalPedido FROM pedidos ORDER BY Id DESC LIMIT 10'
      );

      if (pedidosRecientes && pedidosRecientes.length > 0) {
        console.log('📋 Últimos 10 pedidos en la base de datos:');
        console.log('═══════════════════════════════════════════════════════════');
        pedidosRecientes.forEach((p, index) => {
          console.log(`${index + 1}. ID: ${p.Id}, Número: ${p.NumPedido}, Fecha: ${p.FechaPedido}, Cliente: ${p.Id_Cliente}, Estado: ${p.EstadoPedido}, Total: ${p.TotalPedido}`);
        });
        console.log('═══════════════════════════════════════════════════════════');
      } else {
        console.log('⚠️ No hay pedidos en la base de datos');
      }
    }

    await crm.disconnect();
    console.log('\n✅ Verificación completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

verificarPedido();

