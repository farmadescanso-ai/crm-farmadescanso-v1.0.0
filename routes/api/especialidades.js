// Rutas API para Especialidades
const express = require('express');
const router = express.Router();
const crm = require('../../config/mysql-crm');

router.get('/', async (req, res) => {
  try {
    const especialidades = await crm.getEspecialidades();
    res.json({
      success: true,
      data: especialidades,
      count: especialidades.length
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
    const especialidad = await crm.getEspecialidadById(req.params.id);
    if (!especialidad) {
      return res.status(404).json({
        success: false,
        error: 'Especialidad no encontrada'
      });
    }
    res.json({
      success: true,
      data: especialidad
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

