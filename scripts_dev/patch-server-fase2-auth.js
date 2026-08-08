/**
 * Parchea server-crm-completo.js para Fase 2:
 * - usa middleware/auth.js
 * - monta routes/auth.js
 * - elimina bloques duplicados
 */
const fs = require('fs');

const path = 'server-crm-completo.js';
let src = fs.readFileSync(path, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const lines = src.split(/\r?\n/);

function findLine(predicate, from = 0) {
  for (let i = from; i < lines.length; i++) {
    if (predicate(lines[i], i)) return i;
  }
  return -1;
}

// 1) Quitar generateToken/verifyToken tempranos (dejar solo comentario)
const genStart = findLine((l) => l.trim() === '// Funciones JWT');
const helpersStart = findLine((l) => l.includes('Helpers de formato para números de pedido'));
if (genStart < 0 || helpersStart < 0 || helpersStart <= genStart) {
  throw new Error('No se localizó bloque JWT temprano');
}
lines.splice(
  genStart,
  helpersStart - genStart,
  '// JWT helpers: ver middleware/auth.js (createAuth) — se inicializan tras cookieConfig'
);

// Recalcular índices tras splice — releer no, seguimos con array mutado

// 2) Tras session({...}), reemplazar parseRoll + jwt middleware hasta body parser early logging
// Buscar "// Función helper para parsear Roll"
const parseStart = findLine((l) => l.includes('Función helper para parsear Roll'));
const earlyLog = findLine((l) => l.includes('Middleware de logging MUY TEMPRANO'), parseStart);
if (parseStart < 0 || earlyLog < 0) throw new Error('No se localizó bloque parseRoll/JWT middleware');

const authInit = [
  '// ============================================',
  '// Auth centralizado (Fase 2)',
  '// ============================================',
  "const { createAuth } = require('./middleware/auth');",
  'const auth = createAuth({',
  '  jwtSecret: JWT_SECRET,',
  '  jwtExpiresIn: JWT_EXPIRES_IN,',
  '  cookieName: COOKIE_NAME,',
  '  cookieConfig,',
  '  isDevelopment',
  '});',
  'const {',
  '  parseRoll,',
  '  generateToken,',
  '  verifyToken,',
  '  generateSecureToken,',
  '  hashPassword,',
  '  verifyPassword,',
  '  attachJwtFromCookie,',
  '  attachLocals,',
  '  requireAuth,',
  '  requireAdmin,',
  '  requireComercial,',
  '  isAdmin,',
  '  isComercial,',
  '  getUsuarioRol,',
  '  getComercialId,',
  '  getUserIsAdmin',
  '} = auth;',
  '',
  'app.use(attachJwtFromCookie);',
  ''
].join(nl);

lines.splice(parseStart, earlyLog - parseStart, ...authInit.split(nl));

// 3) Quitar requireAuth/isAdmin/.../requireComercial locales; dejar attachLocals ya en auth
// Tras "Configurar EJS" hay requireAuth local
const reqAuthStart = findLine((l) => l.includes('Middleware para verificar autenticación (ahora usa JWT)'));
const filtrarStart = findLine((l) => l.includes('Helper functions para obtener datos según rol'), reqAuthStart);
if (reqAuthStart < 0 || filtrarStart < 0) throw new Error('No se localizó bloque requireAuth local');

// Mantener solo un comentario — attachLocals ya se registra abajo? Está dentro del bloque a borrar.
// Re-insertar app.use(attachLocals) antes de los helpers de rol
const keepLocals = [
  '// user/esAdmin en vistas (middleware/auth)',
  'app.use(attachLocals);',
  ''
].join(nl);

lines.splice(reqAuthStart, filtrarStart - reqAuthStart, ...keepLocals.split(nl));

// 4) Reemplazar rutas /auth/* por app.use(createAuthRoutes)
const authRoutesStart = findLine((l) => l.trim() === '// Rutas de autenticación');
const debugLogin = findLine((l) => l.includes("app.post('/api/debug/login'"), authRoutesStart);
if (authRoutesStart < 0 || debugLogin < 0) throw new Error('No se localizó bloque rutas auth');

// También hay helpers generateSecureToken antes de forgot — ya no deberían existir si auth routes
// fueron desde "Rutas de autenticación". But password helpers are BETWEEN logout and forgot
// inside the block we're deleting. Good — they live in middleware now.

const authMount = [
  '// Rutas de autenticación (Fase 2 → routes/auth.js)',
  "const createAuthRoutes = require('./routes/auth');",
  'app.use(createAuthRoutes({',
  '  crm,',
  '  mailTransport,',
  '  generateToken,',
  '  verifyPassword,',
  '  hashPassword,',
  '  generateSecureToken,',
  '  getCanonicalOrigin,',
  '  cookieName: COOKIE_NAME,',
  '  cookieConfig,',
  '  requireAuth,',
  '  parseRoll,',
  '  isDevelopment,',
  '  isProduction,',
  '  isProdRuntime',
  '}));',
  ''
].join(nl);

lines.splice(authRoutesStart, debugLogin - authRoutesStart, ...authMount.split(nl));

fs.writeFileSync(path, lines.join(nl));
console.log('Patched', path, 'lines=', lines.length);
