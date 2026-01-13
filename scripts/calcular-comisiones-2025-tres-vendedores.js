// Script para calcular comisiones para 2025 usando el nuevo método basado en tablas
// Aplica a: Cristina Rico (ID: 4), Jesús F. Ros (ID: 2), y Antonio Luque (ID: 8)
// Incluye cálculos para ambas marcas: IALZON y YOUBELLE
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

      // Valores por defecto
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

      return 10; // Por defecto 10%
    } catch (error) {
      console.error(`❌ Error obteniendo descuento transporte: ${error.message}`);
      return 10;
    }
  }

  async obtenerRappelPresupuesto(marca, año) {
    try {
      if (marca) {
        const [configMarca] = await this.connection.query(`
          SELECT porcentaje_rappel, activo
          FROM config_rappel_presupuesto
          WHERE marca = ?
          AND año_aplicable = ?
          AND activo = 1
          LIMIT 1
        `, [marca.toUpperCase(), año]);

        if (configMarca && configMarca.length > 0) {
          return parseFloat(configMarca[0].porcentaje_rappel);
        }
      }

      const [configGeneral] = await this.connection.query(`
        SELECT porcentaje_rappel, activo
        FROM config_rappel_presupuesto
        WHERE marca IS NULL
        AND año_aplicable = ?
        AND activo = 1
        LIMIT 1
      `, [año]);

      if (configGeneral && configGeneral.length > 0) {
        return parseFloat(configGeneral[0].porcentaje_rappel);
      }

      return 1; // Por defecto 1%
    } catch (error) {
      console.error(`❌ Error obteniendo rappel presupuesto: ${error.message}`);
      return 1;
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

  async calcularComisionVentasPorMarca(comercialId, mes, año, marcaId = null) {
    const pedidos = await this.obtenerPedidosDelMes(comercialId, mes, año);
    
    let totalBaseImponible = 0;
    let totalComision = 0;
    const detalles = [];

    for (const pedido of pedidos) {
      const lineas = await this.obtenerLineasPedido(pedido.id);
      const tipoPedidoNombre = pedido.TipoPedidoNombre || '';
      
      // Filtrar por marca si se especifica
      let lineasFiltradas = lineas;
      if (marcaId) {
        lineasFiltradas = lineas.filter(l => l.Id_Marca === marcaId);
      }

      const transporte = parseFloat(pedido.TotalPedido || 0) - 
                        parseFloat(pedido.BaseImponible || 0) - 
                        parseFloat(pedido.TotalIva || 0);

      let baseImponibleTotalPedido = 0;
      for (const linea of lineasFiltradas) {
        baseImponibleTotalPedido += parseFloat(linea.Subtotal || linea.subtotal || 0);
      }

      const primeraMarca = lineasFiltradas.length > 0 ? (lineasFiltradas[0].MarcaNombre || null) : null;
      const descuentoTransportePorcentaje = await this.obtenerDescuentoTransporte(primeraMarca, año);
      const descuentoTransporte = transporte > 0 && descuentoTransportePorcentaje > 0 
        ? (transporte * descuentoTransportePorcentaje) / 100 
        : 0;

      for (const linea of lineasFiltradas) {
        let baseImponible = parseFloat(linea.Subtotal || linea.subtotal || 0);
        const marcaNombre = linea.MarcaNombre || null;

        // Aplicar descuento de transporte proporcionalmente
        if (baseImponibleTotalPedido > 0 && descuentoTransporte > 0) {
          const proporcion = baseImponible / baseImponibleTotalPedido;
          const descuentoLinea = descuentoTransporte * proporcion;
          baseImponible = baseImponible - descuentoLinea;
        }

        totalBaseImponible += baseImponible;

        const porcentajeComision = await this.obtenerPorcentajeComision(
          marcaNombre,
          tipoPedidoNombre,
          año
        );

        const importeComision = (baseImponible * porcentajeComision) / 100;
        totalComision += importeComision;

        detalles.push({
          pedido_id: pedido.id,
          tipo_pedido: tipoPedidoNombre,
          marca: marcaNombre,
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

  async calcularRappelPresupuesto(comercialId, mes, año) {
    const trimestre = Math.floor((mes - 1) / 3) + 1;
    const mesInicioTrimestre = (trimestre - 1) * 3 + 1;

    let ventasAcumuladas = 0;
    for (let m = mesInicioTrimestre; m <= mes; m++) {
      const comisionVentas = await this.calcularComisionVentasPorMarca(comercialId, m, año);
      ventasAcumuladas += comisionVentas.total_ventas;
    }

    const presupuestos = await comisionesCRM.getPresupuestos({
      comercial_id: comercialId,
      año: año,
      activo: 1
    });

    let presupuestoAcumulado = 0;
    for (const presupuesto of presupuestos) {
      if (presupuesto.mes && presupuesto.mes >= mesInicioTrimestre && presupuesto.mes <= mes) {
        presupuestoAcumulado += parseFloat(presupuesto.importe_presupuestado || 0);
      } else if (!presupuesto.mes) {
        presupuestoAcumulado += parseFloat(presupuesto.importe_presupuestado || 0) / 4;
      }
    }

    if (ventasAcumuladas > presupuestoAcumulado) {
      const porcentajeRappel = await this.obtenerRappelPresupuesto(null, año);
      const rappel = (ventasAcumuladas * porcentajeRappel) / 100;

      return {
        ventas_acumuladas: ventasAcumuladas,
        presupuesto_acumulado: presupuestoAcumulado,
        porcentaje_rappel: porcentajeRappel,
        rappel: rappel
      };
    }

    return {
      ventas_acumuladas: ventasAcumuladas,
      presupuesto_acumulado: presupuestoAcumulado,
      porcentaje_rappel: 0,
      rappel: 0
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

    const comerciales = [
      { id: 4, nombre: 'Cristina Rico' },
      { id: 2, nombre: 'Jesús F. Ros' },
      { id: 8, nombre: 'Antonio Luque' }
    ];

    const meses = [11, 12]; // Noviembre y Diciembre
    const año = 2025;

    // Obtener IDs de marcas
    const [marcas] = await connection.query('SELECT id, Nombre FROM Marcas ORDER BY id');
    const marcaIalozon = marcas.find(m => m.Nombre.toLowerCase() === 'ialozon' || m.Nombre.toLowerCase() === 'ialozon');
    const marcaYoubelle = marcas.find(m => m.Nombre.toLowerCase() === 'youbelle');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 CÁLCULO DE COMISIONES 2025 - TRES VENDEDORES');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Configuración aplicada:');
    console.log('  - Transfer: 5%');
    console.log('  - Directo: 10%');
    console.log('  - Descuento Transporte: 10%');
    console.log('  - Rappel Presupuesto: 1%');
    console.log('\n');

    for (const comercial of comerciales) {
      console.log(`\n👤 COMERCIAL: ${comercial.nombre} (ID: ${comercial.id})`);
      console.log('═══════════════════════════════════════════════════════════\n');

      for (const mes of meses) {
        const nombreMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mes - 1];

        console.log(`📅 ${nombreMes} ${año}:`);
        console.log('───────────────────────────────────────────────────────────');

        // Calcular por marca IALZON
        if (marcaIalozon) {
          console.log(`\n   📦 IALZON:`);
          const comisionIalozon = await calculador.calcularComisionVentasPorMarca(
            comercial.id, mes, año, marcaIalozon.id
          );
          const fijoIalozon = await calculador.obtenerFijoMensual(comercial.id, marcaIalozon.id);
          
          console.log(`      💰 Ventas: ${comisionIalozon.total_ventas.toFixed(2)}€`);
          console.log(`      💵 Comisión: ${comisionIalozon.total_comision.toFixed(2)}€`);
          if (fijoIalozon > 0) {
            console.log(`      📌 Fijo: ${fijoIalozon.toFixed(2)}€`);
          }
          console.log(`      ✅ Subtotal IALZON: ${(comisionIalozon.total_comision + fijoIalozon).toFixed(2)}€`);
        }

        // Calcular por marca YOUBELLE
        if (marcaYoubelle) {
          console.log(`\n   📦 YOUBELLE:`);
          const comisionYoubelle = await calculador.calcularComisionVentasPorMarca(
            comercial.id, mes, año, marcaYoubelle.id
          );
          const fijoYoubelle = await calculador.obtenerFijoMensual(comercial.id, marcaYoubelle.id);
          
          console.log(`      💰 Ventas: ${comisionYoubelle.total_ventas.toFixed(2)}€`);
          console.log(`      💵 Comisión: ${comisionYoubelle.total_comision.toFixed(2)}€`);
          if (fijoYoubelle > 0) {
            console.log(`      📌 Fijo: ${fijoYoubelle.toFixed(2)}€`);
          }
          console.log(`      ✅ Subtotal YOUBELLE: ${(comisionYoubelle.total_comision + fijoYoubelle).toFixed(2)}€`);
        }

        // Calcular total sin marca (todas las marcas)
        const comisionTotal = await calculador.calcularComisionVentasPorMarca(comercial.id, mes, año);
        const rappel = await calculador.calcularRappelPresupuesto(comercial.id, mes, año);

        // Obtener fijos totales
        let totalFijo = 0;
        for (const marca of marcas) {
          const fijo = await calculador.obtenerFijoMensual(comercial.id, marca.id);
          totalFijo += fijo;
        }

        console.log(`\n   📊 RESUMEN TOTAL:`);
        console.log(`      💰 Ventas Total: ${comisionTotal.total_ventas.toFixed(2)}€`);
        console.log(`      💵 Comisión Ventas: ${comisionTotal.total_comision.toFixed(2)}€`);
        if (rappel.rappel > 0) {
          console.log(`      🎯 Rappel Presupuesto (${rappel.porcentaje_rappel}%): ${rappel.rappel.toFixed(2)}€`);
        }
        if (totalFijo > 0) {
          console.log(`      📌 Fijo Mensual Total: ${totalFijo.toFixed(2)}€`);
        }
        
        const totalFinal = comisionTotal.total_comision + rappel.rappel + totalFijo;
        console.log(`\n   ✅ TOTAL COMISIÓN ${nombreMes}: ${totalFinal.toFixed(2)}€\n`);
      }
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Cálculo completado');
    console.log('═══════════════════════════════════════════════════════════\n');

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
