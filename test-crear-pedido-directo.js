// Script para simular la creación de pedido directamente (sin HTTP)
const crm = require('./config/mysql-crm');

async function testCrearPedido() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Simular los datos del pedido
    const pedidoPayload = {
      'NumPedido': 'P250001',
      'FechaPedido': '2025-12-16',
      'FechaEntrega': '2025-12-18',
      'EstadoPedido': 'Pendiente',
      'TotalPedido': 11.97,
      'BaseImponible': 9.89,
      'TotalDescuento': 0.52,
      'TotalIva': 2.08,
      'Serie': 'P',
      'Id_FormaPago': 1,
      'Id_Cliente': 808,
      'Id_Cial': 2,
      'numero_cooperativa': '10121509',
      'cooperativa_nombre': 'HEFAME'
    };

    console.log('📝 [TEST] Creando pedido con payload:');
    console.log(JSON.stringify(pedidoPayload, null, 2));
    console.log('\n');

    const inicioCreate = Date.now();
    try {
      const nuevoPedido = await Promise.race([
        crm.createPedido(pedidoPayload),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout creando pedido (30s)')), 30000))
      ]);
      const tiempoCreate = Date.now() - inicioCreate;
      console.log(`✅ [TEST] Pedido creado en ${tiempoCreate}ms`);
      console.log('✅ [TEST] Respuesta:', nuevoPedido);
      const pedidoId = nuevoPedido.insertId || nuevoPedido.Id || nuevoPedido.id;
      console.log(`✅ [TEST] ID del pedido creado: ${pedidoId}\n`);

      if (pedidoId) {
        // Crear una línea de pedido
        console.log('📦 [TEST] Creando línea de pedido...');
        const lineaPayload = {
          'Id_Pedido': pedidoId,
          'Id_Articulo': 14,
          'Cantidad': 1,
          'Precio': 10.41,
          'Descuento': 5,
          'IVA': 21,
          'Subtotal': 9.89,
          'Total': 11.97,
          'Descripcion': 'Jabón Liquido Perfumado Bac Lavanda 500 Ml'
        };

        const inicioLinea = Date.now();
        try {
          const lineaCreada = await Promise.race([
            crm.createPedidoLinea(lineaPayload),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout creando línea (10s)')), 10000))
          ]);
          const tiempoLinea = Date.now() - inicioLinea;
          console.log(`✅ [TEST] Línea creada en ${tiempoLinea}ms`);
          console.log('✅ [TEST] Respuesta línea:', lineaCreada);
          const lineaId = lineaCreada.insertId || lineaCreada.Id || lineaCreada.id;
          console.log(`✅ [TEST] ID de la línea: ${lineaId}\n`);

          if (lineaId) {
            // Vincular línea al pedido
            console.log('🔗 [TEST] Vinculando línea al pedido...');
            const inicioLink = Date.now();
            try {
              await Promise.race([
                crm.linkPedidoLineas(pedidoId, [lineaId]),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout vinculando (10s)')), 10000))
              ]);
              const tiempoLink = Date.now() - inicioLink;
              console.log(`✅ [TEST] Línea vinculada en ${tiempoLink}ms\n`);
            } catch (linkError) {
              console.error(`❌ [TEST] Error vinculando línea: ${linkError.message}`);
            }
          }
        } catch (lineaError) {
          console.error(`❌ [TEST] Error creando línea: ${lineaError.message}`);
        }
      }

      // Verificar que el pedido se creó
      console.log('🔍 [TEST] Verificando pedido creado...');
      const pedidos = await crm.query('SELECT * FROM pedidos WHERE Id = ?', [pedidoId]);
      if (pedidos && pedidos.length > 0) {
        console.log('✅ [TEST] Pedido verificado en la base de datos:');
        console.log(`   ID: ${pedidos[0].Id}`);
        console.log(`   Número: ${pedidos[0].NumPedido}`);
        console.log(`   Cliente: ${pedidos[0].Id_Cliente}`);
        console.log(`   Total: ${pedidos[0].TotalPedido}`);
      } else {
        console.log('❌ [TEST] Pedido no encontrado en la base de datos');
      }

    } catch (createError) {
      const tiempoCreate = Date.now() - inicioCreate;
      console.error(`❌ [TEST] Error creando pedido después de ${tiempoCreate}ms:`);
      console.error(`   Mensaje: ${createError.message}`);
      console.error(`   Stack: ${createError.stack}`);
      if (createError.code) {
        console.error(`   Code: ${createError.code}`);
      }
      if (createError.sqlState) {
        console.error(`   SQL State: ${createError.sqlState}`);
      }
      if (createError.sqlMessage) {
        console.error(`   SQL Message: ${createError.sqlMessage}`);
      }
    }

    await crm.disconnect();
    console.log('\n✅ [TEST] Prueba completada');
  } catch (error) {
    console.error('❌ [TEST] Error general:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testCrearPedido();

