/**
 * OpenAPI 3 — endpoints montados del CRM (producción).
 * No documenta routes/api/* huérfano (no cableado).
 */
const paths = require('./openapi-paths');

const CANONICAL = (process.env.APP_BASE_URL || 'https://crm-farmadescanso-v1-0-0.vercel.app').replace(/\/$/, '');

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Farmadescaso CRM API',
    version: '1.0.0',
    description: [
      'API REST y Auth del CRM Farmadescaso.',
      '',
      '**Autenticación**',
      '- **CookieAuth**: cookie `farmadescaso_token` (sesión admin/comercial). En esta UI se envía con `credentials: include`.',
      '- **ApiKeyAuth**: header `X-API-Key` (integraciones). Gestiona keys en Ajustes → API Keys o `POST /api/keys`.',
      '',
      'Solo documenta rutas **montadas** en el servidor. La carpeta `routes/api/*` modular no está activa.'
    ].join('\n'),
    contact: {
      name: 'Farmadescaso 2021 SL',
      email: 'pedidos@farmadescanso.com'
    }
  },
  servers: [
    { url: CANONICAL, description: 'Producción (Vercel)' },
    { url: 'http://localhost:3000', description: 'Desarrollo local' }
  ],
  tags: [
    { name: 'Auth' },
    { name: 'Health' },
    { name: 'API Keys' },
    { name: 'Artículos' },
    { name: 'Clientes' },
    { name: 'Contactos' },
    { name: 'Pedidos' },
    { name: 'Visitas' },
    { name: 'Comerciales' },
    { name: 'Catálogos' },
    { name: 'Tarifas' },
    { name: 'Estadísticas' },
    { name: 'Webhooks' },
    { name: 'Logs' },
    { name: 'Debug' },
    { name: 'Diagnóstico' },
    { name: 'Meta' }
  ],
  components: {
    securitySchemes: {
      CookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'farmadescaso_token',
        description: 'JWT de sesión tras login en el CRM'
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API Key de integración (tabla api_keys)'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          message: { type: 'string' }
        }
      },
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' }
        }
      },
      Articulo: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          SKU: { type: 'string' },
          Nombre: { type: 'string' },
          Presentacion: { type: 'string' },
          PVL: { type: 'number' },
          IVA: { type: 'number' },
          EAN13: { type: 'integer' },
          Activo: { type: 'boolean' }
        }
      },
      Cliente: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          Nombre_Razon_Social: { type: 'string' },
          DNI_CIF: { type: 'string', nullable: true },
          Email: { type: 'string', nullable: true },
          OK_KO: { type: 'integer' }
        }
      },
      Pedido: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          NumPedido: { type: 'string' },
          FechaPedido: { type: 'string', format: 'date' },
          Total: { type: 'number' },
          Estado: { type: 'string' }
        }
      },
      Visita: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          TipoVisita: { type: 'string' },
          Fecha: { type: 'string', format: 'date' },
          Estado: { type: 'string' }
        }
      },
      Comercial: {
        type: 'object',
        properties: {
          Id: { type: 'integer' },
          Nombre: { type: 'string' },
          Email: { type: 'string' },
          Roll: { type: 'string' }
        }
      }
    }
  },
  security: [{ CookieAuth: [] }, { ApiKeyAuth: [] }],
  paths
};

module.exports = swaggerSpec;
