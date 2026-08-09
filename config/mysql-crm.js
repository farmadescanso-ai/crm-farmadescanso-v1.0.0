const mysql = require('mysql2/promise');

class MySQLCRM {
  constructor() {
    // Configuración de conexión MySQL directa
    // Base de datos remota: farmadescanso (Easypanel)
    // phpMyAdmin: https://farmadescanso-sql-crm-farmadescanso-phpmyadmin.6f4r35.easypanel.host/
    
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      // En Vercel, si DB_NAME no está configurada, por defecto usamos la BD del CRM
      // (evita que apunte a "farmadescanso" por error y no veas cambios en phpMyAdmin).
      database: process.env.DB_NAME || (process.env.VERCEL ? 'crm_farmadescanso' : 'farmadescanso'),
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 10000 // 10 segundos para conectar
    };

    // Debug: Log de configuración (solo en producción para diagnosticar)
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      console.log('🔍 [DB CONFIG] DB_HOST:', this.config.host);
      console.log('🔍 [DB CONFIG] DB_PORT:', this.config.port);
      console.log('🔍 [DB CONFIG] DB_NAME:', this.config.database);
      console.log('🔍 [DB CONFIG] DB_USER:', this.config.user);
    }

    this.pool = null;
    this.connected = false;
    this._schemaEnsured = false;
    // Cache interno para metadatos de tablas/columnas (útil en serverless)
    this._metaCache = {};
  }

  // Resolver nombre real de tabla sin depender de information_schema (puede estar restringido en hosting).
  // Útil en MySQL/MariaDB sobre Linux donde los nombres pueden ser case-sensitive (p.ej. `Clientes` vs `clientes`).
  async _resolveTableNameCaseInsensitive(baseName) {
    this._cache = this._cache || {};
    const base = String(baseName || '').trim();
    if (!base) return baseName;

    const cacheKey = `tableName:${base}`;
    if (this._cache[cacheKey] !== undefined) return this._cache[cacheKey];

    const cap = base.charAt(0).toUpperCase() + base.slice(1);
    const upper = base.toUpperCase();
    const candidates = Array.from(new Set([base, cap, upper].filter(Boolean)));

    // Probar con SHOW COLUMNS (no requiere information_schema en muchos setups).
    for (const cand of candidates) {
      try {
        await this.query(`SHOW COLUMNS FROM \`${cand}\``);
        this._cache[cacheKey] = cand;
        return cand;
      } catch (_) {
        // seguir probando
      }
    }

    // Fallback: usar el nombre base tal cual.
    this._cache[cacheKey] = base;
    return base;
  }

  /**
   * Resolver (cacheado) nombres de columnas para la tabla clientes en distintos entornos.
   * Evita fallos si la columna del comercial cambia (Id_Cial vs ComercialId, etc.).
   */
  async _ensureClientesMeta() {
    if (this._metaCache?.clientesMeta) return this._metaCache.clientesMeta;

    const tClientes = await this._resolveTableNameCaseInsensitive('clientes');
    let colsRows = [];
    try {
      colsRows = await this.query(`SHOW COLUMNS FROM \`${tClientes}\``);
    } catch (_) {
      colsRows = [];
    }

    const cols = (Array.isArray(colsRows) ? colsRows : [])
      .map(r => String(r.Field || r.field || '').trim())
      .filter(Boolean);

    const colsLower = new Set(cols.map(c => c.toLowerCase()));
    const pickCI = (cands) => {
      for (const cand of (cands || [])) {
        const cl = String(cand).toLowerCase();
        if (colsLower.has(cl)) {
          // devolver el nombre real tal como aparece en SHOW COLUMNS (preserva casing)
          const idx = cols.findIndex(c => c.toLowerCase() === cl);
          return idx >= 0 ? cols[idx] : cand;
        }
      }
      return null;
    };

    const pk = pickCI(['Id', 'id']) || 'Id';
    const colComercial = pickCI([
      'Id_Cial',
      'id_cial',
      'Id_Comercial',
      'id_comercial',
      'ComercialId',
      'comercialId',
      'comercial_id'
    ]);
    const colEstadoCliente = pickCI([
      'Id_EstdoCliente',
      'id_estdo_cliente',
      'Id_EstadoCliente',
      'id_estado_cliente',
      'EstadoClienteId',
      'estadoClienteId'
    ]);

    const meta = { tClientes, pk, colComercial, colEstadoCliente };
    this._metaCache.clientesMeta = meta;
    return meta;
  }

  _normalizeDniCif(value) {
    return String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/-/g, '');
  }

  _isValidDniCif(value) {
    const v = this._normalizeDniCif(value);
    if (!v) return false;
    if (['PENDIENTE', 'NULL', 'N/A', 'NA'].includes(v)) return false;
    if (v.startsWith('SIN_DNI')) return false;

    // DNI: 8 dígitos + letra
    // NIE: X/Y/Z + 7 dígitos + letra
    // CIF: letra + 7 dígitos + [0-9A-J]
    const dni = /^[0-9]{8}[A-Z]$/;
    const nie = /^[XYZ][0-9]{7}[A-Z]$/;
    const cif = /^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/;
    return dni.test(v) || nie.test(v) || cif.test(v);
  }

  async _getEstadoClienteIds() {
    // Cache: ids fijos por diseño, pero leemos por si en el futuro cambian
    if (this._metaCache?.estadoClienteIds) return this._metaCache.estadoClienteIds;
    const tEstados = await this._resolveTableNameCaseInsensitive('estdoClientes');
    const rows = await this.query(`SELECT id, Nombre FROM \`${tEstados}\``).catch(() => []);
    const map = new Map((rows || []).map(r => [String(r.Nombre || '').toLowerCase(), Number(r.id)]));
    const ids = {
      potencial: map.get('potencial') || 1,
      activo: map.get('activo') || 2,
      inactivo: map.get('inactivo') || 3
    };
    this._metaCache.estadoClienteIds = ids;
    return ids;
  }

  async _getFormasPagoTableName() {
    this._cache = this._cache || {};
    if (this._cache.formasPagoTableName !== undefined) return this._cache.formasPagoTableName;
    try {
      const rows = await this.query(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND LOWER(table_name) = 'formas_pago'
         ORDER BY (table_name = 'formas_pago') DESC, table_name ASC
         LIMIT 1`
      );
      const name = rows?.[0]?.name || null;
      this._cache.formasPagoTableName = name;
      return name;
    } catch (_) {
      this._cache.formasPagoTableName = null;
      return null;
    }
  }

  async ensureComercialesActivoColumn() {
    if (this._activoColumnEnsured) return;
    this._activoColumnEnsured = true;

    try {
      if (!this.pool) return;
      const dbName = this.config.database;
      const [rows] = await this.pool.query(
        `
          SELECT COLUMN_NAME
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'comerciales'
            AND COLUMN_NAME = 'Activo'
          LIMIT 1
        `,
        [dbName]
      );

      if (rows && rows.length > 0) return;

      await this.pool.query(
        `ALTER TABLE \`comerciales\`
         ADD COLUMN \`Activo\` TINYINT(1) NOT NULL DEFAULT 1
         COMMENT '1=activo, 0=desactivado'`
      );
      console.log("✅ [SCHEMA] Columna 'Activo' añadida a 'comerciales'");
    } catch (error) {
      // Sin permisos ALTER: la app sigue; el toggle fallará hasta aplicar el SQL manual.
      this._activoColumnEnsured = false;
      console.warn("⚠️ [SCHEMA] No se pudo asegurar columna Activo en comerciales:", error.message);
    }
  }

  async ensureComercialesReunionesNullable() {
    // Ejecutar solo una vez por ciclo de vida (importante en serverless).
    if (this._schemaEnsured) return;
    this._schemaEnsured = true;

    try {
      if (!this.pool) return;
      const dbName = this.config.database;
      const columnas = [
        'teams_access_token',
        'teams_refresh_token',
        'teams_email',
        'teams_token_expires_at',
        'meet_access_token',
        'meet_refresh_token',
        'meet_email',
        'meet_token_expires_at'
      ];

      const placeholders = columnas.map(() => '?').join(', ');
      const [rows] = await this.pool.query(
        `
          SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'comerciales'
            AND COLUMN_NAME IN (${placeholders})
        `,
        [dbName, ...columnas]
      );

      if (!rows || rows.length === 0) return;

      const cambios = [];
      for (const r of rows) {
        if (r && r.IS_NULLABLE === 'NO' && r.COLUMN_NAME && r.COLUMN_TYPE) {
          // Mantener el tipo existente y solo cambiar a NULL.
          cambios.push(`MODIFY \`${r.COLUMN_NAME}\` ${r.COLUMN_TYPE} NULL`);
        }
      }

      if (cambios.length === 0) return;

      const sql = `ALTER TABLE \`comerciales\` ${cambios.join(', ')}`;
      await this.pool.query(sql);
      console.log(`✅ [SCHEMA] Columnas de reuniones en 'comerciales' ahora permiten NULL: ${cambios.length}`);
    } catch (error) {
      // No romper la app si no hay permisos de ALTER en producción.
      console.warn('⚠️ [SCHEMA] No se pudo asegurar NULL en campos de reuniones:', error.message);
    }
  }

  async connect() {
    // En entornos serverless (Vercel), este módulo puede vivir entre invocaciones.
    // Si ya estamos conectados, reutilizar el pool.
    if (this.pool && this.connected) {
      return true;
    }
    
    try {
      // Si existe un pool previo pero no está marcado como conectado (p.ej. fallo anterior),
      // cerrarlo para evitar quedar en un estado inconsistente.
      if (this.pool && !this.connected) {
        try {
          await this.pool.end();
        } catch (_) {
          // Ignorar errores al cerrar pool previo
        } finally {
          this.pool = null;
        }
      }

      this.pool = mysql.createPool(this.config);
      
      // Configurar UTF-8 para todas las conexiones
      const connection = await this.pool.getConnection();
      // Establecer UTF-8 explícitamente para esta conexión
      await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
      await connection.query("SET CHARACTER SET utf8mb4");
      await connection.query("SET character_set_connection=utf8mb4");
      await connection.query("SET character_set_client=utf8mb4");
      await connection.query("SET character_set_results=utf8mb4");
      // Asegurar zona horaria Madrid/España para que NOW()/CURRENT_TIMESTAMP se graben en ese huso.
      // Si el servidor no tiene tablas de zona horaria cargadas, puede fallar; en ese caso lo dejamos en default.
      try {
        await connection.query("SET time_zone = 'Europe/Madrid'");
      } catch (tzErr) {
        console.warn('⚠️ [DB TZ] No se pudo establecer time_zone=Europe/Madrid. Usando zona horaria por defecto del servidor.', tzErr?.message || tzErr);
      }
      await connection.ping();
      connection.release();
      
      this.connected = true;
      console.log('✅ Conectado a MySQL correctamente');
      console.log(`📊 Base de datos: ${this.config.database}`);
      console.log(`🌐 Host: ${this.config.host}:${this.config.port}`);
      console.log('✅ UTF-8 configurado: utf8mb4_unicode_ci');

      // Asegurar compatibilidad de esquema (evita errores tipo "Column 'meet_email' cannot be null").
      await this.ensureComercialesReunionesNullable();
      await this.ensureComercialesActivoColumn();
      return true;
    } catch (error) {
      console.error('❌ Error conectando a MySQL:', error.message);
      console.error(`🔍 [DEBUG] Intentando conectar a: ${this.config.host}:${this.config.port}`);
      console.error(`🔍 [DEBUG] Base de datos: ${this.config.database}`);
      
      // Evitar quedar con un pool creado a medias si la conexión falló (muy importante en serverless)
      if (this.pool) {
        try {
          await this.pool.end();
        } catch (_) {
          // ignore
        } finally {
          this.pool = null;
          this.connected = false;
        }
      }
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      console.log('🔌 Desconectado de MySQL');
    }
  }

  // Método helper para ejecutar consultas
  async query(sql, params = []) {
    // Si no estamos conectados (aunque exista un pool), intentar reconectar.
    if (!this.connected) {
      await this.connect();
    }
    
    try {
      // Obtener una conexión del pool
      const connection = await this.pool.getConnection();
      
      try {
        // Establecer UTF-8 para esta consulta específica
        await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        await connection.query("SET CHARACTER SET utf8mb4");
        await connection.query("SET character_set_connection=utf8mb4");
        await connection.query("SET character_set_client=utf8mb4");
        await connection.query("SET character_set_results=utf8mb4");
        // Zona horaria para esta sesión (Madrid/España)
        try {
          await connection.query("SET time_zone = 'Europe/Madrid'");
        } catch (_) {
          // no romper consultas si el servidor no lo soporta
        }
        
        // Agregar timeout a la consulta
        const result = await Promise.race([
          connection.execute(sql, params),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout en consulta SQL después de 15 segundos: ${sql.substring(0, 100)}...`)), 15000)
          )
        ]);
        
        // Para UPDATE, INSERT, DELETE, execute devuelve [rows, fields]
        // Para SELECT, rows contiene los resultados
        // Para UPDATE/INSERT/DELETE, necesitamos el ResultSetHeader que está en result[0]
        // pero execute devuelve [rows, fields] donde rows es el ResultSetHeader para UPDATE
        const [rows, fields] = result;
        
        // Si es un UPDATE/INSERT/DELETE, devolver el ResultSetHeader completo
        // Si es un SELECT, devolver solo los rows
        if (sql.trim().toUpperCase().startsWith('UPDATE') || 
            sql.trim().toUpperCase().startsWith('INSERT') || 
            sql.trim().toUpperCase().startsWith('DELETE')) {
          return rows; // rows es el ResultSetHeader para UPDATE/INSERT/DELETE
        }
        
        return rows; // Para SELECT, rows contiene los resultados
      } finally {
        // Liberar la conexión de vuelta al pool
        connection.release();
      }
    } catch (error) {
      console.error('❌ Error en consulta SQL:', error.message);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw error;
    }
  }

  // COMERCIALES
  _isActivoFlag(value) {
    if (value === undefined || value === null) return true; // compatibilidad pre-migración
    if (typeof value === 'boolean') return value;
    const n = Number(value);
    if (Number.isFinite(n)) return n === 1;
    const s = String(value).trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'si' || s === 'sí' || s === 'activo';
  }

  async getComerciales() {
    try {
      await this.ensureComercialesActivoColumn();
      let rows;
      try {
        rows = await this.query(
          'SELECT * FROM comerciales ORDER BY Activo DESC, Nombre ASC'
        );
      } catch (orderErr) {
        // Fallback si Activo aún no existe en BD
        console.warn('⚠️ [COMERCIALES] ORDER BY Activo no disponible, ordenando en memoria:', orderErr.message);
        rows = await this.query('SELECT * FROM comerciales ORDER BY Nombre ASC');
        rows = (Array.isArray(rows) ? rows : []).slice().sort((a, b) => {
          const aAct = this._isActivoFlag(a.Activo ?? a.activo) ? 1 : 0;
          const bAct = this._isActivoFlag(b.Activo ?? b.activo) ? 1 : 0;
          if (bAct !== aAct) return bAct - aAct;
          const aName = String(a.Nombre || a.nombre || '').localeCompare(
            String(b.Nombre || b.nombre || ''),
            'es',
            { sensitivity: 'base' }
          );
          return aName;
        });
      }
      console.log(`✅ Obtenidos ${rows.length} comerciales`);
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      console.error('❌ Error obteniendo comerciales:', error.message);
      return [];
    }
  }

  async getComercialByEmail(email) {
    try {
      await this.ensureComercialesActivoColumn();
      const sql = 'SELECT * FROM comerciales WHERE LOWER(Email) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1';
      const rows = await this.query(sql, [email, email]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo comercial por email:', error.message);
      return null;
    }
  }

  async getComercialById(id) {
    try {
      await this.ensureComercialesActivoColumn();
      // Intentar con ambas variantes de nombre de columna (id e Id)
      const sql = 'SELECT * FROM comerciales WHERE id = ? OR Id = ? LIMIT 1';
      const rows = await this.query(sql, [id, id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo comercial por ID:', error.message);
      return null;
    }
  }

  async isComercialActivo(id) {
    try {
      const comercial = await this.getComercialById(id);
      if (!comercial) return false;
      return this._isActivoFlag(comercial.Activo ?? comercial.activo);
    } catch (error) {
      console.error('❌ Error comprobando Activo del comercial:', error.message);
      return true; // no bloquear a todos si falla la lectura
    }
  }

  async setComercialActivo(id, activo) {
    try {
      await this.ensureComercialesActivoColumn();
      if (!this.connected && !this.pool) {
        await this.connect();
      }
      const flag = activo ? 1 : 0;
      const [result] = await this.pool.execute(
        'UPDATE comerciales SET Activo = ? WHERE Id = ? OR id = ?',
        [flag, id, id]
      );
      return { affectedRows: result.affectedRows || 0, Activo: flag };
    } catch (error) {
      console.error('❌ Error actualizando Activo del comercial:', error.message);
      throw error;
    }
  }

  async createComercial(payload) {
    try {
      if (!this.connected && !this.pool) {
        await this.connect();
      }
      
      // Resolver nombre real de la tabla de códigos postales (en algunos servidores MySQL es case-sensitive)
      const cpTableRows = await this.query(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND LOWER(table_name) = 'codigos_postales'
         LIMIT 1`
      );
      const codigosPostalesTable = cpTableRows?.[0]?.name;
      if (!codigosPostalesTable) {
        throw new Error('No existe la tabla de códigos postales (Codigos_Postales/codigos_postales) en la BD.');
      }

      // fijo_mensual es NOT NULL en algunos entornos; siempre insertar un valor (por defecto 0)
      const codigoPostalTexto = (payload.CodigoPostal || payload.codigoPostal || '').toString().trim();
      // Resolver Id_CodigoPostal (NOT NULL en algunos entornos)
      let idCodigoPostal = payload.Id_CodigoPostal || payload.id_CodigoPostal || payload.IdCodigoPostal || null;
      if (!idCodigoPostal && codigoPostalTexto) {
        const cpLimpio = codigoPostalTexto.replace(/[^0-9]/g, '').slice(0, 5);
        if (cpLimpio.length >= 4) {
          try {
            const rows = await this.query(`SELECT id FROM ${codigosPostalesTable} WHERE CodigoPostal = ? LIMIT 1`, [cpLimpio]);
            if (rows && rows.length > 0 && rows[0].id) {
              idCodigoPostal = rows[0].id;
            } else {
              // Si no existe, crearlo automáticamente (evita error NOT NULL en Id_CodigoPostal)
              let provinciaNombre = payload.Provincia || payload.provincia || null;
              const idProvincia = payload.Id_Provincia || payload.id_Provincia || null;
              if (!provinciaNombre && idProvincia) {
                try {
                  const provRows = await this.query('SELECT Nombre FROM provincias WHERE id = ? LIMIT 1', [idProvincia]);
                  provinciaNombre = provRows?.[0]?.Nombre || null;
                } catch (e) {
                  // opcional
                }
              }
              const localidad = payload.Poblacion || payload.poblacion || null;
              try {
                const creado = await this.createCodigoPostal({
                  CodigoPostal: cpLimpio,
                  Localidad: localidad,
                  Provincia: provinciaNombre,
                  Id_Provincia: idProvincia || null,
                  ComunidadAutonoma: null,
                  Latitud: null,
                  Longitud: null,
                  Activo: true
                });
                if (creado && creado.insertId) {
                  idCodigoPostal = creado.insertId;
                }
              } catch (e) {
                // Si falló por duplicado o carrera, re-intentar select
                const retry = await this.query(`SELECT id FROM ${codigosPostalesTable} WHERE CodigoPostal = ? LIMIT 1`, [cpLimpio]);
                if (retry && retry.length > 0 && retry[0].id) {
                  idCodigoPostal = retry[0].id;
                }
              }
            }
          } catch (e) {
            // No bloquear aquí: se manejará con error claro abajo si sigue faltando.
            console.warn('⚠️ No se pudo resolver Id_CodigoPostal:', e.message);
          }
        }
      }
      if (!idCodigoPostal) {
        throw new Error('No se pudo resolver/crear Id_CodigoPostal para el comercial. Revisa el Código Postal.');
      }

      // plataforma_reunion_preferida es NOT NULL en algunos entornos; siempre insertar un valor (por defecto 'meet')
      const plataformaPreferidaRaw = payload.plataforma_reunion_preferida ?? payload.PlataformaReunionPreferida ?? null;
      const plataformaPreferida = (plataformaPreferidaRaw !== undefined && plataformaPreferidaRaw !== null && String(plataformaPreferidaRaw).trim() !== '')
        ? String(plataformaPreferidaRaw).trim()
        : 'meet';

      const sql = `INSERT INTO comerciales (Nombre, Email, DNI, Password, Roll, Activo, Movil, Direccion, CodigoPostal, Poblacion, Id_Provincia, Id_CodigoPostal, fijo_mensual, plataforma_reunion_preferida) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const fijoMensualRaw = payload.fijo_mensual ?? payload.fijoMensual ?? payload.FijoMensual;
      let fijoMensual = 0;
      if (fijoMensualRaw !== undefined && fijoMensualRaw !== null && String(fijoMensualRaw).trim() !== '') {
        const n = Number(String(fijoMensualRaw).replace(',', '.'));
        fijoMensual = Number.isFinite(n) ? n : 0;
      }
      const activoFlag = this._isActivoFlag(payload.Activo ?? payload.activo ?? 1) ? 1 : 0;
      const params = [
        payload.Nombre || payload.nombre || '',
        payload.Email || payload.email || '',
        payload.DNI || payload.dni || null,
        payload.Password || payload.password || null,
        payload.Roll ? (Array.isArray(payload.Roll) ? JSON.stringify(payload.Roll) : payload.Roll) : '["Comercial"]',
        activoFlag,
        payload.Movil || payload.movil || null,
        payload.Direccion || payload.direccion || null,
        codigoPostalTexto || null,
        payload.Poblacion || payload.poblacion || null,
        payload.Id_Provincia || payload.id_Provincia || null,
        idCodigoPostal,
        fijoMensual,
        plataformaPreferida
      ];
      try {
        await this.ensureComercialesActivoColumn();
        const [result] = await this.pool.execute(sql, params);
        return { insertId: result.insertId, ...result };
      } catch (insertErr) {
        // Fallback si la columna Activo aún no existe en BD
        if (String(insertErr.message || '').toLowerCase().includes('activo')) {
          const sqlLegacy = `INSERT INTO comerciales (Nombre, Email, DNI, Password, Roll, Movil, Direccion, CodigoPostal, Poblacion, Id_Provincia, Id_CodigoPostal, fijo_mensual, plataforma_reunion_preferida) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          const paramsLegacy = params.filter((_, i) => i !== 5);
          const [result] = await this.pool.execute(sqlLegacy, paramsLegacy);
          return { insertId: result.insertId, ...result };
        }
        throw insertErr;
      }
    } catch (error) {
      console.error('❌ Error creando comercial:', error.message);
      throw error;
    }
  }

  async updateComercial(id, payload) {
    try {
      const updates = [];
      const params = [];
      
      // Resolver nombre real de la tabla de códigos postales (en algunos servidores MySQL es case-sensitive)
      const cpTableRows = await this.query(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND LOWER(table_name) = 'codigos_postales'
         LIMIT 1`
      );
      const codigosPostalesTable = cpTableRows?.[0]?.name;

      // Si se actualiza el CódigoPostal y no viene Id_CodigoPostal, resolverlo
      if (payload.CodigoPostal !== undefined && payload.Id_CodigoPostal === undefined) {
        const codigoPostalTexto = (payload.CodigoPostal || '').toString().trim();
        const cpLimpio = codigoPostalTexto.replace(/[^0-9]/g, '').slice(0, 5);
        if (cpLimpio) {
          try {
            if (!codigosPostalesTable) {
              throw new Error('No existe la tabla de códigos postales (Codigos_Postales/codigos_postales) en la BD.');
            }
            const rows = await this.query(`SELECT id FROM ${codigosPostalesTable} WHERE CodigoPostal = ? LIMIT 1`, [cpLimpio]);
            if (rows && rows.length > 0 && rows[0].id) {
              payload.Id_CodigoPostal = rows[0].id;
            } else {
              // Crear el CP si no existe (usar Id_Provincia si viene; si no, inferir por prefijo 2 dígitos)
              let idProvincia = payload.Id_Provincia || payload.id_Provincia || null;
              if (!idProvincia && cpLimpio.length >= 2) {
                const pref = Number(cpLimpio.slice(0, 2));
                if (Number.isFinite(pref) && pref >= 1 && pref <= 52) idProvincia = pref;
              }
              let provinciaNombre = payload.Provincia || payload.provincia || null;
              if (!provinciaNombre && idProvincia) {
                try {
                  const provRows = await this.query('SELECT Nombre FROM provincias WHERE id = ? LIMIT 1', [idProvincia]);
                  provinciaNombre = provRows?.[0]?.Nombre || null;
                } catch (e) {
                  // opcional
                }
              }
              const localidad = payload.Poblacion || payload.poblacion || null;
              try {
                const creado = await this.createCodigoPostal({
                  CodigoPostal: cpLimpio,
                  Localidad: localidad,
                  Provincia: provinciaNombre,
                  Id_Provincia: idProvincia || null,
                  ComunidadAutonoma: null,
                  Latitud: null,
                  Longitud: null,
                  Activo: true
                });
                if (creado && creado.insertId) payload.Id_CodigoPostal = creado.insertId;
              } catch (e) {
                const retry = await this.query(`SELECT id FROM ${codigosPostalesTable} WHERE CodigoPostal = ? LIMIT 1`, [cpLimpio]);
                if (retry && retry.length > 0 && retry[0].id) {
                  payload.Id_CodigoPostal = retry[0].id;
                }
              }
            }
          } catch (e) {
            console.warn('⚠️ No se pudo resolver Id_CodigoPostal en updateComercial:', e.message);
          }
        }
      }
      
      if (payload.Nombre !== undefined) {
        updates.push('Nombre = ?');
        params.push(payload.Nombre);
      }
      if (payload.Email !== undefined) {
        updates.push('Email = ?');
        params.push(payload.Email);
      }
      if (payload.DNI !== undefined) {
        updates.push('DNI = ?');
        params.push(payload.DNI);
      }
      if (payload.Password !== undefined) {
        updates.push('Password = ?');
        params.push(payload.Password);
      }
      if (payload.Roll !== undefined) {
        const rollValue = Array.isArray(payload.Roll) ? JSON.stringify(payload.Roll) : payload.Roll;
        updates.push('Roll = ?');
        params.push(rollValue);
      }
      if (payload.Movil !== undefined) {
        updates.push('Movil = ?');
        params.push(payload.Movil);
      }
      if (payload.Direccion !== undefined) {
        updates.push('Direccion = ?');
        params.push(payload.Direccion);
      }
      if (payload.CodigoPostal !== undefined) {
        updates.push('CodigoPostal = ?');
        params.push(payload.CodigoPostal);
      }
      if (payload.Id_CodigoPostal !== undefined) {
        updates.push('Id_CodigoPostal = ?');
        params.push(payload.Id_CodigoPostal || null);
      }
      if (payload.Poblacion !== undefined) {
        updates.push('Poblacion = ?');
        params.push(payload.Poblacion);
      }
      if (payload.Id_Provincia !== undefined) {
        updates.push('Id_Provincia = ?');
        params.push(payload.Id_Provincia || null);
      }
      if (payload.fijo_mensual !== undefined) {
        updates.push('fijo_mensual = ?');
        params.push(payload.fijo_mensual);
      }
      
      // Campos de credenciales de reuniones
      if (payload.meet_email !== undefined) {
        updates.push('meet_email = ?');
        // No convertir '' a NULL automáticamente (puede romper si la columna está NOT NULL).
        params.push(payload.meet_email === '' ? '' : payload.meet_email);
      }
      if (payload.teams_email !== undefined) {
        updates.push('teams_email = ?');
        params.push(payload.teams_email === '' ? '' : payload.teams_email);
      }
      if (payload.plataforma_reunion_preferida !== undefined) {
        updates.push('plataforma_reunion_preferida = ?');
        params.push(payload.plataforma_reunion_preferida || 'meet');
      }
      
      if (updates.length === 0) {
        throw new Error('No hay campos para actualizar');
      }
      
      params.push(id);
      const sql = `UPDATE comerciales SET ${updates.join(', ')} WHERE Id = ?`;
      
      // Para UPDATE necesitamos usar execute directamente para obtener affectedRows
      if (!this.connected && !this.pool) {
        await this.connect();
      }
      const [result] = await this.pool.execute(sql, params);
      return { affectedRows: result.affectedRows || 0 };
    } catch (error) {
      console.error('❌ Error actualizando comercial:', error.message);
      throw error;
    }
  }

  async deleteComercial(id) {
    try {
      const sql = 'DELETE FROM comerciales WHERE Id = ?';
      const [result] = await this.query(sql, [id]);
      return result;
    } catch (error) {
      console.error('❌ Error eliminando comercial:', error.message);
      throw error;
    }
  }

  // ARTÍCULOS
  async getArticulos() {
    try {
      const sql = 'SELECT * FROM articulos ORDER BY Id ASC';
      const rows = await this.query(sql);
      console.log(`✅ Obtenidos ${rows.length} artículos`);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo artículos:', error.message);
      return [];
    }
  }

  async getArticuloById(id) {
    try {
      const sql = 'SELECT * FROM articulos WHERE Id = ? LIMIT 1';
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo artículo por ID:', error.message);
      return null;
    }
  }

  async getArticulosByCategoria(categoria) {
    try {
      const sql = 'SELECT * FROM articulos WHERE Categoria = ? OR categoria = ? OR Categoria_Farmaceutica = ? OR categoria_farmaceutica = ? ORDER BY Id ASC';
      const rows = await this.query(sql, [categoria, categoria, categoria, categoria]);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo artículos por categoría:', error.message);
      return [];
    }
  }

  async updateArticulo(id, payload) {
    try {
      // COLUMNAS VÁLIDAS en la tabla articulos (verificadas contra la BD)
      const columnasValidas = ['Nombre', 'SKU', 'Presentacion', 'PVL', 'PCP', 'Unidades_Caja', 'Imagen', 'Marca', 'EAN13', 'Activo', 'IVA', 'Id_Marca'];
      
      // FILTRAR el payload: solo incluir columnas válidas
      const payloadFiltrado = {};
      for (const [key, value] of Object.entries(payload)) {
        if (columnasValidas.includes(key)) {
          payloadFiltrado[key] = value;
        } else {
          console.warn(`⚠️ [UPDATE ARTICULO] Ignorando columna inválida: '${key}'`);
        }
      }
      
      if (Object.keys(payloadFiltrado).length === 0) {
        throw new Error('No hay columnas válidas para actualizar');
      }
      
      const fields = [];
      const values = [];
      
      console.log(`✅ [UPDATE ARTICULO] Actualizando artículo ${id}`);
      console.log(`✅ [UPDATE ARTICULO] Payload original:`, JSON.stringify(payload, null, 2));
      console.log(`✅ [UPDATE ARTICULO] Payload filtrado:`, JSON.stringify(payloadFiltrado, null, 2));
      
      for (const [key, value] of Object.entries(payloadFiltrado)) {
        fields.push(`\`${key}\` = ?`);
        values.push(value);
        console.log(`✅ [UPDATE ARTICULO] Campo ${key}: ${value} (tipo: ${typeof value})`);
      }
      
      values.push(id);
      const sql = `UPDATE articulos SET ${fields.join(', ')} WHERE \`Id\` = ?`;
      console.log(`✅ [UPDATE ARTICULO] SQL: ${sql}`);
      console.log(`✅ [UPDATE ARTICULO] Valores:`, values);
      
      const result = await this.query(sql, values);
      console.log(`✅ [UPDATE ARTICULO] Resultado:`, result);
      
      // Para UPDATE, el resultado debería ser un ResultSetHeader
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        console.log(`✅ [UPDATE ARTICULO] Filas afectadas:`, result.affectedRows);
        console.log(`✅ [UPDATE ARTICULO] Filas cambiadas:`, result.changedRows);
        return { affectedRows: result.affectedRows || 1, changedRows: result.changedRows || 0 };
      }
      
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando artículo:', error.message);
      console.error('❌ Stack:', error.stack);
      throw error;
    }
  }

  async createArticulo(payload) {
    try {
      const fields = Object.keys(payload).map(key => `\`${key}\``).join(', ');
      const placeholders = Object.keys(payload).map(() => '?').join(', ');
      const values = Object.values(payload);
      
      const sql = `INSERT INTO articulos (${fields}) VALUES (${placeholders})`;
      const result = await this.query(sql, values);
      return { insertId: result.insertId || result.insertId };
    } catch (error) {
      console.error('❌ Error creando artículo:', error.message);
      throw error;
    }
  }

  async deleteArticulo(id) {
    try {
      const sql = 'DELETE FROM articulos WHERE Id = ?';
      const result = await this.query(sql, [id]);
      return { affectedRows: result.affectedRows || 0 };
    } catch (error) {
      console.error('❌ Error eliminando artículo:', error.message);
      throw error;
    }
  }

  async toggleArticuloOkKo(id, value) {
    try {
      // Convertir valor a 1 (activo) o 0 (inactivo)
      // value puede ser: 'Activo'/'Inactivo', 'OK'/'KO', true/false, 1/0
      let activoValue = 1; // Por defecto activo
      
      if (typeof value === 'string') {
        const valLower = value.toLowerCase();
        activoValue = (valLower === 'activo' || valLower === 'ok' || valLower === 'true' || valLower === '1') ? 1 : 0;
      } else if (typeof value === 'boolean') {
        activoValue = value ? 1 : 0;
      } else if (typeof value === 'number') {
        activoValue = value ? 1 : 0;
      }
      
      const sql = 'UPDATE articulos SET Activo = ? WHERE Id = ?';
      await this.query(sql, [activoValue, id]);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando Activo de artículo:', error.message);
      throw error;
    }
  }

  // CLIENTES
  async getClientes(comercialId = null) {
    try {
      const { tClientes, pk, colComercial } = await this._ensureClientesMeta();
      let sql = `SELECT * FROM \`${tClientes}\``;
      const params = [];
      
      // Si se proporciona un comercialId, filtrar por él
      // El campo en la tabla clientes es Id_Cial (con mayúsculas, igual que en pedidos)
      if (comercialId) {
        if (!colComercial) {
          console.warn('⚠️ [GET_CLIENTES] No se pudo resolver la columna de comercial en clientes. Devolviendo vacío por seguridad.');
          return [];
        }
        sql += ` WHERE \`${colComercial}\` = ?`;
        params.push(comercialId);
        console.log(`🔐 [GET_CLIENTES] Filtro aplicado: ${colComercial} = ${comercialId}`);
      }
      
      sql += ` ORDER BY \`${pk}\` ASC`;
      
      const rows = await this.query(sql, params);
      console.log(`✅ Obtenidos ${rows.length} clientes${comercialId ? ` (filtrado por comercial ${comercialId})` : ''}`);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo clientes:', error.message);
      return [];
    }
  }

  /**
   * Método optimizado para obtener clientes con JOINs y filtros
   * @param {Object} filters - Filtros opcionales: { tipoCliente, provincia, comercial, conVentas }
   */
  async getClientesOptimizado(filters = {}) {
    let sql = '';
    try {
      const { colComercial, colEstadoCliente } = await this._ensureClientesMeta();
      const tEstados = colEstadoCliente ? await this._resolveTableNameCaseInsensitive('estdoClientes') : null;
      const whereConditions = [];
      const params = [];

      // Construir JOINs y WHERE - versión simplificada y robusta
      // Usar nombres de campos exactos como en la tabla
      sql = `
        SELECT 
          c.*,
          p.Nombre as ProvinciaNombre,
          tc.Tipo as TipoClienteNombre,
          ${colComercial ? 'cial.Nombre as ComercialNombre' : 'NULL as ComercialNombre'},
          ${colEstadoCliente ? 'ec.Nombre as EstadoClienteNombre' : 'NULL as EstadoClienteNombre'},
          ${colEstadoCliente ? `c.\`${colEstadoCliente}\` as EstadoClienteId` : 'NULL as EstadoClienteId'}
        FROM clientes c
        LEFT JOIN provincias p ON c.Id_Provincia = p.id
        LEFT JOIN tipos_clientes tc ON c.Id_TipoCliente = tc.id
        ${colComercial ? `LEFT JOIN comerciales cial ON c.\`${colComercial}\` = cial.id` : ''}
        ${colEstadoCliente ? `LEFT JOIN \`${tEstados}\` ec ON c.\`${colEstadoCliente}\` = ec.id` : ''}
      `;

      // Filtro por tipo de cliente
      if (filters.tipoCliente !== null && filters.tipoCliente !== undefined && filters.tipoCliente !== '' && !isNaN(filters.tipoCliente)) {
        const tipoClienteId = typeof filters.tipoCliente === 'number' ? filters.tipoCliente : parseInt(filters.tipoCliente);
        if (!isNaN(tipoClienteId) && tipoClienteId > 0) {
          whereConditions.push('c.Id_TipoCliente = ?');
          params.push(tipoClienteId);
          console.log('✅ [OPTIMIZADO] Filtro tipoCliente aplicado:', tipoClienteId);
        }
      }

      // Filtro por provincia
      if (filters.provincia !== null && filters.provincia !== undefined && filters.provincia !== '' && !isNaN(filters.provincia)) {
        const provinciaId = typeof filters.provincia === 'number' ? filters.provincia : parseInt(filters.provincia);
        if (!isNaN(provinciaId) && provinciaId > 0) {
          whereConditions.push('c.Id_Provincia = ?');
          params.push(provinciaId);
          console.log('✅ [OPTIMIZADO] Filtro provincia aplicado:', provinciaId);
        }
      }

      // Filtro por comercial
      if (filters.comercial !== null && filters.comercial !== undefined && filters.comercial !== '' && !isNaN(filters.comercial)) {
        const comercialId = typeof filters.comercial === 'number' ? filters.comercial : parseInt(filters.comercial);
        if (!isNaN(comercialId) && comercialId > 0) {
          if (!colComercial) {
            throw new Error('No se encontró columna de comercial en tabla clientes');
          }
          // Regla: comercial ve sus clientes; si filters.comercialIncludePool, incluir pool (1)
          if (filters.comercialIncludePool && comercialId !== 1) {
            whereConditions.push(`(c.\`${colComercial}\` = ? OR c.\`${colComercial}\` = 1)`);
          } else {
            whereConditions.push(`c.\`${colComercial}\` = ?`);
          }
          params.push(comercialId);
          console.log(`✅ [OPTIMIZADO] Filtro comercial aplicado: c.${colComercial} = ${comercialId}${filters.comercialIncludePool && comercialId !== 1 ? ' (+pool=1)' : ''}`);
        } else {
          console.warn(`⚠️ [OPTIMIZADO] Filtro comercial inválido (valor recibido: ${filters.comercial}, tipo: ${typeof filters.comercial})`);
        }
      } else {
        console.log(`ℹ️ [OPTIMIZADO] No se aplica filtro de comercial (valor: ${filters.comercial}, tipo: ${typeof filters.comercial})`);
      }

      // Filtro por estado de cliente (nuevo catálogo)
      if (colEstadoCliente && filters.estadoCliente !== null && filters.estadoCliente !== undefined && filters.estadoCliente !== '' && !isNaN(filters.estadoCliente)) {
        const estadoId = typeof filters.estadoCliente === 'number' ? filters.estadoCliente : parseInt(filters.estadoCliente);
        if (!isNaN(estadoId) && estadoId > 0) {
          whereConditions.push(`c.\`${colEstadoCliente}\` = ?`);
          params.push(estadoId);
        }
      }

      // Filtro por con/sin ventas
      if (filters.conVentas !== undefined && filters.conVentas !== null && filters.conVentas !== '') {
        if (filters.conVentas === true || filters.conVentas === 'true' || filters.conVentas === '1') {
          // Con ventas: debe tener al menos un pedido
          whereConditions.push('EXISTS (SELECT 1 FROM pedidos WHERE Id_Cliente = c.Id)');
          console.log('✅ [OPTIMIZADO] Filtro conVentas aplicado: true');
        } else if (filters.conVentas === false || filters.conVentas === 'false' || filters.conVentas === '0') {
          // Sin ventas: no debe tener pedidos
          whereConditions.push('NOT EXISTS (SELECT 1 FROM pedidos WHERE Id_Cliente = c.Id)');
          console.log('✅ [OPTIMIZADO] Filtro conVentas aplicado: false');
        }
      }

      // Agregar WHERE si hay condiciones
      if (whereConditions.length > 0) {
        sql += ' WHERE ' + whereConditions.join(' AND ');
        console.log(`✅ [OPTIMIZADO] ${whereConditions.length} condición(es) WHERE aplicada(s)`);
      } else {
        console.log('⚠️ [OPTIMIZADO] No hay condiciones WHERE, devolviendo todos los clientes');
      }

      // ORDER BY - usar Id como en el método original getClientes()
      sql += ' ORDER BY c.Id ASC';

      console.log('🔍 [OPTIMIZADO] SQL:', sql);
      console.log('🔍 [OPTIMIZADO] Params:', params);
      
      const rows = await this.query(sql, params);
      
      // Agregar TotalPedidos después de obtener los resultados para evitar problemas en la consulta principal
      // Esto es más lento pero más seguro
      if (rows && rows.length > 0) {
        const clienteIds = rows.map(c => c.id || c.Id).filter(id => id);
        if (clienteIds.length > 0) {
          try {
            // Consulta más robusta para pedidos
            // Consulta de pedidos - usar parámetros correctamente
            const placeholders = clienteIds.map(() => '?').join(',');
            const pedidosCount = await this.query(
              `SELECT Id_Cliente, COUNT(*) as total 
               FROM pedidos 
               WHERE Id_Cliente IN (${placeholders})
               GROUP BY Id_Cliente`,
              clienteIds
            ).catch(() => []);
            
            const pedidosMap = new Map();
            pedidosCount.forEach(p => {
              const clienteId = p.Id_Cliente || p.id_Cliente;
              pedidosMap.set(clienteId, parseInt(p.total || 0));
            });
            
            rows.forEach(cliente => {
              const clienteId = cliente.id || cliente.Id;
              cliente.TotalPedidos = pedidosMap.get(clienteId) || 0;
            });
          } catch (pedidosError) {
            console.warn('⚠️ [OPTIMIZADO] Error obteniendo conteo de pedidos:', pedidosError.message);
            rows.forEach(cliente => {
              cliente.TotalPedidos = 0;
            });
          }
        }
      }
      
      console.log(`✅ [OPTIMIZADO] Obtenidos ${rows.length} clientes con filtros:`, filters);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo clientes optimizado:', error.message);
      console.error('❌ Stack:', error.stack);
      console.error('❌ SQL que falló:', sql);
      // Fallback al método original
      console.log('⚠️ [FALLBACK] Usando método getClientes() original');
      return await this.getClientes();
    }
  }

  /**
   * Clientes paginados (evita cargar miles de filas y bloquear el render).
   * Devuelve solo la página solicitada.
   *
   * @param {Object} filters - { tipoCliente, provincia, comercial, conVentas, estado }
   * @param {Object} options - { limit, offset }
   */
  async getClientesOptimizadoPaged(filters = {}, options = {}) {
    let sql = '';
    try {
      const { pk, colComercial, colEstadoCliente } = await this._ensureClientesMeta();
      const tEstados = colEstadoCliente ? await this._resolveTableNameCaseInsensitive('estdoClientes') : null;
      const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Math.min(500, Number(options.limit))) : 50;
      const offset = Number.isFinite(Number(options.offset)) ? Math.max(0, Number(options.offset)) : 0;

      const whereConditions = [];
      const params = [];

      sql = `
        SELECT 
          c.*,
          p.Nombre as ProvinciaNombre,
          tc.Tipo as TipoClienteNombre,
          ${colComercial ? 'cial.Nombre as ComercialNombre' : 'NULL as ComercialNombre'},
          ${colEstadoCliente ? 'ec.Nombre as EstadoClienteNombre' : 'NULL as EstadoClienteNombre'},
          ${colEstadoCliente ? `c.\`${colEstadoCliente}\` as EstadoClienteId` : 'NULL as EstadoClienteId'}
        FROM clientes c
        LEFT JOIN provincias p ON c.Id_Provincia = p.id
        LEFT JOIN tipos_clientes tc ON c.Id_TipoCliente = tc.id
        ${colComercial ? `LEFT JOIN comerciales cial ON c.\`${colComercial}\` = cial.id` : ''}
        ${colEstadoCliente ? `LEFT JOIN \`${tEstados}\` ec ON c.\`${colEstadoCliente}\` = ec.id` : ''}
      `;

      // Resolver columna cliente en pedidos (Id_Cliente vs Cliente_id, etc.) para con/sin ventas.
      // Cache simple en la instancia para no repetir SHOW COLUMNS en cada request.
      if (!this.__pedidosClienteCol) {
        try {
          const colsRows = await this.query('SHOW COLUMNS FROM pedidos').catch(() => []);
          const cols = new Set((colsRows || []).map(r => String(r.Field || '').trim()).filter(Boolean));
          this.__pedidosClienteCol =
            ['Id_Cliente', 'Cliente_id', 'id_cliente', 'cliente_id', 'ClienteId', 'clienteId'].find(c => cols.has(c)) || 'Id_Cliente';
          // Columna de fecha del pedido para ordenar por "último pedido" (compatibilidad de esquemas)
          this.__pedidosFechaCol =
            ['FechaPedido', 'Fecha', 'fecha', 'CreatedAt', 'created_at', 'Fecha_Pedido', 'fecha_pedido'].find(c => cols.has(c)) || null;
        } catch (_) {
          this.__pedidosClienteCol = 'Id_Cliente';
          this.__pedidosFechaCol = null;
        }
      }

      // Estado: preferir catálogo si existe; fallback a OK_KO si no.
      if (colEstadoCliente) {
        if (filters.estadoCliente !== undefined && filters.estadoCliente !== null && String(filters.estadoCliente).trim() !== '' && !isNaN(filters.estadoCliente)) {
          const estadoId = Number(filters.estadoCliente);
          if (Number.isFinite(estadoId) && estadoId > 0) {
            whereConditions.push(`c.\`${colEstadoCliente}\` = ?`);
            params.push(estadoId);
          }
        } else if (filters.estado && typeof filters.estado === 'string') {
          // Compatibilidad legacy: estado=activos/inactivos/todos
          const ids = await this._getEstadoClienteIds();
          const e = filters.estado.trim().toLowerCase();
          if (e === 'activos') {
            whereConditions.push(`c.\`${colEstadoCliente}\` = ?`);
            params.push(ids.activo);
          } else if (e === 'inactivos') {
            whereConditions.push(`c.\`${colEstadoCliente}\` = ?`);
            params.push(ids.inactivo);
          }
        }
      } else {
        if (filters.estado === 'activos') {
          whereConditions.push("(c.OK_KO = 1 OR c.OK_KO = '1' OR UPPER(c.OK_KO) = 'OK')");
        } else if (filters.estado === 'inactivos') {
          whereConditions.push("(c.OK_KO = 0 OR c.OK_KO = '0' OR UPPER(c.OK_KO) = 'KO')");
        }
      }

      if (filters.tipoCliente !== null && filters.tipoCliente !== undefined && filters.tipoCliente !== '' && !isNaN(filters.tipoCliente)) {
        const tipoClienteId = typeof filters.tipoCliente === 'number' ? filters.tipoCliente : parseInt(filters.tipoCliente);
        if (!isNaN(tipoClienteId) && tipoClienteId > 0) {
          whereConditions.push('c.Id_TipoCliente = ?');
          params.push(tipoClienteId);
        }
      }

      if (filters.provincia !== null && filters.provincia !== undefined && filters.provincia !== '' && !isNaN(filters.provincia)) {
        const provinciaId = typeof filters.provincia === 'number' ? filters.provincia : parseInt(filters.provincia);
        if (!isNaN(provinciaId) && provinciaId > 0) {
          whereConditions.push('c.Id_Provincia = ?');
          params.push(provinciaId);
        }
      }

      if (filters.comercial !== null && filters.comercial !== undefined && filters.comercial !== '' && !isNaN(filters.comercial)) {
        const comercialId = typeof filters.comercial === 'number' ? filters.comercial : parseInt(filters.comercial);
        if (!isNaN(comercialId) && comercialId > 0) {
          if (!colComercial) {
            throw new Error('No se encontró columna de comercial en tabla clientes');
          }
          // Regla: comercial ve sus clientes + pool (Id=1) si se pide explícitamente
          if (filters.comercialIncludePool && comercialId !== 1) {
            whereConditions.push(`(c.\`${colComercial}\` = ? OR c.\`${colComercial}\` = 1)`);
          } else {
            whereConditions.push(`c.\`${colComercial}\` = ?`);
          }
          params.push(comercialId);
        }
      }

      if (filters.conVentas !== undefined && filters.conVentas !== null && filters.conVentas !== '') {
        if (filters.conVentas === true || filters.conVentas === 'true' || filters.conVentas === '1') {
          whereConditions.push(`EXISTS (SELECT 1 FROM pedidos p2 WHERE p2.\`${this.__pedidosClienteCol}\` = c.\`${pk}\`)`);
        } else if (filters.conVentas === false || filters.conVentas === 'false' || filters.conVentas === '0') {
          whereConditions.push(`NOT EXISTS (SELECT 1 FROM pedidos p2 WHERE p2.\`${this.__pedidosClienteCol}\` = c.\`${pk}\`)`);
        }
      }

      // Búsqueda inteligente (servidor) por múltiples campos.
      if (filters.q && typeof filters.q === 'string' && filters.q.trim().length >= 2) {
        const termLower = filters.q.trim().toLowerCase();
        const like = `%${termLower}%`;
        whereConditions.push(`(
          LOWER(IFNULL(c.Nombre_Razon_Social,'')) LIKE ?
          OR LOWER(IFNULL(c.Nombre_Cial,'')) LIKE ?
          OR LOWER(IFNULL(c.DNI_CIF,'')) LIKE ?
          OR LOWER(IFNULL(c.Email,'')) LIKE ?
          OR LOWER(IFNULL(c.Telefono,'')) LIKE ?
          OR LOWER(IFNULL(c.Movil,'')) LIKE ?
          OR LOWER(IFNULL(c.NumeroFarmacia,'')) LIKE ?
          OR LOWER(IFNULL(c.Direccion,'')) LIKE ?
          OR LOWER(IFNULL(c.Poblacion,'')) LIKE ?
          OR LOWER(IFNULL(c.CodigoPostal,'')) LIKE ?
          OR LOWER(IFNULL(c.NomContacto,'')) LIKE ?
          OR LOWER(IFNULL(c.Observaciones,'')) LIKE ?
          OR LOWER(IFNULL(c.IBAN,'')) LIKE ?
          OR LOWER(IFNULL(c.CuentaContable,'')) LIKE ?
        )`);
        params.push(like, like, like, like, like, like, like, like, like, like, like, like, like, like);
      }

      if (whereConditions.length > 0) {
        sql += ' WHERE ' + whereConditions.join(' AND ');
      }

      // Orden estable (evita saltos entre páginas)
      // Nota: algunos drivers/entornos dan problemas con placeholders en LIMIT/OFFSET.
      // Como limit/offset ya están saneados a números, los interpolamos directamente.
      // Orden:
      // - Si estamos en modo "conVentas" y no hay búsqueda, priorizar por último pedido (para que los "primeros 20" sean relevantes)
      // - Si hay búsqueda u otros filtros, ordenar estable por Id.
      const hasSearch = !!(filters.q && String(filters.q).trim().length >= 2);
      const conVentas = (filters.conVentas === true || filters.conVentas === 'true' || filters.conVentas === '1');
      if (conVentas && !hasSearch && this.__pedidosFechaCol) {
        sql += ` ORDER BY (SELECT MAX(p3.\`${this.__pedidosFechaCol}\`) FROM pedidos p3 WHERE p3.\`${this.__pedidosClienteCol}\` = c.\`${pk}\`) DESC, c.\`${pk}\` ASC LIMIT ${limit} OFFSET ${offset}`;
      } else {
        sql += ` ORDER BY c.\`${pk}\` ASC LIMIT ${limit} OFFSET ${offset}`;
      }

      const rows = await this.query(sql, params);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo clientes paginados:', error.message);
      console.error('❌ SQL (paged):', sql);
      throw error;
    }
  }

  /**
   * Conteo para paginación con los mismos filtros que getClientesOptimizadoPaged.
   */
  async countClientesOptimizado(filters = {}) {
    let sql = '';
    try {
      const { pk, colComercial, colEstadoCliente } = await this._ensureClientesMeta();
      const whereConditions = [];

      sql = 'SELECT COUNT(*) as total FROM clientes c';
      const params = [];

      // Estado: preferir catálogo si existe; fallback a OK_KO si no.
      if (colEstadoCliente) {
        if (filters.estadoCliente !== undefined && filters.estadoCliente !== null && String(filters.estadoCliente).trim() !== '' && !isNaN(filters.estadoCliente)) {
          const estadoId = Number(filters.estadoCliente);
          if (Number.isFinite(estadoId) && estadoId > 0) {
            whereConditions.push(`c.\`${colEstadoCliente}\` = ?`);
            params.push(estadoId);
          }
        } else if (filters.estado && typeof filters.estado === 'string') {
          const ids = await this._getEstadoClienteIds();
          const e = filters.estado.trim().toLowerCase();
          if (e === 'activos') {
            whereConditions.push(`c.\`${colEstadoCliente}\` = ?`);
            params.push(ids.activo);
          } else if (e === 'inactivos') {
            whereConditions.push(`c.\`${colEstadoCliente}\` = ?`);
            params.push(ids.inactivo);
          }
        }
      } else {
        if (filters.estado === 'activos') {
          whereConditions.push("(c.OK_KO = 1 OR c.OK_KO = '1' OR UPPER(c.OK_KO) = 'OK')");
        } else if (filters.estado === 'inactivos') {
          whereConditions.push("(c.OK_KO = 0 OR c.OK_KO = '0' OR UPPER(c.OK_KO) = 'KO')");
        }
      }

      // Resolver columna cliente en pedidos (Id_Cliente vs Cliente_id, etc.) para con/sin ventas.
      if (!this.__pedidosClienteCol) {
        try {
          const colsRows = await this.query('SHOW COLUMNS FROM pedidos').catch(() => []);
          const cols = new Set((colsRows || []).map(r => String(r.Field || '').trim()).filter(Boolean));
          this.__pedidosClienteCol =
            ['Id_Cliente', 'Cliente_id', 'id_cliente', 'cliente_id', 'ClienteId', 'clienteId'].find(c => cols.has(c)) || 'Id_Cliente';
        } catch (_) {
          this.__pedidosClienteCol = 'Id_Cliente';
        }
      }

      if (filters.tipoCliente !== null && filters.tipoCliente !== undefined && filters.tipoCliente !== '' && !isNaN(filters.tipoCliente)) {
        const tipoClienteId = typeof filters.tipoCliente === 'number' ? filters.tipoCliente : parseInt(filters.tipoCliente);
        if (!isNaN(tipoClienteId) && tipoClienteId > 0) {
          whereConditions.push('c.Id_TipoCliente = ?');
          params.push(tipoClienteId);
        }
      }

      if (filters.provincia !== null && filters.provincia !== undefined && filters.provincia !== '' && !isNaN(filters.provincia)) {
        const provinciaId = typeof filters.provincia === 'number' ? filters.provincia : parseInt(filters.provincia);
        if (!isNaN(provinciaId) && provinciaId > 0) {
          whereConditions.push('c.Id_Provincia = ?');
          params.push(provinciaId);
        }
      }

      if (filters.comercial !== null && filters.comercial !== undefined && filters.comercial !== '' && !isNaN(filters.comercial)) {
        const comercialId = typeof filters.comercial === 'number' ? filters.comercial : parseInt(filters.comercial);
        if (!isNaN(comercialId) && comercialId > 0) {
          if (!colComercial) {
            throw new Error('No se encontró columna de comercial en tabla clientes');
          }
          if (filters.comercialIncludePool && comercialId !== 1) {
            whereConditions.push(`(c.\`${colComercial}\` = ? OR c.\`${colComercial}\` = 1)`);
          } else {
            whereConditions.push(`c.\`${colComercial}\` = ?`);
          }
          params.push(comercialId);
        }
      }

      if (filters.conVentas !== undefined && filters.conVentas !== null && filters.conVentas !== '') {
        if (filters.conVentas === true || filters.conVentas === 'true' || filters.conVentas === '1') {
          whereConditions.push(`EXISTS (SELECT 1 FROM pedidos p2 WHERE p2.\`${this.__pedidosClienteCol}\` = c.\`${pk}\`)`);
        } else if (filters.conVentas === false || filters.conVentas === 'false' || filters.conVentas === '0') {
          whereConditions.push(`NOT EXISTS (SELECT 1 FROM pedidos p2 WHERE p2.\`${this.__pedidosClienteCol}\` = c.\`${pk}\`)`);
        }
      }

      if (filters.q && typeof filters.q === 'string' && filters.q.trim().length >= 2) {
        const termLower = filters.q.trim().toLowerCase();
        const like = `%${termLower}%`;
        whereConditions.push(`(
          LOWER(IFNULL(c.Nombre_Razon_Social,'')) LIKE ?
          OR LOWER(IFNULL(c.Nombre_Cial,'')) LIKE ?
          OR LOWER(IFNULL(c.DNI_CIF,'')) LIKE ?
          OR LOWER(IFNULL(c.Email,'')) LIKE ?
          OR LOWER(IFNULL(c.Telefono,'')) LIKE ?
          OR LOWER(IFNULL(c.Movil,'')) LIKE ?
          OR LOWER(IFNULL(c.NumeroFarmacia,'')) LIKE ?
          OR LOWER(IFNULL(c.Direccion,'')) LIKE ?
          OR LOWER(IFNULL(c.Poblacion,'')) LIKE ?
          OR LOWER(IFNULL(c.CodigoPostal,'')) LIKE ?
          OR LOWER(IFNULL(c.NomContacto,'')) LIKE ?
          OR LOWER(IFNULL(c.Observaciones,'')) LIKE ?
          OR LOWER(IFNULL(c.IBAN,'')) LIKE ?
          OR LOWER(IFNULL(c.CuentaContable,'')) LIKE ?
        )`);
        params.push(like, like, like, like, like, like, like, like, like, like, like, like, like, like);
      }

      if (whereConditions.length > 0) {
        sql += ' WHERE ' + whereConditions.join(' AND ');
      }

      const rows = await this.query(sql, params);
      return rows?.[0]?.total ? Number(rows[0].total) : 0;
    } catch (error) {
      console.error('❌ Error contando clientes (optimizado):', error.message);
      console.error('❌ SQL (count):', sql);
      return 0;
    }
  }

  async getClientesCount() {
    try {
      const sql = 'SELECT COUNT(*) as count FROM clientes';
      const rows = await this.query(sql);
      const count = rows[0]?.count || rows[0]?.COUNT || 0;
      console.log(`📊 [COUNT CLIENTES] Total de clientes: ${count}`);
      return parseInt(count, 10) || 0;
    } catch (error) {
      console.error('❌ Error obteniendo conteo de clientes:', error.message);
      console.error('❌ Stack:', error.stack);
      // Fallback: obtener todos y contar
      try {
        const todos = await this.getClientes();
        const fallbackCount = Array.isArray(todos) ? todos.length : 0;
        console.log(`⚠️ [COUNT CLIENTES] Usando fallback, contados: ${fallbackCount}`);
        return fallbackCount;
      } catch (fallbackError) {
        console.error('❌ Error en fallback de conteo:', fallbackError.message);
        return 0;
      }
    }
  }

  async getClientesEstadisticas() {
    try {
      // Obtener total de clientes
      const sqlTotal = 'SELECT COUNT(*) as total FROM clientes';
      const rowsTotal = await this.query(sqlTotal);
      const total = parseInt(rowsTotal[0]?.total || rowsTotal[0]?.COUNT || 0, 10);

      // Obtener clientes activos usando OK_KO (Estado)
      // OK_KO = 1 significa Activo, OK_KO = 0 significa Inactivo
      // También aceptar valores legacy 'OK'/'KO' para compatibilidad
      const sqlActivos = `
        SELECT COUNT(*) as activos 
        FROM clientes 
        WHERE (OK_KO = 1 OR UPPER(TRIM(COALESCE(OK_KO, ''))) = 'OK')
      `;
      let rowsActivos;
      let activos = 0;
      
      try {
        rowsActivos = await this.query(sqlActivos);
        activos = parseInt(rowsActivos[0]?.activos || rowsActivos[0]?.ACTIVOS || 0, 10);
      } catch (errorActivos) {
        console.log('⚠️ [ESTADISTICAS] Error en consulta de activos, usando fallback:', errorActivos.message);
        // Si falla, usar el método de fallback directamente
        throw errorActivos;
      }

      // Calcular inactivos
      const inactivos = total - activos;

      console.log(`📊 [ESTADISTICAS CLIENTES] Total: ${total}, Activos: ${activos}, Inactivos: ${inactivos}`);

      return {
        total: total,
        activos: activos,
        inactivos: inactivos
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de clientes:', error.message);
      console.error('❌ Stack:', error.stack);
      
      // Fallback: obtener todos y contar manualmente usando OK_KO
      try {
        const todos = await this.getClientes();
        const total = Array.isArray(todos) ? todos.length : 0;
        let activos = 0;
        
        todos.forEach(cliente => {
          // Usar OK_KO para determinar si está activo
          const okKo = cliente.OK_KO;
          if (okKo === 1 || okKo === true || okKo === '1' || (typeof okKo === 'string' && okKo.toUpperCase().trim() === 'OK')) {
            activos++;
          }
        });
        
        const inactivos = total - activos;
        
        console.log(`⚠️ [ESTADISTICAS CLIENTES] Usando fallback - Total: ${total}, Activos: ${activos}, Inactivos: ${inactivos}`);
        
        return {
          total: total,
          activos: activos,
          inactivos: inactivos
        };
      } catch (fallbackError) {
        console.error('❌ Error en fallback de estadísticas:', fallbackError.message);
        return {
          total: 0,
          activos: 0,
          inactivos: 0
        };
      }
    }
  }

  async getClienteById(id) {
    try {
      const tClientes = await this._resolveTableNameCaseInsensitive('clientes');
      const sql = `SELECT * FROM \`${tClientes}\` WHERE Id = ? LIMIT 1`;
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo cliente por ID:', error.message);
      return null;
    }
  }

  async getClientesByComercial(comercialId) {
    try {
      const sql = 'SELECT * FROM clientes WHERE ComercialId = ? OR comercialId = ? ORDER BY Id ASC';
      const rows = await this.query(sql, [comercialId, comercialId]);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo clientes por comercial:', error.message);
      return [];
    }
  }

  async getClientesByCodigoPostal(idCodigoPostal) {
    try {
      const sql = `
        SELECT 
          c.*,
          c.Nombre_Razon_Social AS Nombre,
          c.Poblacion,
          com.Nombre AS NombreComercial
        FROM Clientes c
        LEFT JOIN Comerciales com ON c.Id_Cial = com.id
        WHERE c.Id_CodigoPostal = ?
        ORDER BY c.Nombre_Razon_Social ASC
      `;
      const rows = await this.query(sql, [idCodigoPostal]);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo clientes por código postal:', error.message);
      return [];
    }
  }

  async moverClienteAPapelera(clienteId, eliminadoPor) {
    try {
      // Obtener el cliente completo
      const cliente = await this.getClienteById(clienteId);
      if (!cliente) {
        throw new Error('Cliente no encontrado');
      }

      // Preparar los datos para insertar en la papelera
      const datosPapelera = {
        id: cliente.id || cliente.Id,
        Id_Cial: cliente.Id_Cial || cliente.id_Cial,
        DNI_CIF: cliente.DNI_CIF,
        Nombre_Razon_Social: cliente.Nombre_Razon_Social || cliente.Nombre,
        Nombre_Cial: cliente.Nombre_Cial,
        NumeroFarmacia: cliente.NumeroFarmacia,
        Direccion: cliente.Direccion,
        Poblacion: cliente.Poblacion,
        Id_Provincia: cliente.Id_Provincia || cliente.id_Provincia,
        CodigoPostal: cliente.CodigoPostal,
        Movil: cliente.Movil,
        Telefono: cliente.Telefono,
        Email: cliente.Email,
        TipoCliente: cliente.TipoCliente,
        Id_TipoCliente: cliente.Id_TipoCliente || cliente.id_TipoCliente,
        CodPais: cliente.CodPais,
        Id_Pais: cliente.Id_Pais || cliente.id_Pais,
        Pais: cliente.Pais,
        Idioma: cliente.Idioma,
        Id_Idioma: cliente.Id_Idioma || cliente.id_Idioma,
        Moneda: cliente.Moneda,
        Id_Moneda: cliente.Id_Moneda || cliente.id_Moneda,
        NomContacto: cliente.NomContacto,
        Tarifa: cliente.Tarifa,
        Id_FormaPago: cliente.Id_FormaPago || cliente.id_FormaPago,
        Dto: cliente.Dto,
        CuentaContable: cliente.CuentaContable,
        RE: cliente.RE,
        Banco: cliente.Banco,
        Swift: cliente.Swift,
        IBAN: cliente.IBAN,
        Modelo_347: cliente.Modelo_347,
        FechaEliminacion: new Date(),
        EliminadoPor: eliminadoPor
      };

      // Insertar en la papelera
      const campos = Object.keys(datosPapelera).map(key => `\`${key}\``).join(', ');
      const placeholders = Object.keys(datosPapelera).map(() => '?').join(', ');
      const valores = Object.values(datosPapelera);

      const sqlInsert = `INSERT INTO \`Papelera-Clientes\` (${campos}) VALUES (${placeholders})`;
      console.log('📝 [PAPELERA] Insertando cliente en papelera:', { clienteId, eliminadoPor });
      await this.query(sqlInsert, valores);

      // Eliminar de la tabla clientes
      const sqlDelete = 'DELETE FROM clientes WHERE id = ?';
      await this.query(sqlDelete, [clienteId]);

      console.log(`✅ Cliente ${clienteId} movido a la papelera por usuario ${eliminadoPor}`);
      return { success: true, message: 'Cliente movido a la papelera correctamente' };
    } catch (error) {
      console.error('❌ Error moviendo cliente a la papelera:', error.message);
      throw error;
    }
  }

  async updateCliente(id, payload) {
    try {
      // Tarifa: si no viene o viene vacía, aplicar PVL (Id=0)
      if (payload.Tarifa !== undefined) {
        const raw = payload.Tarifa;
        if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
          payload.Tarifa = 0;
        } else {
          const n = Number.parseInt(String(raw).trim(), 10);
          payload.Tarifa = Number.isFinite(n) ? n : 0;
        }
      }

      // Validar y normalizar OK_KO (Estado) - debe ser 1 (Activo) o 0 (Inactivo)
      // OK_KO es el campo que determina si un cliente está activo o no
      if (payload.OK_KO !== undefined && payload.OK_KO !== null) {
        const estado = payload.OK_KO;
        if (typeof estado === 'string') {
          const estadoLower = estado.toLowerCase().trim();
          if (!['activo', 'inactivo', 'ok', 'ko', '1', '0', 'true', 'false'].includes(estadoLower)) {
            throw new Error(`El campo Estado (OK_KO) solo puede ser "Activo" o "Inactivo". Valor recibido: "${estado}"`);
          }
          payload.OK_KO = (estadoLower === 'activo' || estadoLower === 'ok' || estadoLower === 'true' || estadoLower === '1') ? 1 : 0;
        } else if (typeof estado === 'number') {
          if (estado !== 0 && estado !== 1) {
            throw new Error(`El campo Estado (OK_KO) solo puede ser 1 (Activo) o 0 (Inactivo). Valor recibido: ${estado}`);
          }
          payload.OK_KO = estado;
        } else if (typeof estado === 'boolean') {
          payload.OK_KO = estado ? 1 : 0;
        } else {
          throw new Error(`El campo Estado (OK_KO) tiene un formato inválido. Valor recibido: ${estado} (tipo: ${typeof estado})`);
        }
      }
      
      // Obtener provincias y países para validación
      const provincias = await this.getProvincias();
      const paises = await this.getPaises();
      
      // Si se actualiza Id_Pais, actualizar también CodPais y Pais (legacy)
      if (payload.Id_Pais !== undefined) {
        try {
          const pais = await this.getPaisById(payload.Id_Pais);
          if (pais) {
            // Normalizar nombre del país antes de guardarlo en campos legacy
            const { normalizeTitleCaseES } = require('../utils/normalize-utf8');
            payload.CodPais = pais.Id_pais;
            payload.Pais = normalizeTitleCaseES(pais.Nombre_pais || '');
          }
        } catch (error) {
          console.warn('⚠️  No se pudo obtener país por ID:', error.message);
        }
      }
      
      // Obtener valores actuales del cliente para validación
      const clienteActual = await this.getClienteById(id);
      const provinciaId = payload.Id_Provincia !== undefined ? payload.Id_Provincia : (clienteActual?.Id_Provincia || clienteActual?.id_Provincia);
      const paisId = payload.Id_Pais !== undefined ? payload.Id_Pais : (clienteActual?.Id_Pais || clienteActual?.id_Pais);

      // Estado de cliente (nuevo): Id_EstdoCliente (si existe la columna)
      // Regla solicitada:
      // - Inactivo si OK_KO=0 o si se selecciona Inactivo explícitamente
      // - Si no inactivo:
      //    * DNI/CIF inválido => Potencial
      //    * DNI/CIF válido   => Activo
      try {
        const meta = await this._ensureClientesMeta();
        const colEstadoCliente = meta?.colEstadoCliente || null;
        if (colEstadoCliente) {
          const ids = await this._getEstadoClienteIds().catch(() => ({ potencial: 1, activo: 2, inactivo: 3 }));

          const dniToCheck = (payload.DNI_CIF !== undefined) ? payload.DNI_CIF : (clienteActual?.DNI_CIF);
          const dniValido = this._isValidDniCif(dniToCheck);

          const okKoToCheck = (payload.OK_KO !== undefined) ? payload.OK_KO : (clienteActual?.OK_KO);
          const esInactivoPorOkKo = (okKoToCheck === 0 || okKoToCheck === '0' || okKoToCheck === false || (typeof okKoToCheck === 'string' && okKoToCheck.toUpperCase().trim() === 'KO'));

          const estadoReq = (payload.Id_EstdoCliente !== undefined && payload.Id_EstdoCliente !== null && String(payload.Id_EstdoCliente).trim() !== '')
            ? Number(payload.Id_EstdoCliente)
            : null;

          const estadoFinal = (estadoReq === ids.inactivo || esInactivoPorOkKo)
            ? ids.inactivo
            : (dniValido ? ids.activo : ids.potencial);

          payload.Id_EstdoCliente = estadoFinal;
          payload.OK_KO = (estadoFinal === ids.inactivo) ? 0 : 1;
        }
      } catch (e) {
        // Si falla, no bloquear el update (compatibilidad sin migración)
        console.warn('⚠️  [UPDATE] No se pudo calcular Id_EstdoCliente:', e?.message || e);
      }
      
      // Si hay código postal, validar correspondencia con provincia y país
      if (payload.CodigoPostal && (provinciaId || paisId)) {
        try {
          const { validarCodigoPostalProvinciaPais } = require('../scripts/validar-codigo-postal-provincia-pais');
          const validacion = validarCodigoPostalProvinciaPais(payload.CodigoPostal, provinciaId, paisId, provincias, paises);
          
          if (!validacion.valido) {
            throw new Error(validacion.error);
          }
        } catch (error) {
          throw new Error(`Error de validación: ${error.message}`);
        }
      }
      
      // Si se actualiza CodigoPostal y no hay Id_Provincia, intentar asociarla
      if (payload.CodigoPostal && !payload.Id_Provincia) {
        try {
          const { obtenerProvinciaPorCodigoPostal } = require('../scripts/asociar-provincia-por-codigo-postal');
          if (provincias && provincias.length > 0) {
            const provinciaIdFromCP = obtenerProvinciaPorCodigoPostal(payload.CodigoPostal, provincias);
            if (provinciaIdFromCP) {
              payload.Id_Provincia = provinciaIdFromCP;
              // Actualizar Pais si no está definido
              const provincia = provincias.find(p => p.id === provinciaIdFromCP);
              if (provincia && !payload.Id_Pais && !payload.Pais) {
                // Buscar país por código de país de la provincia
                const pais = await this.getPaisByCodigoISO(provincia.CodigoPais);
                if (pais) {
                  payload.Id_Pais = pais.id;
                  payload.Pais = pais.Nombre_pais;
                  payload.CodPais = pais.Id_pais;
                } else {
                  payload.Pais = provincia.Pais;
                  payload.CodPais = provincia.CodigoPais;
                }
              }
            }
          }
        } catch (error) {
          // Si falla la asociación, continuar sin ella
          console.warn('⚠️  No se pudo asociar provincia por código postal:', error.message);
        }
      }
      
      const fields = [];
      const values = [];
      
      for (const [key, value] of Object.entries(payload)) {
        fields.push(`\`${key}\` = ?`);
        values.push(value);
      }
      
      values.push(id);
      const tClientes = await this._resolveTableNameCaseInsensitive('clientes');
      const sql = `UPDATE \`${tClientes}\` SET ${fields.join(', ')} WHERE Id = ?`;
      await this.query(sql, values);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando cliente:', error.message);
      throw error;
    }
  }

  async createCliente(payload) {
    try {
      // Tarifa: si no viene o viene vacía, aplicar PVL (Id=0)
      if (payload.Tarifa === undefined || payload.Tarifa === null || (typeof payload.Tarifa === 'string' && payload.Tarifa.trim() === '')) {
        payload.Tarifa = 0;
      } else {
        const n = Number.parseInt(String(payload.Tarifa).trim(), 10);
        payload.Tarifa = Number.isFinite(n) ? n : 0;
      }

      // Validar y normalizar OK_KO (Estado) - debe ser 1 (Activo) o 0 (Inactivo)
      // OK_KO es el campo que determina si un cliente está activo o no
      if (payload.OK_KO !== undefined && payload.OK_KO !== null) {
        const estado = payload.OK_KO;
        if (typeof estado === 'string') {
          const estadoLower = estado.toLowerCase().trim();
          if (!['activo', 'inactivo', 'ok', 'ko', '1', '0', 'true', 'false'].includes(estadoLower)) {
            throw new Error(`El campo Estado (OK_KO) solo puede ser "Activo" o "Inactivo". Valor recibido: "${estado}"`);
          }
          payload.OK_KO = (estadoLower === 'activo' || estadoLower === 'ok' || estadoLower === 'true' || estadoLower === '1') ? 1 : 0;
        } else if (typeof estado === 'number') {
          if (estado !== 0 && estado !== 1) {
            throw new Error(`El campo Estado (OK_KO) solo puede ser 1 (Activo) o 0 (Inactivo). Valor recibido: ${estado}`);
          }
          payload.OK_KO = estado;
        } else if (typeof estado === 'boolean') {
          payload.OK_KO = estado ? 1 : 0;
        } else {
          throw new Error(`El campo Estado (OK_KO) tiene un formato inválido. Valor recibido: ${estado} (tipo: ${typeof estado})`);
        }
      } else {
        // Por defecto activo si no se especifica
        payload.OK_KO = 1;
      }
      
      // Normalizar DNI_CIF: si viene vacío, guardar como "Pendiente"
      if (payload.DNI_CIF !== undefined && payload.DNI_CIF !== null) {
        const dniValue = String(payload.DNI_CIF).trim();
        if (dniValue === '' || dniValue.toLowerCase() === 'pendiente') {
          payload.DNI_CIF = 'Pendiente';
        }
      }

      // Estado de cliente (nuevo): Id_EstdoCliente
      // Regla solicitada:
      // - Si el cliente está inactivo (OK_KO=0) => Inactivo
      // - Si NO está inactivo:
      //    * DNI/CIF inválido => Potencial
      //    * DNI/CIF válido   => Activo
      const meta = await this._ensureClientesMeta().catch(() => null);
      const colEstadoCliente = meta?.colEstadoCliente || null;
      if (colEstadoCliente) {
        const ids = await this._getEstadoClienteIds().catch(() => ({ potencial: 1, activo: 2, inactivo: 3 }));

        const dniToCheck = payload.DNI_CIF;
        const dniValido = this._isValidDniCif(dniToCheck);
        const okKo = payload.OK_KO;
        const esInactivo = (okKo === 0 || okKo === '0' || okKo === false);

        // Si viene estado explícito y es Inactivo, respetar; el resto se recalcula por regla.
        const estadoReq = payload.Id_EstdoCliente !== undefined ? Number(payload.Id_EstdoCliente) : null;
        const estadoFinal = (estadoReq === ids.inactivo || esInactivo)
          ? ids.inactivo
          : (dniValido ? ids.activo : ids.potencial);

        payload.Id_EstdoCliente = estadoFinal;
        // Mantener compatibilidad con OK_KO: inactivo->0; resto->1
        payload.OK_KO = (estadoFinal === ids.inactivo) ? 0 : 1;
      }
      
      // Por defecto, si no hay país, usar España
      if (!payload.Id_Pais) {
        const espana = await this.getPaisByCodigoISO('ES');
        if (espana) {
          payload.Id_Pais = espana.id;
          payload.CodPais = espana.Id_pais;
          payload.Pais = espana.Nombre_pais;
        }
      }
      
      // Obtener provincias y países para validación
      const provincias = await this.getProvincias();
      const paises = await this.getPaises();
      
      // Si se actualiza Id_Pais, actualizar también CodPais y Pais (legacy)
      if (payload.Id_Pais !== undefined) {
        try {
          const pais = await this.getPaisById(payload.Id_Pais);
          if (pais) {
            // Normalizar nombre del país antes de guardarlo en campos legacy
            const { normalizeTitleCaseES } = require('../utils/normalize-utf8');
            payload.CodPais = pais.Id_pais;
            payload.Pais = normalizeTitleCaseES(pais.Nombre_pais || '');
          }
        } catch (error) {
          console.warn('⚠️  No se pudo obtener país por ID:', error.message);
        }
      }
      
      // Si hay código postal, validar correspondencia con provincia y país
      if (payload.CodigoPostal && (payload.Id_Provincia || payload.Id_Pais)) {
        try {
          const { validarCodigoPostalProvinciaPais } = require('../scripts/validar-codigo-postal-provincia-pais');
          const validacion = validarCodigoPostalProvinciaPais(payload.CodigoPostal, payload.Id_Provincia, payload.Id_Pais, provincias, paises);
          
          if (!validacion.valido) {
            throw new Error(validacion.error);
          }
        } catch (error) {
          throw new Error(`Error de validación: ${error.message}`);
        }
      }
      
      // Si hay CodigoPostal y no hay Id_Provincia, intentar asociarla
      if (payload.CodigoPostal && !payload.Id_Provincia) {
        try {
          const { obtenerProvinciaPorCodigoPostal } = require('../scripts/asociar-provincia-por-codigo-postal');
          if (provincias && provincias.length > 0) {
            const provinciaId = obtenerProvinciaPorCodigoPostal(payload.CodigoPostal, provincias);
            if (provinciaId) {
              payload.Id_Provincia = provinciaId;
              // Actualizar Pais si no está definido
              const provincia = provincias.find(p => p.id === provinciaId);
              if (provincia && !payload.Id_Pais && !payload.Pais) {
                // Buscar país por código de país de la provincia
                const pais = await this.getPaisByCodigoISO(provincia.CodigoPais);
                if (pais) {
                  payload.Id_Pais = pais.id;
                  payload.Pais = pais.Nombre_pais;
                  payload.CodPais = pais.Id_pais;
                } else {
                  payload.Pais = provincia.Pais;
                  payload.CodPais = provincia.CodigoPais;
                }
              }
            }
          }
        } catch (error) {
          // Si falla la asociación, continuar sin ella
          console.warn('⚠️  No se pudo asociar provincia por código postal:', error.message);
        }
      }
      
      const fields = Object.keys(payload).map(key => `\`${key}\``).join(', ');
      const placeholders = Object.keys(payload).map(() => '?').join(', ');
      const values = Object.values(payload);
      
      // Asegurar conexión
      if (!this.connected && !this.pool) {
        await this.connect();
      }

      const tClientes = await this._resolveTableNameCaseInsensitive('clientes');
      const sql = `INSERT INTO \`${tClientes}\` (${fields}) VALUES (${placeholders})`;
      // Para INSERT, necesitamos el ResultSetHeader que contiene insertId
      const [result] = await this.pool.execute(sql, values);
      const insertId = result.insertId;
      
      if (!insertId) {
        console.error('❌ No se pudo obtener insertId del resultado:', result);
        throw new Error('No se pudo obtener el ID del cliente creado');
      }
      
      console.log(`✅ Cliente creado con ID: ${insertId}`);
      return { 
        insertId: insertId,
        Id: insertId,
        id: insertId
      };
    } catch (error) {
      console.error('❌ Error creando cliente:', error.message);
      throw error;
    }
  }

  async toggleClienteOkKo(id, value) {
    try {
      let okKoValue = 1; // Por defecto activo (1)
      
      // Si viene como toggle (sin valor específico), alternar el estado actual
      if (value === undefined || value === null || value === 'toggle') {
        // Obtener estado actual
        const current = await this.query('SELECT `OK_KO` FROM clientes WHERE id = ?', [id]);
        if (current && current.length > 0) {
          const currentValue = current[0]['OK_KO'];
          
          // Convertir valor actual a booleano
          let esActivo = false;
          if (typeof currentValue === 'string') {
            esActivo = (currentValue.toUpperCase().trim() === 'OK');
          } else if (typeof currentValue === 'number') {
            esActivo = (currentValue === 1);
          } else if (typeof currentValue === 'boolean') {
            esActivo = currentValue;
          }
          
          // Alternar: si está activo (1), cambiar a inactivo (0), y viceversa
          okKoValue = esActivo ? 0 : 1;
        }
      } else {
        // Convertir valor a 1 (Activo) o 0 (Inactivo)
        // value puede ser: 'OK'/'KO', 'Activo'/'Inactivo', true/false, 1/0
        if (typeof value === 'string') {
          const valUpper = value.toUpperCase().trim();
          okKoValue = (valUpper === 'OK' || valUpper === 'ACTIVO' || valUpper === 'TRUE' || valUpper === '1') ? 1 : 0;
        } else if (typeof value === 'boolean') {
          okKoValue = value ? 1 : 0;
        } else if (typeof value === 'number') {
          okKoValue = (value === 0 || value === 1) ? value : 1;
        }
      }
      
      // Actualizar solo OK_KO con valor booleano (1 o 0)
      const meta = await this._ensureClientesMeta().catch(() => null);
      const colEstadoCliente = meta?.colEstadoCliente || null;
      let estadoFinal = null;
      let estadoNombre = null;
      if (colEstadoCliente) {
        const ids = await this._getEstadoClienteIds().catch(() => ({ potencial: 1, activo: 2, inactivo: 3 }));
        // Necesitamos DNI_CIF para decidir Activo vs Potencial cuando se activa
        const cur = await this.query('SELECT DNI_CIF FROM clientes WHERE id = ? LIMIT 1', [id]).catch(() => []);
        const dni = cur && cur.length ? cur[0].DNI_CIF : null;
        const dniValido = this._isValidDniCif(dni);
        estadoFinal = (okKoValue === 0) ? ids.inactivo : (dniValido ? ids.activo : ids.potencial);
        const sql = `UPDATE clientes SET \`OK_KO\` = ?, \`${colEstadoCliente}\` = ? WHERE id = ?`;
        await this.query(sql, [okKoValue, estadoFinal, id]);
        estadoNombre =
          estadoFinal === ids.inactivo ? 'Inactivo'
          : (estadoFinal === ids.activo ? 'Activo' : 'Potencial');
      } else {
        const sql = 'UPDATE clientes SET `OK_KO` = ? WHERE id = ?';
        await this.query(sql, [okKoValue, id]);
      }
      console.log(`✅ [TOGGLE OK_KO] Cliente ${id} actualizado: OK_KO = ${okKoValue} (${okKoValue === 1 ? 'Activo' : 'Inactivo'})`);
      if (colEstadoCliente) {
        return { affectedRows: 1, OK_KO: okKoValue, Id_EstdoCliente: estadoFinal, EstadoClienteNombre: estadoNombre };
      }
      return { affectedRows: 1, OK_KO: okKoValue };
    } catch (error) {
      console.error('❌ Error actualizando estado de cliente:', error.message);
      throw error;
    }
  }

  // COOPERATIVAS
  async getCooperativas() {
    try {
      // En algunos entornos (MariaDB/Linux) la PK puede ser `id` en lugar de `Id`.
      try {
        const rows = await this.query('SELECT * FROM cooperativas ORDER BY Id ASC');
        return rows;
      } catch (e1) {
        const rows = await this.query('SELECT * FROM cooperativas ORDER BY id ASC');
        return rows;
      }
    } catch (error) {
      console.error('❌ Error obteniendo cooperativas:', error.message);
      return [];
    }
  }

  async getCooperativaById(id) {
    try {
      try {
        const rows = await this.query('SELECT * FROM cooperativas WHERE Id = ? LIMIT 1', [id]);
        return rows.length > 0 ? rows[0] : null;
      } catch (e1) {
        const rows = await this.query('SELECT * FROM cooperativas WHERE id = ? LIMIT 1', [id]);
        return rows.length > 0 ? rows[0] : null;
      }
    } catch (error) {
      console.error('❌ Error obteniendo cooperativa por ID:', error.message);
      return null;
    }
  }

  async getClientesCooperativa() {
    try {
      // Primero verificar qué tablas existen y cuántos registros hay
      try {
        const countQuery1 = await this.query('SELECT COUNT(*) as total FROM `Clientes_Cooperativas`');
        console.log(`📊 [GET ALL] Total registros en Clientes_Cooperativas: ${countQuery1[0]?.total || 0}`);
      } catch (e) {
        console.log('⚠️ [GET ALL] No se pudo contar Clientes_Cooperativas:', e.message);
      }
      
      try {
        const countQuery2 = await this.query('SELECT COUNT(*) as total FROM clientes_cooperativas');
        console.log(`📊 [GET ALL] Total registros en clientes_cooperativas: ${countQuery2[0]?.total || 0}`);
      } catch (e) {
        console.log('⚠️ [GET ALL] No se pudo contar clientes_cooperativas:', e.message);
      }
      
      // Intentar con diferentes nombres de tabla
      let sql = `
        SELECT 
          cc.id,
          cc.Id_Cliente,
          cc.Id_Cooperativa,
          cc.NumAsociado,
          c.Nombre_Razon_Social as ClienteNombre,
          co.Nombre as CooperativaNombre
        FROM \`Clientes_Cooperativas\` cc
        LEFT JOIN clientes c ON cc.Id_Cliente = c.id
        LEFT JOIN cooperativas co ON cc.Id_Cooperativa = co.id
        ORDER BY cc.id DESC
      `;
      let rows;
      
      try {
        rows = await this.query(sql);
        console.log(`✅ [GET ALL] Relaciones obtenidas con tabla Clientes_Cooperativas: ${rows.length}`);
        if (rows.length > 0) {
          console.log(`📋 [GET ALL] Primer registro:`, JSON.stringify(rows[0], null, 2));
        }
        return rows;
      } catch (error1) {
        console.log('⚠️ [GET ALL] Error con Clientes_Cooperativas, intentando clientes_cooperativas:', error1.message);
        // Intentar con minúsculas
        sql = `
          SELECT 
            cc.id,
            cc.Id_Cliente,
            cc.Id_Cooperativa,
            cc.NumAsociado,
            c.Nombre_Razon_Social as ClienteNombre,
            co.Nombre as CooperativaNombre
          FROM clientes_cooperativas cc
          LEFT JOIN clientes c ON cc.Id_Cliente = c.id
          LEFT JOIN cooperativas co ON cc.Id_Cooperativa = co.id
          ORDER BY cc.id DESC
        `;
        try {
          rows = await this.query(sql);
          console.log(`✅ [GET ALL] Relaciones obtenidas con tabla clientes_cooperativas: ${rows.length}`);
          if (rows.length > 0) {
            console.log(`📋 [GET ALL] Primer registro:`, JSON.stringify(rows[0], null, 2));
          }
          return rows;
        } catch (error2) {
          console.error('❌ [GET ALL] Error con ambas variantes de nombre de tabla');
          console.error('❌ Error 1:', error1.message);
          console.error('❌ Error 2:', error2.message);
          
          // Intentar consulta simple sin JOINs para verificar si la tabla existe
          try {
            const simpleQuery = await this.query('SELECT * FROM `Clientes_Cooperativas` LIMIT 5');
            console.log(`✅ [GET ALL] Consulta simple exitosa, registros: ${simpleQuery.length}`);
            // Si funciona sin JOINs, hacer el JOIN manualmente
            if (simpleQuery.length > 0) {
              const rowsWithNames = await Promise.all(simpleQuery.map(async (row) => {
                const cliente = await this.getClienteById(row.Id_Cliente).catch(() => null);
                const cooperativa = await this.getCooperativaById(row.Id_Cooperativa).catch(() => null);
                return {
                  ...row,
                  ClienteNombre: cliente ? (cliente.Nombre || cliente.nombre) : null,
                  CooperativaNombre: cooperativa ? (cooperativa.Nombre || cooperativa.nombre) : null
                };
              }));
              return rowsWithNames;
            }
          } catch (e) {
            console.error('❌ [GET ALL] Error en consulta simple:', e.message);
          }
          
          throw error2;
        }
      }
    } catch (error) {
      console.error('❌ Error obteniendo clientes_cooperativas:', error.message);
      console.error('❌ Stack:', error.stack);
      return [];
    }
  }

  async getClienteCooperativaById(id) {
    try {
      console.log(`🔍 [GET BY ID] Buscando relación con ID: ${id}`);
      
      // Primero intentar consulta simple sin JOINs para verificar que existe
      let sqlSimple = 'SELECT * FROM `Clientes_Cooperativas` WHERE id = ? LIMIT 1';
      let rowSimple;
      
      try {
        const rowsSimple = await this.query(sqlSimple, [id]);
        if (rowsSimple.length > 0) {
          rowSimple = rowsSimple[0];
          console.log(`✅ [GET BY ID] Relación encontrada con tabla Clientes_Cooperativas (sin JOINs)`);
        }
      } catch (error1) {
        console.log('⚠️ [GET BY ID] Error con Clientes_Cooperativas, intentando clientes_cooperativas:', error1.message);
        try {
          sqlSimple = 'SELECT * FROM clientes_cooperativas WHERE id = ? LIMIT 1';
          const rowsSimple2 = await this.query(sqlSimple, [id]);
          if (rowsSimple2.length > 0) {
            rowSimple = rowsSimple2[0];
            console.log(`✅ [GET BY ID] Relación encontrada con tabla clientes_cooperativas (sin JOINs)`);
          }
        } catch (error2) {
          console.error('❌ [GET BY ID] Error con ambas tablas en consulta simple:', error2.message);
        }
      }
      
      if (!rowSimple) {
        console.log(`⚠️ [GET BY ID] Relación con ID ${id} no encontrada en ninguna tabla`);
        return null;
      }
      
      // Si encontramos el registro, intentar obtener los nombres con JOINs
      let sql = `
        SELECT 
          cc.*,
          c.Nombre_Razon_Social as ClienteNombre,
          co.Nombre as CooperativaNombre
        FROM \`Clientes_Cooperativas\` cc
        LEFT JOIN clientes c ON cc.Id_Cliente = c.id
        LEFT JOIN cooperativas co ON cc.Id_Cooperativa = co.id
        WHERE cc.id = ? LIMIT 1
      `;
      let rows;
      
      try {
        rows = await this.query(sql, [id]);
        if (rows.length > 0) {
          console.log(`✅ [GET BY ID] Relación encontrada con JOINs (Clientes_Cooperativas)`);
          return rows[0];
        }
      } catch (error3) {
        console.log('⚠️ [GET BY ID] Error con JOINs en Clientes_Cooperativas, intentando clientes_cooperativas:', error3.message);
      }
      
      // Intentar con minúsculas y JOINs
      sql = `
        SELECT 
          cc.*,
          c.Nombre_Razon_Social as ClienteNombre,
          co.Nombre as CooperativaNombre
        FROM clientes_cooperativas cc
        LEFT JOIN clientes c ON cc.Id_Cliente = c.id
        LEFT JOIN cooperativas co ON cc.Id_Cooperativa = co.id
        WHERE cc.id = ? LIMIT 1
      `;
      try {
        rows = await this.query(sql, [id]);
        if (rows.length > 0) {
          console.log(`✅ [GET BY ID] Relación encontrada con JOINs (clientes_cooperativas)`);
          return rows[0];
        }
      } catch (error4) {
        console.log('⚠️ [GET BY ID] Error con JOINs, devolviendo datos sin nombres:', error4.message);
      }
      
      // Si los JOINs fallan, devolver los datos básicos sin nombres
      console.log(`✅ [GET BY ID] Devolviendo relación sin nombres de cliente/cooperativa`);
      return {
        ...rowSimple,
        ClienteNombre: null,
        CooperativaNombre: null
      };
    } catch (error) {
      console.error('❌ Error obteniendo cliente_cooperativa por ID:', error.message);
      console.error('❌ ID buscado:', id);
      console.error('❌ Stack:', error.stack);
      return null;
    }
  }

  // Obtener las cooperativas de un cliente específico
  async getCooperativasByClienteId(clienteId) {
    try {
      // Intentar con diferentes nombres de tabla
      let sql = `
        SELECT c.Nombre, cc.NumAsociado 
        FROM \`Clientes_Cooperativas\` cc
        INNER JOIN cooperativas c ON cc.Id_Cooperativa = c.id
        WHERE cc.Id_Cliente = ?
        ORDER BY c.Nombre ASC
      `;
      let rows;
      
      try {
        rows = await this.query(sql, [clienteId]);
        console.log(`✅ [GET COOP BY CLIENTE] Cooperativas obtenidas para cliente ${clienteId} con tabla Clientes_Cooperativas: ${rows.length}`);
        return rows;
      } catch (error1) {
        console.log('⚠️ [GET COOP BY CLIENTE] Error con Clientes_Cooperativas, intentando clientes_cooperativas:', error1.message);
        // Intentar con minúsculas
        sql = `
          SELECT c.Nombre, cc.NumAsociado 
          FROM clientes_cooperativas cc
          INNER JOIN cooperativas c ON cc.Id_Cooperativa = c.id
          WHERE cc.Id_Cliente = ?
          ORDER BY c.Nombre ASC
        `;
        try {
          rows = await this.query(sql, [clienteId]);
          console.log(`✅ [GET COOP BY CLIENTE] Cooperativas obtenidas para cliente ${clienteId} con tabla clientes_cooperativas: ${rows.length}`);
          return rows;
        } catch (error2) {
          console.error('❌ [GET COOP BY CLIENTE] Error con ambas variantes de nombre de tabla');
          console.error('❌ Error 1:', error1.message);
          console.error('❌ Error 2:', error2.message);
          return [];
        }
      }
    } catch (error) {
      console.error('❌ Error obteniendo cooperativas del cliente:', error.message);
      console.error('❌ Stack:', error.stack);
      return [];
    }
  }

  // ============================================================
  // GRUPOS DE COMPRAS (CRUD + relación con clientes)
  // ============================================================

  async getGruposCompras() {
    try {
      const t = await this._resolveTableNameCaseInsensitive('gruposCompras');
      const rows = await this.query(`SELECT * FROM \`${t}\` ORDER BY id ASC`).catch(async () => {
        // fallback por si la PK está como Id en algún entorno
        return await this.query(`SELECT * FROM \`${t}\` ORDER BY Id ASC`);
      });
      return rows || [];
    } catch (error) {
      console.error('❌ Error obteniendo gruposCompras:', error.message);
      return [];
    }
  }

  async getGrupoComprasById(id) {
    try {
      const t = await this._resolveTableNameCaseInsensitive('gruposCompras');
      try {
        const rows = await this.query(`SELECT * FROM \`${t}\` WHERE id = ? LIMIT 1`, [id]);
        return rows?.[0] || null;
      } catch (_) {
        const rows = await this.query(`SELECT * FROM \`${t}\` WHERE Id = ? LIMIT 1`, [id]);
        return rows?.[0] || null;
      }
    } catch (error) {
      console.error('❌ Error obteniendo grupoCompras por ID:', error.message);
      return null;
    }
  }

  async createGrupoCompras(payload) {
    try {
      const t = await this._resolveTableNameCaseInsensitive('gruposCompras');
      const fields = Object.keys(payload).map(k => `\`${k}\``).join(', ');
      const placeholders = Object.keys(payload).map(() => '?').join(', ');
      const values = Object.values(payload);
      const sql = `INSERT INTO \`${t}\` (${fields}) VALUES (${placeholders})`;
      const result = await this.query(sql, values);
      return { insertId: result.insertId || result.insertId };
    } catch (error) {
      console.error('❌ Error creando grupoCompras:', error.message);
      throw error;
    }
  }

  async updateGrupoCompras(id, payload) {
    try {
      const t = await this._resolveTableNameCaseInsensitive('gruposCompras');
      const fields = Object.keys(payload).map(k => `\`${k}\` = ?`).join(', ');
      const values = Object.values(payload);
      values.push(id);
      const sql = `UPDATE \`${t}\` SET ${fields} WHERE id = ?`;
      try {
        await this.query(sql, values);
      } catch (_) {
        const sql2 = `UPDATE \`${t}\` SET ${fields} WHERE Id = ?`;
        await this.query(sql2, values);
      }
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando grupoCompras:', error.message);
      throw error;
    }
  }

  async deleteGrupoCompras(id) {
    try {
      const t = await this._resolveTableNameCaseInsensitive('gruposCompras');
      try {
        await this.query(`DELETE FROM \`${t}\` WHERE id = ?`, [id]);
      } catch (_) {
        await this.query(`DELETE FROM \`${t}\` WHERE Id = ?`, [id]);
      }
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error eliminando grupoCompras:', error.message);
      throw error;
    }
  }

  async getClientesGruposCompras() {
    try {
      const tRel = await this._resolveTableNameCaseInsensitive('clientes_gruposCompras');
      const tGr = await this._resolveTableNameCaseInsensitive('gruposCompras');
      const tClientes = await this._resolveTableNameCaseInsensitive('clientes');
      const sql = `
        SELECT
          cg.id,
          cg.Id_Cliente,
          cg.Id_GrupoCompras,
          cg.NumSocio,
          cg.Observaciones,
          cg.Activa,
          cg.Fecha_Alta,
          cg.Fecha_Baja,
          c.Nombre_Razon_Social as ClienteNombre,
          g.Nombre as GrupoNombre
        FROM \`${tRel}\` cg
        LEFT JOIN \`${tClientes}\` c ON cg.Id_Cliente = c.id
        LEFT JOIN \`${tGr}\` g ON cg.Id_GrupoCompras = g.id
        ORDER BY cg.id DESC
      `;
      const rows = await this.query(sql);
      return rows || [];
    } catch (error) {
      console.error('❌ Error obteniendo clientes_gruposCompras:', error.message);
      return [];
    }
  }

  async getClienteGrupoComprasById(id) {
    try {
      const tRel = await this._resolveTableNameCaseInsensitive('clientes_gruposCompras');
      const tGr = await this._resolveTableNameCaseInsensitive('gruposCompras');
      const tClientes = await this._resolveTableNameCaseInsensitive('clientes');
      const sql = `
        SELECT
          cg.*,
          c.Nombre_Razon_Social as ClienteNombre,
          g.Nombre as GrupoNombre
        FROM \`${tRel}\` cg
        LEFT JOIN \`${tClientes}\` c ON cg.Id_Cliente = c.id
        LEFT JOIN \`${tGr}\` g ON cg.Id_GrupoCompras = g.id
        WHERE cg.id = ? LIMIT 1
      `;
      const rows = await this.query(sql, [id]);
      return rows?.[0] || null;
    } catch (error) {
      console.error('❌ Error obteniendo cliente_grupoCompras por ID:', error.message);
      return null;
    }
  }

  async getGrupoComprasActivoByClienteId(clienteId) {
    try {
      const tRel = await this._resolveTableNameCaseInsensitive('clientes_gruposCompras');
      const tGr = await this._resolveTableNameCaseInsensitive('gruposCompras');
      const sql = `
        SELECT cg.*, g.Nombre as GrupoNombre
        FROM \`${tRel}\` cg
        LEFT JOIN \`${tGr}\` g ON cg.Id_GrupoCompras = g.id
        WHERE cg.Id_Cliente = ? AND cg.Activa = 1
        ORDER BY cg.id DESC
        LIMIT 1
      `;
      const rows = await this.query(sql, [clienteId]);
      return rows?.[0] || null;
    } catch (error) {
      console.error('❌ Error obteniendo grupoCompras activo del cliente:', error.message);
      return null;
    }
  }

  async createClienteGrupoCompras(payload) {
    // payload: { Id_Cliente, Id_GrupoCompras, NumSocio?, Observaciones? }
    if (!this.pool) await this.connect();
    const connection = await this.pool.getConnection();
    try {
      // Asegurar zona horaria en esta sesión de transacción
      try {
        await connection.query("SET time_zone = 'Europe/Madrid'");
      } catch (_) {}
      await connection.beginTransaction();

      const tRel = await this._resolveTableNameCaseInsensitive('clientes_gruposCompras');

      // Desactivar relación activa previa (si existe) para este cliente
      await connection.execute(
        `UPDATE \`${tRel}\` SET Activa = 0, Fecha_Baja = NOW() WHERE Id_Cliente = ? AND Activa = 1`,
        [payload.Id_Cliente]
      );

      const insertPayload = {
        Id_Cliente: payload.Id_Cliente,
        Id_GrupoCompras: payload.Id_GrupoCompras,
        NumSocio: payload.NumSocio || null,
        Observaciones: payload.Observaciones || null,
        Activa: 1
      };

      const fields = Object.keys(insertPayload).map(k => `\`${k}\``).join(', ');
      const placeholders = Object.keys(insertPayload).map(() => '?').join(', ');
      const values = Object.values(insertPayload);

      const [result] = await connection.execute(
        `INSERT INTO \`${tRel}\` (${fields}) VALUES (${placeholders})`,
        values
      );

      await connection.commit();
      return { insertId: result.insertId };
    } catch (error) {
      try { await connection.rollback(); } catch (_) {}
      console.error('❌ Error creando cliente_grupoCompras:', error.message);
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateClienteGrupoCompras(id, payload) {
    try {
      const tRel = await this._resolveTableNameCaseInsensitive('clientes_gruposCompras');
      const fields = Object.keys(payload).map(k => `\`${k}\` = ?`).join(', ');
      const values = Object.values(payload);
      values.push(id);
      const sql = `UPDATE \`${tRel}\` SET ${fields} WHERE id = ?`;
      await this.query(sql, values);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando cliente_grupoCompras:', error.message);
      throw error;
    }
  }

  async cerrarClienteGrupoCompras(id) {
    try {
      const tRel = await this._resolveTableNameCaseInsensitive('clientes_gruposCompras');
      await this.query(`UPDATE \`${tRel}\` SET Activa = 0, Fecha_Baja = NOW() WHERE id = ?`, [id]);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error cerrando cliente_grupoCompras:', error.message);
      throw error;
    }
  }

  async findCooperativaByNombre(nombre) {
    try {
      const sql = 'SELECT * FROM cooperativas WHERE Nombre = ? OR nombre = ? LIMIT 1';
      const rows = await this.query(sql, [nombre, nombre]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error buscando cooperativa por nombre:', error.message);
      return null;
    }
  }

  async createCooperativa(nombre, extra = {}) {
    try {
      const payload = { Nombre: nombre, ...extra };
      const fields = Object.keys(payload).map(key => `\`${key}\``).join(', ');
      const placeholders = Object.keys(payload).map(() => '?').join(', ');
      const values = Object.values(payload);
      
      const sql = `INSERT INTO cooperativas (${fields}) VALUES (${placeholders})`;
      const result = await this.query(sql, values);
      return { insertId: result.insertId || result.insertId };
    } catch (error) {
      console.error('❌ Error creando cooperativa:', error.message);
      throw error;
    }
  }

  async updateCooperativa(id, payload) {
    try {
      const fields = Object.keys(payload).map(key => `\`${key}\` = ?`).join(', ');
      const values = Object.values(payload);
      values.push(id);
      
      try {
        const sql = `UPDATE cooperativas SET ${fields} WHERE Id = ?`;
        await this.query(sql, values);
      } catch (e1) {
        const sql = `UPDATE cooperativas SET ${fields} WHERE id = ?`;
        await this.query(sql, values);
      }
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando cooperativa:', error.message);
      throw error;
    }
  }

  async deleteCooperativa(id) {
    try {
      try {
        await this.query('DELETE FROM cooperativas WHERE Id = ?', [id]);
      } catch (e1) {
        await this.query('DELETE FROM cooperativas WHERE id = ?', [id]);
      }
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error eliminando cooperativa:', error.message);
      throw error;
    }
  }

  // FORMAS_PAGO
  async getFormasPago() {
    try {
      const table = await this._getFormasPagoTableName();
      if (!table) {
        console.warn('⚠️ [FORMAS-PAGO] La tabla de formas de pago no existe (formas_pago/Formas_Pago).');
        return [];
      }

      let rows = [];
      try {
        rows = await this.query(`SELECT * FROM ${table} ORDER BY id ASC`);
      } catch (e1) {
        // Algunas instalaciones pueden usar Id en vez de id
        rows = await this.query(`SELECT * FROM ${table} ORDER BY Id ASC`).catch(() => []);
      }
      // Normalizar etiqueta para vistas (cliente-editar usa "Nombre" en algunos sitios)
      return (rows || []).map(r => ({
        ...r,
        id: r?.id ?? r?.Id ?? r?.ID ?? null,
        Nombre: r?.Nombre ?? r?.FormaPago ?? r?.formaPago ?? r?.nombre ?? null
      }));
    } catch (error) {
      console.error('❌ Error obteniendo formas de pago:', error.message);
      return [];
    }
  }

  async getFormaPagoById(id) {
    try {
      const table = await this._getFormasPagoTableName();
      if (!table) return null;
      let rows;
      try {
        rows = await this.query(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [id]);
      } catch (e1) {
        rows = await this.query(`SELECT * FROM ${table} WHERE Id = ? LIMIT 1`, [id]);
      }
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo forma de pago por ID:', error.message);
      return null;
    }
  }

  async getFormaPagoByNombre(nombre) {
    try {
      const table = await this._getFormasPagoTableName();
      if (!table) return null;
      const sql = `SELECT * FROM ${table} WHERE FormaPago = ? OR FormaPago LIKE ? LIMIT 1`;
      const nombreExacto = nombre.trim();
      const nombreLike = `%${nombreExacto}%`;
      const rows = await this.query(sql, [nombreExacto, nombreLike]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo forma de pago por nombre:', error.message);
      return null;
    }
  }

  async createFormaPago(payload) {
    try {
      const table = await this._getFormasPagoTableName();
      if (!table) throw new Error('La tabla de formas de pago no existe (formas_pago/Formas_Pago).');
      const fields = Object.keys(payload).map(key => `\`${key}\``).join(', ');
      const placeholders = Object.keys(payload).map(() => '?').join(', ');
      const values = Object.values(payload);
      
      const sql = `INSERT INTO ${table} (${fields}) VALUES (${placeholders})`;
      const result = await this.query(sql, values);
      return { insertId: result.insertId || result.insertId };
    } catch (error) {
      console.error('❌ Error creando forma de pago:', error.message);
      throw error;
    }
  }

  async updateFormaPago(id, payload) {
    try {
      const table = await this._getFormasPagoTableName();
      if (!table) throw new Error('La tabla de formas de pago no existe (formas_pago/Formas_Pago).');
      const fields = Object.keys(payload).map(key => `\`${key}\` = ?`).join(', ');
      const values = Object.values(payload);
      values.push(id);
      
      try {
        const sql = `UPDATE ${table} SET ${fields} WHERE id = ?`;
        await this.query(sql, values);
      } catch (e1) {
        const sql = `UPDATE ${table} SET ${fields} WHERE Id = ?`;
        await this.query(sql, values);
      }
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando forma de pago:', error.message);
      throw error;
    }
  }

  async deleteFormaPago(id) {
    try {
      const table = await this._getFormasPagoTableName();
      if (!table) throw new Error('La tabla de formas de pago no existe (formas_pago/Formas_Pago).');
      try {
        await this.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
      } catch (e1) {
        await this.query(`DELETE FROM ${table} WHERE Id = ?`, [id]);
      }
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error eliminando forma de pago:', error.message);
      throw error;
    }
  }

  // ESPECIALIDADES
  async getEspecialidades() {
    try {
      const sql = 'SELECT * FROM especialidades ORDER BY id ASC';
      const rows = await this.query(sql);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo especialidades:', error.message);
      return [];
    }
  }

  async getEspecialidadById(id) {
    try {
      const sql = 'SELECT * FROM especialidades WHERE id = ? LIMIT 1';
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo especialidad por ID:', error.message);
      return null;
    }
  }

  async createEspecialidad(payload) {
    try {
      const fields = Object.keys(payload).map(key => `\`${key}\``).join(', ');
      const placeholders = Object.keys(payload).map(() => '?').join(', ');
      const values = Object.values(payload);
      
      const sql = `INSERT INTO especialidades (${fields}) VALUES (${placeholders})`;
      const result = await this.query(sql, values);
      return { insertId: result.insertId || result.insertId };
    } catch (error) {
      console.error('❌ Error creando especialidad:', error.message);
      throw error;
    }
  }

  async updateEspecialidad(id, payload) {
    try {
      const fields = Object.keys(payload).map(key => `\`${key}\` = ?`).join(', ');
      const values = Object.values(payload);
      values.push(id);
      
      const sql = `UPDATE especialidades SET ${fields} WHERE id = ?`;
      await this.query(sql, values);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando especialidad:', error.message);
      throw error;
    }
  }

  async deleteEspecialidad(id) {
    try {
      const sql = 'DELETE FROM especialidades WHERE id = ?';
      await this.query(sql, [id]);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error eliminando especialidad:', error.message);
      throw error;
    }
  }

  // PROVINCIAS
  async getProvincias(filtroPais = null) {
    try {
      let sql = 'SELECT * FROM provincias';
      const params = [];
      
      if (filtroPais) {
        sql += ' WHERE CodigoPais = ?';
        params.push(filtroPais);
      }
      
      sql += ' ORDER BY Nombre ASC';
      const rows = await this.query(sql, params);
      // Normalizar texto para evitar mojibake en vistas (tildes/ñ)
      try {
        const { normalizeUTF8, normalizeTitleCaseES } = require('../utils/normalize-utf8');
        return (rows || []).map(r => ({
          ...r,
          // Provincias: TitleCase + utf8
          Nombre: normalizeTitleCaseES(r.Nombre || ''),
          Pais: normalizeTitleCaseES(r.Pais || '')
        }));
      } catch (_) {
        // fallback: devolver tal cual
      }
      console.log(`✅ [PROVINCIAS] Obtenidas ${rows.length} provincias${filtroPais ? ' de ' + filtroPais : ''}`);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo provincias:', error.message);
      return [];
    }
  }

  async getProvinciaById(id) {
    try {
      const sql = 'SELECT * FROM provincias WHERE id = ? LIMIT 1';
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo provincia por ID:', error.message);
      return null;
    }
  }

  async getProvinciaByCodigo(codigo) {
    try {
      const sql = 'SELECT * FROM provincias WHERE Codigo = ? LIMIT 1';
      const rows = await this.query(sql, [codigo]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo provincia por código:', error.message);
      return null;
    }
  }

  // PAÍSES
  async getPaises() {
    try {
      const sql = 'SELECT * FROM paises ORDER BY Nombre_pais ASC';
      const rows = await this.query(sql);
      try {
        const { normalizeTitleCaseES } = require('../utils/normalize-utf8');
        return (rows || []).map(r => ({
          ...r,
          Nombre_pais: normalizeTitleCaseES(r.Nombre_pais || '')
        }));
      } catch (_) {
        return rows;
      }
    } catch (error) {
      console.error('❌ Error obteniendo países:', error.message);
      return [];
    }
  }

  async getPaisById(id) {
    try {
      const sql = 'SELECT * FROM paises WHERE id = ? LIMIT 1';
      const rows = await this.query(sql, [id]);
      const row = rows.length > 0 ? rows[0] : null;
      if (!row) return null;
      try {
        const { normalizeTitleCaseES } = require('../utils/normalize-utf8');
        return { ...row, Nombre_pais: normalizeTitleCaseES(row.Nombre_pais || '') };
      } catch (_) {
        return row;
      }
    } catch (error) {
      console.error('❌ Error obteniendo país por ID:', error.message);
      return null;
    }
  }

  async getPaisByCodigoISO(codigoISO) {
    try {
      const sql = 'SELECT * FROM paises WHERE Id_pais = ? LIMIT 1';
      const rows = await this.query(sql, [codigoISO]);
      const row = rows.length > 0 ? rows[0] : null;
      if (!row) return null;
      try {
        const { normalizeTitleCaseES } = require('../utils/normalize-utf8');
        return { ...row, Nombre_pais: normalizeTitleCaseES(row.Nombre_pais || '') };
      } catch (_) {
        return row;
      }
    } catch (error) {
      console.error('❌ Error obteniendo país por código ISO:', error.message);
      return null;
    }
  }

  async checkNumeroAsociadoDuplicado(cooperativaId, numeroAsociado, excludeId = null) {
    try {
      if (!numeroAsociado || numeroAsociado.trim() === '') {
        return false; // Si no hay número de asociado, no hay duplicado
      }
      
      let sql = 'SELECT id FROM `Clientes_Cooperativas` WHERE Id_Cooperativa = ? AND NumAsociado = ?';
      let params = [cooperativaId, numeroAsociado.trim()];
      
      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }
      
      sql += ' LIMIT 1';
      
      let rows;
      try {
        rows = await this.query(sql, params);
      } catch (error1) {
        // Intentar con minúsculas
        sql = 'SELECT id FROM clientes_cooperativas WHERE Id_Cooperativa = ? AND NumAsociado = ?';
        params = [cooperativaId, numeroAsociado.trim()];
        if (excludeId) {
          sql += ' AND id != ?';
          params.push(excludeId);
        }
        sql += ' LIMIT 1';
        rows = await this.query(sql, params);
      }
      
      return rows.length > 0;
    } catch (error) {
      console.error('❌ Error verificando número de asociado duplicado:', error.message);
      return false; // En caso de error, permitir la operación
    }
  }

  async createClienteCooperativa(payload) {
    try {
      if (!this.connected && !this.pool) {
        await this.connect();
      }
      
      // Validar número de asociado duplicado en la misma cooperativa
      if (payload.NumAsociado && payload.NumAsociado.trim() !== '') {
        const existeDuplicado = await this.checkNumeroAsociadoDuplicado(
          payload.Id_Cooperativa, 
          payload.NumAsociado
        );
        
        if (existeDuplicado) {
          const cooperativa = await this.getCooperativaById(payload.Id_Cooperativa);
          const nombreCooperativa = cooperativa ? (cooperativa.Nombre || cooperativa.nombre) : `Cooperativa #${payload.Id_Cooperativa}`;
          throw new Error(`El número de asociado "${payload.NumAsociado}" ya existe en la cooperativa "${nombreCooperativa}". Cada cooperativa debe tener números de asociado únicos.`);
        }
      }
      
      const fields = Object.keys(payload).map(key => `\`${key}\``).join(', ');
      const placeholders = Object.keys(payload).map(() => '?').join(', ');
      const values = Object.values(payload);
      
      // Intentar con diferentes nombres de tabla
      let sql = `INSERT INTO \`Clientes_Cooperativas\` (${fields}) VALUES (${placeholders})`;
      let result;
      let insertId;
      
      try {
        // Usar pool.execute directamente para obtener el ResultSetHeader con insertId
        [result] = await this.pool.execute(sql, values);
        insertId = result.insertId;
        console.log(`✅ [CREATE] Relación creada con tabla Clientes_Cooperativas, ID: ${insertId}`);
      } catch (error1) {
        console.log('⚠️ [CREATE] Error con Clientes_Cooperativas, intentando clientes_cooperativas:', error1.message);
        // Intentar con minúsculas
        sql = `INSERT INTO clientes_cooperativas (${fields}) VALUES (${placeholders})`;
        try {
          [result] = await this.pool.execute(sql, values);
          insertId = result.insertId;
          console.log(`✅ [CREATE] Relación creada con tabla clientes_cooperativas, ID: ${insertId}`);
        } catch (error2) {
          console.error('❌ [CREATE] Error con ambas variantes de nombre de tabla');
          throw error2;
        }
      }
      
      if (!insertId) {
        console.error('❌ No se pudo obtener insertId del resultado:', result);
        throw new Error('No se pudo obtener el ID de la relación creada');
      }
      
      console.log(`✅ Relación cliente-cooperativa creada con ID: ${insertId}`);
      return { insertId: insertId, Id: insertId, id: insertId };
    } catch (error) {
      console.error('❌ Error creando cliente_cooperativa:', error.message);
      console.error('❌ Stack:', error.stack);
      throw error;
    }
  }

  async updateClienteCooperativa(id, payload) {
    try {
      // Validar número de asociado duplicado en la misma cooperativa (excluyendo el registro actual)
      if (payload.NumAsociado && payload.NumAsociado.trim() !== '') {
        const cooperativaId = payload.Id_Cooperativa;
        if (cooperativaId) {
          const existeDuplicado = await this.checkNumeroAsociadoDuplicado(
            cooperativaId, 
            payload.NumAsociado,
            id // Excluir el registro actual
          );
          
          if (existeDuplicado) {
            const cooperativa = await this.getCooperativaById(cooperativaId);
            const nombreCooperativa = cooperativa ? (cooperativa.Nombre || cooperativa.nombre) : `Cooperativa #${cooperativaId}`;
            throw new Error(`El número de asociado "${payload.NumAsociado}" ya existe en la cooperativa "${nombreCooperativa}". Cada cooperativa debe tener números de asociado únicos.`);
          }
        }
      }
      
      const fields = [];
      const values = [];
      
      for (const [key, value] of Object.entries(payload)) {
        fields.push(`\`${key}\` = ?`);
        values.push(value);
      }
      
      values.push(id);
      
      let sql = `UPDATE \`Clientes_Cooperativas\` SET ${fields.join(', ')} WHERE id = ?`;
      try {
        await this.query(sql, values);
      } catch (error1) {
        // Intentar con minúsculas
        sql = `UPDATE clientes_cooperativas SET ${fields.join(', ')} WHERE id = ?`;
        await this.query(sql, values);
      }
      
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando cliente_cooperativa:', error.message);
      throw error;
    }
  }

  async deleteClienteCooperativa(id) {
    try {
      const sql = 'DELETE FROM `Clientes_Cooperativas` WHERE id = ?';
      await this.query(sql, [id]);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error eliminando cliente_cooperativa:', error.message);
      throw error;
    }
  }

  async upsertClienteCooperativa({ clienteId, cooperativaNombre, numeroAsociado }) {
    try {
      // Buscar cooperativa por nombre
      let cooperativa = await this.findCooperativaByNombre(cooperativaNombre);
      
      if (!cooperativa) {
        // Crear cooperativa si no existe
        const result = await this.createCooperativa(cooperativaNombre);
        cooperativa = { id: result.insertId };
      }

      // Buscar si ya existe la relación (usar Id_Cliente e Id_Cooperativa)
      const sqlCheck = 'SELECT * FROM `Clientes_Cooperativas` WHERE Id_Cliente = ? AND Id_Cooperativa = ? LIMIT 1';
      const cooperativaId = cooperativa.id || cooperativa.Id;
      const existing = await this.query(sqlCheck, [clienteId, cooperativaId]);
      
      if (existing.length > 0) {
        // Actualizar
        return await this.updateClienteCooperativa(existing[0].id, { NumAsociado: numeroAsociado });
      } else {
        // Crear
        return await this.createClienteCooperativa({
          Id_Cliente: clienteId,
          Id_Cooperativa: cooperativaId,
          NumAsociado: numeroAsociado
        });
      }
    } catch (error) {
      console.error('❌ Error en upsert cliente_cooperativa:', error.message);
      throw error;
    }
  }

  // PEDIDOS
  async getNextNumeroPedido() {
    try {
      // Obtener el año actual (últimos 2 dígitos)
      const year = new Date().getFullYear().toString().slice(-2);
      const yearPrefix = `P${year}`;
      
      // Buscar todos los pedidos del año actual (que empiecen con P25, P26, etc.)
      // Extraer solo los últimos 4 dígitos (la secuencia) de cada número de pedido
      const sql = `
        SELECT 
          NumPedido,
          CAST(SUBSTRING(NumPedido, 4) AS UNSIGNED) as secuencia
        FROM pedidos 
        WHERE NumPedido LIKE ?
        ORDER BY secuencia DESC
        LIMIT 1
      `;
      
      const rows = await this.query(sql, [`${yearPrefix}%`]);
      
      let maxSecuencia = 0;
      if (rows.length > 0 && rows[0].secuencia) {
        maxSecuencia = parseInt(rows[0].secuencia, 10) || 0;
      }
      
      // Generar el siguiente número: P25 + 4 dígitos (0001, 0002, etc.)
      const nextSecuencia = (maxSecuencia + 1).toString().padStart(4, '0');
      const nextNumero = `${yearPrefix}${nextSecuencia}`;
      
      console.log(`📝 [NUMERO PEDIDO] Año: ${year}, Máxima secuencia encontrada: ${maxSecuencia}, Siguiente: ${nextNumero}`);
      
      return nextNumero;
    } catch (error) {
      console.error('❌ Error obteniendo siguiente número de pedido:', error.message);
      const year = new Date().getFullYear().toString().slice(-2);
      return `P${year}0001`;
    }
  }

  async getPedidos(comercialId = null) {
    try {
      let sql = 'SELECT * FROM pedidos';
      const params = [];
      
      // Si se proporciona un comercialId, filtrar por él
      // El campo en la tabla pedidos es Id_Cial (con mayúsculas, según la estructura SQL)
      if (comercialId) {
        sql += ' WHERE Id_Cial = ?';
        params.push(comercialId);
        console.log(`🔐 [GET_PEDIDOS] Filtro aplicado: Id_Cial = ${comercialId}`);
      }
      
      sql += ' ORDER BY Id DESC';
      
      const rows = await this.query(sql, params);
      console.log(`📊 [GET PEDIDOS] Total pedidos obtenidos: ${rows ? rows.length : 0}${comercialId ? ` (filtrado por comercial ${comercialId})` : ''}`);
      if (rows && rows.length > 0) {
        console.log(`📋 [GET PEDIDOS] Primer pedido (muestra):`, {
          Id: rows[0].Id || rows[0].id,
          NumPedido: rows[0].NumPedido || rows[0].Numero_Pedido || rows[0].numero,
          FechaPedido: rows[0].FechaPedido || rows[0]['Fecha Pedido'] || rows[0].fecha,
          Cliente_id: rows[0].Cliente_id || rows[0].Id_Cliente,
          Id_Cial: rows[0].Id_Cial || rows[0].id_cial,
          todasLasClaves: Object.keys(rows[0])
        });
      }
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo pedidos:', error.message);
      console.error('❌ Stack:', error.stack);
      return [];
    }
  }

  async getPedidosByComercial(comercialId) {
    try {
      // Usar Id_Cial que es el campo correcto en la tabla pedidos
      const sql = 'SELECT * FROM pedidos WHERE Id_Cial = ? OR id_cial = ? OR Comercial_id = ? OR comercial_id = ? ORDER BY Id DESC';
      const rows = await this.query(sql, [comercialId, comercialId, comercialId, comercialId]);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo pedidos por comercial:', error.message);
      return [];
    }
  }

  async getPedidosByCliente(clienteId) {
    try {
      const sql = 'SELECT * FROM pedidos WHERE ClienteId = ? OR clienteId = ? ORDER BY Id DESC';
      const rows = await this.query(sql, [clienteId, clienteId]);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo pedidos por cliente:', error.message);
      return [];
    }
  }

  async getPedidoById(id) {
    try {
      // En algunas instalaciones la PK se referencia como Id (mayúscula) aunque se use "id" en el código.
      // Además, a veces se intenta acceder por NumPedido (P25xxxx). Hacemos lookup robusto.
      const raw = id;
      const asNum = Number(raw);
      const isNum = Number.isFinite(asNum) && asNum > 0;
      const asStr = String(raw || '').trim();

      // 1) Buscar por ID numérico (Id/id)
      if (isNum) {
        const sql = 'SELECT * FROM pedidos WHERE Id = ? OR id = ? LIMIT 1';
        const rows = await this.query(sql, [asNum, asNum]);
        if (rows && rows.length > 0) return rows[0];
      }

      // 1.1) Fallback (cuando el parámetro es un número "humano" de pedido):
      // Ejemplo: /pedidos/7 puede referirse a NumPedido = P250007 (no al ID interno).
      // Probamos con prefijos de los últimos años (PYY0007).
      if (isNum) {
        const sec = String(asNum).padStart(4, '0');
        const nowYear = new Date().getFullYear();
        const yearsToTry = [0, 1, 2, 3, 4, 5].map(d => nowYear - d);
        for (const y of yearsToTry) {
          const yy = String(y).slice(-2);
          const numPedido = `P${yy}${sec}`;
          const rowsByNum = await this.query(
            'SELECT * FROM pedidos WHERE NumPedido = ? OR Numero_Pedido = ? OR `Número_Pedido` = ? OR `Número Pedido` = ? LIMIT 1',
            [numPedido, numPedido, numPedido, numPedido]
          );
          if (rowsByNum && rowsByNum.length > 0) return rowsByNum[0];
        }
      }

      // 2) Fallback: buscar por NumPedido si el parámetro parece un número de pedido
      if (asStr) {
        const sqlNumPedido = `
          SELECT * FROM pedidos
          WHERE NumPedido = ?
             OR Numero_Pedido = ?
             OR \`Número_Pedido\` = ?
             OR \`Número Pedido\` = ?
          LIMIT 1
        `;
        const rowsNum = await this.query(sqlNumPedido, [asStr, asStr, asStr, asStr]);
        if (rowsNum && rowsNum.length > 0) return rowsNum[0];
      }

      return null;
    } catch (error) {
      console.error('❌ Error obteniendo pedido por ID:', error.message);
      console.error('❌ ID usado:', id);
      return null;
    }
  }

  async getPedidosArticulos() {
    try {
      const sql = 'SELECT * FROM pedidos_articulos ORDER BY Id ASC';
      const rows = await this.query(sql);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo pedidos_articulos:', error.message);
      return [];
    }
  }

  async getArticulosByPedido(pedidoId) {
    try {
      // Primero obtener el número de pedido desde el ID
      const pedido = await this.query('SELECT NumPedido FROM pedidos WHERE Id = ? OR id = ? LIMIT 1', [pedidoId, pedidoId]);
      if (!pedido || pedido.length === 0) {
        return [];
      }
      const numPedido = pedido[0].NumPedido;
      
      // La tabla pedidos_articulos usa NumPedido (varchar) y Id_Articulo (int)
      const sql = 'SELECT pa.*, a.* FROM pedidos_articulos pa LEFT JOIN articulos a ON pa.Id_Articulo = a.Id WHERE pa.NumPedido = ? ORDER BY pa.id ASC';
      const rows = await this.query(sql, [numPedido]);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo artículos por pedido:', error.message);
      return [];
    }
  }

  async updatePedido(id, payload) {
    try {
      const fields = [];
      const values = [];
      
      for (const [key, value] of Object.entries(payload)) {
        fields.push(`\`${key}\` = ?`);
        values.push(value);
      }
      
      values.push(id);
      // Usar 'id' (minúscula) en lugar de 'Id' (mayúscula) según la estructura de la base de datos
      const sql = `UPDATE pedidos SET ${fields.join(', ')} WHERE id = ?`;
      await this.query(sql, values);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando pedido:', error.message);
      throw error;
    }
  }

  async deletePedidoLinea(id) {
    try {
      const sql = 'DELETE FROM pedidos_articulos WHERE Id = ?';
      const result = await this.query(sql, [id]);
      return { affectedRows: result.affectedRows || 0 };
    } catch (error) {
      console.error('❌ Error eliminando línea de pedido:', error.message);
      throw error;
    }
  }

  async deletePedido(id) {
    try {
      // Primero eliminar las líneas
      await this.query('DELETE FROM pedidos_articulos WHERE PedidoId = ?', [id]);
      // Luego el pedido
      const result = await this.query('DELETE FROM pedidos WHERE Id = ?', [id]);
      return { affectedRows: result.affectedRows || 0 };
    } catch (error) {
      console.error('❌ Error eliminando pedido:', error.message);
      throw error;
    }
  }

  async togglePedidoActivo(id, value) {
    try {
      const sql = 'UPDATE pedidos SET Activo = ? WHERE Id = ?';
      await this.query(sql, [value ? 1 : 0, id]);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando estado de pedido:', error.message);
      throw error;
    }
  }

  async createPedido(pedidoData) {
    try {
      // Asegurar conexión
      if (!this.connected && !this.pool) {
        await this.connect();
      }

      // Convertir formato NocoDB a MySQL
      const mysqlData = {};
      for (const [key, value] of Object.entries(pedidoData)) {
        // Si el valor es un array con formato NocoDB [{ Id: ... }], extraer el ID
        if (Array.isArray(value) && value.length > 0 && value[0].Id) {
          mysqlData[key] = value[0].Id;
        } else if (value === null || value === undefined || value === '') {
          // No agregar campos con valores null/undefined/vacíos para evitar errores de "no default value"
          // Solo agregar si el campo existe y tiene un valor válido
          continue;
        } else {
          mysqlData[key] = value;
        }
      }

      const buildInsert = (dataObj) => {
        const fields = Object.keys(dataObj).map(key => `\`${key}\``).join(', ');
        const placeholders = Object.keys(dataObj).map(() => '?').join(', ');
        const values = Object.values(dataObj);
        const sql = `INSERT INTO pedidos (${fields}) VALUES (${placeholders})`;
        return { sql, values, fields };
      };

      let insert = buildInsert(mysqlData);
      console.log('🔍 [CREATE PEDIDO] SQL:', insert.sql);
      console.log('🔍 [CREATE PEDIDO] Values:', insert.values);
      console.log('🔍 [CREATE PEDIDO] Fields count:', insert.fields.split(',').length, 'Values count:', insert.values.length);

      // Usar pool.execute directamente para obtener el ResultSetHeader con insertId
      let result;
      try {
        [result] = await this.pool.execute(insert.sql, insert.values);
      } catch (err) {
        // Compatibilidad: si la BD aún no tiene la columna Id_Tarifa, reintentar sin ella
        const msg = String(err?.sqlMessage || err?.message || '');
        const isUnknownColumn = err?.code === 'ER_BAD_FIELD_ERROR' && /Unknown column/i.test(msg) && /Id_Tarifa/i.test(msg);
        if (isUnknownColumn && Object.prototype.hasOwnProperty.call(mysqlData, 'Id_Tarifa')) {
          console.warn('⚠️ [CREATE PEDIDO] La BD no tiene Id_Tarifa. Reintentando INSERT sin Id_Tarifa...');
          delete mysqlData.Id_Tarifa;
          insert = buildInsert(mysqlData);
          [result] = await this.pool.execute(insert.sql, insert.values);
        } else {
          throw err;
        }
      }
      const insertId = result.insertId;
      
      if (!insertId) {
        console.error('❌ [CREATE PEDIDO] No se pudo obtener insertId del resultado:', result);
        console.error('❌ [CREATE PEDIDO] Result completo:', JSON.stringify(result, null, 2));
        throw new Error('No se pudo obtener el ID del pedido creado');
      }
      
      console.log(`✅ [CREATE PEDIDO] Pedido creado con ID: ${insertId}`);
      return { Id: insertId, id: insertId, insertId: insertId };
    } catch (error) {
      console.error('❌ [CREATE PEDIDO] Error creando pedido:', error.message);
      console.error('❌ [CREATE PEDIDO] Error code:', error.code);
      console.error('❌ [CREATE PEDIDO] SQL State:', error.sqlState);
      console.error('❌ [CREATE PEDIDO] Stack:', error.stack);
      console.error('❌ [CREATE PEDIDO] Datos que fallaron:', JSON.stringify(pedidoData, null, 2));
      throw error;
    }
  }

  async createPedidoLinea(payload) {
    try {
      // Asegurar conexión
      if (!this.connected && !this.pool) {
        await this.connect();
      }

      // Convertir formato NocoDB a MySQL
      const mysqlData = {};
      for (const [key, value] of Object.entries(payload)) {
        // Si el valor es un array con formato NocoDB [{ Id: ... }], extraer el ID
        if (Array.isArray(value) && value.length > 0 && value[0].Id) {
          mysqlData[key] = value[0].Id;
        } else if (value === null || value === undefined) {
          mysqlData[key] = null;
        } else {
          mysqlData[key] = value;
        }
      }

      const fields = Object.keys(mysqlData).map(key => `\`${key}\``).join(', ');
      const placeholders = Object.keys(mysqlData).map(() => '?').join(', ');
      const values = Object.values(mysqlData);
      
      const sql = `INSERT INTO pedidos_articulos (${fields}) VALUES (${placeholders})`;
      // Usar pool.execute directamente para obtener el ResultSetHeader con insertId
      const [result] = await this.pool.execute(sql, values);
      const insertId = result.insertId;
      
      if (!insertId) {
        console.error('❌ No se pudo obtener insertId del resultado:', result);
        throw new Error('No se pudo obtener el ID de la línea de pedido creada');
      }
      
      console.log(`✅ Línea de pedido creada con ID: ${insertId}`);
      return { Id: insertId, id: insertId, insertId: insertId };
    } catch (error) {
      console.error('❌ Error creando línea de pedido:', error.message);
      console.error('❌ Datos que fallaron:', JSON.stringify(payload, null, 2));
      throw error;
    }
  }

  async linkPedidoLineas(pedidoId, lineasIds) {
    try {
      // Actualizar todas las líneas para que apunten al pedido
      if (!lineasIds || lineasIds.length === 0) {
        console.warn('⚠️ No hay líneas para vincular');
        return { affectedRows: 0 };
      }
      // Verificar que todas las líneas tengan el Id_NumPedido correcto (usando 'id' como nombre de columna PK)
      const placeholders = lineasIds.map(() => '?').join(',');
      const sql = `UPDATE pedidos_articulos SET Id_NumPedido = ? WHERE id IN (${placeholders}) AND (Id_NumPedido IS NULL OR Id_NumPedido != ?)`;
      const result = await this.query(sql, [pedidoId, ...lineasIds, pedidoId]);
      console.log(`✅ ${result.affectedRows || 0} líneas verificadas/actualizadas para el pedido ${pedidoId}`);
      return { affectedRows: result.affectedRows || 0 };
    } catch (error) {
      console.error('❌ Error vinculando líneas de pedido:', error.message);
      throw error;
    }
  }

  // CONTACTOS (persona global) + relación M:N con clientes (historial)
  async getContactos(options = {}) {
    try {
      const search = String(options.search || '').trim();
      const includeInactivos = Boolean(options.includeInactivos);
      // IMPORTANTE (compatibilidad MySQL/MariaDB):
      // Algunos servidores fallan con "Incorrect arguments to mysqld_stmt_execute"
      // cuando LIMIT/OFFSET van como parámetros preparados. Por eso los insertamos
      // como números saneados en el SQL (evita placeholders en LIMIT/OFFSET).
      const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Math.min(500, Number(options.limit))) : 50;
      const offset = Number.isFinite(Number(options.offset)) ? Math.max(0, Number(options.offset)) : 0;

      const where = [];
      const params = [];

      if (!includeInactivos) {
        // Compatibilidad: Activo puede venir como 1/0 o como strings ('OK'/'KO', 'SI'/'NO', etc.).
        // Forzamos a string para evitar conversiones numéricas extrañas en MySQL estricto.
        where.push("TRIM(UPPER(COALESCE(CONCAT(Activo,''),''))) IN ('1','OK','TRUE','SI','SÍ')");
      }

      if (search) {
        // Intentar FULLTEXT (rápido) y hacer fallback a LIKE si no existe el índice.
        // Boolean mode con wildcard por palabra (paco lara -> "paco* lara*").
        const terms = search
          .split(/\s+/)
          .map(t => t.trim())
          .filter(Boolean)
          .map(t => `${t.replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ._@+-]/g, '')}*`)
          .filter(t => t !== '*')
          .join(' ');

        if (terms && terms.replace(/\*/g, '').length >= 3) {
          where.push('(MATCH(Nombre, Apellidos, Empresa, Email, Movil, Telefono) AGAINST (? IN BOOLEAN MODE))');
          params.push(terms);
        } else {
          where.push('(Nombre LIKE ? OR Apellidos LIKE ? OR Empresa LIKE ? OR Email LIKE ? OR Movil LIKE ? OR Telefono LIKE ?)');
          const like = `%${search}%`;
          params.push(like, like, like, like, like, like);
        }
      }

      const tContactos = await this._resolveTableNameCaseInsensitive('contactos');
      let sql = `SELECT * FROM \`${tContactos}\``;
      if (where.length) sql += ' WHERE ' + where.join(' AND ');
      sql += ' ORDER BY Apellidos ASC, Nombre ASC';
      sql += ` LIMIT ${limit} OFFSET ${offset}`;

      try {
        return await this.query(sql, params);
      } catch (e) {
        // Fallback si FULLTEXT no está disponible en este entorno
        const msg = String(e?.message || '');
        if (search && msg.toLowerCase().includes('match') && msg.toLowerCase().includes('against')) {
          const where2 = where.filter(w => !w.includes('MATCH('));
          const params2 = params.slice(0, params.length - 1); // quitar terms
          where2.push('(Nombre LIKE ? OR Apellidos LIKE ? OR Empresa LIKE ? OR Email LIKE ? OR Movil LIKE ? OR Telefono LIKE ?)');
          const like = `%${search}%`;
          params2.push(like, like, like, like, like, like);
          let sql2 = `SELECT * FROM \`${tContactos}\``;
          if (where2.length) sql2 += ' WHERE ' + where2.join(' AND ');
          sql2 += ' ORDER BY Apellidos ASC, Nombre ASC';
          sql2 += ` LIMIT ${limit} OFFSET ${offset}`;
          return await this.query(sql2, params2);
        }
        throw e;
      }
    } catch (error) {
      console.error('❌ Error obteniendo contactos:', error.message);
      // Importante: no ocultar el error, para que el dashboard pueda mostrar un mensaje claro
      throw error;
    }
  }

  async getContactoById(id) {
    try {
      const tContactos = await this._resolveTableNameCaseInsensitive('contactos');
      const rows = await this.query(`SELECT * FROM \`${tContactos}\` WHERE Id = ? LIMIT 1`, [id]);
      return rows?.[0] || null;
    } catch (error) {
      console.error('❌ Error obteniendo contacto por ID:', error.message);
      return null;
    }
  }

  async createContacto(payload) {
    try {
      // Asegurar conexión
      if (!this.connected && !this.pool) {
        await this.connect();
      }

      const allowed = new Set([
        'Nombre',
        'Apellidos',
        'Cargo',
        'Especialidad',
        'Empresa',
        'Email',
        'Movil',
        'Telefono',
        'Extension',
        'Notas',
        'Activo'
      ]);

      const data = {};
      for (const [k, v] of Object.entries(payload || {})) {
        if (!allowed.has(k)) continue;
        data[k] = (v === undefined ? null : v);
      }

      if (!data.Nombre || String(data.Nombre).trim() === '') {
        throw new Error('El campo Nombre es obligatorio');
      }

      const fields = Object.keys(data).map(k => `\`${k}\``).join(', ');
      const placeholders = Object.keys(data).map(() => '?').join(', ');
      const values = Object.values(data);

      const tContactos = await this._resolveTableNameCaseInsensitive('contactos');
      const sql = `INSERT INTO \`${tContactos}\` (${fields}) VALUES (${placeholders})`;
      const result = await this.query(sql, values);
      return { insertId: result.insertId };
    } catch (error) {
      console.error('❌ Error creando contacto:', error.message);
      throw error;
    }
  }

  async updateContacto(id, payload) {
    try {
      // Asegurar conexión
      if (!this.connected && !this.pool) {
        await this.connect();
      }

      const allowed = new Set([
        'Nombre',
        'Apellidos',
        'Cargo',
        'Especialidad',
        'Empresa',
        'Email',
        'Movil',
        'Telefono',
        'Extension',
        'Notas',
        'Activo'
      ]);

      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(payload || {})) {
        if (!allowed.has(k)) continue;
        fields.push(`\`${k}\` = ?`);
        values.push(v === undefined ? null : v);
      }

      if (!fields.length) return { affectedRows: 0 };

      values.push(id);
      const tContactos = await this._resolveTableNameCaseInsensitive('contactos');
      const sql = `UPDATE \`${tContactos}\` SET ${fields.join(', ')} WHERE Id = ?`;
      const result = await this.query(sql, values);
      return { affectedRows: result.affectedRows || 0 };
    } catch (error) {
      console.error('❌ Error actualizando contacto:', error.message);
      throw error;
    }
  }

  async getContactosByCliente(clienteId, options = {}) {
    try {
      const includeHistorico = Boolean(options.includeHistorico);
      const params = [clienteId];

      const tClientesContactos = await this._resolveTableNameCaseInsensitive('clientes_contactos');
      const tContactos = await this._resolveTableNameCaseInsensitive('contactos');
      let sql = `
        SELECT
          cc.Id AS Id_Relacion,
          cc.Id_Cliente,
          cc.Id_Contacto,
          cc.Rol,
          cc.Es_Principal,
          cc.Notas AS NotasRelacion,
          cc.VigenteDesde,
          cc.VigenteHasta,
          cc.MotivoBaja,
          c.*
        FROM \`${tClientesContactos}\` cc
        INNER JOIN \`${tContactos}\` c ON c.Id = cc.Id_Contacto
        WHERE cc.Id_Cliente = ?
      `;

      if (!includeHistorico) {
        sql += ' AND cc.VigenteHasta IS NULL';
      }

      sql += ' ORDER BY (cc.VigenteHasta IS NULL) DESC, cc.Es_Principal DESC, c.Apellidos ASC, c.Nombre ASC, cc.Id DESC';

      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo contactos por cliente:', error.message);
      throw error;
    }
  }

  async vincularContactoACliente(clienteId, contactoId, options = {}) {
    // Crea o actualiza la relación activa (histórico: no reabre filas antiguas, crea nueva si no existe activa).
    // Si Es_Principal=1, desmarca otros principales activos del cliente en la misma transacción.
    const rol = options.Rol ?? options.rol ?? null;
    const notas = options.Notas ?? options.notas ?? null;
    const esPrincipal = (options.Es_Principal ?? options.es_principal ?? options.esPrincipal) ? 1 : 0;

    if (!this.pool) await this.connect();
    const tClientesContactos = await this._resolveTableNameCaseInsensitive('clientes_contactos');
    const conn = await this.pool.getConnection();

    try {
      // Asegurar zona horaria en esta sesión de transacción
      try {
        await conn.query("SET time_zone = 'Europe/Madrid'");
      } catch (_) {}
      await conn.beginTransaction();

      if (esPrincipal) {
        await conn.execute(
          `UPDATE \`${tClientesContactos}\` SET Es_Principal = 0 WHERE Id_Cliente = ? AND VigenteHasta IS NULL`,
          [clienteId]
        );
      }

      // ¿ya existe relación activa?
      const [rows] = await conn.execute(
        `SELECT Id FROM \`${tClientesContactos}\` WHERE Id_Cliente = ? AND Id_Contacto = ? AND VigenteHasta IS NULL ORDER BY Id DESC LIMIT 1`,
        [clienteId, contactoId]
      );

      if (rows && rows.length > 0) {
        const relId = rows[0].Id;
        await conn.execute(
          `UPDATE \`${tClientesContactos}\` SET Rol = ?, Notas = ?, Es_Principal = ? WHERE Id = ?`,
          [rol, notas, esPrincipal, relId]
        );
        await conn.commit();
        return { action: 'updated', Id_Relacion: relId };
      }

      // Crear nueva relación activa (histórico intacto)
      const [ins] = await conn.execute(
        `INSERT INTO \`${tClientesContactos}\` (Id_Cliente, Id_Contacto, Rol, Es_Principal, Notas) VALUES (?, ?, ?, ?, ?)`,
        [clienteId, contactoId, rol, esPrincipal, notas]
      );

      await conn.commit();
      return { action: 'inserted', Id_Relacion: ins.insertId };
    } catch (error) {
      try { await conn.rollback(); } catch (_) {}
      console.error('❌ Error vinculando contacto a cliente:', error.message);
      throw error;
    } finally {
      conn.release();
    }
  }

  async cerrarVinculoContactoCliente(clienteId, contactoId, options = {}) {
    try {
      const motivo = options.MotivoBaja ?? options.motivoBaja ?? options.motivo ?? null;
      if (!this.connected && !this.pool) {
        await this.connect();
      }
      const tClientesContactos = await this._resolveTableNameCaseInsensitive('clientes_contactos');
      const sql = `
        UPDATE \`${tClientesContactos}\`
        SET VigenteHasta = NOW(), MotivoBaja = ?, Es_Principal = 0
        WHERE Id_Cliente = ? AND Id_Contacto = ? AND VigenteHasta IS NULL
        ORDER BY Id DESC
        LIMIT 1
      `;
      const result = await this.query(sql, [motivo, clienteId, contactoId]);
      return { affectedRows: result.affectedRows || 0 };
    } catch (error) {
      console.error('❌ Error cerrando vínculo contacto-cliente:', error.message);
      throw error;
    }
  }

  // =====================================================
  // DIRECCIONES DE ENVÍO
  // =====================================================
  async getDireccionesEnvioByCliente(clienteId, options = {}) {
    try {
      const includeInactivas = Boolean(options.includeInactivas);
      const tDirecciones = await this._resolveTableNameCaseInsensitive('direccionesEnvio');
      const tContactos = await this._resolveTableNameCaseInsensitive('contactos');

      let sql = `
        SELECT
          d.*,
          c.Nombre AS Contacto_Nombre,
          c.Apellidos AS Contacto_Apellidos,
          c.Email AS Contacto_Email,
          c.Movil AS Contacto_Movil
        FROM \`${tDirecciones}\` d
        LEFT JOIN \`${tContactos}\` c ON c.Id = d.Id_Contacto
        WHERE d.Id_Cliente = ?
      `;
      const params = [clienteId];

      if (!includeInactivas) {
        sql += ' AND d.Activa = 1';
      }

      sql += ' ORDER BY d.Activa DESC, d.Es_Principal DESC, d.id DESC';

      return await this.query(sql, params);
    } catch (error) {
      // Si la tabla no existe aún, no romper flujos: devolver vacío.
      const msg = String(error?.sqlMessage || error?.message || '');
      if (error?.code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(msg)) {
        return [];
      }
      console.error('❌ Error obteniendo direcciones de envío por cliente:', error.message);
      throw error;
    }
  }

  async getDireccionEnvioById(id) {
    try {
      const tDirecciones = await this._resolveTableNameCaseInsensitive('direccionesEnvio');
      const rows = await this.query(`SELECT * FROM \`${tDirecciones}\` WHERE id = ? LIMIT 1`, [id]);
      return rows && rows.length > 0 ? rows[0] : null;
    } catch (error) {
      const msg = String(error?.sqlMessage || error?.message || '');
      if (error?.code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(msg)) return null;
      console.error('❌ Error obteniendo dirección de envío por ID:', error.message);
      throw error;
    }
  }

  async createDireccionEnvio(payload) {
    try {
      if (!this.connected && !this.pool) await this.connect();

      const allowed = new Set([
        'Id_Cliente',
        'Id_Contacto',
        'Alias',
        'Nombre_Destinatario',
        'Direccion',
        'Direccion2',
        'Poblacion',
        'CodigoPostal',
        'Id_Provincia',
        'Id_CodigoPostal',
        'Id_Pais',
        'Pais',
        'Telefono',
        'Movil',
        'Email',
        'Observaciones',
        'Es_Principal',
        'Activa'
      ]);

      const data = {};
      for (const [k, v] of Object.entries(payload || {})) {
        if (!allowed.has(k)) continue;
        data[k] = v === undefined ? null : v;
      }

      if (!data.Id_Cliente) throw new Error('Id_Cliente es obligatorio');

      const tDirecciones = await this._resolveTableNameCaseInsensitive('direccionesEnvio');

      // Si se marca como principal activa, desmarcar otras antes para evitar UNIQUE.
      const esPrincipal = Number(data.Es_Principal) === 1;
      const activa = (data.Activa === undefined || data.Activa === null) ? true : (Number(data.Activa) === 1);

      // Transacción para consistencia
      if (!this.pool) await this.connect();
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();

        if (esPrincipal && activa) {
          await conn.execute(
            `UPDATE \`${tDirecciones}\` SET Es_Principal = 0 WHERE Id_Cliente = ? AND Activa = 1`,
            [Number(data.Id_Cliente)]
          );
        }

        const fields = Object.keys(data).map(k => `\`${k}\``).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);
        const sql = `INSERT INTO \`${tDirecciones}\` (${fields}) VALUES (${placeholders})`;
        const [result] = await conn.execute(sql, values);

        await conn.commit();
        return { insertId: result.insertId };
      } catch (e) {
        try { await conn.rollback(); } catch (_) {}
        throw e;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('❌ Error creando dirección de envío:', error.message);
      throw error;
    }
  }

  async updateDireccionEnvio(id, payload) {
    try {
      if (!this.connected && !this.pool) {
        await this.connect();
      }

      const allowed = new Set([
        'Id_Contacto',
        'Alias',
        'Nombre_Destinatario',
        'Direccion',
        'Direccion2',
        'Poblacion',
        'CodigoPostal',
        'Id_Provincia',
        'Id_CodigoPostal',
        'Id_Pais',
        'Pais',
        'Telefono',
        'Movil',
        'Email',
        'Observaciones',
        'Es_Principal',
        'Activa'
      ]);

      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(payload || {})) {
        if (!allowed.has(k)) continue;
        fields.push(`\`${k}\` = ?`);
        values.push(v === undefined ? null : v);
      }
      if (!fields.length) return { affectedRows: 0 };

      const tDirecciones = await this._resolveTableNameCaseInsensitive('direccionesEnvio');

      // Si se pone como principal activa, desmarcar otras antes.
      const willSetPrincipal = Object.prototype.hasOwnProperty.call(payload || {}, 'Es_Principal') && Number(payload.Es_Principal) === 1;
      const willBeActive = !Object.prototype.hasOwnProperty.call(payload || {}, 'Activa') || Number(payload.Activa) === 1;

      if (!this.pool) await this.connect();
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();

        let clienteId = null;
        try {
          const [rows] = await conn.execute(`SELECT Id_Cliente FROM \`${tDirecciones}\` WHERE id = ? LIMIT 1`, [id]);
          clienteId = rows?.[0]?.Id_Cliente ?? null;
        } catch (_) {
          clienteId = null;
        }

        if (clienteId && willSetPrincipal && willBeActive) {
          await conn.execute(
            `UPDATE \`${tDirecciones}\` SET Es_Principal = 0 WHERE Id_Cliente = ? AND Activa = 1`,
            [Number(clienteId)]
          );
        }

        values.push(id);
        const sql = `UPDATE \`${tDirecciones}\` SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await conn.execute(sql, values);

        await conn.commit();
        return { affectedRows: result.affectedRows || 0 };
      } catch (e) {
        try { await conn.rollback(); } catch (_) {}
        throw e;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('❌ Error actualizando dirección de envío:', error.message);
      throw error;
    }
  }

  async desactivarDireccionEnvio(id) {
    try {
      if (!this.connected && !this.pool) {
        await this.connect();
      }
      const tDirecciones = await this._resolveTableNameCaseInsensitive('direccionesEnvio');
      const sql = `UPDATE \`${tDirecciones}\` SET Activa = 0, Es_Principal = 0 WHERE id = ?`;
      const result = await this.query(sql, [id]);
      return { affectedRows: result.affectedRows || 0 };
    } catch (error) {
      console.error('❌ Error desactivando dirección de envío:', error.message);
      throw error;
    }
  }

  async getClientesByContacto(contactoId, options = {}) {
    try {
      const includeHistorico = Boolean(options.includeHistorico);
      const params = [contactoId];
      const tClientesContactos = await this._resolveTableNameCaseInsensitive('clientes_contactos');
      const tClientes = await this._resolveTableNameCaseInsensitive('clientes');
      const { pk } = await this._ensureClientesMeta().catch(() => ({ pk: 'Id' }));

      let sql = `
        SELECT
          cc.Id AS Id_Relacion,
          cc.Id_Cliente,
          cc.Id_Contacto,
          cc.Rol,
          cc.Es_Principal,
          cc.Notas AS NotasRelacion,
          cc.VigenteDesde,
          cc.VigenteHasta,
          cc.MotivoBaja,
          c.*
        FROM \`${tClientesContactos}\` cc
        INNER JOIN \`${tClientes}\` c ON c.\`${pk}\` = cc.Id_Cliente
        WHERE cc.Id_Contacto = ?
      `;

      if (!includeHistorico) {
        sql += ' AND cc.VigenteHasta IS NULL';
      }

      sql += ' ORDER BY (cc.VigenteHasta IS NULL) DESC, cc.Es_Principal DESC, c.Id ASC, cc.Id DESC';
      return await this.query(sql, params);
    } catch (error) {
      console.error('❌ Error obteniendo clientes por contacto:', error.message);
      throw error;
    }
  }

  // VISITAS
  async getVisitas(comercialId = null) {
    try {
      let sql = 'SELECT * FROM visitas';
      const params = [];
      
      // Si se proporciona un comercialId, filtrar por él
      // Las visitas pueden usar diferentes nombres de campo
      if (comercialId) {
        sql += ' WHERE Id_Cial = ? OR id_cial = ? OR ComercialId = ? OR comercialId = ? OR Comercial_id = ? OR comercial_id = ?';
        params.push(comercialId, comercialId, comercialId, comercialId, comercialId, comercialId);
      }
      
      sql += ' ORDER BY Id DESC';
      
      const rows = await this.query(sql, params);
      console.log(`✅ Obtenidas ${rows.length} visitas${comercialId ? ` (filtrado por comercial ${comercialId})` : ''}`);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo visitas:', error.message);
      return [];
    }
  }

  async getVisitasByComercial(comercialId) {
    try {
      // Intentar con todos los posibles nombres de campo
      const sql = 'SELECT * FROM visitas WHERE Id_Cial = ? OR id_cial = ? OR ComercialId = ? OR comercialId = ? OR Comercial_id = ? OR comercial_id = ? ORDER BY Id DESC';
      const rows = await this.query(sql, [comercialId, comercialId, comercialId, comercialId, comercialId, comercialId]);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo visitas por comercial:', error.message);
      return [];
    }
  }

  async getVisitasByCliente(clienteId) {
    try {
      const sql = 'SELECT * FROM visitas WHERE ClienteId = ? OR clienteId = ? OR FarmaciaClienteId = ? OR farmaciaClienteId = ? ORDER BY Id DESC';
      const rows = await this.query(sql, [clienteId, clienteId, clienteId, clienteId]);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo visitas por cliente:', error.message);
      return [];
    }
  }

  async getVisitaById(id) {
    try {
      const sql = 'SELECT * FROM visitas WHERE Id = ? LIMIT 1';
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo visita por ID:', error.message);
      return null;
    }
  }

  async createVisita(visitaData) {
    try {
      const fields = Object.keys(visitaData).map(key => `\`${key}\``).join(', ');
      const placeholders = Object.keys(visitaData).map(() => '?').join(', ');
      const values = Object.values(visitaData);
      
      const sql = `INSERT INTO visitas (${fields}) VALUES (${placeholders})`;
      const result = await this.query(sql, values);
      return { insertId: result.insertId || result.insertId };
    } catch (error) {
      console.error('❌ Error creando visita:', error.message);
      throw error;
    }
  }

  async updateVisita(visitaId, visitaData) {
    try {
      const fields = [];
      const values = [];
      
      for (const [key, value] of Object.entries(visitaData)) {
        fields.push(`\`${key}\` = ?`);
        values.push(value);
      }
      
      values.push(visitaId);
      const sql = `UPDATE visitas SET ${fields.join(', ')} WHERE Id = ?`;
      await this.query(sql, values);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando visita:', error.message);
      throw error;
    }
  }

  async deleteVisita(id) {
    try {
      const sql = 'DELETE FROM visitas WHERE Id = ?';
      const result = await this.query(sql, [id]);
      return { affectedRows: result.affectedRows || 0 };
    } catch (error) {
      console.error('❌ Error eliminando visita:', error.message);
      throw error;
    }
  }

  // CENTROS DE SALUD
  async getCentrosSalud() {
    try {
      const sql = 'SELECT * FROM centros_salud ORDER BY Id ASC';
      const rows = await this.query(sql);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo centros de salud:', error.message);
      return [];
    }
  }

  async getCentroSaludById(id) {
    try {
      const sql = 'SELECT * FROM centros_salud WHERE Id = ? LIMIT 1';
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo centro de salud por ID:', error.message);
      return null;
    }
  }

  // MÉDICOS Y ENFERMERAS
  async getMedicosEnfermeras() {
    try {
      const sql = 'SELECT * FROM medicos_enfermeras ORDER BY Id ASC';
      const rows = await this.query(sql);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo médicos/enfermeras:', error.message);
      return [];
    }
  }

  async getMedicosEnfermerasByCentro(centroId) {
    try {
      const sql = 'SELECT * FROM medicos_enfermeras WHERE CentroSaludId = ? OR centroSaludId = ? ORDER BY Id ASC';
      const rows = await this.query(sql, [centroId, centroId]);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo médicos/enfermeras por centro:', error.message);
      return [];
    }
  }

  // ESTADÍSTICAS
  async getEstadisticasComercial(comercialId) {
    try {
      const stats = {
        totalClientes: 0,
        totalPedidos: 0,
        totalVisitas: 0,
        pedidosActivos: 0
      };

      const [clientes] = await this.pool.execute('SELECT COUNT(*) as count FROM clientes WHERE ComercialId = ? OR comercialId = ?', [comercialId, comercialId]);
      stats.totalClientes = clientes[0]?.count || 0;

      const [pedidos] = await this.pool.execute('SELECT COUNT(*) as count FROM pedidos WHERE ComercialId = ? OR comercialId = ?', [comercialId, comercialId]);
      stats.totalPedidos = pedidos[0]?.count || 0;

      const [visitas] = await this.pool.execute('SELECT COUNT(*) as count FROM visitas WHERE ComercialId = ? OR comercialId = ?', [comercialId, comercialId]);
      stats.totalVisitas = visitas[0]?.count || 0;

      const [activos] = await this.pool.execute('SELECT COUNT(*) as count FROM pedidos WHERE (ComercialId = ? OR comercialId = ?) AND Activo = 1', [comercialId, comercialId]);
      stats.pedidosActivos = activos[0]?.count || 0;

      return stats;
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error.message);
      return {
        totalClientes: 0,
        totalPedidos: 0,
        totalVisitas: 0,
        pedidosActivos: 0
      };
    }
  }

  // FORMAS_PAGO - MÉTODOS DUPLICADOS ELIMINADOS (los correctos están en las líneas 1125-1191)

  // ESPECIALIDADES
  async getEspecialidades() {
    try {
      const sql = 'SELECT * FROM especialidades ORDER BY Id ASC';
      const rows = await this.query(sql);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo especialidades:', error.message);
      return [];
    }
  }

  async getEspecialidadById(id) {
    try {
      const sql = 'SELECT * FROM especialidades WHERE Id = ? LIMIT 1';
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo especialidad por ID:', error.message);
      return null;
    }
  }

  async createEspecialidad(payload) {
    try {
      const fields = Object.keys(payload).map(key => `\`${key}\``).join(', ');
      const placeholders = Object.keys(payload).map(() => '?').join(', ');
      const values = Object.values(payload);
      
      const sql = `INSERT INTO especialidades (${fields}) VALUES (${placeholders})`;
      const result = await this.query(sql, values);
      return { insertId: result.insertId || result.insertId };
    } catch (error) {
      console.error('❌ Error creando especialidad:', error.message);
      throw error;
    }
  }

  async updateEspecialidad(id, payload) {
    try {
      const fields = Object.keys(payload).map(key => `\`${key}\` = ?`).join(', ');
      const values = Object.values(payload);
      values.push(id);
      
      const sql = `UPDATE especialidades SET ${fields} WHERE Id = ?`;
      await this.query(sql, values);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error actualizando especialidad:', error.message);
      throw error;
    }
  }

  async deleteEspecialidad(id) {
    try {
      const sql = 'DELETE FROM especialidades WHERE Id = ?';
      await this.query(sql, [id]);
      return { affectedRows: 1 };
    } catch (error) {
      console.error('❌ Error eliminando especialidad:', error.message);
      throw error;
    }
  }

  // Método genérico para compatibilidad (no usado en MySQL directo)
  async getTableData(tableName, options = {}) {
    try {
      const sql = `SELECT * FROM \`${tableName}\` ORDER BY Id ASC`;
      const rows = await this.query(sql);
      return rows;
    } catch (error) {
      console.error(`❌ Error obteniendo datos de ${tableName}:`, error.message);
      return [];
    }
  }

  // CONFIGURACIONES
  async getConfiguracion(clave) {
    try {
      const sql = 'SELECT * FROM Configuraciones WHERE clave = ? LIMIT 1';
      const rows = await this.query(sql, [clave]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error(`❌ Error obteniendo configuración ${clave}:`, error.message);
      return null;
    }
  }

  async getConfiguracionValor(clave, defaultValue = '') {
    try {
      const config = await this.getConfiguracion(clave);
      return config ? (config.valor || defaultValue) : defaultValue;
    } catch (error) {
      console.error(`❌ Error obteniendo valor de configuración ${clave}:`, error.message);
      return defaultValue;
    }
  }

  async setConfiguracion(clave, valor, descripcion = null, tipo = 'text') {
    try {
      // Asegurar conexión
      if (!this.connected && !this.pool) {
        await this.connect();
      }
      
      // Intentar actualizar primero
      const sqlUpdate = 'UPDATE Configuraciones SET valor = ?, descripcion = ?, tipo = ? WHERE clave = ?';
      const [result] = await this.pool.execute(sqlUpdate, [valor, descripcion, tipo, clave]);
      
      // Si no se actualizó ninguna fila, insertar
      if (result.affectedRows === 0) {
        const sqlInsert = 'INSERT INTO Configuraciones (clave, valor, descripcion, tipo) VALUES (?, ?, ?, ?)';
        await this.pool.execute(sqlInsert, [clave, valor, descripcion, tipo]);
      }
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Error guardando configuración ${clave}:`, error.message);
      throw error;
    }
  }

  async getAllConfiguraciones() {
    try {
      const sql = 'SELECT * FROM Configuraciones ORDER BY clave ASC';
      const rows = await this.query(sql);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo todas las configuraciones:', error.message);
      return [];
    }
  }

  // API KEYS
  async getApiKeyByKey(apiKey) {
    try {
      const sql = 'SELECT * FROM `api_keys` WHERE api_key = ? AND activa = 1 LIMIT 1';
      const rows = await this.query(sql, [apiKey]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo API key:', error.message);
      return null;
    }
  }

  async getAllApiKeys() {
    try {
      // Incluir api_key para que los administradores puedan consultarla
      const sql = 'SELECT id, nombre, api_key, descripcion, activa, ultimo_uso, creado_en, actualizado_en, creado_por FROM `api_keys` ORDER BY creado_en DESC';
      const rows = await this.query(sql);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo todas las API keys:', error.message);
      return [];
    }
  }

  async createApiKey(nombre, descripcion = null, creadoPor = null) {
    try {
      // Generar API key único
      const crypto = require('crypto');
      const apiKey = 'farma_' + crypto.randomBytes(32).toString('hex');
      
      const sql = 'INSERT INTO `api_keys` (nombre, api_key, descripcion, creado_por) VALUES (?, ?, ?, ?)';
      const [result] = await this.pool.execute(sql, [nombre, apiKey, descripcion, creadoPor]);
      
      return {
        id: result.insertId,
        nombre: nombre,
        api_key: apiKey,
        descripcion: descripcion
      };
    } catch (error) {
      console.error('❌ Error creando API key:', error.message);
      throw error;
    }
  }

  async updateApiKeyUsage(apiKey) {
    try {
      const sql = 'UPDATE `api_keys` SET ultimo_uso = NOW() WHERE api_key = ?';
      await this.query(sql, [apiKey]);
    } catch (error) {
      console.error('❌ Error actualizando uso de API key:', error.message);
      // No lanzar error, solo log
    }
  }

  async toggleApiKey(id, activa) {
    try {
      const sql = 'UPDATE `api_keys` SET activa = ? WHERE id = ?';
      await this.query(sql, [activa ? 1 : 0, id]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error actualizando estado de API key:', error.message);
      throw error;
    }
  }

  async deleteApiKey(id) {
    try {
      const sql = 'DELETE FROM `api_keys` WHERE id = ?';
      await this.query(sql, [id]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando API key:', error.message);
      throw error;
    }
  }

  // =====================================================
  // Helpers internos (tablas con case variable)
  // =====================================================
  async _getCodigosPostalesTableName() {
    // Cache simple en la instancia
    this._cache = this._cache || {};
    if (this._cache.codigosPostalesTableName !== undefined) return this._cache.codigosPostalesTableName;
    try {
      const rows = await this.query(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND LOWER(table_name) = 'codigos_postales'
         ORDER BY (table_name = 'codigos_postales') DESC, table_name ASC
         LIMIT 1`
      );
      const name = rows?.[0]?.name || null;
      this._cache.codigosPostalesTableName = name;
      return name;
    } catch (_) {
      this._cache.codigosPostalesTableName = null;
      return null;
    }
  }

  async _getAsignacionesCpMarcasTableName() {
    this._cache = this._cache || {};
    if (this._cache.asignacionesCpMarcasTableName !== undefined) return this._cache.asignacionesCpMarcasTableName;
    try {
      const rows = await this.query(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND LOWER(table_name) = 'comerciales_codigos_postales_marcas'
         ORDER BY (table_name = 'comerciales_codigos_postales_marcas') DESC, table_name ASC
         LIMIT 1`
      );
      const name = rows?.[0]?.name || null;
      this._cache.asignacionesCpMarcasTableName = name;
      return name;
    } catch (_) {
      this._cache.asignacionesCpMarcasTableName = null;
      return null;
    }
  }

  async _getComercialesTableName() {
    this._cache = this._cache || {};
    if (this._cache.comercialesTableName !== undefined) return this._cache.comercialesTableName;
    try {
      const rows = await this.query(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND LOWER(table_name) = 'comerciales'
         ORDER BY (table_name = 'comerciales') DESC, table_name ASC
         LIMIT 1`
      );
      const name = rows?.[0]?.name || 'Comerciales';
      this._cache.comercialesTableName = name;
      return name;
    } catch (_) {
      this._cache.comercialesTableName = 'Comerciales';
      return 'Comerciales';
    }
  }

  async _getMarcasTableName() {
    this._cache = this._cache || {};
    if (this._cache.marcasTableName !== undefined) return this._cache.marcasTableName;
    try {
      const rows = await this.query(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND LOWER(table_name) = 'marcas'
         ORDER BY (table_name = 'marcas') DESC, table_name ASC
         LIMIT 1`
      );
      const name = rows?.[0]?.name || 'Marcas';
      this._cache.marcasTableName = name;
      return name;
    } catch (_) {
      this._cache.marcasTableName = 'Marcas';
      return 'Marcas';
    }
  }

  // =====================================================
  // MÉTODOS CRUD PARA CÓDIGOS POSTALES
  // =====================================================

  async getCodigosPostales(filtros = {}) {
    try {
      const codigosPostalesTable = await this._getCodigosPostalesTableName();
      if (!codigosPostalesTable) {
        console.warn('⚠️ [CODIGOS-POSTALES] La tabla de códigos postales no existe (Codigos_Postales/codigos_postales).');
        return [];
      }
      
      let sql = `
        SELECT cp.*, p.Nombre AS NombreProvincia, p.Codigo AS CodigoProvincia
        FROM ${codigosPostalesTable} cp
        LEFT JOIN provincias p ON (cp.Id_Provincia = p.id OR cp.Id_Provincia = p.Id)
        WHERE 1=1
      `;
      const params = [];

      if (filtros.codigoPostal) {
        sql += ' AND cp.CodigoPostal LIKE ?';
        params.push(`%${filtros.codigoPostal}%`);
      }
      if (filtros.localidad) {
        sql += ' AND cp.Localidad LIKE ?';
        params.push(`%${filtros.localidad}%`);
      }
      if (filtros.provincia) {
        sql += ' AND cp.Provincia LIKE ?';
        params.push(`%${filtros.provincia}%`);
      }
      if (filtros.idProvincia) {
        sql += ' AND cp.Id_Provincia = ?';
        params.push(filtros.idProvincia);
      }
      if (filtros.activo !== undefined) {
        sql += ' AND cp.Activo = ?';
        params.push(filtros.activo ? 1 : 0);
      }

      sql += ' ORDER BY cp.Provincia, cp.Localidad, cp.CodigoPostal';
      
      if (filtros.limit) {
        sql += ' LIMIT ?';
        params.push(filtros.limit);
        if (filtros.offset) {
          sql += ' OFFSET ?';
          params.push(filtros.offset);
        }
      }

      const rows = await this.query(sql, params);
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo códigos postales:', error.message);
      throw error;
    }
  }

  async getCodigoPostalById(id) {
    try {
      const codigosPostalesTable = await this._getCodigosPostalesTableName();
      if (!codigosPostalesTable) return null;
      const sql = `
        SELECT cp.*, p.Nombre AS NombreProvincia, p.Codigo AS CodigoProvincia
        FROM ${codigosPostalesTable} cp
        LEFT JOIN provincias p ON (cp.Id_Provincia = p.id OR cp.Id_Provincia = p.Id)
        WHERE cp.id = ?
      `;
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo código postal por ID:', error.message);
      throw error;
    }
  }

  async createCodigoPostal(data) {
    try {
      // Resolver nombre real de la tabla de códigos postales (en algunos servidores MySQL es case-sensitive)
      const cpTableRows = await this.query(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND LOWER(table_name) = 'codigos_postales'
         LIMIT 1`
      );
      const codigosPostalesTable = cpTableRows?.[0]?.name;
      if (!codigosPostalesTable) {
        throw new Error('La tabla de códigos postales no existe (Codigos_Postales/codigos_postales).');
      }
      
      const sql = `
        INSERT INTO ${codigosPostalesTable}
        (CodigoPostal, Localidad, Provincia, Id_Provincia, ComunidadAutonoma, Latitud, Longitud, Activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        data.CodigoPostal,
        data.Localidad,
        data.Provincia,
        data.Id_Provincia || null,
        data.ComunidadAutonoma || null,
        data.Latitud || null,
        data.Longitud || null,
        data.Activo !== undefined ? (data.Activo ? 1 : 0) : 1
      ];
      
      const result = await this.query(sql, params);
      return {
        success: true,
        insertId: result.insertId,
        affectedRows: result.affectedRows
      };
    } catch (error) {
      console.error('❌ Error creando código postal:', error.message);
      throw error;
    }
  }

  async updateCodigoPostal(id, data) {
    try {
      const codigosPostalesTable = await this._getCodigosPostalesTableName();
      if (!codigosPostalesTable) {
        throw new Error('La tabla de códigos postales no existe (Codigos_Postales/codigos_postales).');
      }
      const campos = [];
      const params = [];

      if (data.CodigoPostal !== undefined) {
        campos.push('CodigoPostal = ?');
        params.push(data.CodigoPostal);
      }
      if (data.Localidad !== undefined) {
        campos.push('Localidad = ?');
        params.push(data.Localidad);
      }
      if (data.Provincia !== undefined) {
        campos.push('Provincia = ?');
        params.push(data.Provincia);
      }
      if (data.Id_Provincia !== undefined) {
        campos.push('Id_Provincia = ?');
        params.push(data.Id_Provincia);
      }
      if (data.ComunidadAutonoma !== undefined) {
        campos.push('ComunidadAutonoma = ?');
        params.push(data.ComunidadAutonoma);
      }
      if (data.Latitud !== undefined) {
        campos.push('Latitud = ?');
        params.push(data.Latitud);
      }
      if (data.Longitud !== undefined) {
        campos.push('Longitud = ?');
        params.push(data.Longitud);
      }
      if (data.Activo !== undefined) {
        campos.push('Activo = ?');
        params.push(data.Activo ? 1 : 0);
      }

      if (campos.length === 0) {
        return { success: true, affectedRows: 0 };
      }

      params.push(id);
      const sql = `UPDATE ${codigosPostalesTable} SET ${campos.join(', ')} WHERE id = ?`;
      const result = await this.query(sql, params);
      
      return {
        success: true,
        affectedRows: result.affectedRows,
        changedRows: result.changedRows
      };
    } catch (error) {
      console.error('❌ Error actualizando código postal:', error.message);
      throw error;
    }
  }

  async deleteCodigoPostal(id) {
    try {
      const codigosPostalesTable = await this._getCodigosPostalesTableName();
      if (!codigosPostalesTable) {
        throw new Error('La tabla de códigos postales no existe (Codigos_Postales/codigos_postales).');
      }
      const sql = `DELETE FROM ${codigosPostalesTable} WHERE id = ?`;
      const result = await this.query(sql, [id]);
      return {
        success: true,
        affectedRows: result.affectedRows
      };
    } catch (error) {
      console.error('❌ Error eliminando código postal:', error.message);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS CRUD PARA ASIGNACIONES COMERCIALES - CÓDIGOS POSTALES - MARCAS
  // =====================================================

  async getAsignaciones(filtros = {}) {
    try {
      const asignacionesTable = await this._getAsignacionesCpMarcasTableName();
      if (!asignacionesTable) {
        console.warn('⚠️ [ASIGNACIONES] La tabla de asignaciones no existe (Comerciales_Codigos_Postales_Marcas/comerciales_codigos_postales_marcas).');
        return [];
      }
      const codigosPostalesTable = await this._getCodigosPostalesTableName();
      if (!codigosPostalesTable) {
        console.warn('⚠️ [ASIGNACIONES] La tabla de códigos postales no existe (Codigos_Postales/codigos_postales).');
        return [];
      }
      const comercialesTable = await this._getComercialesTableName();
      const marcasTable = await this._getMarcasTableName();
      
      let sql = `
        SELECT 
          ccp.id,
          ccp.Id_Comercial,
          ccp.Id_CodigoPostal,
          ccp.Id_Marca,
          ccp.FechaInicio,
          ccp.FechaFin,
          ccp.Activo,
          ccp.Prioridad,
          ccp.Observaciones,
          ccp.CreadoPor,
          ccp.CreadoEn,
          ccp.ActualizadoEn,
          c.Nombre AS NombreComercial,
          c.Email AS EmailComercial,
          cp.CodigoPostal,
          cp.Localidad,
          cp.Provincia,
          m.Nombre AS NombreMarca,
          COALESCE(
            (SELECT cl.Poblacion 
             FROM Clientes cl 
             WHERE (cl.Id_CodigoPostal = cp.id OR cl.CodigoPostal = cp.CodigoPostal)
               AND cl.Poblacion IS NOT NULL 
               AND cl.Poblacion != ''
             GROUP BY cl.Poblacion 
             ORDER BY COUNT(*) DESC 
             LIMIT 1),
            cp.Localidad
          ) AS Poblacion,
          COALESCE(cp.NumClientes, 0) AS NumClientes
        FROM ${asignacionesTable} ccp
        INNER JOIN ${comercialesTable} c ON (ccp.Id_Comercial = c.id OR ccp.Id_Comercial = c.Id)
        INNER JOIN ${codigosPostalesTable} cp ON (ccp.Id_CodigoPostal = cp.id OR ccp.Id_CodigoPostal = cp.Id)
        INNER JOIN ${marcasTable} m ON (ccp.Id_Marca = m.id OR ccp.Id_Marca = m.Id)
        WHERE 1=1
      `;
      const params = [];

      if (filtros.idComercial) {
        sql += ' AND ccp.Id_Comercial = ?';
        params.push(filtros.idComercial);
      }
      if (filtros.idCodigoPostal) {
        sql += ' AND ccp.Id_CodigoPostal = ?';
        params.push(filtros.idCodigoPostal);
      }
      if (filtros.idMarca) {
        sql += ' AND ccp.Id_Marca = ?';
        params.push(filtros.idMarca);
      }
      if (filtros.idProvincia) {
        sql += ' AND cp.Id_Provincia = ?';
        params.push(filtros.idProvincia);
      }
      if (filtros.provincia) {
        sql += ' AND cp.Provincia = ?';
        params.push(filtros.provincia);
      }
      if (filtros.activo !== undefined) {
        sql += ' AND ccp.Activo = ?';
        params.push(filtros.activo ? 1 : 0);
      }
      if (filtros.soloActivos === true) {
        sql += ' AND ccp.Activo = 1 AND (ccp.FechaFin IS NULL OR ccp.FechaFin >= CURDATE())';
      }

      sql += ' ORDER BY cp.Provincia, cp.Localidad, m.Nombre, ccp.Prioridad DESC';
      
      if (filtros.limit) {
        sql += ' LIMIT ?';
        params.push(filtros.limit);
        if (filtros.offset) {
          sql += ' OFFSET ?';
          params.push(filtros.offset);
        }
      }

      console.log(`✅ [ASIGNACIONES] Ejecutando consulta SQL: ${sql.substring(0, 200)}...`);
      console.log(`✅ [ASIGNACIONES] Parámetros:`, params);
      const rows = await this.query(sql, params);
      console.log(`✅ [ASIGNACIONES] Resultados obtenidos: ${rows ? rows.length : 0} asignaciones`);
      if (rows && rows.length > 0) {
        const ejemplo = rows[0];
        console.log(`✅ [ASIGNACIONES] Ejemplo de asignación:`);
        console.log(`   - CodigoPostal: ${ejemplo.CodigoPostal}`);
        console.log(`   - Poblacion: ${ejemplo.Poblacion}`);
        console.log(`   - NumClientes: ${ejemplo.NumClientes}`);
        console.log(`   - Localidad: ${ejemplo.Localidad}`);
        console.log(`✅ [ASIGNACIONES] Primera asignación completa:`, JSON.stringify({
          CodigoPostal: ejemplo.CodigoPostal,
          Poblacion: ejemplo.Poblacion,
          NumClientes: ejemplo.NumClientes,
          Localidad: ejemplo.Localidad
        }, null, 2));
      } else {
        console.warn(`⚠️ [ASIGNACIONES] No se encontraron asignaciones con los filtros aplicados`);
      }
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      console.error('❌ [ASIGNACIONES] Error obteniendo asignaciones:', error.message);
      console.error('❌ [ASIGNACIONES] Stack:', error.stack);
      // Devolver array vacío en lugar de lanzar error para evitar 500
      return [];
    }
  }

  async getAsignacionById(id) {
    try {
      const asignacionesTable = await this._getAsignacionesCpMarcasTableName();
      const codigosPostalesTable = await this._getCodigosPostalesTableName();
      const comercialesTable = await this._getComercialesTableName();
      const marcasTable = await this._getMarcasTableName();
      if (!asignacionesTable || !codigosPostalesTable) return null;
      const sql = `
        SELECT 
          ccp.*,
          c.Nombre AS NombreComercial,
          c.Email AS EmailComercial,
          cp.CodigoPostal,
          cp.Localidad,
          cp.Provincia,
          m.Nombre AS NombreMarca
        FROM ${asignacionesTable} ccp
        INNER JOIN ${comercialesTable} c ON (ccp.Id_Comercial = c.id OR ccp.Id_Comercial = c.Id)
        INNER JOIN ${codigosPostalesTable} cp ON (ccp.Id_CodigoPostal = cp.id OR ccp.Id_CodigoPostal = cp.Id)
        INNER JOIN ${marcasTable} m ON (ccp.Id_Marca = m.id OR ccp.Id_Marca = m.Id)
        WHERE ccp.id = ?
      `;
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo asignación por ID:', error.message);
      throw error;
    }
  }

  async createAsignacion(data) {
    try {
      // Validación defensiva (evita errores SQL tipo "Field 'Id_CodigoPostal' doesn't have a default value")
      if (!data || !data.Id_Comercial) {
        throw new Error('Id_Comercial es obligatorio');
      }
      if (!data.Id_CodigoPostal) {
        throw new Error('Id_CodigoPostal es obligatorio');
      }
      if (!data.Id_Marca) {
        throw new Error('Id_Marca es obligatorio');
      }

      const asignacionesTable = await this._getAsignacionesCpMarcasTableName();
      if (!asignacionesTable) {
        throw new Error('La tabla de asignaciones no existe (Comerciales_Codigos_Postales_Marcas/comerciales_codigos_postales_marcas). Ejecuta `scripts/crear-tabla-codigos-postales.sql` en la BD correcta.');
      }
      
      const sql = `
        INSERT INTO ${asignacionesTable} 
        (Id_Comercial, Id_CodigoPostal, Id_Marca, FechaInicio, FechaFin, Activo, Prioridad, Observaciones, CreadoPor)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        data.Id_Comercial,
        data.Id_CodigoPostal,
        data.Id_Marca,
        data.FechaInicio || null,
        data.FechaFin || null,
        data.Activo !== undefined ? (data.Activo ? 1 : 0) : 1,
        data.Prioridad || 0,
        data.Observaciones || null,
        data.CreadoPor || null
      ];
      
      const result = await this.query(sql, params);
      return {
        success: true,
        insertId: result.insertId,
        affectedRows: result.affectedRows
      };
    } catch (error) {
      console.error('❌ Error creando asignación:', error.message);
      throw error;
    }
  }

  async updateAsignacion(id, data) {
    try {
      const asignacionesTable = await this._getAsignacionesCpMarcasTableName();
      if (!asignacionesTable) {
        throw new Error('La tabla de asignaciones no existe (Comerciales_Codigos_Postales_Marcas/comerciales_codigos_postales_marcas).');
      }
      const campos = [];
      const params = [];

      if (data.Id_Comercial !== undefined) {
        campos.push('Id_Comercial = ?');
        params.push(data.Id_Comercial);
      }
      if (data.Id_CodigoPostal !== undefined) {
        campos.push('Id_CodigoPostal = ?');
        params.push(data.Id_CodigoPostal);
      }
      if (data.Id_Marca !== undefined) {
        campos.push('Id_Marca = ?');
        params.push(data.Id_Marca);
      }
      if (data.FechaInicio !== undefined) {
        campos.push('FechaInicio = ?');
        params.push(data.FechaInicio);
      }
      if (data.FechaFin !== undefined) {
        campos.push('FechaFin = ?');
        params.push(data.FechaFin);
      }
      if (data.Activo !== undefined) {
        campos.push('Activo = ?');
        params.push(data.Activo ? 1 : 0);
      }
      if (data.Prioridad !== undefined) {
        campos.push('Prioridad = ?');
        params.push(data.Prioridad);
      }
      if (data.Observaciones !== undefined) {
        campos.push('Observaciones = ?');
        params.push(data.Observaciones);
      }

      if (campos.length === 0) {
        return { success: true, affectedRows: 0 };
      }

      params.push(id);
      const sql = `UPDATE ${asignacionesTable} SET ${campos.join(', ')} WHERE id = ?`;
      const result = await this.query(sql, params);
      
      return {
        success: true,
        affectedRows: result.affectedRows,
        changedRows: result.changedRows
      };
    } catch (error) {
      console.error('❌ Error actualizando asignación:', error.message);
      throw error;
    }
  }

  async deleteAsignacion(id) {
    try {
      const asignacionesTable = await this._getAsignacionesCpMarcasTableName();
      if (!asignacionesTable) {
        throw new Error('La tabla de asignaciones no existe (Comerciales_Codigos_Postales_Marcas/comerciales_codigos_postales_marcas).');
      }
      const sql = `DELETE FROM ${asignacionesTable} WHERE id = ?`;
      const result = await this.query(sql, [id]);
      return {
        success: true,
        affectedRows: result.affectedRows
      };
    } catch (error) {
      console.error('❌ Error eliminando asignación:', error.message);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS PARA ASIGNACIONES MASIVAS
  // =====================================================

  /**
   * Crear asignaciones masivas
   * @param {Object} data - Datos de la asignación masiva
   * @param {number} data.Id_Comercial - ID del comercial
   * @param {Array<number>} data.Ids_CodigosPostales - Array de IDs de códigos postales
   * @param {number|null} data.Id_Marca - ID de la marca (null = todas las marcas)
   * @param {Date|null} data.FechaInicio - Fecha de inicio
   * @param {Date|null} data.FechaFin - Fecha de fin
   * @param {number} data.Prioridad - Prioridad
   * @param {boolean} data.Activo - Si está activo
   * @param {string|null} data.Observaciones - Observaciones
   * @param {number|null} data.CreadoPor - ID del usuario que crea
   * @param {boolean} data.ActualizarClientes - Si actualizar clientes automáticamente
   * @returns {Object} Resultado con asignaciones creadas y clientes actualizados
   */
  async createAsignacionesMasivas(data) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        Id_Comercial,
        Ids_CodigosPostales = [],
        Id_Marca = null,
        FechaInicio = null,
        FechaFin = null,
        Prioridad = 0,
        Activo = true,
        Observaciones = null,
        CreadoPor = null,
        ActualizarClientes = true
      } = data;

      if (!Id_Comercial || !Ids_CodigosPostales || Ids_CodigosPostales.length === 0) {
        throw new Error('Id_Comercial e Ids_CodigosPostales son obligatorios');
      }

      // Obtener todas las marcas si Id_Marca es null
      let marcas = [];
      if (Id_Marca === null || Id_Marca === '') {
        // Verificar si la columna Activo existe en Marcas antes de usarla
        let hasActivoColumn = false;
        try {
          const [columns] = await this.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'Marcas' 
              AND COLUMN_NAME = 'Activo'
          `);
          hasActivoColumn = columns && columns.length > 0;
        } catch (e) {
          console.warn('⚠️ [ASIGNACIONES-MASIVAS] No se pudo verificar la columna Activo en Marcas:', e.message);
        }
        
        // Consultar marcas (con filtro Activo solo si existe)
        const sqlMarcas = hasActivoColumn 
          ? 'SELECT id FROM Marcas WHERE Activo = 1'
          : 'SELECT id FROM Marcas';
        const marcasResult = await this.query(sqlMarcas);
        marcas = marcasResult.map(m => m.id);
      } else {
        marcas = [Id_Marca];
      }

      const asignacionesCreadas = [];
      const asignacionesExistentes = [];
      const errores = [];

      // Crear asignaciones para cada código postal y marca
      for (const Id_CodigoPostal of Ids_CodigosPostales) {
        for (const marcaId of marcas) {
          try {
            // Verificar si ya existe
            const existe = await this.query(
              `SELECT id FROM Comerciales_Codigos_Postales_Marcas 
               WHERE Id_Comercial = ? AND Id_CodigoPostal = ? AND Id_Marca = ? 
               AND (FechaInicio IS NULL OR FechaInicio = ?)`,
              [Id_Comercial, Id_CodigoPostal, marcaId, FechaInicio]
            );

            if (existe && existe.length > 0) {
              asignacionesExistentes.push({
                Id_CodigoPostal,
                Id_Marca: marcaId
              });
              continue;
            }

            // Crear nueva asignación
            const result = await this.query(
              `INSERT INTO Comerciales_Codigos_Postales_Marcas 
               (Id_Comercial, Id_CodigoPostal, Id_Marca, FechaInicio, FechaFin, Activo, Prioridad, Observaciones, CreadoPor)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                Id_Comercial,
                Id_CodigoPostal,
                marcaId,
                FechaInicio,
                FechaFin,
                Activo ? 1 : 0,
                Prioridad,
                Observaciones,
                CreadoPor
              ]
            );

            asignacionesCreadas.push({
              id: result.insertId,
              Id_CodigoPostal,
              Id_Marca: marcaId
            });
          } catch (error) {
            errores.push({
              Id_CodigoPostal,
              Id_Marca: marcaId,
              error: error.message
            });
          }
        }
      }

      // Actualizar clientes si se solicita
      let clientesActualizados = 0;
      if (ActualizarClientes && asignacionesCreadas.length > 0) {
        // Obtener códigos postales únicos de las asignaciones creadas
        const codigosPostalesUnicos = [...new Set(asignacionesCreadas.map(a => a.Id_CodigoPostal))];
        
        // Actualizar clientes que tengan estos códigos postales
        // Usar el comercial específico que acabamos de asignar
        if (codigosPostalesUnicos.length > 0) {
          // Usar placeholders para evitar inyección SQL
          const placeholders = codigosPostalesUnicos.map(() => '?').join(',');
          
          console.log(`✅ [ACTUALIZAR-CLIENTES] Actualizando clientes con códigos postales: ${codigosPostalesUnicos.join(', ')}`);
          console.log(`✅ [ACTUALIZAR-CLIENTES] Comercial asignado: ${Id_Comercial}, Prioridad: ${Prioridad}`);
          
          // Obtener la prioridad máxima del comercial asignado para estos códigos postales
          const prioridadPlaceholders = codigosPostalesUnicos.map(() => '?').join(',');
          const prioridadResult = await this.query(
            `SELECT MAX(Prioridad) as maxPrioridad 
             FROM Comerciales_Codigos_Postales_Marcas 
             WHERE Id_Comercial = ? 
               AND Id_CodigoPostal IN (${prioridadPlaceholders})
               AND Activo = 1
               AND (FechaFin IS NULL OR FechaFin >= CURDATE())
               AND (FechaInicio IS NULL OR FechaInicio <= CURDATE())`,
            [Id_Comercial, ...codigosPostalesUnicos]
          );
          
          const prioridadComercial = prioridadResult[0]?.maxPrioridad || Prioridad || 0;
          console.log(`✅ [ACTUALIZAR-CLIENTES] Prioridad del comercial asignado: ${prioridadComercial}`);
          
          // Obtener los códigos postales (texto) de los IDs
          const codigosPostalesTexto = await this.query(
            `SELECT CodigoPostal FROM Codigos_Postales WHERE id IN (${placeholders})`,
            codigosPostalesUnicos
          );
          const codigosPostalesArray = codigosPostalesTexto.map(cp => cp.CodigoPostal);
          const codigosPostalesPlaceholders = codigosPostalesArray.map(() => '?').join(',');
          
          console.log(`✅ [ACTUALIZAR-CLIENTES] Códigos postales a buscar: ${codigosPostalesArray.join(', ')}`);
          
          // Actualizar clientes directamente con el comercial asignado
          // Buscar por Id_CodigoPostal O por CodigoPostal (texto) si Id_CodigoPostal es null
          // Solo actualizar si el cliente no tiene comercial o si la prioridad del nuevo comercial es mayor
          const updateResult = await this.query(
            `UPDATE Clientes c
             LEFT JOIN Codigos_Postales cp ON c.Id_CodigoPostal = cp.id
             SET c.Id_Cial = ?
             WHERE (
               (c.Id_CodigoPostal IN (${placeholders}))
               OR (c.Id_CodigoPostal IS NULL AND c.CodigoPostal IN (${codigosPostalesPlaceholders}))
             )
               AND (
                 c.Id_Cial IS NULL 
                 OR c.Id_Cial = 0
                 OR ? > COALESCE((
                   SELECT MAX(ccp2.Prioridad)
                   FROM Comerciales_Codigos_Postales_Marcas ccp2
                   INNER JOIN Codigos_Postales cp2 ON ccp2.Id_CodigoPostal = cp2.id
                   WHERE (cp2.id = c.Id_CodigoPostal OR cp2.CodigoPostal = c.CodigoPostal)
                     AND ccp2.Id_Comercial = c.Id_Cial
                     AND ccp2.Activo = 1
                     AND (ccp2.FechaFin IS NULL OR ccp2.FechaFin >= CURDATE())
                     AND (ccp2.FechaInicio IS NULL OR ccp2.FechaInicio <= CURDATE())
                 ), -1)
               )`,
            [Id_Comercial, ...codigosPostalesUnicos, ...codigosPostalesArray, prioridadComercial]
          );

          clientesActualizados = updateResult.affectedRows || 0;
          console.log(`✅ [ACTUALIZAR-CLIENTES] Clientes actualizados con comercial ${Id_Comercial}: ${clientesActualizados}`);
        }
      }

      await connection.commit();

      return {
        success: true,
        asignacionesCreadas: asignacionesCreadas.length,
        asignacionesExistentes: asignacionesExistentes.length,
        clientesActualizados,
        errores: errores.length,
        detalles: {
          asignacionesCreadas,
          asignacionesExistentes,
          errores
        }
      };
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error creando asignaciones masivas:', error.message);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Crear asignaciones masivas por provincia
   * @param {Object} data - Datos de la asignación masiva por provincia
   * @param {number} data.Id_Comercial - ID del comercial
   * @param {number|string} data.Id_Provincia - ID o nombre de la provincia
   * @param {number|null} data.Id_Marca - ID de la marca (null = todas las marcas)
   * @param {Date|null} data.FechaInicio - Fecha de inicio
   * @param {Date|null} data.FechaFin - Fecha de fin
   * @param {number} data.Prioridad - Prioridad
   * @param {boolean} data.Activo - Si está activo
   * @param {string|null} data.Observaciones - Observaciones
   * @param {number|null} data.CreadoPor - ID del usuario que crea
   * @param {boolean} data.ActualizarClientes - Si actualizar clientes automáticamente
   * @returns {Object} Resultado con asignaciones creadas y clientes actualizados
   */
  async createAsignacionesPorProvincia(data) {
    try {
      const {
        Id_Comercial,
        Id_Provincia,
        Id_Marca = null,
        FechaInicio = null,
        FechaFin = null,
        Prioridad = 0,
        Activo = true,
        Observaciones = null,
        CreadoPor = null,
        ActualizarClientes = true
      } = data;

      console.log(`✅ [ASIGNACIONES-PROVINCIA] Iniciando asignación por provincia:`);
      console.log(`   - Id_Comercial: ${Id_Comercial}`);
      console.log(`   - Id_Provincia: ${Id_Provincia}`);
      console.log(`   - Id_Marca: ${Id_Marca}`);
      console.log(`   - Prioridad: ${Prioridad}`);
      console.log(`   - ActualizarClientes: ${ActualizarClientes}`);

      if (!Id_Comercial || !Id_Provincia) {
        throw new Error('Id_Comercial e Id_Provincia son obligatorios');
      }

      // Obtener todos los códigos postales activos de la provincia
      let sql = `
        SELECT id FROM Codigos_Postales 
        WHERE Activo = 1
      `;
      const params = [];

      // Si Id_Provincia es numérico, usar Id_Provincia, si no, usar Provincia
      if (typeof Id_Provincia === 'number' || /^\d+$/.test(Id_Provincia)) {
        sql += ' AND Id_Provincia = ?';
        params.push(parseInt(Id_Provincia));
      } else {
        sql += ' AND Provincia = ?';
        params.push(Id_Provincia);
      }

      console.log(`✅ [ASIGNACIONES-PROVINCIA] Consultando códigos postales con SQL: ${sql}`);
      console.log(`✅ [ASIGNACIONES-PROVINCIA] Parámetros:`, params);

      const codigosPostales = await this.query(sql, params);

      console.log(`✅ [ASIGNACIONES-PROVINCIA] Códigos postales encontrados: ${codigosPostales ? codigosPostales.length : 0}`);

      if (!codigosPostales || codigosPostales.length === 0) {
        throw new Error(`No se encontraron códigos postales para la provincia: ${Id_Provincia}`);
      }

      const Ids_CodigosPostales = codigosPostales.map(cp => cp.id);
      console.log(`✅ [ASIGNACIONES-PROVINCIA] IDs de códigos postales: ${Ids_CodigosPostales.slice(0, 10).join(', ')}... (${Ids_CodigosPostales.length} total)`);

      // Usar el método de asignaciones masivas
      const resultado = await this.createAsignacionesMasivas({
        Id_Comercial,
        Ids_CodigosPostales,
        Id_Marca,
        FechaInicio,
        FechaFin,
        Prioridad,
        Activo,
        Observaciones,
        CreadoPor,
        ActualizarClientes
      });

      console.log(`✅ [ASIGNACIONES-PROVINCIA] Resultado:`, JSON.stringify(resultado, null, 2));

      return resultado;
    } catch (error) {
      console.error('❌ Error creando asignaciones por provincia:', error.message);
      console.error('❌ Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Actualizar clientes basándose en asignaciones de códigos postales
   * @param {Array<number>} Ids_CodigosPostales - IDs de códigos postales
   * @param {number|null} Id_Marca - ID de la marca (null = todas)
   * @returns {Object} Resultado con clientes actualizados
   */
  async actualizarClientesPorCodigosPostales(Ids_CodigosPostales, Id_Marca = null) {
    try {
      if (!Ids_CodigosPostales || Ids_CodigosPostales.length === 0) {
        return { success: true, clientesActualizados: 0 };
      }

      let sql = `
        UPDATE Clientes c
        INNER JOIN Codigos_Postales cp ON c.Id_CodigoPostal = cp.id
        INNER JOIN Comerciales_Codigos_Postales_Marcas ccp ON cp.id = ccp.Id_CodigoPostal
        SET c.Id_Cial = ccp.Id_Comercial
        WHERE c.Id_CodigoPostal IN (?)
          AND ccp.Activo = 1
          AND (ccp.FechaFin IS NULL OR ccp.FechaFin >= CURDATE())
          AND (ccp.FechaInicio IS NULL OR ccp.FechaInicio <= CURDATE())
      `;
      const params = [Ids_CodigosPostales];

      if (Id_Marca !== null) {
        sql += ' AND ccp.Id_Marca = ?';
        params.push(Id_Marca);
      }

      // Solo actualizar si el comercial asignado tiene mayor prioridad o el cliente no tiene comercial
      sql += `
        AND (
          c.Id_Cial IS NULL 
          OR c.Id_Cial = 0
          OR ccp.Prioridad >= (
            SELECT COALESCE(MAX(ccp2.Prioridad), 0)
            FROM Comerciales_Codigos_Postales_Marcas ccp2
            INNER JOIN Codigos_Postales cp2 ON ccp2.Id_CodigoPostal = cp2.id
            WHERE cp2.id = c.Id_CodigoPostal
              AND ccp2.Id_Comercial = c.Id_Cial
              AND ccp2.Activo = 1
          )
        )
      `;

      const result = await this.query(sql, params);

      return {
        success: true,
        clientesActualizados: result.affectedRows || 0
      };
    } catch (error) {
      console.error('❌ Error actualizando clientes por códigos postales:', error.message);
      throw error;
    }
  }

  // ============================================
  // MÉTODOS DE RECUPERACIÓN DE CONTRASEÑA
  // ============================================

  async ensurePasswordResetTokensTable() {
    if (this._passwordResetTableReady) return;
    const sql = `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      comercial_id INT NOT NULL,
      token VARCHAR(128) NOT NULL,
      email VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      used TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_password_reset_token (token),
      KEY idx_password_reset_comercial (comercial_id),
      KEY idx_password_reset_email (email),
      KEY idx_password_reset_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
    await this.query(sql);
    this._passwordResetTableReady = true;
  }

  /**
   * Crear un token de recuperación de contraseña
   */
  async createPasswordResetToken(comercialId, email, token, expiresInHours = 24) {
    try {
      await this.ensurePasswordResetTokensTable();

      const hours = Math.max(1, Number(expiresInHours) || 24);
      const cleanToken = String(token || '').trim().replace(/\s+/g, '');

      // Invalidar tokens anteriores no usados del mismo usuario
      await this.query(
        'UPDATE password_reset_tokens SET used = 1 WHERE comercial_id = ? AND used = 0',
        [comercialId]
      );

      // expires_at calculado en MySQL (evita desfase TZ entre Node/Vercel y el servidor MySQL)
      const sql = `INSERT INTO password_reset_tokens (comercial_id, token, email, expires_at, used)
                   VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), 0)`;
      const result = await this.query(sql, [comercialId, cleanToken, email, hours]);
      return { insertId: result?.insertId ?? result?.affectedRows, expiresInHours: hours };
    } catch (error) {
      console.error('❌ Error creando token de recuperación:', error.message);
      throw error;
    }
  }

  /**
   * Buscar un token de recuperación válido
   */
  async findPasswordResetToken(token) {
    try {
      await this.ensurePasswordResetTokensTable();

      const cleanToken = String(token || '').trim().replace(/\s+/g, '');
      if (!cleanToken) return null;

      const sql = `SELECT * FROM password_reset_tokens
                   WHERE token = ? AND used = 0 AND expires_at > NOW()
                   LIMIT 1`;
      const rows = await this.query(sql, [cleanToken]);
      if (Array.isArray(rows) && rows.length > 0) return rows[0];

      // Diagnóstico (sin filtrar por validez) para logs
      const any = await this.query(
        'SELECT id, used, expires_at, (expires_at > NOW()) AS not_expired FROM password_reset_tokens WHERE token = ? LIMIT 1',
        [cleanToken]
      );
      if (Array.isArray(any) && any.length > 0) {
        console.warn('⚠️ [RESET] Token encontrado pero no válido:', {
          used: any[0].used,
          expires_at: any[0].expires_at,
          not_expired: any[0].not_expired
        });
      } else {
        console.warn('⚠️ [RESET] Token no existe en BD (¿enlace corrupto o no guardado?) length=', cleanToken.length);
      }
      return null;
    } catch (error) {
      console.error('❌ Error buscando token de recuperación:', error.message);
      return null;
    }
  }

  /**
   * Marcar un token como usado
   */
  async markPasswordResetTokenAsUsed(token) {
    try {
      await this.ensurePasswordResetTokensTable();
      const cleanToken = String(token || '').trim().replace(/\s+/g, '');
      const sql = 'UPDATE password_reset_tokens SET used = 1 WHERE token = ?';
      const result = await this.query(sql, [cleanToken]);
      return (result?.affectedRows || 0) > 0;
    } catch (error) {
      console.error('❌ Error marcando token como usado:', error.message);
      return false;
    }
  }

  /**
   * Limpiar tokens expirados
   */
  async cleanupExpiredTokens() {
    try {
      await this.ensurePasswordResetTokensTable();
      const sql = 'DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = 1';
      const result = await this.query(sql);
      return result?.affectedRows || 0;
    } catch (error) {
      console.error('❌ Error limpiando tokens expirados:', error.message);
      return 0;
    }
  }

  /**
   * Verificar intentos recientes de recuperación (rate limiting)
   */
  async countRecentPasswordResetAttempts(email, hours = 1) {
    try {
      await this.ensurePasswordResetTokensTable();
      const h = Math.max(1, Number(hours) || 1);
      const sql = `SELECT COUNT(*) as count FROM password_reset_tokens
                   WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)`;
      const rows = await this.query(sql, [email, h]);
      return Number(rows?.[0]?.count || 0);
    } catch (error) {
      console.error('❌ Error contando intentos recientes:', error.message);
      return 0;
    }
  }
}

module.exports = new MySQLCRM();

