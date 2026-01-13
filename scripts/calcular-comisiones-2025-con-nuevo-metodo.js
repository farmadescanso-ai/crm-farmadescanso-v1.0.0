// Script para calcular comisiones para 2025 usando el nuevo método basado en tablas de configuración
// Aplica a: Cristina Rico (ID: 4) y Jesús F. Ros (ID: 2) para Noviembre y Diciembre 2025
const mysql = require('mysql2/promise');
const comisionesCRM = require('../config/mysql-crm-comisiones');
require('dotenv').config();

class CalculadorComisionesConTablas {
  constructor(connection) {
    this.connection = connection;
  }

  /**
   * Obtener porcentaje de comisión por tipo de pedido desde la tabla de configuración
   */
  async obtenerPorcentajeComision(marca, tipoPedidoNombre, año) {
    try {
      // Normalizar tipo de pedido
      const tipoNormalizado = tipoPedidoNombre.toLowerCase().trim();
      let nombreTipoBuscar = null;
      
      if (tipoNormalizado.includes('transfer')) {
        nombreTipoBuscar = 'Transfer';
      } else if (tipoNormalizado.includes('directo') || tipoNormalizado === 'normal' || tipoNormalizado === '') {
        nombreTipoBuscar = 'Directo';
      } else {
        nombreTipoBuscar = tipoPedidoNombre || 'Directo';
      }

      // Buscar configuración específica de marca primero
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

      // Si no hay específica, buscar general (marca = NULL)
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

      // Si no hay configuración, usar valores por defecto antiguos
      console.log(`⚠️  No se encontró configuración para ${nombreTipoBuscar} en ${año}, usando valores por defecto`);
      if (nombreTipoBuscar === 'Transfer') return 5;
      return 15; // Directo/Normal
    } catch (error) {
      console.error(`❌ Error obteniendo porcentaje comisión: ${error.message}`);
      // Valores por defecto
      return nombreTipoBuscar === 'Transfer' ? 5 : 15;
    }
  }

  /**
   * Obtener porcentaje de descuento de transporte desde la tabla de configuración
   */
  async obtenerDescuentoTransporte(marca, año) {
    try {
      // Buscar configuración específica de marca
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

      // Buscar general
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

      // Por defecto 10% (valor antiguo)
      return 10;
    } catch (error) {
      console.error(`❌ Error obteniendo descuento transporte: ${error.message}`);
      return 10;
    }
  }

  /**
   * Obtener porcentaje de rappel por presupuesto
   */
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

      // Por defecto 1% (valor antiguo)
      return 1;
    } catch (error) {
      console.error(`❌ Error obteniendo rappel presupuesto: ${error.message}`);
      return 1;
    }
  }

  /**
   * Obtener pedidos del mes
   */
  async obtenerPedidosDelMes(comercialId, mes, año) {
    // Obtener pedidos con tipo de pedido desde tabla tipos_pedidos
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

  /**
   * Obtener líneas de pedido
   */
  async obtenerLineasPedido(pedidoId) {
    // La tabla pedidos_articulos usa Id_NumPedido para relacionar con pedidos.id
    const [lineas] = await this.connection.query(`
      SELECT pa.*, a.Id_Marca, m.Nombre as MarcaNombre
      FROM pedidos_articulos pa
      INNER JOIN Articulos a ON pa.Id_Articulo = a.id
      LEFT JOIN Marcas m ON a.Id_Marca = m.id
      WHERE pa.Id_NumPedido = ?
    `, [pedidoId]);
    
    return lineas;
  }

  /**
   * Calcular comisión de ventas usando configuraciones de tabla
   */
  async calcularComisionVentas(comercialId, mes, año) {
    console.log(`\n🔄 Calculando comisión de ventas para comercial ${comercialId}, ${mes}/${año}`);

    const pedidos = await this.obtenerPedidosDelMes(comercialId, mes, año);
    console.log(`   📦 ${pedidos.length} pedidos encontrados`);

    let totalBaseImponible = 0;
    let totalComision = 0;
    const detalles = [];

    for (const pedido of pedidos) {
      const lineas = await this.obtenerLineasPedido(pedido.id);
      const tipoPedidoNombre = pedido.TipoPedidoNombre || '';
      
      // Calcular transporte
      const totalPedido = parseFloat(pedido.TotalPedido || 0);
      const baseImponiblePedido = parseFloat(pedido.BaseImponible || 0);
      const totalIvaPedido = parseFloat(pedido.TotalIva || 0);
      const transporte = totalPedido - baseImponiblePedido - totalIvaPedido;

      // Calcular base imponible total del pedido
      let baseImponibleTotalPedido = 0;
      for (const linea of lineas) {
        baseImponibleTotalPedido += parseFloat(linea.Subtotal || linea.subtotal || 0);
      }

        // Obtener descuento de transporte desde configuración
        // Usamos la primera marca del pedido para buscar la configuración
        const primeraMarca = lineas.length > 0 ? (lineas[0].MarcaNombre || null) : null;
        const descuentoTransportePorcentaje = await this.obtenerDescuentoTransporte(primeraMarca, año);
        const descuentoTransporte = transporte > 0 && descuentoTransportePorcentaje > 0 
          ? (transporte * descuentoTransportePorcentaje) / 100 
          : 0;

      for (const linea of lineas) {
        // pedidos_articulos usa 'Subtotal' o 'subtotal'
        let baseImponible = parseFloat(linea.Subtotal || linea.subtotal || 0);
        const marcaNombre = linea.MarcaNombre || null;

        // Aplicar descuento de transporte proporcionalmente
        if (baseImponibleTotalPedido > 0 && descuentoTransporte > 0) {
          const proporcion = baseImponible / baseImponibleTotalPedido;
          const descuentoLinea = descuentoTransporte * proporcion;
          baseImponible = baseImponible - descuentoLinea;
        }

        totalBaseImponible += baseImponible;

        // Obtener porcentaje desde tabla de configuración
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

  /**
   * Calcular rappel por presupuesto usando configuración de tabla
   */
  async calcularRappelPresupuesto(comercialId, mes, año) {
    // Determinar trimestre
    const trimestre = Math.floor((mes - 1) / 3) + 1;
    const mesInicioTrimestre = (trimestre - 1) * 3 + 1;

    // Obtener ventas acumuladas del trimestre
    let ventasAcumuladas = 0;
    for (let m = mesInicioTrimestre; m <= mes; m++) {
      const comisionVentas = await this.calcularComisionVentas(comercialId, m, año);
      ventasAcumuladas += comisionVentas.total_ventas;
    }

    // Obtener presupuesto acumulado del trimestre
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
        // Presupuesto anual, dividir entre 4 trimestres
        presupuestoAcumulado += parseFloat(presupuesto.importe_presupuestado || 0) / 4;
      }
    }

    if (ventasAcumuladas > presupuestoAcumulado) {
      // Usar primera marca para buscar configuración (simplificado)
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

  /**
   * Obtener fijo mensual por marca desde tabla
   */
  async obtenerFijoMensual(comercialId, marcaId) {
    try {
      const fijo = await comisionesCRM.getFijoMensualMarca(comercialId, marcaId);
      return fijo ? parseFloat(fijo.importe || 0) : 0;
    } catch (error) {
      console.error(`❌ Error obteniendo fijo mensual: ${error.message}`);
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

    // Insertar configuraciones para 2025 (valores antiguos)
    console.log('📝 Insertando configuraciones para 2025...\n');
    await connection.query(`
      INSERT INTO config_comisiones_tipo_pedido (marca, nombre_tipo_pedido, porcentaje_comision, descripcion, activo, año_aplicable)
      VALUES 
        (NULL, 'Transfer', 5.00, 'Comisión Transfer 2025 - 5%', 1, 2025),
        (NULL, 'Directo', 15.00, 'Comisión Directo 2025 - 15%', 1, 2025),
        (NULL, 'Normal', 15.00, 'Comisión Normal 2025 - 15%', 1, 2025)
      ON DUPLICATE KEY UPDATE porcentaje_comision = VALUES(porcentaje_comision)
    `);

    await connection.query(`
      INSERT INTO config_rappel_presupuesto (marca, porcentaje_rappel, descripcion, activo, año_aplicable)
      VALUES (NULL, 1.00, 'Rappel Presupuesto 2025 - 1%', 1, 2025)
      ON DUPLICATE KEY UPDATE porcentaje_rappel = VALUES(porcentaje_rappel)
    `);

    await connection.query(`
      INSERT INTO config_descuento_transporte (marca, porcentaje_descuento, descripcion, activo, año_aplicable)
      VALUES (NULL, 10.00, 'Descuento Transporte 2025 - 10%', 1, 2025)
      ON DUPLICATE KEY UPDATE porcentaje_descuento = VALUES(porcentaje_descuento)
    `);

    console.log('✅ Configuraciones 2025 insertadas\n');

    const calculador = new CalculadorComisionesConTablas(connection);

    const comerciales = [
      { id: 4, nombre: 'Cristina Rico' },
      { id: 2, nombre: 'Jesús F. Ros' }
    ];

    const meses = [11, 12]; // Noviembre y Diciembre
    const año = 2025;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 CÁLCULO DE COMISIONES CON NUEVO MÉTODO');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const comercial of comerciales) {
      console.log(`\n👤 COMERCIAL: ${comercial.nombre} (ID: ${comercial.id})`);
      console.log('═══════════════════════════════════════════════════════════\n');

      for (const mes of meses) {
        const nombreMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mes - 1];

        console.log(`📅 ${nombreMes} ${año}:`);
        console.log('───────────────────────────────────────────────────────────');

        // Calcular comisión de ventas
        const comisionVentas = await calculador.calcularComisionVentas(comercial.id, mes, año);
        console.log(`   💰 Ventas (Base Imponible): ${comisionVentas.total_ventas.toFixed(2)}€`);
        console.log(`   💵 Comisión por Ventas: ${comisionVentas.total_comision.toFixed(2)}€`);

        // Calcular rappel presupuesto
        const rappel = await calculador.calcularRappelPresupuesto(comercial.id, mes, año);
        if (rappel.rappel > 0) {
          console.log(`   🎯 Rappel Presupuesto (${rappel.porcentaje_rappel}%): ${rappel.rappel.toFixed(2)}€`);
          console.log(`      Ventas acumuladas T${Math.floor((mes - 1) / 3) + 1}: ${rappel.ventas_acumuladas.toFixed(2)}€`);
          console.log(`      Presupuesto acumulado: ${rappel.presupuesto_acumulado.toFixed(2)}€`);
        } else {
          console.log(`   🎯 Rappel Presupuesto: 0€ (no se supera presupuesto)`);
        }

        // Obtener fijos mensuales por marca
        const [marcas] = await connection.query('SELECT id, Nombre FROM Marcas');
        let totalFijo = 0;
        for (const marca of marcas) {
          const fijo = await calculador.obtenerFijoMensual(comercial.id, marca.id);
          if (fijo > 0) {
            console.log(`   📌 Fijo ${marca.Nombre}: ${fijo.toFixed(2)}€`);
            totalFijo += fijo;
          }
        }
        if (totalFijo > 0) {
          console.log(`   📌 Total Fijo Mensual: ${totalFijo.toFixed(2)}€`);
        }

        const totalComision = comisionVentas.total_comision + rappel.rappel + totalFijo;
        console.log(`\n   ✅ TOTAL COMISIÓN: ${totalComision.toFixed(2)}€\n`);
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
