// Rutas dashboard (Ajustes) para Tarifas de Clientes
const express = require('express');
const router = express.Router();
const crm = require('../config/mysql-crm');

const parseDateOrNull = (value) => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (str === '0' || str === '0000-00-00') return null;
  return str;
};

const normalizarActiva = (value) => {
  if (value === true) return 1;
  if (value === false) return 0;
  const v = String(value ?? '').toLowerCase().trim();
  return (v === '1' || v === 'true' || v === 'si' || v === 'sí' || v === 'on') ? 1 : 0;
};

let __articulosColsCache = null;
let __marcasTableCache = null;

async function getArticulosColumns() {
  if (__articulosColsCache) return __articulosColsCache;
  const rows = await crm.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'articulos'`
  );
  const set = new Set((rows || []).map(r => String(r.COLUMN_NAME || r.column_name || '').trim()).filter(Boolean));
  __articulosColsCache = set;
  return set;
}

async function getMarcasTableName() {
  if (__marcasTableCache) return __marcasTableCache;
  try {
    await crm.query('SELECT 1 FROM `marcas` LIMIT 1');
    __marcasTableCache = 'marcas';
    return __marcasTableCache;
  } catch (_) {
    await crm.query('SELECT 1 FROM `Marcas` LIMIT 1');
    __marcasTableCache = 'Marcas';
    return __marcasTableCache;
  }
}

async function getMarcasCompat() {
  try {
    // Preferible: tabla en minúsculas
    const rows = await crm.query('SELECT id, Nombre FROM `marcas` ORDER BY Nombre ASC');
    return rows || [];
  } catch (_) {
    // Fallback: tabla con mayúscula
    const rows = await crm.query('SELECT id, Nombre FROM `Marcas` ORDER BY Nombre ASC');
    return rows || [];
  }
}

async function getTarifas() {
  return await crm.query('SELECT Id, NombreTarifa, Activa, FechaInicio, FechaFin, Observaciones FROM `tarifasClientes` ORDER BY NombreTarifa ASC');
}

async function getTarifaById(id) {
  const rows = await crm.query('SELECT Id, NombreTarifa, Activa, FechaInicio, FechaFin, Observaciones FROM `tarifasClientes` WHERE Id = ? LIMIT 1', [id]);
  return rows && rows.length > 0 ? rows[0] : null;
}

async function getTarifasParaReferencia() {
  // Listado para selector de referencia (incluye General e históricas)
  const rows = await crm.query(
    `SELECT Id, NombreTarifa
     FROM tarifasClientes
     ORDER BY (Id = 0) DESC, NombreTarifa ASC`
  );
  return rows || [];
}

async function getTarifasActivas() {
  // Consideramos activa si Activa=1 y (FechaFin IS NULL o 0000-00-00)
  const rows = await crm.query(
    `SELECT Id, NombreTarifa
     FROM tarifasClientes
     WHERE (Activa = 1 OR Activa = '1')
       -- Evitar literal DATE '0000-00-00' (en MySQL strict da "Incorrect DATE value")
       AND (FechaFin IS NULL OR CAST(FechaFin AS CHAR) = '0000-00-00')
     ORDER BY (Id = 0) DESC, NombreTarifa ASC`
  );
  return rows || [];
}

// Listado + formulario creación
router.get('/', async (req, res) => {
  const user = req.comercial || req.session?.comercial || null;
  try {
    const tarifas = await getTarifas();
    res.render('dashboard/ajustes-tarifas-clientes', {
      title: 'Tarifas de Clientes - Farmadescanso',
      user,
      esAdmin: true,
      tarifas,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    res.render('dashboard/ajustes-tarifas-clientes', {
      title: 'Tarifas de Clientes - Farmadescanso',
      user,
      esAdmin: true,
      tarifas: [],
      error: error.message,
      success: null
    });
  }
});

// Matriz de tarifas activas por artículo (una columna por tarifa activa)
// IMPORTANTE: debe ir ANTES de '/:id' para que no lo capture como id="matriz"
router.get('/matriz', async (req, res) => {
  const user = req.comercial || req.session?.comercial || null;
  try {
    const tarifasActivas = await getTarifasActivas();
    const marcas = await getMarcasCompat().catch(() => []);
    const marcaId = req.query.marcaId ? Number(req.query.marcaId) : null;

    const cols = await getArticulosColumns().catch(() => new Set());
    const hasMarcaText = cols.has('Marca') || cols.has('marca');
    const hasIdMarca = cols.has('Id_Marca') || cols.has('id_marca');
    const hasNombre = cols.has('Nombre') || cols.has('nombre');
    const hasSku = cols.has('SKU') || cols.has('sku');
    const hasIdUpper = cols.has('Id');
    const hasIdLower = cols.has('id');

    const marcasTable = hasIdMarca ? await getMarcasTableName().catch(() => null) : null;
    const marcaSelect = hasMarcaText ? 'a.Marca' : (hasIdMarca && marcasTable ? 'm.Nombre' : "''");
    const nombreSelect = hasNombre ? 'a.Nombre' : "''";
    const skuSelect = hasSku ? 'a.SKU' : "''";
    const articuloPkOrder = hasIdUpper ? 'a.Id' : (hasIdLower ? 'a.id' : '1');

    let sqlArt = `
      SELECT
        a.*,
        ${nombreSelect} AS NombreArticulo,
        ${marcaSelect} AS MarcaArticulo,
        ${skuSelect} AS SKUArticulo
      FROM articulos a
      ${hasIdMarca && marcasTable ? `LEFT JOIN \`${marcasTable}\` m ON (m.id = a.Id_Marca OR m.Id = a.Id_Marca)` : ''}
      WHERE 1=1
    `;
    const paramsArt = [];
    if (marcaId && Number.isFinite(marcaId) && hasIdMarca) {
      sqlArt += ' AND (a.Id_Marca = ? OR a.id_marca = ?)';
      paramsArt.push(marcaId, marcaId);
    }
    sqlArt += ` ORDER BY ${articuloPkOrder} ASC`;
    const articulos = await crm.query(sqlArt, paramsArt);

    // Precios de todas las tarifas activas para todos los artículos (mapeo en memoria)
    const tarifaIds = (tarifasActivas || []).map(t => Number(t.Id)).filter(Number.isFinite);
    let preciosRows = [];
    if (tarifaIds.length > 0) {
      const placeholders = tarifaIds.map(() => '?').join(', ');
      preciosRows = await crm.query(
        `SELECT Id_Tarifa, Id_Articulo, Precio
         FROM tarifasClientes_precios
         WHERE Id_Tarifa IN (${placeholders})`,
        tarifaIds
      );
    }
    const preciosMap = new Map(); // key `${tarifaId}:${articuloId}` -> precio
    for (const r of preciosRows || []) {
      const k = `${Number(r.Id_Tarifa)}:${Number(r.Id_Articulo)}`;
      preciosMap.set(k, Number(r.Precio));
    }

    res.render('dashboard/ajustes-tarifas-clientes-matriz', {
      title: 'Tarifas activas por Artículo - Farmadescanso',
      user,
      esAdmin: true,
      marcas,
      marcaId: marcaId || '',
      tarifasActivas: tarifasActivas || [],
      articulos: articulos || [],
      preciosMap,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    res.status(500).render('error', { error: 'Error', message: error.message });
  }
});

// Crear tarifa
router.post('/', async (req, res) => {
  try {
    const nombre = String(req.body?.NombreTarifa || '').trim();
    if (!nombre) {
      return res.redirect('/dashboard/ajustes/tarifas-clientes?error=' + encodeURIComponent('El nombre de la tarifa es obligatorio'));
    }

    const activa = normalizarActiva(req.body?.Activa);
    const fechaInicio = parseDateOrNull(req.body?.FechaInicio);
    const fechaFin = parseDateOrNull(req.body?.FechaFin);
    const observaciones = String(req.body?.Observaciones || '').trim() || null;

    await crm.query(
      'INSERT INTO `tarifasClientes` (NombreTarifa, Activa, FechaInicio, FechaFin, Observaciones) VALUES (?, ?, ?, ?, ?)',
      [nombre, activa, fechaInicio, fechaFin, observaciones]
    );

    res.redirect('/dashboard/ajustes/tarifas-clientes?success=' + encodeURIComponent('Tarifa creada correctamente'));
  } catch (error) {
    res.redirect('/dashboard/ajustes/tarifas-clientes?error=' + encodeURIComponent('Error creando tarifa: ' + error.message));
  }
});

// Formulario editar tarifa
router.get('/:id', async (req, res) => {
  const user = req.comercial || req.session?.comercial || null;
  try {
    const tarifa = await getTarifaById(Number(req.params.id));
    if (!tarifa) {
      return res.status(404).render('error', { error: 'Tarifa no encontrada', message: 'La tarifa no existe' });
    }
    res.render('dashboard/ajustes-tarifa-cliente-editar', {
      title: `Editar Tarifa #${tarifa.Id} - Farmadescanso`,
      user,
      esAdmin: true,
      tarifa,
      error: null,
      success: req.query.success || null
    });
  } catch (error) {
    res.status(500).render('error', { error: 'Error', message: error.message });
  }
});

// Guardar tarifa
router.post('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.redirect('/dashboard/ajustes/tarifas-clientes?error=' + encodeURIComponent('ID inválido'));
    }

    const nombre = String(req.body?.NombreTarifa || '').trim();
    if (!nombre) {
      return res.redirect(`/dashboard/ajustes/tarifas-clientes/${id}?error=` + encodeURIComponent('El nombre de la tarifa es obligatorio'));
    }

    const activa = normalizarActiva(req.body?.Activa);
    const fechaInicio = parseDateOrNull(req.body?.FechaInicio);
    const fechaFin = parseDateOrNull(req.body?.FechaFin);
    const observaciones = String(req.body?.Observaciones || '').trim() || null;

    // Regla de negocio: si hay FechaFin, dejarla inactiva
    const activaFinal = fechaFin ? 0 : activa;

    await crm.query(
      'UPDATE `tarifasClientes` SET NombreTarifa = ?, Activa = ?, FechaInicio = ?, FechaFin = ?, Observaciones = ? WHERE Id = ?',
      [nombre, activaFinal, fechaInicio, fechaFin, observaciones, id]
    );

    res.redirect(`/dashboard/ajustes/tarifas-clientes/${id}?success=` + encodeURIComponent('Tarifa actualizada correctamente'));
  } catch (error) {
    res.redirect(`/dashboard/ajustes/tarifas-clientes/${req.params.id}?error=` + encodeURIComponent('Error actualizando tarifa: ' + error.message));
  }
});

// Vista de precios por tarifa (con filtro por marca)
router.get('/:id/precios', async (req, res) => {
  const user = req.comercial || req.session?.comercial || null;
  try {
    const tarifaId = Number(req.params.id);
    const tarifa = await getTarifaById(tarifaId);
    if (!tarifa) {
      return res.status(404).render('error', { error: 'Tarifa no encontrada', message: 'La tarifa no existe' });
    }

    const marcas = await getMarcasCompat().catch(() => []);
    const tarifasReferencia = await getTarifasParaReferencia().catch(() => []);
    const marcaId = req.query.marcaId ? Number(req.query.marcaId) : null;
    const marcaNombre = req.query.marcaNombre ? String(req.query.marcaNombre) : null;
    const refTarifaId = req.query.refTarifaId !== undefined && req.query.refTarifaId !== ''
      ? Number(req.query.refTarifaId)
      : 0;
    const refTarifa = await getTarifaById(Number.isFinite(refTarifaId) ? refTarifaId : 0).catch(() => null);

    const cols = await getArticulosColumns().catch(() => new Set());
    const hasMarcaText = cols.has('Marca') || cols.has('marca');
    const hasIdMarca = cols.has('Id_Marca') || cols.has('id_marca');
    const hasNombre = cols.has('Nombre') || cols.has('nombre');
    const hasIdUpper = cols.has('Id');
    const hasIdLower = cols.has('id');

    const marcasTable = hasIdMarca ? await getMarcasTableName().catch(() => null) : null;

    const marcaSelect = hasMarcaText
      ? 'a.Marca'
      : (hasIdMarca && marcasTable ? 'm.Nombre' : "''");

    const nombreSelect = hasNombre ? 'a.Nombre' : "''";
    const articuloPkOrder = hasIdUpper ? 'a.Id' : (hasIdLower ? 'a.id' : '1');

    let sql = `
      SELECT
        a.*,
        ${nombreSelect} AS NombreArticulo,
        ${marcaSelect} AS MarcaArticulo,
        tp.Precio AS PrecioTarifa,
        tr.Precio AS PrecioReferencia
      FROM articulos a
      ${hasIdMarca && marcasTable ? `LEFT JOIN \`${marcasTable}\` m ON (m.id = a.Id_Marca OR m.Id = a.Id_Marca)` : ''}
      LEFT JOIN tarifasClientes_precios tp
        ON tp.Id_Tarifa = ?
       AND (tp.Id_Articulo = a.Id OR tp.Id_Articulo = a.id)
      LEFT JOIN tarifasClientes_precios tr
        ON tr.Id_Tarifa = ?
       AND (tr.Id_Articulo = a.Id OR tr.Id_Articulo = a.id)
      WHERE 1=1
    `;
    const params = [tarifaId, Number.isFinite(refTarifaId) ? refTarifaId : 0];

    if (marcaId && Number.isFinite(marcaId)) {
      if (hasIdMarca) {
        sql += ' AND (a.Id_Marca = ? OR a.id_marca = ?)';
        params.push(marcaId, marcaId);
      }
    } else if (marcaNombre) {
      if (hasMarcaText) {
        sql += ' AND (a.Marca = ?)';
        params.push(marcaNombre);
      } else if (marcasTable) {
        sql += ' AND (m.Nombre = ?)';
        params.push(marcaNombre);
      }
    }

    sql += ` ORDER BY ${articuloPkOrder} ASC`;

    const articulos = await crm.query(sql, params);

    let debugDb = null;
    if (String(req.query.debug || '') === '1') {
      try {
        const r = await crm.query('SELECT DATABASE() AS db');
        debugDb = r && r.length > 0 ? r[0].db : null;
      } catch (_) {
        debugDb = null;
      }
    }

    res.render('dashboard/ajustes-tarifa-cliente-precios', {
      title: `Precios Tarifa - ${tarifa.NombreTarifa} - Farmadescanso`,
      user,
      esAdmin: true,
      tarifa,
      marcas,
      tarifasReferencia,
      marcaId: marcaId || '',
      marcaNombre: marcaNombre || '',
      refTarifaId: Number.isFinite(refTarifaId) ? refTarifaId : 0,
      refTarifa: refTarifa || { Id: 0, NombreTarifa: 'General' },
      articulos: articulos || [],
      debugDb,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    res.status(500).render('error', { error: 'Error', message: error.message });
  }
});

// Guardar precios (bulk) para artículos de una tarifa
router.post('/:id/precios', async (req, res) => {
  try {
    const tarifaId = Number(req.params.id);
    // En algunos despliegues (o con muchos inputs) el parser puede no construir el objeto anidado `precios`.
    // Soportar ambos formatos:
    // - precios: { [articuloId]: "12.34" }
    // - keys planas: "precios[123]": "12.34"
    let precios = req.body?.precios;
    let skus = req.body?.skus;
    if (!precios || typeof precios !== 'object') {
      precios = {};
      const body = req.body || {};
      for (const [k, v] of Object.entries(body)) {
        const m = /^precios\[(\d+)\]$/.exec(String(k));
        if (m) {
          precios[m[1]] = v;
        }
      }
    }
    if (!skus || typeof skus !== 'object') {
      skus = {};
      const body = req.body || {};
      for (const [k, v] of Object.entries(body)) {
        const m = /^skus\[(\d+)\]$/.exec(String(k));
        if (m) {
          skus[m[1]] = v;
        }
      }
    }

    // Normalizar entradas
    const entries = Object.entries(precios || {});
    if (!Number.isFinite(tarifaId) || tarifaId < 0) {
      return res.redirect('/dashboard/ajustes/tarifas-clientes?error=' + encodeURIComponent('ID de tarifa inválido'));
    }

    // Logging de diagnóstico (útil en Vercel)
    console.log('💾 [TARIFAS] Guardando precios:', {
      tarifaId,
      bodyKeys: Object.keys(req.body || {}).slice(0, 30),
      preciosType: typeof (req.body && req.body.precios),
      entries: entries.length
    });

    let totalRecibidos = entries.length;
    let totalProcesados = 0;
    let totalSaltados = 0;
    let totalSinCambios = 0;
    let totalInsertados = 0;
    let totalActualizados = 0;
    let totalRemapeados = 0;

    // 1) Limpiar/validar entradas y preparar IDs
    const preciosLimpios = [];
    for (const [articuloIdStr, precioStr] of entries) {
      const articuloId = Number(articuloIdStr);
      if (!Number.isFinite(articuloId) || articuloId <= 0) { totalSaltados++; continue; }
      const sku = String((skus && skus[articuloIdStr]) ?? '').trim();
      const raw = String(precioStr ?? '').trim();
      // Vacío => significa "sin override" (no insertar) o "borrar override" si existía
      if (raw === '') {
        preciosLimpios.push({ articuloId, sku, precio: null, precioCents: null, empty: true, resolvedArticuloId: articuloId });
        continue;
      }
      const precio = Number(raw.replace(',', '.'));
      if (!Number.isFinite(precio) || precio < 0) { totalSaltados++; continue; }
      // Comparación robusta a céntimos
      const precioCents = Math.round(precio * 100);
      preciosLimpios.push({ articuloId, sku, precio, precioCents, empty: false, resolvedArticuloId: articuloId });
    }

    totalProcesados = preciosLimpios.length;

    // 2) Resolver/validar Id_Articulo usando SKU (código nacional) para evitar desajustes por IDs
    // Si SKU existe en la tabla articulos y podemos resolverlo, preferimos ese ID.
    const colsArt = await getArticulosColumns().catch(() => new Set());
    const hasIdLower = colsArt.has('id');
    const hasIdUpper = colsArt.has('Id');
    const hasSkuCol = colsArt.has('SKU') || colsArt.has('sku');

    if (hasSkuCol) {
      const idsForm = Array.from(new Set(preciosLimpios.map(p => p.articuloId))).filter(Number.isFinite);
      const skusForm = Array.from(new Set(preciosLimpios.map(p => p.sku).filter(Boolean)));

      const clauses = [];
      const paramsMap = [];

      if (idsForm.length > 0 && (hasIdLower || hasIdUpper)) {
        const phIds = idsForm.map(() => '?').join(', ');
        if (hasIdLower) {
          clauses.push(`id IN (${phIds})`);
          paramsMap.push(...idsForm);
        }
        if (hasIdUpper) {
          clauses.push(`Id IN (${phIds})`);
          paramsMap.push(...idsForm);
        }
      }

      if (skusForm.length > 0) {
        const phSku = skusForm.map(() => '?').join(', ');
        clauses.push(`SKU IN (${phSku})`);
        paramsMap.push(...skusForm);
      }

      if (clauses.length > 0) {
        const rowsArt = await crm.query(
          `SELECT ${hasIdLower ? 'id' : 'NULL AS id'}, ${hasIdUpper ? 'Id' : 'NULL AS Id'}, SKU
           FROM articulos
           WHERE ${clauses.join(' OR ')}`,
          paramsMap
        );

        const existingArticuloIds = new Set();
        const skuToId = new Map();
        const anyIdToId = new Map();
        for (const r of rowsArt || []) {
          const resolvedId = Number(r.id ?? r.Id);
          if (!Number.isFinite(resolvedId)) continue;
          existingArticuloIds.add(resolvedId);
          const skuVal = String(r.SKU || '').trim();
          if (skuVal) skuToId.set(skuVal, resolvedId);
          const idLower = Number(r.id);
          const idUpper = Number(r.Id);
          if (Number.isFinite(idLower)) anyIdToId.set(idLower, resolvedId);
          if (Number.isFinite(idUpper)) anyIdToId.set(idUpper, resolvedId);
        }

        for (const p of preciosLimpios) {
          const before = p.resolvedArticuloId;
          if (p.sku && skuToId.has(p.sku)) {
            p.resolvedArticuloId = skuToId.get(p.sku);
          } else if (anyIdToId.has(p.articuloId)) {
            p.resolvedArticuloId = anyIdToId.get(p.articuloId);
          }
          if (Number(before) !== Number(p.resolvedArticuloId)) {
            totalRemapeados++;
          }
          // Marcar si el ID final existe realmente en articulos (para evitar fallo FK)
          p._existsInArticulos = existingArticuloIds.has(Number(p.resolvedArticuloId));
        }
      }
    }

    // 3) Cargar precios existentes para comparar y evitar updates innecesarios
    const existentesCents = new Map(); // Id_Articulo -> cents
    const ids = Array.from(new Set(preciosLimpios.map(p => Number(p.resolvedArticuloId)))).filter(Number.isFinite);
    const chunkSize = 500;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = await crm.query(
        `SELECT Id_Articulo, Precio
         FROM tarifasClientes_precios
         WHERE Id_Tarifa = ?
           AND Id_Articulo IN (${placeholders})`,
        [tarifaId, ...chunk]
      );
      for (const r of rows || []) {
        const idA = Number(r.Id_Articulo);
        const cents = Math.round(Number(r.Precio || 0) * 100);
        if (Number.isFinite(idA)) existentesCents.set(idA, Number.isFinite(cents) ? cents : 0);
      }
    }

    // 4) Insertar/actualizar solo cambios (usando resolvedArticuloId)
    const fallos = [];
    for (const item of preciosLimpios) {
      const articuloId = Number(item.resolvedArticuloId);
      if (item._existsInArticulos === false) {
        totalSaltados++;
        fallos.push({ articuloId, sku: item.sku || null, error: 'Artículo no existe en articulos (ID no encontrado)' });
        continue;
      }
      const existente = existentesCents.has(articuloId) ? existentesCents.get(articuloId) : null;
      // Si viene vacío:
      // - Para tarifa 0 (General) NO se borra (es la base).
      // - Para tarifa != 0, si existía override -> borrar, si no existía -> sin cambios.
      if (item.empty) {
        if (tarifaId === 0) {
          totalSaltados++;
          continue;
        }
        if (existente === null) {
          totalSinCambios++;
          continue;
        }
        try {
          await crm.query(
            'DELETE FROM tarifasClientes_precios WHERE Id_Tarifa = ? AND Id_Articulo = ?',
            [tarifaId, articuloId]
          );
          totalActualizados++; // cuenta como cambio (se elimina override)
        } catch (e) {
          fallos.push({ articuloId, sku: item.sku || null, error: e.message });
        }
        continue;
      }

      if (existente !== null && existente === item.precioCents) {
        totalSinCambios++;
        continue;
      }

      try {
        if (existente === null) {
          await crm.query(
            'INSERT INTO tarifasClientes_precios (Id_Tarifa, Id_Articulo, Precio) VALUES (?, ?, ?)',
            [tarifaId, articuloId, item.precio]
          );
          totalInsertados++;
        } else {
          await crm.query(
            'UPDATE tarifasClientes_precios SET Precio = ? WHERE Id_Tarifa = ? AND Id_Articulo = ?',
            [item.precio, tarifaId, articuloId]
          );
          totalActualizados++;
        }
      } catch (e) {
        fallos.push({ articuloId, sku: item.sku || null, error: e.message });
      }
    }

    const marcaId = req.body?.marcaId ? String(req.body.marcaId) : '';
    const refTarifaId = req.body?.refTarifaId !== undefined ? String(req.body.refTarifaId) : '';
    const qs = [];
    if (marcaId) qs.push(`marcaId=${encodeURIComponent(marcaId)}`);
    if (refTarifaId) qs.push(`refTarifaId=${encodeURIComponent(refTarifaId)}`);
    const redirect = `/dashboard/ajustes/tarifas-clientes/${tarifaId}/precios` + (qs.length > 0 ? `?${qs.join('&')}` : '');

    if (totalProcesados === 0) {
      return res.redirect(redirect + (marcaId ? '&' : '?') + 'error=' + encodeURIComponent('No se recibió ningún precio válido para guardar (posible problema de envío/formato). Añade &debug=1 a la URL para ver la BD activa.'));
    }

    if (fallos.length > 0) {
      const ejemplo = fallos.slice(0, 3).map(f => `Id_Articulo=${f.articuloId}${f.sku ? ` SKU=${f.sku}` : ''} (${f.error})`).join(' | ');
      return res.redirect(
        redirect +
        (marcaId ? '&' : '?') +
        'error=' +
        encodeURIComponent(
          `Guardado parcial. Insertados: ${totalInsertados}, Actualizados: ${totalActualizados}, Sin cambios: ${totalSinCambios}, Omitidos: ${totalSaltados}. ` +
          `Fallos: ${fallos.length}. Ejemplos: ${ejemplo}. ` +
          `Comprueba que esos Id_Articulo existen en articulos (SELECT * FROM articulos WHERE id IN (...)).`
        )
      );
    }

    // Mensaje de éxito más limpio
    const cambios = totalInsertados + totalActualizados;
    const successMsg = cambios === 0
      ? `Sin cambios: no había precios modificados. (Omitidos: ${totalSaltados})`
      : `Precios guardados. Cambios: ${cambios} (Nuevos: ${totalInsertados}, Actualizados: ${totalActualizados}). Sin cambios: ${totalSinCambios}. Omitidos: ${totalSaltados}.` + (totalRemapeados > 0 ? ` Remapeados por SKU: ${totalRemapeados}.` : '');

    return res.redirect(
      redirect +
      (marcaId ? '&' : '?') +
      'success=' +
      encodeURIComponent(successMsg)
    );
  } catch (error) {
    console.error('❌ [TARIFAS] Error guardando precios:', {
      message: error.message,
      stack: error.stack
    });
    res.redirect(`/dashboard/ajustes/tarifas-clientes/${req.params.id}/precios?error=` + encodeURIComponent('Error guardando precios: ' + error.message));
  }
});

module.exports = router;

