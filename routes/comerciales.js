/**
 * Rutas de comerciales (dashboard + API) — extraídas del monolito (Fase 3).
 * @param {object} deps dependencias inyectadas desde server-crm-completo.js
 */
const express = require('express');

function createComercialesRoutes(deps) {
  const router = express.Router();
  const {
    crm,
    normalizeUTF8,
    normalizeObjectUTF8
  } = deps;

  // GET /dashboard/comerciales
  router.get('/', async (req, res) => {
    try {
      const comerciales = await crm.getComerciales();

      const provincias = await crm.getProvincias('ES').catch(() => []);
      const provinciasMap = new Map();
      provincias.forEach(p => {
        const id = p.id || p.Id;
        if (id) {
          provinciasMap.set(parseInt(id), p.Nombre || '');
        }
      });

      console.log(`✅ [COMERCIALES] Mapa de provincias creado con ${provinciasMap.size} entradas`);

      const comercialesArray = Array.isArray(comerciales) ? comerciales : [];
      const comercialesConProvincia = comercialesArray.map(comercial => {
        const provinciaIdRaw = comercial.Id_Provincia || comercial.id_Provincia;
        const comercialNormalizado = normalizeObjectUTF8(comercial);
        const provinciaId = provinciaIdRaw || comercialNormalizado.Id_Provincia || comercialNormalizado.id_Provincia;

        comercialNormalizado.nombreProvincia = '';

        if (provinciaId !== null && provinciaId !== undefined && provinciaId !== '') {
          const provinciaIdInt = parseInt(provinciaId);
          if (!isNaN(provinciaIdInt) && provinciaIdInt > 0) {
            const nombreProvincia = provinciasMap.get(provinciaIdInt);
            if (nombreProvincia) {
              comercialNormalizado.nombreProvincia = normalizeUTF8(nombreProvincia);
              console.log(`✅ [COMERCIALES] ${comercialNormalizado.Nombre || comercialNormalizado.nombre}: ${comercialNormalizado.nombreProvincia}`);
            } else {
              console.warn(`⚠️ [COMERCIALES] No se encontró provincia ID ${provinciaIdInt} para ${comercialNormalizado.Nombre || comercialNormalizado.nombre}`);
            }
          }
        } else {
          console.log(`ℹ️ [COMERCIALES] ${comercialNormalizado.Nombre || comercialNormalizado.nombre}: Sin Id_Provincia`);
        }

        return comercialNormalizado;
      });

      res.render('dashboard/comerciales', {
        title: 'Comerciales - Farmadescaso',
        user: req.comercial || req.session.comercial,
        comerciales: comercialesConProvincia,
        error: null,
        query: req.query
      });
    } catch (error) {
      console.error('Error cargando comerciales:', error);
      console.error('Stack:', error.stack);
      res.render('dashboard/comerciales', {
        title: 'Comerciales - Farmadescaso',
        user: req.comercial || req.session.comercial,
        comerciales: [],
        error: `Error cargando comerciales: ${error.message}`,
        query: req.query
      });
    }
  });

  // GET /dashboard/comerciales/nuevo
  router.get('/nuevo', async (req, res) => {
    const provincias = await crm.getProvincias('ES').catch(() => []);

    res.render('dashboard/comercial-editar', {
      title: 'Nuevo Comercial - Farmadescaso',
      user: req.comercial || req.session.comercial,
      comercial: null,
      provincias: provincias || [],
      error: null,
      isNew: true
    });
  });

  // GET /dashboard/comerciales/:id/editar
  router.get('/:id/editar', async (req, res) => {
    try {
      const comercial = await crm.getComercialById(req.params.id);
      if (!comercial) {
        return res.status(404).render('error', { error: 'Comercial no encontrado', message: 'El comercial no existe' });
      }

      const provincias = await crm.getProvincias('ES').catch(() => []);

      res.render('dashboard/comercial-editar', {
        title: `Comercial #${req.params.id} - Editar`,
        user: req.comercial || req.session.comercial,
        comercial: normalizeObjectUTF8(comercial),
        provincias: provincias || [],
        error: null,
        isNew: false,
        req: req
      });
    } catch (error) {
      console.error('Error cargando formulario de edición:', error);
      res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el formulario' });
    }
  });

  // GET /dashboard/comerciales/:id
  router.get('/:id', async (req, res) => {
    try {
      const comercial = await crm.getComercialById(req.params.id);
      if (!comercial) {
        return res.status(404).render('error', { error: 'Comercial no encontrado', message: 'El comercial no existe' });
      }

      let nombreProvincia = null;
      const provinciaIdRaw = comercial.Id_Provincia || comercial.id_Provincia;
      if (provinciaIdRaw) {
        try {
          const provinciaId = parseInt(provinciaIdRaw);
          if (!isNaN(provinciaId) && provinciaId > 0) {
            const provincia = await crm.getProvinciaById(provinciaId);
            if (provincia && provincia.Nombre) {
              nombreProvincia = provincia.Nombre;
            }
          }
        } catch (error) {
          console.warn('⚠️ Error obteniendo nombre de provincia:', error.message);
        }
      }

      const comercialNormalizado = normalizeObjectUTF8(comercial);

      res.render('dashboard/comercial-detalle', {
        title: `Comercial #${req.params.id} - Detalle`,
        user: req.comercial || req.session.comercial,
        comercial: comercialNormalizado,
        nombreProvincia: nombreProvincia ? normalizeUTF8(nombreProvincia) : '',
        error: null,
        query: req.query
      });
    } catch (error) {
      console.error('Error cargando detalle de comercial:', error);
      res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el comercial' });
    }
  });

  // POST /dashboard/comerciales
  router.post('/', async (req, res) => {
    try {
      const fijoMensualRaw = req.body.fijo_mensual ?? req.body.fijoMensual ?? req.body.FijoMensual ?? req.body.FIJO_MENSUAL;
      let fijo_mensual = 0;
      if (fijoMensualRaw !== undefined && fijoMensualRaw !== null && String(fijoMensualRaw).trim() !== '') {
        const n = Number(String(fijoMensualRaw).replace(',', '.'));
        fijo_mensual = Number.isFinite(n) ? n : 0;
      }
      const payload = {
        Nombre: req.body.Nombre,
        Email: req.body.Email,
        DNI: req.body.DNI || null,
        Password: req.body.Password || null,
        Roll: req.body.Roll || '["Comercial"]',
        Movil: req.body.Movil || null,
        Direccion: req.body.Direccion || null,
        CodigoPostal: req.body.CodigoPostal || null,
        Poblacion: req.body.Poblacion || null,
        Id_Provincia: req.body.Id_Provincia || null,
        fijo_mensual,
        plataforma_reunion_preferida: (req.body.plataforma_reunion_preferida !== undefined)
          ? (String(req.body.plataforma_reunion_preferida).trim() || 'meet')
          : 'meet'
      };

      if (payload.CodigoPostal && !payload.Id_Provincia) {
        try {
          const { obtenerProvinciaPorCodigoPostal } = require('../scripts/asociar-provincia-por-codigo-postal');
          const provincias = await crm.getProvincias('ES').catch(() => []);
          const provinciaId = obtenerProvinciaPorCodigoPostal(payload.CodigoPostal, provincias);
          if (provinciaId) {
            payload.Id_Provincia = provinciaId;
            console.log(`✅ [CREAR COMERCIAL] Provincia ${provinciaId} asignada automáticamente por CP ${payload.CodigoPostal}`);
          }
        } catch (error) {
          console.warn('⚠️ [CREAR COMERCIAL] Error estableciendo provincia automáticamente:', error.message);
        }
      }

      if (!payload.Nombre || !payload.Email) {
        const provincias = await crm.getProvincias('ES').catch(() => []);
        return res.render('dashboard/comercial-editar', {
          title: 'Nuevo Comercial - Farmadescaso',
          user: req.comercial || req.session.comercial,
          comercial: req.body,
          provincias: provincias || [],
          error: 'Nombre y Email son obligatorios',
          isNew: true
        });
      }

      if (!payload.Password && payload.DNI) {
        payload.Password = payload.DNI;
      }

      await crm.createComercial(payload);
      res.redirect(`/dashboard/comerciales?success=comercial_creado`);
    } catch (error) {
      console.error('Error creando comercial:', error);
      const provincias = await crm.getProvincias('ES').catch(() => []);

      res.render('dashboard/comercial-editar', {
        title: 'Nuevo Comercial - Farmadescaso',
        user: req.comercial || req.session.comercial,
        comercial: req.body,
        provincias: provincias || [],
        error: error.message || 'Error al crear el comercial',
        isNew: true
      });
    }
  });

  // POST /dashboard/comerciales/:id
  router.post('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const payload = {};

      if (req.body.Nombre) payload.Nombre = req.body.Nombre;
      if (req.body.Email) payload.Email = req.body.Email;
      if (req.body.DNI !== undefined) payload.DNI = req.body.DNI || null;
      if (req.body.Password) payload.Password = req.body.Password;
      if (req.body.Roll) payload.Roll = req.body.Roll;
      if (req.body.Movil !== undefined) payload.Movil = req.body.Movil || null;
      if (req.body.Direccion !== undefined) payload.Direccion = req.body.Direccion || null;
      if (req.body.CodigoPostal !== undefined) payload.CodigoPostal = req.body.CodigoPostal || null;
      if (req.body.Poblacion !== undefined) payload.Poblacion = req.body.Poblacion || null;
      if (req.body.Id_Provincia !== undefined) payload.Id_Provincia = req.body.Id_Provincia || null;

      if (req.body.fijo_mensual !== undefined || req.body.fijoMensual !== undefined || req.body.FijoMensual !== undefined || req.body.FIJO_MENSUAL !== undefined) {
        const fijoMensualRaw = req.body.fijo_mensual ?? req.body.fijoMensual ?? req.body.FijoMensual ?? req.body.FIJO_MENSUAL;
        let fijo_mensual = 0;
        if (fijoMensualRaw !== undefined && fijoMensualRaw !== null && String(fijoMensualRaw).trim() !== '') {
          const n = Number(String(fijoMensualRaw).replace(',', '.'));
          fijo_mensual = Number.isFinite(n) ? n : 0;
        }
        payload.fijo_mensual = fijo_mensual;
      }

      if (payload.CodigoPostal && !payload.Id_Provincia) {
        try {
          const { obtenerProvinciaPorCodigoPostal } = require('../scripts/asociar-provincia-por-codigo-postal');
          const provincias = await crm.getProvincias('ES').catch(() => []);
          const provinciaId = obtenerProvinciaPorCodigoPostal(payload.CodigoPostal, provincias);
          if (provinciaId) {
            payload.Id_Provincia = provinciaId;
            console.log(`✅ [ACTUALIZAR COMERCIAL] Provincia ${provinciaId} asignada automáticamente por CP ${payload.CodigoPostal}`);
          }
        } catch (error) {
          console.warn('⚠️ [ACTUALIZAR COMERCIAL] Error estableciendo provincia automáticamente:', error.message);
        }
      }

      if (req.body.meet_email !== undefined) payload.meet_email = String(req.body.meet_email).trim();
      if (req.body.teams_email !== undefined) payload.teams_email = String(req.body.teams_email).trim();
      if (req.body.plataforma_reunion_preferida !== undefined) payload.plataforma_reunion_preferida = String(req.body.plataforma_reunion_preferida).trim() || 'meet';

      await crm.updateComercial(id, payload);
      res.redirect(`/dashboard/comerciales?success=comercial_actualizado`);
    } catch (error) {
      console.error('Error actualizando comercial:', error);
      const comercial = await crm.getComercialById(req.params.id);
      const provincias = await crm.getProvincias('ES').catch(() => []);

      res.render('dashboard/comercial-editar', {
        title: `Comercial #${req.params.id} - Editar`,
        user: req.comercial || req.session.comercial,
        comercial: normalizeObjectUTF8(comercial || req.body),
        provincias: provincias || [],
        error: error.message || 'Error al actualizar el comercial',
        isNew: false
      });
    }
  });

  // POST /dashboard/comerciales/:id/eliminar
  router.post('/:id/eliminar', async (req, res) => {
    try {
      await crm.deleteComercial(req.params.id);
      res.redirect('/dashboard/comerciales?success=comercial_eliminado');
    } catch (error) {
      console.error('Error eliminando comercial:', error);
      res.redirect(`/dashboard/comerciales/${req.params.id}?error=error_eliminando`);
    }
  });

  return router;
}

/**
 * API GET /api/comerciales — requiere auth en el mount; nunca devolver passwords.
 */
function createComercialesApiRoutes(deps) {
  const router = express.Router();
  const { crm, sanitizeComercialForApi } = deps;

  router.get('/', async (req, res) => {
    try {
      const comerciales = await crm.getComerciales();
      const data = (comerciales || []).map(sanitizeComercialForApi);
      res.json({ success: true, data, count: data.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = createComercialesRoutes;
module.exports.createComercialesApiRoutes = createComercialesApiRoutes;
