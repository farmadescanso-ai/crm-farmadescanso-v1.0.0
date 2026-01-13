// Middleware de autenticación por API Key
const crm = require('../config/mysql-crm');

const requireApiKey = async (req, res, next) => {
  try {
    // Obtener API key del header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.api_key;
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key requerida',
        message: 'Debes proporcionar una API key válida en el header X-API-Key o como parámetro api_key'
      });
    }

    // Verificar API key en la base de datos
    const keyData = await crm.getApiKeyByKey(apiKey);
    
    if (!keyData) {
      return res.status(401).json({
        success: false,
        error: 'API key inválida',
        message: 'La API key proporcionada no es válida o está desactivada'
      });
    }

    // Actualizar último uso
    await crm.updateApiKeyUsage(apiKey);

    // Añadir información de la API key al request
    req.apiKey = keyData;
    req.apiKeyId = keyData.id;
    
    next();
  } catch (error) {
    console.error('❌ Error en autenticación API:', error);
    return res.status(500).json({
      success: false,
      error: 'Error de autenticación',
      message: 'Error al verificar la API key'
    });
  }
};

module.exports = { requireApiKey };

