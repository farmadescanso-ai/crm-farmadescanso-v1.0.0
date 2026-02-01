// Rutas API para Grupos de compras
const express = require('express');
const router = express.Router();
const crm = require('../../config/mysql-crm');

router.get('/', async (req, res) => {
  try {
    const grupos = await crm.getGruposCompras();
    res.json({ success: true, data: grupos, count: grupos.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const grupo = await crm.getGrupoComprasById(req.params.id);
    if (!grupo) {
      return res.status(404).json({ success: false, error: 'Grupo no encontrado' });
    }
    res.json({ success: true, data: grupo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

