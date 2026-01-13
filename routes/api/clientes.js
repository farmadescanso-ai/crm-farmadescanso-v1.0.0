// Rutas API para Clientes
const express = require('express');
const router = express.Router();
const crm = require('../../config/mysql-crm');
const { requireApiKey } = require('../../middleware/api-auth');

// Ruta específica para /count (debe estar ANTES de todas las demás para tener prioridad)
// Esta ruta NO requiere autenticación API key para permitir acceso desde el dashboard
router.get('/count', async (req, res) => {
  try {
    // Verificar autenticación de forma opcional - si no hay autenticación, devolver 0
    const isAuthenticated = (req.user && req.comercialId) || (req.session && req.session.comercialId);
    
    if (!isAuthenticated) {
      // Si no está autenticado, devolver 0 en lugar de error
      return res.json({ count: 0, totalClientes: 0 });
    }
    
    const count = await crm.getClientesCount();
    res.json({ count: count, totalClientes: count });
  } catch (error) {
    console.error('Error obteniendo contador de clientes:', error);
    res.status(500).json({ error: 'Error al obtener contador', count: 0 });
  }
});

/**
 * @swagger
 * /api/clientes:
 *   get:
 *     summary: Obtener todos los clientes
 *     tags: [Clientes]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de clientes
 */
// Esta ruta SÍ requiere autenticación API key
router.get('/', requireApiKey, async (req, res) => {
  try {
    const clientes = await crm.getClientes();
    res.json({
      success: true,
      data: clientes,
      count: clientes.length
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
 * /api/clientes/{id}:
 *   get:
 *     summary: Obtener un cliente por ID
 *     tags: [Clientes]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/:id', async (req, res) => {
  try {
    const cliente = await crm.getClienteById(req.params.id);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    res.json({
      success: true,
      data: cliente
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
 * /api/clientes:
 *   post:
 *     summary: Crear un nuevo cliente
 *     tags: [Clientes]
 *     security:
 *       - ApiKeyAuth: []
 */
router.post('/', async (req, res) => {
  try {
    const result = await crm.createCliente(req.body);
    res.status(201).json({
      success: true,
      data: { id: result.insertId },
      message: 'Cliente creado exitosamente'
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
 * /api/clientes/{id}:
 *   put:
 *     summary: Actualizar un cliente
 *     tags: [Clientes]
 *     security:
 *       - ApiKeyAuth: []
 */
router.put('/:id', async (req, res) => {
  try {
    await crm.updateCliente(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente'
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
 * /api/clientes/{id}:
 *   delete:
 *     summary: Eliminar un cliente
 *     tags: [Clientes]
 *     security:
 *       - ApiKeyAuth: []
 */
router.delete('/:id', async (req, res) => {
  try {
    await crm.moverClienteAPapelera(req.params.id, req.apiKeyId || 0);
    res.json({
      success: true,
      message: 'Cliente movido a la papelera exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

