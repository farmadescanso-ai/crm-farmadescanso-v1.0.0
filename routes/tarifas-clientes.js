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
    const marcaId = req.query.marcaId ? Number(req.query.marcaId) : null;
    const marcaNombre = req.query.marcaNombre ? String(req.query.marcaNombre) : null;

    let sql = `
      SELECT
        a.*,
        tp.Precio AS PrecioTarifa,
        tg.Precio AS PrecioGeneral
      FROM articulos a
      LEFT JOIN tarifasClientes_precios tp
        ON tp.Id_Tarifa = ?
       AND (tp.Id_Articulo = a.Id OR tp.Id_Articulo = a.id)
      LEFT JOIN tarifasClientes_precios tg
        ON tg.Id_Tarifa = 0
       AND (tg.Id_Articulo = a.Id OR tg.Id_Articulo = a.id)
      WHERE 1=1
    `;
    const params = [tarifaId];

    if (marcaId && Number.isFinite(marcaId)) {
      sql += ' AND (a.Id_Marca = ? OR a.id_marca = ?)';
      params.push(marcaId, marcaId);
    } else if (marcaNombre) {
      sql += ' AND (a.Marca = ?)';
      params.push(marcaNombre);
    }

    sql += ' ORDER BY a.Marca ASC, a.Nombre ASC';

    const articulos = await crm.query(sql, params);

    res.render('dashboard/ajustes-tarifa-cliente-precios', {
      title: `Precios Tarifa - ${tarifa.NombreTarifa} - Farmadescanso`,
      user,
      esAdmin: true,
      tarifa,
      marcas,
      marcaId: marcaId || '',
      marcaNombre: marcaNombre || '',
      articulos: articulos || [],
      error: null,
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
    const precios = req.body?.precios || {};

    // precios = { [articuloId]: "12.34", ... }
    const entries = Object.entries(precios);
    for (const [articuloIdStr, precioStr] of entries) {
      const articuloId = Number(articuloIdStr);
      if (!Number.isFinite(articuloId)) continue;
      const precio = Number(String(precioStr).replace(',', '.'));
      if (!Number.isFinite(precio) || precio < 0) continue;

      await crm.query(
        `INSERT INTO tarifasClientes_precios (Id_Tarifa, Id_Articulo, Precio)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE Precio = VALUES(Precio)`,
        [tarifaId, articuloId, precio]
      );
    }

    const marcaId = req.body?.marcaId ? String(req.body.marcaId) : '';
    const redirect = `/dashboard/ajustes/tarifas-clientes/${tarifaId}/precios` + (marcaId ? `?marcaId=${encodeURIComponent(marcaId)}` : '');
    res.redirect(redirect + (marcaId ? '&' : '?') + 'success=' + encodeURIComponent('Precios guardados correctamente'));
  } catch (error) {
    res.redirect(`/dashboard/ajustes/tarifas-clientes/${req.params.id}/precios?error=` + encodeURIComponent('Error guardando precios: ' + error.message));
  }
});

module.exports = router;

