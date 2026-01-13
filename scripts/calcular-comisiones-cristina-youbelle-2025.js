// Script para calcular comisiones de Cristina Rico para la marca YOUBELLE en 2025
const mysql = require('mysql2/promise');
const comisionesCRM = require('../config/mysql-crm-comisiones');
require('dotenv').config();

class CalculadorComisionesConTablas {
  constructor(connection) {
    this.connection = connection;
  }

  async obtenerPorcentajeComision(marca, tipoPedidoNombre, año) {
    try {
      const tipoNormalizado = tipoPedidoNombre.toLowerCase().trim();
      let nombreTipoBuscar = null;
      
      if (tipoNormalizado.includes('transfer')) {
        nombreTipoBuscar = 'Transfer';
      } else if (tipoNormalizado.includes('directo') || tipoNormalizado === 'normal' || tipoNormalizado === '') {
        nombreTipoBuscar = 'Directo';
      } else {
        nombreTipoBuscar = tipoPedidoNombre || 'Directo';
      }

      if (marca) {
        const [configMarca] = await this.connection.query(`
          SELECT porcentaje_comision, activo
          FROM config_comisiones_tipo_pedido
          WHERE marca = ? 
          AND nombre_tipo_pedido = ?
          AND año_aplicable = ?
          AND activo = 1
          LIMIT 1
        `, [marca.toUpperCase(), nombreTipoBuscar, año]);
        
        if (configMarca && configMarca.length > 0) {
          return parseFloat(configMarca[0].porcentaje_comision);
        }
      }

      const [configGeneral] = await this.connection.query(`
        SELECT porcentaje_comision, activo
        FROM config_comisiones_tipo_pedido
        WHERE marca IS NULL
        AND nombre_tipo_pedido = ?
        AND año_aplicable = ?
        AND activo = 1
        LIMIT 1
      `, [nombreTipoBuscar, año]);

      if (configGeneral && configGeneral.length > 0) {
        return parseFloat(configGeneral[0].porcentaje_comision);
      }

      return nombreTipoBuscar === 'Transfer' ? 5 : 10;
    } catch (error) {
      console.error(`❌ Error obteniendo porcentaje comisión: ${error.message}`);
      return tipoPedidoNombre.toLowerCase().includes('transfer') ? 5 : 10;
    }
  }

  async obtenerDescuentoTransporte(marca, año) {
    try {
      if (marca) {
        const [configMarca] = await this.connection.query(`
          SELECT porcentaje_descuento, activo
          FROM config_descuento_transporte
          WHERE marca = ?
          AND año_aplicable = ?
          AND activo = 1
          LIMIT 1
        `, [marca.toUpperCase(), año]);

        if (configMarca && configMarca.length > 0) {
          return parseFloat(configMarca[0].porcentaje_descuento);
        }
      }

      const [configGeneral] = await this.connection.query(`
        SELECT porcentaje_descuento, activo
        FROM config_descuento_transporte
        WHERE marca IS NULL
        AND año_aplicable = ?
        AND activo = 1
        LIMIT 1
      `, [año]);

      if (configGeneral && configGeneral.length > 0) {
        return parseFloat(configGeneral[0].porcentaje_descuento);
      }

      return 10;
    } catch (error) {
      console.error(`❌ Error obteniendo descuento transporte: ${error.message}`);
      return 10;
    }
  }

  async obtenerPedidosDelMes(comercialId, mes, año) {
    const [pedidos] = await this.connection.query(`
      SELECT p.*, COALESCE(tp.Tipo, '') as TipoPedidoNombre
      FROM Pedidos p
      LEFT JOIN tipos_pedidos tp ON p.Id_TipoPedido = tp.id
      WHERE p.Id_Cial = ?
      AND YEAR(p.FechaPedido) = ?
      AND MONTH(p.FechaPedido) = ?
      ORDER BY p.FechaPedido
    `, [comercialId, año, mes]);
    
    return pedidos;
  }

  async obtenerLineasPedido(pedidoId) {
    const [lineas] = await this.connection.query(`
      SELECT pa.*, a.Id_Marca, m.Nombre as MarcaNombre
      FROM pedidos_articulos pa
      INNER JOIN Articulos a ON pa.Id_Articulo = a.id
      LEFT JOIN Marcas m ON a.Id_Marca = m.id
      WHERE pa.Id_NumPedido = ?
    `, [pedidoId]);
    
    return lineas;
  }

  async calcularComisionVentasPorMarca(comercialId, mes, año, marcaId) {
    const pedidos = await this.obtenerPedidosDelMes(comercialId, mes, año);
    
    let totalBaseImponible = 0;
    let totalComision = 0;
    const detalles = [];

    for (const pedido of pedidos) {
      const lineas = await this.obtenerLineasPedido(pedido.id);
      const tipoPedidoNombre = pedido.TipoPedidoNombre || '';
      
      // Filtrar SOLO las líneas de la marca YOUBELLE
      const lineasFiltradas = lineas.filter(l => l.Id_Marca === marcaId);

      if (lineasFiltradas.length === 0) continue;

      const transporte = parseFloat(pedido.TotalPedido || 0) - 
                        parseFloat(pedido.BaseImponible || 0) - 
                        parseFloat(pedido.TotalIva || 0);

      // Calcular base imponible total del pedido solo para YOUBELLE
      let baseImponibleTotalPedido = 0;
      for (const linea of lineasFiltradas) {
        baseImponibleTotalPedido += parseFloat(linea.Subtotal || linea.subtotal || 0);
      }

      // Para calcular el descuento de transporte proporcional, necesitamos 
      // la base imponible total del pedido (todas las marcas)
      let baseImponibleTotalPedidoCompleto = 0;
      for (const linea of lineas) {
        baseImponibleTotalPedidoCompleto += parseFloat(linea.Subtotal || linea.subtotal || 0);
      }

      const primeraMarca = lineasFiltradas.length > 0 ? (lineasFiltradas[0].MarcaNombre || null) : null;
      const descuentoTransportePorcentaje = await this.obtenerDescuentoTransporte(primeraMarca, año);
      
      // Calcular descuento de transporte proporcional a YOUBELLE
      let descuentoTransporteYOUBELLE = 0;
      if (transporte > 0 && descuentoTransportePorcentaje > 0 && baseImponibleTotalPedidoCompleto > 0) {
        const descuentoTransporteTotal = (transporte * descuentoTransportePorcentaje) / 100;
        // Proporción de YOUBELLE en el pedido
        const proporcionYOUBELLE = baseImponibleTotalPedido / baseImponibleTotalPedidoCompleto;
        descuentoTransporteYOUBELLE = descuentoTransporteTotal * proporcionYOUBELLE;
      }

      for (const linea of lineasFiltradas) {
        let baseImponible = parseFloat(linea.Subtotal || linea.subtotal || 0);

        // Aplicar descuento de transporte proporcionalmente
        if (baseImponibleTotalPedido > 0 && descuentoTransporteYOUBELLE > 0) {
          const proporcion = baseImponible / baseImponibleTotalPedido;
          const descuentoLinea = descuentoTransporteYOUBELLE * proporcion;
          baseImponible = baseImponible - descuentoLinea;
        }

        totalBaseImponible += baseImponible;

        const porcentajeComision = await this.obtenerPorcentajeComision(
          primeraMarca,
          tipoPedidoNombre,
          año
        );

        const importeComision = (baseImponible * porcentajeComision) / 100;
        totalComision += importeComision;

        detalles.push({
          pedido_id: pedido.id,
          numero_pedido: pedido.NumPedido || pedido.Numero_Pedido || `PED-${pedido.id}`,
          fecha_pedido: pedido.FechaPedido,
          tipo_pedido: tipoPedidoNombre,
          marca: primeraMarca,
          porcentaje: porcentajeComision,
          base_imponible: baseImponible,
          comision: importeComision
        });
      }
    }

    return {
      total_ventas: totalBaseImponible,
      total_comision: totalComision,
      detalles: detalles
    };
  }

  async obtenerFijoMensual(comercialId, marcaId) {
    try {
      const fijo = await comisionesCRM.getFijoMensualMarca(comercialId, marcaId);
      return fijo ? parseFloat(fijo.importe || 0) : 0;
    } catch (error) {
      return 0;
    }
  }
}

async function main() {
  let connection;

  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      charset: 'utf8mb4'
    };

    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado\n');

    const calculador = new CalculadorComisionesConTablas(connection);

    const comercialId = 4; // Cristina Rico
    const año = 2025;

    // Obtener ID de marca YOUBELLE
    const [marcas] = await connection.query('SELECT id, Nombre FROM Marcas ORDER BY id');
    const marcaYoubelle = marcas.find(m => m.Nombre.toLowerCase() === 'youbelle');

    if (!marcaYoubelle) {
      console.error('❌ No se encontró la marca YOUBELLE');
      process.exit(1);
    }

    // Obtener nombre del comercial
    const [comerciales] = await connection.query('SELECT Nombre FROM comerciales WHERE id = ?', [comercialId]);
    const nombreComercial = comerciales[0]?.Nombre || `Comercial ID ${comercialId}`;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 COMISIONES YOUBELLE - CRISTINA RICO 2025');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Comercial: ${nombreComercial} (ID: ${comercialId})`);
    console.log(`Marca: YOUBELLE (ID: ${marcaYoubelle.id})`);
    console.log(`Año: ${año}`);
    console.log('\nConfiguración aplicada:');
    console.log('  - Transfer: 5%');
    console.log('  - Directo: 10%');
    console.log('  - Descuento Transporte: 10%');
    console.log('\n');

    const meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    let totalAnualVentas = 0;
    let totalAnualComision = 0;
    let totalAnualFijo = 0;

    for (let i = 0; i < meses.length; i++) {
      const mes = meses[i];
      const nombreMes = nombresMeses[i];

      console.log(`📅 ${nombreMes} ${año}:`);
      console.log('───────────────────────────────────────────────────────────');

      const comisionYoubelle = await calculador.calcularComisionVentasPorMarca(
        comercialId, mes, año, marcaYoubelle.id
      );
      
      const fijoYoubelle = await calculador.obtenerFijoMensual(comercialId, marcaYoubelle.id);

      console.log(`   💰 Ventas YOUBELLE: ${comisionYoubelle.total_ventas.toFixed(2)}€`);
      console.log(`   💵 Comisión YOUBELLE: ${comisionYoubelle.total_comision.toFixed(2)}€`);
      
      if (fijoYoubelle > 0) {
        console.log(`   📌 Fijo YOUBELLE: ${fijoYoubelle.toFixed(2)}€`);
      } else {
        console.log(`   📌 Fijo YOUBELLE: 0€ (sin fijo para YOUBELLE)`);
      }

      const totalMes = comisionYoubelle.total_comision + fijoYoubelle;
      console.log(`   ✅ TOTAL ${nombreMes}: ${totalMes.toFixed(2)}€`);

      // Mostrar detalles de pedidos si hay
      if (comisionYoubelle.detalles.length > 0) {
        console.log(`\n   📋 Detalles (${comisionYoubelle.detalles.length} líneas):`);
        const pedidosUnicos = [...new Set(comisionYoubelle.detalles.map(d => d.pedido_id))];
        pedidosUnicos.forEach(pedidoId => {
          const detallesPedido = comisionYoubelle.detalles.filter(d => d.pedido_id === pedidoId);
          const primerDetalle = detallesPedido[0];
          const sumaPedido = detallesPedido.reduce((sum, d) => sum + d.comision, 0);
          console.log(`      - Pedido ${primerDetalle.numero_pedido}: ${sumaPedido.toFixed(2)}€ (${primerDetalle.tipo_pedido || 'N/A'}, ${primerDetalle.porcentaje}%)`);
        });
      }

      totalAnualVentas += comisionYoubelle.total_ventas;
      totalAnualComision += comisionYoubelle.total_comision;
      totalAnualFijo += fijoYoubelle;

      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN ANUAL 2025');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`   💰 Ventas Totales YOUBELLE: ${totalAnualVentas.toFixed(2)}€`);
    console.log(`   💵 Comisión Total YOUBELLE: ${totalAnualComision.toFixed(2)}€`);
    console.log(`   📌 Fijo Total YOUBELLE: ${totalAnualFijo.toFixed(2)}€`);
    console.log(`   ✅ TOTAL COMISIÓN YOUBELLE 2025: ${(totalAnualComision + totalAnualFijo).toFixed(2)}€`);
    console.log('\n═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

main();
