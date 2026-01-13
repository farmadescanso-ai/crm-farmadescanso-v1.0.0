// Rutas principales de la API REST
const express = require('express');
const router = express.Router();
const { requireApiKey } = require('../../middleware/api-auth');
const crm = require('../../config/mysql-crm');

// Importar rutas específicas
const articulosRoutes = require('./articulos');
const clientesRoutes = require('./clientes');
const pedidosRoutes = require('./pedidos');
const visitasRoutes = require('./visitas');
const comercialesRoutes = require('./comerciales');
const cooperativasRoutes = require('./cooperativas');
const formasPagoRoutes = require('./formas-pago');
const especialidadesRoutes = require('./especialidades');
const centrosSaludRoutes = require('./centros-salud');
const apiKeysRoutes = require('./api-keys');

// Aplicar autenticación a todas las rutas excepto las de API keys (que tienen su propia autenticación)
router.use('/articulos', requireApiKey, articulosRoutes);
// Ruta /clientes - la ruta /count NO requiere API key (se maneja en clientesRoutes)
router.use('/clientes', clientesRoutes); // Removido requireApiKey para permitir /count sin autenticación
router.use('/pedidos', requireApiKey, pedidosRoutes);
router.use('/visitas', requireApiKey, visitasRoutes);
router.use('/comerciales', requireApiKey, comercialesRoutes);
router.use('/cooperativas', requireApiKey, cooperativasRoutes);
router.use('/formas-pago', requireApiKey, formasPagoRoutes);
router.use('/especialidades', requireApiKey, especialidadesRoutes);
router.use('/centros-salud', requireApiKey, centrosSaludRoutes);
router.use('/keys', apiKeysRoutes);

// Ruta de información de la API
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Farmadescaso CRM API v1.0.0',
    version: '1.0.0',
    endpoints: {
      articulos: '/api/articulos',
      clientes: '/api/clientes',
      pedidos: '/api/pedidos',
      visitas: '/api/visitas',
      comerciales: '/api/comerciales',
      cooperativas: '/api/cooperativas',
      formasPago: '/api/formas-pago',
      especialidades: '/api/especialidades',
      centrosSalud: '/api/centros-salud',
      apiKeys: '/api/keys',
      documentation: '/api-docs'
    },
    authentication: {
      type: 'API Key',
      header: 'X-API-Key',
      description: 'Incluye tu API key en el header X-API-Key para autenticarte'
    }
  });
});

module.exports = router;

