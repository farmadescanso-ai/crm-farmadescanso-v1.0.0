// Rutas API para Comerciales
const express = require('express');
const router = express.Router();
const crm = require('../../config/mysql-crm');

/**
 * @swagger
 * /api/comerciales:
 *   get:
 *     summary: Obtener todos los comerciales
 *     tags: [Comerciales]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/', async (req, res) => {
  try {
    const comerciales = await crm.getComerciales();
    res.json({
      success: true,
      data: comerciales,
      count: comerciales.length
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
 * /api/comerciales/{id}:
 *   get:
 *     summary: Obtener un comercial por ID
 *     tags: [Comerciales]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/:id', async (req, res) => {
  try {
    const comercial = await crm.getComercialById(req.params.id);
    if (!comercial) {
      return res.status(404).json({
        success: false,
        error: 'Comercial no encontrado'
      });
    }
    // No devolver la contraseña
    delete comercial.Password;
    delete comercial.password;
    res.json({
      success: true,
      data: comercial
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

