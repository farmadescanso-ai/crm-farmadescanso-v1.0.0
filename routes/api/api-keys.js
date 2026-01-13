// Rutas API para gestión de API Keys
const express = require('express');
const router = express.Router();
const crm = require('../../config/mysql-crm');

// Middleware de autenticación y autorización para gestión de API keys (requiere sesión de usuario y rol de administrador)
let requireAuth, requireAdmin;

// Función helper para parsear rol
const parseRoll = (rollValue) => {
  if (!rollValue) return 'Comercial';
  if (typeof rollValue === 'string' && rollValue.trim().startsWith('[')) {
    try {
      const rollArray = JSON.parse(rollValue);
      if (Array.isArray(rollArray) && rollArray.length > 0) {
        return rollArray[0];
      }
    } catch (e) {}
  } else if (Array.isArray(rollValue) && rollValue.length > 0) {
    return rollValue[0];
  }
  return rollValue;
};

// Función para obtener rol del usuario
const getUsuarioRol = (req) => {
  const comercial = req.comercial || req.session?.comercial;
  if (!comercial) return null;
  let rollValue = comercial.roll || comercial.Roll;
  if (!rollValue) return 'comercial';
  if (typeof rollValue === 'string' && rollValue.trim().startsWith('[')) {
    try {
      const rollArray = JSON.parse(rollValue);
      if (Array.isArray(rollArray) && rollArray.length > 0) {
        rollValue = rollArray[0];
      }
    } catch (e) {}
  } else if (Array.isArray(rollValue) && rollValue.length > 0) {
    rollValue = rollValue[0];
  }
  return String(rollValue).toLowerCase();
};

// Función para verificar si es administrador
const isAdmin = (req) => {
  const rol = getUsuarioRol(req);
  return rol && (rol.includes('administrador') || rol.includes('admin'));
};

// Evitar dependencia circular - usar funciones locales en lugar de importar desde server-crm-completo
requireAuth = (req, res, next) => {
  if (req.user && req.comercialId) {
    return next();
  }
  if (req.session && req.session.comercialId) {
    req.comercialId = req.session.comercialId;
    return next();
  }
  res.status(401).json({
    success: false,
    error: 'Autenticación requerida',
    message: 'Debes estar autenticado para gestionar API keys'
  });
};

requireAdmin = (req, res, next) => {
  if (!req.user && !req.session?.comercialId) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }
  if (!isAdmin(req)) {
    return res.status(403).json({ 
      success: false, 
      error: 'Solo los administradores pueden acceder a esta sección.' 
    });
  }
  next();
};

/**
 * @swagger
 * /api/keys/generate:
 *   post:
 *     summary: Generar una nueva API key
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "API Key para integración Prestashop"
 *               descripcion:
 *                 type: string
 *                 example: "API key para sincronización con Prestashop"
 *     responses:
 *       201:
 *         description: API key generada exitosamente
 */
router.post('/generate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    
    if (!nombre) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido'
      });
    }
    
    const creadoPor = req.comercialId || req.user?.id || null;
    const result = await crm.createApiKey(nombre, descripcion, creadoPor);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'API key generada exitosamente. Guarda esta clave de forma segura, no se mostrará nuevamente.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/keys:
 *   get:
 *     summary: Listar todas las API keys (solo nombres, sin las claves)
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const keys = await crm.getAllApiKeys();
    res.json({
      success: true,
      data: keys,
      count: keys.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/keys/{id}/toggle:
 *   put:
 *     summary: Activar/desactivar una API key
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 */
router.put('/:id/toggle', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { activa } = req.body;
    await crm.toggleApiKey(req.params.id, activa);
    res.json({
      success: true,
      message: `API key ${activa ? 'activada' : 'desactivada'} exitosamente`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/keys/{id}:
 *   delete:
 *     summary: Eliminar una API key
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await crm.deleteApiKey(req.params.id);
    res.json({
      success: true,
      message: 'API key eliminada exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

