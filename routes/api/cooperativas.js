// Rutas API para Cooperativas
const express = require('express');
const router = express.Router();
const crm = require('../../config/mysql-crm');

/**
 * @swagger
 * /api/cooperativas:
 *   get:
 *     summary: Obtener todas las cooperativas
 *     tags: [Cooperativas]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/', async (req, res) => {
  try {
    const cooperativas = await crm.getCooperativas();
    res.json({
      success: true,
      data: cooperativas,
      count: cooperativas.length
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
 * /api/cooperativas/{id}:
 *   get:
 *     summary: Obtener una cooperativa por ID
 *     tags: [Cooperativas]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/:id', async (req, res) => {
  try {
    const cooperativa = await crm.getCooperativaById(req.params.id);
    if (!cooperativa) {
      return res.status(404).json({
        success: false,
        error: 'Cooperativa no encontrada'
      });
    }
    res.json({
      success: true,
      data: cooperativa
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

