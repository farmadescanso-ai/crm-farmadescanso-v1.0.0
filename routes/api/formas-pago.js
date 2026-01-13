// Rutas API para Formas de Pago
const express = require('express');
const router = express.Router();
const crm = require('../../config/mysql-crm');

router.get('/', async (req, res) => {
  try {
    const formasPago = await crm.getFormasPago();
    res.json({
      success: true,
      data: formasPago,
      count: formasPago.length
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
    const formaPago = await crm.getFormaPagoById(req.params.id);
    if (!formaPago) {
      return res.status(404).json({
        success: false,
        error: 'Forma de pago no encontrada'
      });
    }
    res.json({
      success: true,
      data: formaPago
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

