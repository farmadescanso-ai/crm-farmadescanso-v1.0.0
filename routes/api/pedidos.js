// Rutas API para Pedidos
const express = require('express');
const router = express.Router();
const crm = require('../../config/mysql-crm');

/**
 * @swagger
 * /api/pedidos:
 *   get:
 *     summary: Obtener todos los pedidos
 *     tags: [Pedidos]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/', async (req, res) => {
  try {
    const pedidos = await crm.getPedidos();
    res.json({
      success: true,
      data: pedidos,
      count: pedidos.length
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
 * /api/pedidos/{id}:
 *   get:
 *     summary: Obtener un pedido por ID
 *     tags: [Pedidos]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/:id', async (req, res) => {
  try {
    const pedido = await crm.getPedidoById(req.params.id);
    if (!pedido) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }
    
    // Obtener artículos del pedido
    const articulos = await crm.getArticulosByPedido(req.params.id);
    
    res.json({
      success: true,
      data: {
        ...pedido,
        articulos: articulos
      }
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
 * /api/pedidos:
 *   post:
 *     summary: Crear un nuevo pedido
 *     tags: [Pedidos]
 *     security:
 *       - ApiKeyAuth: []
 */
router.post('/', async (req, res) => {
  try {
    const result = await crm.createPedido(req.body);
    res.status(201).json({
      success: true,
      data: { id: result.insertId },
      message: 'Pedido creado exitosamente'
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
 * /api/pedidos/{id}:
 *   put:
 *     summary: Actualizar un pedido
 *     tags: [Pedidos]
 *     security:
 *       - ApiKeyAuth: []
 */
router.put('/:id', async (req, res) => {
  try {
    await crm.updatePedido(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Pedido actualizado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

