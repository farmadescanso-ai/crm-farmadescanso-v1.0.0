// Middleware de autenticación por API Key
const crm = require('../config/mysql-crm');

/**
 * Si hay X-API-Key (o ?api_key=) válida, marca req.apiKeyAuth.
 * No bloquea si no hay key (permite CookieAuth después).
 */
const attachApiKeyAuth = async (req, res, next) => {
  try {
    const raw =
      req.headers['x-api-key'] ||
      (typeof req.headers.authorization === 'string' && req.headers.authorization.toLowerCase().startsWith('apikey ')
        ? req.headers.authorization.slice(7).trim()
        : null) ||
      req.query.api_key;

    if (!raw) return next();

    const apiKey = String(raw).trim();
    if (!apiKey) return next();

    const keyData = await crm.getApiKeyByKey(apiKey);
    if (!keyData) {
      // Key enviada pero inválida → 401 inmediato en rutas API
      const pathOnly = String(req.originalUrl || '').split('?')[0];
      if (pathOnly.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'API key inválida',
          message: 'La API key no es válida o está desactivada'
        });
      }
      return next();
    }

    await crm.updateApiKeyUsage(apiKey).catch(() => {});
    req.apiKey = keyData;
    req.apiKeyAuth = true;
    req.apiKeyId = keyData.id;

    if (!req.comercialId && !req.user) {
      const ownerId = keyData.creado_por || keyData.creadoPor || null;
      req.comercialId = ownerId;
      req.user = {
        id: ownerId,
        email: 'api-key@system',
        roll: 'api',
        Roll: 'api',
        apiKey: true
      };
    }

    return next();
  } catch (error) {
    console.error('❌ [API-KEY] Error attach:', error.message);
    return next();
  }
};

/** Exige API key (modo estricto, para routers dedicados). */
const requireApiKey = async (req, res, next) => {
  try {
    if (req.apiKeyAuth && req.apiKey) return next();

    const apiKey =
      req.headers['x-api-key'] ||
      req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
      req.query.api_key;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key requerida',
        message: 'Debes proporcionar una API key válida en el header X-API-Key o como parámetro api_key'
      });
    }

    const keyData = await crm.getApiKeyByKey(apiKey);
    if (!keyData) {
      return res.status(401).json({
        success: false,
        error: 'API key inválida',
        message: 'La API key proporcionada no es válida o está desactivada'
      });
    }

    await crm.updateApiKeyUsage(apiKey);
    req.apiKey = keyData;
    req.apiKeyId = keyData.id;
    req.apiKeyAuth = true;
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

module.exports = { requireApiKey, attachApiKeyAuth };
