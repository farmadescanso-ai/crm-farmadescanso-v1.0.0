// Métodos CRUD para el sistema de comisiones
// Este archivo contiene todos los métodos para gestionar presupuestos, comisiones y rapeles

const mysql = require('mysql2/promise');
require('dotenv').config();

class ComisionesCRM {
  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci'
    };
    this.pool = null;
    this._cache = {
      articulosHasMarcaColumn: null
    };
  }

  async connect() {
    if (!this.pool) {
      this.pool = mysql.createPool(this.config);
    }
    return this.pool;
  }

  async query(sql, params = []) {
    const pool = await this.connect();
    try {
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('❌ Error en query:', error.message);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw error;
    }
  }

  async execute(sql, params = []) {
    const pool = await this.connect();
    try {
      // Validar parámetros antes de ejecutar
      const hasUndefined = params.some((p, index) => {
        if (p === undefined) {
          console.error(`❌ [EXECUTE] Parámetro undefined en índice ${index}:`, { sql, params, index });
          return true;
        }
        return false;
      });
      
      if (hasUndefined) {
        throw new Error('Parámetros undefined detectados antes de ejecutar la consulta SQL');
      }
      
      console.log('🔍 [EXECUTE] Ejecutando SQL:', sql.substring(0, 200));
      console.log('🔍 [EXECUTE] Parámetros:', params.map((p, i) => `[${i}]: ${p} (${typeof p})`).join(', '));
      
      const [result] = await pool.execute(sql, params);
      
      console.log('✅ [EXECUTE] SQL ejecutado exitosamente');
      if (result.insertId) {
        console.log('✅ [EXECUTE] ID insertado:', result.insertId);
      }
      
      return result;
    } catch (error) {
      console.error('❌ [EXECUTE] Error en execute:', error.message);
      console.error('❌ [EXECUTE] SQL:', sql);
      console.error('❌ [EXECUTE] Parámetros:', params);
      console.error('❌ [EXECUTE] Tipos de parámetros:', params.map(p => typeof p));
      console.error('❌ [EXECUTE] Error completo:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      });
      
      // Agregar información adicional al error
      const enhancedError = new Error(error.message);
      enhancedError.originalError = error;
      enhancedError.sql = sql;
      enhancedError.params = params;
      throw enhancedError;
    }
  }

  async hasArticulosMarcaColumn() {
    if (this._cache.articulosHasMarcaColumn !== null) {
      return this._cache.articulosHasMarcaColumn;
    }
    try {
      const rows = await this.query(
        `SELECT COUNT(*) as c
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'articulos'
           AND COLUMN_NAME = 'Marca'`
      );
      const has = Number(rows?.[0]?.c ?? 0) > 0;
      this._cache.articulosHasMarcaColumn = has;
      return has;
    } catch (e) {
      // Si falla la comprobación (permisos/compat), asumir que NO existe para evitar romper en MariaDB remoto.
      this._cache.articulosHasMarcaColumn = false;
      return false;
    }
  }

  // =====================================================
  // PRESUPUESTOS
  // =====================================================

  /**
   * Obtener todos los presupuestos
   */
  async getPresupuestos(filters = {}) {
    try {
      const hasMarca = await this.hasArticulosMarcaColumn();
      let sql = `
        SELECT p.*, 
               c.Nombre as comercial_nombre,
               a.Nombre as articulo_nombre,
               a.SKU as articulo_sku,
               ${hasMarca ? 'a.Marca' : 'm.Nombre'} as articulo_marca
        FROM presupuestos p
        LEFT JOIN comerciales c ON p.comercial_id = c.id
        LEFT JOIN articulos a ON p.articulo_id = a.id
        LEFT JOIN marcas m ON m.id = a.Id_Marca
        WHERE 1=1
      `;
      const params = [];

      if (filters.comercial_id !== null && filters.comercial_id !== undefined) {
        sql += ' AND p.comercial_id = ?';
        params.push(Number(filters.comercial_id));
      }
      if (filters.articulo_id !== null && filters.articulo_id !== undefined) {
        sql += ' AND p.articulo_id = ?';
        params.push(Number(filters.articulo_id));
      }
      if (filters.año !== null && filters.año !== undefined) {
        sql += ' AND p.año = ?';
        params.push(Number(filters.año));
      }
      if (filters.mes !== undefined && filters.mes !== null && filters.mes !== '') {
        sql += ' AND p.mes = ?';
        params.push(filters.mes);
      }
      if (filters.activo !== undefined) {
        sql += ' AND p.activo = ?';
        params.push(filters.activo ? 1 : 0);
      }

      sql += ' ORDER BY p.año DESC, p.mes ASC, c.Nombre, a.Nombre';

      console.log('🔍 [PRESUPUESTOS] SQL:', sql);
      console.log('🔍 [PRESUPUESTOS] Params:', params);
      console.log('🔍 [PRESUPUESTOS] Filters:', filters);

      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo presupuestos:', error.message);
      throw error;
    }
  }

  /**
   * Obtener un presupuesto por ID
   */
  async getPresupuestoById(id) {
    try {
      const hasMarca = await this.hasArticulosMarcaColumn();
      const sql = `
        SELECT p.*, 
               c.Nombre as comercial_nombre,
               a.Nombre as articulo_nombre,
               a.SKU as articulo_sku,
               ${hasMarca ? 'a.Marca' : 'm.Nombre'} as articulo_marca
        FROM presupuestos p
        LEFT JOIN comerciales c ON p.comercial_id = c.id
        LEFT JOIN articulos a ON p.articulo_id = a.id
        LEFT JOIN marcas m ON m.id = a.Id_Marca
        WHERE p.id = ?
      `;
      const rows = await this.query(sql, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Error obteniendo presupuesto:', error.message);
      throw error;
    }
  }

  /**
   * Crear un nuevo presupuesto (o actualizar si ya existe)
   */
  async createPresupuesto(presupuestoData) {
    try {
      console.log('💾 [PRESUPUESTO] createPresupuesto llamado con datos:', JSON.stringify(presupuestoData, null, 2));
      console.log('💾 [PRESUPUESTO] comercial_id:', presupuestoData.comercial_id, 'tipo:', typeof presupuestoData.comercial_id);
      console.log('💾 [PRESUPUESTO] articulo_id:', presupuestoData.articulo_id, 'tipo:', typeof presupuestoData.articulo_id);
      
      // Verificar que comercial_id existe antes de continuar
      const verificarComercial = await this.query(
        'SELECT id FROM comerciales WHERE id = ? LIMIT 1',
        [presupuestoData.comercial_id]
      );
      console.log('💾 [PRESUPUESTO] Verificación comercial en BD:', verificarComercial.length > 0 ? '✅ Existe' : '❌ NO existe');
      if (verificarComercial.length === 0) {
        throw new Error(`El comercial con ID ${presupuestoData.comercial_id} no existe en la base de datos`);
      }
      
      // Verificar que articulo_id existe antes de continuar
      const verificarArticulo = await this.query(
        'SELECT id FROM articulos WHERE id = ? LIMIT 1',
        [presupuestoData.articulo_id]
      );
      console.log('💾 [PRESUPUESTO] Verificación artículo en BD:', verificarArticulo.length > 0 ? '✅ Existe' : '❌ NO existe');
      if (verificarArticulo.length === 0) {
        throw new Error(`El artículo con ID ${presupuestoData.articulo_id} no existe en la base de datos`);
      }
      
      // Verificar si ya existe un presupuesto con la misma combinación de comercial_id, articulo_id y año
      // Asegurar que los valores sean números para la comparación
      const comercialIdForQuery = Number(presupuestoData.comercial_id);
      const articuloIdForQuery = Number(presupuestoData.articulo_id);
      const añoForQuery = Number(presupuestoData.año);
      
      console.log('💾 [PRESUPUESTO] Buscando duplicados con:', {
        comercial_id: comercialIdForQuery,
        articulo_id: articuloIdForQuery,
        año: añoForQuery
      });
      
      const existing = await this.query(
        'SELECT id FROM presupuestos WHERE comercial_id = ? AND articulo_id = ? AND año = ?',
        [comercialIdForQuery, articuloIdForQuery, añoForQuery]
      );
      console.log('💾 [PRESUPUESTO] Presupuesto existente encontrado:', existing.length > 0 ? `Sí (ID: ${existing[0].id})` : 'No');

      if (existing.length > 0) {
        // Si existe, NO actualizar automáticamente, lanzar un error
        const existingId = existing[0].id;
        console.log(`💾 [PRESUPUESTO] Presupuesto duplicado detectado (ID: ${existingId}).`);
        throw new Error(`Ya existe un presupuesto para este comercial (ID: ${comercialIdForQuery}), artículo (ID: ${articuloIdForQuery}) y año (${añoForQuery}). Presupuesto existente ID: ${existingId}`);
      }

      // Si no existe, crear un nuevo presupuesto
      // Asegurar que los IDs sean números enteros
      const comercialId = parseInt(presupuestoData.comercial_id);
      const articuloId = parseInt(presupuestoData.articulo_id);
      const año = parseInt(presupuestoData.año);
      
      // Verificar una vez más que los IDs son válidos antes de insertar
      if (isNaN(comercialId) || comercialId <= 0) {
        throw new Error(`comercial_id inválido: ${presupuestoData.comercial_id}`);
      }
      if (isNaN(articuloId) || articuloId <= 0) {
        throw new Error(`articulo_id inválido: ${presupuestoData.articulo_id}`);
      }
      if (isNaN(año) || año <= 0) {
        throw new Error(`año inválido: ${presupuestoData.año}`);
      }
      
      // VERIFICACIÓN FINAL justo antes del INSERT usando la misma conexión
      console.log('🔍 [PRESUPUESTO] Verificación final antes de INSERT...');
      const pool = await this.connect();
      const [comercialCheck] = await pool.execute('SELECT id FROM comerciales WHERE id = ?', [comercialId]);
      const [articuloCheck] = await pool.execute('SELECT id FROM articulos WHERE id = ?', [articuloId]);
      
      console.log('🔍 [PRESUPUESTO] Verificación final - Comercial:', comercialCheck.length > 0 ? `✅ Existe (ID: ${comercialCheck[0].id})` : `❌ NO existe (buscado: ${comercialId})`);
      console.log('🔍 [PRESUPUESTO] Verificación final - Artículo:', articuloCheck.length > 0 ? `✅ Existe (ID: ${articuloCheck[0].id})` : `❌ NO existe (buscado: ${articuloId})`);
      
      if (comercialCheck.length === 0) {
        throw new Error(`VERIFICACIÓN FINAL FALLIDA: El comercial con ID ${comercialId} no existe en la base de datos`);
      }
      if (articuloCheck.length === 0) {
        throw new Error(`VERIFICACIÓN FINAL FALLIDA: El artículo con ID ${articuloId} no existe en la base de datos`);
      }
      
      const sql = `
        INSERT INTO presupuestos 
        (comercial_id, articulo_id, año, mes, cantidad_presupuestada, importe_presupuestado, 
         porcentaje_comision, activo, observaciones, creado_por)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        comercialId,  // Asegurar que es un número entero
        articuloId,   // Asegurar que es un número entero
        año,          // Asegurar que es un número entero
        presupuestoData.mes !== undefined && presupuestoData.mes !== null && presupuestoData.mes !== '' ? parseInt(presupuestoData.mes) : null,
        parseFloat(presupuestoData.cantidad_presupuestada) || 0,
        parseFloat(presupuestoData.importe_presupuestado) || 0,
        parseFloat(presupuestoData.porcentaje_comision) || 0,
        presupuestoData.activo !== undefined ? (presupuestoData.activo ? 1 : 0) : 1,
        presupuestoData.observaciones || null,
        presupuestoData.creado_por ? parseInt(presupuestoData.creado_por) : null
      ];
      
      console.log('💾 [PRESUPUESTO] Ejecutando INSERT con parámetros:');
      console.log('   comercial_id:', params[0], 'tipo:', typeof params[0], 'es número:', !isNaN(params[0]));
      console.log('   articulo_id:', params[1], 'tipo:', typeof params[1], 'es número:', !isNaN(params[1]));
      console.log('   año:', params[2], 'tipo:', typeof params[2], 'es número:', !isNaN(params[2]));
      console.log('   Parámetros completos:', params);
      console.log('   SQL completo:', sql.replace(/\?/g, (match, offset) => {
        const index = sql.substring(0, offset).split('?').length - 1;
        return params[index] !== null && params[index] !== undefined ? params[index] : 'NULL';
      }));

      const result = await this.execute(sql, params);
      const presupuestoCreado = { id: result.insertId, ...presupuestoData, actualizado: false };
      console.log('✅ [PRESUPUESTO] Presupuesto creado en BD con ID:', result.insertId);
      return presupuestoCreado;
    } catch (error) {
      console.error('❌ Error creando/actualizando presupuesto:', error.message);
      console.error('❌ Stack:', error.stack);
      console.error('❌ Datos que causaron el error:', JSON.stringify(presupuestoData, null, 2));
      
      // Agregar información adicional al error para debugging
      const errorInfo = {
        message: error.message,
        sqlState: error.sqlState || null,
        sqlMessage: error.sqlMessage || null,
        code: error.code || null,
        errno: error.errno || null,
        presupuestoData: presupuestoData
      };
      
      const enhancedError = new Error(error.message);
      enhancedError.originalError = error;
      enhancedError.errorInfo = errorInfo;
      throw enhancedError;
    }
  }

  /**
   * Actualizar un presupuesto
   */
  async updatePresupuesto(id, presupuestoData) {
    try {
      const updates = [];
      const params = [];

      if (presupuestoData.mes !== undefined) {
        updates.push('mes = ?');
        params.push(presupuestoData.mes !== undefined && presupuestoData.mes !== null && presupuestoData.mes !== '' ? parseInt(presupuestoData.mes) : null);
      }
      if (presupuestoData.cantidad_presupuestada !== undefined) {
        updates.push('cantidad_presupuestada = ?');
        params.push(presupuestoData.cantidad_presupuestada);
      }
      if (presupuestoData.importe_presupuestado !== undefined) {
        updates.push('importe_presupuestado = ?');
        params.push(presupuestoData.importe_presupuestado);
      }
      if (presupuestoData.porcentaje_comision !== undefined) {
        updates.push('porcentaje_comision = ?');
        params.push(presupuestoData.porcentaje_comision);
      }
      if (presupuestoData.activo !== undefined) {
        updates.push('activo = ?');
        params.push(presupuestoData.activo ? 1 : 0);
      }
      if (presupuestoData.observaciones !== undefined) {
        updates.push('observaciones = ?');
        params.push(presupuestoData.observaciones);
      }

      if (updates.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      params.push(id);
      const sql = `UPDATE presupuestos SET ${updates.join(', ')} WHERE id = ?`;
      await this.execute(sql, params);
      return { id, ...presupuestoData };
    } catch (error) {
      console.error('❌ Error actualizando presupuesto:', error.message);
      throw error;
    }
  }

  /**
   * Eliminar un presupuesto
   */
  async deletePresupuesto(id) {
    try {
      const sql = 'DELETE FROM presupuestos WHERE id = ?';
      await this.execute(sql, [id]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando presupuesto:', error.message);
      throw error;
    }
  }

  // =====================================================
  // COMISIONES
  // =====================================================

  /**
   * Obtener todas las comisiones
   */
  async getComisiones(filters = {}) {
    try {
      let sql = `
        SELECT c.*, 
               co.Nombre as comercial_nombre,
               co.Email as comercial_email
        FROM comisiones c
        LEFT JOIN comerciales co ON c.comercial_id = co.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.comercial_id) {
        sql += ' AND c.comercial_id = ?';
        params.push(filters.comercial_id);
      }
      if (filters.mes) {
        sql += ' AND c.mes = ?';
        params.push(filters.mes);
      }
      if (filters.año) {
        sql += ' AND c.año = ?';
        params.push(filters.año);
      }
      if (filters.estado) {
        sql += ' AND c.estado = ?';
        params.push(filters.estado);
      }

      sql += ' ORDER BY c.año DESC, c.mes DESC, co.Nombre';

      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo comisiones:', error.message);
      throw error;
    }
  }

  /**
   * Obtener una comisión por ID
   */
  async getComisionById(id) {
    try {
      const sql = `
        SELECT c.*, 
               co.Nombre as comercial_nombre,
               co.Email as comercial_email
        FROM comisiones c
        LEFT JOIN comerciales co ON c.comercial_id = co.id
        WHERE c.id = ?
      `;
      const rows = await this.query(sql, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Error obteniendo comisión:', error.message);
      throw error;
    }
  }

  /**
   * Crear o actualizar una comisión
   */
  async saveComision(comisionData) {
    try {
      // Verificar si ya existe
      const existing = await this.query(
        'SELECT id FROM comisiones WHERE comercial_id = ? AND mes = ? AND año = ?',
        [comisionData.comercial_id, comisionData.mes, comisionData.año]
      );

      if (existing.length > 0) {
        // Actualizar
        const updates = [];
        const params = [];

        if (comisionData.fijo_mensual !== undefined) {
          updates.push('fijo_mensual = ?');
          params.push(comisionData.fijo_mensual);
        }
        if (comisionData.comision_ventas !== undefined) {
          updates.push('comision_ventas = ?');
          params.push(comisionData.comision_ventas);
        }
        if (comisionData.comision_presupuesto !== undefined) {
          updates.push('comision_presupuesto = ?');
          params.push(comisionData.comision_presupuesto);
        }
        if (comisionData.total_ventas !== undefined) {
          updates.push('total_ventas = ?');
          params.push(comisionData.total_ventas);
        }
        if (comisionData.total_comision !== undefined) {
          updates.push('total_comision = ?');
          params.push(comisionData.total_comision);
        }
        if (comisionData.estado !== undefined) {
          updates.push('estado = ?');
          params.push(comisionData.estado);
        }
        if (comisionData.fecha_pago !== undefined) {
          updates.push('fecha_pago = ?');
          params.push(comisionData.fecha_pago);
        }
        if (comisionData.observaciones !== undefined) {
          updates.push('observaciones = ?');
          params.push(comisionData.observaciones);
        }
        if (comisionData.calculado_por !== undefined) {
          updates.push('calculado_por = ?');
          params.push(comisionData.calculado_por);
        }
        if (comisionData.pagado_por !== undefined) {
          updates.push('pagado_por = ?');
          params.push(comisionData.pagado_por);
        }

        if (updates.length > 0) {
          params.push(existing[0].id);
          const sql = `UPDATE comisiones SET ${updates.join(', ')} WHERE id = ?`;
          await this.execute(sql, params);
          return { id: existing[0].id, ...comisionData };
        }
        return { id: existing[0].id };
      } else {
        // Crear
        const sql = `
          INSERT INTO comisiones 
          (comercial_id, mes, año, fijo_mensual, comision_ventas, comision_presupuesto,
           total_ventas, total_comision, estado, fecha_pago, observaciones, calculado_por, pagado_por)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
          comisionData.comercial_id,
          comisionData.mes,
          comisionData.año,
          comisionData.fijo_mensual || 0,
          comisionData.comision_ventas || 0,
          comisionData.comision_presupuesto || 0,
          comisionData.total_ventas || 0,
          comisionData.total_comision || 0,
          comisionData.estado || 'Pendiente',
          comisionData.fecha_pago || null,
          comisionData.observaciones || null,
          comisionData.calculado_por || null,
          comisionData.pagado_por || null
        ];

        const result = await this.execute(sql, params);
        return { id: result.insertId, ...comisionData };
      }
    } catch (error) {
      console.error('❌ Error guardando comisión:', error.message);
      throw error;
    }
  }

  /**
   * Obtener detalle de una comisión
   */
  async getComisionDetalle(comisionId) {
    try {
      const sql = `
        SELECT cd.*,
               p.NumPedido as pedido_numero,
               p.FechaPedido as pedido_fecha,
               a.Nombre as articulo_nombre,
               a.SKU as articulo_sku
        FROM comisiones_detalle cd
        LEFT JOIN pedidos p ON cd.pedido_id = p.id
        LEFT JOIN articulos a ON cd.articulo_id = a.id
        WHERE cd.comision_id = ?
        ORDER BY cd.creado_en DESC
      `;
      return await this.query(sql, [comisionId]);
    } catch (error) {
      console.error('❌ Error obteniendo detalle de comisión:', error.message);
      throw error;
    }
  }

  /**
   * Eliminar todos los detalles de una comisión
   */
  async deleteComisionDetalleByComisionId(comisionId) {
    try {
      const sql = 'DELETE FROM comisiones_detalle WHERE comision_id = ?';
      await this.execute(sql, [comisionId]);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error eliminando detalles de comisión:', error.message);
      throw error;
    }
  }

  /**
   * Agregar detalle a una comisión
   */
  async addComisionDetalle(detalleData) {
    try {
      const sql = `
        INSERT INTO comisiones_detalle 
        (comision_id, pedido_id, articulo_id, cantidad, importe_venta, 
         porcentaje_comision, importe_comision, tipo_comision, observaciones)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        detalleData.comision_id,
        detalleData.pedido_id || null,
        detalleData.articulo_id || null,
        detalleData.cantidad || 0,
        detalleData.importe_venta || 0,
        detalleData.porcentaje_comision || 0,
        detalleData.importe_comision || 0,
        detalleData.tipo_comision || 'Venta',
        detalleData.observaciones || null
      ];

      const result = await this.execute(sql, params);
      return { id: result.insertId, ...detalleData };
    } catch (error) {
      console.error('❌ Error agregando detalle de comisión:', error.message);
      throw error;
    }
  }

  // =====================================================
  // RAPELES
  // =====================================================

  /**
   * Obtener todos los rapeles
   */
  async getRapeles(filters = {}) {
    try {
      let sql = `
        SELECT r.*, 
               c.Nombre as comercial_nombre,
               c.Email as comercial_email
        FROM rapeles r
        LEFT JOIN comerciales c ON r.comercial_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.comercial_id) {
        sql += ' AND r.comercial_id = ?';
        params.push(filters.comercial_id);
      }
      if (filters.marca) {
        sql += ' AND r.marca = ?';
        params.push(filters.marca);
      }
      if (filters.trimestre) {
        sql += ' AND r.trimestre = ?';
        params.push(filters.trimestre);
      }
      if (filters.año) {
        sql += ' AND r.año = ?';
        params.push(filters.año);
      }
      if (filters.estado) {
        sql += ' AND r.estado = ?';
        params.push(filters.estado);
      }

      sql += ' ORDER BY r.año DESC, r.trimestre DESC, r.marca, c.Nombre';

      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo rapeles:', error.message);
      throw error;
    }
  }

  /**
   * Obtener un rapel por ID
   */
  async getRapelById(id) {
    try {
      const sql = `
        SELECT r.*, 
               c.Nombre as comercial_nombre,
               c.Email as comercial_email
        FROM rapeles r
        LEFT JOIN comerciales c ON r.comercial_id = c.id
        WHERE r.id = ?
      `;
      const rows = await this.query(sql, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Error obteniendo rapel:', error.message);
      throw error;
    }
  }

  /**
   * Crear o actualizar un rapel
   */
  async saveRapel(rapelData) {
    try {
      // Verificar si ya existe
      const existing = await this.query(
        'SELECT id FROM rapeles WHERE comercial_id = ? AND marca = ? AND trimestre = ? AND año = ?',
        [rapelData.comercial_id, rapelData.marca, rapelData.trimestre, rapelData.año]
      );

      if (existing.length > 0) {
        // Actualizar
        const updates = [];
        const params = [];

        if (rapelData.ventas_trimestre !== undefined) {
          updates.push('ventas_trimestre = ?');
          params.push(rapelData.ventas_trimestre);
        }
        if (rapelData.objetivo_trimestre !== undefined) {
          updates.push('objetivo_trimestre = ?');
          params.push(rapelData.objetivo_trimestre);
        }
        if (rapelData.porcentaje_cumplimiento !== undefined) {
          updates.push('porcentaje_cumplimiento = ?');
          params.push(rapelData.porcentaje_cumplimiento);
        }
        if (rapelData.porcentaje_rapel !== undefined) {
          updates.push('porcentaje_rapel = ?');
          params.push(rapelData.porcentaje_rapel);
        }
        if (rapelData.importe_rapel !== undefined) {
          updates.push('importe_rapel = ?');
          params.push(rapelData.importe_rapel);
        }
        if (rapelData.estado !== undefined) {
          updates.push('estado = ?');
          params.push(rapelData.estado);
        }
        if (rapelData.fecha_pago !== undefined) {
          updates.push('fecha_pago = ?');
          params.push(rapelData.fecha_pago);
        }
        if (rapelData.observaciones !== undefined) {
          updates.push('observaciones = ?');
          params.push(rapelData.observaciones);
        }
        if (rapelData.calculado_por !== undefined) {
          updates.push('calculado_por = ?');
          params.push(rapelData.calculado_por);
        }
        if (rapelData.pagado_por !== undefined) {
          updates.push('pagado_por = ?');
          params.push(rapelData.pagado_por);
        }

        if (updates.length > 0) {
          params.push(existing[0].id);
          const sql = `UPDATE rapeles SET ${updates.join(', ')} WHERE id = ?`;
          await this.execute(sql, params);
          return { id: existing[0].id, ...rapelData };
        }
        return { id: existing[0].id };
      } else {
        // Crear
        const sql = `
          INSERT INTO rapeles 
          (comercial_id, marca, trimestre, año, ventas_trimestre, objetivo_trimestre,
           porcentaje_cumplimiento, porcentaje_rapel, importe_rapel, estado, fecha_pago, 
           observaciones, calculado_por, pagado_por)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
          rapelData.comercial_id,
          rapelData.marca,
          rapelData.trimestre,
          rapelData.año,
          rapelData.ventas_trimestre || 0,
          rapelData.objetivo_trimestre || 0,
          rapelData.porcentaje_cumplimiento || 0,
          rapelData.porcentaje_rapel || 0,
          rapelData.importe_rapel || 0,
          rapelData.estado || 'Pendiente',
          rapelData.fecha_pago || null,
          rapelData.observaciones || null,
          rapelData.calculado_por || null,
          rapelData.pagado_por || null
        ];

        const result = await this.execute(sql, params);
        return { id: result.insertId, ...rapelData };
      }
    } catch (error) {
      console.error('❌ Error guardando rapel:', error.message);
      throw error;
    }
  }

  // =====================================================
  // CONFIGURACIÓN DE RAPELES
  // =====================================================

  /**
   * Obtener configuración de rapeles
   */
  async getRapelesConfiguracion(filters = {}) {
    try {
      let sql = 'SELECT * FROM rapeles_configuracion WHERE 1=1';
      const params = [];

      if (filters.marca) {
        sql += ' AND marca = ?';
        params.push(filters.marca);
      }
      if (filters.activo !== undefined) {
        sql += ' AND activo = ?';
        params.push(filters.activo ? 1 : 0);
      }

      sql += ' ORDER BY marca, porcentaje_cumplimiento_min';

      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo configuración de rapeles:', error.message);
      throw error;
    }
  }

  /**
   * Crear configuración de rapel
   */
  async createRapelConfiguracion(configData) {
    try {
      const sql = `
        INSERT INTO rapeles_configuracion 
        (marca, porcentaje_cumplimiento_min, porcentaje_cumplimiento_max, porcentaje_rapel, activo, observaciones)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const params = [
        configData.marca,
        configData.porcentaje_cumplimiento_min,
        configData.porcentaje_cumplimiento_max,
        configData.porcentaje_rapel,
        configData.activo !== undefined ? (configData.activo ? 1 : 0) : 1,
        configData.observaciones || null
      ];

      const result = await this.execute(sql, params);
      return { id: result.insertId, ...configData };
    } catch (error) {
      console.error('❌ Error creando configuración de rapel:', error.message);
      throw error;
    }
  }

  /**
   * Actualizar configuración de rapel
   */
  async updateRapelConfiguracion(id, configData) {
    try {
      const updates = [];
      const params = [];

      if (configData.porcentaje_cumplimiento_min !== undefined) {
        updates.push('porcentaje_cumplimiento_min = ?');
        params.push(configData.porcentaje_cumplimiento_min);
      }
      if (configData.porcentaje_cumplimiento_max !== undefined) {
        updates.push('porcentaje_cumplimiento_max = ?');
        params.push(configData.porcentaje_cumplimiento_max);
      }
      if (configData.porcentaje_rapel !== undefined) {
        updates.push('porcentaje_rapel = ?');
        params.push(configData.porcentaje_rapel);
      }
      if (configData.activo !== undefined) {
        updates.push('activo = ?');
        params.push(configData.activo ? 1 : 0);
      }
      if (configData.observaciones !== undefined) {
        updates.push('observaciones = ?');
        params.push(configData.observaciones);
      }

      if (updates.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      params.push(id);
      const sql = `UPDATE rapeles_configuracion SET ${updates.join(', ')} WHERE id = ?`;
      await this.query(sql, params);
      return { id, ...configData };
    } catch (error) {
      console.error('❌ Error actualizando configuración de rapel:', error.message);
      throw error;
    }
  }

  /**
   * Eliminar configuración de rapel
   */
  async deleteRapelConfiguracion(id) {
    try {
      const sql = 'DELETE FROM rapeles_configuracion WHERE id = ?';
      await this.execute(sql, [id]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando configuración de rapel:', error.message);
      throw error;
    }
  }

  // =====================================================
  // OBJETIVOS POR MARCA
  // =====================================================

  /**
   * Obtener objetivos por marca
   */
  async getObjetivosMarca(filters = {}) {
    try {
      let sql = `
        SELECT o.*, 
               c.Nombre as comercial_nombre
        FROM objetivos_marca o
        LEFT JOIN comerciales c ON o.comercial_id = c.id
        WHERE 1=1
      `;
      const params = [];

      // Asegurarse de que comercial_id no sea undefined ni null (solo números válidos)
      if (filters.comercial_id != null && filters.comercial_id !== undefined && !isNaN(filters.comercial_id)) {
        sql += ' AND o.comercial_id = ?';
        params.push(Number(filters.comercial_id));
      }
      // Asegurarse de que marca no sea undefined ni vacío
      if (filters.marca != null && filters.marca !== undefined && filters.marca !== '') {
        sql += ' AND o.marca = ?';
        params.push(String(filters.marca));
      }
      // Asegurarse de que trimestre no sea undefined ni null (solo números válidos)
      if (filters.trimestre != null && filters.trimestre !== undefined && !isNaN(filters.trimestre)) {
        sql += ' AND o.trimestre = ?';
        params.push(Number(filters.trimestre));
      }
      // Asegurarse de que año no sea undefined ni null (solo números válidos)
      if (filters.año != null && filters.año !== undefined && !isNaN(filters.año)) {
        sql += ' AND o.año = ?';
        params.push(Number(filters.año));
      }
      // Asegurarse de que activo no sea undefined
      if (filters.activo !== undefined && filters.activo !== null) {
        sql += ' AND o.activo = ?';
        params.push(filters.activo ? 1 : 0);
      }

      // Validación final: asegurarse de que ningún parámetro sea undefined
      const hasUndefined = params.some(p => p === undefined);
      if (hasUndefined) {
        console.error('❌ Error: Parámetros undefined detectados en getObjetivosMarca:', { filters, params });
        throw new Error('Parámetros undefined detectados en la consulta SQL');
      }

      sql += ' ORDER BY o.año DESC, o.trimestre DESC, o.marca, c.Nombre';

      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo objetivos por marca:', error.message);
      throw error;
    }
  }

  /**
   * Obtener objetivo por marca por ID
   */
  async getObjetivoMarcaById(id) {
    try {
      const sql = `
        SELECT o.*, 
               c.Nombre as comercial_nombre
        FROM objetivos_marca o
        LEFT JOIN comerciales c ON o.comercial_id = c.id
        WHERE o.id = ?
      `;
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo objetivo por marca:', error.message);
      throw error;
    }
  }

  /**
   * Crear o actualizar objetivo por marca
   */
  async saveObjetivoMarca(objetivoData) {
    try {
      // Validar y normalizar valores requeridos
      if (objetivoData.comercial_id === null || objetivoData.comercial_id === undefined || isNaN(objetivoData.comercial_id)) {
        throw new Error('comercial_id es requerido y debe ser un número válido');
      }
      if (!objetivoData.marca || objetivoData.marca === '') {
        throw new Error('marca es requerida');
      }
      if (objetivoData.trimestre === null || objetivoData.trimestre === undefined || isNaN(objetivoData.trimestre)) {
        throw new Error('trimestre es requerido y debe ser un número válido (1-4)');
      }
      if (objetivoData.año === null || objetivoData.año === undefined || isNaN(objetivoData.año)) {
        throw new Error('año es requerido y debe ser un número válido');
      }

      const comercial_id = Number(objetivoData.comercial_id);
      const marca = String(objetivoData.marca);
      const trimestre = Number(objetivoData.trimestre);
      const año = Number(objetivoData.año);
      const objetivo = objetivoData.objetivo !== undefined && objetivoData.objetivo !== null ? Number(objetivoData.objetivo) : 0;
      const activo = objetivoData.activo !== undefined && objetivoData.activo !== null ? (objetivoData.activo ? 1 : 0) : 1;
      const observaciones = objetivoData.observaciones !== undefined && objetivoData.observaciones !== null && objetivoData.observaciones !== '' 
        ? String(objetivoData.observaciones) 
        : null;

      // Validar que los valores no sean NaN después de la conversión
      if (isNaN(comercial_id) || isNaN(trimestre) || isNaN(año)) {
        console.error('❌ Error: Valores NaN después de conversión:', { comercial_id, trimestre, año, objetivoData });
        throw new Error('Valores inválidos después de la conversión (NaN detectado)');
      }

      // Validar parámetros para la consulta SELECT (marca puede ser string vacío pero no null/undefined)
      const selectParams = [comercial_id, marca, trimestre, año];
      if (selectParams[0] === undefined || selectParams[0] === null || isNaN(selectParams[0]) ||
          selectParams[1] === undefined || selectParams[1] === null ||
          selectParams[2] === undefined || selectParams[2] === null || isNaN(selectParams[2]) ||
          selectParams[3] === undefined || selectParams[3] === null || isNaN(selectParams[3])) {
        console.error('❌ Error: Parámetros inválidos en SELECT:', { selectParams, objetivoData });
        throw new Error('Parámetros inválidos en la consulta SELECT');
      }

      const existing = await this.query(
        'SELECT id FROM objetivos_marca WHERE comercial_id = ? AND marca = ? AND trimestre = ? AND año = ?',
        selectParams
      );

      if (existing.length > 0) {
        const updates = [];
        const params = [];

        if (objetivoData.objetivo !== undefined) {
          updates.push('objetivo = ?');
          params.push(objetivo);
        }
        if (objetivoData.activo !== undefined) {
          updates.push('activo = ?');
          params.push(activo);
        }
        if (objetivoData.observaciones !== undefined) {
          updates.push('observaciones = ?');
          params.push(observaciones);
        }

        if (updates.length > 0) {
          params.push(existing[0].id);
          
          // Validación: asegurarse de que ningún parámetro sea undefined
          if (params.some(p => p === undefined)) {
            console.error('❌ Error: Parámetros undefined en UPDATE:', { updates, params, objetivoData });
            throw new Error('Parámetros undefined detectados en la consulta SQL UPDATE');
          }
          
          const sql = `UPDATE objetivos_marca SET ${updates.join(', ')} WHERE id = ?`;
          await this.execute(sql, params);
          return { id: existing[0].id, comercial_id, marca, trimestre, año, objetivo, activo, observaciones };
        }
        return { id: existing[0].id, comercial_id, marca, trimestre, año, objetivo, activo, observaciones };
      } else {
        const sql = `
          INSERT INTO objetivos_marca 
          (comercial_id, marca, trimestre, año, objetivo, activo, observaciones)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [comercial_id, marca, trimestre, año, objetivo, activo, observaciones];

        // Validación final: asegurarse de que ningún parámetro sea undefined o NaN
        if (params.some((p, i) => {
          if (p === undefined) return true;
          if (i < 4 && (p === null || (typeof p === 'number' && isNaN(p)))) return true; // primeros 4 son requeridos
          return false;
        })) {
          console.error('❌ Error: Parámetros inválidos detectados en INSERT:', { 
            objetivoData, 
            params,
            tipos: params.map(p => typeof p),
            valores: params
          });
          throw new Error('Parámetros inválidos detectados en la consulta SQL INSERT');
        }

        const result = await this.execute(sql, params);
        return { id: result.insertId, comercial_id, marca, trimestre, año, objetivo, activo, observaciones };
      }
    } catch (error) {
      console.error('❌ Error guardando objetivo por marca:', error.message);
      console.error('❌ Stack:', error.stack);
      console.error('❌ objetivoData recibido:', objetivoData);
      throw error;
    }
  }

  /**
   * Eliminar objetivo por marca
   */
  async deleteObjetivoMarca(id) {
    try {
      const sql = 'DELETE FROM objetivos_marca WHERE id = ?';
      await this.execute(sql, [id]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando objetivo por marca:', error.message);
      throw error;
    }
  }

  // =====================================================
  // CONDICIONES ESPECIALES
  // =====================================================

  /**
   * Obtener condiciones especiales
   */
  async getCondicionesEspeciales(filters = {}) {
    try {
      let sql = `
        SELECT ce.*,
               c.Nombre as comercial_nombre,
               a.Nombre as articulo_nombre,
               a.SKU as articulo_sku
        FROM condiciones_especiales ce
        LEFT JOIN comerciales c ON ce.comercial_id = c.id
        LEFT JOIN articulos a ON ce.articulo_id = a.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.comercial_id !== undefined) {
        if (filters.comercial_id === null) {
          sql += ' AND ce.comercial_id IS NULL';
        } else {
          sql += ' AND (ce.comercial_id = ? OR ce.comercial_id IS NULL)';
          params.push(filters.comercial_id);
        }
      }
      if (filters.articulo_id !== undefined) {
        if (filters.articulo_id === null) {
          sql += ' AND ce.articulo_id IS NULL';
        } else {
          sql += ' AND (ce.articulo_id = ? OR ce.articulo_id IS NULL)';
          params.push(filters.articulo_id);
        }
      }
      if (filters.activo !== undefined) {
        sql += ' AND ce.activo = ?';
        params.push(filters.activo ? 1 : 0);
      }

      sql += ' ORDER BY ce.comercial_id DESC, ce.articulo_id DESC, ce.creado_en DESC';

      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo condiciones especiales:', error.message);
      throw error;
    }
  }

  /**
   * Crear condición especial
   */
  async createCondicionEspecial(condicionData) {
    try {
      const sql = `
        INSERT INTO condiciones_especiales 
        (comercial_id, articulo_id, porcentaje_comision, descripcion, activo, fecha_inicio, fecha_fin)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        condicionData.comercial_id || null,
        condicionData.articulo_id || null,
        condicionData.porcentaje_comision,
        condicionData.descripcion || null,
        condicionData.activo !== undefined ? (condicionData.activo ? 1 : 0) : 1,
        condicionData.fecha_inicio || null,
        condicionData.fecha_fin || null
      ];

      const result = await this.execute(sql, params);
      return { id: result.insertId, ...condicionData };
    } catch (error) {
      console.error('❌ Error creando condición especial:', error.message);
      throw error;
    }
  }

  /**
   * Actualizar condición especial
   */
  async updateCondicionEspecial(id, condicionData) {
    try {
      const updates = [];
      const params = [];

      if (condicionData.porcentaje_comision !== undefined) {
        updates.push('porcentaje_comision = ?');
        params.push(condicionData.porcentaje_comision);
      }
      if (condicionData.descripcion !== undefined) {
        updates.push('descripcion = ?');
        params.push(condicionData.descripcion);
      }
      if (condicionData.activo !== undefined) {
        updates.push('activo = ?');
        params.push(condicionData.activo ? 1 : 0);
      }
      if (condicionData.fecha_inicio !== undefined) {
        updates.push('fecha_inicio = ?');
        params.push(condicionData.fecha_inicio);
      }
      if (condicionData.fecha_fin !== undefined) {
        updates.push('fecha_fin = ?');
        params.push(condicionData.fecha_fin);
      }

      if (updates.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      params.push(id);
      const sql = `UPDATE condiciones_especiales SET ${updates.join(', ')} WHERE id = ?`;
      await this.query(sql, params);
      return { id, ...condicionData };
    } catch (error) {
      console.error('❌ Error actualizando condición especial:', error.message);
      throw error;
    }
  }

  /**
   * Eliminar condición especial
   */
  async deleteCondicionEspecial(id) {
    try {
      const sql = 'DELETE FROM condiciones_especiales WHERE id = ?';
      await this.execute(sql, [id]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando condición especial:', error.message);
      throw error;
    }
  }

  // =====================================================
  // FIJOS MENSUALES POR MARCA
  // =====================================================

  /**
   * Obtener fijos mensuales por comercial y marca
   */
  async getFijosMensualesMarca(filters = {}) {
    try {
      // Construir SQL con Marcas (mayúscula) - si falla, se manejará en el catch
      let sql = `
        SELECT fmm.*,
               c.Nombre as comercial_nombre,
               c.Email as comercial_email,
               m.Nombre as marca_nombre
        FROM fijos_mensuales_marca fmm
        INNER JOIN comerciales c ON fmm.comercial_id = c.id
        INNER JOIN marcas m ON fmm.marca_id = m.id
        WHERE 1=1
      `;
      
      const params = [];

      if (filters.comercial_id) {
        sql += ' AND fmm.comercial_id = ?';
        params.push(filters.comercial_id);
      }
      if (filters.marca_id) {
        sql += ' AND fmm.marca_id = ?';
        params.push(filters.marca_id);
      }
      if (filters.activo !== undefined) {
        sql += ' AND fmm.activo = ?';
        params.push(filters.activo ? 1 : 0);
      }

      sql += ' ORDER BY c.Nombre, m.Nombre';

      const result = await this.query(sql, params);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('❌ Error obteniendo fijos mensuales por marca:', error.message);
      console.error('Stack:', error.stack);
      
      // Intentar con marcas (minúscula) como fallback
      try {
        let sqlFallback = `
          SELECT fmm.*,
                 c.Nombre as comercial_nombre,
                 c.Email as comercial_email,
                 m.Nombre as marca_nombre
          FROM fijos_mensuales_marca fmm
          INNER JOIN comerciales c ON fmm.comercial_id = c.id
          INNER JOIN marcas m ON fmm.marca_id = m.id
          WHERE 1=1
        `;
        
        const params = [];
        if (filters.comercial_id) {
          sqlFallback += ' AND fmm.comercial_id = ?';
          params.push(filters.comercial_id);
        }
        if (filters.marca_id) {
          sqlFallback += ' AND fmm.marca_id = ?';
          params.push(filters.marca_id);
        }
        if (filters.activo !== undefined) {
          sqlFallback += ' AND fmm.activo = ?';
          params.push(filters.activo ? 1 : 0);
        }
        sqlFallback += ' ORDER BY c.Nombre, m.Nombre';
        
        const result = await this.query(sqlFallback, params);
        return Array.isArray(result) ? result : [];
      } catch (fallbackError) {
        console.error('❌ Error en fallback de fijos mensuales:', fallbackError.message);
        // Devolver array vacío en lugar de lanzar error para evitar 500
        return [];
      }
    }
  }

  /**
   * Obtener fijo mensual por comercial y marca específicos
   */
  async getFijoMensualMarca(comercialId, marcaId) {
    try {
      const sql = `
        SELECT fmm.*,
               c.Nombre as comercial_nombre,
               m.Nombre as marca_nombre
        FROM fijos_mensuales_marca fmm
        INNER JOIN comerciales c ON fmm.comercial_id = c.id
        INNER JOIN marcas m ON fmm.marca_id = m.id
        WHERE fmm.comercial_id = ? AND fmm.marca_id = ?
        LIMIT 1
      `;
      const rows = await this.query(sql, [comercialId, marcaId]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo fijo mensual por marca:', error.message);
      throw error;
    }
  }

  /**
   * Guardar o actualizar fijo mensual por marca
   */
  async saveFijoMensualMarca(data) {
    try {
      const comercialId = data.comercial_id || data.comercialId;
      const marcaId = data.marca_id || data.marcaId;
      const importe = parseFloat(data.importe || 0);
      const activo = data.activo !== undefined ? (data.activo === true || data.activo === 1 || data.activo === 'true') : true;

      if (!comercialId || !marcaId) {
        throw new Error('comercial_id y marca_id son requeridos');
      }

      // Verificar si ya existe
      const existente = await this.getFijoMensualMarca(comercialId, marcaId);

      if (existente && existente.id) {
        // Actualizar
        const sql = `
          UPDATE fijos_mensuales_marca
          SET importe = ?,
              activo = ?,
              fecha_actualizacion = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        await this.execute(sql, [importe, activo ? 1 : 0, existente.id]);
        return await this.getFijoMensualMarca(comercialId, marcaId);
      } else {
        // Crear nuevo
        const sql = `
          INSERT INTO fijos_mensuales_marca (comercial_id, marca_id, importe, activo)
          VALUES (?, ?, ?, ?)
        `;
        const result = await this.execute(sql, [comercialId, marcaId, importe, activo ? 1 : 0]);
        return await this.getFijoMensualMarca(comercialId, marcaId);
      }
    } catch (error) {
      console.error('❌ Error guardando fijo mensual por marca:', error.message);
      throw error;
    }
  }

  /**
   * Eliminar fijo mensual por marca
   */
  async deleteFijoMensualMarca(id) {
    try {
      const sql = 'DELETE FROM fijos_mensuales_marca WHERE id = ?';
      await this.execute(sql, [id]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando fijo mensual por marca:', error.message);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS PARA LEER CONFIGURACIONES DE COMISIONES
  // =====================================================

  /**
   * Obtener porcentaje de comisión por tipo de pedido desde configuración
   * @param {string} marca - Nombre de la marca (null para general)
   * @param {string} tipoPedido - Nombre del tipo de pedido (Transfer, Directo, Normal)
   * @param {number} año - Año para el que se aplica
   * @returns {Promise<number>} Porcentaje de comisión
   */
  async getPorcentajeComision(marca, tipoPedido, año) {
    try {
      // Normalizar tipo de pedido
      let nombreTipoBuscar = tipoPedido || 'Directo';
      if (typeof nombreTipoBuscar === 'string') {
        const tipoNormalizado = nombreTipoBuscar.toLowerCase().trim();
        if (tipoNormalizado.includes('transfer')) {
          nombreTipoBuscar = 'Transfer';
        } else if (tipoNormalizado.includes('directo') || tipoNormalizado === 'normal' || tipoNormalizado === '') {
          nombreTipoBuscar = 'Directo';
        }
      }

      // SIEMPRE buscar configuración específica de marca (OBLIGATORIO)
      if (!marca) {
        console.warn(`⚠️ [CONFIG] No se proporcionó marca para obtener porcentaje comisión ${nombreTipoBuscar} en ${año}, usando valor por defecto`);
        return nombreTipoBuscar === 'Transfer' ? 5 : 10;
      }

      const sql = `
        SELECT porcentaje_comision, activo
        FROM config_comisiones_tipo_pedido
        WHERE marca = ?
        AND nombre_tipo_pedido = ?
        AND año_aplicable = ?
        AND activo = 1
        LIMIT 1
      `;
      const rows = await this.query(sql, [marca.toUpperCase(), nombreTipoBuscar, año]);
      
      if (rows && rows.length > 0) {
        return parseFloat(rows[0].porcentaje_comision);
      }

      // NO buscar configuración general - requerir marca específica
      console.warn(`⚠️ [CONFIG] No se encontró configuración para marca ${marca}, tipo ${nombreTipoBuscar} en ${año}, usando valores por defecto`);
      return nombreTipoBuscar === 'Transfer' ? 5 : 10;
    } catch (error) {
      console.error(`❌ Error obteniendo porcentaje comisión: ${error.message}`);
      // Valores por defecto
      return tipoPedido && tipoPedido.toLowerCase().includes('transfer') ? 5 : 10;
    }
  }

  /**
   * Obtener porcentaje de descuento de transporte desde configuración
   * @param {string} marca - Nombre de la marca (null para general)
   * @param {number} año - Año para el que se aplica
   * @returns {Promise<number>} Porcentaje de descuento (0 si está inactivo o no existe)
   */
  async getDescuentoTransporte(marca, año) {
    try {
      // SIEMPRE buscar configuración específica de marca (OBLIGATORIO)
      if (!marca) {
        console.warn(`⚠️ [CONFIG] No se proporcionó marca para obtener descuento transporte en ${año}, usando 0% por defecto`);
        return 0;
      }

      const sql = `
        SELECT porcentaje_descuento, activo
        FROM config_descuento_transporte
        WHERE marca = ?
        AND año_aplicable = ?
        LIMIT 1
      `;
      const rows = await this.query(sql, [marca.toUpperCase(), año]);

      if (rows && rows.length > 0) {
        // Si está inactivo, devolver 0
        if (rows[0].activo === 0 || rows[0].activo === false) {
          return 0;
        }
        return parseFloat(rows[0].porcentaje_descuento);
      }

      // NO buscar configuración general - requerir marca específica
      console.warn(`⚠️ [CONFIG] No se encontró configuración de descuento transporte para marca ${marca} en ${año}, usando 0% por defecto`);
      return 0;
    } catch (error) {
      console.error(`❌ Error obteniendo descuento transporte: ${error.message}`);
      return 0;
    }
  }

  /**
   * Obtener porcentaje de rappel por presupuesto desde configuración
   * @param {string} marca - Nombre de la marca (null para general)
   * @param {number} año - Año para el que se aplica
   * @returns {Promise<number>} Porcentaje de rappel
   */
  async getRappelPresupuesto(marca, año) {
    try {
      // Rappel presupuesto NO depende de marca, pero mantenemos consistencia
      // Buscar configuración (puede ser general o por marca)
      const sql = `
        SELECT porcentaje_rappel, activo
        FROM config_rappel_presupuesto
        WHERE (marca = ? OR marca IS NULL)
        AND año_aplicable = ?
        AND activo = 1
        ORDER BY marca IS NULL ASC
        LIMIT 1
      `;
      const rows = await this.query(sql, [marca ? marca.toUpperCase() : null, año]);

      if (rows && rows.length > 0) {
        return parseFloat(rows[0].porcentaje_rappel);
      }

      // Por defecto 1% (valor antiguo) si no hay configuración
      console.warn(`⚠️ [CONFIG] No se encontró configuración de rappel presupuesto para ${año}, usando 1% por defecto`);
      return 1;
    } catch (error) {
      console.error(`❌ Error obteniendo rappel presupuesto: ${error.message}`);
      return 1;
    }
  }

  /**
   * Obtener configuración de fijo mensual
   * @returns {Promise<Object>} Objeto con año_limite y porcentaje_minimo_ventas
   */
  async getConfigFijoMensual() {
    try {
      const sql = `
        SELECT año_limite, porcentaje_minimo_ventas, activo
        FROM config_fijo_mensual
        WHERE activo = 1
        ORDER BY año_limite DESC
        LIMIT 1
      `;
      const rows = await this.query(sql);

      if (rows && rows.length > 0) {
        return {
          año_limite: parseInt(rows[0].año_limite) || 2026,
          porcentaje_minimo_ventas: parseFloat(rows[0].porcentaje_minimo_ventas) || 25,
          activo: rows[0].activo === 1
        };
      }

      // Valores por defecto
      console.warn(`⚠️ [CONFIG] No se encontró configuración de fijo mensual, usando valores por defecto`);
      return {
        año_limite: 2026,
        porcentaje_minimo_ventas: 25,
        activo: true
      };
    } catch (error) {
      console.error(`❌ Error obteniendo config fijo mensual: ${error.message}`);
      return {
        año_limite: 2026,
        porcentaje_minimo_ventas: 25,
        activo: true
      };
    }
  }

  // =====================================================
  // MÉTODOS CRUD PARA CONFIG_COMISIONES_TIPO_PEDIDO
  // =====================================================

  async getConfigComisionesTipoPedido(filters = {}) {
    try {
      let sql = 'SELECT * FROM config_comisiones_tipo_pedido WHERE 1=1';
      const params = [];

      if (filters.marca !== undefined) {
        if (filters.marca === null) {
          sql += ' AND marca IS NULL';
        } else {
          sql += ' AND marca = ?';
          params.push(filters.marca);
        }
      }
      if (filters.nombre_tipo_pedido) {
        sql += ' AND nombre_tipo_pedido = ?';
        params.push(filters.nombre_tipo_pedido);
      }
      if (filters.año_aplicable) {
        sql += ' AND año_aplicable = ?';
        params.push(filters.año_aplicable);
      }
      if (filters.activo !== undefined) {
        sql += ' AND activo = ?';
        params.push(filters.activo ? 1 : 0);
      }

      sql += ' ORDER BY año_aplicable DESC, marca, nombre_tipo_pedido';
      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo config comisiones tipo pedido:', error.message);
      throw error;
    }
  }

  async getConfigComisionTipoPedidoById(id) {
    try {
      const sql = 'SELECT * FROM config_comisiones_tipo_pedido WHERE id = ?';
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo config comisión tipo pedido:', error.message);
      throw error;
    }
  }

  async saveConfigComisionTipoPedido(data) {
    try {
      // Validar que marca no sea NULL (obligatorio)
      if (!data.marca || data.marca === null || data.marca === '') {
        throw new Error('La marca es obligatoria. Debe seleccionar una marca específica (IALOZON, YOUBELLE, etc.)');
      }

      if (data.id) {
        // UPDATE
        const updateFields = [];
        const params = [];
        
        if (data.marca !== undefined) {
          updateFields.push('marca = ?');
          params.push(data.marca.toUpperCase()); // Normalizar a mayúsculas
        }
        
        if (data.nombre_tipo_pedido !== undefined) {
          updateFields.push('nombre_tipo_pedido = ?');
          params.push(data.nombre_tipo_pedido);
        }
        if (data.año_aplicable !== undefined) {
          updateFields.push('año_aplicable = ?');
          params.push(data.año_aplicable);
        }
        if (data.porcentaje_comision !== undefined) {
          updateFields.push('porcentaje_comision = ?');
          params.push(data.porcentaje_comision);
        }
        if (data.activo !== undefined) {
          updateFields.push('activo = ?');
          params.push(data.activo ? 1 : 0);
        }
        if (data.descripcion !== undefined) {
          updateFields.push('descripcion = ?');
          params.push(data.descripcion);
        }
        
        updateFields.push('actualizado_en = CURRENT_TIMESTAMP');
        params.push(data.id);
        
        const sql = `UPDATE config_comisiones_tipo_pedido SET ${updateFields.join(', ')} WHERE id = ?`;
        await this.execute(sql, params);
        return await this.getConfigComisionTipoPedidoById(data.id);
      } else {
        // INSERT
        const sql = `
          INSERT INTO config_comisiones_tipo_pedido 
          (marca, nombre_tipo_pedido, año_aplicable, porcentaje_comision, activo, descripcion, creado_en)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        const result = await this.execute(sql, [
          data.marca.toUpperCase(), // Normalizar a mayúsculas - OBLIGATORIO
          data.nombre_tipo_pedido,
          data.año_aplicable,
          data.porcentaje_comision,
          data.activo !== undefined ? (data.activo ? 1 : 0) : 1,
          data.descripcion || null
        ]);
        return await this.getConfigComisionTipoPedidoById(result.insertId);
      }
    } catch (error) {
      console.error('❌ Error guardando config comisión tipo pedido:', error.message);
      throw error;
    }
  }

  async deleteConfigComisionTipoPedido(id) {
    try {
      const sql = 'DELETE FROM config_comisiones_tipo_pedido WHERE id = ?';
      await this.execute(sql, [id]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando config comisión tipo pedido:', error.message);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS CRUD PARA CONFIG_RAPPEL_PRESUPUESTO
  // =====================================================

  async getConfigRappelPresupuesto(filters = {}) {
    try {
      let sql = 'SELECT * FROM config_rappel_presupuesto WHERE 1=1';
      const params = [];

      if (filters.marca !== undefined) {
        if (filters.marca === null) {
          sql += ' AND marca IS NULL';
        } else {
          sql += ' AND marca = ?';
          params.push(filters.marca);
        }
      }
      if (filters.año_aplicable) {
        sql += ' AND año_aplicable = ?';
        params.push(filters.año_aplicable);
      }
      if (filters.activo !== undefined) {
        sql += ' AND activo = ?';
        params.push(filters.activo ? 1 : 0);
      }

      sql += ' ORDER BY año_aplicable DESC, marca';
      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo config rappel presupuesto:', error.message);
      throw error;
    }
  }

  async getConfigRappelPresupuestoById(id) {
    try {
      const sql = 'SELECT * FROM config_rappel_presupuesto WHERE id = ?';
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo config rappel presupuesto:', error.message);
      throw error;
    }
  }

  async saveConfigRappelPresupuesto(data) {
    try {
      if (data.id) {
        // UPDATE
        const updateFields = [];
        const params = [];
        
        if (data.marca !== undefined) {
          if (data.marca === null) {
            updateFields.push('marca = NULL');
          } else {
            updateFields.push('marca = ?');
            params.push(data.marca);
          }
        }
        if (data.año_aplicable !== undefined) {
          updateFields.push('año_aplicable = ?');
          params.push(data.año_aplicable);
        }
        if (data.porcentaje_rappel !== undefined) {
          updateFields.push('porcentaje_rappel = ?');
          params.push(data.porcentaje_rappel);
        }
        if (data.activo !== undefined) {
          updateFields.push('activo = ?');
          params.push(data.activo ? 1 : 0);
        }
        if (data.descripcion !== undefined) {
          updateFields.push('descripcion = ?');
          params.push(data.descripcion);
        }
        
        updateFields.push('actualizado_en = CURRENT_TIMESTAMP');
        params.push(data.id);
        
        const sql = `UPDATE config_rappel_presupuesto SET ${updateFields.join(', ')} WHERE id = ?`;
        await this.execute(sql, params);
        return await this.getConfigRappelPresupuestoById(data.id);
      } else {
        // INSERT
        const sql = `
          INSERT INTO config_rappel_presupuesto 
          (marca, año_aplicable, porcentaje_rappel, activo, descripcion, creado_en)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        const result = await this.execute(sql, [
          data.marca || null,
          data.año_aplicable,
          data.porcentaje_rappel,
          data.activo !== undefined ? (data.activo ? 1 : 0) : 1,
          data.descripcion || null
        ]);
        return await this.getConfigRappelPresupuestoById(result.insertId);
      }
    } catch (error) {
      console.error('❌ Error guardando config rappel presupuesto:', error.message);
      throw error;
    }
  }

  async deleteConfigRappelPresupuesto(id) {
    try {
      const sql = 'DELETE FROM config_rappel_presupuesto WHERE id = ?';
      await this.execute(sql, [id]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando config rappel presupuesto:', error.message);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS CRUD PARA CONFIG_FIJO_MENSUAL
  // =====================================================

  async getConfigFijoMensualList(filters = {}) {
    try {
      let sql = 'SELECT * FROM config_fijo_mensual WHERE 1=1';
      const params = [];

      if (filters.activo !== undefined) {
        sql += ' AND activo = ?';
        params.push(filters.activo ? 1 : 0);
      }

      sql += ' ORDER BY año_limite DESC';
      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo config fijo mensual:', error.message);
      throw error;
    }
  }

  async getConfigFijoMensualById(id) {
    try {
      const sql = 'SELECT * FROM config_fijo_mensual WHERE id = ?';
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo config fijo mensual:', error.message);
      throw error;
    }
  }

  async saveConfigFijoMensual(data) {
    try {
      if (data.id) {
        // UPDATE
        const updateFields = [];
        const params = [];
        
        if (data.año_limite !== undefined) {
          updateFields.push('año_limite = ?');
          params.push(data.año_limite);
        }
        if (data.porcentaje_minimo_ventas !== undefined) {
          updateFields.push('porcentaje_minimo_ventas = ?');
          params.push(data.porcentaje_minimo_ventas);
        }
        if (data.activo !== undefined) {
          updateFields.push('activo = ?');
          params.push(data.activo ? 1 : 0);
        }
        if (data.descripcion !== undefined) {
          updateFields.push('descripcion = ?');
          params.push(data.descripcion);
        }
        
        updateFields.push('actualizado_en = CURRENT_TIMESTAMP');
        params.push(data.id);
        
        const sql = `UPDATE config_fijo_mensual SET ${updateFields.join(', ')} WHERE id = ?`;
        await this.execute(sql, params);
        return await this.getConfigFijoMensualById(data.id);
      } else {
        // INSERT
        const sql = `
          INSERT INTO config_fijo_mensual 
          (año_limite, porcentaje_minimo_ventas, activo, descripcion, creado_en)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        const result = await this.execute(sql, [
          data.año_limite,
          data.porcentaje_minimo_ventas,
          data.activo !== undefined ? (data.activo ? 1 : 0) : 1,
          data.descripcion || null
        ]);
        return await this.getConfigFijoMensualById(result.insertId);
      }
    } catch (error) {
      console.error('❌ Error guardando config fijo mensual:', error.message);
      throw error;
    }
  }

  async deleteConfigFijoMensual(id) {
    try {
      const sql = 'DELETE FROM config_fijo_mensual WHERE id = ?';
      await this.execute(sql, [id]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando config fijo mensual:', error.message);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS CRUD PARA CONFIG_DESCUENTO_TRANSPORTE
  // =====================================================

  async getConfigDescuentoTransporte(filters = {}) {
    try {
      let sql = 'SELECT * FROM config_descuento_transporte WHERE 1=1';
      const params = [];

      if (filters.marca !== undefined) {
        if (filters.marca === null) {
          sql += ' AND marca IS NULL';
        } else {
          sql += ' AND marca = ?';
          params.push(filters.marca);
        }
      }
      if (filters.año_aplicable) {
        sql += ' AND año_aplicable = ?';
        params.push(filters.año_aplicable);
      }
      if (filters.activo !== undefined) {
        sql += ' AND activo = ?';
        params.push(filters.activo ? 1 : 0);
      }

      sql += ' ORDER BY año_aplicable DESC, marca';
      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo config descuento transporte:', error.message);
      throw error;
    }
  }

  async getConfigDescuentoTransporteById(id) {
    try {
      const sql = 'SELECT * FROM config_descuento_transporte WHERE id = ?';
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo config descuento transporte:', error.message);
      throw error;
    }
  }

  async saveConfigDescuentoTransporte(data) {
    try {
      // Validar que marca no sea NULL (obligatorio)
      if (!data.id && (!data.marca || data.marca === null || data.marca === '')) {
        throw new Error('La marca es obligatoria. Debe seleccionar una marca específica (IALOZON, YOUBELLE, etc.)');
      }

      if (data.id) {
        // UPDATE
        const updateFields = [];
        const params = [];
        
        if (data.marca !== undefined) {
          if (data.marca === null || data.marca === '') {
            throw new Error('La marca es obligatoria y no puede ser NULL');
          } else {
            updateFields.push('marca = ?');
            params.push(data.marca.toUpperCase()); // Normalizar a mayúsculas
          }
        }
        if (data.año_aplicable !== undefined) {
          updateFields.push('año_aplicable = ?');
          params.push(data.año_aplicable);
        }
        if (data.porcentaje_descuento !== undefined) {
          updateFields.push('porcentaje_descuento = ?');
          params.push(data.porcentaje_descuento);
        }
        if (data.activo !== undefined) {
          updateFields.push('activo = ?');
          params.push(data.activo ? 1 : 0);
        }
        if (data.descripcion !== undefined) {
          updateFields.push('descripcion = ?');
          params.push(data.descripcion);
        }
        
        updateFields.push('actualizado_en = CURRENT_TIMESTAMP');
        params.push(data.id);
        
        const sql = `UPDATE config_descuento_transporte SET ${updateFields.join(', ')} WHERE id = ?`;
        await this.execute(sql, params);
        return await this.getConfigDescuentoTransporteById(data.id);
      } else {
        // INSERT
        const sql = `
          INSERT INTO config_descuento_transporte 
          (marca, año_aplicable, porcentaje_descuento, activo, descripcion, creado_en)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        const result = await this.execute(sql, [
          data.marca.toUpperCase(), // Normalizar a mayúsculas - OBLIGATORIO
          data.año_aplicable,
          data.porcentaje_descuento,
          data.activo !== undefined ? (data.activo ? 1 : 0) : 1,
          data.descripcion || null
        ]);
        return await this.getConfigDescuentoTransporteById(result.insertId);
      }
    } catch (error) {
      console.error('❌ Error guardando config descuento transporte:', error.message);
      throw error;
    }
  }

  async deleteConfigDescuentoTransporte(id) {
    try {
      const sql = 'DELETE FROM config_descuento_transporte WHERE id = ?';
      await this.execute(sql, [id]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando config descuento transporte:', error.message);
      throw error;
    }
  }
}

module.exports = new ComisionesCRM();

