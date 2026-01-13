// Rutas API para Centros de Salud
const express = require('express');
const router = express.Router();
const crm = require('../../config/mysql-crm');

router.get('/', async (req, res) => {
  try {
    const centrosSalud = await crm.getCentrosSalud();
    res.json({
      success: true,
      data: centrosSalud,
      count: centrosSalud.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const centroSalud = await crm.getCentroSaludById(req.params.id);
    if (!centroSalud) {
      return res.status(404).json({
        success: false,
        error: 'Centro de salud no encontrado'
      });
    }
    res.json({
      success: true,
      data: centroSalud
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

