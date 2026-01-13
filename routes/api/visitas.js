// Rutas API para Visitas
const express = require('express');
const router = express.Router();
const crm = require('../../config/mysql-crm');

/**
 * @swagger
 * /api/visitas:
 *   get:
 *     summary: Obtener todas las visitas
 *     tags: [Visitas]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/', async (req, res) => {
  try {
    const visitas = await crm.getVisitas();
    res.json({
      success: true,
      data: visitas,
      count: visitas.length
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
 * /api/visitas/{id}:
 *   get:
 *     summary: Obtener una visita por ID
 *     tags: [Visitas]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/:id', async (req, res) => {
  try {
    const visita = await crm.getVisitaById(req.params.id);
    if (!visita) {
      return res.status(404).json({
        success: false,
        error: 'Visita no encontrada'
      });
    }
    res.json({
      success: true,
      data: visita
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
 * /api/visitas:
 *   post:
 *     summary: Crear una nueva visita
 *     tags: [Visitas]
 *     security:
 *       - ApiKeyAuth: []
 */
router.post('/', async (req, res) => {
  try {
    const result = await crm.createVisita(req.body);
    res.status(201).json({
      success: true,
      data: { id: result.insertId },
      message: 'Visita creada exitosamente'
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
 * /api/visitas/{id}:
 *   put:
 *     summary: Actualizar una visita
 *     tags: [Visitas]
 *     security:
 *       - ApiKeyAuth: []
 */
router.put('/:id', async (req, res) => {
  try {
    await crm.updateVisita(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Visita actualizada exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

