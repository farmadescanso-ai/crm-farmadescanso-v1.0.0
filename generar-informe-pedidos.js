const crm = require('./config/mysql-crm.js');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await crm.connect();
    console.log('✅ Conectado correctamente\n');

    // Obtener todos los pedidos
    console.log('📋 Obteniendo todos los pedidos...');
    const pedidos = await crm.getPedidos();
    console.log(`✅ Se encontraron ${pedidos.length} pedidos\n`);

    if (pedidos.length === 0) {
      console.log('⚠️ No hay pedidos en la base de datos');
      process.exit(0);
    }

    // Obtener información detallada de cada pedido
    const informe = {
      fechaGeneracion: new Date().toISOString(),
      totalPedidos: pedidos.length,
      pedidos: []
    };

    console.log('📊 Procesando pedidos...\n');
    
    for (let i = 0; i < pedidos.length; i++) {
      const pedidoRaw = pedidos[i];
      const pedidoId = pedidoRaw.id || pedidoRaw.Id;
      
      console.log(`  [${i + 1}/${pedidos.length}] Procesando pedido ID: ${pedidoId}...`);
      
      // Obtener líneas del pedido
      let lineas = [];
      try {
        const numPedido = pedidoRaw.NumPedido || pedidoRaw.Numero_Pedido;
        if (numPedido) {
          // Buscar por Id_NumPedido primero
          let lineasRaw = await crm.query(
            'SELECT * FROM pedidos_articulos WHERE Id_NumPedido = ?',
            [pedidoId]
          );
          
          // Si no hay resultados, buscar por NumPedido
          if (!lineasRaw || lineasRaw.length === 0) {
            lineasRaw = await crm.query(
              'SELECT * FROM pedidos_articulos WHERE NumPedido = ?',
              [numPedido]
            );
          }
          
          if (lineasRaw && lineasRaw.length > 0) {
            lineas = lineasRaw.map(linea => ({
              id: linea.Id || linea.id,
              articuloId: linea.Id_Articulo || linea.Articulo_id,
              articulo: linea.Articulo || 'Artículo desconocido',
              cantidad: linea.Cantidad || 0,
              precio: parseFloat(linea.PVP || linea.Precio || 0),
              iva: parseFloat(linea.IVA || linea.iva || 0),
              descuento: parseFloat(linea.DtoLinea || linea.Descuento || 0),
              subtotal: parseFloat(linea.Subtotal || 0)
            }));
          }
        }
      } catch (error) {
        console.warn(`    ⚠️ Error obteniendo líneas del pedido ${pedidoId}:`, error.message);
      }

      // Obtener información del cliente
      let clienteInfo = null;
      if (pedidoRaw.Id_Cliente) {
        try {
          const cliente = await crm.getClienteById(pedidoRaw.Id_Cliente);
          if (cliente) {
            clienteInfo = {
              id: cliente.Id || cliente.id,
              nombre: cliente.Nombre_Razon_Social || cliente.Nombre || 'Sin nombre',
              dni_cif: cliente.DNI_CIF || cliente.DNI || '—',
              email: cliente.Email || '—',
              telefono: cliente.Telefono || '—'
            };
          }
        } catch (error) {
          console.warn(`    ⚠️ Error obteniendo cliente ${pedidoRaw.Id_Cliente}:`, error.message);
        }
      }

      // Obtener información del comercial
      let comercialInfo = null;
      if (pedidoRaw.Id_Cial) {
        try {
          const comercial = await crm.getComercialById(pedidoRaw.Id_Cial);
          if (comercial) {
            comercialInfo = {
              id: comercial.Id || comercial.id,
              nombre: comercial.Nombre || comercial.nombre || 'Sin nombre',
              email: comercial.Email || '—'
            };
          }
        } catch (error) {
          console.warn(`    ⚠️ Error obteniendo comercial ${pedidoRaw.Id_Cial}:`, error.message);
        }
      }

      // Obtener forma de pago
      let formaPagoInfo = null;
      if (pedidoRaw.Id_FormaPago) {
        try {
          const formaPago = await crm.getFormaPagoById(pedidoRaw.Id_FormaPago);
          if (formaPago) {
            formaPagoInfo = {
              id: formaPago.id || formaPago.Id,
              nombre: formaPago.FormaPago || formaPago.Forma || '—',
              dias: formaPago.Dias || 0
            };
          }
        } catch (error) {
          console.warn(`    ⚠️ Error obteniendo forma de pago ${pedidoRaw.Id_FormaPago}:`, error.message);
        }
      }

      // Obtener tipo de pedido
      let tipoPedidoInfo = null;
      if (pedidoRaw.Id_TipoPedido) {
        try {
          const tipoPedido = await crm.query(
            'SELECT * FROM tipos_pedidos WHERE id = ? LIMIT 1',
            [pedidoRaw.Id_TipoPedido]
          );
          if (tipoPedido && tipoPedido.length > 0) {
            tipoPedidoInfo = {
              id: tipoPedido[0].id,
              tipo: tipoPedido[0].Tipo || '—'
            };
          }
        } catch (error) {
          console.warn(`    ⚠️ Error obteniendo tipo de pedido ${pedidoRaw.Id_TipoPedido}:`, error.message);
        }
      }

      // Construir objeto de pedido completo
      const pedidoCompleto = {
        id: pedidoId,
        numero: pedidoRaw.NumPedido || pedidoRaw.Numero_Pedido || `PED-${pedidoId}`,
        serie: pedidoRaw.Serie || 'P',
        fechaPedido: pedidoRaw.FechaPedido ? new Date(pedidoRaw.FechaPedido).toISOString().split('T')[0] : null,
        fechaEntrega: pedidoRaw.FechaEntrega ? new Date(pedidoRaw.FechaEntrega).toISOString().split('T')[0] : null,
        estado: pedidoRaw.EstadoPedido || pedidoRaw.Estado || 'Pendiente',
        observaciones: pedidoRaw.Observaciones || null,
        cliente: clienteInfo,
        comercial: comercialInfo,
        formaPago: formaPagoInfo,
        tipoPedido: tipoPedidoInfo,
        cooperativa: {
          numero: pedidoRaw.numero_cooperativa || null,
          nombre: pedidoRaw.cooperativa_nombre || null
        },
        totales: {
          baseImponible: parseFloat(pedidoRaw.BaseImponible || 0),
          totalDescuento: parseFloat(pedidoRaw.TotalDescuento || 0),
          totalIva: parseFloat(pedidoRaw.TotalIva || 0),
          totalPedido: parseFloat(pedidoRaw.TotalPedido || 0)
        },
        lineas: {
          cantidad: lineas.length,
          items: lineas
        }
      };

      informe.pedidos.push(pedidoCompleto);
    }

    // Generar informe en formato JSON
    const informeJson = JSON.stringify(informe, null, 2);
    const fechaArchivo = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const archivoJson = path.join(__dirname, `informe-pedidos-${fechaArchivo}.json`);
    fs.writeFileSync(archivoJson, informeJson, 'utf8');
    console.log(`\n✅ Informe JSON guardado en: ${archivoJson}`);

    // Generar informe en formato texto legible
    let informeTexto = '═══════════════════════════════════════════════════════════════\n';
    informeTexto += '           INFORME DE PEDIDOS - FARMADESCANSO CRM\n';
    informeTexto += '═══════════════════════════════════════════════════════════════\n\n';
    informeTexto += `Fecha de generación: ${new Date().toLocaleString('es-ES')}\n`;
    informeTexto += `Total de pedidos: ${informe.totalPedidos}\n\n`;

    informe.pedidos.forEach((pedido, index) => {
      informeTexto += '═══════════════════════════════════════════════════════════════\n';
      informeTexto += `PEDIDO #${index + 1} - ID: ${pedido.id}\n`;
      informeTexto += '═══════════════════════════════════════════════════════════════\n\n';
      
      informeTexto += `Número de pedido: ${pedido.numero}\n`;
      informeTexto += `Serie: ${pedido.serie}\n`;
      informeTexto += `Fecha de pedido: ${pedido.fechaPedido || '—'}\n`;
      informeTexto += `Fecha de entrega: ${pedido.fechaEntrega || '—'}\n`;
      informeTexto += `Estado: ${pedido.estado}\n`;
      informeTexto += `Observaciones: ${pedido.observaciones || '—'}\n\n`;

      if (pedido.cliente) {
        informeTexto += `CLIENTE:\n`;
        informeTexto += `  ID: ${pedido.cliente.id}\n`;
        informeTexto += `  Nombre: ${pedido.cliente.nombre}\n`;
        informeTexto += `  DNI/CIF: ${pedido.cliente.dni_cif}\n`;
        informeTexto += `  Email: ${pedido.cliente.email}\n`;
        informeTexto += `  Teléfono: ${pedido.cliente.telefono}\n\n`;
      }

      if (pedido.comercial) {
        informeTexto += `COMERCIAL:\n`;
        informeTexto += `  ID: ${pedido.comercial.id}\n`;
        informeTexto += `  Nombre: ${pedido.comercial.nombre}\n`;
        informeTexto += `  Email: ${pedido.comercial.email}\n\n`;
      }

      if (pedido.formaPago) {
        informeTexto += `FORMA DE PAGO:\n`;
        informeTexto += `  ${pedido.formaPago.nombre} (${pedido.formaPago.dias} días)\n\n`;
      }

      if (pedido.tipoPedido) {
        informeTexto += `TIPO DE PEDIDO:\n`;
        informeTexto += `  ${pedido.tipoPedido.tipo}\n\n`;
      }

      if (pedido.cooperativa.numero || pedido.cooperativa.nombre) {
        informeTexto += `COOPERATIVA:\n`;
        informeTexto += `  Nombre: ${pedido.cooperativa.nombre || '—'}\n`;
        informeTexto += `  Número de asociado: ${pedido.cooperativa.numero || '—'}\n\n`;
      }

      informeTexto += `TOTALES:\n`;
      informeTexto += `  Base imponible: € ${pedido.totales.baseImponible.toFixed(2)}\n`;
      informeTexto += `  Total descuento: € ${pedido.totales.totalDescuento.toFixed(2)}\n`;
      informeTexto += `  Total IVA: € ${pedido.totales.totalIva.toFixed(2)}\n`;
      informeTexto += `  Total pedido: € ${pedido.totales.totalPedido.toFixed(2)}\n\n`;

      informeTexto += `LÍNEAS DE PEDIDO (${pedido.lineas.cantidad}):\n`;
      if (pedido.lineas.items.length === 0) {
        informeTexto += `  — No hay líneas asociadas\n\n`;
      } else {
        pedido.lineas.items.forEach((linea, idx) => {
          const subtotalSinDescuento = linea.cantidad * linea.precio;
          const descuentoValor = subtotalSinDescuento * (linea.descuento / 100);
          const subtotalConDescuento = subtotalSinDescuento - descuentoValor;
          const ivaValor = subtotalConDescuento * (linea.iva / 100);
          const totalLinea = subtotalConDescuento + ivaValor;

          informeTexto += `\n  Línea ${idx + 1}:\n`;
          informeTexto += `    ID: ${linea.id}\n`;
          informeTexto += `    Artículo ID: ${linea.articuloId}\n`;
          informeTexto += `    Artículo: ${linea.articulo}\n`;
          informeTexto += `    Cantidad: ${linea.cantidad}\n`;
          informeTexto += `    Precio unitario: € ${linea.precio.toFixed(2)}\n`;
          informeTexto += `    Descuento: ${linea.descuento}%\n`;
          informeTexto += `    IVA: ${linea.iva}%\n`;
          informeTexto += `    Subtotal: € ${linea.subtotal.toFixed(2)}\n`;
          informeTexto += `    Total línea: € ${totalLinea.toFixed(2)}\n`;
        });
        informeTexto += '\n';
      }

      informeTexto += '\n';
    });

    // Resumen final
    const totalBaseImponible = informe.pedidos.reduce((sum, p) => sum + p.totales.baseImponible, 0);
    const totalDescuentos = informe.pedidos.reduce((sum, p) => sum + p.totales.totalDescuento, 0);
    const totalIva = informe.pedidos.reduce((sum, p) => sum + p.totales.totalIva, 0);
    const totalPedidos = informe.pedidos.reduce((sum, p) => sum + p.totales.totalPedido, 0);
    const totalLineas = informe.pedidos.reduce((sum, p) => sum + p.lineas.cantidad, 0);

    informeTexto += '═══════════════════════════════════════════════════════════════\n';
    informeTexto += '                        RESUMEN GENERAL\n';
    informeTexto += '═══════════════════════════════════════════════════════════════\n\n';
    informeTexto += `Total de pedidos: ${informe.totalPedidos}\n`;
    informeTexto += `Total de líneas: ${totalLineas}\n`;
    informeTexto += `Base imponible total: € ${totalBaseImponible.toFixed(2)}\n`;
    informeTexto += `Total descuentos: € ${totalDescuentos.toFixed(2)}\n`;
    informeTexto += `Total IVA: € ${totalIva.toFixed(2)}\n`;
    informeTexto += `Total pedidos: € ${totalPedidos.toFixed(2)}\n\n`;

    // Guardar informe en texto
    const archivoTexto = path.join(__dirname, `informe-pedidos-${fechaArchivo}.txt`);
    fs.writeFileSync(archivoTexto, informeTexto, 'utf8');
    console.log(`✅ Informe texto guardado en: ${archivoTexto}`);

    // Mostrar resumen en consola
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                        RESUMEN');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total de pedidos: ${informe.totalPedidos}`);
    console.log(`Total de líneas: ${totalLineas}`);
    console.log(`Base imponible total: € ${totalBaseImponible.toFixed(2)}`);
    console.log(`Total descuentos: € ${totalDescuentos.toFixed(2)}`);
    console.log(`Total IVA: € ${totalIva.toFixed(2)}`);
    console.log(`Total pedidos: € ${totalPedidos.toFixed(2)}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('✅ Informe generado correctamente');
    console.log(`📄 Archivos generados:`);
    console.log(`   - ${archivoJson}`);
    console.log(`   - ${archivoTexto}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generando informe:', error.message);
    console.error('❌ Stack:', error.stack);
    process.exit(1);
  }
})();

