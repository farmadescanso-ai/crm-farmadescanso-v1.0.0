// Funciones para calcular comisiones, presupuestos y rapeles
const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');

class CalculadorComisiones {
  /**
   * Calcular comisión por ventas según la lógica:
   * - Pedidos tipo Transfer: 5% de comisión
   * - Pedidos tipo Directo: 15% de comisión
   * - Puede haber condiciones especiales por artículo o comercial (tienen prioridad)
   */
  async calcularComisionVentas(comercialId, mes, año) {
    try {
      console.log(`🔄 Calculando comisión de ventas para comercial ${comercialId}, ${mes}/${año}`);

      // Obtener todos los pedidos del comercial en el mes
      const pedidos = await this.obtenerPedidosDelMes(comercialId, mes, año);
      
      let totalBaseImponible = 0;
      let totalComision = 0;
      const detalles = [];

      // Obtener condiciones especiales del comercial
      const condicionesEspeciales = await this.obtenerCondicionesEspeciales(comercialId);

      // Calcular comisiones por línea
      for (const pedido of pedidos) {
        const lineas = await this.obtenerLineasPedido(pedido.id);
        const tipoPedidoNombre = pedido.TipoPedidoNombre || '';
        
        // Calcular el transporte del pedido (diferencia entre TotalPedido y BaseImponible + TotalIva)
        const totalPedido = parseFloat(pedido.TotalPedido || pedido.total || 0);
        const baseImponiblePedido = parseFloat(pedido.BaseImponible || 0);
        const totalIvaPedido = parseFloat(pedido.TotalIva || 0);
        const transporte = totalPedido - baseImponiblePedido - totalIvaPedido;
        
        // Obtener descuento de transporte desde configuración
        // Usamos la primera marca del pedido para buscar la configuración (para calcular el descuento total)
        const primeraMarca = lineas.length > 0 ? (lineas[0].MarcaNombre || null) : null;
        const descuentoTransportePorcentaje = await comisionesCRM.getDescuentoTransporte(primeraMarca, año);
        const descuentoTransporte = transporte > 0 && descuentoTransportePorcentaje > 0 
          ? (transporte * descuentoTransportePorcentaje) / 100 
          : 0;
        
        // Calcular base imponible total del pedido para distribuir el descuento proporcionalmente
        let baseImponibleTotalPedido = 0;
        for (const linea of lineas) {
          baseImponibleTotalPedido += parseFloat(linea.Subtotal || linea.subtotal || 0);
        }
        
        for (const linea of lineas) {
          let baseImponible = parseFloat(linea.Subtotal || linea.subtotal || 0);
          
          // Descontar el 10% del transporte proporcionalmente de cada línea
          if (baseImponibleTotalPedido > 0 && descuentoTransporte > 0) {
            const proporcion = baseImponible / baseImponibleTotalPedido;
            const descuentoLinea = descuentoTransporte * proporcion;
            baseImponible = baseImponible - descuentoLinea;
          }
          
          totalBaseImponible += baseImponible;

          // Verificar si hay condición especial para este artículo
          const condicionEspecial = this.buscarCondicionEspecial(
            condicionesEspeciales,
            linea.articulo_id || linea.Id_Articulo,
            comercialId
          );

          // Obtener porcentaje de comisión desde configuración (considerando marca del artículo)
          const marcaNombre = linea.MarcaNombre || null;
          let porcentajeComision = await comisionesCRM.getPorcentajeComision(
            marcaNombre,
            tipoPedidoNombre,
            año
          );

          if (condicionEspecial) {
            // La condición especial tiene prioridad sobre el tipo de pedido
            porcentajeComision = parseFloat(condicionEspecial.porcentaje_comision || porcentajeComision);
          }

          const importeComision = (baseImponible * porcentajeComision) / 100;
          totalComision += importeComision;

          let observaciones = condicionEspecial 
            ? `Condición especial: ${condicionEspecial.descripcion || 'Comisión fija del ' + porcentajeComision + '% sobre Base Imponible para todos los artículos y comerciales'}`
            : `Tipo de pedido: ${pedido.TipoPedidoNombre || 'No especificado'} (${porcentajeComision}%)`;
          
          // Agregar información sobre descuento de transporte si aplica
          if (descuentoTransporte > 0) {
            const descuentoLinea = baseImponibleTotalPedido > 0 ? (descuentoTransporte * (parseFloat(linea.Subtotal || linea.subtotal || 0) / baseImponibleTotalPedido)) : 0;
            observaciones += ` | Base ajustada: -${descuentoLinea.toFixed(2)}€ (${descuentoTransportePorcentaje}% transporte)`;
          }

          detalles.push({
            pedido_id: pedido.id,
            articulo_id: linea.articulo_id || linea.Id_Articulo,
            cantidad: linea.Cantidad || linea.cantidad || 0,
            importe_venta: baseImponible,
            porcentaje_comision: porcentajeComision,
            importe_comision: importeComision,
            tipo_comision: 'Venta',
            observaciones: observaciones
          });
        }
      }

      return {
        total_ventas: totalBaseImponible,
        total_comision: totalComision,
        detalles: detalles
      };
    } catch (error) {
      console.error('❌ Error calculando comisión de ventas:', error);
      throw error;
    }
  }

  /**
   * Calcular comisión por cumplimiento de presupuesto
   * Si supera el presupuesto acumulado trimestral: 1% de rappel sobre el total de ventas acumuladas
   */
  async calcularComisionPresupuesto(comercialId, mes, año) {
    try {
      console.log(`🔄 Calculando comisión por presupuesto para comercial ${comercialId}, ${mes}/${año}`);

      // Determinar el trimestre
      const trimestre = Math.ceil(mes / 3);
      
      // Obtener presupuestos del trimestre
      // Primero buscar presupuestos mensuales específicos del mes
      const presupuestosMensuales = await comisionesCRM.getPresupuestos({
        comercial_id: comercialId,
        año: año,
        mes: mes,
        activo: 1
      });

      // Si no hay presupuestos mensuales, buscar presupuestos anuales (mes = null)
      let presupuestos = presupuestosMensuales;
      if (!presupuestosMensuales || presupuestosMensuales.length === 0) {
        presupuestos = await comisionesCRM.getPresupuestos({
          comercial_id: comercialId,
          año: año,
          mes: null,
          activo: 1
        });
      }

      // Calcular ventas acumuladas del trimestre hasta el mes actual
      let ventasAcumuladasTrimestre = 0;
      const mesesTrimestre = [];
      
      for (let m = (trimestre - 1) * 3 + 1; m <= mes; m++) {
        mesesTrimestre.push(m);
      }

      for (const m of mesesTrimestre) {
        const pedidos = await this.obtenerPedidosDelMes(comercialId, m, año);
        for (const pedido of pedidos) {
          // Calcular el transporte del pedido
          const totalPedido = parseFloat(pedido.TotalPedido || pedido.total || 0);
          const baseImponiblePedido = parseFloat(pedido.BaseImponible || 0);
          const totalIvaPedido = parseFloat(pedido.TotalIva || 0);
          const transporte = totalPedido - baseImponiblePedido - totalIvaPedido;
          
          const lineasPresupuesto = await this.obtenerLineasPedido(pedido.id);
          
          // Obtener descuento de transporte desde configuración
          const primeraMarcaPresupuesto = lineasPresupuesto.length > 0 ? (lineasPresupuesto[0].MarcaNombre || null) : null;
          const descuentoTransportePorcentaje = await comisionesCRM.getDescuentoTransporte(primeraMarcaPresupuesto, año);
          const descuentoTransporte = transporte > 0 && descuentoTransportePorcentaje > 0 
            ? (transporte * descuentoTransportePorcentaje) / 100 
            : 0;
          
          // Calcular base imponible total del pedido para distribuir el descuento proporcionalmente
          let baseImponibleTotalPedido = 0;
          for (const linea of lineasPresupuesto) {
            baseImponibleTotalPedido += parseFloat(linea.Subtotal || linea.subtotal || 0);
          }
          
          for (const linea of lineasPresupuesto) {
            let baseImponible = parseFloat(linea.Subtotal || linea.subtotal || 0);
            
            // Descontar el transporte proporcionalmente de cada línea
            if (baseImponibleTotalPedido > 0 && descuentoTransporte > 0) {
              const proporcion = baseImponible / baseImponibleTotalPedido;
              const descuentoLinea = descuentoTransporte * proporcion;
              baseImponible = baseImponible - descuentoLinea;
            }
            
            ventasAcumuladasTrimestre += baseImponible;
          }
        }
      }

      // Calcular presupuesto acumulado del trimestre
      // Si hay presupuestos mensuales, usar esos directamente
      // Si son anuales, distribuir entre los 4 trimestres
      let presupuestoAnual = 0;
      let presupuestoAcumulado = 0;
      
      for (const presupuesto of presupuestos) {
        const importe = parseFloat(presupuesto.importe_presupuestado || 0);
        presupuestoAnual += importe;
        
        // Si es presupuesto mensual, sumar solo si está en el trimestre
        if (presupuesto.mes && presupuesto.mes > 0) {
          const mesPresupuesto = parseInt(presupuesto.mes);
          if (mesPresupuesto >= (trimestre - 1) * 3 + 1 && mesPresupuesto <= trimestre * 3) {
            presupuestoAcumulado += importe;
          }
        } else {
          // Si es anual, distribuir entre trimestres
          presupuestoAcumulado += importe / 4;
        }
      }

      // Obtener porcentaje de rappel desde configuración
      const porcentajeRappel = await comisionesCRM.getRappelPresupuesto(null, año);
      
      // Si supera el presupuesto, aplicar rappel según configuración
      let comisionPresupuesto = 0;
      if (ventasAcumuladasTrimestre > presupuestoAcumulado) {
        comisionPresupuesto = (ventasAcumuladasTrimestre * porcentajeRappel) / 100;
      }

      return {
        ventas_acumuladas: ventasAcumuladasTrimestre,
        presupuesto_acumulado: presupuestoAcumulado,
        comision_presupuesto: comisionPresupuesto,
        supera_presupuesto: ventasAcumuladasTrimestre > presupuestoAcumulado
      };
    } catch (error) {
      console.error('❌ Error calculando comisión por presupuesto:', error);
      throw error;
    }
  }

  /**
   * Calcular rapel por marca
   * Sobre el exceso del objetivo según porcentajes:
   * - 80-100% = 2%
   * - 100-120% = 3%
   * - +120% = 5%
   */
  async calcularRapelMarca(comercialId, marca, trimestre, año) {
    try {
      console.log(`🔄 Calculando rapel para comercial ${comercialId}, marca ${marca}, T${trimestre}/${año}`);

      // Obtener objetivo trimestral (debe estar configurado)
      const objetivo = await this.obtenerObjetivoMarca(comercialId, marca, trimestre, año);
      
      if (!objetivo || objetivo <= 0) {
        return {
          ventas_trimestre: 0,
          objetivo_trimestre: 0,
          porcentaje_cumplimiento: 0,
          porcentaje_rapel: 0,
          importe_rapel: 0
        };
      }

      // Calcular ventas del trimestre por marca
      const ventasTrimestre = await this.obtenerVentasMarcaTrimestre(comercialId, marca, trimestre, año);
      
      const porcentajeCumplimiento = objetivo > 0 ? (ventasTrimestre / objetivo) * 100 : 0;
      
      // Determinar porcentaje de rapel según cumplimiento
      let porcentajeRapel = 0;
      if (porcentajeCumplimiento >= 80 && porcentajeCumplimiento < 100) {
        porcentajeRapel = 2;
      } else if (porcentajeCumplimiento >= 100 && porcentajeCumplimiento < 120) {
        porcentajeRapel = 3;
      } else if (porcentajeCumplimiento >= 120) {
        porcentajeRapel = 5;
      }

      // Calcular rapel sobre el exceso del objetivo
      const exceso = Math.max(0, ventasTrimestre - objetivo);
      const importeRapel = exceso > 0 ? (exceso * porcentajeRapel) / 100 : 0;

      return {
        ventas_trimestre: ventasTrimestre,
        objetivo_trimestre: objetivo,
        porcentaje_cumplimiento: porcentajeCumplimiento,
        porcentaje_rapel: porcentajeRapel,
        importe_rapel: importeRapel,
        exceso: exceso
      };
    } catch (error) {
      console.error('❌ Error calculando rapel por marca:', error);
      throw error;
    }
  }

  /**
   * Calcular comisión mensual completa (ventas + presupuesto + fijo)
   */
  async calcularComisionMensual(comercialId, mes, año, calculadoPor = null) {
    try {
      console.log(`🔄 Calculando comisión mensual completa para comercial ${comercialId}, ${mes}/${año}`);

      // Obtener configuración de fijo mensual
      const configFijo = await comisionesCRM.getConfigFijoMensual();

      // Obtener todos los fijos mensuales por marca del comercial PARA EL PERIODO (año/mes)
      const fijosMarca = await this.obtenerFijosMensualesPorMarca(comercialId, mes, año);
      
      let fijoAPagar = 0;

      if (año <= configFijo.año_limite) {
        // Hasta año_limite (2026): fijo se paga siempre
        fijoAPagar = fijosMarca.reduce((sum, f) => sum + parseFloat(f.importe || 0), 0);
      } else {
        // A partir de año_limite + 1 (2027): solo si alcanza porcentaje_minimo_ventas de ventas mensuales
        const comisionVentas = await this.calcularComisionVentas(comercialId, mes, año);
        const ventasMensuales = comisionVentas.total_ventas;
        
        // Calcular porcentaje_minimo_ventas del objetivo mensual
        let presupuestos = await comisionesCRM.getPresupuestos({
          comercial_id: comercialId,
          año: año,
          mes: mes,
          activo: 1
        });

        if (!presupuestos || presupuestos.length === 0) {
          presupuestos = await comisionesCRM.getPresupuestos({
            comercial_id: comercialId,
            año: año,
            mes: null,
            activo: 1
          });
        }
        
        let presupuestoMensual = 0;
        for (const presupuesto of presupuestos) {
          const importe = parseFloat(presupuesto.importe_presupuestado || 0);
          if (presupuesto.mes && presupuesto.mes > 0) {
            if (parseInt(presupuesto.mes) === mes) {
              presupuestoMensual += importe;
            }
          } else {
            presupuestoMensual += importe / 12;
          }
        }
        
        const minimoVentas = presupuestoMensual * (configFijo.porcentaje_minimo_ventas / 100);

        if (ventasMensuales >= minimoVentas) {
          // Si alcanza el mínimo, pagar todos los fijos
          fijoAPagar = fijosMarca.reduce((sum, f) => sum + parseFloat(f.importe || 0), 0);
        } else {
          fijoAPagar = 0;
        }
      }

      // Calcular comisión por ventas
      const comisionVentas = await this.calcularComisionVentas(comercialId, mes, año);

      // Calcular comisión por presupuesto
      const comisionPresupuesto = await this.calcularComisionPresupuesto(comercialId, mes, año);

      // Total de comisión
      const totalComision = fijoAPagar + comisionVentas.total_comision + comisionPresupuesto.comision_presupuesto;

      // Guardar o actualizar comisión
      const comisionData = {
        comercial_id: comercialId,
        mes: mes,
        año: año,
        fijo_mensual: fijoAPagar,
        comision_ventas: comisionVentas.total_comision,
        comision_presupuesto: comisionPresupuesto.comision_presupuesto,
        total_ventas: comisionVentas.total_ventas,
        total_comision: totalComision,
        estado: 'Calculada',
        calculado_por: calculadoPor,
        observaciones: `Fijo: ${fijoAPagar > 0 ? 'Sí' : 'No'} (${fijoAPagar.toFixed(2)}€), Ventas: ${comisionVentas.total_comision.toFixed(2)}€, Presupuesto: ${comisionPresupuesto.comision_presupuesto.toFixed(2)}€`
      };

      const comision = await comisionesCRM.saveComision(comisionData);

      // Eliminar detalles antiguos si existe la comisión (para actualizaciones)
      if (comision.id) {
        try {
          await comisionesCRM.deleteComisionDetalleByComisionId(comision.id);
          console.log(`🗑️ [COMISIONES] Detalles antiguos eliminados para comisión ${comision.id}`);
        } catch (error) {
          console.warn(`⚠️ [COMISIONES] Error eliminando detalles antiguos (puede ser primera vez):`, error.message);
        }
      }

      // Guardar detalles
      if (comisionVentas.detalles && comisionVentas.detalles.length > 0) {
        console.log(`💾 [COMISIONES] Guardando ${comisionVentas.detalles.length} detalles para comisión ${comision.id}`);
        for (const detalle of comisionVentas.detalles) {
          try {
            await comisionesCRM.addComisionDetalle({
              ...detalle,
              comision_id: comision.id
            });
          } catch (error) {
            console.error(`❌ [COMISIONES] Error guardando detalle:`, error.message);
            console.error(`❌ [COMISIONES] Detalle:`, detalle);
          }
        }
        console.log(`✅ [COMISIONES] ${comisionVentas.detalles.length} detalles guardados correctamente`);
      } else {
        console.log(`ℹ️ [COMISIONES] No hay detalles para guardar (sin ventas en el mes)`);
      }

      return {
        ...comision,
        detalles: comisionVentas.detalles,
        presupuesto: comisionPresupuesto
      };
    } catch (error) {
      console.error('❌ Error calculando comisión mensual:', error);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS AUXILIARES
  // =====================================================

  async obtenerPedidosDelMes(comercialId, mes, año) {
    try {
      const sql = `
        SELECT p.*, tp.Tipo as TipoPedidoNombre
        FROM pedidos p
        LEFT JOIN tipos_pedidos tp ON p.Id_TipoPedido = tp.id
        WHERE p.Id_Cial = ? 
        AND MONTH(p.FechaPedido) = ? 
        AND YEAR(p.FechaPedido) = ?
        AND p.EstadoPedido != 'Anulado'
        ORDER BY p.FechaPedido
      `;
      return await crm.query(sql, [comercialId, mes, año]);
    } catch (error) {
      console.error('❌ Error obteniendo pedidos del mes:', error);
      return [];
    }
  }

  async obtenerLineasPedido(pedidoId) {
    try {
      // La tabla pedidos_articulos usa Id_NumPedido para relacionar con pedidos.id
      // Incluir información de marca del artículo
      // En Linux, el nombre de tabla puede ser case-sensitive: probar `marcas` y luego `Marcas`
      const sqlLower = `
        SELECT pa.*, a.Id_Marca, m.Nombre as MarcaNombre
        FROM pedidos_articulos pa
        INNER JOIN articulos a ON pa.Id_Articulo = a.id
        LEFT JOIN marcas m ON a.Id_Marca = m.id
        WHERE pa.Id_NumPedido = ?
      `;
      try {
        return await crm.query(sqlLower, [pedidoId]);
      } catch (_) {
        const sqlUpper = `
          SELECT pa.*, a.Id_Marca, m.Nombre as MarcaNombre
          FROM pedidos_articulos pa
          INNER JOIN articulos a ON pa.Id_Articulo = a.id
          LEFT JOIN Marcas m ON a.Id_Marca = m.id
          WHERE pa.Id_NumPedido = ?
        `;
        return await crm.query(sqlUpper, [pedidoId]);
      }
    } catch (error) {
      console.error('❌ Error obteniendo líneas de pedido:', error);
      return [];
    }
  }

  async obtenerCondicionesEspeciales(comercialId) {
    try {
      const sql = `
        SELECT * FROM condiciones_especiales 
        WHERE activo = 1
        AND (comercial_id = ? OR comercial_id IS NULL)
        AND (fecha_inicio IS NULL OR fecha_inicio <= CURDATE())
        AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())
        ORDER BY comercial_id DESC, articulo_id DESC
      `;
      return await crm.query(sql, [comercialId]);
    } catch (error) {
      console.error('❌ Error obteniendo condiciones especiales:', error);
      return [];
    }
  }

  buscarCondicionEspecial(condiciones, articuloId, comercialId) {
    return condiciones.find(c => 
      (c.articulo_id === articuloId || c.articulo_id === null) &&
      (c.comercial_id === comercialId || c.comercial_id === null)
    );
  }

  async obtenerObjetivoMarca(comercialId, marca, trimestre, año) {
    try {
      const sql = `
        SELECT objetivo FROM objetivos_marca 
        WHERE comercial_id = ? 
        AND marca = ? 
        AND trimestre = ? 
        AND año = ?
        AND activo = 1
        LIMIT 1
      `;
      const rows = await crm.query(sql, [comercialId, marca, trimestre, año]);
      return parseFloat(rows[0]?.objetivo || 0);
    } catch (error) {
      console.error('❌ Error obteniendo objetivo de marca:', error);
      return 0;
    }
  }

  async obtenerVentasMarcaTrimestre(comercialId, marca, trimestre, año) {
    try {
      const mesInicio = (trimestre - 1) * 3 + 1;
      const mesFin = trimestre * 3;

      // La marca real vive en `marcas.Nombre` (o `Marcas`), no en `articulos.Marca` en la mayoría de instalaciones.
      const marcaNorm = String(marca || '').trim().toUpperCase();
      const sqlLower = `
        SELECT SUM(pa.Subtotal) as total
        FROM pedidos p
        INNER JOIN pedidos_articulos pa ON p.id = pa.Id_NumPedido OR p.id = pa.PedidoId
        INNER JOIN articulos a ON pa.Id_Articulo = a.id
        LEFT JOIN marcas m ON a.Id_Marca = m.id
        WHERE p.Id_Cial = ?
          AND YEAR(p.FechaPedido) = ?
          AND MONTH(p.FechaPedido) BETWEEN ? AND ?
          AND UPPER(m.Nombre) = ?
          AND p.EstadoPedido != 'Anulado'
      `;
      try {
        const rows = await crm.query(sqlLower, [comercialId, año, mesInicio, mesFin, marcaNorm]);
        return parseFloat(rows[0]?.total || 0);
      } catch (_) {
        const sqlUpper = `
          SELECT SUM(pa.Subtotal) as total
          FROM pedidos p
          INNER JOIN pedidos_articulos pa ON p.id = pa.Id_NumPedido OR p.id = pa.PedidoId
          INNER JOIN articulos a ON pa.Id_Articulo = a.id
          LEFT JOIN Marcas m ON a.Id_Marca = m.id
          WHERE p.Id_Cial = ?
            AND YEAR(p.FechaPedido) = ?
            AND MONTH(p.FechaPedido) BETWEEN ? AND ?
            AND UPPER(m.Nombre) = ?
            AND p.EstadoPedido != 'Anulado'
        `;
        const rows = await crm.query(sqlUpper, [comercialId, año, mesInicio, mesFin, marcaNorm]);
        return parseFloat(rows[0]?.total || 0);
      }
    } catch (error) {
      console.error('❌ Error obteniendo ventas por marca:', error);
      return 0;
    }
  }

  /**
   * Obtener todos los fijos mensuales por marca de un comercial
   * @param {number} comercialId - ID del comercial
   * @returns {Promise<Array>} Array de objetos con importe y marca_id
   */
  async obtenerFijosMensualesPorMarca(comercialId, mes = null, año = null) {
    try {
      const fijos = await comisionesCRM.getFijosMensualesMarcaPeriodo({
        comercial_id: comercialId,
        año: año,
        mes: mes
      });
      // Filtrar solo los activos
      return fijos.filter(f => f.activo === 1 || f.activo === true);
    } catch (error) {
      console.error('❌ Error obteniendo fijos mensuales por marca:', error);
      return [];
    }
  }
}

module.exports = new CalculadorComisiones();

