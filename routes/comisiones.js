// Rutas para el sistema de comisiones
const express = require('express');
const router = express.Router();
const crm = require('../config/mysql-crm');
const comisionesCRM = require('../config/mysql-crm-comisiones');
const calculadorComisiones = require('../utils/calcular-comisiones');

// Middleware de autenticación (se aplicará desde server-crm-completo.js)
// const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * =====================================================
 * PRESUPUESTOS
 * =====================================================
 */

// Listar presupuestos
router.get('/presupuestos', async (req, res) => {
  try {
    // Obtener el ID del comercial autenticado
    const comercialIdAutenticado = req.comercialId || req.session?.comercialId;
    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador')) ||
                    (req.comercial || req.session?.comercial) && 
                    (String((req.comercial || req.session?.comercial).roll || (req.comercial || req.session?.comercial).Roll || '').toLowerCase().includes('administrador'));
    
    // Helper para parsear números de forma segura
    const parseSafeInt = (value) => {
      if (!value || value === '') return null;
      const parsed = parseInt(value);
      return isNaN(parsed) ? null : parsed;
    };

    const filters = {
      comercial_id: parseSafeInt(req.query.comercial_id),
      articulo_id: parseSafeInt(req.query.articulo_id),
      año: parseSafeInt(req.query.año) || new Date().getFullYear(),
      mes: req.query.mes !== undefined && req.query.mes !== '' ? parseInt(req.query.mes) : undefined,
      activo: req.query.activo !== undefined && req.query.activo !== '' ? req.query.activo === 'true' : undefined
    };
    
    // Si no es admin, forzar el filtro por el comercial autenticado
    if (!esAdmin && comercialIdAutenticado) {
      filters.comercial_id = comercialIdAutenticado;
    }

    const presupuestos = await comisionesCRM.getPresupuestos(filters);
    
    // Solo devolver JSON si se solicita explícitamente
    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true, data: presupuestos });
    }

    // Si es petición HTML, renderizar vista
    const comerciales = await crm.getComerciales();
    const articulos = await crm.getArticulos();
    
    // esAdmin ya está declarado arriba en la línea 22
    res.render('dashboard/comisiones/presupuestos', {
      title: 'Presupuestos - Farmadescaso',
      user: req.comercial || req.session.comercial,
      presupuestos: presupuestos,
      comerciales: comerciales,
      articulos: articulos,
      filters: filters,
      esAdmin: esAdmin,
      currentPage: 'presupuestos',
      req: req
    });
  } catch (error) {
    console.error('❌ Error obteniendo presupuestos:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(500).render('error', { error: 'Error obteniendo presupuestos', message: error.message });
  }
});

// Crear presupuesto
router.post('/presupuestos', async (req, res) => {
  // Asegurar que siempre respondamos, incluso si hay un error no capturado
  let responded = false;
  
  const safeRespond = (status, data) => {
    if (!responded) {
      responded = true;
      try {
        if (status === 302 || status === 301) {
          return res.redirect(data);
        } else {
          return res.status(status).json(data);
        }
      } catch (respondError) {
        console.error('❌ [PRESUPUESTO] Error en safeRespond:', respondError);
        if (!res.headersSent) {
          try {
            res.status(500).json({ success: false, error: 'Error al procesar la respuesta' });
          } catch (e) {
            console.error('❌ [PRESUPUESTO] No se pudo responder:', e);
          }
        }
      }
    }
  };
  
  try {
    console.log('\n========================================');
    console.log('📥 [PRESUPUESTO] POST recibido en /presupuestos');
    console.log('========================================');
    
    // Intentar loggear req.body de forma segura
    try {
      console.log('📥 [PRESUPUESTO] Body RAW:', req.body);
      console.log('📥 [PRESUPUESTO] Body tipo:', typeof req.body);
      console.log('📥 [PRESUPUESTO] Body keys:', req.body ? Object.keys(req.body) : 'null/undefined');
      console.log('📥 [PRESUPUESTO] Body JSON:', JSON.stringify(req.body, null, 2));
    } catch (logError) {
      console.error('❌ [PRESUPUESTO] Error al loggear req.body:', logError.message);
      console.log('📥 [PRESUPUESTO] req.body existe:', !!req.body);
    }
    console.log('📥 [PRESUPUESTO] Headers Accept:', req.headers.accept);
    console.log('📥 [PRESUPUESTO] Content-Type:', req.headers['content-type']);
    console.log('📥 [PRESUPUESTO] comercial_id RAW:', req.body?.comercial_id, 'tipo:', typeof req.body?.comercial_id);
    console.log('📥 [PRESUPUESTO] articulo_id RAW:', req.body?.articulo_id, 'tipo:', typeof req.body?.articulo_id);
    
    // Verificar que req.body existe y tiene datos
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ [PRESUPUESTO] req.body está vacío o no existe');
      console.error('❌ [PRESUPUESTO] Content-Type recibido:', req.headers['content-type']);
      console.error('❌ [PRESUPUESTO] Body-parser puede no estar parseando correctamente el JSON');
      return safeRespond(302, `/dashboard/comisiones/presupuestos?error=${encodeURIComponent('Error: No se recibieron datos del formulario. Por favor, intenta nuevamente.')}`);
    }
    
    // Verificar que los campos requeridos existen
    if (!req.body.comercial_id || !req.body.articulo_id || !req.body.año) {
      console.error('❌ [PRESUPUESTO] Faltan campos requeridos');
      console.error('❌ [PRESUPUESTO] comercial_id:', req.body.comercial_id);
      console.error('❌ [PRESUPUESTO] articulo_id:', req.body.articulo_id);
      console.error('❌ [PRESUPUESTO] año:', req.body.año);
      return safeRespond(302, `/dashboard/comisiones/presupuestos?error=${encodeURIComponent('Error: Faltan datos requeridos (comercial, artículo o año).')}`);
    }
    // Parsear valores numéricos de forma segura
    let cantidadPresupuestada = 0;
    let importePresupuestado = 0;
    
    try {
      cantidadPresupuestada = parseFloat(req.body.cantidad_presupuestada || 0);
      if (isNaN(cantidadPresupuestada)) cantidadPresupuestada = 0;
    } catch (e) {
      console.error('⚠️ [PRESUPUESTO] Error al parsear cantidad_presupuestada:', e.message);
      cantidadPresupuestada = 0;
    }
    
    try {
      importePresupuestado = parseFloat(req.body.importe_presupuestado || 0);
      if (isNaN(importePresupuestado)) importePresupuestado = 0;
    } catch (e) {
      console.error('⚠️ [PRESUPUESTO] Error al parsear importe_presupuestado:', e.message);
      importePresupuestado = 0;
    }

    // Si el importe no viene o es 0, calcularlo automáticamente: cantidad × PVL
    if (!importePresupuestado || importePresupuestado === 0) {
      try {
        const articuloId = parseInt(req.body.articulo_id);
        if (articuloId) {
          const articulo = await crm.getArticuloById(articuloId);
          if (articulo && articulo.PVL) {
            const pvl = parseFloat(articulo.PVL || articulo.Pvl || articulo.pvl || 0);
            importePresupuestado = cantidadPresupuestada * pvl;
            console.log(`💰 [PRESUPUESTO] Calculado automáticamente: ${cantidadPresupuestada} × ${pvl} = ${importePresupuestado}`);
          }
        }
      } catch (calcError) {
        console.error('⚠️ [PRESUPUESTO] Error al calcular importe automáticamente:', calcError.message);
        // Continuar con el importe que viene del formulario
      }
    }

    // Parsear IDs con validación explícita
    const comercialIdRaw = req.body.comercial_id;
    const articuloIdRaw = req.body.articulo_id;
    
    console.log('📥 [PRESUPUESTO] Parseando IDs...');
    console.log('   comercial_id RAW:', comercialIdRaw, 'tipo:', typeof comercialIdRaw);
    console.log('   articulo_id RAW:', articuloIdRaw, 'tipo:', typeof articuloIdRaw);
    
    const comercialId = parseInt(comercialIdRaw);
    const articuloId = parseInt(articuloIdRaw);
    
    console.log('   comercial_id parseado:', comercialId, 'tipo:', typeof comercialId, 'es válido:', !isNaN(comercialId) && comercialId > 0);
    console.log('   articulo_id parseado:', articuloId, 'tipo:', typeof articuloId, 'es válido:', !isNaN(articuloId) && articuloId > 0);
    
    // Validar que comercial_id existe
    if (!comercialIdRaw || comercialIdRaw === '' || isNaN(comercialId) || comercialId <= 0) {
      console.error('❌ [PRESUPUESTO] comercial_id inválido:', comercialIdRaw, '->', comercialId);
      throw new Error(`El ID del comercial es inválido: "${comercialIdRaw}" (parseado: ${comercialId})`);
    }
    
    // Validar que articulo_id existe
    if (!articuloIdRaw || articuloIdRaw === '' || isNaN(articuloId) || articuloId <= 0) {
      console.error('❌ [PRESUPUESTO] articulo_id inválido:', articuloIdRaw, '->', articuloId);
      throw new Error(`El ID del artículo es inválido: "${articuloIdRaw}" (parseado: ${articuloId})`);
    }
    
    // Verificar que el comercial existe en la base de datos - consulta directa
    console.log('🔍 [PRESUPUESTO] Verificando que el comercial existe...');
    console.log(`🔍 [PRESUPUESTO] Buscando comercial con ID: ${comercialId} (tipo: ${typeof comercialId})`);
    
    let comercialDirecto;
    try {
      // Consulta directa a la base de datos para verificar existencia
      comercialDirecto = await crm.getComercialById(comercialId);
    } catch (dbError) {
      console.error('❌ [PRESUPUESTO] Error al consultar comercial:', dbError.message);
      throw new Error(`Error al verificar el comercial: ${dbError.message}`);
    }
    
    if (!comercialDirecto) {
      // Si no existe, obtener lista de comerciales disponibles para el mensaje de error
      try {
        const comerciales = await crm.getComerciales();
        const idsDisponibles = comerciales.map(c => c.id || c.Id || c.ID).filter(id => id != null);
        console.error(`❌ [PRESUPUESTO] Comercial con ID ${comercialId} no existe en la base de datos`);
        console.error(`❌ [PRESUPUESTO] IDs de comerciales disponibles:`, idsDisponibles.join(', '));
        throw new Error(`El comercial con ID ${comercialId} no existe en la base de datos. IDs disponibles: ${idsDisponibles.join(', ')}`);
      } catch (listError) {
        console.error('❌ [PRESUPUESTO] Error al obtener lista de comerciales:', listError.message);
        throw new Error(`El comercial con ID ${comercialId} no existe en la base de datos.`);
      }
    }
    
    console.log(`✅ [PRESUPUESTO] Comercial con ID ${comercialId} encontrado:`, comercialDirecto.Nombre || comercialDirecto.nombre || 'Sin nombre');
    
    // Verificar que el artículo existe en la base de datos - consulta directa
    console.log('🔍 [PRESUPUESTO] Verificando que el artículo existe...');
    console.log(`🔍 [PRESUPUESTO] Buscando artículo con ID: ${articuloId} (tipo: ${typeof articuloId})`);
    
    let articuloDirecto;
    try {
      // Consulta directa a la base de datos para verificar existencia
      articuloDirecto = await crm.getArticuloById(articuloId);
    } catch (dbError) {
      console.error('❌ [PRESUPUESTO] Error al consultar artículo:', dbError.message);
      throw new Error(`Error al verificar el artículo: ${dbError.message}`);
    }
    
    if (!articuloDirecto) {
      console.error(`❌ [PRESUPUESTO] Artículo con ID ${articuloId} no existe en la base de datos`);
      throw new Error(`El artículo con ID ${articuloId} no existe en la base de datos. Por favor, selecciona un artículo válido.`);
    }
    
    console.log(`✅ [PRESUPUESTO] Artículo con ID ${articuloId} encontrado:`, articuloDirecto.Nombre || articuloDirecto.nombre || 'Sin nombre');
    
    console.log('✅ [PRESUPUESTO] Validaciones pasadas, comercial y artículo existen');

    const presupuestoData = {
      comercial_id: comercialId,
      articulo_id: articuloId,
      año: parseInt(req.body.año) || new Date().getFullYear(),
      mes: req.body.mes !== undefined && req.body.mes !== '' ? parseInt(req.body.mes) : null,
      cantidad_presupuestada: cantidadPresupuestada,
      importe_presupuestado: importePresupuestado,
      porcentaje_comision: parseFloat(req.body.porcentaje_comision || 0),
      activo: req.body.activo !== undefined ? req.body.activo === 'true' : true,
      observaciones: req.body.observaciones || null,
      creado_por: req.comercialId || req.session.comercialId
    };

    // PRIMERO: Guardar el presupuesto en la base de datos
    console.log('💾 [PRESUPUESTO] Guardando presupuesto en BD...');
    console.log('💾 [PRESUPUESTO] Datos a guardar:', JSON.stringify(presupuestoData, null, 2));
    console.log('💾 [PRESUPUESTO] Tipos de datos:', {
      comercial_id: typeof presupuestoData.comercial_id,
      articulo_id: typeof presupuestoData.articulo_id,
      año: typeof presupuestoData.año
    });
    
    let presupuesto;
    try {
      console.log('💾 [PRESUPUESTO] Llamando a createPresupuesto...');
      presupuesto = await comisionesCRM.createPresupuesto(presupuestoData);
      console.log('💾 [PRESUPUESTO] createPresupuesto completado, resultado:', presupuesto ? `ID: ${presupuesto.id}, actualizado: ${presupuesto.actualizado}` : 'null');
    } catch (dbError) {
      // Si hay error en la base de datos, lanzarlo para que se capture en el catch general
      console.error('❌ [PRESUPUESTO] Error en createPresupuesto:', dbError);
      console.error('❌ [PRESUPUESTO] Error message:', dbError.message);
      console.error('❌ [PRESUPUESTO] Error stack:', dbError.stack);
      throw dbError;
    }
    
    // Verificar que el presupuesto se guardó correctamente
    if (!presupuesto || !presupuesto.id) {
      console.error('❌ [PRESUPUESTO] No se recibió ID del presupuesto guardado');
      throw new Error('No se pudo guardar el presupuesto. No se recibió ID del presupuesto guardado.');
    }
    
    console.log(`✅ [PRESUPUESTO] Presupuesto guardado correctamente en BD con ID: ${presupuesto.id}`);
    
    // DESPUÉS: Redirigir con mensaje de éxito
    const successMessage = 'presupuesto_creado';
    const mensajeDetalle = `Presupuesto creado exitosamente (ID: ${presupuesto.id})`;
    
    console.log(`✅ [PRESUPUESTO] ${mensajeDetalle}`);
    console.log(`✅ [PRESUPUESTO] Redirigiendo con mensaje: ${successMessage}`);
    
    // Usar res.redirect() que maneja correctamente las redirecciones HTTP
    // Esto debería funcionar incluso si la petición acepta JSON
    return safeRespond(302, `/dashboard/comisiones/presupuestos?success=${successMessage}`);
  } catch (error) {
    // Asegurar que siempre respondamos, incluso en caso de error
    if (responded) {
      console.error('❌ [PRESUPUESTO] Error después de responder:', error);
      return;
    }
    console.error('❌ Error creando presupuesto:', error);
    console.error('❌ Stack:', error.stack);
    
    // Capturar información detallada del error
    let errorMessage = 'Error al grabar el presupuesto';
    let errorDetails = '';
    
    if (error.originalError) {
      const originalError = error.originalError;
      console.error('❌ Error original:', originalError);
      console.error('❌ Error Info:', error.errorInfo);
      
      // Si es un error de foreign key constraint, dar un mensaje más claro
      if (originalError.message && originalError.message.includes('foreign key constraint fails')) {
        if (originalError.message.includes('comercial_id')) {
          errorMessage = 'Error al grabar el presupuesto: El comercial seleccionado no existe en la base de datos';
          errorDetails = `Comercial ID: ${req.body.comercial_id || 'No proporcionado'}`;
        } else if (originalError.message.includes('articulo_id')) {
          errorMessage = 'Error al grabar el presupuesto: El artículo seleccionado no existe en la base de datos';
          errorDetails = `Artículo ID: ${req.body.articulo_id || 'No proporcionado'}`;
        } else {
          errorMessage = 'Error al grabar el presupuesto: Error de integridad de datos';
          errorDetails = 'Uno de los valores seleccionados no existe en la base de datos';
        }
      } else {
        errorMessage = `Error al grabar el presupuesto: ${originalError.message || error.message}`;
        if (error.errorInfo && error.errorInfo.sqlMessage) {
          errorDetails = `Detalles SQL: ${error.errorInfo.sqlMessage}`;
        }
      }
    } else if (error.message && error.message.includes('foreign key constraint fails')) {
      if (error.message.includes('comercial_id')) {
        errorMessage = 'Error al grabar el presupuesto: El comercial seleccionado no existe en la base de datos';
        errorDetails = `Comercial ID: ${req.body.comercial_id || 'No proporcionado'}`;
      } else if (error.message.includes('articulo_id')) {
        errorMessage = 'Error al grabar el presupuesto: El artículo seleccionado no existe en la base de datos';
        errorDetails = `Artículo ID: ${req.body.articulo_id || 'No proporcionado'}`;
      } else {
        errorMessage = `Error al grabar el presupuesto: ${error.message}`;
      }
    } else {
      errorMessage = `Error al grabar el presupuesto: ${error.message || 'Error desconocido'}`;
    }
    
    // Si el error es de duplicado, dar un mensaje más claro
    if (error.message && error.message.includes('Ya existe un presupuesto')) {
      errorMessage = 'Ya existe un presupuesto para este comercial, artículo y año. No se puede crear un duplicado.';
      errorDetails = error.message;
    }
    
    // Construir URL de redirección con el error
    let redirectUrl = `/dashboard/comisiones/presupuestos?error=${encodeURIComponent(errorMessage)}`;
    if (errorDetails) {
      redirectUrl += `&details=${encodeURIComponent(errorDetails)}`;
    }
    
    console.error('❌ Redirigiendo a:', redirectUrl);
    
    // Siempre redirigir con el error, no devolver JSON
    return safeRespond(302, redirectUrl);
  }
});

// Obtener presupuesto por ID (para edición)
router.get('/presupuestos/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const presupuesto = await comisionesCRM.getPresupuestoById(id);
    
    if (!presupuesto) {
      return res.status(404).json({ success: false, error: 'Presupuesto no encontrado' });
    }

    res.json({ success: true, data: presupuesto });
  } catch (error) {
    console.error('❌ Error obteniendo presupuesto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar presupuesto
router.put('/presupuestos/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const cantidadPresupuestada = req.body.cantidad_presupuestada !== undefined ? parseFloat(req.body.cantidad_presupuestada) : undefined;
    let importePresupuestado = req.body.importe_presupuestado !== undefined ? parseFloat(req.body.importe_presupuestado) : undefined;

    // Si se actualiza la cantidad o el artículo, recalcular el importe automáticamente
    if (cantidadPresupuestada !== undefined || req.body.articulo_id !== undefined) {
      const articuloId = req.body.articulo_id ? parseInt(req.body.articulo_id) : null;
      
      // Si no viene articulo_id, obtener el actual del presupuesto
      if (!articuloId) {
        const presupuestoActual = await comisionesCRM.getPresupuestoById(id);
        if (presupuestoActual && presupuestoActual.articulo_id) {
          const articulo = await crm.getArticuloById(presupuestoActual.articulo_id);
          if (articulo && articulo.PVL) {
            const pvl = parseFloat(articulo.PVL || articulo.Pvl || articulo.pvl || 0);
            const cantidad = cantidadPresupuestada !== undefined ? cantidadPresupuestada : (presupuestoActual.cantidad_presupuestada || 0);
            importePresupuestado = cantidad * pvl;
            console.log(`💰 [PRESUPUESTO UPDATE] Calculado automáticamente: ${cantidad} × ${pvl} = ${importePresupuestado}`);
          }
        }
      } else {
        // Si viene articulo_id, usar ese
        const articulo = await crm.getArticuloById(articuloId);
        if (articulo && articulo.PVL) {
          const pvl = parseFloat(articulo.PVL || articulo.Pvl || articulo.pvl || 0);
          const cantidad = cantidadPresupuestada !== undefined ? cantidadPresupuestada : 0;
          importePresupuestado = cantidad * pvl;
          console.log(`💰 [PRESUPUESTO UPDATE] Calculado automáticamente: ${cantidad} × ${pvl} = ${importePresupuestado}`);
        }
      }
    }

    const presupuestoData = {
      cantidad_presupuestada: cantidadPresupuestada,
      importe_presupuestado: importePresupuestado,
      porcentaje_comision: req.body.porcentaje_comision !== undefined ? parseFloat(req.body.porcentaje_comision) : undefined,
      activo: req.body.activo !== undefined ? (req.body.activo === 'true' || req.body.activo === true) : undefined,
      observaciones: req.body.observaciones !== undefined ? req.body.observaciones : undefined
    };

    // Si se actualiza el mes, también actualizarlo
    if (req.body.mes !== undefined) {
      presupuestoData.mes = req.body.mes !== '' ? parseInt(req.body.mes) : null;
    }

    // Si se actualiza el artículo, también actualizarlo
    if (req.body.articulo_id !== undefined) {
      presupuestoData.articulo_id = parseInt(req.body.articulo_id);
    }

    const presupuesto = await comisionesCRM.updatePresupuesto(id, presupuestoData);

    res.json({ success: true, data: presupuesto });
  } catch (error) {
    console.error('❌ Error actualizando presupuesto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eliminar presupuesto
router.delete('/presupuestos/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await comisionesCRM.deletePresupuesto(id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error eliminando presupuesto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * =====================================================
 * COMISIONES
 * =====================================================
 */

// Listar comisiones
router.get('/comisiones', async (req, res) => {
  try {
    // Si no es admin, solo puede ver sus propias comisiones
    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
    const comercialId = req.comercialId || req.session.comercialId;

    const filters = {
      comercial_id: esAdmin ? (req.query.comercial_id || null) : comercialId, // Si no es admin, forzar su ID
      mes: req.query.mes ? parseInt(req.query.mes) : null,
      año: req.query.año ? parseInt(req.query.año) : new Date().getFullYear(),
      estado: req.query.estado || null
    };

    const comisiones = await comisionesCRM.getComisiones(filters);
    const comerciales = await crm.getComerciales();

    // Solo devolver JSON si se solicita explícitamente (no acepta HTML)
    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true, data: comisiones });
    }

    res.render('dashboard/comisiones/comisiones', {
      title: 'Comisiones - Farmadescaso',
      user: req.comercial || req.session.comercial,
      comisiones: comisiones,
      comerciales: comerciales,
      filters: filters,
      esAdmin: esAdmin
    });
  } catch (error) {
    console.error('❌ Error obteniendo comisiones:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(500).render('error', { error: 'Error obteniendo comisiones', message: error.message });
  }
});

// Ver detalle de comisión
router.get('/comisiones/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const comision = await comisionesCRM.getComisionById(id);
    const detalle = await comisionesCRM.getComisionDetalle(id);

    if (!comision) {
      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(404).json({ success: false, error: 'Comisión no encontrada' });
      }
      return res.status(404).render('error', { error: 'Comisión no encontrada', message: 'La comisión solicitada no existe' });
    }

    // Solo devolver JSON si se solicita explícitamente (no acepta HTML)
    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true, data: { comision, detalle } });
    }

    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
    res.render('dashboard/comisiones/comision-detalle', {
      title: `Comisión ${comision.mes}/${comision.año} - Farmadescaso`,
      user: req.comercial || req.session.comercial,
      comision: comision,
      detalle: detalle,
      esAdmin: esAdmin
    });
  } catch (error) {
    console.error('❌ Error obteniendo comisión:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(500).render('error', { error: 'Error obteniendo comisión', message: error.message });
  }
});

// Calcular comisión mensual
router.post('/comisiones/calcular', async (req, res) => {
  try {
    const { comercial_id, mes, año } = req.body;
    
    if (!comercial_id || !mes || !año) {
      return res.status(400).json({ 
        success: false, 
        error: 'comercial_id, mes y año son requeridos' 
      });
    }

    const calculadoPor = req.comercialId || req.session.comercialId;
    const comision = await calculadorComisiones.calcularComisionMensual(
      parseInt(comercial_id),
      parseInt(mes),
      parseInt(año),
      calculadoPor
    );

    res.json({ success: true, data: comision });
  } catch (error) {
    console.error('❌ Error calculando comisión:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Marcar comisión como pagada
router.post('/comisiones/:id/pagar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const fechaPago = req.body.fecha_pago || new Date().toISOString().split('T')[0];
    const pagadoPor = req.comercialId || req.session.comercialId;

    await comisionesCRM.saveComision({
      id: id,
      estado: 'Pagada',
      fecha_pago: fechaPago,
      pagado_por: pagadoPor
    });

    res.json({ success: true, message: 'Comisión marcada como pagada' });
  } catch (error) {
    console.error('❌ Error marcando comisión como pagada:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * =====================================================
 * RAPELES
 * =====================================================
 */

// Listar rapeles
router.get('/rapeles', async (req, res) => {
  try {
    const filters = {
      comercial_id: req.query.comercial_id || null,
      marca: req.query.marca || null,
      trimestre: req.query.trimestre ? parseInt(req.query.trimestre) : null,
      año: req.query.año ? parseInt(req.query.año) : new Date().getFullYear(),
      estado: req.query.estado || null
    };

    const rapeles = await comisionesCRM.getRapeles(filters);
    const comerciales = await crm.getComerciales();

    // Obtener marcas únicas de artículos
    const articulos = await crm.getArticulos();
    const marcas = [...new Set(articulos.map(a => a.Marca || a.marca).filter(m => m))];

    // Solo devolver JSON si se solicita explícitamente (no acepta HTML)
    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true, data: rapeles });
    }

    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
    res.render('dashboard/comisiones/rapeles', {
      title: 'Rapeles - Farmadescaso',
      user: req.comercial || req.session.comercial,
      rapeles: rapeles,
      comerciales: comerciales,
      marcas: marcas,
      filters: filters,
      esAdmin: esAdmin,
      currentPage: 'rapeles',
      req: req
    });
  } catch (error) {
    console.error('❌ Error obteniendo rapeles:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(500).render('error', { error: 'Error obteniendo rapeles', message: error.message });
  }
});

// Calcular rapel por marca
router.post('/rapeles/calcular', async (req, res) => {
  try {
    const { comercial_id, marca, trimestre, año } = req.body;
    
    if (!comercial_id || !marca || !trimestre || !año) {
      return res.status(400).json({ 
        success: false, 
        error: 'comercial_id, marca, trimestre y año son requeridos' 
      });
    }

    const calculadoPor = req.comercialId || req.session.comercialId;
    const rapelData = await calculadorComisiones.calcularRapelMarca(
      parseInt(comercial_id),
      marca,
      parseInt(trimestre),
      parseInt(año)
    );

    const rapel = await comisionesCRM.saveRapel({
      comercial_id: parseInt(comercial_id),
      marca: marca,
      trimestre: parseInt(trimestre),
      año: parseInt(año),
      ventas_trimestre: rapelData.ventas_trimestre,
      objetivo_trimestre: rapelData.objetivo_trimestre,
      porcentaje_cumplimiento: rapelData.porcentaje_cumplimiento,
      porcentaje_rapel: rapelData.porcentaje_rapel,
      importe_rapel: rapelData.importe_rapel,
      estado: 'Calculado',
      calculado_por: calculadoPor
    });

    res.json({ success: true, data: rapel });
  } catch (error) {
    console.error('❌ Error calculando rapel:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Marcar rapel como pagado
router.post('/rapeles/:id/pagar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const fechaPago = req.body.fecha_pago || new Date().toISOString().split('T')[0];
    const pagadoPor = req.comercialId || req.session.comercialId;

    await comisionesCRM.saveRapel({
      id: id,
      estado: 'Pagado',
      fecha_pago: fechaPago,
      pagado_por: pagadoPor
    });

    res.json({ success: true, message: 'Rapel marcado como pagado' });
  } catch (error) {
    console.error('❌ Error marcando rapel como pagado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * =====================================================
 * OBJETIVOS POR MARCA
 * =====================================================
 */

// Listar objetivos por marca
router.get('/objetivos-marca', async (req, res) => {
  try {
    // Helper para parsear números de forma segura
    const parseSafeInt = (value) => {
      if (!value || value === '') return null;
      const parsed = parseInt(value);
      return isNaN(parsed) ? null : parsed;
    };

    const filters = {
      comercial_id: parseSafeInt(req.query.comercial_id),
      marca: req.query.marca && req.query.marca !== '' ? req.query.marca : null,
      trimestre: parseSafeInt(req.query.trimestre),
      año: parseSafeInt(req.query.año) || new Date().getFullYear()
    };

    const objetivos = await comisionesCRM.getObjetivosMarca(filters);
    const comerciales = await crm.getComerciales();
    const articulos = await crm.getArticulos();
    const marcas = [...new Set(articulos.map(a => a.Marca || a.marca).filter(m => m))];

    // Solo devolver JSON si se solicita explícitamente (no acepta HTML)
    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true, data: objetivos });
    }

    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
    res.render('dashboard/comisiones/objetivos-marca', {
      title: 'Objetivos por Marca - Farmadescaso',
      user: req.comercial || req.session.comercial,
      objetivos: objetivos,
      comerciales: comerciales,
      marcas: marcas,
      filters: filters,
      esAdmin: esAdmin,
      currentPage: 'objetivos-marca',
      req: req
    });
  } catch (error) {
    console.error('❌ Error obteniendo objetivos:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(500).render('error', { error: 'Error obteniendo objetivos', message: error.message });
  }
});

// Crear/actualizar objetivo por marca
router.post('/objetivos-marca', async (req, res) => {
  try {
    // Helper para parsear números de forma segura
    const parseSafeInt = (value) => {
      if (!value || value === '') return null;
      const parsed = parseInt(value);
      return isNaN(parsed) ? null : parsed;
    };

    const parseSafeFloat = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    };

    const comercial_id = parseSafeInt(req.body.comercial_id);
    const marca = req.body.marca && req.body.marca !== '' ? req.body.marca : null;
    const año = parseSafeInt(req.body.año) || new Date().getFullYear();
    const activo = req.body.activo !== undefined ? req.body.activo === 'true' : true;
    const observaciones = req.body.observaciones && req.body.observaciones !== '' ? req.body.observaciones : null;
    const creado_por = req.comercialId || req.session.comercialId;

    // Validar campos requeridos
    if (!comercial_id || !marca || !año) {
      return res.status(400).json({ 
        success: false, 
        error: 'comercial_id, marca y año son requeridos' 
      });
    }

    // Guardar objetivos trimestrales (4 registros, uno por trimestre)
    const trimestres = [
      { trimestre: 1, objetivo: parseSafeFloat(req.body.objetivo_trimestral_q1) },
      { trimestre: 2, objetivo: parseSafeFloat(req.body.objetivo_trimestral_q2) },
      { trimestre: 3, objetivo: parseSafeFloat(req.body.objetivo_trimestral_q3) },
      { trimestre: 4, objetivo: parseSafeFloat(req.body.objetivo_trimestral_q4) }
    ];

    const objetivosGuardados = [];
    for (const trimestreData of trimestres) {
      const objetivoData = {
        comercial_id: comercial_id,
        marca: marca,
        trimestre: trimestreData.trimestre,
        año: año,
        objetivo: trimestreData.objetivo,
        activo: activo,
        observaciones: observaciones
      };
      
      // Log para debugging
      console.log('📊 [OBJETIVOS-MARCA] Guardando objetivo:', objetivoData);
      
      const objetivo = await comisionesCRM.saveObjetivoMarca(objetivoData);
      objetivosGuardados.push(objetivo);
    }

    if (req.accepts('json')) {
      return res.json({ success: true, data: objetivosGuardados });
    }

    res.redirect(`/dashboard/comisiones/objetivos-marca?success=objetivo_guardado`);
  } catch (error) {
    console.error('❌ Error guardando objetivo:', error);
    console.error('❌ Stack:', error.stack);
    console.error('❌ Request body:', req.body);
    
    const errorMessage = error.message || 'Error desconocido al guardar objetivo';
    
    if (req.accepts('json')) {
      return res.status(500).json({ 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    res.redirect(`/dashboard/comisiones/objetivos-marca?error=${encodeURIComponent(errorMessage)}`);
  }
});

// Obtener objetivo por marca por ID (para edición)
router.get('/objetivos-marca/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const objetivo = await comisionesCRM.getObjetivoMarcaById(id);
    if (!objetivo) {
      return res.status(404).json({ success: false, error: 'Objetivo no encontrado' });
    }
    res.json({ success: true, data: objetivo });
  } catch (error) {
    console.error('❌ Error obteniendo objetivo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar objetivo por marca
router.put('/objetivos-marca/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const objetivoData = {
      id: id,
      comercial_id: req.body.comercial_id ? parseInt(req.body.comercial_id) : undefined,
      marca: req.body.marca !== undefined ? req.body.marca : undefined,
      año: req.body.año ? parseInt(req.body.año) : undefined,
      objetivo_anual: req.body.objetivo_anual !== undefined ? parseFloat(req.body.objetivo_anual) : undefined,
      objetivo_trimestral_q1: req.body.objetivo_trimestral_q1 !== undefined ? parseFloat(req.body.objetivo_trimestral_q1) : undefined,
      objetivo_trimestral_q2: req.body.objetivo_trimestral_q2 !== undefined ? parseFloat(req.body.objetivo_trimestral_q2) : undefined,
      objetivo_trimestral_q3: req.body.objetivo_trimestral_q3 !== undefined ? parseFloat(req.body.objetivo_trimestral_q3) : undefined,
      objetivo_trimestral_q4: req.body.objetivo_trimestral_q4 !== undefined ? parseFloat(req.body.objetivo_trimestral_q4) : undefined,
      activo: req.body.activo !== undefined ? (req.body.activo === 'true' || req.body.activo === true) : undefined,
      observaciones: req.body.observaciones !== undefined ? req.body.observaciones : undefined
    };
    const objetivo = await comisionesCRM.saveObjetivoMarca(objetivoData);
    res.json({ success: true, data: objetivo });
  } catch (error) {
    console.error('❌ Error actualizando objetivo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eliminar objetivo por marca
router.delete('/objetivos-marca/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await comisionesCRM.deleteObjetivoMarca(id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error eliminando objetivo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * =====================================================
 * CONDICIONES ESPECIALES
 * =====================================================
 */

// Listar condiciones especiales
router.get('/condiciones-especiales', async (req, res) => {
  try {
    const filters = {
      comercial_id: req.query.comercial_id !== undefined ? (req.query.comercial_id === 'null' ? null : parseInt(req.query.comercial_id)) : undefined,
      articulo_id: req.query.articulo_id !== undefined ? (req.query.articulo_id === 'null' ? null : parseInt(req.query.articulo_id)) : undefined,
      marca: req.query.marca || null,
      activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined
    };

    const condiciones = await comisionesCRM.getCondicionesEspeciales(filters);
    const comerciales = await crm.getComerciales();
    const articulos = await crm.getArticulos();

    // Solo devolver JSON si se solicita explícitamente (no acepta HTML)
    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true, data: condiciones });
    }

    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
    const marcas = [...new Set(articulos.map(a => a.Marca || a.marca).filter(m => m))];
    res.render('dashboard/comisiones/condiciones-especiales', {
      title: 'Condiciones Especiales - Farmadescaso',
      user: req.comercial || req.session.comercial,
      condiciones: condiciones,
      comerciales: comerciales,
      articulos: articulos,
      marcas: marcas,
      filters: filters,
      esAdmin: esAdmin,
      currentPage: 'condiciones-especiales',
      req: req
    });
  } catch (error) {
    console.error('❌ Error obteniendo condiciones especiales:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(500).render('error', { error: 'Error obteniendo condiciones especiales', message: error.message });
  }
});

// Crear condición especial
router.post('/condiciones-especiales', async (req, res) => {
  try {
    const condicionData = {
      comercial_id: req.body.comercial_id ? parseInt(req.body.comercial_id) : null,
      articulo_id: req.body.articulo_id ? parseInt(req.body.articulo_id) : null,
      marca: req.body.marca || null,
      tipo_condicion: req.body.tipo_condicion,
      valor: parseFloat(req.body.valor),
      fecha_inicio: req.body.fecha_inicio || null,
      fecha_fin: req.body.fecha_fin || null,
      activo: req.body.activo !== undefined ? req.body.activo === 'true' : true,
      observaciones: req.body.observaciones || null,
      creado_por: req.comercialId || req.session.comercialId
    };

    const condicion = await comisionesCRM.saveCondicionEspecial(condicionData);

    if (req.accepts('json')) {
      return res.json({ success: true, data: condicion });
    }

    res.redirect(`/dashboard/comisiones/condiciones-especiales?success=condicion_creada`);
  } catch (error) {
    console.error('❌ Error creando condición especial:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.redirect(`/dashboard/comisiones/condiciones-especiales?error=${encodeURIComponent(error.message)}`);
  }
});

// Obtener condición especial por ID (para edición)
router.get('/condiciones-especiales/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const condicion = await comisionesCRM.getCondicionEspecialById(id);
    if (!condicion) {
      return res.status(404).json({ success: false, error: 'Condición especial no encontrada' });
    }
    res.json({ success: true, data: condicion });
  } catch (error) {
    console.error('❌ Error obteniendo condición especial:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar condición especial
router.put('/condiciones-especiales/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const condicionData = {
      id: id,
      comercial_id: req.body.comercial_id !== undefined ? (req.body.comercial_id ? parseInt(req.body.comercial_id) : null) : undefined,
      articulo_id: req.body.articulo_id !== undefined ? (req.body.articulo_id ? parseInt(req.body.articulo_id) : null) : undefined,
      marca: req.body.marca !== undefined ? req.body.marca : undefined,
      tipo_condicion: req.body.tipo_condicion !== undefined ? req.body.tipo_condicion : undefined,
      valor: req.body.valor !== undefined ? parseFloat(req.body.valor) : undefined,
      fecha_inicio: req.body.fecha_inicio !== undefined ? req.body.fecha_inicio : undefined,
      fecha_fin: req.body.fecha_fin !== undefined ? (req.body.fecha_fin || null) : undefined,
      activo: req.body.activo !== undefined ? (req.body.activo === 'true' || req.body.activo === true) : undefined,
      observaciones: req.body.observaciones !== undefined ? req.body.observaciones : undefined
    };

    const condicion = await comisionesCRM.saveCondicionEspecial(condicionData);

    res.json({ success: true, data: condicion });
  } catch (error) {
    console.error('❌ Error actualizando condición especial:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eliminar condición especial
router.delete('/condiciones-especiales/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await comisionesCRM.deleteCondicionEspecial(id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error eliminando condición especial:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * =====================================================
 * CONFIGURACIÓN DE RAPELES
 * =====================================================
 */

// Listar configuración de rapeles
router.get('/rapeles-configuracion', async (req, res) => {
  try {
    const filters = {
      marca: req.query.marca || null,
      activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined
    };

    const configuraciones = await comisionesCRM.getRapelesConfiguracion(filters);
    const articulos = await crm.getArticulos();
    const marcas = [...new Set(articulos.map(a => a.Marca || a.marca).filter(m => m))];

    // Solo devolver JSON si se solicita explícitamente (no acepta HTML)
    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true, data: configuraciones });
    }

    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
    res.render('dashboard/comisiones/rapeles-configuracion', {
      title: 'Configuración de Rapeles - Farmadescaso',
      user: req.comercial || req.session.comercial,
      configuraciones: configuraciones,
      marcas: marcas,
      filters: filters,
      esAdmin: esAdmin,
      currentPage: 'rapeles-configuracion',
      req: req
    });
  } catch (error) {
    console.error('❌ Error obteniendo configuración de rapeles:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(500).render('error', { error: 'Error obteniendo configuración', message: error.message });
  }
});

// Crear configuración de rapel
router.post('/rapeles-configuracion', async (req, res) => {
  try {
    const configData = {
      marca: req.body.marca,
      porcentaje_cumplimiento_min: parseFloat(req.body.porcentaje_cumplimiento_min),
      porcentaje_cumplimiento_max: parseFloat(req.body.porcentaje_cumplimiento_max),
      porcentaje_rapel: parseFloat(req.body.porcentaje_rapel),
      activo: req.body.activo !== undefined ? req.body.activo === 'true' : true,
      observaciones: req.body.observaciones || null
    };

    const config = await comisionesCRM.saveRapelConfiguracion(configData);

    if (req.accepts('json')) {
      return res.json({ success: true, data: config });
    }

    res.redirect(`/dashboard/comisiones/rapeles-configuracion?success=configuracion_creada`);
  } catch (error) {
    console.error('❌ Error creando configuración de rapel:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.redirect(`/dashboard/comisiones/rapeles-configuracion?error=${encodeURIComponent(error.message)}`);
  }
});

// Obtener configuración de rapel por ID (para edición)
router.get('/rapeles-configuracion/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const config = await comisionesCRM.getRapelesConfiguracionById(id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Configuración no encontrada' });
    }
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar configuración de rapel
router.put('/rapeles-configuracion/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const configData = {
      id: id,
      marca: req.body.marca !== undefined ? req.body.marca : undefined,
      porcentaje_cumplimiento_min: req.body.porcentaje_cumplimiento_min !== undefined ? parseFloat(req.body.porcentaje_cumplimiento_min) : undefined,
      porcentaje_cumplimiento_max: req.body.porcentaje_cumplimiento_max !== undefined ? parseFloat(req.body.porcentaje_cumplimiento_max) : undefined,
      porcentaje_rapel: req.body.porcentaje_rapel !== undefined ? parseFloat(req.body.porcentaje_rapel) : undefined,
      activo: req.body.activo !== undefined ? (req.body.activo === 'true' || req.body.activo === true) : undefined,
      observaciones: req.body.observaciones !== undefined ? req.body.observaciones : undefined
    };

    const config = await comisionesCRM.saveRapelConfiguracion(configData);

    res.json({ success: true, data: config });
  } catch (error) {
    console.error('❌ Error actualizando configuración de rapel:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eliminar configuración de rapel
router.delete('/rapeles-configuracion/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await comisionesCRM.deleteRapelConfiguracion(id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error eliminando configuración de rapel:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * =====================================================
 * FIJOS MENSUALES
 * =====================================================
 */

// Listar fijos mensuales
router.get('/fijos-mensuales', async (req, res) => {
  console.log('🔍 [FIJOS-MENSUALES] Iniciando petición GET /fijos-mensuales');
  
  try {
    console.log('📊 [FIJOS-MENSUALES] Obteniendo comerciales...');
    const comerciales = await crm.getComerciales() || [];
    console.log(`✅ [FIJOS-MENSUALES] Comerciales obtenidos: ${comerciales.length}`);
    
    // Obtener todas las marcas
    let marcas = [];
    try {
      console.log('📊 [FIJOS-MENSUALES] Obteniendo marcas (minúscula)...');
      // Intentar primero con minúscula (nombre real de la tabla)
      marcas = await crm.query('SELECT id, Nombre FROM marcas ORDER BY Nombre');
      console.log(`✅ [FIJOS-MENSUALES] Marcas obtenidas: ${marcas.length}`);
    } catch (e1) {
      console.warn('⚠️ [FIJOS-MENSUALES] Error con marcas (minúscula):', e1.message);
      try {
        console.log('📊 [FIJOS-MENSUALES] Intentando con Marcas (mayúscula)...');
        // Fallback con mayúscula por si acaso
        marcas = await crm.query('SELECT id, Nombre FROM Marcas ORDER BY Nombre');
        console.log(`✅ [FIJOS-MENSUALES] Marcas obtenidas (mayúscula): ${marcas.length}`);
      } catch (e2) {
        console.error('❌ [FIJOS-MENSUALES] Error obteniendo marcas:', e2.message);
        marcas = [];
      }
    }
    
    // Validar que marcas sea un array
    if (!Array.isArray(marcas)) {
      console.warn('⚠️ [FIJOS-MENSUALES] marcas no es un array, convirtiendo...');
      marcas = [];
    }
    
    // Obtener fijos mensuales por marca
    let fijosMensuales = [];
    try {
      console.log('📊 [FIJOS-MENSUALES] Obteniendo fijos mensuales...');
      fijosMensuales = await comisionesCRM.getFijosMensualesMarca() || [];
      console.log(`✅ [FIJOS-MENSUALES] Fijos mensuales obtenidos: ${fijosMensuales.length}`);
    } catch (error) {
      console.error('❌ [FIJOS-MENSUALES] Error obteniendo fijos mensuales:', error.message);
      console.error('❌ [FIJOS-MENSUALES] Stack:', error.stack);
      fijosMensuales = [];
    }
    
    // Validar que fijosMensuales sea un array
    if (!Array.isArray(fijosMensuales)) {
      console.warn('⚠️ [FIJOS-MENSUALES] fijosMensuales no es un array, convirtiendo...');
      fijosMensuales = [];
    }
    
    // Organizar fijos por comercial y marca para facilitar el acceso en la vista
    console.log('📊 [FIJOS-MENSUALES] Organizando fijos por comercial...');
    const fijosPorComercial = {};
    if (Array.isArray(fijosMensuales)) {
      fijosMensuales.forEach(fijo => {
        if (fijo && fijo.comercial_id && fijo.marca_id !== undefined) {
          const comercialId = fijo.comercial_id;
          if (!fijosPorComercial[comercialId]) {
            fijosPorComercial[comercialId] = {};
          }
          fijosPorComercial[comercialId][fijo.marca_id] = parseFloat(fijo.importe || 0);
        }
      });
    }
    console.log(`✅ [FIJOS-MENSUALES] Fijos organizados para ${Object.keys(fijosPorComercial).length} comerciales`);
    
    // Solo devolver JSON si se solicita explícitamente (no acepta HTML)
    if (req.accepts('json') && !req.accepts('html')) {
      console.log('📤 [FIJOS-MENSUALES] Devolviendo JSON');
      return res.json({ success: true, data: { comerciales, marcas, fijosMensuales } });
    }

    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
    console.log(`📊 [FIJOS-MENSUALES] Es admin: ${esAdmin}`);
    
    console.log('📤 [FIJOS-MENSUALES] Renderizando vista...');
    console.log(`   - Comerciales: ${comerciales.length}`);
    console.log(`   - Marcas: ${marcas.length}`);
    console.log(`   - Fijos por comercial: ${Object.keys(fijosPorComercial).length}`);
    
    res.render('dashboard/comisiones/fijos-mensuales', {
      title: 'Fijos Mensuales - Farmadescaso',
      user: req.comercial || req.session.comercial,
      comerciales: comerciales || [],
      marcas: marcas || [],
      fijosPorComercial: fijosPorComercial || {},
      esAdmin: esAdmin,
      currentPage: 'fijos-mensuales',
      req: req
    });
    console.log('✅ [FIJOS-MENSUALES] Vista renderizada correctamente');
  } catch (error) {
    console.error('❌ Error obteniendo fijos mensuales:', error);
    console.error('Stack trace:', error.stack);
    console.error('Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Intentar renderizar con datos por defecto para evitar error 500
    try {
      const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
      res.render('dashboard/comisiones/fijos-mensuales', {
        title: 'Fijos Mensuales - Farmadescaso',
        user: req.comercial || req.session.comercial,
        comerciales: [],
        marcas: [],
        fijosPorComercial: {},
        esAdmin: esAdmin,
        currentPage: 'fijos-mensuales',
        req: req,
        error: error.message
      });
    } catch (renderError) {
      console.error('❌ Error renderizando vista de error:', renderError);
      if (req.accepts('json')) {
        return res.status(500).json({ success: false, error: error.message });
      }
      res.status(500).render('error', { error: 'Error obteniendo fijos mensuales', message: error.message });
    }
  }
});

// Actualizar fijo mensual de un comercial por marca
router.put('/fijos-mensuales/:comercialId', async (req, res) => {
  try {
    const comercialId = parseInt(req.params.comercialId);
    const { marca_id, importe } = req.body;

    if (!marca_id) {
      return res.status(400).json({ success: false, error: 'marca_id es requerido' });
    }

    const marcaId = parseInt(marca_id);
    const importeNum = parseFloat(importe || 0);

    await comisionesCRM.saveFijoMensualMarca({
      comercial_id: comercialId,
      marca_id: marcaId,
      importe: importeNum,
      activo: true
    });

    res.json({ success: true, message: 'Fijo mensual actualizado correctamente' });
  } catch (error) {
    console.error('❌ Error actualizando fijo mensual:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * =====================================================
 * CONFIGURACIÓN DE COMISIONES POR TIPO DE PEDIDO
 * =====================================================
 */

// Listar configuraciones de comisiones por tipo de pedido
router.get('/config-comisiones-tipo-pedido', async (req, res) => {
  try {
    const filters = {
      marca: req.query.marca !== undefined ? (req.query.marca === 'null' ? null : req.query.marca) : undefined,
      nombre_tipo_pedido: req.query.nombre_tipo_pedido || undefined,
      año_aplicable: req.query.año_aplicable ? parseInt(req.query.año_aplicable) : undefined,
      activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined
    };

    // Obtener marcas desde tabla Marcas (no desde artículos)
    let marcas = [];
    try {
      const marcasResult = await crm.query('SELECT id, Nombre FROM Marcas ORDER BY Nombre');
      marcas = marcasResult.map(m => m.Nombre || m.nombre).filter(m => m);
    } catch (error) {
      console.warn('⚠️ Error obteniendo marcas, usando desde artículos:', error.message);
      const articulos = await crm.getArticulos();
      marcas = [...new Set(articulos.map(a => a.Marca || a.marca).filter(m => m))];
    }

    // Filtrar solo configuraciones con marca específica (NO mostrar NULL)
    let configuraciones = await comisionesCRM.getConfigComisionesTipoPedido(filters);
    configuraciones = configuraciones.filter(c => c.marca && c.marca !== null && c.marca !== '');

    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true, data: configuraciones });
    }

    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
    res.render('dashboard/comisiones/config-comisiones-tipo-pedido', {
      title: 'Configuración Comisiones por Tipo Pedido - Farmadescaso',
      user: req.comercial || req.session.comercial,
      configuraciones: configuraciones,
      marcas: marcas,
      filters: filters,
      esAdmin: esAdmin,
      currentPage: 'config-comisiones-tipo-pedido',
      req: req
    });
  } catch (error) {
    console.error('❌ Error obteniendo config comisiones tipo pedido:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(500).render('error', { error: 'Error obteniendo configuraciones', message: error.message });
  }
});

// Crear/actualizar configuración
router.post('/config-comisiones-tipo-pedido', async (req, res) => {
  try {
    // Validar que se proporcione marca (obligatorio)
    if (!req.body.marca || req.body.marca === '') {
      if (req.accepts('json')) {
        return res.status(400).json({ success: false, error: 'La marca es obligatoria' });
      }
      return res.redirect(`/dashboard/comisiones/config-comisiones-tipo-pedido?error=${encodeURIComponent('La marca es obligatoria. Debe seleccionar IALOZON o YOUBELLE.')}`);
    }

    const configData = {
      id: req.body.id ? parseInt(req.body.id) : undefined,
      marca: req.body.marca.toUpperCase(), // Normalizar a mayúsculas
      nombre_tipo_pedido: req.body.nombre_tipo_pedido,
      año_aplicable: parseInt(req.body.año_aplicable),
      porcentaje_comision: parseFloat(req.body.porcentaje_comision),
      activo: req.body.activo !== undefined ? req.body.activo === 'true' : true,
      descripcion: req.body.descripcion || null
    };

    const config = await comisionesCRM.saveConfigComisionTipoPedido(configData);

    if (req.accepts('json')) {
      return res.json({ success: true, data: config });
    }

    res.redirect(`/dashboard/comisiones/config-comisiones-tipo-pedido?success=configuracion_guardada`);
  } catch (error) {
    console.error('❌ Error guardando config:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.redirect(`/dashboard/comisiones/config-comisiones-tipo-pedido?error=${encodeURIComponent(error.message)}`);
  }
});

// Obtener por ID
router.get('/config-comisiones-tipo-pedido/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const config = await comisionesCRM.getConfigComisionTipoPedidoById(id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Configuración no encontrada' });
    }
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('❌ Error obteniendo config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eliminar
router.delete('/config-comisiones-tipo-pedido/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await comisionesCRM.deleteConfigComisionTipoPedido(id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error eliminando config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * =====================================================
 * CONFIGURACIÓN DE RAPPEL PRESUPUESTO
 * =====================================================
 */

// Listar configuraciones de rappel presupuesto
router.get('/config-rappel-presupuesto', async (req, res) => {
  try {
    const filters = {
      marca: req.query.marca !== undefined ? (req.query.marca === 'null' ? null : req.query.marca) : undefined,
      año_aplicable: req.query.año_aplicable ? parseInt(req.query.año_aplicable) : undefined,
      activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined
    };

    // Obtener marcas desde tabla Marcas
    let marcas = [];
    try {
      const marcasResult = await crm.query('SELECT id, Nombre FROM Marcas ORDER BY Nombre');
      marcas = marcasResult.map(m => m.Nombre || m.nombre).filter(m => m);
    } catch (error) {
      console.warn('⚠️ Error obteniendo marcas:', error.message);
      const articulos = await crm.getArticulos();
      marcas = [...new Set(articulos.map(a => a.Marca || a.marca).filter(m => m))];
    }

    const configuraciones = await comisionesCRM.getConfigRappelPresupuesto(filters);

    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true, data: configuraciones });
    }

    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
    res.render('dashboard/comisiones/config-rappel-presupuesto', {
      title: 'Configuración Rappel Presupuesto - Farmadescaso',
      user: req.comercial || req.session.comercial,
      configuraciones: configuraciones,
      marcas: marcas,
      filters: filters,
      esAdmin: esAdmin,
      currentPage: 'config-rappel-presupuesto',
      req: req
    });
  } catch (error) {
    console.error('❌ Error obteniendo config rappel presupuesto:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(500).render('error', { error: 'Error obteniendo configuraciones', message: error.message });
  }
});

// Crear/actualizar configuración
router.post('/config-rappel-presupuesto', async (req, res) => {
  try {
    const configData = {
      id: req.body.id ? parseInt(req.body.id) : undefined,
      marca: req.body.marca && req.body.marca !== '' ? req.body.marca : null,
      año_aplicable: parseInt(req.body.año_aplicable),
      porcentaje_rappel: parseFloat(req.body.porcentaje_rappel),
      activo: req.body.activo !== undefined ? req.body.activo === 'true' : true,
      descripcion: req.body.descripcion || null
    };

    const config = await comisionesCRM.saveConfigRappelPresupuesto(configData);

    if (req.accepts('json')) {
      return res.json({ success: true, data: config });
    }

    res.redirect(`/dashboard/comisiones/config-rappel-presupuesto?success=configuracion_guardada`);
  } catch (error) {
    console.error('❌ Error guardando config:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.redirect(`/dashboard/comisiones/config-rappel-presupuesto?error=${encodeURIComponent(error.message)}`);
  }
});

// Eliminar
router.delete('/config-rappel-presupuesto/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await comisionesCRM.deleteConfigRappelPresupuesto(id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error eliminando config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * =====================================================
 * CONFIGURACIÓN DE FIJO MENSUAL
 * =====================================================
 */

// Listar configuraciones de fijo mensual
router.get('/config-fijo-mensual', async (req, res) => {
  try {
    const filters = {
      activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined
    };

    const configuraciones = await comisionesCRM.getConfigFijoMensualList(filters);

    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true, data: configuraciones });
    }

    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
    res.render('dashboard/comisiones/config-fijo-mensual', {
      title: 'Configuración Fijo Mensual - Farmadescaso',
      user: req.comercial || req.session.comercial,
      configuraciones: configuraciones,
      filters: filters,
      esAdmin: esAdmin,
      currentPage: 'config-fijo-mensual',
      req: req
    });
  } catch (error) {
    console.error('❌ Error obteniendo config fijo mensual:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(500).render('error', { error: 'Error obteniendo configuraciones', message: error.message });
  }
});

// Crear/actualizar configuración
router.post('/config-fijo-mensual', async (req, res) => {
  try {
    const configData = {
      id: req.body.id ? parseInt(req.body.id) : undefined,
      año_limite: parseInt(req.body.año_limite),
      porcentaje_minimo_ventas: parseFloat(req.body.porcentaje_minimo_ventas),
      activo: req.body.activo !== undefined ? req.body.activo === 'true' : true,
      descripcion: req.body.descripcion || null
    };

    const config = await comisionesCRM.saveConfigFijoMensual(configData);

    if (req.accepts('json')) {
      return res.json({ success: true, data: config });
    }

    res.redirect(`/dashboard/comisiones/config-fijo-mensual?success=configuracion_guardada`);
  } catch (error) {
    console.error('❌ Error guardando config:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.redirect(`/dashboard/comisiones/config-fijo-mensual?error=${encodeURIComponent(error.message)}`);
  }
});

// Eliminar
router.delete('/config-fijo-mensual/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await comisionesCRM.deleteConfigFijoMensual(id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error eliminando config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * =====================================================
 * CONFIGURACIÓN DE DESCUENTO TRANSPORTE
 * =====================================================
 */

// Listar configuraciones de descuento transporte
router.get('/config-descuento-transporte', async (req, res) => {
  try {
    const filters = {
      marca: req.query.marca !== undefined ? (req.query.marca === 'null' ? null : req.query.marca) : undefined,
      año_aplicable: req.query.año_aplicable ? parseInt(req.query.año_aplicable) : undefined,
      activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined
    };

    // Obtener marcas desde tabla Marcas
    let marcas = [];
    try {
      const marcasResult = await crm.query('SELECT id, Nombre FROM Marcas ORDER BY Nombre');
      marcas = marcasResult.map(m => m.Nombre || m.nombre).filter(m => m);
    } catch (error) {
      console.warn('⚠️ Error obteniendo marcas:', error.message);
      const articulos = await crm.getArticulos();
      marcas = [...new Set(articulos.map(a => a.Marca || a.marca).filter(m => m))];
    }

    // Filtrar solo configuraciones con marca específica (NO mostrar NULL)
    let configuraciones = await comisionesCRM.getConfigDescuentoTransporte(filters);
    configuraciones = configuraciones.filter(c => c.marca && c.marca !== null && c.marca !== '');

    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true, data: configuraciones });
    }

    const esAdmin = req.user && (req.user.roll?.toLowerCase().includes('administrador') || req.user.Roll?.toLowerCase().includes('administrador'));
    res.render('dashboard/comisiones/config-descuento-transporte', {
      title: 'Configuración Descuento Transporte - Farmadescaso',
      user: req.comercial || req.session.comercial,
      configuraciones: configuraciones,
      marcas: marcas,
      filters: filters,
      esAdmin: esAdmin,
      currentPage: 'config-descuento-transporte',
      req: req
    });
  } catch (error) {
    console.error('❌ Error obteniendo config descuento transporte:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(500).render('error', { error: 'Error obteniendo configuraciones', message: error.message });
  }
});

// Crear/actualizar configuración
router.post('/config-descuento-transporte', async (req, res) => {
  try {
    // Validar que se proporcione marca (obligatorio para descuento transporte)
    if (!req.body.marca || req.body.marca === '') {
      if (req.accepts('json')) {
        return res.status(400).json({ success: false, error: 'La marca es obligatoria' });
      }
      return res.redirect(`/dashboard/comisiones/config-descuento-transporte?error=${encodeURIComponent('La marca es obligatoria. Debe seleccionar IALOZON o YOUBELLE.')}`);
    }

    const configData = {
      id: req.body.id ? parseInt(req.body.id) : undefined,
      marca: req.body.marca.toUpperCase(), // Normalizar a mayúsculas
      año_aplicable: parseInt(req.body.año_aplicable),
      porcentaje_descuento: parseFloat(req.body.porcentaje_descuento),
      activo: req.body.activo !== undefined ? req.body.activo === 'true' : true,
      descripcion: req.body.descripcion || null
    };

    const config = await comisionesCRM.saveConfigDescuentoTransporte(configData);

    if (req.accepts('json')) {
      return res.json({ success: true, data: config });
    }

    res.redirect(`/dashboard/comisiones/config-descuento-transporte?success=configuracion_guardada`);
  } catch (error) {
    console.error('❌ Error guardando config:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.redirect(`/dashboard/comisiones/config-descuento-transporte?error=${encodeURIComponent(error.message)}`);
  }
});

// Eliminar
router.delete('/config-descuento-transporte/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await comisionesCRM.deleteConfigDescuentoTransporte(id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error eliminando config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

