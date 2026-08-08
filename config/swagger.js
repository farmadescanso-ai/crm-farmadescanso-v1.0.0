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
      ApiListMeta: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          count: { type: 'integer' }
        }
      },
      Articulo: {
        type: 'object',
        description: 'Fila de la tabla `articulos` (SELECT *)',
        properties: {
          Id: { type: 'integer', example: 1 },
          SKU: { type: 'string', nullable: true, example: '216959' },
          Nombre: { type: 'string', nullable: true },
          Presentacion: { type: 'string', nullable: true },
          Unidades_Caja: { type: 'integer', nullable: true },
          PVL: { type: 'number', nullable: true },
          PCP: { type: 'number', nullable: true, description: 'Precio coste / PCP' },
          IVA: { type: 'number', nullable: true, example: 21 },
          EAN13: { type: 'string', nullable: true, description: 'Código EAN (string, no integer)' },
          Imagen: { type: 'string', nullable: true },
          Marca: { type: 'string', nullable: true },
          Id_Marca: { type: 'integer', nullable: true },
          Activo: { type: 'integer', nullable: true, description: '0 = inactivo, 1 = activo (no boolean)' }
        }
      },
      Cliente: {
        type: 'object',
        description: 'Fila de `clientes` (SELECT *). En /api/clientes/paged pueden venir campos *_Nombre extra.',
        properties: {
          Id: { type: 'integer', example: 1 },
          Nombre_Razon_Social: { type: 'string', nullable: true },
          DNI_CIF: { type: 'string', nullable: true },
          Email: { type: 'string', nullable: true },
          Telefono: { type: 'string', nullable: true },
          Movil: { type: 'string', nullable: true },
          Direccion: { type: 'string', nullable: true },
          Poblacion: { type: 'string', nullable: true },
          CodigoPostal: { type: 'string', nullable: true },
          Id_Provincia: { type: 'integer', nullable: true },
          Id_Cial: { type: 'integer', nullable: true, description: 'Comercial asignado' },
          Id_TipoCliente: { type: 'integer', nullable: true },
          Tarifa: { type: 'number', nullable: true },
          Id_FormaPago: { type: 'integer', nullable: true },
          OK_KO: { type: 'integer', nullable: true, description: '0 = KO/inactivo, 1 = OK/activo' },
          Id_EstdoCliente: { type: 'integer', nullable: true, description: 'Typo histórico en BD (Estdo)' },
          ProvinciaNombre: { type: 'string', nullable: true, description: 'Solo listados optimizados/paged' },
          TipoClienteNombre: { type: 'string', nullable: true },
          ComercialNombre: { type: 'string', nullable: true },
          EstadoClienteNombre: { type: 'string', nullable: true },
          EstadoClienteId: { type: 'integer', nullable: true },
          TotalPedidos: { type: 'integer', nullable: true }
        }
      },
      Pedido: {
        type: 'object',
        description: 'Fila de `pedidos`. Importes/estado usan TotalPedido y EstadoPedido (no Total/Estado).',
        properties: {
          Id: { type: 'integer', example: 1 },
          NumPedido: { type: 'string', nullable: true },
          Serie: { type: 'string', nullable: true },
          FechaPedido: { type: 'string', format: 'date', nullable: true },
          FechaEntrega: { type: 'string', format: 'date', nullable: true },
          EstadoPedido: { type: 'string', nullable: true, example: 'Pendiente' },
          TotalPedido: { type: 'number', nullable: true },
          BaseImponible: { type: 'number', nullable: true },
          TotalIva: { type: 'number', nullable: true },
          TotalDescuento: { type: 'number', nullable: true },
          Observaciones: { type: 'string', nullable: true },
          Id_Cliente: { type: 'integer', nullable: true },
          Id_Cial: { type: 'integer', nullable: true },
          Id_FormaPago: { type: 'integer', nullable: true },
          Id_TipoPedido: { type: 'integer', nullable: true },
          Id_Tarifa: { type: 'number', nullable: true },
          Id_DireccionEnvio: { type: 'integer', nullable: true },
          numero_cooperativa: { type: 'string', nullable: true },
          cooperativa_nombre: { type: 'string', nullable: true }
        }
      },
      Visita: {
        type: 'object',
        description: 'Fila de `visitas`. El estado canónico es EstadoVisita.',
        properties: {
          Id: { type: 'integer', example: 1 },
          TipoVisita: { type: 'string', nullable: true },
          Fecha: { type: 'string', format: 'date', nullable: true },
          Hora: { type: 'string', nullable: true, example: '10:30' },
          EstadoVisita: { type: 'string', nullable: true },
          Descripcion: { type: 'string', nullable: true },
          Notas: { type: 'string', nullable: true },
          EnalaceReunion: { type: 'string', nullable: true, description: 'Typo histórico en BD (Enalace)' },
          plataforma_reunion: { type: 'string', nullable: true, example: 'meet' },
          emails_invitados: { type: 'string', nullable: true },
          FarmaciaCliente: { type: 'string', nullable: true, description: 'Id o valor según origen (puede venir numérico serializado)' },
          CentroSalud: { type: 'string', nullable: true, description: 'Id o valor según origen' },
          Id_Cial: { type: 'integer', nullable: true },
          ImpactosFarmacia: { type: 'integer', nullable: true },
          ImpactosCentroSalud: { type: 'integer', nullable: true }
        }
      },
      Comercial: {
        type: 'object',
        description: 'Fila de `comerciales` sin Password (sanitizeComercialForApi). Id puede llegar como id o Id.',
        properties: {
          Id: { type: 'integer', example: 1 },
          id: { type: 'integer', description: 'Alias según driver/consulta' },
          Nombre: { type: 'string', nullable: true },
          Email: { type: 'string', nullable: true },
          DNI: { type: 'string', nullable: true },
          Roll: {
            type: 'string',
            nullable: true,
            description: 'Suele ser JSON string, p.ej. ["Administrador"] o ["Comercial"]',
            example: '["Comercial"]'
          },
          Movil: { type: 'string', nullable: true },
          Direccion: { type: 'string', nullable: true },
          CodigoPostal: { type: 'string', nullable: true },
          Poblacion: { type: 'string', nullable: true },
          Id_Provincia: { type: 'integer', nullable: true },
          Id_CodigoPostal: { type: 'integer', nullable: true },
          fijo_mensual: { type: 'number', nullable: true },
          plataforma_reunion_preferida: { type: 'string', nullable: true, example: 'meet' }
        }
      },
      Contacto: {
        type: 'object',
        description: 'Persona global (tabla contactos)',
        properties: {
          Id: { type: 'integer' },
          Nombre: { type: 'string', nullable: true },
          Apellidos: { type: 'string', nullable: true },
          Empresa: { type: 'string', nullable: true },
          Email: { type: 'string', nullable: true },
          Telefono: { type: 'string', nullable: true },
          Movil: { type: 'string', nullable: true },
          Cargo: { type: 'string', nullable: true },
          Activo: { type: 'integer', nullable: true, description: '0|1' }
        }
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string' },
          api_key: { type: 'string' },
          descripcion: { type: 'string', nullable: true },
          activa: { type: 'integer', description: '0|1' },
          ultimo_uso: { type: 'string', format: 'date-time', nullable: true },
          creado_en: { type: 'string', format: 'date-time', nullable: true },
          creado_por: { type: 'integer', nullable: true }
        }
      }
    }
  },
  security: [{ CookieAuth: [] }, { ApiKeyAuth: [] }],
  paths
};

module.exports = swaggerSpec;
