/**
 * Paths OpenAPI de endpoints MONTADOS en producción
 * (no incluye routes/api/* huérfano).
 */
module.exports = {
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Iniciar sesión',
      description: 'Formulario HTML o body urlencoded. En éxito redirige al dashboard y setea cookie JWT.',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', format: 'password' }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'HTML login (error) o redirect' },
        302: { description: 'Login OK → /dashboard' }
      }
    }
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Cerrar sesión',
      responses: { 302: { description: 'Redirect a login' } }
    }
  },
  '/auth/forgot-password': {
    post: {
      tags: ['Auth'],
      summary: 'Solicitar recuperación de contraseña',
      security: [],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string', format: 'email' } }
            }
          }
        }
      },
      responses: { 200: { description: 'HTML con mensaje genérico' } }
    }
  },
  '/auth/reset-password': {
    post: {
      tags: ['Auth'],
      summary: 'Restablecer contraseña con token',
      security: [],
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              type: 'object',
              required: ['token', 'password', 'confirmPassword'],
              properties: {
                token: { type: 'string' },
                password: { type: 'string', format: 'password' },
                confirmPassword: { type: 'string', format: 'password' }
              }
            }
          }
        }
      },
      responses: { 302: { description: 'OK → login' }, 200: { description: 'Error HTML' } }
    }
  },
  '/auth/change-password': {
    post: {
      tags: ['Auth'],
      summary: 'Cambiar contraseña (usuario autenticado)',
      requestBody: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              type: 'object',
              required: ['currentPassword', 'newPassword'],
              properties: {
                currentPassword: { type: 'string', format: 'password' },
                newPassword: { type: 'string', format: 'password' }
              }
            }
          }
        }
      },
      responses: { 200: { description: 'HTML perfil / resultado' } }
    }
  },

  '/api/health/db': {
    get: {
      tags: ['Health'],
      summary: 'Health check de MySQL',
      security: [],
      responses: {
        200: {
          description: 'BD OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean', example: true },
                  ms: { type: 'integer', example: 200 }
                }
              }
            }
          }
        },
        503: { description: 'BD no disponible' }
      }
    }
  },

  '/api/debug/session': {
    get: {
      tags: ['Debug'],
      summary: 'Diagnóstico de sesión (admin)',
      responses: { 200: { description: 'JSON sesión/JWT' }, 403: { description: 'No admin' } }
    }
  },
  '/api/debug/db': {
    get: {
      tags: ['Debug'],
      summary: 'Diagnóstico BD (admin)',
      responses: { 200: { description: 'JSON config BD (sin password)' } }
    }
  },
  '/api/debug/build': {
    get: {
      tags: ['Debug'],
      summary: 'Info de build/deploy (admin)',
      responses: { 200: { description: 'JSON build' } }
    }
  },
  '/api/debug/mail': {
    get: {
      tags: ['Debug'],
      summary: 'Verificar SMTP (admin)',
      responses: { 200: { description: 'verify ok' }, 503: { description: 'SMTP fail' } }
    }
  },

  '/api/logs-servidor': {
    get: {
      tags: ['Logs'],
      summary: 'Obtener logs del servidor (admin)',
      responses: { 200: { description: 'Logs' } }
    }
  },
  '/api/logs-servidor/limpiar': {
    post: {
      tags: ['Logs'],
      summary: 'Limpiar logs (admin)',
      responses: { 200: { description: 'OK' } }
    }
  },
  '/api/logs-servidor/exportar': {
    get: {
      tags: ['Logs'],
      summary: 'Exportar logs (admin)',
      responses: { 200: { description: 'Archivo/texto' } }
    }
  },

  '/api/keys': {
    get: {
      tags: ['API Keys'],
      summary: 'Listar API keys (admin)',
      responses: {
        200: {
          description: 'Lista de keys',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'array', items: { type: 'object' } },
                  count: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    },
    post: {
      tags: ['API Keys'],
      summary: 'Generar API key (admin)',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['nombre'],
              properties: {
                nombre: { type: 'string' },
                descripcion: { type: 'string' }
              }
            }
          }
        }
      },
      responses: { 201: { description: 'Key creada (incluye api_key en claro una vez)' } }
    }
  },
  '/api/keys/{id}/toggle': {
    put: {
      tags: ['API Keys'],
      summary: 'Activar/desactivar API key (admin)',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { activa: { type: 'boolean' } }
            }
          }
        }
      },
      responses: { 200: { description: 'OK' } }
    }
  },
  '/api/keys/{id}': {
    delete: {
      tags: ['API Keys'],
      summary: 'Eliminar API key (admin)',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'OK' } }
    }
  },

  '/api/provincias': {
    get: {
      tags: ['Catálogos'],
      summary: 'Listar provincias',
      parameters: [
        { name: 'pais', in: 'query', schema: { type: 'string', example: 'ES' } }
      ],
      responses: { 200: { description: 'Lista provincias' } }
    }
  },
  '/api/codigos-postales/resolve': {
    get: {
      tags: ['Catálogos'],
      summary: 'Resolver código postal',
      parameters: [
        { name: 'cp', in: 'query', required: true, schema: { type: 'string' } }
      ],
      responses: { 200: { description: 'Provincia/CP resuelto' } }
    }
  },

  '/api/articulos': {
    get: {
      tags: ['Artículos'],
      summary: 'Listar artículos',
      responses: {
        200: {
          description: 'Lista',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'array', items: { $ref: '#/components/schemas/Articulo' } },
                  count: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/articulos/{id}/okko': {
    post: {
      tags: ['Artículos'],
      summary: 'Cambiar OK/KO de artículo (admin)',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'OK' } }
    }
  },

  '/api/comerciales': {
    get: {
      tags: ['Comerciales'],
      summary: 'Listar comerciales (sin passwords)',
      responses: {
        200: {
          description: 'Lista',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'array', items: { $ref: '#/components/schemas/Comercial' } },
                  count: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  },

  '/api/clientes': {
    get: {
      tags: ['Clientes'],
      summary: 'Listar clientes del comercial autenticado',
      responses: { 200: { description: 'Lista clientes' } }
    }
  },
  '/api/clientes/count': {
    get: {
      tags: ['Clientes'],
      summary: 'Contador de clientes (por rol)',
      security: [],
      responses: {
        200: {
          description: 'count',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  count: { type: 'integer' },
                  totalClientes: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/clientes/buscar': {
    get: {
      tags: ['Clientes'],
      summary: 'Buscar clientes',
      parameters: [
        { name: 'q', in: 'query', schema: { type: 'string' } },
        { name: 'term', in: 'query', schema: { type: 'string' } }
      ],
      responses: { 200: { description: 'Resultados búsqueda' } }
    }
  },
  '/api/clientes/paged': {
    get: {
      tags: ['Clientes'],
      summary: 'Listado paginado de clientes',
      parameters: [
        { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        { name: 'search', in: 'query', schema: { type: 'string' } }
      ],
      responses: { 200: { description: 'Página de clientes' } }
    }
  },
  '/api/clientes/codigo-postal/{idCodigoPostal}': {
    get: {
      tags: ['Clientes'],
      summary: 'Clientes por Id código postal',
      parameters: [
        { name: 'idCodigoPostal', in: 'path', required: true, schema: { type: 'integer' } }
      ],
      responses: { 200: { description: 'Lista' } }
    }
  },
  '/api/clientes/{id}/direcciones-envio': {
    get: {
      tags: ['Clientes'],
      summary: 'Direcciones de envío del cliente',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'Direcciones' } }
    }
  },
  '/api/clientes/{id}/contactos': {
    get: {
      tags: ['Contactos'],
      summary: 'Contactos vinculados al cliente',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'Contactos' } }
    }
  },
  '/api/clientes/{id}/contactos/{contactoId}': {
    post: {
      tags: ['Contactos'],
      summary: 'Vincular contacto a cliente',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'contactoId', in: 'path', required: true, schema: { type: 'integer' } }
      ],
      responses: { 200: { description: 'OK' } }
    },
    delete: {
      tags: ['Contactos'],
      summary: 'Cerrar vínculo contacto-cliente',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'contactoId', in: 'path', required: true, schema: { type: 'integer' } }
      ],
      responses: { 200: { description: 'OK' } }
    }
  },
  '/api/clientes/{id}/borrar': {
    post: {
      tags: ['Clientes'],
      summary: 'Borrar cliente (admin)',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'OK' } }
    }
  },
  '/api/clientes/{id}/okko': {
    post: {
      tags: ['Clientes'],
      summary: 'Cambiar OK/KO del cliente',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'OK' } }
    }
  },
  '/api/clientes/{id}/asignar': {
    post: {
      tags: ['Clientes'],
      summary: 'Asignar cliente a comercial',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { comercialId: { type: 'integer' } }
            }
          }
        }
      },
      responses: { 200: { description: 'OK' } }
    }
  },

  '/api/tarifas-clientes/precio': {
    get: {
      tags: ['Tarifas'],
      summary: 'Obtener precio tarifa cliente/artículo',
      parameters: [
        { name: 'clienteId', in: 'query', schema: { type: 'integer' } },
        { name: 'articuloId', in: 'query', schema: { type: 'integer' } }
      ],
      responses: { 200: { description: 'Precio' } }
    }
  },

  '/api/pedidos': {
    get: {
      tags: ['Pedidos'],
      summary: 'Listar pedidos',
      parameters: [
        {
          name: 'estado',
          in: 'query',
          schema: { type: 'string', enum: ['todos', 'activos', 'inactivos'], default: 'todos' }
        }
      ],
      responses: {
        200: {
          description: 'Lista',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'array', items: { $ref: '#/components/schemas/Pedido' } },
                  count: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/pedidos/{id}/estado': {
    post: {
      tags: ['Pedidos'],
      summary: 'Cambiar estado de pedido',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { estado: { type: 'string' } }
            }
          }
        }
      },
      responses: { 200: { description: 'OK' } }
    }
  },

  '/api/visitas': {
    get: {
      tags: ['Visitas'],
      summary: 'Listar visitas del comercial',
      responses: {
        200: {
          description: 'Lista',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'array', items: { $ref: '#/components/schemas/Visita' } },
                  count: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/visitas/generar-meet': {
    post: {
      tags: ['Visitas'],
      summary: 'Generar reunión Google Meet',
      requestBody: {
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: true }
          }
        }
      },
      responses: { 200: { description: 'URL Meet / resultado' } }
    }
  },
  '/api/visitas/generar-teams': {
    post: {
      tags: ['Visitas'],
      summary: 'Generar reunión Microsoft Teams',
      requestBody: {
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: true }
          }
        }
      },
      responses: { 200: { description: 'URL Teams / resultado' } }
    }
  },
  '/api/visita/proceso/estado': {
    get: {
      tags: ['Visitas'],
      summary: 'Estado de proceso de visita',
      responses: { 200: { description: 'Estado' } }
    }
  },
  '/api/webhook/visita/callback': {
    get: {
      tags: ['Webhooks'],
      summary: 'Callback visita (GET)',
      security: [],
      responses: { 200: { description: 'OK' } }
    },
    post: {
      tags: ['Webhooks'],
      summary: 'Callback visita (POST)',
      security: [],
      responses: { 200: { description: 'OK' } }
    }
  },

  '/api/contactos': {
    get: {
      tags: ['Contactos'],
      summary: 'Listar/buscar contactos',
      parameters: [
        { name: 'search', in: 'query', schema: { type: 'string' } },
        { name: 'includeInactivos', in: 'query', schema: { type: 'boolean' } },
        { name: 'limit', in: 'query', schema: { type: 'integer' } },
        { name: 'offset', in: 'query', schema: { type: 'integer' } }
      ],
      responses: { 200: { description: 'Lista' } }
    },
    post: {
      tags: ['Contactos'],
      summary: 'Crear contacto',
      requestBody: {
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: true }
          }
        }
      },
      responses: { 201: { description: 'Creado' } }
    }
  },
  '/api/contactos/{id}': {
    get: {
      tags: ['Contactos'],
      summary: 'Detalle contacto',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'Contacto' }, 404: { description: 'No encontrado' } }
    },
    put: {
      tags: ['Contactos'],
      summary: 'Actualizar contacto',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: true }
          }
        }
      },
      responses: { 200: { description: 'OK' } }
    }
  },

  '/api/estadisticas': {
    get: {
      tags: ['Estadísticas'],
      summary: 'Estadísticas del comercial autenticado',
      responses: { 200: { description: 'Stats' } }
    }
  },

  '/api/_diag/db': {
    get: {
      tags: ['Diagnóstico'],
      summary: 'Diagnóstico DATABASE()',
      responses: { 200: { description: 'JSON' } }
    }
  },
  '/api/_diag/clientes-buscar': {
    get: {
      tags: ['Diagnóstico'],
      summary: 'Diagnóstico buscador clientes',
      responses: { 200: { description: 'JSON' } }
    }
  },

  '/dashboard/endpoints/openapi.json': {
    get: {
      tags: ['Meta'],
      summary: 'Este documento OpenAPI (JSON)',
      responses: { 200: { description: 'OpenAPI 3 spec' } }
    }
  }
};
