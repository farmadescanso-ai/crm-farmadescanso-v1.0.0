// Rutas API para Artículos
const express = require('express');
const router = express.Router();
const crm = require('../../config/mysql-crm');

/**
 * @swagger
 * /api/articulos:
 *   get:
 *     summary: Obtener todos los artículos
 *     tags: [Artículos]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: activo
 *         schema:
 *           type: boolean
 *         description: Filtrar por artículos activos
 *     responses:
 *       200:
 *         description: Lista de artículos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Articulo'
 */
router.get('/', async (req, res) => {
  try {
    const articulos = await crm.getArticulos();
    res.json({
      success: true,
      data: articulos,
      count: articulos.length
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
 * /api/articulos/{id}:
 *   get:
 *     summary: Obtener un artículo por ID
 *     tags: [Artículos]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Artículo encontrado
 *       404:
 *         description: Artículo no encontrado
 */
router.get('/:id', async (req, res) => {
  try {
    const articulo = await crm.getArticuloById(req.params.id);
    if (!articulo) {
      return res.status(404).json({
        success: false,
        error: 'Artículo no encontrado'
      });
    }
    res.json({
      success: true,
      data: articulo
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
 * /api/articulos:
 *   post:
 *     summary: Crear un nuevo artículo
 *     tags: [Artículos]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Articulo'
 *     responses:
 *       201:
 *         description: Artículo creado exitosamente
 */
router.post('/', async (req, res) => {
  try {
    const result = await crm.createArticulo(req.body);
    res.status(201).json({
      success: true,
      data: { id: result.insertId },
      message: 'Artículo creado exitosamente'
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
 * /api/articulos/{id}:
 *   put:
 *     summary: Actualizar un artículo
 *     tags: [Artículos]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Articulo'
 *     responses:
 *       200:
 *         description: Artículo actualizado
 */
router.put('/:id', async (req, res) => {
  try {
    await crm.updateArticulo(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Artículo actualizado exitosamente'
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
 * /api/articulos/{id}:
 *   delete:
 *     summary: Eliminar un artículo
 *     tags: [Artículos]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Artículo eliminado
 */
router.delete('/:id', async (req, res) => {
  try {
    await crm.deleteArticulo(req.params.id);
    res.json({
      success: true,
      message: 'Artículo eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

