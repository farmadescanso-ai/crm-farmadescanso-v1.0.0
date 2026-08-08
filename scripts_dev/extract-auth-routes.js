const fs = require('fs');

const src = fs.readFileSync('server-crm-completo.js', 'utf8').split(/\r?\n/);
// Incluir rutas auth pero EXCLUIR helpers locales (generateSecureToken/hash/verify)
// Bloque A: login + google + logout → líneas 1859-2390
// Bloque B: forgot/reset/change → líneas 2420-2776
const partA = src.slice(1858, 2390).join('\n');
const partB = src.slice(2419, 2776).join('\n');
const chunk = `${partA}\n\n${partB}`;

const replacements = [
  [/\bapp\.(get|post|put|delete|use)\(/g, 'router.$1('],
  [/\bisDevelopment\b/g, 'deps.isDevelopment'],
  [/\bisProduction\b/g, 'deps.isProduction'],
  [/\bisProdRuntime\b/g, 'deps.isProdRuntime'],
  [/\bmailTransport\b/g, 'deps.mailTransport'],
  [/\bgenerateToken\b/g, 'deps.generateToken'],
  [/\bverifyPassword\b/g, 'deps.verifyPassword'],
  [/\bhashPassword\b/g, 'deps.hashPassword'],
  [/\bgenerateSecureToken\b/g, 'deps.generateSecureToken'],
  [/\bgetCanonicalOrigin\b/g, 'deps.getCanonicalOrigin'],
  [/\bCOOKIE_NAME\b/g, 'deps.cookieName'],
  [/\bcookieConfig\b/g, 'deps.cookieConfig'],
  [/\brequireAuth\b/g, 'deps.requireAuth'],
  [/\bparseRoll\b/g, 'deps.parseRoll'],
  [/(?<!deps\.)\bcrm\b/g, 'deps.crm']
];

let body = chunk;
for (const [re, to] of replacements) {
  body = body.replace(re, to);
}

const out = `/**
 * Rutas de autenticación (/auth/*) — extraídas del monolito (Fase 2).
 * @param {object} deps dependencias inyectadas desde server-crm-completo.js
 */
const express = require('express');

module.exports = function createAuthRoutes(deps) {
  const router = express.Router();

${body}

  return router;
};
`;

fs.writeFileSync('routes/auth.js', out);
console.log('Wrote routes/auth.js bytes=', Buffer.byteLength(out));
console.log('Has broken fn?', /function deps\./.test(out));
