# API REST modular — NO MONTADA (Fase 2)

Este directorio (`routes/api/*`) describe una API REST con API keys y Swagger,
pero **no está cableada** en `server-crm-completo.js`.

## Estado actual
- El runtime usa handlers inline en el monolito (`/api/comerciales`, `/api/pedidos`, etc.).
- Montar este router tal cual sería riesgoso (p. ej. rutas de clientes sin `requireApiKey` uniforme).

## Decisión (Fase 2)
**No montar.** Se mantiene en el repo solo como referencia / posible trabajo futuro.

Si en el futuro se activa:
1. Revisar auth en cada sub-router.
2. `app.use('/api/v2', require('./routes/api'))` (o similar) de forma explícita.
3. Actualizar Swagger para no documentar endpoints fantasma.
