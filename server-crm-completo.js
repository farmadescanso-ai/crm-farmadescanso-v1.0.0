// ============================================
// CRM Farmadescaso - Servidor Principal
// Configurado para desarrollo local y producción
// ============================================
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Logging de inicio
console.log('🚀 [INICIO] Servidor CRM Farmadescaso iniciando...');
console.log('🚀 [INICIO] Modo:', process.env.NODE_ENV || 'development');
console.log('🚀 [INICIO] Timestamp:', new Date().toISOString());

// Node 18+ / Vercel: fetch global (evita node-fetch ESM)
const fetch = (...args) => globalThis.fetch(...args);
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const serverLogs = require('./utils/server-logs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ============================================
// Seguridad: secretos y helpers de blindaje
// ============================================
const isProdRuntime = () =>
  process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

const WEAK_SECRET_DEFAULTS = new Set([
  'farmadescaso_jwt_secret_change_in_production',
  'farmadescaso_secret',
  'tu_secreto_super_seguro_aqui_cambiar_en_produccion'
]);

/** Si no es null, la app responde 503 con instrucciones (no usa process.exit en Vercel). */
let bootSecurityError = null;

function resolveSecret(envKeys, weakFallbackForDev) {
  for (const key of envKeys) {
    const value = process.env[key];
    if (value && String(value).trim()) return String(value).trim();
  }
  if (isProdRuntime()) {
    bootSecurityError =
      `Falta secreto obligatorio (${envKeys.join(' o ')}). ` +
      'En Vercel → Project → Settings → Environment Variables, créalo para el entorno Production y redespliega.';
    console.error('❌ [SEGURIDAD]', bootSecurityError);
    return 'BOOT_SECURITY_ERROR_PLACEHOLDER';
  }
  console.warn(
    `⚠️ [SEGURIDAD] Usando secreto de desarrollo inseguro para ${envKeys[0]}. ` +
    'Nunca uses esto en producción.'
  );
  return weakFallbackForDev;
}

// Configuración JWT (en producción exige secreto; si falta, 503 con mensaje claro)
console.log('🔐 [SEGURIDAD] JWT_SECRET definido:', Boolean(process.env.JWT_SECRET));
console.log('🔐 [SEGURIDAD] SESSION_SECRET definido:', Boolean(process.env.SESSION_SECRET));
const JWT_SECRET = resolveSecret(
  ['JWT_SECRET', 'SESSION_SECRET'],
  'farmadescaso_jwt_secret_dev_only'
);
if (!bootSecurityError && WEAK_SECRET_DEFAULTS.has(JWT_SECRET) && isProdRuntime()) {
  bootSecurityError =
    'JWT_SECRET/SESSION_SECRET usa un valor débil conocido. Genera un secreto aleatorio largo y actualízalo en Vercel (Production).';
  console.error('❌ [SEGURIDAD]', bootSecurityError);
}
const JWT_EXPIRES_IN = '30d'; // 30 días
const COOKIE_NAME = 'farmadescaso_token';

// URL canónica de producción (única permitida en Vercel; las preview redirigen aquí)
const CANONICAL_PRODUCTION_ORIGIN = 'https://crm-farmadescanso-v1-0-0.vercel.app';

function getCanonicalOrigin() {
  const fromEnv = (process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return CANONICAL_PRODUCTION_ORIGIN;
}

function getRequestHostname(req) {
  const raw = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  return raw.split(':')[0].toLowerCase();
}

function isCanonicalHost(hostname) {
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  try {
    return hostname === new URL(getCanonicalOrigin()).hostname.toLowerCase();
  } catch (_) {
    return hostname === 'crm-farmadescanso-v1-0-0.vercel.app';
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Solo dominio canónico en runtime de Vercel (anula URLs preview / deployment hash)
app.use((req, res, next) => {
  if (!isProdRuntime()) return next();
  const hostname = getRequestHostname(req);
  if (isCanonicalHost(hostname)) return next();

  // Permitir el hostname interno del propio deploy (VERCEL_URL) para health/capturas de Vercel,
  // pero redirigir inmediatamente al dominio canónico sin página intermedia.
  const vercelUrlHost = String(process.env.VERCEL_URL || '')
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .toLowerCase();

  const targetBase = getCanonicalOrigin();
  const targetUrl = `${targetBase}${req.originalUrl || '/'}`;

  // Crawlers / capturas de Vercel / APIs: redirect limpio 302 (evita miniatura engañosa)
  const accept = String(req.get('accept') || '');
  const ua = String(req.get('user-agent') || '');
  const wantsHtml = accept.includes('text/html');
  const looksLikeBrowser = /Mozilla|Chrome|Safari|Firefox|Edg/i.test(ua) && !/bot|crawler|spider|vercel/i.test(ua);

  if (!wantsHtml || !looksLikeBrowser || (vercelUrlHost && hostname === vercelUrlHost)) {
    return res.redirect(302, targetUrl);
  }

  const safeTarget = targetUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const safeHost = String(hostname || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

  res.status(200).type('html').send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="3;url=${safeTarget}">
  <title>URL no válida — redirigiendo</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:560px;margin:3rem auto;padding:0 1.25rem;line-height:1.5;color:#111}
    a{color:#0b891b;font-weight:600}
    .box{border:1px solid #e5e7eb;border-radius:12px;padding:1.25rem 1.5rem;background:#fafafa}
    code{font-size:0.9em;word-break:break-all}
  </style>
</head>
<body>
  <div class="box">
    <h1>Esta URL ya no está en uso</h1>
    <p>Has entrado por una dirección temporal de Vercel (<code>${safeHost}</code>), que puede corresponder a una versión antigua.</p>
    <p>La única dirección válida del CRM es:</p>
    <p><a href="${safeTarget}">${safeTarget}</a></p>
    <p>Serás redirigido automáticamente en unos segundos…</p>
  </div>
  <script>setTimeout(function(){ location.replace(${JSON.stringify(targetUrl)}); }, 2500);</script>
</body>
</html>`);
});

// Bloqueo temprano si faltan secretos en producción (evita crash opaco FUNCTION_INVOCATION_FAILED)
app.use((req, res, next) => {
  if (!bootSecurityError) return next();
  if (req.path === '/api/health/db' || req.path === '/db') {
    return res.status(503).json({
      ok: false,
      error: 'boot_security_error',
      message: bootSecurityError,
      hints: {
        jwtSecretSet: Boolean(process.env.JWT_SECRET),
        sessionSecretSet: Boolean(process.env.SESSION_SECRET),
        nodeEnv: process.env.NODE_ENV || null,
        vercel: process.env.VERCEL || null
      }
    });
  }
  res.status(503).type('html').send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Configuración incompleta</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:3rem auto;padding:0 1rem;line-height:1.5}
code{background:#f3f4f6;padding:0.1em 0.35em;border-radius:4px}</style>
</head><body>
<h1>Configuración incompleta (503)</h1>
<p>${bootSecurityError.replace(/</g, '&lt;')}</p>
<p>Variables detectadas:</p>
<ul>
<li><code>JWT_SECRET</code>: ${process.env.JWT_SECRET ? 'definida' : 'NO definida'}</li>
<li><code>SESSION_SECRET</code>: ${process.env.SESSION_SECRET ? 'definida' : 'NO definida'}</li>
</ul>
<p>Tras guardarlas en <strong>Production</strong>, haz Redeploy en Vercel.</p>
</body></html>`);
});

/** Bloquea rutas de diagnóstico/test en producción (404). */
function blockInProduction(req, res, next) {
  if (isProdRuntime()) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

/** Elimina campos de contraseña de objetos comercial antes de exponerlos por API. */
function sanitizeComercialForApi(comercial) {
  if (!comercial || typeof comercial !== 'object') return comercial;
  const out = { ...comercial };
  for (const key of Object.keys(out)) {
    if (/password|contraseña|passwd|secret/i.test(key)) {
      delete out[key];
    }
  }
  return out;
}

/** Redacta campos sensibles de un body para logs. */
function redactSensitive(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (/password|contraseña|passwd|token|secret|authorization|cookie/i.test(k)) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = redactSensitive(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// JWT helpers: ver middleware/auth.js (createAuth) — se inicializan tras cookieConfig
// Helpers de formato para números de pedido
const obtenerParteNumericaPedido = (displayValue, fechaReferencia) => {
  if (displayValue === undefined || displayValue === null) return null;
  const displayStr = String(displayValue).trim();
  if (!displayStr) return null;

  const digits = displayStr.replace(/[^0-9]/g, '');
  if (!digits) return null;

  if (digits.length >= 3) {
    const numeroEntero = parseInt(digits, 10);
    return Number.isNaN(numeroEntero) ? null : numeroEntero;
  }

  const yearShort = fechaReferencia
    ? String(new Date(fechaReferencia).getFullYear()).slice(-2)
    : String(new Date().getFullYear()).slice(-2);
  const secuencia = digits.padStart(4, '0');
  const compuesto = `${yearShort}${secuencia}`;
  const numeroEntero = parseInt(compuesto, 10);
  return Number.isNaN(numeroEntero) ? null : numeroEntero;
};

const formatearNumeroPedido = (valor, fechaReferencia) => {
  if (valor === undefined || valor === null) return '';
  const original = String(valor).trim();
  if (!original) return '';

  if (/^P\d+/i.test(original)) {
    const digits = original.replace(/[^0-9]/g, '');
    if (!digits) return original.toUpperCase();
    const yearShort = digits.slice(0, 2).padStart(2, '0');
    const secuencia = digits.slice(2);
    const secuenciaDisplay = secuencia ? secuencia.padStart(Math.max(4, secuencia.length), '0') : '0000';
    return `P${yearShort}${secuenciaDisplay}`;
  }

  const digits = original.replace(/[^0-9]/g, '');
  if (!digits) {
    const yearShort = fechaReferencia
      ? String(new Date(fechaReferencia).getFullYear()).slice(-2)
      : String(new Date().getFullYear()).slice(-2);
    return `P${yearShort}0001`;
  }

  const yearShort = digits.length >= 2
    ? digits.slice(0, 2)
    : (fechaReferencia
      ? String(new Date(fechaReferencia).getFullYear()).slice(-2)
      : String(new Date().getFullYear()).slice(-2));

  const secuencia = digits.length > 2 ? digits.slice(2) : digits;
  const secuenciaDisplay = secuencia
    ? secuencia.padStart(Math.max(4, secuencia.length), '0')
    : '0000';

  return `P${yearShort}${secuenciaDisplay}`;
};

// Función auxiliar para calcular el precio de compra total de un pedido
// Relación: Pedidos -> Pedidos_Articulos (por Id_NumPedido o NumPedido) -> Articulos (por Id_Articulo) -> PCP
// El PCP Total del pedido es la suma de (Cantidad × PCP) de todas las líneas del pedido
// Retorna: { total: number, debug: object }
const calcularPrecioCompraPedido = async (pedido, incluirDebug = false) => {
  const debugInfo = {
    pedidoId: null,
    numPedido: null,
    sqlUsado: null,
    lineasEncontradas: 0,
    lineasConPCP: 0,
    lineasSinPCP: 0,
    detalleLineas: [],
    error: null,
    totalCalculado: 0
  };
  
  try {
    const pedidoId = pedido.Id || pedido.id;
    const numPedido = pedido.NumPedido || pedido.Numero_Pedido || '';
    
    debugInfo.pedidoId = pedidoId;
    debugInfo.numPedido = numPedido;
    
    if (!pedidoId) {
      debugInfo.error = 'Pedido sin ID válido';
      return incluirDebug ? { total: 0, debug: debugInfo } : 0;
    }
    
    // Obtener las líneas del pedido con el precio de compra (PCP) de cada artículo
    // La relación es: 
    // - Pedidos_Articulos.Id_NumPedido = Pedidos.id (relación por ID numérico)
    // - Pedidos_Articulos.NumPedido = Pedidos.NumPedido (relación por número de pedido string)
    // - Pedidos_Articulos.Id_Articulo = Articulos.id (para obtener el PCP)
    // Intentar primero con Id_NumPedido (más eficiente)
    let sql = `
      SELECT 
        pa.Cantidad,
        pa.Id_Articulo,
        a.PCP,
        a.Nombre as articulo_nombre
      FROM Pedidos_Articulos pa
      INNER JOIN Articulos a ON a.id = pa.Id_Articulo
      WHERE pa.Id_NumPedido = ?
    `;
    
    let lineas;
    try {
      lineas = await crm.query(sql, [pedidoId]);
      debugInfo.sqlUsado = 'Pedidos_Articulos con Id_NumPedido';
      
      // Si no hay resultados con Id_NumPedido, intentar con NumPedido
      if (!lineas || lineas.length === 0) {
        sql = `
          SELECT 
            pa.Cantidad,
            pa.Id_Articulo,
            a.PCP,
            a.Nombre as articulo_nombre
          FROM Pedidos_Articulos pa
          INNER JOIN Articulos a ON a.id = pa.Id_Articulo
          WHERE pa.NumPedido = ?
        `;
        lineas = await crm.query(sql, [numPedido]);
        debugInfo.sqlUsado = 'Pedidos_Articulos con NumPedido';
      }
    } catch (error) {
      // Si falla, intentar con nombres de tabla en minúsculas
      console.log(`⚠️ [PRECIO-COMPRA] Error con tablas capitalizadas, intentando minúsculas...`);
      debugInfo.error = `Error con tablas capitalizadas: ${error.message}`;
      try {
        sql = `
          SELECT 
            pa.Cantidad,
            pa.Id_Articulo,
            a.PCP,
            a.Nombre as articulo_nombre
          FROM pedidos_articulos pa
          INNER JOIN articulos a ON a.id = pa.Id_Articulo
          WHERE pa.Id_NumPedido = ?
        `;
        lineas = await crm.query(sql, [pedidoId]);
        debugInfo.sqlUsado = 'pedidos_articulos con Id_NumPedido (minúsculas)';
        
        if (!lineas || lineas.length === 0) {
          sql = `
            SELECT 
              pa.Cantidad,
              pa.Id_Articulo,
              a.PCP,
              a.Nombre as articulo_nombre
            FROM pedidos_articulos pa
            INNER JOIN articulos a ON a.id = pa.Id_Articulo
            WHERE pa.NumPedido = ?
          `;
          lineas = await crm.query(sql, [numPedido]);
          debugInfo.sqlUsado = 'pedidos_articulos con NumPedido (minúsculas)';
        }
      } catch (error2) {
        console.error(`❌ [PRECIO-COMPRA] Error con ambas variantes de nombres de tabla:`, error2.message);
        debugInfo.error = `Error con ambas variantes: ${error2.message}`;
        return incluirDebug ? { total: 0, debug: debugInfo } : 0;
      }
    }
    
    if (!lineas || lineas.length === 0) {
      debugInfo.error = 'No se encontraron líneas para el pedido';
      return incluirDebug ? { total: 0, debug: debugInfo } : 0;
    }
    
    debugInfo.lineasEncontradas = lineas.length;
    
    // Calcular el precio de compra total: sumar (cantidad × PCP) de cada línea
    // IMPORTANTE: Si PCP es NULL, se trata como 0 (no se suma nada para esa línea)
    let precioCompraTotal = 0;
    let lineasConPCP = 0;
    let lineasSinPCP = 0;
    
    for (const linea of lineas) {
      const cantidad = parseFloat(linea.Cantidad || linea.cantidad || 0);
      const pcp = parseFloat(linea.PCP || linea.pcp || 0);
      const articuloId = linea.Id_Articulo || linea.id_articulo;
      const articuloNombre = linea.articulo_nombre || linea.Nombre || 'Sin nombre';
      
      const detalleLinea = {
        articuloId: articuloId,
        articuloNombre: articuloNombre,
        cantidad: cantidad,
        pcp: pcp,
        subtotal: 0,
        procesada: false,
        motivoExclusion: null
      };
      
      if (isNaN(cantidad) || cantidad <= 0) {
        console.warn(`⚠️ [PRECIO-COMPRA] Línea con cantidad inválida: ${linea.Cantidad} (artículo: ${articuloNombre})`);
        detalleLinea.motivoExclusion = `Cantidad inválida: ${linea.Cantidad}`;
        if (incluirDebug) debugInfo.detalleLineas.push(detalleLinea);
        continue;
      }
      
      // Si PCP es NULL o 0, no sumar nada para esa línea
      if (isNaN(pcp) || pcp <= 0) {
        lineasSinPCP++;
        detalleLinea.motivoExclusion = `PCP inválido o NULL: ${linea.PCP}`;
        if (pedidoId <= 3) {
          console.log(`ℹ️ [PRECIO-COMPRA] Artículo ${articuloId} (${articuloNombre}) sin PCP definido o PCP = 0`);
        }
        if (incluirDebug) debugInfo.detalleLineas.push(detalleLinea);
        continue;
      }
      
      // Calcular: Cantidad × PCP para esta línea
      const subtotalLinea = cantidad * pcp;
      precioCompraTotal += subtotalLinea;
      lineasConPCP++;
      detalleLinea.subtotal = subtotalLinea;
      detalleLinea.procesada = true;
      if (incluirDebug) debugInfo.detalleLineas.push(detalleLinea);
    }
    
    debugInfo.lineasConPCP = lineasConPCP;
    debugInfo.lineasSinPCP = lineasSinPCP;
    debugInfo.totalCalculado = precioCompraTotal;
    
    // Logging solo para los primeros 3 pedidos para no saturar
    if (pedidoId <= 3) {
      console.log(`✅ [PRECIO-COMPRA] Pedido ${pedidoId} (${numPedido}): ${lineas.length} líneas totales, ${lineasConPCP} con PCP, ${lineasSinPCP} sin PCP, Total PCP = ${precioCompraTotal.toFixed(2)}`);
    }
    
    return incluirDebug ? { total: precioCompraTotal, debug: debugInfo } : precioCompraTotal;
  } catch (error) {
    console.error(`❌ [PRECIO-COMPRA] Error calculando precio de compra del pedido ${pedido.Id || pedido.id}:`, error.message);
    console.error(`❌ [PRECIO-COMPRA] Stack:`, error.stack);
    debugInfo.error = error.message;
    return incluirDebug ? { total: 0, debug: debugInfo } : 0;
  }
};

// Función auxiliar para obtener la comisión de un pedido específico desde la tabla comisiones_detalle
// IMPORTANTE: Esta función debe estar definida ANTES de usarse en las rutas
const calcularComisionPedido = async (pedido) => {
  try {
    const pedidoId = pedido.Id || pedido.id;
    
    if (!pedidoId) {
      return 0;
    }
    
    // Obtener la comisión total del pedido desde la tabla comisiones_detalle
    // Esta es la forma correcta: consultar las comisiones ya calculadas y guardadas
    const comisionesCRM = require('./config/mysql-crm-comisiones');
    
    // Verificar que comisionesCRM tenga el método query
    if (!comisionesCRM || typeof comisionesCRM.query !== 'function') {
      console.error(`❌ [COMISIONES] comisionesCRM no tiene método query`);
      return 0;
    }
    
    // Intentar con diferentes nombres de tabla (puede ser case-sensitive)
    let sql = `
      SELECT SUM(importe_comision) as total_comision
      FROM comisiones_detalle
      WHERE pedido_id = ?
    `;
    
    let resultado;
    try {
      resultado = await comisionesCRM.query(sql, [pedidoId]);
    } catch (error) {
      // Si falla, intentar con nombre de tabla capitalizado
      console.log(`⚠️ [COMISIONES] Error con tabla minúscula, intentando capitalizada...`);
      sql = `
        SELECT SUM(importe_comision) as total_comision
        FROM Comisiones_Detalle
        WHERE pedido_id = ?
      `;
      resultado = await comisionesCRM.query(sql, [pedidoId]);
    }
    
    const totalComision = parseFloat(resultado[0]?.total_comision || 0);
    
    // Solo loggear los primeros 3 para no saturar
    if (pedidoId <= 3) {
      console.log(`✅ [COMISIONES] Pedido ${pedidoId}: Comisión = ${totalComision.toFixed(2)}`);
    }
    
    return totalComision;
  } catch (error) {
    console.error(`❌ [COMISIONES] Error obteniendo comisión del pedido ${pedido.Id || pedido.id}:`, error.message);
    // Si hay error, retornar 0 en lugar de lanzar excepción
    return 0;
  }
};

// Función auxiliar para recalcular comisiones después de crear/actualizar un pedido
const recalcularComisionesPedido = async (pedidoId) => {
  try {
    console.log(`🔄 [COMISIONES] Recalculando comisiones para pedido ${pedidoId}...`);
    
    // Obtener el pedido
    const pedido = await crm.getPedidoById(pedidoId);
    if (!pedido) {
      console.warn(`⚠️ [COMISIONES] Pedido ${pedidoId} no encontrado`);
      return;
    }

    // Obtener comercial del pedido
    const comercialIdRaw =
      pedido.Id_Cial ??
      pedido.id_cial ??
      pedido.Comercial_id ??
      pedido.comercial_id ??
      pedido.ComercialId ??
      pedido.comercialId ??
      null;
    const comercialId = comercialIdRaw ? Number(comercialIdRaw) : null;
    if (!comercialId) {
      console.warn(`⚠️ [COMISIONES] Pedido ${pedidoId} no tiene comercial asignado`);
      return;
    }

    // Obtener fecha del pedido
    const fechaPedido = pedido.FechaPedido || pedido.fecha_pedido || pedido['Fecha Pedido'] || pedido.fecha || null;
    if (!fechaPedido) {
      console.warn(`⚠️ [COMISIONES] Pedido ${pedidoId} no tiene fecha`);
      return;
    }

    const fecha = new Date(fechaPedido);
    const mes = fecha.getMonth() + 1; // getMonth() devuelve 0-11
    const año = fecha.getFullYear();

    // Verificar que el pedido no esté anulado
    const estadoPedido = pedido.EstadoPedido || pedido.Estado || pedido.estado_pedido || pedido.estado || '';
    if (estadoPedido.toLowerCase() === 'anulado') {
      console.log(`ℹ️ [COMISIONES] Pedido ${pedidoId} está anulado, recalculando comisiones del mes ${mes}/${año}...`);
    }

    // Recalcular comisiones del mes
    const usuarioId = comercialId; // Usar el comercial como calculado_por
    await calculadorComisiones.calcularComisionMensual(comercialId, mes, año, usuarioId);
    
    console.log(`✅ [COMISIONES] Comisiones recalculadas para comercial ${comercialId}, mes ${mes}/${año}`);
  } catch (error) {
    console.error(`❌ [COMISIONES] Error recalculando comisiones para pedido ${pedidoId}:`, error.message);
    // No lanzar el error para no bloquear la creación/actualización del pedido
  }
};

// Función para formatear moneda en formato español (punto para miles, coma para decimales)
const formatearMonedaES = (valor, opciones = {}) => {
  const numero = Number(valor || 0);
  const minimumFractionDigits = opciones.minimumFractionDigits ?? 2;
  const maximumFractionDigits = opciones.maximumFractionDigits ?? 2;
  
  // Formatear el número con punto como separador de miles y coma como separador decimal
  const partes = numero.toFixed(maximumFractionDigits).split('.');
  const parteEntera = partes[0];
  const parteDecimal = partes[1] || '';
  
  // Agregar puntos como separadores de miles
  const parteEnteraFormateada = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Combinar con coma como separador decimal
  if (minimumFractionDigits > 0 || parteDecimal) {
    return parteEnteraFormateada + ',' + parteDecimal.padEnd(minimumFractionDigits, '0');
  }
  
  return parteEnteraFormateada;
};

// Función para formatear números enteros con punto como separador de miles
const formatearNumeroES = (valor) => {
  const numero = Number(valor || 0);
  const parteEntera = Math.floor(Math.abs(numero)).toString();
  const parteEnteraFormateada = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return numero < 0 ? '-' + parteEnteraFormateada : parteEnteraFormateada;
};

// Importar CRM completo de Farmadescaso (MySQL directo)
const crm = require('./config/mysql-crm');
const calculadorComisiones = require('./utils/calcular-comisiones');

// ============================================
// HEALTHCHECK DB — en error muestra diagnóstico seguro (sin password)
app.get('/api/health/db', async (req, res) => {
  const startedAt = Date.now();
  const safeDiag = {
    dbHost: process.env.DB_HOST || '(no definido)',
    dbPort: process.env.DB_PORT || '(no definido)',
    dbName: process.env.DB_NAME || (process.env.VERCEL ? 'crm_farmadescanso' : 'farmadescanso'),
    dbUser: process.env.DB_USER || '(no definido / default root)',
    dbPasswordSet: Boolean(process.env.DB_PASSWORD && String(process.env.DB_PASSWORD).length > 0),
    dbPasswordLength: process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD).length : 0
  };
  try {
    if (!crm.connected) {
      await crm.connect();
    }
    await crm.query('SELECT 1 as ok');
    const payload = {
      ok: true,
      ms: Date.now() - startedAt
    };
    if (!isProdRuntime()) {
      Object.assign(payload, safeDiag);
    }
    res.json(payload);
  } catch (error) {
    res.status(503).json({
      ok: false,
      ms: Date.now() - startedAt,
      code: error.code || null,
      errno: error.errno || null,
      sqlState: error.sqlState || null,
      message: error.message || 'Database unavailable',
      ...safeDiag,
      hint:
        error.code === 'ER_ACCESS_DENIED_ERROR'
          ? 'Usuario/password no coinciden con MySQL. Verifica DB_USER/DB_PASSWORD en Vercel (Production).'
          : error.code === 'ER_BAD_DB_ERROR'
            ? 'DB_NAME incorrecto. Debe ser exactamente crm_farmadescanso (sin espacios).'
            : null
    });
  }
});

// Alias simple — mismo payload reducido; diagnóstico detallado solo fuera de prod.
app.get('/db', blockInProduction, async (req, res) => {
  const startedAt = Date.now();
  try {
    if (!crm.connected) {
      await crm.connect();
    }
    await crm.query('SELECT 1 as ok');
    res.json({
      ok: true,
      ms: Date.now() - startedAt,
      dbHost: process.env.DB_HOST || '(no definido)',
      dbPort: process.env.DB_PORT || '(no definido)',
      dbName: process.env.DB_NAME || '(no definido)'
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      ms: Date.now() - startedAt,
      dbHost: process.env.DB_HOST || '(no definido)',
      dbPort: process.env.DB_PORT || '(no definido)',
      dbName: process.env.DB_NAME || '(no definido)',
      code: error.code || null,
      message: error.message
    });
  }
});

// ============================================
// DIAGNÓSTICO DE DATOS/TABLAS (solo desarrollo)
// ============================================
app.get('/api/health/db/diag', blockInProduction, async (req, res) => {
  const startedAt = Date.now();
  const result = {
    ok: false,
    ms: null,
    dbHost: process.env.DB_HOST || '(no definido)',
    dbPort: process.env.DB_PORT || '(no definido)',
    dbName: process.env.DB_NAME || '(no definido)',
    currentUser: null,
    database: null,
    showTables: {
      ok: false,
      tableCount: 0,
      tablesSample: [],
      error: null
    },
    counts: {},
    errors: []
  };

  const safeError = (e) => ({
    code: e?.code || null,
    errno: e?.errno || null,
    sqlState: e?.sqlState || null,
    message: e?.message || String(e)
  });

  const tryCount = async (tableName) => {
    const sql = `SELECT COUNT(*) as total FROM \`${tableName}\``;
    const rows = await crm.query(sql);
    return Number(rows?.[0]?.total ?? 0);
  };

  try {
    if (!crm.connected) {
      await crm.connect();
    }

    try {
      const who = await crm.query('SELECT CURRENT_USER() as currentUser, USER() as user, DATABASE() as db');
      result.currentUser = who?.[0]?.currentUser || who?.[0]?.user || null;
      result.database = who?.[0]?.db || null;
    } catch (e) {
      result.errors.push({ step: 'whoami', ...safeError(e) });
    }

    try {
      const tables = await crm.query('SHOW TABLES');
      result.showTables.ok = true;
      result.showTables.tableCount = Array.isArray(tables) ? tables.length : 0;
      // Normalizar: SHOW TABLES devuelve columna con nombre variable (Tables_in_<db>)
      const sample = (tables || []).slice(0, 60).map((row) => {
        if (!row || typeof row !== 'object') return String(row);
        const firstKey = Object.keys(row)[0];
        return row[firstKey];
      }).filter(Boolean);
      result.showTables.tablesSample = sample;
    } catch (e) {
      result.showTables.error = safeError(e);
    }

    const tablePairs = [
      ['comerciales', 'Comerciales'],
      ['clientes', 'Clientes'],
      ['pedidos', 'Pedidos'],
      ['articulos', 'Articulos'],
      ['visitas', 'Visitas'],
      ['codigos_postales', 'Codigos_Postales'],
      ['clientes_cooperativas', 'Clientes_Cooperativas'],
      ['cooperativas', 'Cooperativas']
    ];

    for (const [lower, upper] of tablePairs) {
      const key = `${lower}|${upper}`;
      result.counts[key] = { used: null, total: null, error: null };
      try {
        const totalLower = await tryCount(lower);
        result.counts[key] = { used: lower, total: totalLower, error: null };
      } catch (e1) {
        try {
          const totalUpper = await tryCount(upper);
          result.counts[key] = { used: upper, total: totalUpper, error: null };
        } catch (e2) {
          result.counts[key] = { used: null, total: null, error: { lower: safeError(e1), upper: safeError(e2) } };
        }
      }
    }

    result.ok = true;
    result.ms = Date.now() - startedAt;
    return res.json(result);
  } catch (e) {
    result.ok = false;
    result.ms = Date.now() - startedAt;
    result.errors.push({ step: 'connect_or_root', ...safeError(e) });
    return res.status(503).json(result);
  }
});

// ============================================
// RUTA DE PRUEBA TEMPORAL PARA VERIFICAR MARCAS
// ============================================
// Esta ruta se registra muy temprano para asegurar que funcione
app.get('/test-marcas-simple', blockInProduction, async (req, res) => {
  try {
    console.log('🔍 [TEST-MARCAS-SIMPLE] Probando acceso a tabla Marcas...');
    
    // Esperar a que la conexión esté lista
    if (!crm.connected) {
      await crm.connect();
    }
    
    // Intentar diferentes variantes
    let marcas = null;
    let consultaUsada = '';
    
    try {
      marcas = await crm.query('SELECT * FROM `Marcas` ORDER BY Nombre ASC');
      consultaUsada = 'SELECT * FROM `Marcas`';
      console.log('✅ [TEST-MARCAS-SIMPLE] Consulta con `Marcas` exitosa');
    } catch (e1) {
      console.log('⚠️ [TEST-MARCAS-SIMPLE] Error con `Marcas`, intentando `marcas`...');
      try {
        marcas = await crm.query('SELECT * FROM `marcas` ORDER BY Nombre ASC');
        consultaUsada = 'SELECT * FROM `marcas`';
        console.log('✅ [TEST-MARCAS-SIMPLE] Consulta con `marcas` exitosa');
      } catch (e2) {
        console.log('⚠️ [TEST-MARCAS-SIMPLE] Error con `marcas`, intentando sin backticks...');
        marcas = await crm.query('SELECT * FROM marcas ORDER BY Nombre ASC');
        consultaUsada = 'SELECT * FROM marcas';
        console.log('✅ [TEST-MARCAS-SIMPLE] Consulta sin backticks exitosa');
      }
    }
    
    res.json({
      exito: true,
      consultaUsada: consultaUsada,
      marcas: marcas,
      total: Array.isArray(marcas) ? marcas.length : 0,
      datos: Array.isArray(marcas) && marcas.length > 0 ? marcas : []
    });
  } catch (error) {
    console.error('❌ [TEST-MARCAS-SIMPLE] Error:', error);
    res.status(500).json({
      exito: false,
      error: error.message,
      stack: error.stack
    });
  }
});
console.log('✅ [RUTAS] Ruta de prueba /test-marcas-simple registrada');

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      // Vercel puede inyectar scripts de feedback en producción/preview (vercel.live).
      // Si no lo permitimos, el navegador mostrará warnings CSP (no rompe la app, pero ensucia la consola).
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://vercel.live"],
      scriptSrcElem: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://vercel.live"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      // Vercel feedback puede usar iframes (vercel.live). Si no, el navegador mostrará warning de framing.
      frameSrc: ["'self'", "https://vercel.live"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://vercel.live"],
    },
  },
}));
app.use(compression());

// Configuración del entorno
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// Configurar Express para confiar en el proxy (necesario para producción/Vercel)
// En desarrollo local, esto no afecta el funcionamiento
app.set('trust proxy', 1);

// Configuración de cookies para JWT
// En desarrollo local: secure=false, sameSite='lax' (funciona con HTTP)
// En producción: secure=true, sameSite='none' (necesario para HTTPS/Vercel)
const cookieConfig = {
  httpOnly: true, // Prevenir acceso desde JavaScript (seguridad)
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días (coincide con JWT_EXPIRES_IN)
  secure: isProduction, // HTTPS solo en producción
  sameSite: isProduction ? 'none' : 'lax', // 'lax' para desarrollo local, 'none' para producción
  path: '/' // Asegurar que la cookie se envía en todas las rutas
};

if (isDevelopment) {
  console.log('🔧 [CONFIG] Modo: Desarrollo Local');
  console.log('🔧 [CONFIG] Cookies: secure=false, sameSite=lax (HTTP)');
} else {
  console.log('🔧 [CONFIG] Modo: Producción');
  console.log('🔧 [CONFIG] Cookies: secure=true, sameSite=none (HTTPS)');
}

// Middleware para parsear cookies (DEBE ir antes de session)
app.use(cookieParser());

// Mantener sesiones para compatibilidad, pero usaremos JWT como método principal
// Las sesiones solo se usarán como fallback o para datos temporales
app.use(session({
  secret: resolveSecret(['SESSION_SECRET', 'JWT_SECRET'], 'farmadescaso_secret_dev_only'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 30 * 60 * 1000 // 30 minutos para sesiones (menor que JWT)
  }
}));

// ============================================
// Auth centralizado (Fase 2)
// ============================================
const { createAuth } = require('./middleware/auth');
const auth = createAuth({
  jwtSecret: JWT_SECRET,
  jwtExpiresIn: JWT_EXPIRES_IN,
  cookieName: COOKIE_NAME,
  cookieConfig,
  isDevelopment
});
const {
  parseRoll,
  generateToken,
  verifyToken,
  generateSecureToken,
  hashPassword,
  verifyPassword,
  attachJwtFromCookie,
  attachLocals,
  requireAuth,
  requireAdmin,
  requireComercial,
  isAdmin,
  isComercial,
  getUsuarioRol,
  getComercialId,
  getUserIsAdmin
} = auth;

app.use(attachJwtFromCookie);

// Middleware de logging MUY TEMPRANO - antes de bodyParser para capturar TODAS las peticiones
app.use((req, res, next) => {
  if (req.method === 'POST' && (req.path === '/dashboard/pedidos' || req.path.includes('/pedidos'))) {
    console.log('🔔 [EARLY] ===== PETICIÓN POST DETECTADA (ANTES DE BODYPARSER) =====');
    console.log('🔔 [EARLY] Path:', req.path);
    console.log('🔔 [EARLY] Method:', req.method);
    console.log('🔔 [EARLY] Timestamp:', new Date().toISOString());
    console.log('🔔 [EARLY] Content-Type:', req.headers['content-type']);
    console.log('🔔 [EARLY] Accept:', req.headers.accept);
    console.log('🔔 [EARLY] X-Requested-With:', req.headers['x-requested-with']);
    console.log('🔔 [EARLY] Content-Length:', req.headers['content-length']);
  }
  next();
});

app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));

// Middleware para logging de peticiones POST (solo para debugging)
app.use((req, res, next) => {
  // Logging especial para peticiones POST a /dashboard/pedidos
  if (req.method === 'POST' && req.path === '/dashboard/pedidos') {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📥 [MIDDLEWARE] ===== PETICIÓN POST RECIBIDA =====');
    console.log('📥 [MIDDLEWARE] Path:', req.path);
    console.log('📥 [MIDDLEWARE] Method:', req.method);
    console.log('📥 [MIDDLEWARE] Content-Type:', req.headers['content-type']);
    console.log('📥 [MIDDLEWARE] Accept:', req.headers.accept);
    console.log('📥 [MIDDLEWARE] X-Requested-With:', req.headers['x-requested-with']);
    console.log('📥 [MIDDLEWARE] Timestamp:', new Date().toISOString());
    console.log('📥 [MIDDLEWARE] Body keys:', req.body ? Object.keys(req.body) : 'req.body es undefined');
    console.log('═══════════════════════════════════════════════════════════');
  }
  if (req.method === 'POST' && req.path.includes('/pedidos')) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📥 [MIDDLEWARE] ===== PETICIÓN POST RECIBIDA =====');
    console.log('📥 [MIDDLEWARE] Path:', req.path);
    console.log('📥 [MIDDLEWARE] Content-Type:', req.headers['content-type']);
    console.log('📥 [MIDDLEWARE] Accept:', req.headers.accept);
    console.log('📥 [MIDDLEWARE] X-Requested-With:', req.headers['x-requested-with']);
    console.log('📥 [MIDDLEWARE] Body keys:', Object.keys(req.body || {}));
    if (!isProdRuntime()) {
      console.log('📥 [MIDDLEWARE] Body (redactado):', JSON.stringify(redactSensitive(req.body || {}), null, 2));
    }
    console.log('📥 [MIDDLEWARE] ===== FIN MIDDLEWARE =====');
    console.log('═══════════════════════════════════════════════════════════');
  }
  next();
});

// Configurar Express para usar UTF-8 en respuestas HTML (no en archivos estáticos)
app.use((req, res, next) => {
  // Solo establecer Content-Type para HTML, no para archivos estáticos
  if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    // Los archivos estáticos se servirán con su tipo MIME correcto
    return next();
  }
  res.charset = 'utf-8';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  next();
});

if (!process.env.MAIL_PASS) {
  console.warn('⚠️ [MAIL] MAIL_PASS no está configurada. El envío de correos fallará hasta definirla en el entorno.');
}
const mailTransport = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'com1008.raiolanetworks.es',
  port: Number(process.env.MAIL_PORT || 465),
  secure: Number(process.env.MAIL_PORT || 465) === 465,
  auth: {
    user: process.env.MAIL_USER || 'pedidos@farmadescanso.com',
    pass: process.env.MAIL_PASS || ''
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
  tls: {
    // Por defecto validar certificado TLS. Solo desactivar si MAIL_TLS_INSECURE=1
    rejectUnauthorized: process.env.MAIL_TLS_INSECURE === '1' ? false : true
  }
});

// Diagnóstico SMTP (solo admin autenticado)
app.get('/api/debug/mail', requireAuth, requireAdmin, async (req, res) => {
  const diag = {
    mailHost: process.env.MAIL_HOST || 'com1008.raiolanetworks.es',
    mailPort: Number(process.env.MAIL_PORT || 465),
    mailUser: process.env.MAIL_USER || 'pedidos@farmadescanso.com',
    mailPassSet: Boolean(process.env.MAIL_PASS),
    mailPassLength: process.env.MAIL_PASS ? String(process.env.MAIL_PASS).length : 0,
    tlsInsecure: process.env.MAIL_TLS_INSECURE === '1',
    verify: null,
    error: null
  };
  try {
    await mailTransport.verify();
    diag.verify = 'ok';
    res.json({ ok: true, ...diag });
  } catch (error) {
    diag.verify = 'fail';
    diag.error = {
      message: error.message,
      code: error.code || null,
      command: error.command || null
    };
    res.status(503).json({ ok: false, ...diag });
  }
});

app.use((req, res, next) => {
  res.locals.formatearMonedaES = formatearMonedaES;
  res.locals.formatearNumeroES = formatearNumeroES;
  res.locals.formatearNumeroPedido = formatearNumeroPedido;
  next();
});

// ============================================
// RUTA DE PRUEBA ULTRA SIMPLE - AL INICIO
// ============================================
app.get('/test-rentabilidad-ultra-simple', blockInProduction, (req, res) => {
  console.log('✅ [TEST-ULTRA] Ruta de prueba accedida');
  res.send('<h1>✅ Ruta de prueba ULTRA SIMPLE funcionando</h1><p>Si ves esto, el servidor está funcionando.</p>');
});

// Ruta de diagnóstico para rentabilidad-pedidos - AL INICIO, FUERA DE CUALQUIER BLOQUE
app.get('/dashboard/ajustes/rentabilidad-pedidos-diag', blockInProduction, (req, res) => {
  try {
    console.log('🔍 [DIAG] Ruta de diagnóstico accedida');
    console.log('🔍 [DIAG] req.user:', req.user ? JSON.stringify(req.user) : 'no existe');
    console.log('🔍 [DIAG] req.session:', req.session ? 'existe' : 'no existe');
    console.log('🔍 [DIAG] req.session?.comercialId:', req.session?.comercialId);
    console.log('🔍 [DIAG] req.comercial:', req.comercial ? JSON.stringify(req.comercial) : 'no existe');
    
    const comercial = req.comercial || req.session?.comercial;
    let isAdmin = false;
    let rollInfo = 'N/A';
    
    if (comercial) {
      const roll = comercial.roll || comercial.Roll || '';
      rollInfo = String(roll);
      const rollStr = String(roll).toLowerCase();
      isAdmin = rollStr.includes('administrador') || rollStr.includes('admin');
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Diagnóstico - Rentabilidad Pedidos</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          pre { background: #f5f5f5; padding: 10px; border: 1px solid #ddd; }
          .ok { color: green; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1>Diagnóstico - Rentabilidad Pedidos</h1>
        <h2>Estado de Autenticación</h2>
        <ul>
          <li>req.user: ${req.user ? '<span class="ok">✅ Existe</span>' : '<span class="error">❌ No existe</span>'}</li>
          <li>req.session: ${req.session ? '<span class="ok">✅ Existe</span>' : '<span class="error">❌ No existe</span>'}</li>
          <li>req.session?.comercialId: ${req.session?.comercialId || '<span class="error">❌ No existe</span>'}</li>
          <li>req.comercial: ${req.comercial ? '<span class="ok">✅ Existe</span>' : '<span class="error">❌ No existe</span>'}</li>
        </ul>
        <h2>Información del Comercial</h2>
        <pre>${JSON.stringify(comercial || {}, null, 2)}</pre>
        <h2>Verificación de Admin</h2>
        <ul>
          <li>Roll: ${rollInfo}</li>
          <li>Es Admin: ${isAdmin ? '<span class="ok">✅ Sí</span>' : '<span class="error">❌ No</span>'}</li>
        </ul>
        <h2>Pruebas</h2>
        <ul>
          <li><a href="/dashboard/ajustes/rentabilidad-pedidos">Probar ruta real</a></li>
          <li><a href="/test-rentabilidad-ultra-simple">Probar ruta simple</a></li>
        </ul>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ [DIAG] Error:', error.message);
    console.error('❌ [DIAG] Stack:', error.stack);
    res.status(500).send(`
      <h1>Error en Diagnóstico</h1>
      <p><strong>Mensaje:</strong> ${error.message}</p>
      <pre>${error.stack}</pre>
    `);
  }
});

// Configuración de vistas
// Configurar EJS con UTF-8
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.charset = 'utf-8';

// Helper global para normalizar UTF-8 en vistas
const { normalizeUTF8, normalizeObjectUTF8 } = require('./utils/normalize-utf8');
app.locals.normalizeUTF8 = normalizeUTF8;

// user/esAdmin en vistas (middleware/auth)
app.use(attachLocals);

// Helper functions para obtener datos según rol
// Función auxiliar para filtrar pedidos por año
const filtrarPedidosPorAno = (pedidos, year) => {
  if (!year || !pedidos || pedidos.length === 0) {
    return pedidos;
  }
  
  return pedidos.filter(pedido => {
    const fecha = pedido.FechaPedido || pedido['Fecha Pedido'] || pedido.fecha || pedido.Fecha || pedido.CreatedAt;
    if (!fecha) return false;
    try {
      const fechaPedido = new Date(fecha);
      if (isNaN(fechaPedido.getTime())) return false;
      return fechaPedido.getFullYear() === year;
    } catch (e) {
      return false;
    }
  });
};

const obtenerPedidosPorRol = async (crm, req, selectedYear = null) => {
  const comercialId = req.comercialId || req.session?.comercialId;
  const usuarioRol = getUsuarioRol(req);
  
  let pedidos;
  if (isAdmin(req)) {
    // Administrador: ver todos los pedidos
    pedidos = await crm.getPedidos();
  } else {
    // Comercial: solo sus pedidos
    pedidos = await crm.getPedidosByComercial(Number(comercialId));
  }
  
  // Filtrar por año si se especifica
  if (selectedYear) {
    pedidos = filtrarPedidosPorAno(pedidos, selectedYear);
  }
  
  return pedidos;
};

const obtenerClientesPorRol = async (crm, req) => {
  const comercialId = req.comercialId || req.session?.comercialId;
  const usuarioRol = getUsuarioRol(req);
  
  if (isAdmin(req)) {
    // Administrador: ver todos los clientes
    return await crm.getClientes();
  } else {
    // Comercial: solo sus clientes (compatibilidad: Id_Cial / ComercialId / comercialId / etc.)
    const cid = Number(comercialId);
    if (!Number.isFinite(cid) || cid <= 0) return [];

    // 1) Intento directo (rápido) por Id_Cial (esquema principal)
    try {
      const byIdCial = await crm.getClientes(cid);
      if (Array.isArray(byIdCial) && byIdCial.length) return byIdCial;
    } catch (_) {}

    // 2) Fallback por ComercialId/comercialId (esquemas alternativos)
    try {
      const byComercialId = await crm.getClientesByComercial(cid);
      if (Array.isArray(byComercialId) && byComercialId.length) return byComercialId;
    } catch (_) {}

    // 3) Último recurso: cargar y filtrar en memoria por cualquiera de los campos conocidos
    const todos = await crm.getClientes();
    if (!Array.isArray(todos) || !todos.length) return [];

    const campos = ['Id_Cial', 'id_cial', 'ComercialId', 'comercialId', 'Comercial_id', 'comercial_id', 'Id_Comercial', 'id_comercial'];
    return todos.filter(cliente => {
      for (const campo of campos) {
        const v = cliente ? cliente[campo] : null;
        if (v === null || v === undefined) continue;
        if (Array.isArray(v)) {
          if (v.some(x => (x?.Id ?? x?.id) == cid || x == cid)) return true;
          continue;
        }
        if (typeof v === 'object') {
          if ((v.Id ?? v.id) == cid) return true;
          continue;
        }
        if (v == cid) return true;
      }
      return false;
    });
  }
};

// Contador de clientes por rol (evita falsos positivos por columnas distintas)
const obtenerTotalClientesPorRol = async (crm, req) => {
  const cid = Number(req.comercialId || req.session?.comercialId);
  const esAdminLocal = isAdmin(req);

  // Admin: total real en BD
  if (esAdminLocal) {
    return await crm.getClientesCount().catch(() => 0);
  }

  // Comercial: si no hay id, no podemos filtrar
  if (!Number.isFinite(cid) || cid <= 0) return 0;

  // Detectar columna de asignación en `clientes`
  try {
    const colsRows = await crm.query('SHOW COLUMNS FROM clientes').catch(() => []);
    const cols = new Set((colsRows || []).map(r => String(r.Field || r.field || '').trim()).filter(Boolean));

    const pick = (cands) => (cands || []).find(c => cols.has(c)) || null;
    const colAsignacion = pick(['Id_Cial', 'ComercialId', 'comercialId', 'Id_Comercial', 'id_comercial', 'comercial_id', 'Comercial_id']);

    if (colAsignacion) {
      const rows = await crm.query(`SELECT COUNT(*) AS count FROM clientes WHERE \`${colAsignacion}\` = ?`, [cid]).catch(() => []);
      const count = rows?.[0]?.count ?? rows?.[0]?.COUNT ?? 0;
      return Number(count) || 0;
    }
  } catch (_) {}

  // Fallback seguro: usar el listado por rol y contar
  try {
    const list = await obtenerClientesPorRol(crm, req);
    return Array.isArray(list) ? list.length : 0;
  } catch (_) {
    return 0;
  }
};

const obtenerVisitasPorRol = async (crm, req) => {
  const comercialId = req.comercialId || req.session?.comercialId;
  const usuarioRol = getUsuarioRol(req);
  
  if (isAdmin(req)) {
    // Administrador: ver todas las visitas
    return await crm.getVisitas();
  } else {
    // Comercial: solo sus visitas
    return await crm.getVisitasByComercial(Number(comercialId));
  }
};

const obtenerEstadisticasPorRol = async (crm, req, selectedYear = null) => {
  const comercialId = req.comercialId || req.session?.comercialId;
  const usuarioRol = getUsuarioRol(req);
  
  if (isAdmin(req)) {
    // Administrador: estadísticas globales de todos los comerciales
    let [pedidos, visitas, clientes, comerciales] = await Promise.all([
      crm.getPedidos(),
      crm.getVisitas(),
      crm.getClientes(),
      crm.getComerciales()
    ]);
    
    // Filtrar pedidos por año si se especifica
    if (selectedYear) {
      pedidos = filtrarPedidosPorAno(pedidos, selectedYear);
    }
    
    // Contar todos los clientes (no solo activos) para el total en el dashboard
    const totalPedidos = pedidos.length;
    const totalVisitas = visitas.length;
    const totalClientes = clientes.length; // Total de todos los clientes
    const totalComerciales = comerciales.length;
    
    // Calcular totales usando TotalPedido o BaseImponible + TotalIva
    const totalVentas = pedidos.reduce((sum, pedido) => {
      let total = Number(pedido.TotalPedido || pedido.Total_pedido || pedido.Total_pedido_ || pedido.total || 0);
      if (!total || total === 0) {
        const baseImponible = Number(pedido.BaseImponible || 0);
        const totalIva = Number(pedido.TotalIva || 0);
        total = baseImponible + totalIva;
      }
      return sum + total;
    }, 0);
    
    // Pedidos este mes - usar FechaPedido
    const ahora = new Date();
    const pedidosEsteMes = pedidos.filter(pedido => {
      const fecha = pedido.FechaPedido || pedido['Fecha Pedido'] || pedido.fecha || pedido.Fecha || pedido.CreatedAt;
      if (!fecha) return false;
      try {
        const fechaPedido = new Date(fecha);
        if (isNaN(fechaPedido.getTime())) return false;
        return fechaPedido.getMonth() === ahora.getMonth() && 
               fechaPedido.getFullYear() === ahora.getFullYear();
      } catch (e) {
        return false;
      }
    });
    
    // Visitas este mes
    const visitasEsteMes = visitas.filter(visita => {
      const fecha = visita.Fecha || visita.fecha || visita.CreatedAt;
      if (!fecha) return false;
      try {
        const fechaVisita = new Date(fecha);
        if (isNaN(fechaVisita.getTime())) return false;
        return fechaVisita.getMonth() === ahora.getMonth() && 
               fechaVisita.getFullYear() === ahora.getFullYear();
      } catch (e) {
        return false;
      }
    });
    
    // Calcular total de ventas del mes
    const totalVentasEsteMes = pedidosEsteMes.reduce((sum, pedido) => {
      let total = Number(pedido.TotalPedido || pedido.Total_pedido || pedido.Total_pedido_ || pedido.total || 0);
      if (!total || total === 0) {
        const baseImponible = Number(pedido.BaseImponible || 0);
        const totalIva = Number(pedido.TotalIva || 0);
        total = baseImponible + totalIva;
      }
      return sum + total;
    }, 0);
    
    return {
      totalPedidos,
      totalVisitas,
      totalClientes,
      totalComerciales,
      totalVentas,
      pedidosEsteMes: pedidosEsteMes.length,
      ventasEsteMes: pedidosEsteMes.length, // Alias para compatibilidad con la vista
      visitasEsteMes: visitasEsteMes.length,
      totalVentasEsteMes: totalVentasEsteMes
    };
  } else {
    // Comercial: solo sus estadísticas
    let [pedidos, visitas, clientes] = await Promise.all([
      crm.getPedidosByComercial(Number(comercialId)),
      crm.getVisitasByComercial(Number(comercialId)),
      obtenerClientesPorRol(crm, req)
    ]);
    
    // Filtrar pedidos por año si se especifica
    if (selectedYear) {
      pedidos = filtrarPedidosPorAno(pedidos, selectedYear);
    }
    
    // Contar todos los clientes (no solo activos) para el total en el dashboard
    const totalPedidos = pedidos.length;
    const totalVisitas = visitas.length;
    const totalClientes = clientes.length; // Total de todos los clientes
    
    
    // Calcular totales usando TotalPedido o BaseImponible + TotalIva
    const totalVentas = pedidos.reduce((sum, pedido) => {
      let total = Number(pedido.TotalPedido || pedido.Total_pedido || pedido.Total_pedido_ || pedido.total || 0);
      if (!total || total === 0) {
        const baseImponible = Number(pedido.BaseImponible || 0);
        const totalIva = Number(pedido.TotalIva || 0);
        total = baseImponible + totalIva;
      }
      return sum + total;
    }, 0);
    
    // Pedidos este mes - usar FechaPedido
    const ahora = new Date();
    const pedidosEsteMes = pedidos.filter(pedido => {
      const fecha = pedido.FechaPedido || pedido['Fecha Pedido'] || pedido.fecha || pedido.Fecha || pedido.CreatedAt;
      if (!fecha) return false;
      try {
        const fechaPedido = new Date(fecha);
        if (isNaN(fechaPedido.getTime())) return false;
        return fechaPedido.getMonth() === ahora.getMonth() && 
               fechaPedido.getFullYear() === ahora.getFullYear();
      } catch (e) {
        return false;
      }
    });
    
    // Visitas este mes
    const visitasEsteMes = visitas.filter(visita => {
      const fecha = visita.Fecha || visita.fecha || visita.CreatedAt;
      if (!fecha) return false;
      try {
        const fechaVisita = new Date(fecha);
        if (isNaN(fechaVisita.getTime())) return false;
        return fechaVisita.getMonth() === ahora.getMonth() && 
               fechaVisita.getFullYear() === ahora.getFullYear();
      } catch (e) {
        return false;
      }
    });
    
    // Calcular total de ventas del mes
    const totalVentasEsteMes = pedidosEsteMes.reduce((sum, pedido) => {
      let total = Number(pedido.TotalPedido || pedido.Total_pedido || pedido.Total_pedido_ || pedido.total || 0);
      if (!total || total === 0) {
        const baseImponible = Number(pedido.BaseImponible || 0);
        const totalIva = Number(pedido.TotalIva || 0);
        total = baseImponible + totalIva;
      }
      return sum + total;
    }, 0);
    
    return {
      totalPedidos,
      totalVisitas,
      totalClientes,
      totalComerciales: 1, // Solo él mismo
      totalVentas,
      pedidosEsteMes: pedidosEsteMes.length,
      ventasEsteMes: pedidosEsteMes.length, // Alias para compatibilidad con la vista
      visitasEsteMes: visitasEsteMes.length,
      totalVentasEsteMes: totalVentasEsteMes
    };
  }
};

// Archivos estáticos (ANTES de rutas principales para evitar conflictos)
// Ruta de prueba para marcas - registrada después de middlewares básicos
app.get('/test-marcas', blockInProduction, async (req, res) => {
  try {
    console.log('🔍 [TEST-MARCAS] Ruta accedida - Probando acceso a tabla Marcas...');
    
    // Asegurar conexión
    if (!crm.connected) {
      console.log('⏳ [TEST-MARCAS] Esperando conexión a BD...');
      await crm.connect();
    }
    
    let marcas = null;
    let consultaUsada = '';
    let errorDetalle = null;
    
    // Intento 1: Marcas con mayúscula
    try {
      marcas = await crm.query('SELECT * FROM `Marcas` ORDER BY Nombre ASC');
      consultaUsada = 'SELECT * FROM `Marcas`';
      console.log('✅ [TEST-MARCAS] Consulta con `Marcas` exitosa');
    } catch (e1) {
      errorDetalle = e1.message;
      console.log('⚠️ [TEST-MARCAS] Error con `Marcas`:', e1.message);
      
      // Intento 2: marcas con minúscula
      try {
        marcas = await crm.query('SELECT * FROM `marcas` ORDER BY Nombre ASC');
        consultaUsada = 'SELECT * FROM `marcas`';
        console.log('✅ [TEST-MARCAS] Consulta con `marcas` exitosa');
      } catch (e2) {
        console.log('⚠️ [TEST-MARCAS] Error con `marcas`:', e2.message);
        
        // Intento 3: Sin backticks
        try {
          marcas = await crm.query('SELECT * FROM marcas ORDER BY Nombre ASC');
          consultaUsada = 'SELECT * FROM marcas';
          console.log('✅ [TEST-MARCAS] Consulta sin backticks exitosa');
        } catch (e3) {
          console.error('❌ [TEST-MARCAS] Todas las consultas fallaron');
          throw e3;
        }
      }
    }
    
    const resultado = {
      exito: true,
      consultaUsada: consultaUsada,
      marcas: marcas,
      total: Array.isArray(marcas) ? marcas.length : 0,
      datos: Array.isArray(marcas) && marcas.length > 0 ? marcas : [],
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ [TEST-MARCAS] Resultado: ${resultado.total} marcas encontradas`);
    res.json(resultado);
  } catch (error) {
    console.error('❌ [TEST-MARCAS] Error completo:', error);
    res.status(500).json({
      exito: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});
console.log('✅ [RUTAS] Ruta /test-marcas registrada después de middlewares');

app.use(express.static(path.join(__dirname, 'public')));

// Middleware para inyectar esAdmin en todas las respuestas renderizadas
app.use((req, res, next) => {
  // Guardar el método render original
  const originalRender = res.render.bind(res);
  
  // Sobrescribir res.render para inyectar esAdmin automáticamente
  res.render = function(view, options, callback) {
    // Si options es un objeto, añadir esAdmin
    if (options && typeof options === 'object' && !Array.isArray(options)) {
      // Calcular esAdmin si no está presente
      if (typeof options.esAdmin === 'undefined') {
        options.esAdmin = isAdmin(req);
      }
    } else if (options && typeof options === 'function') {
      // Si options es el callback, crear un nuevo objeto de opciones
      const newOptions = {};
      newOptions.esAdmin = isAdmin(req);
      return originalRender(view, newOptions, options);
    } else {
      // Si options no existe, crearlo
      options = { esAdmin: isAdmin(req) };
    }
    
    // Llamar al render original con las opciones modificadas
    return originalRender(view, options, callback);
  };
  
  next();
});

// Rutas de comisiones
const comisionesRoutes = require('./routes/comisiones');
app.use('/dashboard/comisiones', requireAuth, comisionesRoutes);
const presupuestosVentasRoutes = require('./routes/presupuestos-vs-ventas');
app.use('/dashboard/presupuestos-vs-ventas', requireAuth, presupuestosVentasRoutes);
// Tarifas de clientes (solo Admin)
const tarifasClientesRoutes = require('./routes/tarifas-clientes');
app.use('/dashboard/ajustes/tarifas-clientes', requireAuth, requireAdmin, tarifasClientesRoutes);

// Comerciales (Fase 3 → routes/comerciales.js)
const createComercialesRoutes = require('./routes/comerciales');
const { createComercialesApiRoutes } = createComercialesRoutes;
app.use('/dashboard/comerciales', requireAuth, requireAdmin, createComercialesRoutes({
  crm,
  normalizeUTF8,
  normalizeObjectUTF8
}));
app.use('/api/comerciales', requireAuth, createComercialesApiRoutes({
  crm,
  sanitizeComercialForApi
}));

// RUTA PRINCIPAL - Redirigir a dashboard o login
app.get('/', (req, res) => {
  // Verificar autenticación (JWT o sesión)
  if (req.user && req.comercialId) {
    return res.redirect('/dashboard');
  }
  
  if (req.session && req.session.comercialId) {
    return res.redirect('/dashboard');
  }

  return res.redirect('/auth/login');
});

// Rutas de autenticación (Fase 2 → routes/auth.js)
const createAuthRoutes = require('./routes/auth');
app.use(createAuthRoutes({
  crm,
  mailTransport,
  generateToken,
  verifyPassword,
  hashPassword,
  generateSecureToken,
  getCanonicalOrigin,
  cookieName: COOKIE_NAME,
  cookieConfig,
  requireAuth,
  parseRoll,
  isDevelopment,
  isProduction,
  isProdRuntime
}));

app.post('/api/debug/login', (req, res) => {
  if (isProdRuntime() || process.env.ALLOW_DEBUG_LOGIN !== '1') {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.status(403).json({
    error: 'Debug login deshabilitado. Usa logs locales o /api/debug/session como admin.'
  });
});

// Endpoint de diagnóstico para verificar JWT y sesiones (solo admin autenticado)
app.get('/api/debug/session', requireAuth, requireAdmin, (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  const decoded = token ? verifyToken(token) : null;
  
  const debugInfo = {
    jwt: {
      tokenPresent: !!token,
      tokenValid: !!decoded,
      user: decoded
        ? {
            id: decoded.id,
            email: decoded.email,
            roll: decoded.roll || decoded.Roll
          }
        : null
    },
    session: {
      sessionID: req.sessionID,
      comercialId: req.session?.comercialId || null
    },
    cookies: {
      jwtToken: token ? 'Presente' : 'Ausente',
      sessionCookie: req.cookies['connect.sid'] ? 'Presente' : 'Ausente'
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      isProduction: isProdRuntime()
    },
    auth: {
      reqComercialId: req.comercialId || null
    }
  };
  
  res.json(debugInfo);
});

// Debug: confirmar a qué BD está conectado el servidor (útil para Vercel)
// Protegido: requiere estar logueado y ser Admin
app.get('/api/debug/db', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await crm.query('SELECT DATABASE() AS db');
    const db = rows && rows.length > 0 ? rows[0].db : null;
    res.json({
      success: true,
      db,
      env: {
        VERCEL: !!process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV || null,
        DB_HOST: process.env.DB_HOST ? '[set]' : '[not set]',
        DB_PORT: process.env.DB_PORT || null,
        DB_USER: process.env.DB_USER ? '[set]' : '[not set]',
        DB_NAME: process.env.DB_NAME || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug: confirmar versión/commit desplegado en Vercel
app.get('/api/debug/build', requireAuth, requireAdmin, (req, res) => {
  res.json({
    success: true,
    vercel: {
      VERCEL: process.env.VERCEL || null,
      VERCEL_ENV: process.env.VERCEL_ENV || null,
      VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || null,
      VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF || null
    },
    node: {
      NODE_ENV: process.env.NODE_ENV || null
    }
  });
});

// Función helper para obtener estadísticas globales
async function getEstadisticasGlobales() {
  try {
    const [todosLosPedidos, todosLosClientes, todasLasVisitas, todosLosArticulos, todosLosComerciales] = await Promise.all([
      crm.getPedidos(),
      crm.getClientes(),
      crm.getVisitas(),
      crm.getArticulos(),
      crm.getComerciales()
    ]);
    
    // Calcular total de ventas de TODOS los pedidos
    let totalVentas = 0;
    for (const pedido of todosLosPedidos) {
      try {
        const articulos = await crm.getArticulosByPedido(pedido.id || pedido.Id);
        totalVentas += articulos.reduce((sum, art) => {
          const cantidad = art.cantidad || art.Cantidad || 0;
          const precio = art.precio || art.Precio || art.precio_unitario || art.Precio_Unitario || 0;
          return sum + (cantidad * precio);
        }, 0);
      } catch (error) {
        console.warn(`⚠️ Error obteniendo artículos del pedido ${pedido.id || pedido.Id}:`, error.message);
      }
    }
    
    // Calcular pedidos este mes de TODOS los pedidos
    const ahora = new Date();
    const pedidosEsteMes = todosLosPedidos.filter(p => {
      const fecha = new Date(p.fecha || p.Fecha || p.created_at || p.Created_At);
      return fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
    }).length;
    
    return {
      totalVentas: totalVentas || 0,
      ventasEsteMes: pedidosEsteMes || 0,
      totalEsteMes: totalVentas || 0,
      totalProductos: todosLosArticulos.length || 0,
      totalComerciales: todosLosComerciales.length || 0,
      totalClientes: todosLosClientes.length || 0,
      totalVisitas: todasLasVisitas.length || 0
    };
  } catch (error) {
    console.error('❌ [ESTADÍSTICAS GLOBALES] Error calculando estadísticas globales:', error);
    console.error('❌ [ESTADÍSTICAS GLOBALES] Stack:', error.stack);
    return {
      totalVentas: 0,
      ventasEsteMes: 0,
      totalEsteMes: 0,
      totalProductos: 0,
      totalComerciales: 0,
      totalClientes: 0,
      totalVisitas: 0
    };
  }
}

// Dashboard principal
app.get('/dashboard', requireAuth, async (req, res) => {
  console.log('🚀 [DASHBOARD] Iniciando carga del dashboard...');
  try {
    // Usar JWT primero, luego sesión como fallback
    const comercialId = req.comercialId || req.session?.comercialId;
    const comercial = req.comercial || req.session?.comercial;
    console.log(`🔍 [DASHBOARD] Comercial ID: ${comercialId}`);
    
    // Obtener el año seleccionado de la query string
    const currentYear = new Date().getFullYear();
    const yearParamRaw = req.query.year;
    const selectedYear = yearParamRaw
      ? (yearParamRaw !== 'todos' ? parseInt(yearParamRaw) : null)
      : currentYear; // Por defecto: año actual
    console.log(`📅 [DASHBOARD] Año seleccionado: ${selectedYear || 'Todos'} (default=${currentYear})`);
    
    // Obtener datos según el rol del usuario
    console.log('📊 [DASHBOARD] Obteniendo pedidos, productos y estadísticas...');
    const [pedidos, productos, estadisticas] = await Promise.all([
      obtenerPedidosPorRol(crm, req, selectedYear),
      crm.getArticulos(),
      obtenerEstadisticasPorRol(crm, req, selectedYear)
    ]);
    
    console.log(`✅ [DASHBOARD] Pedidos obtenidos: ${pedidos ? pedidos.length : 0}`);
    if (pedidos && pedidos.length > 0) {
      console.log(`📋 [DASHBOARD] Primer pedido:`, {
        Id: pedidos[0].Id || pedidos[0].id,
        NumPedido: pedidos[0].NumPedido,
        Cliente_id: pedidos[0].Cliente_id,
        Id_Cliente: pedidos[0].Id_Cliente,
        FechaPedido: pedidos[0].FechaPedido,
        TotalPedido: pedidos[0].TotalPedido,
        BaseImponible: pedidos[0].BaseImponible,
        TotalIva: pedidos[0].TotalIva
      });
    }
    
    // Clientes: contador por rol (admin total, comercial solo asignados)
    const totalClientesCalculado = await obtenerTotalClientesPorRol(crm, req);
 
    // Obtener nombres de clientes y comerciales para todos los pedidos
    // Según los logs, el campo es Cliente_id (número) o Id_Cliente
    const clienteIds = [...new Set(pedidos.map(p => {
      // Buscar en ambos campos posibles
      const clienteObj = p.Cliente_id || p['Cliente_id'] || p.Id_Cliente || p['Id_Cliente'];
      if (!clienteObj) return null;
      
      if (typeof clienteObj === 'object' && clienteObj !== null) {
        return clienteObj.Id || clienteObj.id;
      }
      // Si es un número o string numérico, devolverlo directamente
      const clienteIdNum = Number(clienteObj);
      return !isNaN(clienteIdNum) && clienteIdNum > 0 ? clienteIdNum : null;
    }).filter(Boolean))];
    
    console.log(`🔍 [DASHBOARD] Total pedidos: ${pedidos.length}, IDs de clientes únicos: ${clienteIds.length}`, clienteIds);
    
    const clientesMap = new Map();
    if (clienteIds.length > 0) {
      await Promise.all(clienteIds.map(async (clienteId) => {
        try {
          const cliente = await crm.getClienteById(Number(clienteId));
          if (cliente) {
            const nombre = cliente.Nombre_Razon_Social || cliente.Nombre || cliente.nombre || 'Cliente';
            clientesMap.set(Number(clienteId), nombre);
            console.log(`✅ [DASHBOARD] Cliente ${clienteId}: ${nombre}`);
          } else {
            console.warn(`⚠️ [DASHBOARD] Cliente ${clienteId} no encontrado en BD`);
          }
        } catch (error) {
          console.warn(`⚠️ [DASHBOARD] Error obteniendo cliente ${clienteId}:`, error.message);
        }
      }));
    }

    // Obtener totales desde las líneas si no están disponibles
    const pedidosConTotales = await Promise.all(pedidos.map(async (pedido) => {
      // Usar los nombres correctos de columnas según los logs: TotalPedido, BaseImponible, TotalIva
      let totalPedido = Number(pedido.TotalPedido || pedido.Total_pedido || pedido.Total_pedido_ || pedido.total || 0);
      
      // Si el total es 0, intentar calcular desde BaseImponible + TotalIva
      if (!totalPedido || totalPedido === 0) {
        const baseImponible = Number(pedido.BaseImponible || 0);
        const totalIva = Number(pedido.TotalIva || 0);
        if (baseImponible > 0 || totalIva > 0) {
          totalPedido = baseImponible + totalIva;
          console.log(`✅ [DASHBOARD] Pedido ${pedido.Id || pedido.id}: Total calculado desde BaseImponible (${baseImponible}) + TotalIva (${totalIva}) = ${totalPedido}`);
        } else {
          // Si aún es 0, calcular desde las líneas
          try {
            const pedidoId = pedido.Id || pedido.id;
            const lineasRaw = await crm.query('SELECT * FROM pedidos_articulos WHERE Id_NumPedido = ?', [pedidoId]);
            if (lineasRaw && lineasRaw.length > 0) {
              // Calcular total desde las líneas
              totalPedido = lineasRaw.reduce((sum, linea) => {
                const subtotal = Number(linea.Subtotal || 0);
                const iva = Number(linea.IVA || 0);
                const ivaMonto = (subtotal * iva) / 100;
                const totalLinea = subtotal + ivaMonto;
                return sum + totalLinea;
              }, 0);
              console.log(`✅ [DASHBOARD] Pedido ${pedidoId}: Total calculado desde ${lineasRaw.length} líneas = ${totalPedido}`);
            }
          } catch (error) {
            console.warn(`⚠️ [DASHBOARD] Error calculando total para pedido ${pedido.Id || pedido.id}:`, error.message);
          }
        }
      }

      return { ...pedido, totalCalculado: totalPedido };
    }));

    const ventas = pedidosConTotales
      .map(pedido => {
        const pedidoId = pedido.Id || pedido.id;
        
        // Usar FechaPedido primero (nombre correcto según logs: FechaPedido)
        const fechaRaw = pedido.FechaPedido || pedido['Fecha Pedido'] || pedido.fecha || pedido.Fecha || pedido.CreatedAt;
        let fecha = null;
        if (fechaRaw) {
          try {
            // Si ya es un objeto Date, usarlo directamente
            if (fechaRaw instanceof Date) {
              fecha = fechaRaw;
            } else {
              fecha = new Date(fechaRaw);
              // Verificar que la fecha es válida
              if (isNaN(fecha.getTime())) {
                console.warn(`⚠️ [DASHBOARD] Fecha inválida para pedido ${pedidoId}:`, fechaRaw, typeof fechaRaw);
                fecha = null;
              } else {
                console.log(`✅ [DASHBOARD] Pedido ${pedidoId}: Fecha parseada correctamente: ${fecha.toISOString()}`);
              }
            }
          } catch (e) {
            console.warn(`⚠️ [DASHBOARD] Error parseando fecha para pedido ${pedidoId}:`, fechaRaw, e.message);
            fecha = null;
          }
        } else {
          console.warn(`⚠️ [DASHBOARD] Pedido ${pedidoId}: No tiene fecha`);
        }
        
        // Usar NumPedido primero (nombre correcto según logs: NumPedido = 'P250001')
        const numeroRaw = pedido.NumPedido || pedido['NumPedido'] ||
          pedido['Número_Pedido'] ||
          pedido['Número Pedido'] ||
          pedido.Numero_Pedido ||
          pedido.NumeroPedido ||
          pedido.numero ||
          pedido.Numero ||
          null;
        
        console.log(`🔍 [DASHBOARD] Pedido ${pedidoId}: NumPedido=${numeroRaw}, FechaPedido=${fechaRaw}`);

        // Obtener nombre del cliente - usar Cliente_id primero (según logs: Cliente_id: 808)
        const clienteObj = pedido.Cliente_id || pedido['Cliente_id'] || pedido.Id_Cliente || pedido['Id_Cliente'];
        let nombreCliente = 'Cliente';
        if (clienteObj) {
          if (typeof clienteObj === 'object' && clienteObj !== null) {
            nombreCliente = clienteObj.Nombre_Razon_Social || clienteObj.Nombre || clienteObj.nombre || 'Cliente';
          } else {
            const clienteId = Number(clienteObj);
            if (!isNaN(clienteId) && clienteId > 0) {
              nombreCliente = clientesMap.get(clienteId) || `Cliente #${clienteId}`;
              console.log(`🔍 [DASHBOARD] Pedido ${pedidoId}: clienteId=${clienteId}, nombre=${nombreCliente}`);
            }
          }
        } else {
          console.warn(`⚠️ [DASHBOARD] Pedido ${pedidoId}: No tiene clienteObj`);
        }

        const total = pedido.totalCalculado || Number(pedido.TotalPedido || pedido.Total_pedido || pedido.Total_pedido_ || pedido.total || 0);
        console.log(`🔍 [DASHBOARD] Pedido ${pedidoId}: TotalPedido=${pedido.TotalPedido}, totalCalculado=${pedido.totalCalculado}, total final=${total}`);

        // Usar NumPedido directamente, no el ID
        const numeroFinal = numeroRaw || formatearNumeroPedido(null, fecha) || `P${pedidoId}`;

        return {
          id: pedidoId,
          numero: numeroFinal,
          cliente: nombreCliente,
          fecha: fecha,
          estado: pedido.EstadoPedido || pedido.Estado || 'Pendiente',
          total: total,
          totalFormateado: formatearMonedaES(total)
        };
      })
      .sort((a, b) => {
        if (!a.fecha && !b.fecha) return 0;
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return (new Date(b.fecha)) - (new Date(a.fecha));
      });

    // Calcular total de ventas desde los pedidos procesados
    const totalVentas = ventas.reduce((sum, pedido) => sum + (pedido.total || 0), 0);
    
    // Calcular pedidos según el filtro: si hay año seleccionado, usar todos los pedidos de ese año
    // Si no hay año seleccionado, usar solo los del mes actual
    let pedidosEsteMes;
    let totalVentasEsteMes;
    
    if (selectedYear) {
      // Si hay año seleccionado, todos los pedidos del año son "este mes" (en realidad "este año")
      pedidosEsteMes = ventas;
      totalVentasEsteMes = totalVentas;
    } else {
      // Si no hay año seleccionado, calcular solo los del mes actual
      const ahora = new Date();
      pedidosEsteMes = ventas.filter(pedido => {
        if (!pedido.fecha) return false;
        try {
          const fechaPedido = new Date(pedido.fecha);
          if (isNaN(fechaPedido.getTime())) return false;
          return fechaPedido.getMonth() === ahora.getMonth() && 
                 fechaPedido.getFullYear() === ahora.getFullYear();
        } catch (e) {
          return false;
        }
      });
      totalVentasEsteMes = pedidosEsteMes.reduce((sum, pedido) => sum + (pedido.total || 0), 0);
    }
 
    // Obtener rol del usuario para pasar a la vista
    const usuarioRol = getUsuarioRol(req);
    const esAdmin = isAdmin(req);
    
    // Asegurar que totalClientes esté presente usando el valor calculado directamente
    // Actualizar estadísticas con los valores calculados desde los pedidos procesados
    const estadisticasFinal = {
      ...estadisticas,
      totalVentas: totalVentas, // Usar el total calculado desde los pedidos procesados
      totalVentasEsteMes: totalVentasEsteMes, // Usar el total del mes calculado
      pedidosEsteMes: pedidosEsteMes.length, // Usar el número de pedidos del mes calculado
      ventasEsteMes: pedidosEsteMes.length, // Alias para compatibilidad con la vista
      totalClientes: totalClientesCalculado
    };
    
    console.log(`📊 [DASHBOARD] Estadísticas finales:`, {
      totalVentas,
      totalVentasEsteMes,
      pedidosEsteMes: pedidosEsteMes.length,
      ventasEsteMes: pedidosEsteMes.length,
      totalPedidos: ventas.length
    });
     
     res.render('dashboard/index-crm', {
       title: 'Dashboard - Farmadescaso',
       user: req.comercial || req.session.comercial,
       ventas: ventas.slice(0, 10),
       productos: productos.slice(0, 5),
       estadisticas: estadisticasFinal,
       totalClientes: totalClientesCalculado, // Pasar también como variable separada
       resumenPedidos: {
         total: ventas.length,
         totalImporte: totalVentas,
         totalEsteMes: totalVentasEsteMes,
         pedidosEsteMes: pedidosEsteMes.length
       },
       usuarioRol: usuarioRol,
       esAdmin: esAdmin,
       selectedYear: selectedYear ? selectedYear.toString() : 'todos',
      error: null
    });
  } catch (error) {
    console.error('❌ [DASHBOARD] Error cargando dashboard:', error);
    console.error('❌ [DASHBOARD] Stack:', error.stack);
    console.error('❌ [DASHBOARD] Mensaje:', error.message);
 
    const estadisticasFallback = await getEstadisticasGlobales();
    
    // Calcular totalClientes en el fallback respetando rol
    let totalClientesFallback = 0;
    try {
      totalClientesFallback = await obtenerTotalClientesPorRol(crm, req);
    } catch (clientesError) {
      console.error('Error obteniendo clientes en fallback:', clientesError);
      totalClientesFallback = 0;
    }
    
    const estadisticasFallbackFinal = {
      ...estadisticasFallback,
      totalClientes: totalClientesFallback || estadisticasFallback.totalClientes || 0
    };
 
    const comercial = req.comercial || req.session.comercial;
    const usuarioRol = getUsuarioRol(req);
    const esAdmin = isAdmin(req);
 
    res.render('dashboard/index-crm', {
      title: 'Dashboard - Farmadescaso',
      user: comercial,
      ventas: [],
      productos: [],
      estadisticas: estadisticasFallbackFinal,
      totalClientes: totalClientesFallback || estadisticasFallback.totalClientes || 0,
      resumenPedidos: {
        total: 0,
        totalImporte: 0
      },
      usuarioRol: usuarioRol,
      esAdmin: esAdmin,
      error: `Error cargando datos del dashboard. Detalles: ${error.message || error}`
    });
  }
});

// Ruta de perfil de usuario
app.get('/dashboard/perfil', requireAuth, async (req, res) => {
  console.log('🔍 [PERFIL] Ruta /dashboard/perfil accedida');
  try {
    const comercialId = req.comercialId || req.session.comercialId;
    console.log('🔍 [PERFIL] Comercial ID:', comercialId);
    
    if (!comercialId) {
      console.log('⚠️ [PERFIL] No hay comercialId, redirigiendo a login');
      return res.redirect('/auth/login');
    }
    
    // Obtener datos completos del comercial desde la base de datos
    console.log('🔍 [PERFIL] Obteniendo datos del comercial desde BD...');
    const comercial = await crm.getComercialById(comercialId);
    console.log('🔍 [PERFIL] Comercial obtenido:', comercial ? 'Sí' : 'No');
    
    if (!comercial) {
      return res.status(404).render('error', { 
        error: 'Usuario no encontrado', 
        message: 'No se pudo cargar la información del perfil' 
      });
    }
    
    // Obtener rol del usuario
    const usuarioRol = getUsuarioRol(req);
    const esAdmin = isAdmin(req);
    
    // Obtener mensajes de query params
    const error = req.query.error || null;
    const success = req.query.success || null;
    
    res.render('dashboard/perfil', {
      title: 'Mi Perfil - Farmadescaso',
      user: comercial,
      comercial: comercial,
      usuarioRol: usuarioRol,
      esAdmin: esAdmin,
      error: error,
      success: success
    });
  } catch (error) {
    console.error('❌ Error cargando perfil:', error);
    res.status(500).render('error', { 
      error: 'Error', 
      message: 'No se pudo cargar el perfil del usuario' 
    });
  }
});

// Ruta del manual de instrucciones
console.log('✅ [RUTAS] Registrando ruta: /dashboard/manual-instrucciones');
app.get('/dashboard/manual-instrucciones', requireAuth, async (req, res) => {
  console.log('📖 [MANUAL] Ruta /dashboard/manual-instrucciones accedida');
  console.log('📖 [MANUAL] Request path:', req.path);
  console.log('📖 [MANUAL] Request method:', req.method);
  console.log('📖 [MANUAL] Request originalUrl:', req.originalUrl);
  try {
    const comercialId = req.comercialId || req.session.comercialId;
    console.log('📖 [MANUAL] Comercial ID:', comercialId);
    
    if (!comercialId) {
      console.log('📖 [MANUAL] No hay comercialId, redirigiendo a login');
      return res.redirect('/auth/login');
    }
    
    console.log('📖 [MANUAL] Obteniendo comercial de BD...');
    const comercial = await crm.getComercialById(comercialId);
    console.log('📖 [MANUAL] Comercial obtenido:', comercial ? 'Sí' : 'No');
    
    if (!comercial) {
      console.log('📖 [MANUAL] Comercial no encontrado');
      return res.status(404).render('error', { 
        error: 'Usuario no encontrado', 
        message: 'No se pudo cargar la información del usuario' 
      });
    }
    
    const usuarioRol = getUsuarioRol(req);
    const esAdmin = isAdmin(req);
    console.log('📖 [MANUAL] Renderizando vista manual-instrucciones...');
    console.log('📖 [MANUAL] esAdmin:', esAdmin);
    
    res.render('dashboard/manual-instrucciones', {
      title: 'Manual de Instrucciones - Farmadescanso CRM',
      user: comercial,
      comercial: comercial,
      usuarioRol: usuarioRol,
      esAdmin: esAdmin
    });
    console.log('📖 [MANUAL] Vista renderizada correctamente');
  } catch (error) {
    console.error('❌ [MANUAL] Error cargando manual:', error);
    console.error('❌ [MANUAL] Stack:', error.stack);
    res.status(500).render('error', { 
      error: 'Error', 
      message: 'No se pudo cargar el manual de instrucciones' 
    });
  }
});

// ============================================
// RUTAS DE AJUSTES - RENTABILIDAD POR PEDIDO - PRIORIDAD ALTA
// ============================================
// IMPORTANTE: Esta ruta debe estar ANTES de otras rutas de ajustes para evitar conflictos

// RUTAS DE DIAGNÓSTICO - FUERA DEL TRY-CATCH PARA QUE SIEMPRE SE REGISTREN
// (Esta ruta ya está definida al inicio del archivo, línea ~431)
// Ruta de diagnóstico duplicada - ELIMINADA (ya está al inicio)

try {
  console.log('🔍 [RUTAS] Intentando cargar módulo rentabilidad-pedidos...');
  let rentabilidadPedidosModule;
  try {
    rentabilidadPedidosModule = require('./routes/rentabilidad-pedidos');
    console.log('✅ [RUTAS] Módulo rentabilidad-pedidos cargado correctamente');
    console.log('✅ [RUTAS] Tipo del módulo:', typeof rentabilidadPedidosModule);
  } catch (moduleError) {
    console.error('❌ [RUTAS] Error cargando módulo rentabilidad-pedidos:', moduleError.message);
    console.error('❌ [RUTAS] Stack:', moduleError.stack);
    // Continuar sin el módulo - las rutas funcionarán sin esas funciones
    rentabilidadPedidosModule = {};
  }
  
  console.log('🔍 [RUTAS] Continuando con el registro de rutas...');
  
  // Verificar que las funciones estén disponibles (solo si el módulo se cargó)
  let obtenerRentabilidadPedidos, obtenerDetalleRentabilidadPedido, obtenerRentabilidadPorComercial;
  
  if (rentabilidadPedidosModule && Object.keys(rentabilidadPedidosModule).length > 0) {
    if (!rentabilidadPedidosModule.obtenerRentabilidadPedidos) {
      console.warn('⚠️ [RUTAS] obtenerRentabilidadPedidos no está exportada desde el módulo');
    } else {
      obtenerRentabilidadPedidos = rentabilidadPedidosModule.obtenerRentabilidadPedidos;
    }
    if (!rentabilidadPedidosModule.obtenerDetalleRentabilidadPedido) {
      console.warn('⚠️ [RUTAS] obtenerDetalleRentabilidadPedido no está exportada desde el módulo');
    } else {
      obtenerDetalleRentabilidadPedido = rentabilidadPedidosModule.obtenerDetalleRentabilidadPedido;
    }
    if (!rentabilidadPedidosModule.obtenerRentabilidadPorComercial) {
      console.warn('⚠️ [RUTAS] obtenerRentabilidadPorComercial no está exportada desde el módulo');
    } else {
      obtenerRentabilidadPorComercial = rentabilidadPedidosModule.obtenerRentabilidadPorComercial;
    }
    console.log('✅ [RUTAS] Funciones importadas correctamente');
  } else {
    console.warn('⚠️ [RUTAS] Módulo rentabilidad-pedidos no se cargó, usando funciones vacías');
    obtenerRentabilidadPedidos = async () => [];
    obtenerDetalleRentabilidadPedido = async () => null;
    obtenerRentabilidadPorComercial = async () => [];
  }
  
  // Ruta de prueba SIN middlewares para diagnosticar
  app.get('/dashboard/ajustes/rentabilidad-pedidos/test', requireAuth, requireAdmin, async (req, res) => {
    try {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test - Rentabilidad Pedidos</title>
          <meta charset="utf-8">
        </head>
        <body>
          <h1>✅ Ruta de prueba funcionando</h1>
          <p>Si ves esto, el servidor está funcionando correctamente.</p>
          <p><a href="/dashboard/ajustes/rentabilidad-pedidos">Ir a la ruta real</a></p>
        </body>
        </html>
      `);
    } catch (error) {
      res.status(500).send(`<h1>Error en ruta de prueba</h1><pre>${error.message}\n${error.stack}</pre>`);
    }
  });

  // Ruta SIN middlewares para diagnosticar el problema - VERSIÓN ULTRA SIMPLE
  app.get('/dashboard/ajustes/rentabilidad-pedidos/debug', requireAuth, requireAdmin, async (req, res) => {
    console.log('🎯 [DEBUG] Ruta debug accedida');
    try {
      console.log('🎯 [DEBUG] HITO 1: Inicio');
      
      console.log('🎯 [DEBUG] HITO 2: Obteniendo pedidos...');
      const pedidosRaw = await crm.getPedidos();
      console.log(`✅ [DEBUG] HITO 2: Pedidos obtenidos: ${pedidosRaw ? pedidosRaw.length : 0}`);
      
      console.log('🎯 [DEBUG] HITO 3: Formateando pedidos...');
      const pedidos = (pedidosRaw || []).slice(0, 5).map(p => ({
        id: p.Id || p.id,
        NumPedido: p.NumPedido || '-',
        FechaPedido: p.FechaPedido || null,
        BaseImponible: parseFloat(p.BaseImponible || 0)
      }));
      console.log(`✅ [DEBUG] HITO 3: ${pedidos.length} pedidos formateados`);
      
      console.log('🎯 [DEBUG] HITO 4: Obteniendo comerciales...');
      const comerciales = await crm.getComerciales().catch(() => []);
      console.log(`✅ [DEBUG] HITO 4: ${comerciales.length} comerciales obtenidos`);
      
      console.log('🎯 [DEBUG] HITO 5: Renderizando vista...');
      res.render('dashboard/ajustes-rentabilidad-pedidos', {
        title: 'Rentabilidad por Pedido - DEBUG',
        user: { nombre: 'Debug User', zona: 'Debug' },
        pedidos: pedidos,
        comerciales: comerciales || [],
        filtros: {},
        currentPage: 'ajustes-rentabilidad-pedidos',
        req: req
      });
      console.log('✅ [DEBUG] HITO 5: Vista renderizada');
      
    } catch (error) {
      console.error('❌ [DEBUG] ERROR:', error.message);
      console.error('❌ [DEBUG] STACK:', error.stack);
      res.status(500).send(`
        <h1>Error 500 - DEBUG</h1>
        <p><strong>Mensaje:</strong> ${error.message}</p>
        <pre>${error.stack}</pre>
      `);
    }
  });
  
  // Ruta principal - Rentabilidad por Pedido (lista) - VERSIÓN SIN MIDDLEWARES PARA DIAGNÓSTICO
  app.get('/dashboard/ajustes/rentabilidad-pedidos-sin-middlewares', blockInProduction, (req, res) => {
    console.log('✅ [RENTABILIDAD-PEDIDOS] Ruta SIN middlewares accedida');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rentabilidad por Pedido - Sin Middlewares</title>
        <meta charset="UTF-8">
      </head>
      <body>
        <h1>Rentabilidad por Pedido</h1>
        <p>✅ Esta ruta funciona SIN middlewares</p>
        <p>Si ves esto, el problema está en requireAuth o requireAdmin</p>
        <table border="1">
          <thead>
            <tr>
              <th>Nº Pedido</th>
              <th>Fecha</th>
              <th>Base Imponible</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>P250001</td>
              <td>21/12/2025</td>
              <td>€ 1.234,56</td>
            </tr>
          </tbody>
        </table>
        <p><a href="/dashboard/ajustes/rentabilidad-pedidos">Probar con middlewares</a></p>
      </body>
      </html>
    `);
  });

  // Ruta principal - MOVIDA FUERA DEL TRY-CATCH (ver más abajo)
  
  // Ruta detalle de pedido
  app.get('/dashboard/ajustes/rentabilidad-pedidos/pedido/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log('✅ [RENTABILIDAD-PEDIDOS] Ruta GET /pedido/:id accedida');
      const pedidoId = req.params.id;
      const pedido = await obtenerDetalleRentabilidadPedido(pedidoId);
      
      if (!pedido) {
        return res.status(404).render('error', {
          error: 'Pedido no encontrado',
          message: 'El pedido solicitado no existe'
        });
      }
      
      const user = req.comercial || req.session?.comercial || req.user;
      
      res.render('dashboard/ajustes-rentabilidad-pedido-detalle', {
        title: `Rentabilidad Pedido ${pedido.NumPedido} - Farmadescaso`,
        user: user,
        pedido: pedido,
        currentPage: 'ajustes-rentabilidad-pedidos',
        req: req
      });
    } catch (error) {
      console.error('❌ Error en vista de detalle de pedido:', error);
      res.status(500).render('error', {
        error: 'Error cargando detalle',
        message: error.message
      });
    }
  });
  
  // Ruta rentabilidad por comercial
  app.get('/dashboard/ajustes/rentabilidad-pedidos/comerciales', requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log('✅ [RENTABILIDAD-PEDIDOS] Ruta GET /comerciales accedida');
      const filtros = {
        comercial_id: req.query.comercial_id || null,
        fecha_desde: req.query.fecha_desde || null,
        fecha_hasta: req.query.fecha_hasta || null
      };
      
      const comerciales = await obtenerRentabilidadPorComercial(filtros);
      const todosComerciales = await crm.getComerciales();
      
      const user = req.comercial || req.session?.comercial || req.user;
      
      res.render('dashboard/ajustes-rentabilidad-comerciales', {
        title: 'Rentabilidad por Comercial - Farmadescaso',
        user: user,
        comerciales: comerciales,
        todosComerciales: todosComerciales || [],
        filtros: filtros,
        currentPage: 'ajustes-rentabilidad-pedidos',
        error: null,
        req: req
      });
    } catch (error) {
      console.error('❌ Error en vista de rentabilidad por comercial:', error);
      res.status(500).render('error', {
        error: 'Error cargando rentabilidad',
        message: error.message
      });
    }
  });
  
  console.log('✅ [RUTAS] Rutas de rentabilidad-pedidos registradas correctamente');
} catch (error) {
  console.error('═══════════════════════════════════════════════════════════');
  console.error('❌ [RUTAS] ERROR CRÍTICO cargando rutas de rentabilidad-pedidos:');
  console.error('❌ [RUTAS] Mensaje:', error.message);
  console.error('❌ [RUTAS] Stack:', error.stack);
  console.error('═══════════════════════════════════════════════════════════');
}

// ============================================
// RUTA PRINCIPAL DE RENTABILIDAD-PEDIDOS - FUERA DEL TRY-CATCH
// ============================================
// Esta ruta se registra SIEMPRE, independientemente de errores en el módulo
// ============================================
// IMPORTANTE: Esta es la ÚNICA definición de la ruta principal
// Si hay otra definición antes, esta la sobrescribirá
// ============================================
console.log('🔧 [RUTAS] ===========================================');
console.log('🔧 [RUTAS] Registrando ruta principal de rentabilidad-pedidos FUERA del try-catch...');
console.log('🔧 [RUTAS] Timestamp de registro:', new Date().toISOString());
console.log('🔧 [RUTAS] ===========================================');

// ELIMINAR CUALQUIER RUTA ANTERIOR QUE PUEDA ESTAR INTERCEPTANDO
// Esto asegura que solo esta ruta se ejecute
const existingRoute = app._router.stack.find(layer => 
  layer.route && 
  layer.route.path === '/dashboard/ajustes/rentabilidad-pedidos' &&
  layer.route.methods.get
);
if (existingRoute) {
  console.log('⚠️ [RUTAS] Se encontró una ruta anterior, será sobrescrita');
}

// ============================================
// RUTA DE PRUEBA PARA VERIFICAR ACCESO A MARCAS (SIN MIDDLEWARES)
// ============================================
// Esta ruta DEBE estar ANTES de la ruta principal para que funcione
// ============================================
app.get('/dashboard/ajustes/rentabilidad-pedidos/test-marcas', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 [TEST-MARCAS] Iniciando prueba de acceso a tabla Marcas...');
    
    // Intentar diferentes variantes
    const resultados = {
      intentos: [],
      marcasEncontradas: null,
      error: null
    };
    
    // Intento 1: Marcas con mayúscula y backticks
    try {
      const r1 = await crm.query('SELECT * FROM `Marcas` ORDER BY Nombre ASC');
      resultados.intentos.push({
        consulta: 'SELECT * FROM `Marcas`',
        exito: true,
        cantidad: Array.isArray(r1) ? r1.length : 0,
        datos: r1
      });
      if (Array.isArray(r1) && r1.length > 0) {
        resultados.marcasEncontradas = r1;
      }
    } catch (e1) {
      resultados.intentos.push({
        consulta: 'SELECT * FROM `Marcas`',
        exito: false,
        error: e1.message
      });
    }
    
    // Intento 2: marcas con minúscula y backticks
    if (!resultados.marcasEncontradas) {
      try {
        const r2 = await crm.query('SELECT * FROM `marcas` ORDER BY Nombre ASC');
        resultados.intentos.push({
          consulta: 'SELECT * FROM `marcas`',
          exito: true,
          cantidad: Array.isArray(r2) ? r2.length : 0,
          datos: r2
        });
        if (Array.isArray(r2) && r2.length > 0) {
          resultados.marcasEncontradas = r2;
        }
      } catch (e2) {
        resultados.intentos.push({
          consulta: 'SELECT * FROM `marcas`',
          exito: false,
          error: e2.message
        });
      }
    }
    
    // Intento 3: Sin backticks
    if (!resultados.marcasEncontradas) {
      try {
        const r3 = await crm.query('SELECT * FROM marcas ORDER BY Nombre ASC');
        resultados.intentos.push({
          consulta: 'SELECT * FROM marcas',
          exito: true,
          cantidad: Array.isArray(r3) ? r3.length : 0,
          datos: r3
        });
        if (Array.isArray(r3) && r3.length > 0) {
          resultados.marcasEncontradas = r3;
        }
      } catch (e3) {
        resultados.intentos.push({
          consulta: 'SELECT * FROM marcas',
          exito: false,
          error: e3.message
        });
      }
    }
    
    // Verificar estructura de la tabla
    let estructuraTabla = null;
    try {
      estructuraTabla = await crm.query('DESCRIBE `Marcas`').catch(() => 
        crm.query('DESCRIBE `marcas`').catch(() => 
          crm.query('DESCRIBE marcas')
        )
      );
    } catch (e) {
      console.warn('⚠️ No se pudo obtener estructura de la tabla:', e.message);
    }
    
    res.json({
      exito: resultados.marcasEncontradas !== null,
      marcas: resultados.marcasEncontradas,
      intentos: resultados.intentos,
      estructuraTabla: estructuraTabla,
      totalMarcas: resultados.marcasEncontradas ? resultados.marcasEncontradas.length : 0
    });
  } catch (error) {
    console.error('❌ [TEST-MARCAS] Error:', error);
    res.status(500).json({
      exito: false,
      error: error.message,
      stack: error.stack
    });
  }
});

console.log('✅ [RUTAS] Ruta de prueba /test-marcas registrada');

// Ruta alternativa más simple para probar marcas
app.get('/test-marcas-simple', blockInProduction, async (req, res) => {
  try {
    console.log('🔍 [TEST-MARCAS-SIMPLE] Probando acceso a tabla Marcas...');
    const marcas = await crm.query('SELECT * FROM `Marcas` ORDER BY Nombre ASC').catch(() => 
      crm.query('SELECT * FROM `marcas` ORDER BY Nombre ASC').catch(() => 
        crm.query('SELECT * FROM marcas ORDER BY Nombre ASC')
      )
    );
    res.json({
      exito: true,
      marcas: marcas,
      total: Array.isArray(marcas) ? marcas.length : 0
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

app.get('/dashboard/ajustes/rentabilidad-pedidos', requireAuth, requireAdmin, async (req, res) => {
  // Inicializar variables al inicio para evitar errores de scope
  let pedidosRaw = [];
  let pedidos = [];
  let comerciales = [];
  let marcas = [];
  let estadisticas = {};
  let ventas = [];
  
  try {
    // LOG MUY VISIBLE PARA VERIFICAR QUE SE EJECUTA
    // ============================================
    // VERSIÓN ACTUALIZADA - 2025-12-21
    // Esta ruta obtiene datos REALES de la base de datos
    // ============================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅✅✅ [RENTABILIDAD-PEDIDOS] RUTA NUEVA ACCEDIDA - VERSIÓN CON DATOS REALES ✅✅✅');
    console.log('✅ [RENTABILIDAD-PEDIDOS] Timestamp:', new Date().toISOString());
    console.log('✅ [RENTABILIDAD-PEDIDOS] Esta es la versión NUEVA con datos reales de la BD');
    console.log('✅ [RENTABILIDAD-PEDIDOS] Si ves este log, el código nuevo se está ejecutando');
    console.log('═══════════════════════════════════════════════════════════');
    
    // Si el usuario ve "✅ Esta ruta funciona", significa que el servidor NO se ha reiniciado
    // y está ejecutando una versión anterior del código
    
    // ========== CREAR ARRAY CON VARIABLES DEL FILTRO ANTES DE PROCESAR ==========
    // Preservar los valores originales de req.query ANTES de cualquier procesamiento
    // IMPORTANTE: No convertir a null si el valor existe, incluso si es string como "1"
    const filtrosRaw = {
      comercial_id: req.query.comercial_id,
      fecha_desde: req.query.fecha_desde,
      fecha_hasta: req.query.fecha_hasta,
      marca_id: req.query.marca_id
    };
    
    console.log('🔍 [RENTABILIDAD-PEDIDOS] ========== FILTROS RAW (ANTES DE PROCESAR) ==========');
    console.log('🔍 [RENTABILIDAD-PEDIDOS] req.query completo:', JSON.stringify(req.query, null, 2));
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtrosRaw (preservados):', JSON.stringify(filtrosRaw, null, 2));
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtrosRaw.marca_id:', filtrosRaw.marca_id, 'tipo:', typeof filtrosRaw.marca_id);
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtrosRaw.marca_id !== undefined:', filtrosRaw.marca_id !== undefined);
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtrosRaw.marca_id !== null:', filtrosRaw.marca_id !== null);
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtrosRaw.marca_id !== "":', filtrosRaw.marca_id !== '');
    
    // Procesar filtros - convertir strings vacíos a null, pero preservar valores válidos (incluso strings como "1")
    const getFilterValue = (value) => {
      // Si el valor es undefined o null, retornar null
      if (value === undefined || value === null) {
        return null;
      }
      // Si es string vacío, retornar null
      if (value === '') {
        return null;
      }
      // En cualquier otro caso (incluyendo "1", "2", etc.), retornar el valor tal cual
      return value;
    };
    
    const filtros = {
      comercial_id: getFilterValue(filtrosRaw.comercial_id),
      fecha_desde: getFilterValue(filtrosRaw.fecha_desde),
      fecha_hasta: getFilterValue(filtrosRaw.fecha_hasta),
      marca_id: getFilterValue(filtrosRaw.marca_id),
      tipo_pedido_id: getFilterValue(filtrosRaw.tipo_pedido_id)
    };
    
    // Debug adicional para verificar que getFilterValue funciona correctamente
    console.log('🔍 [RENTABILIDAD-PEDIDOS] [DEBUG GETFILTERVALUE]');
    console.log('   - filtrosRaw.marca_id:', filtrosRaw.marca_id, 'tipo:', typeof filtrosRaw.marca_id);
    console.log('   - filtrosRaw.marca_id === undefined:', filtrosRaw.marca_id === undefined);
    console.log('   - filtrosRaw.marca_id === null:', filtrosRaw.marca_id === null);
    console.log('   - filtrosRaw.marca_id === "":', filtrosRaw.marca_id === '');
    console.log('   - getFilterValue(filtrosRaw.marca_id):', getFilterValue(filtrosRaw.marca_id));
    console.log('   - filtros.marca_id resultante:', filtros.marca_id, 'tipo:', typeof filtros.marca_id);
    
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtros (procesados):', JSON.stringify(filtros, null, 2));
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtros.marca_id:', filtros.marca_id, 'tipo:', typeof filtros.marca_id);
    console.log('🔍 [RENTABILIDAD-PEDIDOS] ====================================================');
    
    // Obtener marcas PRIMERO - siempre necesario para el filtro
    console.log('🔍 [RENTABILIDAD-PEDIDOS] Obteniendo marcas desde tabla `Marcas`...');
    try {
      // Consulta verificada y funcionando según script obtener-estructura-marcas.js
      const marcasRaw = await crm.query('SELECT id, Nombre FROM `Marcas` ORDER BY Nombre ASC');
      
      if (marcasRaw && Array.isArray(marcasRaw)) {
        // Normalizar los datos - la tabla tiene: id (int) y Nombre (varchar)
        marcas = marcasRaw.map(m => ({
          id: m.id,
          Id: m.id,
          Nombre: m.Nombre,
          nombre: m.Nombre
        }));
        
        console.log(`✅ [RENTABILIDAD-PEDIDOS] Marcas obtenidas exitosamente: ${marcas.length}`);
        if (marcas.length > 0) {
          console.log(`📋 [RENTABILIDAD-PEDIDOS] Listado de marcas:`);
          marcas.forEach((m, i) => {
            console.log(`   ${i + 1}. ID: ${m.id}, Nombre: ${m.Nombre}`);
          });
        } else {
          console.warn(`⚠️ [RENTABILIDAD-PEDIDOS] La consulta devolvió un array vacío`);
        }
      } else {
        marcas = [];
        console.error(`❌ [RENTABILIDAD-PEDIDOS] marcasRaw no es un array válido. Tipo: ${typeof marcasRaw}, Valor:`, marcasRaw);
      }
    } catch (error) {
      console.error('❌ [RENTABILIDAD-PEDIDOS] Error obteniendo marcas:', error.message);
      console.error('❌ [RENTABILIDAD-PEDIDOS] Stack:', error.stack);
      marcas = [];
    }
    console.log(`✅ [RENTABILIDAD-PEDIDOS] Marcas finales preparadas: ${marcas.length}`);
    
    // Obtener pedidos - aplicar filtro de marca directamente en la consulta si existe
    console.log('🔍 [RENTABILIDAD-PEDIDOS] Obteniendo pedidos...');
    
    // Inicializar debugInfo ANTES de ejecutar las consultas SQL
    let debugInfo = {
      filtroMarcaAplicado: false,
      marcaId: null,
      sentenciaSQL: null,
      sentenciaSQLOriginal: null,
      parametrosSQL: null,
      pedidosEncontrados: 0,
      totalPedidos: 0,
      mensaje: 'No se aplicó filtro de marca',
      filtrosRaw: filtrosRaw || {},
      filtrosProcesados: filtros || {},
      filtrosParaVista: {}
    };
    
    let marcaFiltradaEnSQL = false;
    // Usar filtrosRaw.marca_id (preservado antes de procesar) - es la fuente de verdad
    // IMPORTANTE: filtrosRaw.marca_id puede ser un string como "1" o "2", necesitamos convertirlo a número
    // Asegurarse de que filtrosRaw existe antes de usarlo
    const marcaIdRaw = (filtrosRaw && filtrosRaw.marca_id !== undefined) ? filtrosRaw.marca_id : (req.query.marca_id !== undefined ? req.query.marca_id : null);
    
    console.log('🔍 [RENTABILIDAD-PEDIDOS] [SQL] ========== VERIFICACIÓN FILTRO MARCA ==========');
    console.log('🔍 [RENTABILIDAD-PEDIDOS] [SQL] req.query completo:', JSON.stringify(req.query, null, 2));
    console.log('🔍 [RENTABILIDAD-PEDIDOS] [SQL] filtrosRaw:', JSON.stringify(filtrosRaw, null, 2));
    console.log('🔍 [RENTABILIDAD-PEDIDOS] [SQL] filtrosRaw.marca_id:', filtrosRaw.marca_id, 'tipo:', typeof filtrosRaw.marca_id);
    console.log('🔍 [RENTABILIDAD-PEDIDOS] [SQL] req.query.marca_id:', req.query.marca_id, 'tipo:', typeof req.query.marca_id);
    console.log('🔍 [RENTABILIDAD-PEDIDOS] [SQL] marcaIdRaw (resultado):', marcaIdRaw, 'tipo:', typeof marcaIdRaw);
    console.log('🔍 [RENTABILIDAD-PEDIDOS] [SQL] Condiciones de validación:');
    console.log('   - marcaIdRaw !== undefined:', marcaIdRaw !== undefined);
    console.log('   - marcaIdRaw !== null:', marcaIdRaw !== null);
    console.log('   - marcaIdRaw !== "":', marcaIdRaw !== '');
    console.log('   - marcaIdRaw !== "0":', marcaIdRaw !== '0');
    console.log('   - marcaIdRaw !== "null":', marcaIdRaw !== 'null');
    console.log('   - String(marcaIdRaw).trim():', marcaIdRaw ? String(marcaIdRaw).trim() : 'N/A');
    
    // Validar que el valor sea válido (no null, undefined, string vacío, '0', o 'null')
    // IMPORTANTE: También verificar que después de trim() no quede vacío
    const marcaIdValido = marcaIdRaw !== undefined && 
                          marcaIdRaw !== null && 
                          marcaIdRaw !== '' && 
                          String(marcaIdRaw).trim() !== '' &&
                          marcaIdRaw !== '0' && 
                          marcaIdRaw !== 'null';
    
    console.log('🔍 [RENTABILIDAD-PEDIDOS] [SQL] marcaIdValido:', marcaIdValido);
    if (!marcaIdValido) {
      console.warn('⚠️ [RENTABILIDAD-PEDIDOS] [SQL] NO SE APLICARÁ FILTRO DE MARCA - marcaIdRaw no es válido');
    }
    
    if (marcaIdValido) {
      // Convertir a número explícitamente - puede venir como string "1" o "2"
      const marcaId = parseInt(String(marcaIdRaw).trim(), 10);
      console.log('🔍 [RENTABILIDAD-PEDIDOS] [SQL] marcaIdRaw (original):', marcaIdRaw, 'tipo:', typeof marcaIdRaw);
      console.log('🔍 [RENTABILIDAD-PEDIDOS] [SQL] marcaId (parseado):', marcaId, 'tipo:', typeof marcaId, 'es NaN:', isNaN(marcaId));
      if (!isNaN(marcaId) && marcaId > 0) {
        console.log(`✅ [RENTABILIDAD-PEDIDOS] [SQL] ========== APLICANDO FILTRO DE MARCA ${marcaId} ==========`);
        console.log(`✅ [RENTABILIDAD-PEDIDOS] [SQL] marcaId validado: ${marcaId} (tipo: ${typeof marcaId}, es número: ${typeof marcaId === 'number'})`);
        console.log(`🔍 [RENTABILIDAD-PEDIDOS] Lógica: Mostrar pedidos que tengan AL MENOS UN artículo de la marca ${marcaId}`);
        
        try {
          // Obtener pedidos que tengan al menos un artículo de la marca seleccionada
          // La lógica: revisar cada línea del pedido, ver a qué marca pertenece
          // Si un pedido tiene al menos un artículo de la marca, mostrarlo completo
          // Si un pedido NO tiene ningún artículo de la marca, NO mostrarlo
          
          // Asegurar que el parámetro sea un número
          const marcaIdParam = Number(marcaId);
          
          // Variables para capturar la sentencia SQL final ejecutada
          // IMPORTANTE: Inicializar como null para asegurar que se capture la última consulta exitosa
          let sqlFinalEjecutada = null;
          let parametrosFinales = null;
          
          console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] Preparando consulta SQL para marca ID: ${marcaId}`);
          
          // Primero intentar con Id_NumPedido (relación por ID numérico)
          // IMPORTANTE: Verificar nombres de tablas - pueden ser case-sensitive
          let sql = `
            SELECT DISTINCT p.*
            FROM pedidos p
            INNER JOIN pedidos_articulos pa ON pa.Id_NumPedido = p.Id
            INNER JOIN articulos a ON a.id = pa.Id_Articulo
            WHERE a.Id_Marca = ?
            ORDER BY p.Id DESC
          `;
          
          console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] ========== EJECUTANDO CONSULTA SQL ==========`);
          console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] marcaIdRaw (original): ${marcaIdRaw} (tipo: ${typeof marcaIdRaw})`);
          console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] marcaId (parseado): ${marcaId} (tipo: ${typeof marcaId})`);
          console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] marcaIdParam (final): ${marcaIdParam} (tipo: ${typeof marcaIdParam})`);
          console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] SQL completo:`, sql.replace(/\s+/g, ' ').trim());
          console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] Parámetros SQL: [${marcaIdParam}] (tipo: ${typeof marcaIdParam})`);
          console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] Verificando: WHERE a.Id_Marca = ${marcaIdParam}`);
          console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] ==========================================`);
          
          try {
            pedidosRaw = await crm.query(sql, [marcaIdParam]);
            console.log(`✅ [RENTABILIDAD-PEDIDOS] [SQL] Consulta ejecutada exitosamente. Resultados: ${pedidosRaw ? pedidosRaw.length : 0}`);
          } catch (sqlError) {
            console.error(`❌ [RENTABILIDAD-PEDIDOS] [SQL] Error ejecutando consulta:`, sqlError.message);
            console.error(`❌ [RENTABILIDAD-PEDIDOS] [SQL] Stack:`, sqlError.stack);
            // Intentar con nombres de tabla diferentes (case-sensitive)
            console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] Intentando con nombres de tabla alternativos...`);
            try {
              sql = `
                SELECT DISTINCT p.*, tp.Tipo as TipoPedido
                FROM Pedidos p
                INNER JOIN Pedidos_Articulos pa ON pa.Id_NumPedido = p.Id
                INNER JOIN Articulos a ON a.id = pa.Id_Articulo
                LEFT JOIN Tipos_Pedidos tp ON tp.id = p.Id_TipoPedido
                WHERE a.Id_Marca = ?
                ORDER BY p.Id DESC
              `;
              pedidosRaw = await crm.query(sql, [marcaIdParam]);
              console.log(`✅ [RENTABILIDAD-PEDIDOS] [SQL] Consulta con nombres capitalizados exitosa. Resultados: ${pedidosRaw ? pedidosRaw.length : 0}`);
            } catch (sqlError2) {
              console.error(`❌ [RENTABILIDAD-PEDIDOS] [SQL] Error con nombres capitalizados:`, sqlError2.message);
              throw sqlError; // Lanzar el error original
            }
          }
          // Actualizar sqlFinalEjecutada y parametrosFinales solo si no se habían actualizado antes
          if (!sqlFinalEjecutada) {
            sqlFinalEjecutada = sql.replace(/\s+/g, ' ').trim();
            parametrosFinales = [marcaIdParam];
          }
          
          console.log(`✅ [RENTABILIDAD-PEDIDOS] [SQL] RESULTADO: ${pedidosRaw ? pedidosRaw.length : 0} pedidos encontrados`);
          if (pedidosRaw && pedidosRaw.length > 0) {
            console.log(`📊 [RENTABILIDAD-PEDIDOS] [SQL] Primeros 3 pedidos:`, pedidosRaw.slice(0, 3).map(p => ({
              Id: p.Id || p.id,
              NumPedido: p.NumPedido || p.Numero_Pedido
            })));
          }
          
          // Si no hay resultados, intentar con NumPedido (relación por número de pedido string)
          if (!pedidosRaw || pedidosRaw.length === 0) {
            console.log(`🔍 [RENTABILIDAD-PEDIDOS] No se encontraron pedidos por Id_NumPedido, intentando por NumPedido...`);
            sql = `
              SELECT DISTINCT p.*, tp.Tipo as TipoPedido
              FROM pedidos p
              INNER JOIN pedidos_articulos pa ON pa.NumPedido = p.NumPedido
              INNER JOIN articulos a ON a.id = pa.Id_Articulo
              LEFT JOIN tipos_pedidos tp ON tp.id = p.Id_TipoPedido
              WHERE a.Id_Marca = ?
              ORDER BY p.Id DESC
            `;
            const marcaIdParam2 = Number(marcaId);
            console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] Intentando con NumPedido, marcaIdParam: ${marcaIdParam2} (tipo: ${typeof marcaIdParam2})`);
            try {
              pedidosRaw = await crm.query(sql, [marcaIdParam2]);
              // Actualizar solo si no se había capturado antes
              if (!sqlFinalEjecutada) {
                sqlFinalEjecutada = sql.replace(/\s+/g, ' ').trim();
                parametrosFinales = [marcaIdParam2];
                console.log(`✅ [RENTABILIDAD-PEDIDOS] [SQL] Sentencia SQL capturada (NumPedido):`, sqlFinalEjecutada);
                console.log(`✅ [RENTABILIDAD-PEDIDOS] [SQL] Parámetros capturados:`, JSON.stringify(parametrosFinales));
              }
              console.log(`✅ [RENTABILIDAD-PEDIDOS] Pedidos encontrados por NumPedido: ${pedidosRaw ? pedidosRaw.length : 0}`);
            } catch (sqlError) {
              console.error(`❌ [RENTABILIDAD-PEDIDOS] [SQL] Error con NumPedido:`, sqlError.message);
              // Intentar con nombres capitalizados
              try {
                sql = `
                  SELECT DISTINCT p.*, tp.Tipo as TipoPedido
                  FROM Pedidos p
                  INNER JOIN Pedidos_Articulos pa ON pa.NumPedido = p.NumPedido
                  INNER JOIN Articulos a ON a.id = pa.Id_Articulo
                  LEFT JOIN Tipos_Pedidos tp ON tp.id = p.Id_TipoPedido
                  WHERE a.Id_Marca = ?
                  ORDER BY p.Id DESC
                `;
                pedidosRaw = await crm.query(sql, [marcaIdParam2]);
                sqlFinalEjecutada = sql.replace(/\s+/g, ' ').trim();
                parametrosFinales = [marcaIdParam2];
                console.log(`✅ [RENTABILIDAD-PEDIDOS] Pedidos encontrados por NumPedido (capitalizado): ${pedidosRaw ? pedidosRaw.length : 0}`);
              } catch (sqlError2) {
                console.error(`❌ [RENTABILIDAD-PEDIDOS] [SQL] Error con NumPedido capitalizado:`, sqlError2.message);
              }
            }
          }
          
          // Si aún no hay resultados, intentar con ambas condiciones (OR)
          if (!pedidosRaw || pedidosRaw.length === 0) {
            console.log(`🔍 [RENTABILIDAD-PEDIDOS] Intentando con ambas condiciones (Id_NumPedido OR NumPedido)...`);
            sql = `
              SELECT DISTINCT p.*
              FROM pedidos p
              INNER JOIN pedidos_articulos pa ON (pa.Id_NumPedido = p.Id OR pa.NumPedido = p.NumPedido)
              INNER JOIN articulos a ON a.id = pa.Id_Articulo
              WHERE a.Id_Marca = ?
              ORDER BY p.Id DESC
            `;
            const marcaIdParam3 = Number(marcaId);
            console.log(`🔍 [RENTABILIDAD-PEDIDOS] [SQL] Intentando con ambas condiciones, marcaIdParam: ${marcaIdParam3} (tipo: ${typeof marcaIdParam3})`);
            try {
              pedidosRaw = await crm.query(sql, [marcaIdParam3]);
              // Actualizar solo si no se había capturado antes
              if (!sqlFinalEjecutada) {
                sqlFinalEjecutada = sql.replace(/\s+/g, ' ').trim();
                parametrosFinales = [marcaIdParam3];
                console.log(`✅ [RENTABILIDAD-PEDIDOS] [SQL] Sentencia SQL capturada (ambas condiciones):`, sqlFinalEjecutada);
                console.log(`✅ [RENTABILIDAD-PEDIDOS] [SQL] Parámetros capturados:`, JSON.stringify(parametrosFinales));
              }
              console.log(`✅ [RENTABILIDAD-PEDIDOS] Pedidos encontrados con ambas condiciones: ${pedidosRaw ? pedidosRaw.length : 0}`);
            } catch (sqlError) {
              console.error(`❌ [RENTABILIDAD-PEDIDOS] [SQL] Error con ambas condiciones:`, sqlError.message);
              // Intentar con nombres capitalizados
              try {
                sql = `
                  SELECT DISTINCT p.*, tp.Tipo as TipoPedido
                  FROM Pedidos p
                  INNER JOIN Pedidos_Articulos pa ON (pa.Id_NumPedido = p.Id OR pa.NumPedido = p.NumPedido)
                  INNER JOIN Articulos a ON a.id = pa.Id_Articulo
                  LEFT JOIN Tipos_Pedidos tp ON tp.id = p.Id_TipoPedido
                  WHERE a.Id_Marca = ?
                  ORDER BY p.Id DESC
                `;
                pedidosRaw = await crm.query(sql, [marcaIdParam3]);
                // Actualizar solo si no se había capturado antes
                if (!sqlFinalEjecutada) {
                  sqlFinalEjecutada = sql.replace(/\s+/g, ' ').trim();
                  parametrosFinales = [marcaIdParam3];
                  console.log(`✅ [RENTABILIDAD-PEDIDOS] [SQL] Sentencia SQL capturada (ambas condiciones capitalizado):`, sqlFinalEjecutada);
                  console.log(`✅ [RENTABILIDAD-PEDIDOS] [SQL] Parámetros capturados:`, JSON.stringify(parametrosFinales));
                }
                console.log(`✅ [RENTABILIDAD-PEDIDOS] Pedidos encontrados con ambas condiciones (capitalizado): ${pedidosRaw ? pedidosRaw.length : 0}`);
              } catch (sqlError2) {
                console.error(`❌ [RENTABILIDAD-PEDIDOS] [SQL] Error con ambas condiciones capitalizado:`, sqlError2.message);
              }
            }
          }
          
          marcaFiltradaEnSQL = true;
          console.log(`✅ [RENTABILIDAD-PEDIDOS] Total pedidos obtenidos con filtro de marca en SQL: ${pedidosRaw ? pedidosRaw.length : 0}`);
          
          // Guardar la sentencia SQL final que se ejecutó (con parámetros sustituidos para mostrar)
          if (sqlFinalEjecutada && parametrosFinales && parametrosFinales.length > 0) {
            // Crear versión con parámetros sustituidos para mostrar
            // IMPORTANTE: Sustituir cada ? con el valor real del parámetro
            let sqlConParametros = sqlFinalEjecutada;
            let paramIndex = 0;
            
            // Reemplazar cada ? con el valor real del parámetro correspondiente
            sqlConParametros = sqlConParametros.replace(/\?/g, () => {
              if (paramIndex < parametrosFinales.length) {
                const param = parametrosFinales[paramIndex];
                paramIndex++;
                // Mostrar el valor real del parámetro
                return param !== undefined && param !== null ? param : '?';
              }
              return '?';
            });
            
            debugInfo.sentenciaSQL = sqlConParametros;
            debugInfo.sentenciaSQLOriginal = sqlFinalEjecutada; // Guardar también la original con ?
            debugInfo.parametrosSQL = parametrosFinales;
            debugInfo.filtroMarcaAplicado = true;
            debugInfo.marcaId = marcaId;
            debugInfo.mensaje = `Filtro de marca ${marcaId} aplicado correctamente. ${pedidosRaw ? pedidosRaw.length : 0} pedidos encontrados.`;
            debugInfo.pedidosEncontrados = pedidosRaw ? pedidosRaw.length : 0;
            
            console.log(`📝 [RENTABILIDAD-PEDIDOS] [DEBUG] ========== SENTENCIA SQL CAPTURADA ==========`);
            console.log(`📝 [RENTABILIDAD-PEDIDOS] [DEBUG] SQL Original (con ?):`, sqlFinalEjecutada);
            console.log(`📝 [RENTABILIDAD-PEDIDOS] [DEBUG] SQL con Parámetros Sustituidos:`, sqlConParametros);
            console.log(`📝 [RENTABILIDAD-PEDIDOS] [DEBUG] Parámetros usados:`, JSON.stringify(parametrosFinales));
            console.log(`📝 [RENTABILIDAD-PEDIDOS] [DEBUG] Marca ID: ${marcaId} (tipo: ${typeof marcaId})`);
            console.log(`📝 [RENTABILIDAD-PEDIDOS] [DEBUG] Pedidos encontrados: ${pedidosRaw ? pedidosRaw.length : 0}`);
            console.log(`📝 [RENTABILIDAD-PEDIDOS] [DEBUG] ==========================================`);
          } else {
            console.warn(`⚠️ [RENTABILIDAD-PEDIDOS] [DEBUG] No se pudo capturar la sentencia SQL`);
            console.warn(`   - sqlFinalEjecutada: ${sqlFinalEjecutada ? 'existe' : 'null/undefined'}`);
            console.warn(`   - parametrosFinales: ${parametrosFinales ? JSON.stringify(parametrosFinales) : 'null/undefined'}`);
            console.warn(`   - marcaId: ${marcaId}`);
          }
          
          if (pedidosRaw && pedidosRaw.length > 0) {
            console.log(`📊 [RENTABILIDAD-PEDIDOS] Primeros 3 pedidos encontrados:`, pedidosRaw.slice(0, 3).map(p => ({
              Id: p.Id || p.id,
              NumPedido: p.NumPedido || p.Numero_Pedido
            })));
            
            // Verificar que los pedidos realmente tienen artículos de la marca
            console.log(`🔍 [RENTABILIDAD-PEDIDOS] Verificando que los pedidos tienen artículos de la marca ${marcaId}...`);
            for (let i = 0; i < Math.min(3, pedidosRaw.length); i++) {
              const pedido = pedidosRaw[i];
              const pedidoId = pedido.Id || pedido.id;
              const numPedido = pedido.NumPedido || pedido.Numero_Pedido;
              
              try {
                const verificarSQL = `
                  SELECT COUNT(*) as count
                  FROM pedidos_articulos pa
                  INNER JOIN articulos a ON a.id = pa.Id_Articulo
                  WHERE (pa.Id_NumPedido = ? OR pa.NumPedido = ?) AND a.Id_Marca = ?
                `;
                const verificacion = await crm.query(verificarSQL, [pedidoId, numPedido, marcaId]);
                console.log(`  📋 Pedido ${numPedido} (ID: ${pedidoId}): ${verificacion[0]?.count || 0} artículos de la marca ${marcaId}`);
              } catch (err) {
                console.warn(`  ⚠️ Error verificando pedido ${numPedido}:`, err.message);
              }
            }
          } else {
            console.warn(`⚠️ [RENTABILIDAD-PEDIDOS] No se encontraron pedidos con artículos de la marca ${marcaId}`);
            console.warn(`⚠️ [RENTABILIDAD-PEDIDOS] Esto puede significar que:`);
            console.warn(`   - No hay pedidos con artículos de esta marca`);
            console.warn(`   - La relación entre tablas no es correcta`);
            console.warn(`   - Los nombres de las columnas no coinciden`);
            
            // Intentar una consulta de diagnóstico
            try {
              console.log(`🔍 [RENTABILIDAD-PEDIDOS] Ejecutando consulta de diagnóstico...`);
              const diagnostico = await crm.query(`
                SELECT COUNT(*) as total_articulos
                FROM articulos
                WHERE Id_Marca = ?
              `, [marcaId]);
              console.log(`📊 [RENTABILIDAD-PEDIDOS] Total artículos con marca ${marcaId}: ${diagnostico[0]?.total_articulos || 0}`);
              
              const diagnostico2 = await crm.query(`
                SELECT COUNT(*) as total_lineas
                FROM pedidos_articulos pa
                INNER JOIN articulos a ON a.id = pa.Id_Articulo
                WHERE a.Id_Marca = ?
                LIMIT 10
              `, [marcaId]);
              console.log(`📊 [RENTABILIDAD-PEDIDOS] Total líneas de pedidos con artículos de marca ${marcaId}: ${diagnostico2[0]?.total_lineas || 0}`);
            } catch (err) {
              console.error(`❌ [RENTABILIDAD-PEDIDOS] Error en consulta de diagnóstico:`, err.message);
            }
          }
        } catch (error) {
          console.error(`❌ [RENTABILIDAD-PEDIDOS] Error obteniendo pedidos con filtro de marca:`, error.message);
          console.error(`❌ [RENTABILIDAD-PEDIDOS] Stack:`, error.stack);
          // Fallback: obtener todos y filtrar después
          pedidosRaw = await crm.getPedidos();
          marcaFiltradaEnSQL = false;
          console.log(`⚠️ [RENTABILIDAD-PEDIDOS] Usando método fallback, pedidos obtenidos: ${pedidosRaw ? pedidosRaw.length : 0}`);
        }
      } else {
        console.warn(`⚠️ [RENTABILIDAD-PEDIDOS] marca_id no es un número válido: ${filtros.marca_id}`);
        pedidosRaw = await crm.getPedidos();
      }
    } else {
      // Obtener todos los pedidos si no hay filtro de marca (marca_id es null, undefined, '', '0', o 'null')
      console.log(`ℹ️ [RENTABILIDAD-PEDIDOS] [SQL] No se aplica filtro de marca (marca_id: ${marcaIdRaw}). Obteniendo todos los pedidos...`);
      pedidosRaw = await crm.getPedidos();
      console.log(`✅ [RENTABILIDAD-PEDIDOS] Pedidos obtenidos (sin filtro de marca): ${pedidosRaw ? pedidosRaw.length : 0}`);
    }
    
    // Aplicar filtros adicionales (comercial, fechas) - estos se aplican después
    if (filtros.comercial_id) {
      const comercialId = parseInt(filtros.comercial_id);
      pedidosRaw = pedidosRaw.filter(p => {
        const pedidoComercialId = p.Id_Cial || p.id_cial || p.IdComercial || p.idComercial;
        return pedidoComercialId === comercialId;
      });
      console.log(`✅ [RENTABILIDAD-PEDIDOS] Después de filtrar por comercial: ${pedidosRaw.length}`);
    }
    
    if (filtros.fecha_desde) {
      const fechaDesde = new Date(filtros.fecha_desde);
      pedidosRaw = pedidosRaw.filter(p => {
        if (!p.FechaPedido) return false;
        const fechaPedido = new Date(p.FechaPedido);
        return fechaPedido >= fechaDesde;
      });
      console.log(`✅ [RENTABILIDAD-PEDIDOS] Después de filtrar por fecha desde: ${pedidosRaw.length}`);
    }
    
    if (filtros.fecha_hasta) {
      const fechaHasta = new Date(filtros.fecha_hasta);
      fechaHasta.setHours(23, 59, 59, 999); // Incluir todo el día
      pedidosRaw = pedidosRaw.filter(p => {
        if (!p.FechaPedido) return false;
        const fechaPedido = new Date(p.FechaPedido);
        return fechaPedido <= fechaHasta;
      });
      console.log(`✅ [RENTABILIDAD-PEDIDOS] Después de filtrar por fecha hasta: ${pedidosRaw.length}`);
    }
    
    // Filtrar por tipo de pedido si se especifica
    if (filtros.tipo_pedido_id) {
      const tipoPedidoId = parseInt(filtros.tipo_pedido_id);
      pedidosRaw = pedidosRaw.filter(p => {
        const pedidoTipoId = p.Id_TipoPedido || p.id_tipo_pedido;
        return pedidoTipoId === tipoPedidoId;
      });
      console.log(`✅ [RENTABILIDAD-PEDIDOS] Después de filtrar por tipo de pedido: ${pedidosRaw.length}`);
    }
    
    // Filtrar por marca si se especifica (solo si NO se aplicó en la consulta inicial)
    // Relación correcta: Pedidos -> Pedidos_Articulos -> Articulos -> Marcas (por Id_Marca)
    if (!marcaFiltradaEnSQL && filtros.marca_id && filtros.marca_id !== '' && filtros.marca_id !== 'null') {
      const marcaId = parseInt(filtros.marca_id);
      console.log(`\n═══════════════════════════════════════════════════════════`);
      console.log(`🔍 [RENTABILIDAD-PEDIDOS] FILTRANDO POR MARCA`);
      console.log(`   - marca_id recibido: ${filtros.marca_id} (tipo: ${typeof filtros.marca_id})`);
      console.log(`   - marcaId parseado: ${marcaId}`);
      console.log(`   - Pedidos antes del filtro: ${pedidosRaw.length}`);
      console.log(`═══════════════════════════════════════════════════════════\n`);
      
      if (isNaN(marcaId)) {
        console.warn(`⚠️ [RENTABILIDAD-PEDIDOS] marca_id no es un número válido: ${filtros.marca_id}`);
      } else {
        // Verificar que la marca existe
        let marcaExiste = false;
        let marcaNombre = null;
        try {
          const marcaCheck = await crm.query('SELECT id, Nombre FROM `Marcas` WHERE id = ? LIMIT 1', [marcaId]);
          if (marcaCheck && marcaCheck.length > 0) {
            marcaExiste = true;
            marcaNombre = marcaCheck[0].Nombre;
            console.log(`✅ [RENTABILIDAD-PEDIDOS] Marca encontrada: ${marcaNombre} (ID: ${marcaId})`);
          }
        } catch (error) {
          console.warn(`⚠️ Error verificando marca ${marcaId}:`, error.message);
        }
        
        if (!marcaExiste) {
          console.warn(`⚠️ [RENTABILIDAD-PEDIDOS] No se encontró la marca con ID ${marcaId}`);
          pedidosRaw = [];
        } else {
        // Obtener IDs de pedidos que contengan artículos con esta marca
        // Usar la relación correcta: Articulos.Id_Marca = marcaId
        try {
          console.log(`🔍 [RENTABILIDAD-PEDIDOS] Ejecutando consulta SQL para filtrar por marca...`);
          
          // Consulta optimizada: solo obtener los IDs de los pedidos
          const pedidosConMarcaRaw = await crm.query(`
            SELECT DISTINCT COALESCE(p.Id, p.id) as pedido_id
            FROM pedidos p
            INNER JOIN pedidos_articulos pa ON (pa.Id_NumPedido = p.Id OR pa.NumPedido = p.NumPedido)
            INNER JOIN articulos a ON (a.id = pa.Id_Articulo)
            WHERE a.Id_Marca = ?
          `, [marcaId]);
          
          console.log(`📊 [RENTABILIDAD-PEDIDOS] Resultado de consulta SQL:`, pedidosConMarcaRaw ? pedidosConMarcaRaw.length : 0, 'pedidos encontrados');
          if (pedidosConMarcaRaw && pedidosConMarcaRaw.length > 0) {
            console.log(`📊 [RENTABILIDAD-PEDIDOS] Primeros 10 IDs encontrados:`, pedidosConMarcaRaw.slice(0, 10).map(p => p.pedido_id || p.Id || p.id));
          }
          
          // Crear un Set de IDs de pedidos para búsqueda rápida
          const pedidosConMarcaIds = new Set(
            (pedidosConMarcaRaw || []).map(p => {
              const id = p.pedido_id || p.Id || p.id;
              return id ? parseInt(id) : null;
            }).filter(id => id !== null && !isNaN(id))
          );
          
          console.log(`📊 [RENTABILIDAD-PEDIDOS] Total de IDs únicos con marca "${marcaNombre}": ${pedidosConMarcaIds.size}`);
          if (pedidosConMarcaIds.size > 0 && pedidosConMarcaIds.size <= 20) {
            console.log(`📊 [RENTABILIDAD-PEDIDOS] IDs de pedidos con marca:`, Array.from(pedidosConMarcaIds).sort((a, b) => a - b));
          }
          
          // Filtrar pedidosRaw para mantener solo los que tienen la marca
          const pedidosAntes = pedidosRaw.length;
          console.log(`📊 [RENTABILIDAD-PEDIDOS] Filtrando ${pedidosAntes} pedidos usando Set de ${pedidosConMarcaIds.size} IDs...`);
          
          // Mostrar algunos ejemplos de IDs antes de filtrar
          if (pedidosAntes > 0 && pedidosAntes <= 10) {
            console.log(`📊 [RENTABILIDAD-PEDIDOS] IDs de pedidos ANTES del filtro:`, pedidosRaw.map(p => parseInt(p.Id || p.id)).filter(id => !isNaN(id)));
          }
          
          pedidosRaw = pedidosRaw.filter(p => {
            const pedidoId = parseInt(p.Id || p.id);
            if (isNaN(pedidoId)) {
              return false; // Excluir pedidos sin ID válido
            }
            const tieneMarca = pedidosConMarcaIds.has(pedidoId);
            return tieneMarca;
          });
          
          console.log(`✅ [RENTABILIDAD-PEDIDOS] Después de filtrar por marca "${marcaNombre}" (ID: ${marcaId}):`);
          console.log(`   - Antes: ${pedidosAntes} pedidos`);
          console.log(`   - Después: ${pedidosRaw.length} pedidos`);
          console.log(`   - Reducción: ${pedidosAntes - pedidosRaw.length} pedidos filtrados`);
          
          if (pedidosRaw.length > 0 && pedidosRaw.length <= 10) {
            console.log(`📊 [RENTABILIDAD-PEDIDOS] IDs de pedidos DESPUÉS del filtro:`, pedidosRaw.map(p => parseInt(p.Id || p.id)));
          }
          } catch (error) {
            console.error(`❌ [RENTABILIDAD-PEDIDOS] Error filtrando por marca:`, error.message);
            console.error(`❌ [RENTABILIDAD-PEDIDOS] Stack:`, error.stack);
            
            // Fallback: filtrar manualmente usando Id_Marca
            console.log(`⚠️ [RENTABILIDAD-PEDIDOS] Usando método de filtrado manual (fallback)`);
            
            const pedidosConMarca = [];
            for (const pedido of pedidosRaw) {
              const pedidoId = pedido.Id || pedido.id;
              const numPedido = pedido.NumPedido || pedido.Numero_Pedido;
              
              try {
                // Verificar si el pedido tiene artículos con esta marca usando Id_Marca
                const lineasRaw = await crm.query(
                  `SELECT DISTINCT a.Id_Marca 
                   FROM pedidos_articulos pa 
                   INNER JOIN articulos a ON a.id = pa.Id_Articulo 
                   WHERE (pa.Id_NumPedido = ? OR pa.NumPedido = ?) AND a.Id_Marca = ? 
                   LIMIT 1`,
                  [pedidoId, numPedido, marcaId]
                );
                
                if (lineasRaw && lineasRaw.length > 0) {
                  pedidosConMarca.push(pedido);
                }
              } catch (err) {
                console.warn(`⚠️ Error verificando marca en pedido ${pedidoId}:`, err.message);
              }
            }
            
            pedidosRaw = pedidosConMarca;
            console.log(`✅ [RENTABILIDAD-PEDIDOS] Después de filtrar por marca (fallback): ${pedidosRaw.length}`);
          }
        }
      }
      console.log(`\n═══════════════════════════════════════════════════════════\n`);
    } else {
      console.log(`ℹ️ [RENTABILIDAD-PEDIDOS] No se aplica filtro de marca (marca_id: ${filtros.marca_id})`);
    }
    
    // Formatear pedidos para la vista
    // Procesar pedidos para la vista - calcular comisiones y precio de compra para cada pedido
    console.log('🔍 [RENTABILIDAD-PEDIDOS] Calculando comisiones y precio de compra (PCP) para cada pedido...');
    console.log(`🔍 [RENTABILIDAD-PEDIDOS] Total pedidos a procesar: ${pedidosRaw ? pedidosRaw.length : 0}`);
    
    // Capturar información de debug para el primer pedido
    let debugPCP = null;
    
    pedidos = await Promise.all((pedidosRaw || []).map(async (p, index) => {
      const pedidoId = p.Id || p.id;
      
      // Para el primer pedido, capturar información de debug detallada
      const incluirDebug = index === 0;
      const resultadoPCP = await calcularPrecioCompraPedido(p, incluirDebug);
      
      let precioCompra = 0;
      if (incluirDebug) {
        // Cuando incluirDebug es true, resultadoPCP es un objeto { total, debug }
        if (resultadoPCP && typeof resultadoPCP === 'object' && resultadoPCP.total !== undefined) {
          precioCompra = resultadoPCP.total;
          if (resultadoPCP.debug) {
            debugPCP = resultadoPCP.debug;
            console.log(`🔍 [DEBUG-PCP] Información de debug capturada para pedido ${pedidoId}:`, JSON.stringify(debugPCP, null, 2));
          }
        } else {
          console.error(`❌ [DEBUG-PCP] Error: resultadoPCP no tiene el formato esperado:`, resultadoPCP);
          precioCompra = 0;
        }
      } else {
        // Cuando incluirDebug es false, resultadoPCP es directamente el número
        precioCompra = typeof resultadoPCP === 'number' ? resultadoPCP : 0;
      }
      
      const comision = await calcularComisionPedido(p);
      
      // Obtener tipo de pedido - ya viene en los datos del pedido si se hizo JOIN, si no, intentar obtenerlo
      let tipoPedido = p.TipoPedido || p.Tipo || '—';
      if ((!tipoPedido || tipoPedido === '—') && p.Id_TipoPedido) {
        try {
          const tipoPedidoObj = await crm.query('SELECT Tipo FROM tipos_pedidos WHERE id = ? LIMIT 1', [Number(p.Id_TipoPedido)]);
          if (tipoPedidoObj && tipoPedidoObj.length > 0) {
            tipoPedido = tipoPedidoObj[0].Tipo || '—';
          }
        } catch (err) {
          console.warn(`⚠️ No se pudo obtener tipo de pedido ${p.Id_TipoPedido}:`, err.message);
        }
      }
      
      if (index < 3) {
        console.log(`🔍 [RENTABILIDAD-PEDIDOS] Pedido ${index + 1}: ID=${pedidoId}, PCP=${precioCompra.toFixed(2)}, Comisión=${comision.toFixed(2)}, Tipo=${tipoPedido}`);
      }
      
      return {
        Id: pedidoId,
        NumPedido: p.NumPedido || p.Numero_Pedido || '-',
        FechaPedido: p.FechaPedido || null,
        PrecioCompra: precioCompra,
        BaseImponible: parseFloat(p.BaseImponible || 0),
        Comision: comision,
        TipoPedido: tipoPedido
      };
    }));
    
    const totalComisiones = pedidos.reduce((sum, p) => sum + (p.Comision || 0), 0);
    const totalPrecioCompra = pedidos.reduce((sum, p) => sum + (p.PrecioCompra || 0), 0);
    console.log(`✅ [RENTABILIDAD-PEDIDOS] Pedidos formateados: ${pedidos.length}`);
    console.log(`✅ [RENTABILIDAD-PEDIDOS] Total Precio Compra (PCP): ${totalPrecioCompra.toFixed(2)}`);
    console.log(`✅ [RENTABILIDAD-PEDIDOS] Total comisiones: ${totalComisiones.toFixed(2)}`);
    console.log(`🔍 [RENTABILIDAD-PEDIDOS] debugPCP antes de renderizar:`, debugPCP ? 'Presente' : 'NULL');
    if (debugPCP) {
      console.log(`🔍 [RENTABILIDAD-PEDIDOS] debugPCP.pedidoId: ${debugPCP.pedidoId}, debugPCP.totalCalculado: ${debugPCP.totalCalculado}`);
    }
    
    // Obtener comerciales para el filtro
    console.log('🔍 [RENTABILIDAD-PEDIDOS] Obteniendo comerciales...');
    comerciales = await crm.getComerciales().catch(() => []);
    console.log(`✅ [RENTABILIDAD-PEDIDOS] Comerciales obtenidos: ${comerciales.length}`);
    
    // Obtener tipos de pedido para el filtro
    console.log('🔍 [RENTABILIDAD-PEDIDOS] Obteniendo tipos de pedido...');
    let tiposPedido = [];
    try {
      tiposPedido = await crm.query('SELECT id, Tipo FROM tipos_pedidos ORDER BY Tipo ASC').catch(() => []);
      console.log(`✅ [RENTABILIDAD-PEDIDOS] Tipos de pedido obtenidos: ${tiposPedido.length}`);
    } catch (error) {
      console.warn(`⚠️ [RENTABILIDAD-PEDIDOS] Error obteniendo tipos de pedido:`, error.message);
      tiposPedido = [];
    }
    
    // Las marcas ya se obtuvieron al principio, no es necesario obtenerlas de nuevo
    console.log(`✅ [RENTABILIDAD-PEDIDOS] Marcas ya obtenidas anteriormente: ${marcas.length}`);
    
    // Obtener usuario
    const user = req.comercial || req.session?.comercial || req.user;
    
    // Obtener estadísticas para la vista index-crm
    console.log('🔍 [RENTABILIDAD-PEDIDOS] Obteniendo estadísticas...');
    estadisticas = await getEstadisticasGlobales().catch(() => ({
      totalVentas: 0,
      ventasEsteMes: 0,
      totalEsteMes: 0,
      totalProductos: 0,
      totalComerciales: comerciales.length || 0,
      totalClientes: 0,
      totalVisitas: 0
    }));
    console.log(`✅ [RENTABILIDAD-PEDIDOS] Estadísticas obtenidas`);
    
    // Obtener ventas recientes para la vista (solo las primeras 10)
    console.log('🔍 [RENTABILIDAD-PEDIDOS] Obteniendo ventas recientes...');
    ventas = (pedidosRaw || []).slice(0, 10).map(p => ({
      id: p.Id || p.id,
      numero: p.NumPedido || p.Numero_Pedido || '-',
      cliente: '-', // Se puede mejorar después
      fecha: p.FechaPedido || null,
      estado: p.EstadoPedido || p.Estado || 'Pendiente',
      total: parseFloat(p.TotalPedido || p.Total_pedido || 0)
    }));
    console.log(`✅ [RENTABILIDAD-PEDIDOS] Ventas recientes obtenidas: ${ventas.length}`);
    
    // Renderizar vista con información de debug
    console.log('🔍 [RENTABILIDAD-PEDIDOS] Renderizando vista...');
    console.log(`🔍 [RENTABILIDAD-PEDIDOS] Datos a renderizar: ${pedidos.length} pedidos, ${comerciales.length} comerciales`);
    
    // Verificar que tenemos datos
    if (pedidos.length === 0) {
      console.log('⚠️ [RENTABILIDAD-PEDIDOS] No hay pedidos para mostrar');
    } else {
      console.log(`✅ [RENTABILIDAD-PEDIDOS] Primer pedido: ${pedidos[0].NumPedido}, Base: ${pedidos[0].BaseImponible}`);
    }
    
    // Log de datos que se pasan a la vista
    console.log('📊 [RENTABILIDAD-PEDIDOS] Datos para render:');
    console.log(`  - pedidos: ${pedidos.length}`);
    console.log(`  - comerciales: ${comerciales.length}`);
    console.log(`  - marcas: ${marcas.length} (tipo: ${typeof marcas}, es array: ${Array.isArray(marcas)})`);
    if (marcas.length > 0) {
      console.log(`  - primera marca:`, marcas[0]);
    }
    
    // Asegurar que marcas sea siempre un array válido
    const marcasParaVista = Array.isArray(marcas) ? marcas : [];
    
    // VERIFICACIÓN CRÍTICA: Verificar que marcas esté definida y tenga datos
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`🔍 [RENTABILIDAD-PEDIDOS] VERIFICACIÓN FINAL DE MARCAS:`);
    console.log(`   - Variable 'marcas' definida: ${typeof marcas !== 'undefined'}`);
    console.log(`   - Variable 'marcas' es null: ${marcas === null}`);
    console.log(`   - Variable 'marcas' es array: ${Array.isArray(marcas)}`);
    console.log(`   - Longitud de 'marcas': ${marcas ? marcas.length : 'N/A'}`);
    console.log(`   - marcasParaVista longitud: ${marcasParaVista.length}`);
    if (marcas && marcas.length > 0) {
      console.log(`   ✅ MARCAS DISPONIBLES: ${marcas.length}`);
      marcas.forEach((m, i) => {
        console.log(`      ${i + 1}. ID: ${m.id || m.Id}, Nombre: ${m.Nombre || m.nombre}`);
      });
    } else {
      console.error(`   ❌ ERROR: NO HAY MARCAS DISPONIBLES`);
      console.error(`   - marcas es undefined: ${typeof marcas === 'undefined'}`);
      console.error(`   - marcas es null: ${marcas === null}`);
      console.error(`   - marcas es array: ${Array.isArray(marcas)}`);
      console.error(`   - marcas valor:`, marcas);
    }
    console.log(`═══════════════════════════════════════════════════════════\n`);
    
    // Log detallado antes de renderizar
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`📊 [RENTABILIDAD-PEDIDOS] DATOS PARA RENDER:`);
    console.log(`   - pedidos: ${pedidos.length}`);
    console.log(`   - comerciales: ${comerciales.length}`);
    console.log(`   - marcas: ${marcasParaVista.length}`);
    console.log(`   - marcas es array: ${Array.isArray(marcasParaVista)}`);
    console.log(`   - tipo de marcas: ${typeof marcasParaVista}`);
    if (marcasParaVista.length > 0) {
      console.log(`   - Primera marca:`, JSON.stringify(marcasParaVista[0], null, 2));
      console.log(`   - Todas las marcas:`, JSON.stringify(marcasParaVista, null, 2));
    } else {
      console.warn(`   ⚠️ NO HAY MARCAS PARA PASAR A LA VISTA`);
    }
    console.log(`═══════════════════════════════════════════════════════════\n`);
    
    // Asegurar que los filtros se pasen correctamente, especialmente marca_id
    // IMPORTANTE: Usar filtrosRaw (valores preservados) como fuente principal
    // Si filtrosRaw.marca_id existe (incluso si es string "1"), usarlo directamente
    const filtrosParaVista = {
      comercial_id: (filtrosRaw && filtrosRaw.comercial_id !== undefined && filtrosRaw.comercial_id !== '') ? filtrosRaw.comercial_id : null,
      fecha_desde: (filtrosRaw && filtrosRaw.fecha_desde !== undefined && filtrosRaw.fecha_desde !== '') ? filtrosRaw.fecha_desde : null,
      fecha_hasta: (filtrosRaw && filtrosRaw.fecha_hasta !== undefined && filtrosRaw.fecha_hasta !== '') ? filtrosRaw.fecha_hasta : null,
      marca_id: (filtrosRaw && filtrosRaw.marca_id !== undefined && filtrosRaw.marca_id !== '') ? filtrosRaw.marca_id : null, // Usar filtrosRaw directamente
      tipo_pedido_id: (filtrosRaw && filtrosRaw.tipo_pedido_id !== undefined && filtrosRaw.tipo_pedido_id !== '') ? filtrosRaw.tipo_pedido_id : null
    };
    
    console.log('🔍 [RENTABILIDAD-PEDIDOS] ========== FILTROS PARA VISTA ==========');
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtrosRaw existe:', typeof filtrosRaw !== 'undefined');
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtrosRaw:', JSON.stringify(filtrosRaw, null, 2));
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtrosRaw.marca_id:', filtrosRaw ? filtrosRaw.marca_id : 'N/A', 'tipo:', filtrosRaw ? typeof filtrosRaw.marca_id : 'N/A');
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtros.marca_id:', filtros.marca_id, 'tipo:', typeof filtros.marca_id);
    console.log('🔍 [RENTABILIDAD-PEDIDOS] filtrosParaVista.marca_id:', filtrosParaVista.marca_id, 'tipo:', typeof filtrosParaVista.marca_id);
    console.log('🔍 [RENTABILIDAD-PEDIDOS] Filtros que se pasan a la vista:', JSON.stringify(filtrosParaVista, null, 2));
    console.log('🔍 [RENTABILIDAD-PEDIDOS] =========================================');
    
    // Actualizar debugInfo con los valores finales antes de renderizar
    debugInfo.pedidosEncontrados = pedidos ? pedidos.length : 0;
    debugInfo.totalPedidos = pedidosRaw ? pedidosRaw.length : 0;
    debugInfo.filtrosRaw = filtrosRaw || {};
    debugInfo.filtrosProcesados = filtros || {};
    debugInfo.filtrosParaVista = filtrosParaVista || {};
    
    console.log('🔍 [RENTABILIDAD-PEDIDOS] debugInfo actualizado antes de renderizar:');
    console.log('   - sentenciaSQL:', debugInfo.sentenciaSQL);
    console.log('   - sentenciaSQLOriginal:', debugInfo.sentenciaSQLOriginal);
    console.log('   - parametrosSQL:', debugInfo.parametrosSQL);
    console.log('   - filtroMarcaAplicado:', debugInfo.filtroMarcaAplicado);
    console.log('   - marcaId:', debugInfo.marcaId);
    console.log('   - pedidosEncontrados:', debugInfo.pedidosEncontrados);
    console.log('🔍 [RENTABILIDAD-PEDIDOS] debugInfo.filtrosRaw:', JSON.stringify(debugInfo.filtrosRaw, null, 2));
    
    // Si no se aplicó el filtro en SQL pero hay un marca_id, intentar diagnóstico
    if (!debugInfo.filtroMarcaAplicado && filtrosRaw && filtrosRaw.marca_id) {
      const marcaId = parseInt(filtrosRaw.marca_id);
      if (!isNaN(marcaId) && marcaId > 0) {
        debugInfo.marcaId = marcaId;
        debugInfo.mensaje = `Filtro de marca ${marcaId} no se aplicó en SQL (fallback usado)`;
        
        // Intentar ejecutar la consulta de diagnóstico
        try {
          const diagnostico = await crm.query(`
            SELECT COUNT(*) as total_articulos
            FROM articulos
            WHERE Id_Marca = ?
          `, [marcaId]);
          debugInfo.totalArticulosConMarca = diagnostico[0]?.total_articulos || 0;
          
          const diagnostico2 = await crm.query(`
            SELECT COUNT(DISTINCT pa.Id_NumPedido, pa.NumPedido) as total_pedidos
            FROM pedidos_articulos pa
            INNER JOIN articulos a ON a.id = pa.Id_Articulo
            WHERE a.Id_Marca = ?
          `, [marcaId]);
          debugInfo.totalPedidosConMarca = diagnostico2[0]?.total_pedidos || 0;
        } catch (err) {
          debugInfo.errorDiagnostico = err.message;
        }
      }
    }
    
    res.render('dashboard/ajustes-rentabilidad-pedidos', {
      title: 'Rentabilidad por Pedido - Farmadescaso - VERSIÓN ACTUALIZADA',
      user: user,
      pedidos: pedidos,
      comerciales: comerciales || [],
      marcas: marcasParaVista, // Asegurar que siempre sea un array
      tiposPedido: tiposPedido || [], // Tipos de pedido para el filtro
      filtros: filtrosParaVista, // Usar el objeto filtros preparado
      currentPage: 'ajustes-rentabilidad-pedidos',
      error: null,
      estadisticas: estadisticas,
      ventas: ventas,
      productos: [], // No necesario para esta vista, pero la plantilla lo espera
      req: req,
      debugInfo: debugInfo, // Información de debug
      filtrosRaw: filtrosRaw, // Filtros preservados para la vista
      debugPCP: debugPCP // Información de debug del cálculo de PCP
    });
    console.log('✅ [RENTABILIDAD-PEDIDOS] Vista renderizada correctamente');
    console.log('🔍 [RENTABILIDAD-PEDIDOS] debugPCP que se pasa a la vista:', debugPCP ? JSON.stringify(debugPCP, null, 2) : 'null');
  } catch (error) {
    console.error('❌ [RENTABILIDAD-PEDIDOS] Error:', error.message);
    console.error('❌ [RENTABILIDAD-PEDIDOS] Stack:', error.stack);
    
    // Asegurar que todas las variables estén definidas incluso en caso de error
    const user = req.comercial || req.session?.comercial || req.user;
    const filtros = {
      comercial_id: req.query.comercial_id || null,
      fecha_desde: req.query.fecha_desde || null,
      fecha_hasta: req.query.fecha_hasta || null,
      marca_id: req.query.marca_id || null,
      tipo_pedido_id: req.query.tipo_pedido_id || null
    };
    
    // Intentar obtener marcas incluso en caso de error
    let marcasError = [];
    try {
      console.log('🔍 [RENTABILIDAD-PEDIDOS] [CATCH] Intentando obtener marcas en caso de error...');
      const marcasRaw = await crm.query('SELECT id, Nombre FROM `Marcas` ORDER BY Nombre ASC').catch(() => 
        crm.query('SELECT id, Nombre FROM marcas ORDER BY Nombre ASC').catch(() => [])
      );
      if (marcasRaw && Array.isArray(marcasRaw)) {
        marcasError = marcasRaw.map(m => ({
          id: m.id,
          Id: m.id,
          Nombre: m.Nombre,
          nombre: m.Nombre
        }));
        console.log(`✅ [RENTABILIDAD-PEDIDOS] [CATCH] Marcas obtenidas en catch: ${marcasError.length}`);
      } else {
        marcasError = [];
        console.warn('⚠️ [RENTABILIDAD-PEDIDOS] [CATCH] marcasRaw no es un array válido');
      }
    } catch (err) {
      console.warn('⚠️ [RENTABILIDAD-PEDIDOS] [CATCH] No se pudieron obtener marcas en el catch:', err.message);
      marcasError = [];
    }
    
    // Si marcas ya estaba definida antes del error, usarla
    if (typeof marcas !== 'undefined' && Array.isArray(marcas) && marcas.length > 0) {
      console.log(`✅ [RENTABILIDAD-PEDIDOS] [CATCH] Usando marcas obtenidas antes del error: ${marcas.length}`);
      marcasError = marcas;
    }
    
    // Intentar obtener tipos de pedido incluso en caso de error
    let tiposPedidoError = [];
    try {
      console.log('🔍 [RENTABILIDAD-PEDIDOS] [CATCH] Intentando obtener tipos de pedido en caso de error...');
      tiposPedidoError = await crm.query('SELECT id, Tipo FROM tipos_pedidos ORDER BY Tipo ASC').catch(() => []);
      console.log(`✅ [RENTABILIDAD-PEDIDOS] [CATCH] Tipos de pedido obtenidos en catch: ${tiposPedidoError.length}`);
    } catch (err) {
      console.warn(`⚠️ [RENTABILIDAD-PEDIDOS] [CATCH] No se pudieron obtener tipos de pedido:`, err.message);
      tiposPedidoError = [];
    }
    
    // Si tiposPedido ya estaba definido antes del error, usarlo
    if (typeof tiposPedido !== 'undefined' && Array.isArray(tiposPedido) && tiposPedido.length > 0) {
      console.log(`✅ [RENTABILIDAD-PEDIDOS] [CATCH] Usando tipos de pedido obtenidos antes del error: ${tiposPedido.length}`);
      tiposPedidoError = tiposPedido;
    }
    
    res.status(500).render('dashboard/ajustes-rentabilidad-pedidos', {
      title: 'Rentabilidad por Pedido - Error',
      user: user,
      pedidos: pedidos || [],
      comerciales: comerciales || [],
      marcas: marcasError,
      tiposPedido: tiposPedidoError || [], // Tipos de pedido en caso de error
      filtros: filtros || {},
      currentPage: 'ajustes-rentabilidad-pedidos',
      error: 'Error cargando datos: ' + error.message,
      estadisticas: estadisticas || {},
      ventas: ventas || [],
      productos: []
    });
  }
});
console.log('✅ [RUTAS] ===========================================');
console.log('✅ [RUTAS] Ruta principal de rentabilidad-pedidos registrada FUERA del try-catch');
console.log('✅ [RUTAS] ===========================================');

// Ruta de prueba para verificar que el código nuevo se ejecuta
app.get('/test-rentabilidad-version', blockInProduction, (req, res) => {
  res.send(`
    <h1>Versión del Código</h1>
    <p>Si ves este mensaje, el código nuevo se está ejecutando.</p>
    <p>Timestamp: ${new Date().toISOString()}</p>
    <p><a href="/dashboard/ajustes/rentabilidad-pedidos">Ir a rentabilidad-pedidos</a></p>
  `);
});


// ============================================
// RUTAS DE AJUSTES - PCP (Precio de Compra) - MOVER AQUÍ PARA PRIORIDAD
// ============================================
// IMPORTANTE: Estas rutas deben estar ANTES de otras rutas de ajustes para evitar conflictos

// Ruta de prueba temporal (sin autenticación para debugging)
app.get('/test-pcp', blockInProduction, (req, res) => {
  console.log('✅ [TEST-PCP] Ruta de prueba accedida');
  res.send('Ruta de prueba PCP funcionando correctamente');
});

// Página de ajustes PCP (Precio de Compra) - GET (solo administradores)
app.get('/dashboard/ajustes/pcp', requireAuth, requireAdmin, async (req, res) => {
  console.log('✅ [PCP] Ruta /dashboard/ajustes/pcp accedida');
  console.log('✅ [PCP] Usuario:', req.comercial ? req.comercial.nombre : 'No comercial');
  console.log('✅ [PCP] Session:', req.session ? 'existe' : 'no existe');
  try {
    const user = req.comercial || req.session.comercial;
    // Obtener artículos frescos de la base de datos (sin caché)
    const articulos = await crm.getArticulos();
    
    // Asegurarse de que los valores PCP están actualizados
    console.log(`✅ [PCP] Obtenidos ${articulos.length} artículos de la base de datos`);
    
    // Ordenar por nombre
    articulos.sort((a, b) => {
      const nombreA = (a.Nombre || '').toLowerCase();
      const nombreB = (b.Nombre || '').toLowerCase();
      return nombreA.localeCompare(nombreB);
    });

    // Agregar headers para evitar caché
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.render('dashboard/ajustes-pcp', {
      title: 'Gestión PCP - Farmadescaso',
      user: user,
      articulos: articulos,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('❌ Error cargando ajustes PCP:', error);
    res.status(500).render('error', {
      error: 'Error',
      message: 'No se pudieron cargar los artículos'
    });
  }
});

// Actualizar PCP de un artículo - POST (solo administradores)
// IMPORTANTE: Solo modifica la columna PCP de la tabla articulos, sin afectar otras relaciones
// El :id puede ser el ID numérico o el SKU del artículo
app.post('/dashboard/ajustes/pcp/:id', requireAuth, requireAdmin, async (req, res) => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ [PCP] ===== PETICIÓN POST RECIBIDA =====');
  console.log('✅ [PCP] POST recibido para artículo:', req.params.id);
  console.log('✅ [PCP] Headers:', {
    'content-type': req.headers['content-type'],
    'x-requested-with': req.headers['x-requested-with']
  });
  console.log('✅ [PCP] Body (redactado):', redactSensitive(req.body || {}));
  console.log('✅ [PCP] PCP recibido:', req.body.PCP);
  console.log('✅ [PCP] Tipo de PCP:', typeof req.body.PCP);
  console.log('✅ [PCP] Usuario autenticado:', req.comercial ? req.comercial.nombre : 'No comercial');
  console.log('✅ [PCP] Es admin?:', req.comercial && (req.comercial.roll?.toLowerCase().includes('administrador') || req.comercial.Roll?.toLowerCase().includes('administrador')));
  console.log('✅ [PCP] ===== FIN LOG INICIAL =====');
  console.log('═══════════════════════════════════════════════════════════');
  try {
    const identificador = req.params.id;
    const { PCP } = req.body;

    // Intentar obtener el artículo por ID o SKU
    let articulo = null;
    
    // Primero intentar como ID numérico
    if (!isNaN(identificador)) {
      articulo = await crm.getArticuloById(parseInt(identificador));
    }
    
    // Si no se encontró, intentar como SKU
    if (!articulo) {
      const articulos = await crm.getArticulos();
      articulo = articulos.find(a => (a.SKU || '').toString() === identificador.toString());
    }

    if (!articulo) {
      return res.redirect(`/dashboard/ajustes/pcp?error=${encodeURIComponent('Artículo no encontrado (ID o SKU: ' + identificador + ')')}`);
    }

    const articuloId = articulo.Id || articulo.id;

    // Procesar el valor de PCP:
    // - Si está vacío o es null/undefined, establecer como NULL
    // - Si es "0" o 0, establecer como 0.00
    // - Si es un número válido, establecer como decimal
    let pcpValue = null;
    
    if (PCP === '' || PCP === null || PCP === undefined) {
      pcpValue = null; // NULL en la base de datos
    } else {
      const parsedValue = parseFloat(PCP);
      if (isNaN(parsedValue)) {
        return res.redirect(`/dashboard/ajustes/pcp?error=${encodeURIComponent('El PCP debe ser un número válido, 0, o estar vacío')}`);
      }
      if (parsedValue < 0) {
        return res.redirect(`/dashboard/ajustes/pcp?error=${encodeURIComponent('El PCP no puede ser negativo')}`);
      }
      // Redondear a 2 decimales
      pcpValue = Math.round(parsedValue * 100) / 100;
    }

    // Usar el mismo método que funciona en la edición de artículos
    // Esto garantiza que la actualización funcione correctamente
    console.log(`✅ [PCP] Usando crm.updateArticulo (mismo método que edición de artículos)`);
    console.log(`✅ [PCP] Artículo ID: ${articuloId}`);
    console.log(`✅ [PCP] PCP recibido: ${PCP} (tipo: ${typeof PCP})`);
    console.log(`✅ [PCP] PCP procesado: ${pcpValue} (tipo: ${typeof pcpValue})`);
    
    // Crear payload con solo PCP (igual que en edición de artículos)
    const payload = { PCP: pcpValue };
    
    console.log(`✅ [PCP] Payload para updateArticulo:`, JSON.stringify(payload, null, 2));
    
    // Usar el método updateArticulo que ya funciona correctamente
    const result = await crm.updateArticulo(articuloId, payload);
    
    console.log(`✅ [PCP] Resultado de updateArticulo:`, result);
    console.log(`✅ [PCP] Filas afectadas: ${result.affectedRows || 0}`);
    console.log(`✅ [PCP] Filas cambiadas: ${result.changedRows || 0}`);
    
    // Verificar que se actualizó correctamente
    const articuloActualizado = await crm.getArticuloById(articuloId);
    if (articuloActualizado) {
      const pcpFinal = articuloActualizado.PCP;
      console.log(`✅ [PCP] Verificación: PCP en BD = ${pcpFinal} (esperado: ${pcpValue})`);
      
      // Verificar que coinciden
      if (pcpValue === null && pcpFinal !== null) {
        console.error(`❌ [PCP] ERROR: PCP debería ser NULL pero es ${pcpFinal}`);
        throw new Error(`Error: PCP debería ser NULL pero es ${pcpFinal}`);
      } else if (pcpValue !== null && Math.abs(Number(pcpFinal) - Number(pcpValue)) > 0.01) {
        console.error(`❌ [PCP] ERROR: PCP debería ser ${pcpValue} pero es ${pcpFinal}`);
        throw new Error(`Error: PCP debería ser ${pcpValue} pero es ${pcpFinal}`);
      } else {
        console.log(`✅ [PCP] Verificación exitosa: PCP correcto en BD`);
      }
    }
    
    const pcpDisplay = pcpValue === null ? 'NULL' : `${pcpValue.toFixed(2)}€`;
    console.log(`✅ PCP actualizado para artículo ${articuloId}: ${pcpDisplay}`);
    
    // Si es una petición AJAX, devolver JSON en lugar de redirección
    const xRequestedWith = req.headers['x-requested-with'] || req.get('X-Requested-With') || '';
    const isAjax = xRequestedWith.toLowerCase() === 'xmlhttprequest';
    
    console.log('✅ [PCP] Header X-Requested-With:', xRequestedWith);
    console.log('✅ [PCP] Es AJAX?', isAjax);
    
    if (isAjax) {
      console.log('✅ [PCP] Devolviendo respuesta JSON para petición AJAX');
      return res.status(200).json({ 
        success: true, 
        message: 'PCP actualizado correctamente',
        pcp: pcpValue,
        articuloId: articuloId
      });
    }
    
    console.log('✅ [PCP] Devolviendo redirección para petición normal');
    res.redirect(`/dashboard/ajustes/pcp?success=${encodeURIComponent('PCP actualizado correctamente')}&_t=${Date.now()}`);
  } catch (error) {
    console.error('❌ Error actualizando PCP:', error);
    console.error('❌ Stack:', error.stack);
    
    // Si es una petición AJAX, devolver JSON en lugar de redirección
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                   req.headers['x-requested-with'] === 'XMLHttpRequest'.toLowerCase() ||
                   req.get('X-Requested-With') === 'XMLHttpRequest';
    
    if (isAjax) {
      console.log('✅ [PCP] Devolviendo error JSON para petición AJAX');
      return res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar el PCP: ' + error.message
      });
    }
    
    res.redirect(`/dashboard/ajustes/pcp?error=${encodeURIComponent('Error al actualizar el PCP: ' + error.message)}`);
  }
});

// ============================================
// FIN RUTAS DE AJUSTES - PCP
// ============================================

// Página de ajustes Webhook N8N - GET (solo administradores)
app.get('/dashboard/ajustes/webhook-n8n', requireAuth, requireAdmin, async (req, res) => {
  try {
    const webhookNombre = await crm.getConfiguracionValor('n8n_webhook_nombre', '');
    const webhookUrl = await crm.getConfiguracionValor('n8n_webhook_url', '');
    const authHeaderKey = await crm.getConfiguracionValor('n8n_webhook_auth_header_key', '');
    const authHeaderValue = await crm.getConfiguracionValor('n8n_webhook_auth_header_value', '');
    const webhookObservaciones = await crm.getConfiguracionValor('n8n_webhook_observaciones', '');
    
    const user = req.comercial || req.session.comercial;
    const userRol = parseRoll(user?.roll || user?.Roll || '');
    const isUserAdmin = userRol && (userRol.toLowerCase().includes('administrador') || userRol.toLowerCase().includes('admin'));
    
    res.render('dashboard/ajustes-webhook-n8n', {
      title: 'Ajustes - Farmadescaso',
      user: user,
      esAdmin: isUserAdmin,
      configuracion: {
        webhook_nombre: webhookNombre,
        webhook_url: webhookUrl,
        auth_header_key: authHeaderKey,
        auth_header_value: authHeaderValue,
        webhook_observaciones: webhookObservaciones
      },
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('❌ Error cargando ajustes webhook N8N:', error);
    const user = req.comercial || req.session.comercial;
    const userRol = parseRoll(user?.roll || user?.Roll || '');
    const isUserAdmin = userRol && (userRol.toLowerCase().includes('administrador') || userRol.toLowerCase().includes('admin'));
    
    res.render('dashboard/ajustes-webhook-n8n', {
      title: 'Ajustes - Farmadescaso',
      user: user,
      esAdmin: isUserAdmin,
      configuracion: {
        webhook_nombre: '',
        webhook_url: '',
        auth_header_key: '',
        auth_header_value: '',
        webhook_observaciones: ''
      },
      error: 'Error cargando configuración',
      success: null
    });
  }
});

// Página de ajustes Prestashop - GET (solo administradores)
app.get('/dashboard/ajustes/prestashop', requireAuth, requireAdmin, async (req, res) => {
  try {
    const prestashopUrl = await crm.getConfiguracionValor('prestashop_url', '');
    const prestashopApiKey = await crm.getConfiguracionValor('prestashop_api_key', '');
    const prestashopWebserviceKey = await crm.getConfiguracionValor('prestashop_webservice_key', '');
    const prestashopObservaciones = await crm.getConfiguracionValor('prestashop_observaciones', '');
    
    const user = req.comercial || req.session.comercial;
    const userRol = parseRoll(user?.roll || user?.Roll || '');
    const isUserAdmin = userRol && (userRol.toLowerCase().includes('administrador') || userRol.toLowerCase().includes('admin'));
    
    res.render('dashboard/ajustes-prestashop', {
      title: 'Ajustes - Farmadescaso',
      user: user,
      esAdmin: isUserAdmin,
      configuracion: {
        prestashop_url: prestashopUrl,
        prestashop_api_key: prestashopApiKey,
        prestashop_webservice_key: prestashopWebserviceKey,
        prestashop_observaciones: prestashopObservaciones
      },
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('❌ Error cargando ajustes Prestashop:', error);
    const user = req.comercial || req.session.comercial;
    const userRol = parseRoll(user?.roll || user?.Roll || '');
    const isUserAdmin = userRol && (userRol.toLowerCase().includes('administrador') || userRol.toLowerCase().includes('admin'));
    
    res.render('dashboard/ajustes-prestashop', {
      title: 'Ajustes - Farmadescaso',
      user: user,
      esAdmin: isUserAdmin,
      configuracion: {
        prestashop_url: '',
        prestashop_api_key: '',
        prestashop_webservice_key: '',
        prestashop_observaciones: ''
      },
      error: 'Error cargando configuración',
      success: null
    });
  }
});

// Página de ajustes Google OAuth2 - GET (solo administradores)
app.get('/dashboard/ajustes/google-oauth', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!MEETING_INTEGRATIONS_ENABLED) return reunionesIntegracionDesactivada(req, res);
    const googleClientId = await crm.getConfiguracionValor('google_oauth_client_id', '');
    const googleClientSecret = await crm.getConfiguracionValor('google_oauth_client_secret', '');
    const googleRedirectUri = await crm.getConfiguracionValor('google_oauth_redirect_uri', 'http://localhost:3000/auth/google/callback');
    
    const user = req.comercial || req.session.comercial;
    const userRol = parseRoll(user?.roll || user?.Roll || '');
    const isUserAdmin = userRol && (userRol.toLowerCase().includes('administrador') || userRol.toLowerCase().includes('admin'));
    
    res.render('dashboard/ajustes-google-oauth', {
      title: 'Ajustes - Google OAuth2',
      user: user,
      esAdmin: isUserAdmin,
      configuracion: {
        google_oauth_client_id: googleClientId,
        google_oauth_client_secret: googleClientSecret,
        google_oauth_redirect_uri: googleRedirectUri
      },
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('❌ Error cargando ajustes Google OAuth2:', error);
    const user = req.comercial || req.session.comercial;
    const userRol = parseRoll(user?.roll || user?.Roll || '');
    const isUserAdmin = userRol && (userRol.toLowerCase().includes('administrador') || userRol.toLowerCase().includes('admin'));
    
    res.render('dashboard/ajustes-google-oauth', {
      title: 'Ajustes - Google OAuth2',
      user: user,
      esAdmin: isUserAdmin,
      configuracion: {},
      error: 'Error cargando configuración',
      success: null
    });
  }
});

// Página de ajustes Google OAuth2 - POST (solo administradores)
app.post('/dashboard/ajustes/google-oauth', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!MEETING_INTEGRATIONS_ENABLED) return reunionesIntegracionDesactivada(req, res);
    const { google_oauth_client_id, google_oauth_client_secret, google_oauth_redirect_uri } = req.body;

    if (!google_oauth_client_id || !google_oauth_client_secret || !google_oauth_redirect_uri) {
      return res.redirect('/dashboard/ajustes/google-oauth?error=campos_requeridos');
    }

    // Guardar configuraciones
    await crm.setConfiguracion('google_oauth_client_id', google_oauth_client_id, 'Client ID de Google OAuth2 para Google Meet', 'text');
    await crm.setConfiguracion('google_oauth_client_secret', google_oauth_client_secret, 'Client Secret de Google OAuth2 para Google Meet', 'password');
    await crm.setConfiguracion('google_oauth_redirect_uri', google_oauth_redirect_uri, 'URI de redirección para OAuth2 de Google', 'url');

    console.log('✅ Configuración de Google OAuth2 guardada');
    res.redirect('/dashboard/ajustes/google-oauth?success=configuracion_guardada');
  } catch (error) {
    console.error('❌ Error guardando configuración Google OAuth2:', error);
    res.redirect('/dashboard/ajustes/google-oauth?error=error_guardando');
  }
});

// NOTA: Las rutas PCP se movieron arriba (línea ~1900) para mayor prioridad

// Página de ajustes API Keys - GET (solo administradores)
// RUTA DE DIAGNÓSTICO - LOGS DEL SERVIDOR (Solo administradores)
app.get('/dashboard/ajustes/logs-servidor', requireAuth, requireAdmin, (req, res) => {
  try {
    console.log('✅ [LOGS-SERVIDOR] Ruta accedida');
    console.log('✅ [LOGS-SERVIDOR] Usuario:', req.comercial?.nombre || req.user?.nombre || 'No identificado');
    console.log('✅ [LOGS-SERVIDOR] Query params:', req.query);
    
    // Verificar que serverLogs esté disponible
    if (!serverLogs) {
      console.error('❌ [LOGS-SERVIDOR] serverLogs no está definido');
      return res.status(500).json({ success: false, error: 'Sistema de logs no disponible' });
    }
    
    const level = req.query.level || null;
    const count = parseInt(req.query.count) || 500;
    const format = req.query.format || 'html'; // 'html' o 'json'
    
    let logs = [];
    try {
      if (level) {
        logs = serverLogs.getAllLogs(level);
      } else {
        logs = serverLogs.getRecentLogs(count);
      }
    } catch (logError) {
      console.error('❌ [LOGS-SERVIDOR] Error obteniendo logs:', logError);
      logs = [];
    }
    
    console.log(`✅ [LOGS-SERVIDOR] Obtenidos ${logs.length} logs de ${serverLogs.logs?.length || 0} totales`);
    
    if (format === 'json') {
      return res.json({
        success: true,
        total: logs.length,
        logs: logs
      });
    }
    
    const user = req.comercial || req.session?.comercial || req.user;
    console.log('✅ [LOGS-SERVIDOR] Renderizando vista...');
    
    try {
      res.render('dashboard/ajustes-logs-servidor', {
        title: 'Logs del Servidor - Farmadescaso',
        user: user,
        logs: logs || [],
        totalLogs: serverLogs.logs?.length || 0,
        totalErrors: serverLogs.errors?.length || 0,
        currentPage: 'ajustes',
        req: req
      });
      console.log('✅ [LOGS-SERVIDOR] Vista renderizada correctamente');
    } catch (renderError) {
      console.error('❌ [LOGS-SERVIDOR] Error renderizando vista:', renderError);
      throw renderError;
    }
  } catch (error) {
    console.error('❌ [LOGS-SERVIDOR] Error completo:', error);
    console.error('❌ [LOGS-SERVIDOR] Mensaje:', error.message);
    console.error('❌ [LOGS-SERVIDOR] Stack:', error.stack);
    res.status(500).render('error', {
      error: 'Error cargando logs del servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Error al cargar los logs del servidor'
    });
  }
});

// API para obtener logs (AJAX)
app.get('/api/logs-servidor', requireAuth, requireAdmin, (req, res) => {
  try {
    const level = req.query.level || null;
    const count = parseInt(req.query.count) || 500;
    const errorsOnly = req.query.errorsOnly === 'true';
    
    let logs = [];
    if (errorsOnly) {
      logs = serverLogs.getErrors();
    } else if (level) {
      logs = serverLogs.getAllLogs(level);
    } else {
      logs = serverLogs.getRecentLogs(count);
    }
    
    res.json({
      success: true,
      total: logs.length,
      totalLogs: serverLogs.logs.length,
      totalErrors: serverLogs.errors.length,
      logs: logs
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API para limpiar logs
app.post('/api/logs-servidor/limpiar', requireAuth, requireAdmin, (req, res) => {
  try {
    serverLogs.clearLogs();
    res.json({ success: true, message: 'Logs limpiados correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API para exportar logs como texto
app.get('/api/logs-servidor/exportar', requireAuth, requireAdmin, (req, res) => {
  try {
    const logsText = serverLogs.getLogsAsText();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=server-logs-${new Date().toISOString().split('T')[0]}.txt`);
    res.send(logsText);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/dashboard/ajustes/api-keys', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = req.comercial || req.session.comercial;
    const userRol = parseRoll(user?.roll || user?.Roll || '');
    const isUserAdmin = userRol && (userRol.toLowerCase().includes('administrador') || userRol.toLowerCase().includes('admin'));
    
    res.render('dashboard/ajustes-api-keys', {
      title: 'Ajustes - Farmadescaso',
      user: user,
      esAdmin: isUserAdmin,
      configuracion: {},
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('❌ Error cargando ajustes API Keys:', error);
    const user = req.comercial || req.session.comercial;
    const userRol = parseRoll(user?.roll || user?.Roll || '');
    const isUserAdmin = userRol && (userRol.toLowerCase().includes('administrador') || userRol.toLowerCase().includes('admin'));
    
    res.render('dashboard/ajustes-api-keys', {
      title: 'Ajustes - Farmadescaso',
      user: user,
      esAdmin: isUserAdmin,
      configuracion: {},
      error: 'Error cargando configuración',
      success: null
    });
  }
});

// Ruta para obtener API keys (para la página de ajustes) - solo administradores
app.get('/api/keys', requireAuth, requireAdmin, async (req, res) => {
  try {
    const keys = await crm.getAllApiKeys();
    res.json({
      success: true,
      data: keys,
      count: keys.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Página de ajustes Webhook N8N - POST (solo administradores)
app.post('/dashboard/ajustes/webhook-n8n', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { 
      webhook_nombre, 
      webhook_url, 
      auth_header_key, 
      auth_header_value, 
      webhook_observaciones
    } = req.body;
    
    // Validar URL si se proporciona
    if (webhook_url && !webhook_url.match(/^https?:\/\/.+/)) {
      return res.redirect('/dashboard/ajustes/webhook-n8n?error=' + encodeURIComponent('La URL del webhook no es válida'));
    }
    
    // Guardar configuraciones de N8N
    await crm.setConfiguracion('n8n_webhook_nombre', webhook_nombre || '', 'Nombre identificativo del webhook de N8N', 'text');
    await crm.setConfiguracion('n8n_webhook_url', webhook_url || '', 'URL del webhook de N8N para comunicación con Holded', 'url');
    await crm.setConfiguracion('n8n_webhook_auth_header_key', auth_header_key || '', 'Clave del header de autenticación para el webhook de N8N', 'text');
    await crm.setConfiguracion('n8n_webhook_auth_header_value', auth_header_value || '', 'Valor del header de autenticación para el webhook de N8N', 'text');
    await crm.setConfiguracion('n8n_webhook_observaciones', webhook_observaciones || '', 'Observaciones sobre el funcionamiento del webhook de N8N', 'text');
    
    console.log('✅ [AJUSTES] Configuración Webhook N8N guardada correctamente');
    res.redirect('/dashboard/ajustes/webhook-n8n?success=' + encodeURIComponent('Configuración guardada correctamente'));
  } catch (error) {
    console.error('❌ Error guardando ajustes webhook N8N:', error);
    res.redirect('/dashboard/ajustes/webhook-n8n?error=' + encodeURIComponent('Error al guardar la configuración: ' + error.message));
  }
});

// Página de ajustes Prestashop - POST (solo administradores)
app.post('/dashboard/ajustes/prestashop', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      prestashop_url,
      prestashop_api_key,
      prestashop_webservice_key,
      prestashop_observaciones
    } = req.body;
    
    // Validar URL si se proporciona
    if (prestashop_url && !prestashop_url.match(/^https?:\/\/.+/)) {
      return res.redirect('/dashboard/ajustes/prestashop?error=' + encodeURIComponent('La URL de Prestashop no es válida'));
    }
    
    // Guardar configuraciones de Prestashop
    await crm.setConfiguracion('prestashop_url', prestashop_url || '', 'URL de la tienda Prestashop', 'url');
    await crm.setConfiguracion('prestashop_api_key', prestashop_api_key || '', 'Clave API de Prestashop', 'text');
    await crm.setConfiguracion('prestashop_webservice_key', prestashop_webservice_key || '', 'Clave del webservice de Prestashop', 'text');
    await crm.setConfiguracion('prestashop_observaciones', prestashop_observaciones || '', 'Observaciones sobre la configuración de Prestashop', 'text');
    
    console.log('✅ [AJUSTES] Configuración Prestashop guardada correctamente');
    res.redirect('/dashboard/ajustes/prestashop?success=' + encodeURIComponent('Configuración guardada correctamente'));
  } catch (error) {
    console.error('❌ Error guardando ajustes Prestashop:', error);
    res.redirect('/dashboard/ajustes/prestashop?error=' + encodeURIComponent('Error al guardar la configuración: ' + error.message));
  }
});

// =====================================================
// RUTAS DE AJUSTES - CÓDIGOS POSTALES
// =====================================================
// IMPORTANTE: Estas rutas deben estar ANTES de otras rutas genéricas de ajustes

console.log('✅ [RUTAS] Registrando rutas de códigos postales...');

// Ruta de prueba sin autenticación (temporal para diagnóstico)
app.get('/test-codigos-postales', blockInProduction, async (req, res) => {
  console.log('✅ [TEST-CODIGOS-POSTALES] Ruta de prueba accedida');
  try {
    const codigosPostales = await crm.getCodigosPostales({});
    res.json({ 
      success: true, 
      message: 'Ruta de prueba funcionando',
      count: codigosPostales ? codigosPostales.length : 0
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Ruta de prueba para verificar que la ruta principal funciona
app.get('/test-ajustes-codigos-postales', requireAuth, requireAdmin, async (req, res) => {
  console.log('✅ [TEST-AJUSTES] Ruta de prueba con auth accedida');
  res.send(`
    <h1>✅ Ruta funcionando</h1>
    <p>Si ves esto, la ruta /dashboard/ajustes/codigos-postales debería funcionar.</p>
    <p>Usuario: ${req.comercial ? req.comercial.nombre : 'No encontrado'}</p>
    <a href="/dashboard/ajustes/codigos-postales">Ir a códigos postales</a>
  `);
});

// Listar códigos postales
console.log('✅ [RUTAS] Registrando GET /dashboard/ajustes/codigos-postales');
app.get('/dashboard/ajustes/codigos-postales', requireAuth, requireAdmin, async (req, res) => {
  console.log('✅ [CODIGOS-POSTALES] Ruta GET /dashboard/ajustes/codigos-postales accedida');
  console.log('✅ [CODIGOS-POSTALES] Usuario:', req.comercial ? req.comercial.nombre : 'No comercial');
  console.log('✅ [CODIGOS-POSTALES] Session:', req.session ? 'existe' : 'no existe');
  try {
    const user = req.comercial || req.session.comercial;
    const filtros = {
      codigoPostal: req.query.codigoPostal || null,
      localidad: req.query.localidad || null,
      provincia: req.query.provincia || null,
      idProvincia: req.query.idProvincia || null,
      activo: req.query.activo !== undefined ? req.query.activo === '1' : undefined
    };
    
    const codigosPostales = await crm.getCodigosPostales(filtros);
    // Robustez: en algunos entornos la tabla puede ser `Provincias` (mayúscula)
    let provincias = [];
    try {
      provincias = await crm.query('SELECT * FROM provincias ORDER BY Nombre ASC');
    } catch (_) {
      provincias = await crm.query('SELECT * FROM Provincias ORDER BY Nombre ASC').catch(() => []);
    }
    
    res.render('dashboard/ajustes-codigos-postales', {
      title: 'Gestión de Códigos Postales - Farmadescaso',
      user: user,
      codigosPostales: codigosPostales || [],
      provincias: provincias || [],
      filtros: filtros,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('❌ Error cargando códigos postales:', error);
    const user = req.comercial || req.session.comercial;
    res.render('dashboard/ajustes-codigos-postales', {
      title: 'Gestión de Códigos Postales - Farmadescaso',
      user: user,
      codigosPostales: [],
      provincias: [],
      filtros: {},
      error: 'Error cargando códigos postales: ' + error.message
    });
  }
});

// Crear código postal (POST)
console.log('✅ [RUTAS] Registrando POST /dashboard/ajustes/codigos-postales');
app.post('/dashboard/ajustes/codigos-postales', requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = {
      CodigoPostal: req.body.CodigoPostal,
      Localidad: req.body.Localidad,
      Provincia: req.body.Provincia,
      Id_Provincia: req.body.Id_Provincia || null,
      ComunidadAutonoma: req.body.ComunidadAutonoma || null,
      Latitud: req.body.Latitud || null,
      Longitud: req.body.Longitud || null,
      Activo: req.body.Activo !== undefined ? req.body.Activo === '1' : true
    };
    
    await crm.createCodigoPostal(data);
    res.redirect('/dashboard/ajustes/codigos-postales?success=' + encodeURIComponent('Código postal creado correctamente'));
  } catch (error) {
    console.error('❌ Error creando código postal:', error);
    res.redirect('/dashboard/ajustes/codigos-postales?error=' + encodeURIComponent('Error al crear código postal: ' + error.message));
  }
});

// Actualizar código postal (POST)
console.log('✅ [RUTAS] Registrando POST /dashboard/ajustes/codigos-postales/:id');
app.post('/dashboard/ajustes/codigos-postales/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const data = {};
    
    if (req.body.CodigoPostal !== undefined) data.CodigoPostal = req.body.CodigoPostal;
    if (req.body.Localidad !== undefined) data.Localidad = req.body.Localidad;
    if (req.body.Provincia !== undefined) data.Provincia = req.body.Provincia;
    if (req.body.Id_Provincia !== undefined) data.Id_Provincia = req.body.Id_Provincia || null;
    if (req.body.ComunidadAutonoma !== undefined) data.ComunidadAutonoma = req.body.ComunidadAutonoma || null;
    if (req.body.Latitud !== undefined) data.Latitud = req.body.Latitud || null;
    if (req.body.Longitud !== undefined) data.Longitud = req.body.Longitud || null;
    if (req.body.Activo !== undefined) data.Activo = req.body.Activo === '1';
    
    await crm.updateCodigoPostal(id, data);
    res.redirect('/dashboard/ajustes/codigos-postales?success=' + encodeURIComponent('Código postal actualizado correctamente'));
  } catch (error) {
    console.error('❌ Error actualizando código postal:', error);
    res.redirect('/dashboard/ajustes/codigos-postales?error=' + encodeURIComponent('Error al actualizar código postal: ' + error.message));
  }
});

// Eliminar código postal (POST)
console.log('✅ [RUTAS] Registrando POST /dashboard/ajustes/codigos-postales/:id/eliminar');
app.post('/dashboard/ajustes/codigos-postales/:id/eliminar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await crm.deleteCodigoPostal(id);
    res.redirect('/dashboard/ajustes/codigos-postales?success=' + encodeURIComponent('Código postal eliminado correctamente'));
  } catch (error) {
    console.error('❌ Error eliminando código postal:', error);
    res.redirect('/dashboard/ajustes/codigos-postales?error=' + encodeURIComponent('Error al eliminar código postal: ' + error.message));
  }
});

// =====================================================
// RUTAS DE AJUSTES - ASIGNACIONES COMERCIALES
// =====================================================
// IMPORTANTE: Estas rutas deben estar ANTES de otras rutas genéricas de ajustes

console.log('✅ [RUTAS] Registrando rutas de asignaciones comerciales...');

// Listar asignaciones
console.log('✅ [RUTAS] Registrando GET /dashboard/ajustes/asignaciones-comerciales');
app.get('/dashboard/ajustes/asignaciones-comerciales', requireAuth, requireAdmin, async (req, res) => {
  console.log('✅ [ASIGNACIONES] ========== INICIO ==========');
  console.log('✅ [ASIGNACIONES] Ruta GET /dashboard/ajustes/asignaciones-comerciales accedida');
  console.log('✅ [ASIGNACIONES] Timestamp:', new Date().toISOString());
  try {
    const user = req.comercial || req.session.comercial;
    console.log('✅ [ASIGNACIONES] Usuario autenticado:', user ? (user.Nombre || user.nombre || 'Usuario') : 'No encontrado');
    
    const filtros = {
      idComercial: req.query.idComercial || null,
      idCodigoPostal: req.query.idCodigoPostal || null,
      idMarca: req.query.idMarca || null,
      idProvincia: req.query.idProvincia || null,
      provincia: req.query.provincia || null,
      activo: req.query.activo !== undefined ? req.query.activo === '1' : undefined,
      soloActivos: req.query.soloActivos === '1'
    };
    
    console.log('✅ [ASIGNACIONES] Cargando datos...');
    
    // Cargar datos con manejo individual de errores
    let asignaciones = [];
    let comerciales = [];
    let codigosPostales = [];
    let marcas = [];
    
    try {
      console.log('✅ [ASIGNACIONES] Llamando a getAsignaciones con filtros:', JSON.stringify(filtros));
      asignaciones = await crm.getAsignaciones(filtros);
      console.log(`✅ [ASIGNACIONES] Asignaciones cargadas: ${asignaciones ? asignaciones.length : 0}`);
      if (!Array.isArray(asignaciones)) {
        console.warn('⚠️ [ASIGNACIONES] getAsignaciones no devolvió un array, convirtiendo...');
        asignaciones = [];
      }
    } catch (error) {
      console.error('❌ [ASIGNACIONES] Error cargando asignaciones:', error.message);
      console.error('❌ [ASIGNACIONES] Stack del error:', error.stack);
      asignaciones = [];
    }
    
    try {
      comerciales = await crm.getComerciales();
      console.log(`✅ [ASIGNACIONES] Comerciales cargados: ${comerciales ? comerciales.length : 0}`);
    } catch (error) {
      console.error('❌ [ASIGNACIONES] Error cargando comerciales:', error.message);
      comerciales = [];
    }
    
    try {
      codigosPostales = await crm.getCodigosPostales({ activo: 1 });
      console.log(`✅ [ASIGNACIONES] Códigos postales cargados: ${codigosPostales ? codigosPostales.length : 0}`);
    } catch (error) {
      console.error('❌ [ASIGNACIONES] Error cargando códigos postales:', error.message);
      codigosPostales = [];
    }
    
    try {
      // Robustez: en algunos entornos la tabla puede ser `marcas` (minúscula)
      marcas = await crm.query('SELECT * FROM Marcas ORDER BY Nombre ASC')
        .catch(() => crm.query('SELECT * FROM marcas ORDER BY Nombre ASC'));
      console.log(`✅ [ASIGNACIONES] Marcas cargadas: ${marcas ? marcas.length : 0}`);
    } catch (error) {
      console.error('❌ [ASIGNACIONES] Error cargando marcas:', error.message);
      marcas = [];
    }
    
    // Obtener provincias con manejo de errores (solo España)
    let provincias = [];
    try {
      // Primero intentar consulta directa que sabemos que funciona
      provincias = await crm.query('SELECT id, Nombre, Codigo, Pais, CodigoPais FROM provincias WHERE CodigoPais = ? ORDER BY Nombre ASC', ['ES']);
      console.log(`✅ [ASIGNACIONES] Provincias cargadas (consulta directa ES): ${provincias ? provincias.length : 0}`);
      
      // Si no hay resultados con ES, intentar sin filtro
      if (!provincias || provincias.length === 0) {
        console.log('⚠️ [ASIGNACIONES] No se encontraron provincias con CodigoPais=ES, intentando sin filtro...');
        provincias = await crm.query('SELECT id, Nombre, Codigo, Pais, CodigoPais FROM provincias ORDER BY Nombre ASC');
        console.log(`✅ [ASIGNACIONES] Provincias cargadas (sin filtro): ${provincias ? provincias.length : 0}`);
        
        // Filtrar solo España si hay resultados
        if (provincias && provincias.length > 0) {
          const provinciasEspana = provincias.filter(p => {
            const codigoPais = p.CodigoPais || p.codigoPais || '';
            const pais = p.Pais || p.pais || '';
            return codigoPais === 'ES' || pais === 'España';
          });
          if (provinciasEspana.length > 0) {
            provincias = provinciasEspana;
            console.log(`✅ [ASIGNACIONES] Provincias filtradas (solo España): ${provincias.length}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error obteniendo provincias:', error.message);
      console.error('❌ Stack:', error.stack);
      // Intentar con método getProvincias como fallback
      try {
        provincias = await crm.getProvincias('ES');
        console.log(`✅ [ASIGNACIONES] Provincias cargadas (getProvincias): ${provincias ? provincias.length : 0}`);
      } catch (error2) {
        console.error('❌ Error en getProvincias:', error2.message);
        provincias = [];
      }
    }
    
    // Asegurarse de que provincias es un array válido
    if (!Array.isArray(provincias)) {
      console.warn('⚠️ [ASIGNACIONES] provincias no es un array, convirtiendo...');
      provincias = [];
    }
    
    // Normalizar estructura de provincias para asegurar que tengan los campos necesarios
    if (provincias && provincias.length > 0) {
      provincias = provincias.map(p => ({
        id: p.id || p.Id || null,
        Id: p.id || p.Id || null,
        Nombre: p.Nombre || p.nombre || 'Sin nombre',
        nombre: p.Nombre || p.nombre || 'Sin nombre',
        Codigo: p.Codigo || p.codigo || '',
        codigo: p.Codigo || p.codigo || '',
        Pais: p.Pais || p.pais || 'España',
        CodigoPais: p.CodigoPais || p.codigoPais || 'ES'
      }));
    }
    
    // Log para depuración
    console.log(`✅ [ASIGNACIONES] Datos para renderizar:`);
    console.log(`   - Asignaciones: ${asignaciones ? asignaciones.length : 0}`);
    if (asignaciones && asignaciones.length > 0) {
      const ejemplo = asignaciones[0];
      console.log(`   - Ejemplo asignación:`);
      console.log(`     * CodigoPostal: ${ejemplo.CodigoPostal}`);
      console.log(`     * Poblacion: ${ejemplo.Poblacion}`);
      console.log(`     * NumClientes: ${ejemplo.NumClientes}`);
      console.log(`     * Localidad: ${ejemplo.Localidad}`);
    }
    console.log(`   - Comerciales: ${comerciales ? comerciales.length : 0}`);
    console.log(`   - Códigos postales: ${codigosPostales ? codigosPostales.length : 0}`);
    console.log(`   - Marcas: ${marcas ? marcas.length : 0}`);
    console.log(`   - Provincias: ${provincias ? provincias.length : 0}`);
    if (provincias && provincias.length > 0) {
      console.log(`   - Primeras 3 provincias: ${provincias.slice(0, 3).map(p => (p.Nombre || p.nombre || 'Sin nombre')).join(', ')}`);
      console.log(`   - Ejemplo provincia:`, JSON.stringify(provincias[0]));
    } else {
      console.warn('⚠️ [ASIGNACIONES] No hay provincias para mostrar');
    }
    
    // Verificar que provincias sea un array válido antes de renderizar
    if (!Array.isArray(provincias)) {
      console.warn('⚠️ [ASIGNACIONES] provincias no es un array antes de renderizar, convirtiendo...');
      provincias = [];
    }
    
    // Log final antes de renderizar
    console.log(`✅ [ASIGNACIONES] Renderizando vista con ${provincias.length} provincias`);
    if (provincias.length > 0) {
      console.log(`   - Ejemplo de provincia a renderizar:`, JSON.stringify(provincias[0]));
      console.log(`   - Tipo de provincias:`, typeof provincias, Array.isArray(provincias));
    }
    
    // Asegurar que provincias es un array antes de pasar a la vista
    const provinciasParaVista = Array.isArray(provincias) ? provincias : [];
    
    console.log('✅ [ASIGNACIONES] Preparando renderizado de vista...');
    console.log(`   - Provincias para vista: ${provinciasParaVista.length}`);
    console.log(`   - Tipo de provinciasParaVista: ${typeof provinciasParaVista}, esArray: ${Array.isArray(provinciasParaVista)}`);
    
    try {
      res.render('dashboard/ajustes-asignaciones-comerciales', {
        title: 'Gestión de Asignaciones Comerciales - Farmadescaso',
        user: user,
        asignaciones: asignaciones || [],
        comerciales: comerciales || [],
        codigosPostales: codigosPostales || [],
        marcas: marcas || [],
        provincias: provinciasParaVista, // Asegurado como array
        filtros: filtros || {},
        success: req.query.success,
        error: req.query.error
      });
      console.log('✅ [ASIGNACIONES] Vista renderizada correctamente');
    } catch (renderError) {
      console.error('❌ [ASIGNACIONES] Error renderizando vista:', renderError.message);
      console.error('❌ [ASIGNACIONES] Stack del error de renderizado:', renderError.stack);
      throw renderError; // Re-lanzar para que sea capturado por el catch externo
    }
  } catch (error) {
    console.error('❌ Error cargando asignaciones:', error);
    console.error('❌ Stack trace:', error.stack);
    const user = req.comercial || req.session.comercial;
    
    // Intentar obtener datos básicos incluso si hay error
    let comerciales = [];
    let codigosPostales = [];
    let marcas = [];
    let provincias = [];
    
    try {
      comerciales = await crm.getComerciales().catch(() => []);
      codigosPostales = await crm.getCodigosPostales({ activo: 1 }).catch(() => []);
      marcas = await crm.query('SELECT * FROM Marcas ORDER BY Nombre ASC').catch(() => []);
      if (typeof crm.getProvincias === 'function') {
        provincias = await crm.getProvincias('ES').catch(() => []);
      } else {
        provincias = await crm.query('SELECT id, Nombre, Codigo FROM provincias WHERE CodigoPais = ? ORDER BY id ASC', ['ES']).catch(() => []);
      }
    } catch (e) {
      console.error('❌ [ASIGNACIONES] Error obteniendo datos básicos:', e.message);
    }
    
    // Asegurar que provincias es un array y normalizar
    if (!Array.isArray(provincias)) {
      provincias = [];
    } else if (provincias.length > 0) {
      provincias = provincias.map(p => ({
        id: p.id || p.Id || null,
        Id: p.id || p.Id || null,
        Nombre: p.Nombre || p.nombre || 'Sin nombre',
        nombre: p.Nombre || p.nombre || 'Sin nombre',
        Codigo: p.Codigo || p.codigo || '',
        codigo: p.Codigo || p.codigo || ''
      }));
    }
    
    try {
      res.render('dashboard/ajustes-asignaciones-comerciales', {
      title: 'Gestión de Asignaciones Comerciales - Farmadescaso',
      user: user,
      asignaciones: [],
      comerciales: comerciales,
      codigosPostales: codigosPostales,
      marcas: marcas,
      provincias: provincias,
      filtros: {},
      error: 'Error al cargar las asignaciones: ' + error.message
      });
      console.log('✅ [ASIGNACIONES] Vista de error renderizada');
    } catch (renderError) {
      console.error('❌ [ASIGNACIONES] Error crítico renderizando vista de error:', renderError.message);
      console.error('❌ [ASIGNACIONES] Stack del error de renderizado:', renderError.stack);
      // Si ni siquiera podemos renderizar la vista de error, enviar respuesta JSON
      // Intentar enviar respuesta JSON con detalles del error
      try {
        res.status(500).json({
          error: 'Error interno del servidor',
          message: error.message,
          name: error.name,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
      } catch (jsonError) {
        // Si ni siquiera podemos enviar JSON, enviar texto plano
        console.error('❌ [ASIGNACIONES] Error crítico enviando respuesta JSON:', jsonError.message);
        res.status(500).send(`Error interno del servidor: ${error.message}`);
      }
    }
  }
});

// Asignaciones masivas (POST) - DEBE IR ANTES DE /:id PARA EVITAR CONFLICTOS
console.log('✅ [RUTAS] Registrando POST /dashboard/ajustes/asignaciones-comerciales/masiva');
app.post('/dashboard/ajustes/asignaciones-comerciales/masiva', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('✅ [ASIGNACIONES-MASIVAS] ========== INICIO ==========');
    console.log('✅ [ASIGNACIONES-MASIVAS] Ruta POST /dashboard/ajustes/asignaciones-comerciales/masiva accedida');
    console.log('✅ [ASIGNACIONES-MASIVAS] Body recibido:', JSON.stringify(req.body, null, 2));
    
    const user = req.comercial || req.session.comercial;
    console.log('✅ [ASIGNACIONES-MASIVAS] Usuario:', user ? (user.Nombre || user.nombre || 'Usuario') : 'No encontrado');
    
    const {
      Id_Comercial,
      tipoAsignacion, // 'codigos', 'provincia', 'todos'
      Ids_CodigosPostales, // Array de IDs o string separado por comas
      Id_Provincia,
      Id_Marca, // null o '' = todas las marcas
      FechaInicio,
      FechaFin,
      Prioridad,
      Activo,
      Observaciones,
      ActualizarClientes
    } = req.body;

    console.log('✅ [ASIGNACIONES-MASIVAS] Datos parseados:');
    console.log('   - Id_Comercial:', Id_Comercial);
    console.log('   - tipoAsignacion:', tipoAsignacion);
    console.log('   - Id_Provincia:', Id_Provincia);
    console.log('   - Id_Marca:', Id_Marca);
    console.log('   - ActualizarClientes:', ActualizarClientes);

    if (!Id_Comercial) {
      console.error('❌ [ASIGNACIONES-MASIVAS] Error: El comercial es obligatorio');
      return res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('El comercial es obligatorio'));
    }

    let resultado;

    if (tipoAsignacion === 'provincia') {
      console.log('✅ [ASIGNACIONES-MASIVAS] Tipo: Por Provincia');
      // Asignación por provincia
      if (!Id_Provincia) {
        console.error('❌ [ASIGNACIONES-MASIVAS] Error: La provincia es obligatoria');
        return res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('La provincia es obligatoria'));
      }

      console.log('✅ [ASIGNACIONES-MASIVAS] Llamando a createAsignacionesPorProvincia...');
      console.log('✅ [ASIGNACIONES-MASIVAS] Parámetros:', {
        Id_Comercial: parseInt(Id_Comercial),
        Id_Provincia: parseInt(Id_Provincia),
        Id_Marca: Id_Marca && Id_Marca !== '' ? parseInt(Id_Marca) : null,
        Prioridad: parseInt(Prioridad) || 0,
        ActualizarClientes: ActualizarClientes === '1' || ActualizarClientes === true
      });
      
      resultado = await crm.createAsignacionesPorProvincia({
        Id_Comercial: parseInt(Id_Comercial),
        Id_Provincia: parseInt(Id_Provincia),
        Id_Marca: Id_Marca && Id_Marca !== '' ? parseInt(Id_Marca) : null,
        FechaInicio: FechaInicio || null,
        FechaFin: FechaFin || null,
        Prioridad: parseInt(Prioridad) || 0,
        Activo: Activo === '1' || Activo === true,
        Observaciones: Observaciones || null,
        CreadoPor: user.id || user.Id || null,
        ActualizarClientes: ActualizarClientes === '1' || ActualizarClientes === true
      });
      
      console.log('✅ [ASIGNACIONES-MASIVAS] Resultado de createAsignacionesPorProvincia:', JSON.stringify(resultado, null, 2));
    } else {
      // Asignación por códigos postales específicos
      console.log('✅ [ASIGNACIONES-MASIVAS] Tipo: Por Códigos Postales');
      let idsArray = [];
      if (Array.isArray(Ids_CodigosPostales)) {
        idsArray = Ids_CodigosPostales.map(id => parseInt(id));
      } else if (typeof Ids_CodigosPostales === 'string') {
        idsArray = Ids_CodigosPostales.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }

      console.log('✅ [ASIGNACIONES-MASIVAS] IDs de códigos postales procesados:', idsArray);

      if (idsArray.length === 0) {
        console.error('❌ [ASIGNACIONES-MASIVAS] Error: Debe seleccionar al menos un código postal');
        return res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('Debe seleccionar al menos un código postal'));
      }

      console.log('✅ [ASIGNACIONES-MASIVAS] Llamando a createAsignacionesMasivas...');
      console.log('✅ [ASIGNACIONES-MASIVAS] Parámetros:', {
        Id_Comercial: parseInt(Id_Comercial),
        Ids_CodigosPostales: idsArray,
        Id_Marca: Id_Marca && Id_Marca !== '' ? parseInt(Id_Marca) : null,
        Prioridad: parseInt(Prioridad) || 0,
        ActualizarClientes: ActualizarClientes === '1' || ActualizarClientes === true
      });
      
      resultado = await crm.createAsignacionesMasivas({
        Id_Comercial: parseInt(Id_Comercial),
        Ids_CodigosPostales: idsArray,
        Id_Marca: Id_Marca && Id_Marca !== '' ? parseInt(Id_Marca) : null,
        FechaInicio: FechaInicio || null,
        FechaFin: FechaFin || null,
        Prioridad: parseInt(Prioridad) || 0,
        Activo: Activo === '1' || Activo === true,
        Observaciones: Observaciones || null,
        CreadoPor: user.id || user.Id || null,
        ActualizarClientes: ActualizarClientes === '1' || ActualizarClientes === true
      });
      
      console.log('✅ [ASIGNACIONES-MASIVAS] Resultado de createAsignacionesMasivas:', JSON.stringify(resultado, null, 2));
    }

    const mensaje = `Asignaciones creadas: ${resultado.asignacionesCreadas}, ` +
                   `Existentes: ${resultado.asignacionesExistentes}, ` +
                   `Clientes actualizados: ${resultado.clientesActualizados}` +
                   (resultado.errores > 0 ? `, Errores: ${resultado.errores}` : '');

    console.log('✅ [ASIGNACIONES-MASIVAS] Mensaje de éxito:', mensaje);
    console.log('✅ [ASIGNACIONES-MASIVAS] ========== FIN ==========');
    
    res.redirect('/dashboard/ajustes/asignaciones-comerciales?success=' + encodeURIComponent(mensaje));
  } catch (error) {
    console.error('❌ [ASIGNACIONES-MASIVAS] Error creando asignaciones masivas:', error);
    console.error('❌ [ASIGNACIONES-MASIVAS] Stack:', error.stack);
    console.log('✅ [ASIGNACIONES-MASIVAS] ========== FIN (ERROR) ==========');
    res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('Error al crear asignaciones masivas: ' + error.message));
  }
});

// Crear asignación (POST)
console.log('✅ [RUTAS] Registrando POST /dashboard/ajustes/asignaciones-comerciales');
app.post('/dashboard/ajustes/asignaciones-comerciales', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = req.comercial || req.session.comercial;
    const Id_Comercial = req.body.Id_Comercial ? Number(req.body.Id_Comercial) : null;
    const Id_CodigoPostal = req.body.Id_CodigoPostal ? Number(req.body.Id_CodigoPostal) : null;
    const Id_Marca = req.body.Id_Marca ? Number(req.body.Id_Marca) : null;

    if (!Number.isFinite(Id_Comercial) || Id_Comercial <= 0) {
      return res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('El comercial es obligatorio'));
    }
    if (!Number.isFinite(Id_CodigoPostal) || Id_CodigoPostal <= 0) {
      return res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('El código postal es obligatorio'));
    }
    if (!Number.isFinite(Id_Marca) || Id_Marca <= 0) {
      return res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('La marca es obligatoria'));
    }

    const data = {
      Id_Comercial,
      Id_CodigoPostal,
      Id_Marca,
      FechaInicio: req.body.FechaInicio || null,
      FechaFin: req.body.FechaFin || null,
      Activo: req.body.Activo !== undefined ? req.body.Activo === '1' : true,
      Prioridad: req.body.Prioridad || 0,
      Observaciones: req.body.Observaciones || null,
      CreadoPor: user.id || user.Id || null
    };
    
    await crm.createAsignacion(data);
    res.redirect('/dashboard/ajustes/asignaciones-comerciales?success=' + encodeURIComponent('Asignación creada correctamente'));
  } catch (error) {
    console.error('❌ Error creando asignación:', error);
    res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('Error al crear asignación: ' + error.message));
  }
});

// Actualizar asignación (POST)
console.log('✅ [RUTAS] Registrando POST /dashboard/ajustes/asignaciones-comerciales/:id');
app.post('/dashboard/ajustes/asignaciones-comerciales/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const data = {};
    
    if (req.body.Id_Comercial !== undefined) data.Id_Comercial = req.body.Id_Comercial ? Number(req.body.Id_Comercial) : null;
    if (req.body.Id_CodigoPostal !== undefined) data.Id_CodigoPostal = req.body.Id_CodigoPostal ? Number(req.body.Id_CodigoPostal) : null;
    if (req.body.Id_Marca !== undefined) data.Id_Marca = req.body.Id_Marca ? Number(req.body.Id_Marca) : null;
    if (req.body.FechaInicio !== undefined) data.FechaInicio = req.body.FechaInicio || null;
    if (req.body.FechaFin !== undefined) data.FechaFin = req.body.FechaFin || null;
    if (req.body.Activo !== undefined) data.Activo = req.body.Activo === '1';
    if (req.body.Prioridad !== undefined) data.Prioridad = req.body.Prioridad || 0;
    if (req.body.Observaciones !== undefined) data.Observaciones = req.body.Observaciones || null;
    
    // Validar si vienen estos campos (evita INSERT/UPDATE con NULL en campos NOT NULL)
    if (data.Id_Comercial !== undefined && (!Number.isFinite(data.Id_Comercial) || data.Id_Comercial <= 0)) {
      return res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('El comercial es obligatorio'));
    }
    if (data.Id_CodigoPostal !== undefined && (!Number.isFinite(data.Id_CodigoPostal) || data.Id_CodigoPostal <= 0)) {
      return res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('El código postal es obligatorio'));
    }
    if (data.Id_Marca !== undefined && (!Number.isFinite(data.Id_Marca) || data.Id_Marca <= 0)) {
      return res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('La marca es obligatoria'));
    }
    
    await crm.updateAsignacion(id, data);
    res.redirect('/dashboard/ajustes/asignaciones-comerciales?success=' + encodeURIComponent('Asignación actualizada correctamente'));
  } catch (error) {
    console.error('❌ Error actualizando asignación:', error);
    res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('Error al actualizar asignación: ' + error.message));
  }
});

// Eliminar asignación (POST)
console.log('✅ [RUTAS] Registrando POST /dashboard/ajustes/asignaciones-comerciales/:id/eliminar');
app.post('/dashboard/ajustes/asignaciones-comerciales/:id/eliminar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await crm.deleteAsignacion(id);
    res.redirect('/dashboard/ajustes/asignaciones-comerciales?success=' + encodeURIComponent('Asignación eliminada correctamente'));
  } catch (error) {
    console.error('❌ Error eliminando asignación:', error);
    res.redirect('/dashboard/ajustes/asignaciones-comerciales?error=' + encodeURIComponent('Error al eliminar asignación: ' + error.message));
  }
});

// Endpoint de diagnóstico para provincias
app.get('/debug/provincias', requireAuth, requireAdmin, async (req, res) => {
  try {
    const provincias1 = await crm.getProvincias('ES');
    const provincias2 = await crm.query('SELECT * FROM provincias WHERE CodigoPais = ? ORDER BY Nombre ASC', ['ES']);
    const provincias3 = await crm.query('SELECT * FROM provincias ORDER BY Nombre ASC LIMIT 10');
    
    res.json({
      getProvincias_ES: provincias1,
      query_directa_ES: provincias2,
      query_sin_filtro: provincias3,
      total_provincias_ES: provincias2 ? provincias2.length : 0,
      total_provincias_todas: provincias3 ? provincias3.length : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Endpoint API para obtener provincias (por si se necesita cargar dinámicamente)
app.get('/api/provincias', requireAuth, async (req, res) => {
  try {
    const filtroPais = req.query.pais || 'ES';
    const provincias = await crm.getProvincias(filtroPais);
    res.json({ success: true, provincias: provincias || [] });
  } catch (error) {
    console.error('❌ Error obteniendo provincias (API):', error);
    res.status(500).json({ success: false, error: error.message, provincias: [] });
  }
});


// =====================================================
// FIN RUTAS DE AJUSTES - CÓDIGOS POSTALES Y ASIGNACIONES
// =====================================================

console.log('✅ [RUTAS] Rutas de códigos postales y asignaciones comerciales registradas correctamente');

// Rentabilidad de artículos (debe ir ANTES de /dashboard/articulos/:id para evitar conflictos)
// IMPORTANTE: Esta ruta debe estar ANTES de /dashboard/articulos/:id para evitar que "rentabilidad-articulos" sea capturado como :id
const rentabilidadArticulosRoutes = require('./routes/rentabilidad-articulos');
console.log('✅ [RUTAS] Registrando ruta /dashboard/rentabilidad-articulos');
app.use('/dashboard/rentabilidad-articulos', requireAuth, requireAdmin, rentabilidadArticulosRoutes);



// Gestión de artículos - listado
app.get('/dashboard/articulos', requireAuth, async (req, res) => {
  try {
    const articulos = await crm.getArticulos();
    res.render('dashboard/articulos', {
      title: 'Artículos - Farmadescaso',
      user: req.comercial || req.session.comercial,
      articulos: articulos ? articulos.map(a => normalizeObjectUTF8(a)) : [],
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('❌ Error cargando artículos:', error);
    res.render('dashboard/articulos', {
      title: 'Artículos - Farmadescaso',
      user: req.comercial || req.session.comercial,
      articulos: [],
      error: 'Error cargando artículos',
      query: req.query
    });
  }
});

// Crear nuevo artículo (formulario)
app.get('/dashboard/articulos/nuevo', requireAuth, requireAdmin, (req, res) => {
  res.render('dashboard/articulo-editar', {
    title: 'Nuevo Artículo - Farmadescaso',
    user: req.comercial || req.session.comercial,
    articulo: {},
    error: null,
    isNew: true
  });
});

// Detalle de artículo
app.get('/dashboard/articulos/:id', requireAuth, async (req, res) => {
  try {
    const articulo = await crm.getArticuloById(req.params.id);
    if (!articulo) {
      return res.status(404).render('error', { error: 'Artículo no encontrado', message: 'El artículo solicitado no existe' });
    }
    res.render('dashboard/articulo-detalle', {
      title: `Artículo #${req.params.id} - Detalle`,
      user: req.comercial || req.session.comercial,
      articulo: normalizeObjectUTF8(articulo),
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('❌ Error cargando detalle de artículo:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el artículo' });
  }
});

// Formulario de edición de artículo
app.get('/dashboard/articulos/:id/editar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const articulo = await crm.getArticuloById(req.params.id);
    if (!articulo) {
      return res.status(404).render('error', { error: 'Artículo no encontrado', message: 'El artículo solicitado no existe' });
    }
    res.render('dashboard/articulo-editar', {
      title: `Artículo #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      articulo: normalizeObjectUTF8(articulo),
      error: null,
      isNew: false
    });
  } catch (error) {
    console.error('❌ Error cargando formulario de artículo:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el formulario de edición' });
  }
});

// Crear nuevo artículo (submit)
app.post('/dashboard/articulos', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Mapeo simple y directo: nombre del formulario -> nombre de columna en BD
    // NOTA: El formulario ahora usa directamente los nombres de columna de BD
    const fieldMapping = {
      'Nombre': 'Nombre',
      'SKU': 'SKU',  // El formulario ahora usa 'SKU' directamente
      'Código': 'SKU',  // Mantener compatibilidad por si acaso
      'Presentación': 'Presentacion',
      'Presentacion': 'Presentacion',  // Mantener compatibilidad
      'PVL': 'PVL',
      'PCP': 'PCP',
      'Unidades / Caja': 'Unidades_Caja',
      'Unidades_Caja': 'Unidades_Caja',  // Mantener compatibilidad
      'Imagen': 'Imagen',
      'Marca': 'Marca',
      'EAN 13': 'EAN13',
      'EAN13': 'EAN13',  // Mantener compatibilidad
      'OK_KO': 'Activo',
      'Activo': 'Activo'  // Mantener compatibilidad
    };
 
    const payload = {};
 
    // Procesar cada campo del formulario
    for (const [formField, dbColumn] of Object.entries(fieldMapping)) {
      const value = req.body[formField];
      
      // PCP: puede ser NULL, 0, o un decimal
      if (formField === 'PCP') {
        if (value === '' || value === null || value === undefined) {
          payload[dbColumn] = null;
        } else {
          const parsedValue = parseFloat(String(value).replace(',', '.'));
          if (isNaN(parsedValue)) {
            payload[dbColumn] = null;
          } else if (parsedValue === 0) {
            payload[dbColumn] = 0.00;
          } else {
            payload[dbColumn] = Math.round(parsedValue * 100) / 100;
          }
        }
        continue;
      }
      
      // Activo: convertir a tinyint (1 = activo, 0 = inactivo)
      // También mantener compatibilidad con OK_KO por si acaso
      if (formField === 'OK_KO' || formField === 'Activo') {
        if (value !== undefined && value !== null && value !== '') {
          // Si es un número (0 o 1), usarlo directamente
          if (value === '0' || value === 0 || value === '1' || value === 1) {
            payload[dbColumn] = (value === '1' || value === 1) ? 1 : 0;
          } else {
            // Si es texto, convertir
            const val = String(value).toLowerCase();
            payload[dbColumn] = (val === 'ok' || val === 'activo' || val === '1') ? 1 : 0;
          }
        }
        continue;
      }
      
      // Otros campos: solo procesar si tienen valor
      if (value !== undefined && value !== null && value !== '') {
        if (formField === 'PVL') {
          payload[dbColumn] = parseFloat(String(value).replace(',', '.')) || 0;
        } else if (formField === 'Unidades / Caja') {
          payload[dbColumn] = parseInt(value, 10) || 0;
        } else {
          payload[dbColumn] = String(value).trim();
        }
      }
    }

    // Si no se especificó el estado, establecer como activo por defecto
    if (payload['Activo'] === undefined) {
      payload['Activo'] = 1;
    }

    if (!payload.Nombre) {
      return res.render('dashboard/articulo-editar', {
        title: 'Nuevo Artículo - Farmadescaso',
        user: req.comercial || req.session.comercial,
        articulo: req.body,
        error: 'El nombre del artículo es obligatorio',
        isNew: true
      });
    }

    const result = await crm.createArticulo(payload);
    const articuloId = result.Id || result.id;
    if (!articuloId) {
      throw new Error('No se obtuvo el ID del artículo creado');
    }

    res.redirect(`/dashboard/articulos/${articuloId}?success=articulo_creado`);
  } catch (error) {
    console.error('❌ [CREAR ARTÍCULO] Error completo:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });

    res.render('dashboard/articulo-editar', {
      title: 'Nuevo Artículo - Farmadescaso',
      user: req.comercial || req.session.comercial,
      articulo: req.body,
      error: error.message || 'No se pudo crear el artículo. Intenta nuevamente.',
      isNew: true
    });
  }
});

// Guardar edición de artículo
app.post('/dashboard/articulos/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const articuloExistente = await crm.getArticuloById(id);
    if (!articuloExistente) {
      return res.status(404).render('error', { error: 'Artículo no encontrado', message: 'El artículo solicitado no existe' });
    }

    // Mapeo simple y directo: nombre del formulario -> nombre de columna en BD
    // NOTA: El formulario ahora usa directamente los nombres de columna de BD
    const fieldMapping = {
      'Nombre': 'Nombre',
      'SKU': 'SKU',  // El formulario ahora usa 'SKU' directamente
      'Código': 'SKU',  // Mantener compatibilidad por si acaso
      'Presentación': 'Presentacion',
      'Presentacion': 'Presentacion',  // Mantener compatibilidad
      'PVL': 'PVL',
      'PCP': 'PCP',
      'Unidades / Caja': 'Unidades_Caja',
      'Unidades_Caja': 'Unidades_Caja',  // Mantener compatibilidad
      'Imagen': 'Imagen',
      'Marca': 'Marca',
      'EAN 13': 'EAN13',
      'EAN13': 'EAN13',  // Mantener compatibilidad
      'OK_KO': 'Activo',
      'Activo': 'Activo'  // Mantener compatibilidad
    };

    const payload = {};

    // Procesar cada campo del formulario
    console.log('✅ [GUARDAR ARTÍCULO] req.body completo:', JSON.stringify(req.body, null, 2));
    
    for (const [formField, dbColumn] of Object.entries(fieldMapping)) {
      const value = req.body[formField];
      console.log(`✅ [GUARDAR ARTÍCULO] Procesando campo: ${formField} -> ${dbColumn}, valor: '${value}' (tipo: ${typeof value})`);
      
      // PCP: SIEMPRE procesar (puede ser NULL, 0, o un decimal)
      // Esto permite actualizar el PCP incluso cuando está vacío
      if (formField === 'PCP') {
        if (value === '' || value === null || value === undefined) {
          payload[dbColumn] = null;
          console.log(`✅ [GUARDAR ARTÍCULO] PCP establecido como NULL (vacío)`);
        } else {
          const parsedValue = parseFloat(String(value).replace(',', '.'));
          if (isNaN(parsedValue)) {
            payload[dbColumn] = null;
            console.log(`✅ [GUARDAR ARTÍCULO] PCP establecido como NULL (NaN)`);
          } else if (parsedValue === 0) {
            payload[dbColumn] = 0.00;
            console.log(`✅ [GUARDAR ARTÍCULO] PCP establecido como 0.00`);
          } else {
            payload[dbColumn] = Math.round(parsedValue * 100) / 100;
            console.log(`✅ [GUARDAR ARTÍCULO] PCP establecido como ${payload[dbColumn]}`);
          }
        }
        console.log(`✅ [GUARDAR ARTÍCULO] PCP procesado: ${formField} -> ${dbColumn} = ${payload[dbColumn]}`);
        continue;
      }
      
      // Activo: convertir a tinyint (1 = activo, 0 = inactivo)
      // También mantener compatibilidad con OK_KO por si acaso
      if (formField === 'OK_KO' || formField === 'Activo') {
        if (value !== undefined && value !== null && value !== '') {
          // Si es un número (0 o 1), usarlo directamente
          if (value === '0' || value === 0 || value === '1' || value === 1) {
            payload[dbColumn] = (value === '1' || value === 1) ? 1 : 0;
          } else {
            // Si es texto, convertir
            const val = String(value).toLowerCase();
            payload[dbColumn] = (val === 'ok' || val === 'activo' || val === '1') ? 1 : 0;
          }
        }
        continue;
      }
      
      // Otros campos: solo procesar si tienen valor
      if (value !== undefined && value !== null && value !== '') {
        if (formField === 'PVL') {
          payload[dbColumn] = parseFloat(String(value).replace(',', '.')) || 0;
        } else if (formField === 'Unidades / Caja') {
          payload[dbColumn] = parseInt(value, 10) || 0;
        } else {
          payload[dbColumn] = String(value).trim();
        }
      }
    }

    // IMPORTANTE: Si el formulario envió PCP (incluso vacío), asegurarse de que esté en el payload
    console.log(`✅ [GUARDAR ARTÍCULO] Verificando PCP en req.body: ${req.body.PCP !== undefined ? 'presente' : 'ausente'}`);
    if (req.body.PCP !== undefined) {
      if (!payload.hasOwnProperty('PCP')) {
        console.log(`⚠️ [GUARDAR ARTÍCULO] PCP no está en payload, agregándolo manualmente...`);
        // Si no se procesó, procesarlo ahora
        const pcpValue = req.body.PCP;
        if (pcpValue === '' || pcpValue === null || pcpValue === undefined) {
          payload['PCP'] = null;
        } else {
          const parsedValue = parseFloat(String(pcpValue).replace(',', '.'));
          if (isNaN(parsedValue)) {
            payload['PCP'] = null;
          } else if (parsedValue === 0) {
            payload['PCP'] = 0.00;
          } else {
            payload['PCP'] = Math.round(parsedValue * 100) / 100;
          }
        }
        console.log(`✅ [GUARDAR ARTÍCULO] PCP agregado manualmente: ${payload['PCP']}`);
      } else {
        console.log(`✅ [GUARDAR ARTÍCULO] PCP ya está en payload: ${payload['PCP']}`);
      }
    }
    
    // IMPORTANTE: Si el formulario envió PCP (incluso vacío), asegurarse de que esté en el payload
    if (req.body.PCP !== undefined) {
      if (!payload.hasOwnProperty('PCP')) {
        // Si no se procesó, procesarlo ahora
        const pcpValue = req.body.PCP;
        if (pcpValue === '' || pcpValue === null || pcpValue === undefined) {
          payload['PCP'] = null;
        } else {
          const parsedValue = parseFloat(String(pcpValue).replace(',', '.'));
          if (isNaN(parsedValue)) {
            payload['PCP'] = null;
          } else if (parsedValue === 0) {
            payload['PCP'] = 0.00;
          } else {
            payload['PCP'] = Math.round(parsedValue * 100) / 100;
          }
        }
        console.log(`✅ [GUARDAR ARTÍCULO] PCP agregado manualmente: ${payload['PCP']}`);
      }
    }

    if (Object.keys(payload).length === 0) {
      console.warn('⚠️ [GUARDAR ARTÍCULO] Payload vacío, no hay cambios para guardar');
      return res.render('dashboard/articulo-editar', {
        title: `Artículo #${id} - Editar`,
        user: req.comercial || req.session.comercial,
        articulo: articuloExistente,
        error: 'No hay cambios para guardar',
        isNew: false
      });
    }

    // LIMPIAR el payload: eliminar cualquier clave que no sea un nombre de columna válido
    const columnasValidas = ['Nombre', 'SKU', 'Presentacion', 'PVL', 'PCP', 'Unidades_Caja', 'Imagen', 'Marca', 'EAN13', 'Activo'];
    const payloadLimpio = {};
    
    for (const [key, value] of Object.entries(payload)) {
      if (columnasValidas.includes(key)) {
        payloadLimpio[key] = value;
      } else {
        console.warn(`⚠️ [GUARDAR ARTÍCULO] Ignorando clave inválida en payload: '${key}'`);
      }
    }
    
    console.log('✅ [GUARDAR ARTÍCULO] Payload original:', JSON.stringify(payload, null, 2));
    console.log('✅ [GUARDAR ARTÍCULO] Payload limpio:', JSON.stringify(payloadLimpio, null, 2));
    console.log('✅ [GUARDAR ARTÍCULO] Claves del payload limpio:', Object.keys(payloadLimpio));
    
    if (Object.keys(payloadLimpio).length === 0) {
      console.warn('⚠️ [GUARDAR ARTÍCULO] Payload limpio está vacío, no hay cambios para guardar');
      return res.render('dashboard/articulo-editar', {
        title: `Artículo #${id} - Editar`,
        user: req.comercial || req.session.comercial,
        articulo: articuloExistente,
        error: 'No hay cambios válidos para guardar',
        isNew: false
      });
    }
    
    // El método updateArticulo ahora también filtra las columnas, pero por seguridad
    // pasamos el payload limpio que ya hemos filtrado
    console.log('✅ [GUARDAR ARTÍCULO] Llamando a updateArticulo con payload limpio');
    const result = await crm.updateArticulo(id, payloadLimpio);
    console.log('✅ [GUARDAR ARTÍCULO] Actualización exitosa:', result);
    res.redirect(`/dashboard/articulos/${id}?success=articulo_actualizado`);
  } catch (error) {
    console.error('❌ [GUARDAR ARTÍCULO] Error completo:', {
      message: error.message,
      stack: error.stack,
      id: req.params.id,
      body: req.body
    });

    try {
      const articulo = await crm.getArticuloById(req.params.id);
      if (!articulo) {
        return res.status(404).render('error', { error: 'Artículo no encontrado', message: 'El artículo no existe o no se pudo cargar' });
      }

      const errorMessage = (process.env.NODE_ENV === 'development' || req.hostname === 'localhost' || req.hostname === '127.0.0.1')
        ? `Error al guardar: ${error.message}`
        : 'No se pudo guardar el artículo. Por favor, verifica los datos e intenta nuevamente.';

      res.render('dashboard/articulo-editar', {
        title: `Artículo #${req.params.id} - Editar`,
        user: req.comercial || req.session.comercial,
        articulo,
        error: errorMessage,
        isNew: false
      });
    } catch (loadError) {
      console.error('❌ [GUARDAR ARTÍCULO] Error cargando artículo para mostrar formulario:', loadError);
      res.status(500).render('error', { error: 'Error', message: `No se pudo guardar el artículo: ${error.message}` });
    }
  }
});

// API: Alternar estado OK/KO de artículo
app.post('/api/articulos/:id/okko', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { value } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID de artículo requerido' });
    }

    const result = await crm.toggleArticuloOkKo(id, value);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ [TOGGLE ARTÍCULO OK_KO] Error completo:', {
      message: error.message,
      stack: error.stack,
      id: req.params.id,
      body: req.body
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Error al actualizar el estado del artículo'
    });
  }
});

// Eliminar artículo
app.post('/dashboard/articulos/:id/eliminar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await crm.deleteArticulo(id);
    res.redirect('/dashboard/articulos?success=articulo_eliminado');
  } catch (error) {
    console.error('❌ [ELIMINAR ARTÍCULO] Error completo:', {
      message: error.message,
      stack: error.stack,
      id: req.params.id
    });
    res.redirect('/dashboard/articulos?error=no_se_pudo_eliminar');
  }
});

// Gestión de clientes
// ============================================
// FUNCIONES HELPER PARA DUPLICADOS
// ============================================

// Función helper para normalizar texto para comparación de duplicados
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto
    .trim()
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]/g, '');
}

// Función para obtener clientes duplicados
async function obtenerDuplicados() {
  const clientes = await crm.getClientes();
  
  const duplicadosPorDNI = {};
  const duplicadosPorNombre = {};
  const duplicadosPorNombreDireccion = {};
  const duplicadosPorNombreTelefono = {};
  const duplicadosPorNombreEmail = {};
  
  for (const cliente of clientes) {
    const id = cliente.Id || cliente.id;
    const dniCif = normalizarTexto(cliente.DNI_CIF || cliente.dni_cif || '');
    const nombre = normalizarTexto(cliente.Nombre_Razon_Social || cliente.Nombre || '');
    const direccion = normalizarTexto(cliente.Direccion || cliente.direccion || '');
    const telefono = normalizarTexto(cliente.Telefono || cliente.telefono || '');
    const email = normalizarTexto(cliente.Email || cliente.email || '');
    
    if (dniCif && dniCif.length > 3) {
      if (!duplicadosPorDNI[dniCif]) duplicadosPorDNI[dniCif] = [];
      duplicadosPorDNI[dniCif].push({ ...cliente, _id: id });
    }
    
    if (nombre && nombre.length > 3) {
      if (!duplicadosPorNombre[nombre]) duplicadosPorNombre[nombre] = [];
      duplicadosPorNombre[nombre].push({ ...cliente, _id: id });
    }
    
    if (nombre && direccion && nombre.length > 3 && direccion.length > 5) {
      const clave = `${nombre}|${direccion}`;
      if (!duplicadosPorNombreDireccion[clave]) duplicadosPorNombreDireccion[clave] = [];
      duplicadosPorNombreDireccion[clave].push({ ...cliente, _id: id });
    }
    
    if (nombre && telefono && nombre.length > 3 && telefono.length > 5) {
      const clave = `${nombre}|${telefono}`;
      if (!duplicadosPorNombreTelefono[clave]) duplicadosPorNombreTelefono[clave] = [];
      duplicadosPorNombreTelefono[clave].push({ ...cliente, _id: id });
    }
    
    if (nombre && email && nombre.length > 3 && email.length > 5) {
      const clave = `${nombre}|${email}`;
      if (!duplicadosPorNombreEmail[clave]) duplicadosPorNombreEmail[clave] = [];
      duplicadosPorNombreEmail[clave].push({ ...cliente, _id: id });
    }
  }
  
  const resultado = {
    porDNI: Object.entries(duplicadosPorDNI).filter(([_, cs]) => cs.length > 1).map(([dni, cs]) => ({ dni, clientes: cs })),
    porNombre: Object.entries(duplicadosPorNombre).filter(([_, cs]) => cs.length > 1).map(([nombre, cs]) => ({ nombre, clientes: cs })),
    porNombreDireccion: Object.entries(duplicadosPorNombreDireccion).filter(([_, cs]) => cs.length > 1).map(([clave, cs]) => ({ clave, clientes: cs })),
    porNombreTelefono: Object.entries(duplicadosPorNombreTelefono).filter(([_, cs]) => cs.length > 1).map(([clave, cs]) => ({ clave, clientes: cs })),
    porNombreEmail: Object.entries(duplicadosPorNombreEmail).filter(([_, cs]) => cs.length > 1).map(([clave, cs]) => ({ clave, clientes: cs }))
  };
  
  return resultado;
}

// ============================================
// RUTAS PARA GESTIONAR DUPLICADOS
// ============================================

// ============================================
// RUTA PARA MOSTRAR DUPLICADOS
// IMPORTANTE: Debe estar ANTES de /dashboard/clientes/:id para evitar conflictos
// ============================================
app.get('/dashboard/clientes/duplicados', requireAuth, async (req, res, next) => {
  try {
    console.log('📥 [DUPLICADOS] ===== RUTA EJECUTÁNDOSE /dashboard/clientes/duplicados =====');
    console.log('📥 [DUPLICADOS] URL completa:', req.url);
    console.log('📥 [DUPLICADOS] Path:', req.path);
    console.log('📥 [DUPLICADOS] Método:', req.method);
    console.log('📥 [DUPLICADOS] Params:', req.params);
    console.log('📥 [DUPLICADOS] Query:', req.query);
    
    const user = req.comercial || req.session?.comercial || req.user;
    console.log('📥 [DUPLICADOS] Usuario:', user ? `Encontrado (ID: ${user.id || user.Id || 'N/A'})` : 'No encontrado');
    
    console.log('📥 [DUPLICADOS] Obteniendo clientes duplicados...');
    const duplicados = await obtenerDuplicados();
    
    console.log('📥 [DUPLICADOS] Duplicados obtenidos exitosamente:', {
      porDNI: duplicados.porDNI.length,
      porNombre: duplicados.porNombre.length,
      porNombreDireccion: duplicados.porNombreDireccion.length,
      porNombreEmail: duplicados.porNombreEmail.length
    });
    
    console.log('📥 [DUPLICADOS] Preparando renderizado...');
    res.render('dashboard/clientes-duplicados', {
      title: 'Clientes Duplicados - Farmadescaso CRM',
      user: user,
      duplicados: duplicados,
      currentPage: 'clientes-duplicados',
      req: req
    });
    
    console.log('📥 [DUPLICADOS] Vista enviada correctamente');
  } catch (error) {
    console.error('❌ [DUPLICADOS] ERROR CAPTURADO:', error.message);
    console.error('❌ [DUPLICADOS] Stack completo:', error.stack);
    console.error('❌ [DUPLICADOS] Error name:', error.name);
    console.error('❌ [DUPLICADOS] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Si es un error de renderizado, intentar enviar un error HTML simple
    try {
      res.status(500).render('error', {
        error: 'Error cargando duplicados',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } catch (renderError) {
      console.error('❌ [DUPLICADOS] Error al renderizar página de error:', renderError);
      res.status(500).send(`
        <h1>Error 500</h1>
        <p>Error cargando duplicados: ${error.message}</p>
        ${process.env.NODE_ENV === 'development' ? `<pre>${error.stack}</pre>` : ''}
      `);
    }
  }
});

// Ruta POST para fusionar duplicados
app.post('/dashboard/clientes/duplicados/fusionar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { clientePrincipalId, clienteDuplicadoId } = req.body;
    
    if (!clientePrincipalId || !clienteDuplicadoId) {
      return res.status(400).json({ error: 'IDs de clientes requeridos' });
    }
    
    // Verificar pedidos asociados al duplicado
    const pedidos = await crm.query('SELECT COUNT(*) as total FROM pedidos WHERE Id_Cliente = ?', [clienteDuplicadoId]);
    const totalPedidos = pedidos[0]?.total || 0;
    
    if (totalPedidos > 0) {
      // Reasignar pedidos al cliente principal
      await crm.query('UPDATE pedidos SET Id_Cliente = ? WHERE Id_Cliente = ?', [clientePrincipalId, clienteDuplicadoId]);
    }
    
    // Eliminar el cliente duplicado
    await crm.query('DELETE FROM clientes WHERE Id = ?', [clienteDuplicadoId]);
    
    res.json({ success: true, message: 'Clientes fusionados correctamente' });
  } catch (error) {
    console.error('❌ Error fusionando clientes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta POST para eliminar duplicado
app.post('/dashboard/clientes/duplicados/eliminar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { clienteId } = req.body;
    
    if (!clienteId) {
      return res.status(400).json({ error: 'ID de cliente requerido' });
    }
    
    // Verificar pedidos asociados
    const pedidos = await crm.query('SELECT COUNT(*) as total FROM pedidos WHERE Id_Cliente = ?', [clienteId]);
    const totalPedidos = pedidos[0]?.total || 0;
    
    if (totalPedidos > 0) {
      return res.status(400).json({ error: `No se puede eliminar: tiene ${totalPedidos} pedido(s) asociado(s)` });
    }
    
    // Eliminar el cliente
    await crm.query('DELETE FROM clientes WHERE Id = ?', [clienteId]);
    
    res.json({ success: true, message: 'Cliente eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error eliminando cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTA PRINCIPAL DE CLIENTES (debe ir DESPUÉS de las rutas específicas)
// ============================================

app.get('/dashboard/clientes', requireAuth, async (req, res) => {
  console.log('📥 [CLIENTES] Iniciando ruta /dashboard/clientes');
  try {
    // Obtener el ID del comercial autenticado
    console.log('🔍 [CLIENTES] Obteniendo datos del usuario...');
    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    console.log('✅ [CLIENTES] Usuario obtenido:', { comercialId: comercialIdAutenticado, isAdmin: esAdmin });

    // Seguridad: si NO es admin y no podemos determinar comercialId, no devolver todos los clientes.
    if (!esAdmin) {
      const comIdSafe = parseInt(String(comercialIdAutenticado || ''), 10);
      if (!Number.isFinite(comIdSafe) || comIdSafe <= 0) {
        console.warn('⚠️ [CLIENTES] Usuario Comercial sin comercialId válido. Devolviendo lista vacía por seguridad.');
        const estadosClientes = await crm.query('SELECT id, Nombre FROM estdoClientes ORDER BY id ASC').catch(() => ([
          { id: 1, Nombre: 'Potencial' },
          { id: 2, Nombre: 'Activo' },
          { id: 3, Nombre: 'Inactivo' }
        ]));
        return res.render('dashboard/clientes', {
          title: 'Clientes - Farmadescaso',
          user: req.comercial || req.session?.comercial || req.user || null,
          isAdmin: false,
          esAdmin: false,
          comercialIdAutenticado: null,
          clientes: [],
          totalClientes: 0,
          provincias: await crm.getProvincias().catch(() => []),
          tiposClientes: await crm.query('SELECT id, Tipo FROM tipos_clientes').catch(() => []),
          formasPago: [],
          idiomas: [],
          monedas: [],
          comerciales: [],
          estadosClientes: estadosClientes || [],
          filters: { ...req.query, comercial: null },
          error: 'No se pudo determinar tu comercial asignado. Contacta con el administrador.'
        });
      }
    }
    
    // Paginación (evitar cargar miles de filas)
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    // Default: 20 (para acelerar). Se puede cambiar con pageSize en query (hasta 200).
    const pageSize = Math.min(200, Math.max(10, parseInt(req.query.pageSize || '20', 10) || 20));

    // Obtener filtros de la query string
    const filters = {
      tipoCliente: req.query.tipoCliente || null,
      provincia: req.query.provincia || null,
      comercial: req.query.comercial || null,
      // Default: Con ventas (para cargar menos y más relevante). Si el usuario lo especifica, respetar.
      conVentas: req.query.conVentas !== undefined
        ? (req.query.conVentas !== '' ? req.query.conVentas : undefined)
        : 'true',
      // Nuevo: estadoCliente (desde catálogo). Default: Activo (2).
      // Compatibilidad legacy: estado=activos/inactivos/todos
      estadoCliente: req.query.estadoCliente || null,
      estado: req.query.estado || null
    };
    if (!filters.estadoCliente) {
      const legacy = (filters.estado || '').toString().trim().toLowerCase();
      if (legacy === 'activos') filters.estadoCliente = 2;
      else if (legacy === 'inactivos') filters.estadoCliente = 3;
      else if (legacy === 'todos') filters.estadoCliente = null;
      else filters.estadoCliente = 2;
    }
    // Búsqueda inteligente (servidor): `q` (>=2 caracteres)
    const q = (req.query.q || '').toString().trim();
    filters.q = q && q.length >= 2 ? q : null;
    console.log('✅ [CLIENTES] Filtros obtenidos:', filters);
    
    // Convertir strings a números donde sea necesario (solo si no son null o vacíos)
    // Mantener los valores originales para la vista pero convertir para la consulta
    const filtersForQuery = {};
    
    if (filters.tipoCliente && filters.tipoCliente !== '' && filters.tipoCliente !== null) {
      const tipoId = parseInt(filters.tipoCliente);
      if (!isNaN(tipoId) && tipoId > 0) {
        filtersForQuery.tipoCliente = tipoId;
        filters.tipoCliente = tipoId; // Actualizar también para la vista
      } else {
        filters.tipoCliente = null;
      }
    } else {
      filters.tipoCliente = null;
    }
    
    if (filters.provincia && filters.provincia !== '' && filters.provincia !== null) {
      const provId = parseInt(filters.provincia);
      if (!isNaN(provId) && provId > 0) {
        filtersForQuery.provincia = provId;
        filters.provincia = provId;
      } else {
        filters.provincia = null;
      }
    } else {
      filters.provincia = null;
    }
    
    // IMPORTANTE: Si no es admin, SIEMPRE forzar el filtro por el comercial autenticado
    // Esto debe hacerse DESPUÉS de procesar los otros filtros para asegurar que se aplique
    if (!esAdmin && comercialIdAutenticado) {
      const comId = parseInt(comercialIdAutenticado);
      if (!isNaN(comId) && comId > 0) {
        filtersForQuery.comercial = comId;
        filters.comercial = comId;
        // Regla de visibilidad: comercial ve sus clientes + el pool (Id_Cial = 1)
        // (se aplica en la capa SQL; si comId=1 ya es el pool)
        filtersForQuery.comercialIncludePool = true;
        console.log(`🔐 [CLIENTES] Filtro de comercial forzado para usuario no-admin: ${comId}`);

        // Si el usuario intenta forzar ?comercial=OTRO, normalizar la URL para evitar confusión
        if (req.query && req.query.comercial !== undefined && String(req.query.comercial).trim() !== '' && String(req.query.comercial) !== String(comId)) {
          const params = new URLSearchParams();
          Object.entries(req.query).forEach(([k, v]) => {
            if (v !== undefined && v !== null && String(v).trim() !== '') params.set(k, String(v));
          });
          params.set('comercial', String(comId));
          params.set('page', '1');
          return res.redirect(`/dashboard/clientes?${params.toString()}`);
        }
      } else {
        console.warn(`⚠️ [CLIENTES] comercialIdAutenticado no es válido: ${comercialIdAutenticado}`);
      }
    } else if (filters.comercial && filters.comercial !== '' && filters.comercial !== null) {
      // Solo permitir filtro manual si es admin
      const comId = parseInt(filters.comercial);
      if (!isNaN(comId) && comId > 0) {
        filtersForQuery.comercial = comId;
        filters.comercial = comId;
      } else {
        filters.comercial = null;
      }
    } else {
      filters.comercial = null;
    }
    
    // Mantener conVentas como está (string o boolean)
    if (filters.conVentas !== undefined && filters.conVentas !== null && filters.conVentas !== '') {
      filtersForQuery.conVentas = filters.conVentas;
    }
    if (filters.estadoCliente !== null && filters.estadoCliente !== undefined && String(filters.estadoCliente).trim() !== '') {
      const n = Number(filters.estadoCliente);
      if (Number.isFinite(n) && n > 0) {
        filtersForQuery.estadoCliente = n;
        filters.estadoCliente = n;
      }
    }
    if (filters.q) {
      filtersForQuery.q = filters.q;
    }

    console.log('🔍 [CLIENTES] Filtros recibidos del query:', req.query);
    console.log('🔍 [CLIENTES] Filtros procesados para vista:', filters);
    console.log('🔍 [CLIENTES] Filtros procesados para consulta:', filtersForQuery);

    // Obtener clientes - paginado (primero optimizado, si falla usar fallback)
    let clientes;
    let totalFiltrados = 0;
    try {
      // Usar filtersForQuery para la consulta (valores convertidos a números)
      console.log(`🔐 [CLIENTES] Usuario: ${esAdmin ? 'Admin' : 'Comercial'} (ID: ${comercialIdAutenticado})`);
      console.log(`🔐 [CLIENTES] Filtros que se aplicarán:`, filtersForQuery);
      const offset = (page - 1) * pageSize;
      clientes = await crm.getClientesOptimizadoPaged(filtersForQuery, { limit: pageSize, offset });
      totalFiltrados = await crm.countClientesOptimizado(filtersForQuery);
      console.log(`✅ [CLIENTES] Obtenidos ${clientes.length} clientes paginados (page=${page}, pageSize=${pageSize}, totalFiltrados=${totalFiltrados})`);
      if (Object.keys(filtersForQuery).length > 0) {
        console.log(`✅ [CLIENTES] Filtros aplicados:`, filtersForQuery);
      } else {
        console.warn(`⚠️ [CLIENTES] NO HAY FILTROS APLICADOS - Se mostrarán TODOS los clientes`);
      }
      // Normalizar codificación UTF-8 de todos los clientes
      clientes = clientes.map(cliente => normalizeObjectUTF8(cliente));
    } catch (optimizedError) {
      console.error('❌ [CLIENTES] Error en método optimizado:', optimizedError.message);
      console.error('❌ [CLIENTES] Stack:', optimizedError.stack);
      console.log('⚠️ [CLIENTES] Usando método original como fallback...');
      try {
        // IMPORTANTE: Si no es admin, pasar el comercialId al método fallback también
        const comercialIdFiltro = (!esAdmin && comercialIdAutenticado) ? comercialIdAutenticado : null;
        let todos = await crm.getClientes(comercialIdFiltro);
        console.log(`✅ [CLIENTES] Obtenidos ${todos.length} clientes con método original${comercialIdFiltro ? ` (filtrado por comercial ${comercialIdFiltro})` : ' (sin filtros)'}`);
        // Normalizar codificación UTF-8 de todos los clientes (fallback: aún puede ser grande)
        todos = todos.map(cliente => normalizeObjectUTF8(cliente));
        // IMPORTANTE: Si no es admin, SIEMPRE aplicar filtro por comercial, incluso en fallback
        if (!esAdmin && comercialIdAutenticado) {
          const comId = parseInt(comercialIdAutenticado);
          if (!isNaN(comId) && comId > 0) {
            console.log(`🔐 [CLIENTES] Aplicando filtro de comercial en fallback: ${comId} (+pool=1)`);
            todos = todos.filter(c => {
              const clienteComercialId =
                c.Id_Cial ?? c.id_Cial ?? c.id_cial ??
                c.ComercialId ?? c.comercialId ?? c.comercial_id ??
                c.Id_Comercial ?? c.id_comercial ??
                c.Comercial_id;
              const n = Number(clienteComercialId);
              // Pool: 1
              return n === comId || n === 1;
            });
            console.log(`✅ [CLIENTES] Filtrados por comercial en fallback: ${todos.length} clientes`);
          }
        }
        
        // Si hay otros filtros pero falló el método optimizado, aplicar filtros manualmente
        if (Object.keys(filtersForQuery).length > 0) {
          console.log('⚠️ [CLIENTES] Aplicando filtros manualmente después del fallback...');
          let clientesFiltrados = todos;
          
          if (filtersForQuery.tipoCliente) {
            clientesFiltrados = clientesFiltrados.filter(c => (c.Id_TipoCliente || c.id_TipoCliente) == filtersForQuery.tipoCliente);
          }
          if (filtersForQuery.provincia) {
            clientesFiltrados = clientesFiltrados.filter(c => (c.Id_Provincia || c.id_Provincia) == filtersForQuery.provincia);
          }
          // El filtro de comercial ya se aplicó arriba si no es admin
          if (filtersForQuery.comercial && esAdmin) {
            clientesFiltrados = clientesFiltrados.filter(c => (c.Id_Cial || c.id_Cial) == filtersForQuery.comercial);
          }
          if (filtersForQuery.conVentas !== undefined) {
            // Para con/sin ventas, necesitaríamos cargar pedidos, así que por ahora lo omitimos en el fallback
            console.log('⚠️ [CLIENTES] Filtro con/sin ventas no disponible en fallback manual');
          }

          // Búsqueda inteligente (q) en fallback manual
          if (filtersForQuery.q && typeof filtersForQuery.q === 'string' && filtersForQuery.q.trim().length >= 2) {
            const qLower = filtersForQuery.q.trim().toLowerCase();
            clientesFiltrados = clientesFiltrados.filter(c => {
              const hay = (v) => String(v ?? '').toLowerCase().includes(qLower);
              return (
                hay(c.Nombre_Razon_Social) ||
                hay(c.Nombre_Cial) ||
                hay(c.DNI_CIF) ||
                hay(c.Email) ||
                hay(c.Telefono) ||
                hay(c.Movil) ||
                hay(c.NumeroFarmacia) ||
                hay(c.Direccion) ||
                hay(c.Poblacion) ||
                hay(c.CodigoPostal) ||
                hay(c.NomContacto) ||
                hay(c.Observaciones) ||
                hay(c.IBAN) ||
                hay(c.CuentaContable)
              );
            });
          }
          
          // Estado (fallback manual): preferir Id_EstdoCliente; fallback a OK_KO si no existe.
          if (filtersForQuery.estadoCliente) {
            const estadoId = Number(filtersForQuery.estadoCliente);
            if (Number.isFinite(estadoId) && estadoId > 0) {
              clientesFiltrados = clientesFiltrados.filter(c => {
                const v = c.Id_EstdoCliente ?? c.id_EstdoCliente ?? c.Id_EstadoCliente ?? c.id_estado_cliente ?? null;
                return Number(v) === estadoId;
              });
            }
          } else if (filtersForQuery.estado === 'activos') {
            clientesFiltrados = clientesFiltrados.filter(c => {
              const ok = c.OK_KO;
              return ok === 1 || ok === true || ok === '1' || (typeof ok === 'string' && ok.toUpperCase().trim() === 'OK');
            });
          } else if (filtersForQuery.estado === 'inactivos') {
            clientesFiltrados = clientesFiltrados.filter(c => {
              const ok = c.OK_KO;
              return ok === 0 || ok === false || ok === '0' || (typeof ok === 'string' && ok.toUpperCase().trim() === 'KO');
            });
          }

          totalFiltrados = clientesFiltrados.length;
          const start = (page - 1) * pageSize;
          clientes = clientesFiltrados.slice(start, start + pageSize);
          console.log(`✅ [CLIENTES] Filtrados manualmente: totalFiltrados=${totalFiltrados}, page=${page}, pageSize=${pageSize}, rows=${clientes.length}`);
        } else {
          totalFiltrados = todos.length;
          const start = (page - 1) * pageSize;
          clientes = todos.slice(start, start + pageSize);
          console.log(`✅ [CLIENTES] Fallback sin filtros: totalFiltrados=${totalFiltrados}, rows=${clientes.length}`);
        }
      } catch (originalError) {
        console.error('❌ [CLIENTES] Error también en método original:', originalError.message);
        throw originalError; // Re-lanzar para que el catch externo lo maneje
      }
    }
    
    // Totales
    const totalClientes = await crm.getClientesCount().catch(() => {
      return Array.isArray(clientes) ? clientes.length : 0;
    });
    if (!totalFiltrados) {
      totalFiltrados = Array.isArray(clientes) ? clientes.length : 0;
    }

    // Ventas acumuladas por cliente en el año (por defecto: año actual; opcional ?year=YYYY)
    const currentYear = new Date().getFullYear();
    const yearVentas = req.query.year ? parseInt(String(req.query.year), 10) : currentYear;
    const yearVentasSafe = Number.isFinite(yearVentas) && yearVentas >= 2000 && yearVentas <= 2100 ? yearVentas : currentYear;

    const clientesIds = (clientes || []).map(c => Number(c.id || c.Id)).filter(n => Number.isFinite(n) && n > 0);
    const ventasPorCliente = new Map();
    if (clientesIds.length > 0) {
      try {
        const pedidosColsRows = await crm.query('SHOW COLUMNS FROM pedidos').catch(() => []);
        const pedidosCols = new Set((pedidosColsRows || []).map(r => String(r.Field || '').trim()).filter(Boolean));

        const pick = (cands) => (cands || []).find(c => pedidosCols.has(c)) || null;
        const colClientePedido = pick(['Id_Cliente', 'Cliente_id', 'id_cliente', 'cliente_id', 'ClienteId', 'clienteId']);
        const colFechaPedido = pick(['FechaPedido', 'Fecha', 'fecha', 'CreatedAt', 'created_at', 'Fecha_Pedido', 'fecha_pedido']);
        const colEstadoPedido = pick(['EstadoPedido', 'estadoPedido', 'estado_pedido']);
        const colTotalPedido = pick(['TotalPedido', 'totalPedido', 'total_pedido', 'Total_pedido']);
        const colBase = pick(['BaseImponible', 'baseImponible', 'base_imponible']);
        const colIva = pick(['TotalIva', 'totalIva', 'total_iva']);

        if (colClientePedido && colFechaPedido) {
          const placeholders = clientesIds.map(() => '?').join(',');
          const totalExpr = colTotalPedido
            ? (colBase && colIva
              ? `COALESCE(p.\`${colTotalPedido}\`, (COALESCE(p.\`${colBase}\`,0) + COALESCE(p.\`${colIva}\`,0)), 0)`
              : `COALESCE(p.\`${colTotalPedido}\`, 0)`)
            : (colBase && colIva ? `(COALESCE(p.\`${colBase}\`,0) + COALESCE(p.\`${colIva}\`,0))` : '0');

          const whereEstado = colEstadoPedido
            ? ` AND LOWER(COALESCE(p.\`${colEstadoPedido}\`,'')) NOT IN ('anulado','pendiente','cancelado')`
            : '';

          const sqlVentas = `
            SELECT
              p.\`${colClientePedido}\` AS clienteId,
              ROUND(SUM(${totalExpr}), 2) AS total
            FROM pedidos p
            WHERE p.\`${colClientePedido}\` IN (${placeholders})
              AND YEAR(p.\`${colFechaPedido}\`) = ?
              ${whereEstado}
            GROUP BY p.\`${colClientePedido}\`
          `;
          const rowsVentas = await crm.query(sqlVentas, [...clientesIds, yearVentasSafe]).catch(() => []);
          (rowsVentas || []).forEach(r => {
            const id = Number(r.clienteId);
            const total = Number(r.total || 0);
            if (Number.isFinite(id) && id > 0) ventasPorCliente.set(id, Number.isFinite(total) ? total : 0);
          });
        }
      } catch (e) {
        console.warn('⚠️ [CLIENTES] No se pudieron calcular ventas por cliente:', e?.message || e);
      }
    }
    (clientes || []).forEach(c => {
      const id = Number(c.id || c.Id);
      c.VentasAcumuladasYear = ventasPorCliente.get(id) || 0;
      c.VentasAcumuladasYearLabel = yearVentasSafe;
    });

    // Obtener datos para los filtros (solo lo necesario)
    let [provincias, tiposClientes, comerciales, estadosClientes] = await Promise.all([
      crm.getProvincias().catch(() => []),
      crm.query('SELECT id, Tipo FROM tipos_clientes').catch(() => []),
      crm.getComerciales().catch(() => []),
      crm.query('SELECT id, Nombre FROM estdoClientes ORDER BY id ASC').catch(() => ([
        { id: 1, Nombre: 'Potencial' },
        { id: 2, Nombre: 'Activo' },
        { id: 3, Nombre: 'Inactivo' }
      ]))
    ]);

    // Normalizar codificación UTF-8 de los datos de filtros
    provincias = provincias.map(p => ({ ...p, Nombre: normalizeUTF8(p.Nombre || '') }));
    tiposClientes = tiposClientes.map(t => ({ ...t, Tipo: normalizeUTF8(t.Tipo || '') }));
    comerciales = comerciales.map(c => ({ ...c, Nombre: normalizeUTF8(c.Nombre || '') }));
    
    // Verificar si el usuario es administrador usando el helper
    const user = req.comercial || req.session?.comercial || req.user || null;
    // esAdmin ya está declarado arriba en la línea 5558

    console.log('📊 [CLIENTES] Preparando renderizado con:', {
      userId: comercialIdAutenticado,
      isAdmin: esAdmin,
      userExists: !!user,
      clientesCount: clientes?.length || 0,
      filters: filters
    });

    res.render('dashboard/clientes', {
      title: 'Clientes - Farmadescaso',
      user: user || null,
      isAdmin: esAdmin || false,
      esAdmin: esAdmin || false, // Alias para compatibilidad
      comercialIdAutenticado: comercialIdAutenticado || null, // Pasar el ID del comercial autenticado
      clientes: clientes || [], // Ya normalizados arriba con normalizeObjectUTF8
      totalClientes: totalClientes || (Array.isArray(clientes) ? clientes.length : 0),
      totalFiltrados: totalFiltrados,
      page,
      pageSize,
      provincias: provincias || [],
      tiposClientes: tiposClientes || [],
      comerciales: comerciales || [],
      estadosClientes: estadosClientes || [],
      filters: filters || {}, // Pasar filtros actuales a la vista (ya incluye el comercial si no es admin)
      searchQuery: filters.q || '',
      ventasYear: yearVentasSafe,
      error: null
    });
  } catch (error) {
    console.error('❌ [CLIENTES] Error cargando clientes:', error);
    console.error('❌ [CLIENTES] Stack:', error.stack);
    console.error('❌ [CLIENTES] Filtros recibidos:', req.query);
    console.error('❌ [CLIENTES] Error completo:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5)
    });
    
    try {
      const user = req.comercial || req.session?.comercial || req.user || null;
      const esAdmin = getUserIsAdmin(req);
      const comercialIdAutenticadoError = getComercialId(req);
      
      // Si no es admin, forzar el filtro en el objeto filters para la vista
      const filtersError = { ...req.query };
      if (!esAdmin && comercialIdAutenticadoError) {
        filtersError.comercial = comercialIdAutenticadoError;
      }

      // Intentar cargar datos básicos incluso si falla la consulta optimizada
      let provincias = [];
      let tiposClientes = [];
      let comerciales = [];
      let estadosClientes = [];
      
      try {
        [provincias, tiposClientes, comerciales, estadosClientes] = await Promise.all([
          crm.getProvincias().catch(() => []),
          crm.query('SELECT id, Tipo FROM tipos_clientes').catch(() => []),
          crm.getComerciales().catch(() => []),
          crm.query('SELECT id, Nombre FROM estdoClientes ORDER BY id ASC').catch(() => ([
            { id: 1, Nombre: 'Potencial' },
            { id: 2, Nombre: 'Activo' },
            { id: 3, Nombre: 'Inactivo' }
          ]))
        ]);
      } catch (fallbackError) {
        console.error('❌ [CLIENTES] Error en fallback:', fallbackError.message);
      }

      res.render('dashboard/clientes', {
        title: 'Clientes - Farmadescaso',
        user: user || null,
        isAdmin: esAdmin || false,
        esAdmin: esAdmin || false, // Alias para compatibilidad
        comercialIdAutenticado: comercialIdAutenticadoError || null, // Pasar el ID del comercial autenticado
        clientes: [],
        totalClientes: 0,
        provincias: provincias || [],
        tiposClientes: tiposClientes || [],
        formasPago: [],
        idiomas: [],
        monedas: [],
        comerciales: comerciales || [],
        estadosClientes: estadosClientes || [],
        filters: filtersError || {}, // Incluir el filtro de comercial si no es admin
        error: `Error cargando clientes: ${error.message}`
      });
    } catch (renderError) {
      console.error('❌ [CLIENTES] Error crítico al renderizar vista de error:', renderError);
      res.status(500).send(`
        <h1>Error 500 - Error interno del servidor</h1>
        <p>Error original: ${error.message}</p>
        <p>Error al renderizar: ${renderError.message}</p>
        <pre>${error.stack}</pre>
      `);
    }
  }
});

// IMPORTANTE: Las rutas más específicas deben ir ANTES que las genéricas
// Formulario de nuevo cliente
app.get('/dashboard/clientes/nuevo', requireAuth, async (req, res) => {
  try {
    const esAdmin = getUserIsAdmin(req);
    const comercialIdAutenticado = getComercialId(req);

    // Obtener todos los datos necesarios para los selectores
    const provincias = await crm.getProvincias();
    const paises = await crm.getPaises();
    // Normalizar nombres de países antes de pasarlos a la vista
    const paisesNormalizados = paises ? paises.map(p => ({ ...p, Nombre_pais: normalizeUTF8(p.Nombre_pais || '') })) : [];
    
    const tiposClientes = await crm.query('SELECT id, Tipo FROM tipos_clientes').catch(() => []);
    const estadosClientes = await crm.query('SELECT id, Nombre FROM estdoClientes ORDER BY id ASC').catch(() => ([
      { id: 1, Nombre: 'Potencial' },
      { id: 2, Nombre: 'Activo' },
      { id: 3, Nombre: 'Inactivo' }
    ]));
    const formasPago = await crm.getFormasPago();
    const idiomas = await crm.query('SELECT id, Nombre AS Idioma FROM idiomas').catch(() => []);
    const monedas = await crm.query('SELECT id, Nombre AS Moneda FROM monedas').catch(() => []);
    // Solo admin necesita listado completo de comerciales (para reasignar).
    // Comercial crea clientes para sí mismo.
    const comerciales = esAdmin ? await crm.getComerciales().catch(() => []) : [];
    const tarifasClientes = await crm.query('SELECT Id, NombreTarifa, Activa, FechaFin FROM tarifasClientes ORDER BY NombreTarifa ASC').catch(() => []);
    const contactosDisponibles = await crm.getContactos({ includeInactivos: false, limit: 200, offset: 0 }).catch(() => []);
    
    res.render('dashboard/cliente-editar', {
      title: 'Nuevo Cliente - Farmadescaso',
      user: req.comercial || req.session?.comercial || req.user || {},
      cliente: null, // No hay cliente porque es nuevo
      provincias: provincias || [],
      paises: paisesNormalizados,
      cooperativasCliente: [],
      grupoComprasCliente: null,
      tiposClientes: tiposClientes || [],
      estadosClientes: estadosClientes || [],
      formasPago: formasPago || [],
      idiomas: idiomas || [],
      monedas: monedas || [],
      comerciales: comerciales || [],
      tarifasClientes: tarifasClientes || [],
      contactosDisponibles: contactosDisponibles || [],
      isNew: true,
      esAdmin,
      comercialIdAutenticado: comercialIdAutenticado || null,
      error: null
    });
  } catch (error) {
    console.error('Error cargando formulario de nuevo cliente:', error);
    res.status(500).render('error', { 
      error: 'Error', 
      message: 'No se pudo cargar el formulario de nuevo cliente' 
    });
  }
});

// Formulario de edición de cliente
app.get('/dashboard/clientes/:id/editar', requireAuth, async (req, res) => {
  try {
    const clienteId = req.params.id;
    console.log(`📝 [EDITAR CLIENTE] Cargando formulario para cliente ID: ${clienteId}`);
    
    const cliente = await crm.getClienteById(clienteId);
    if (!cliente) {
      console.error(`❌ [EDITAR CLIENTE] Cliente no encontrado: ${clienteId}`);
      return res.status(404).render('error', { error: 'Cliente no encontrado', message: 'El cliente no existe' });
    }
    
    console.log(`✅ [EDITAR CLIENTE] Cliente encontrado: ${cliente.Id || cliente.id}`);
    
    // Obtener todos los datos necesarios para los selectores
    console.log(`📋 [EDITAR CLIENTE] Cargando datos adicionales...`);
    const [provincias, paises, cooperativasCliente, grupoComprasCliente, tiposClientes, estadosClientes, formasPago, idiomas, monedas, comerciales] = await Promise.all([
      crm.getProvincias().catch(err => { console.error('Error obteniendo provincias:', err); return []; }),
      crm.getPaises().catch(err => { console.error('Error obteniendo países:', err); return []; }),
      crm.getCooperativasByClienteId(clienteId).catch(err => { console.error('Error obteniendo cooperativas:', err); return []; }),
      crm.getGrupoComprasActivoByClienteId(clienteId).catch(err => { console.error('Error obteniendo grupo de compras:', err); return null; }),
      crm.query('SELECT id, Tipo FROM tipos_clientes').catch(err => { console.error('Error obteniendo tipos clientes:', err); return []; }),
      crm.query('SELECT id, Nombre FROM estdoClientes ORDER BY id ASC').catch(() => ([
        { id: 1, Nombre: 'Potencial' },
        { id: 2, Nombre: 'Activo' },
        { id: 3, Nombre: 'Inactivo' }
      ])),
      crm.getFormasPago().catch(err => { console.error('Error obteniendo formas de pago:', err); return []; }),
      crm.query('SELECT id, Nombre AS Idioma FROM idiomas').catch(err => { console.error('Error obteniendo idiomas:', err); return []; }),
      crm.query('SELECT id, Nombre AS Moneda FROM monedas').catch(err => { console.error('Error obteniendo monedas:', err); return []; }),
      crm.getComerciales().catch(err => { console.error('Error obteniendo comerciales:', err); return []; })
    ]);
    const tarifasClientes = await crm.query('SELECT Id, NombreTarifa, Activa, FechaFin FROM tarifasClientes ORDER BY NombreTarifa ASC').catch(() => []);
    
    // Normalizar nombres de países antes de pasarlos a la vista
    const paisesNormalizados = paises ? paises.map(p => ({ ...p, Nombre_pais: normalizeUTF8(p.Nombre_pais || '') })) : [];
    
    console.log(`✅ [EDITAR CLIENTE] Datos cargados - Provincias: ${provincias?.length || 0}, Países: ${paises?.length || 0}, Comerciales: ${comerciales?.length || 0}`);
    
    res.render('dashboard/cliente-editar', {
      title: `Cliente #${clienteId} - Editar`,
      user: req.comercial || req.session?.comercial || req.user || {},
      cliente: normalizeObjectUTF8(cliente),
      provincias: provincias || [],
      paises: paisesNormalizados,
      cooperativasCliente: cooperativasCliente ? cooperativasCliente.map(c => normalizeObjectUTF8(c)) : [],
      grupoComprasCliente: grupoComprasCliente ? normalizeObjectUTF8(grupoComprasCliente) : null,
      tiposClientes: tiposClientes || [],
      estadosClientes: estadosClientes || [],
      formasPago: formasPago || [],
      idiomas: idiomas || [],
      monedas: monedas || [],
      comerciales: comerciales || [],
      tarifasClientes: tarifasClientes || [],
      isNew: false,
      error: null
    });
  } catch (error) {
    console.error('❌ [EDITAR CLIENTE] Error completo:', error);
    console.error('❌ [EDITAR CLIENTE] Stack:', error.stack);
    res.status(500).render('error', { 
      error: 'Error interno del servidor', 
      message: `No se pudo cargar el formulario de edición. Error: ${error.message}` 
    });
  }
});

// Mostrar mandato SEPA B2B (debe ir antes de la ruta genérica /:id)
app.get('/dashboard/clientes/:id/mandato-sepa', requireAuth, async (req, res) => {
  try {
    const cliente = await crm.getClienteById(req.params.id);
    if (!cliente) {
      return res.status(404).render('error', { error: 'Cliente no encontrado', message: 'El cliente no existe' });
    }
    
    // Generar referencia única del mandato si no existe
    const mandateReference = req.query.mandateReference || `SEPA-B2B-${cliente.Id || cliente.id}-${Date.now()}`;
    
    // Obtener datos del query string (si vienen del envío)
    const mandatoData = {
      debtorName: req.query.debtorName || cliente.Nombre || cliente.nombre || cliente.Razon_Social || cliente.RAZON_SOCIAL || '',
      debtorAddress: req.query.debtorAddress || cliente.Direccion || cliente.direccion || cliente.CALLE || cliente.Calle || '',
      debtorPostal: req.query.debtorPostal || `${cliente.Codigo_Postal || cliente.CODIGO_POSTAL || cliente.codigo_postal || ''} - ${cliente.Poblacion || cliente.POBLACION || cliente.poblacion || cliente.Localidad || cliente.localidad || ''} - ${cliente.Provincia || cliente.PROVINCIA || cliente.provincia || ''}`,
      debtorCountry: req.query.debtorCountry || 'ESPAÑA',
      debtorBIC: req.query.debtorBIC || '',
      debtorIBAN: req.query.debtorIBAN || '',
      paymentType: req.query.paymentType || 'recurring',
      signingDate: req.query.signingDate || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    };
    
    // Si es para PDF, renderizar sin controles de navegación
    const isPdf = req.query.pdf === 'true';
    
    res.render('dashboard/mandato-sepa-b2b', {
      title: `Mandato SEPA B2B - Cliente #${req.params.id}`,
      user: req.comercial || req.session.comercial,
      cliente,
      mandateReference,
      mandatoData,
      isPdf,
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando mandato SEPA:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el mandato' });
  }
});

// Enviar mandato SEPA B2B por email
app.post('/dashboard/clientes/:id/mandato-sepa/send', requireAuth, async (req, res) => {
  try {
    const cliente = await crm.getClienteById(req.params.id);
    if (!cliente) {
      return res.status(404).render('error', { error: 'Cliente no encontrado', message: 'El cliente no existe' });
    }
    
    const { emailTo, debtorName, debtorAddress, debtorPostal, debtorCountry, debtorBIC, debtorIBAN, paymentType, signingDate, mandateReference } = req.body;
    
    if (!emailTo) {
      return res.render('dashboard/mandato-sepa-b2b', {
        title: `Mandato SEPA B2B - Cliente #${req.params.id}`,
        user: req.comercial || req.session.comercial,
        cliente,
        mandateReference: mandateReference || `SEPA-B2B-${cliente.Id || cliente.id}-${Date.now()}`,
        error: 'El email del destinatario es requerido',
        query: req.query
      });
    }
    
    // Validar IBAN y BIC
    if (!debtorIBAN || debtorIBAN.length !== 24) {
      return res.render('dashboard/mandato-sepa-b2b', {
        title: `Mandato SEPA B2B - Cliente #${req.params.id}`,
        user: req.comercial || req.session.comercial,
        cliente,
        mandateReference: mandateReference || `SEPA-B2B-${cliente.Id || cliente.id}-${Date.now()}`,
        error: 'El IBAN debe tener 24 caracteres',
        query: req.query
      });
    }
    
    if (!debtorBIC || debtorBIC.length < 8) {
      return res.render('dashboard/mandato-sepa-b2b', {
        title: `Mandato SEPA B2B - Cliente #${req.params.id}`,
        user: req.comercial || req.session.comercial,
        cliente,
        mandateReference: mandateReference || `SEPA-B2B-${cliente.Id || cliente.id}-${Date.now()}`,
        error: 'El BIC debe tener al menos 8 caracteres',
        query: req.query
      });
    }
    
    // Generar PDF del mandato usando Puppeteer
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Generar URL completa para renderizar la vista (con pdf=true para ocultar controles)
      const mandatoUrl = `${getCanonicalOrigin()}/dashboard/clientes/${req.params.id}/mandato-sepa?` +
        `pdf=true` +
        `&debtorName=${encodeURIComponent(debtorName || '')}` +
        `&debtorAddress=${encodeURIComponent(debtorAddress || '')}` +
        `&debtorPostal=${encodeURIComponent(debtorPostal || '')}` +
        `&debtorCountry=${encodeURIComponent(debtorCountry || 'ESPAÑA')}` +
        `&debtorBIC=${encodeURIComponent(debtorBIC || '')}` +
        `&debtorIBAN=${encodeURIComponent(debtorIBAN || '')}` +
        `&paymentType=${encodeURIComponent(paymentType || 'recurring')}` +
        `&signingDate=${encodeURIComponent(signingDate || new Date().toLocaleDateString('es-ES'))}` +
        `&mandateReference=${encodeURIComponent(mandateReference || '')}`;
      
      await page.goto(mandatoUrl, { waitUntil: 'networkidle0' });
      
      // Generar PDF con configuración para dos páginas
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        preferCSSPageSize: true
      });
      
      await browser.close();
      
      // Enviar email con el PDF adjunto
      const mailOptions = {
        from: process.env.MAIL_USER || 'pedidos@farmadescanso.com',
        to: emailTo,
        subject: `Mandato SEPA B2B - ${debtorName || cliente.Nombre || cliente.nombre}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">Mandato SEPA B2B</h2>
            <p>Estimado/a cliente,</p>
            <p>Le enviamos el mandato SEPA B2B que debe completar y firmar para autorizar el adeudo directo.</p>
            <p><strong>Referencia del mandato:</strong> ${mandateReference}</p>
            <p><strong>Cliente:</strong> ${debtorName || cliente.Nombre || cliente.nombre}</p>
            <p><strong>IBAN:</strong> ${debtorIBAN}</p>
            <p><strong>BIC:</strong> ${debtorBIC}</p>
            <p>Por favor, complete todos los campos requeridos, firme el documento y envíelo de vuelta a esta dirección de email.</p>
            <p>Si tiene alguna pregunta, no dude en contactarnos.</p>
            <p>Atentamente,<br><strong>Farmadescanso 2021 SL</strong></p>
            <hr>
            <p style="font-size: 12px; color: #666;">
              FARMADESCANSO 2021 SL<br>
              CIF: B75359596<br>
              Calle Huerta, 15 Bajo<br>
              30193 Yéchar, Mula, Murcia<br>
              España
            </p>
          </div>
        `,
        attachments: [
          {
            filename: `Mandato_SEPA_B2B_${mandateReference}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };
      
      await mailTransport.sendMail(mailOptions);
      
      console.log('✅ [MANDATO SEPA] Mandato enviado correctamente por email a:', emailTo);
      
      res.redirect(`/dashboard/clientes/${req.params.id}/mandato-sepa?success=mandato_enviado`);
    } catch (pdfError) {
      await browser.close();
      throw pdfError;
    }
  } catch (error) {
    console.error('❌ [MANDATO SEPA] Error enviando mandato:', error);
    res.render('dashboard/mandato-sepa-b2b', {
      title: `Mandato SEPA B2B - Cliente #${req.params.id}`,
      user: req.comercial || req.session.comercial,
      cliente,
      mandateReference: mandateReference || `SEPA-B2B-${cliente.Id || cliente.id}-${Date.now()}`,
      error: `Error al enviar el mandato: ${error.message}`,
      query: req.query
    });
  }
});

// ============================================
// CLIENTES -> CONTACTOS (vista y gestión de vínculos)
// Debe ir ANTES de /dashboard/clientes/:id
// ============================================
app.get('/dashboard/clientes/:id/contactos', requireAuth, async (req, res) => {
  try {
    const idParam = req.params.id;
    const cliente = await crm.getClienteById(idParam);
    if (!cliente) {
      return res.status(404).render('error', { error: 'Cliente no encontrado', message: 'El cliente no existe' });
    }

    const includeHistorico = String(req.query.includeHistorico || '') === '1' || String(req.query.includeHistorico || '').toLowerCase() === 'true';
    const relaciones = await crm.getContactosByCliente(Number(cliente.Id || cliente.id), { includeHistorico });
    const contactosDisponibles = await crm.getContactos({ includeInactivos: false, limit: 500, offset: 0 });

    const userForView = req.comercial || req.session?.comercial || req.user || null;
    const esAdmin = getUserIsAdmin(req);

    res.render('dashboard/cliente-contactos', {
      title: `Contactos del cliente #${cliente.Id || cliente.id}`,
      user: userForView,
      esAdmin,
      isAdmin: esAdmin,
      currentPage: 'clientes',
      cliente: normalizeObjectUTF8(cliente),
      relaciones: relaciones || [],
      contactosDisponibles: contactosDisponibles || [],
      query: req.query,
      error: null
    });
  } catch (error) {
    console.error('❌ Error cargando contactos de cliente:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudieron cargar los contactos del cliente' });
  }
});

// ============================================
// CLIENTES -> DIRECCIONES ENVÍO (CRUD)
// Debe ir ANTES de /dashboard/clientes/:id
// ============================================
app.get('/dashboard/clientes/:id/direcciones-envio', requireAuth, async (req, res) => {
  try {
    const idParam = req.params.id;
    const cliente = await crm.getClienteById(idParam);
    if (!cliente) {
      return res.status(404).render('error', { error: 'Cliente no encontrado', message: 'El cliente no existe' });
    }

    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    if (!esAdmin && comercialIdAutenticado) {
      const clienteComercialId = cliente.Id_Cial || cliente.id_Cial || cliente.Comercial_id || cliente.comercial_id;
      if (Number(clienteComercialId) !== Number(comercialIdAutenticado)) {
        return res.status(403).render('error', { error: 'Acceso denegado', message: 'No tienes permiso para ver este cliente.' });
      }
    }

    const direcciones = await crm.getDireccionesEnvioByCliente(Number(cliente.Id || cliente.id), { includeInactivas: true });
    const userForView = req.comercial || req.session?.comercial || req.user || null;
    const returnToRaw = (req.query.returnTo || '').toString().trim();
    const returnTo = (returnToRaw.startsWith('/dashboard/pedidos') ? returnToRaw : '');

    res.render('dashboard/cliente-direcciones-envio', {
      title: `Direcciones de envío - Cliente #${cliente.Id || cliente.id}`,
      user: userForView,
      cliente: normalizeObjectUTF8(cliente),
      direcciones: direcciones || [],
      returnTo,
      query: req.query,
      error: null
    });
  } catch (error) {
    console.error('❌ Error cargando direcciones de envío:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudieron cargar las direcciones de envío' });
  }
});

app.get('/dashboard/clientes/:id/direcciones-envio/nueva', requireAuth, async (req, res) => {
  try {
    const idParam = req.params.id;
    const cliente = await crm.getClienteById(idParam);
    if (!cliente) return res.status(404).render('error', { error: 'Cliente no encontrado', message: 'El cliente no existe' });

    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    if (!esAdmin && comercialIdAutenticado) {
      const clienteComercialId = cliente.Id_Cial || cliente.id_Cial || cliente.Comercial_id || cliente.comercial_id;
      if (Number(clienteComercialId) !== Number(comercialIdAutenticado)) {
        return res.status(403).render('error', { error: 'Acceso denegado', message: 'No tienes permiso para ver este cliente.' });
      }
    }

    const [provincias, contactosCliente] = await Promise.all([
      crm.getProvincias().catch(() => []),
      crm.getContactosByCliente(Number(cliente.Id || cliente.id), { includeHistorico: false }).catch(() => [])
    ]);

    const returnToRaw = (req.query.returnTo || '').toString().trim();
    const returnTo = (returnToRaw.startsWith('/dashboard/pedidos') ? returnToRaw : '');

    res.render('dashboard/cliente-direccion-envio-form', {
      title: `Nueva dirección de envío - Cliente #${cliente.Id || cliente.id}`,
      heading: 'Nueva dirección',
      user: req.comercial || req.session?.comercial || req.user || null,
      cliente: normalizeObjectUTF8(cliente),
      provincias,
      contactosCliente,
      values: {},
      action: `/dashboard/clientes/${encodeURIComponent(String(cliente.Id || cliente.id))}/direcciones-envio`,
      returnTo,
      error: null
    });
  } catch (error) {
    console.error('❌ Error cargando formulario de dirección de envío:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el formulario' });
  }
});

app.post('/dashboard/clientes/:id/direcciones-envio', requireAuth, async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    if (!Number.isFinite(clienteId) || clienteId <= 0) throw new Error('clienteId inválido');

    const cliente = await crm.getClienteById(clienteId);
    if (!cliente) return res.status(404).render('error', { error: 'Cliente no encontrado', message: 'El cliente no existe' });

    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    if (!esAdmin && comercialIdAutenticado) {
      const clienteComercialId = cliente.Id_Cial || cliente.id_Cial || cliente.Comercial_id || cliente.comercial_id;
      if (Number(clienteComercialId) !== Number(comercialIdAutenticado)) {
        return res.status(403).render('error', { error: 'Acceso denegado', message: 'No tienes permiso para ver este cliente.' });
      }
    }

    const payload = {
      Id_Cliente: clienteId,
      Id_Contacto: req.body.Id_Contacto ? Number(req.body.Id_Contacto) : null,
      Alias: (req.body.Alias || '').trim() || null,
      Nombre_Destinatario: (req.body.Nombre_Destinatario || '').trim() || null,
      Direccion: (req.body.Direccion || '').trim() || null,
      Direccion2: (req.body.Direccion2 || '').trim() || null,
      Poblacion: (req.body.Poblacion || '').trim() || null,
      CodigoPostal: (req.body.CodigoPostal || '').trim() || null,
      Id_Provincia: req.body.Id_Provincia ? Number(req.body.Id_Provincia) : null,
      Telefono: (req.body.Telefono || '').trim() || null,
      Movil: (req.body.Movil || '').trim() || null,
      Email: (req.body.Email || '').trim() || null,
      Observaciones: (req.body.Observaciones || '').trim() || null,
      Es_Principal: String(req.body.Es_Principal || '0') === '1' ? 1 : 0,
      Activa: (req.body.Activa === undefined) ? 1 : (String(req.body.Activa) === '1' ? 1 : 0)
    };

    const creado = await crm.createDireccionEnvio(payload);
    const newId = creado?.insertId || null;
    const returnToRaw = (req.body.returnTo || req.query.returnTo || '').toString().trim();
    const returnTo = (returnToRaw.startsWith('/dashboard/pedidos') ? returnToRaw : '');
    if (returnTo && newId) {
      const sep = returnTo.includes('?') ? '&' : '?';
      return res.redirect(`${returnTo}${sep}restoreDraft=1&envio_diferente=1&direccion_envio_id=${encodeURIComponent(String(newId))}`);
    }
    res.redirect(`/dashboard/clientes/${clienteId}/direcciones-envio?success=creada`);
  } catch (error) {
    console.error('❌ Error creando dirección de envío:', error);
    const msg = String(error?.sqlMessage || error?.message || 'Error desconocido');
    const code = String(error?.code || '');
    const hint =
      (code === 'ER_NO_SUCH_TABLE' || /doesn\'t exist/i.test(msg))
        ? 'No existe la tabla direccionesEnvio. Ejecuta el script scripts/crear-direcciones-envio.sql en la BD de producción.'
        : (code === 'ER_DUP_ENTRY'
          ? 'Ya existe una dirección marcada como principal activa para este cliente. Desmarca “principal” o edita la existente.'
          : null);
    const details = hint ? `${hint} (${code || 'ERR'}: ${msg})` : `${code || 'ERR'}: ${msg}`;
    res.redirect(`/dashboard/clientes/${req.params.id}/direcciones-envio?error=crear&details=${encodeURIComponent(details)}`);
  }
});

app.get('/dashboard/clientes/:id/direcciones-envio/:direccionId/editar', requireAuth, async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const direccionId = Number(req.params.direccionId);
    if (!Number.isFinite(clienteId) || clienteId <= 0) throw new Error('clienteId inválido');
    if (!Number.isFinite(direccionId) || direccionId <= 0) throw new Error('direccionId inválido');

    const cliente = await crm.getClienteById(clienteId);
    if (!cliente) return res.status(404).render('error', { error: 'Cliente no encontrado', message: 'El cliente no existe' });

    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    if (!esAdmin && comercialIdAutenticado) {
      const clienteComercialId = cliente.Id_Cial || cliente.id_Cial || cliente.Comercial_id || cliente.comercial_id;
      if (Number(clienteComercialId) !== Number(comercialIdAutenticado)) {
        return res.status(403).render('error', { error: 'Acceso denegado', message: 'No tienes permiso para ver este cliente.' });
      }
    }

    const direccion = await crm.getDireccionEnvioById(direccionId);
    if (!direccion || Number(direccion.Id_Cliente) !== Number(clienteId)) {
      return res.status(404).render('error', { error: 'Dirección no encontrada', message: 'La dirección no existe' });
    }

    const [provincias, contactosCliente] = await Promise.all([
      crm.getProvincias().catch(() => []),
      crm.getContactosByCliente(clienteId, { includeHistorico: false }).catch(() => [])
    ]);

    const returnToRaw = (req.query.returnTo || '').toString().trim();
    const returnTo = (returnToRaw.startsWith('/dashboard/pedidos') ? returnToRaw : '');

    res.render('dashboard/cliente-direccion-envio-form', {
      title: `Editar dirección de envío - Cliente #${clienteId}`,
      heading: 'Editar dirección',
      user: req.comercial || req.session?.comercial || req.user || null,
      cliente: normalizeObjectUTF8(cliente),
      provincias,
      contactosCliente,
      values: direccion,
      action: `/dashboard/clientes/${clienteId}/direcciones-envio/${direccionId}`,
      returnTo,
      error: null
    });
  } catch (error) {
    console.error('❌ Error cargando edición de dirección de envío:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar la dirección' });
  }
});

app.post('/dashboard/clientes/:id/direcciones-envio/:direccionId', requireAuth, async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const direccionId = Number(req.params.direccionId);
    if (!Number.isFinite(clienteId) || clienteId <= 0) throw new Error('clienteId inválido');
    if (!Number.isFinite(direccionId) || direccionId <= 0) throw new Error('direccionId inválido');

    const cliente = await crm.getClienteById(clienteId);
    if (!cliente) return res.status(404).render('error', { error: 'Cliente no encontrado', message: 'El cliente no existe' });

    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    if (!esAdmin && comercialIdAutenticado) {
      const clienteComercialId = cliente.Id_Cial || cliente.id_Cial || cliente.Comercial_id || cliente.comercial_id;
      if (Number(clienteComercialId) !== Number(comercialIdAutenticado)) {
        return res.status(403).render('error', { error: 'Acceso denegado', message: 'No tienes permiso para ver este cliente.' });
      }
    }

    const payload = {
      Id_Contacto: req.body.Id_Contacto ? Number(req.body.Id_Contacto) : null,
      Alias: (req.body.Alias || '').trim() || null,
      Nombre_Destinatario: (req.body.Nombre_Destinatario || '').trim() || null,
      Direccion: (req.body.Direccion || '').trim() || null,
      Direccion2: (req.body.Direccion2 || '').trim() || null,
      Poblacion: (req.body.Poblacion || '').trim() || null,
      CodigoPostal: (req.body.CodigoPostal || '').trim() || null,
      Id_Provincia: req.body.Id_Provincia ? Number(req.body.Id_Provincia) : null,
      Telefono: (req.body.Telefono || '').trim() || null,
      Movil: (req.body.Movil || '').trim() || null,
      Email: (req.body.Email || '').trim() || null,
      Observaciones: (req.body.Observaciones || '').trim() || null,
      Es_Principal: String(req.body.Es_Principal || '0') === '1' ? 1 : 0,
      Activa: (req.body.Activa === undefined) ? 1 : (String(req.body.Activa) === '1' ? 1 : 0)
    };

    await crm.updateDireccionEnvio(direccionId, payload);
    const returnToRaw = (req.body.returnTo || req.query.returnTo || '').toString().trim();
    const returnTo = (returnToRaw.startsWith('/dashboard/pedidos') ? returnToRaw : '');
    if (returnTo) {
      const sep = returnTo.includes('?') ? '&' : '?';
      return res.redirect(`${returnTo}${sep}restoreDraft=1&envio_diferente=1&direccion_envio_id=${encodeURIComponent(String(direccionId))}`);
    }
    res.redirect(`/dashboard/clientes/${clienteId}/direcciones-envio?success=actualizada`);
  } catch (error) {
    console.error('❌ Error actualizando dirección de envío:', error);
    const msg = String(error?.sqlMessage || error?.message || 'Error desconocido');
    const code = String(error?.code || '');
    const details = `${code || 'ERR'}: ${msg}`;
    res.redirect(`/dashboard/clientes/${req.params.id}/direcciones-envio?error=actualizar&details=${encodeURIComponent(details)}`);
  }
});

app.post('/dashboard/clientes/:id/direcciones-envio/:direccionId/desactivar', requireAuth, async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const direccionId = Number(req.params.direccionId);
    if (!Number.isFinite(clienteId) || clienteId <= 0) throw new Error('clienteId inválido');
    if (!Number.isFinite(direccionId) || direccionId <= 0) throw new Error('direccionId inválido');

    const cliente = await crm.getClienteById(clienteId);
    if (!cliente) return res.status(404).render('error', { error: 'Cliente no encontrado', message: 'El cliente no existe' });

    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    if (!esAdmin && comercialIdAutenticado) {
      const clienteComercialId = cliente.Id_Cial || cliente.id_Cial || cliente.Comercial_id || cliente.comercial_id;
      if (Number(clienteComercialId) !== Number(comercialIdAutenticado)) {
        return res.status(403).render('error', { error: 'Acceso denegado', message: 'No tienes permiso para ver este cliente.' });
      }
    }

    // Si está enlazada a pedidos, igualmente desactivamos (ON DELETE SET NULL no aplica a soft delete).
    await crm.desactivarDireccionEnvio(direccionId);
    res.redirect(`/dashboard/clientes/${clienteId}/direcciones-envio?success=desactivada`);
  } catch (error) {
    console.error('❌ Error desactivando dirección de envío:', error);
    const msg = String(error?.sqlMessage || error?.message || 'Error desconocido');
    const code = String(error?.code || '');
    const details = `${code || 'ERR'}: ${msg}`;
    res.redirect(`/dashboard/clientes/${req.params.id}/direcciones-envio?error=desactivar&details=${encodeURIComponent(details)}`);
  }
});

app.post('/dashboard/clientes/:id/contactos/vincular', requireAuth, async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const contactoId = Number(req.body.contactoId);
    if (!Number.isFinite(clienteId) || clienteId <= 0) throw new Error('clienteId inválido');
    if (!Number.isFinite(contactoId) || contactoId <= 0) throw new Error('contactoId inválido');

    const options = {
      Rol: (req.body.Rol || '').trim() || null,
      Notas: (req.body.Notas || '').trim() || null,
      Es_Principal: String(req.body.Es_Principal || '0') === '1'
    };

    await crm.vincularContactoACliente(clienteId, contactoId, options);
    res.redirect(`/dashboard/clientes/${clienteId}/contactos?success=vinculo_creado`);
  } catch (error) {
    console.error('❌ Error vinculando contacto a cliente (dashboard):', error);
    res.redirect(`/dashboard/clientes/${req.params.id}/contactos?error=vinculo_error`);
  }
});

app.post('/dashboard/clientes/:id/contactos/:contactoId/cerrar', requireAuth, async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const contactoId = Number(req.params.contactoId);
    if (!Number.isFinite(clienteId) || clienteId <= 0) throw new Error('clienteId inválido');
    if (!Number.isFinite(contactoId) || contactoId <= 0) throw new Error('contactoId inválido');

    await crm.cerrarVinculoContactoCliente(clienteId, contactoId, { MotivoBaja: null });
    res.redirect(`/dashboard/clientes/${clienteId}/contactos?success=vinculo_cerrado`);
  } catch (error) {
    console.error('❌ Error cerrando vínculo (dashboard):', error);
    res.redirect(`/dashboard/clientes/${req.params.id}/contactos?error=cerrar_error`);
  }
});

// Ruta para ver detalle de cliente (DEBE estar DESPUÉS de todas las rutas específicas)
app.get('/dashboard/clientes/:id', requireAuth, async (req, res, next) => {
  try {
    // Verificar que no sea una ruta específica (protección adicional)
    const idParam = req.params.id;
    if (idParam === 'duplicados' || idParam === 'nuevo') {
      console.log(`⚠️ [CLIENTES/:id] Se intentó acceder a ruta específica a través de ruta genérica: ${idParam}`);
      return next(); // Pasar al siguiente handler (pero no debería llegar aquí)
    }
    
    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    
    const cliente = await crm.getClienteById(idParam);
    if (!cliente) {
      return res.status(404).render('error', { error: 'Cliente no encontrado', message: 'El cliente no existe' });
    }
    
    // Si no es admin, verificar que el cliente pertenezca al comercial autenticado
    if (!esAdmin && comercialIdAutenticado) {
      const clienteComercialId = cliente.Id_Cial || cliente.id_Cial || cliente.Comercial_id || cliente.comercial_id;
      if (Number(clienteComercialId) !== Number(comercialIdAutenticado)) {
        return res.status(403).render('error', {
          error: 'Acceso denegado',
          message: 'No tienes permiso para ver este cliente.'
        });
      }
    }
    
    const userForView =
      req.comercial ||
      req.session?.comercial ||
      req.user ||
      {};

    const viewData = {
      title: `Cliente #${req.params.id} - Detalle`,
      user: userForView,
      currentPage: 'clientes',
      cliente: normalizeObjectUTF8(cliente),
      error: null,
      query: req.query
    };

    // Importante: los errores de EJS/render pueden llegar por callback (no se capturan con try/catch).
    res.render('dashboard/cliente-detalle', viewData, (renderErr, html) => {
      if (renderErr) {
        console.error('❌ [CLIENTE DETALLE] Error renderizando EJS:', renderErr.message);
        console.error('❌ [CLIENTE DETALLE] Stack:', renderErr.stack);
        return res.status(500).render('error', {
          error: 'Error interno del servidor',
          message: 'Algo salió mal. Por favor, contacta al administrador.'
        });
      }
      return res.send(html);
    });
  } catch (error) {
    console.error('Error cargando detalle de cliente:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el cliente' });
  }
});

// Crear nuevo cliente
// Función para verificar si existe un cliente similar antes de crear
async function verificarClienteExistente(payload) {
  try {
    const clientes = await crm.getClientes();
    const posiblesDuplicados = [];
    
    const dniCif = normalizarTexto(payload.DNI_CIF || '');
    const nombre = normalizarTexto(payload.Nombre_Razon_Social || '');
    const direccion = normalizarTexto(payload.Direccion || '');
    const telefono = normalizarTexto(payload.Telefono || payload.Movil || '');
    const email = normalizarTexto(payload.Email || '');
    
    for (const cliente of clientes) {
      let coincidencias = [];
      
      // Verificar DNI/CIF (coincidencia exacta)
      if (dniCif && dniCif.length > 3) {
        const clienteDNI = normalizarTexto(cliente.DNI_CIF || cliente.dni_cif || '');
        if (clienteDNI === dniCif && clienteDNI.length > 3) {
          coincidencias.push({ campo: 'DNI/CIF', valor: cliente.DNI_CIF || cliente.dni_cif });
        }
      }
      
      // Verificar Nombre + Dirección
      if (nombre && direccion && nombre.length > 3 && direccion.length > 5) {
        const clienteNombre = normalizarTexto(cliente.Nombre_Razon_Social || cliente.Nombre || '');
        const clienteDireccion = normalizarTexto(cliente.Direccion || cliente.direccion || '');
        if (clienteNombre === nombre && clienteDireccion === direccion && clienteDireccion.length > 5) {
          coincidencias.push({ campo: 'Nombre + Dirección', valor: `${cliente.Nombre_Razon_Social || cliente.Nombre} - ${cliente.Direccion || cliente.direccion}` });
        }
      }
      
      // Verificar Nombre + Email
      if (nombre && email && nombre.length > 3 && email.length > 5) {
        const clienteNombre = normalizarTexto(cliente.Nombre_Razon_Social || cliente.Nombre || '');
        const clienteEmail = normalizarTexto(cliente.Email || cliente.email || '');
        if (clienteNombre === nombre && clienteEmail === email && clienteEmail.length > 5) {
          coincidencias.push({ campo: 'Nombre + Email', valor: `${cliente.Nombre_Razon_Social || cliente.Nombre} - ${cliente.Email || cliente.email}` });
        }
      }
      
      // Verificar Nombre + Teléfono
      if (nombre && telefono && nombre.length > 3 && telefono.length > 5) {
        const clienteNombre = normalizarTexto(cliente.Nombre_Razon_Social || cliente.Nombre || '');
        const clienteTelefono = normalizarTexto(cliente.Telefono || cliente.telefono || cliente.Movil || cliente.movil || '');
        if (clienteNombre === nombre && clienteTelefono === telefono && clienteTelefono.length > 5) {
          coincidencias.push({ campo: 'Nombre + Teléfono', valor: `${cliente.Nombre_Razon_Social || cliente.Nombre} - ${cliente.Telefono || cliente.telefono || cliente.Movil || cliente.movil}` });
        }
      }
      
      // Si hay coincidencias, añadir a la lista
      if (coincidencias.length > 0) {
        posiblesDuplicados.push({
          cliente: cliente,
          coincidencias: coincidencias
        });
      }
    }
    
    return posiblesDuplicados;
  } catch (error) {
    console.error('❌ [VERIFICAR DUPLICADO] Error:', error);
    return [];
  }
}

// Endpoint para verificar duplicados antes de crear
app.post('/dashboard/clientes/verificar-duplicado', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [VERIFICAR DUPLICADO] Verificando duplicados para nuevo cliente');
    
    // Mapear campos del formulario (mismo mapeo que en crear cliente)
    const payload = {};
    const fieldMapping = {
      'Nombre_Razon_Social': 'Nombre_Razon_Social',
      'DNI_CIF': 'DNI_CIF',
      'Direccion': 'Direccion',
      'Telefono': 'Telefono',
      'Movil': 'Movil',
      'Email': 'Email'
    };
    
    for (const [formField, dbField] of Object.entries(fieldMapping)) {
      if (req.body[formField] !== undefined && req.body[formField] !== null && req.body[formField] !== '') {
        let value = typeof req.body[formField] === 'string' ? req.body[formField].trim() : req.body[formField];
        // Para detectar duplicados, tratamos "Pendiente" como ausencia de DNI/CIF.
        if (formField === 'DNI_CIF' && (value === '' || value.toLowerCase() === 'pendiente')) {
          value = null;
        }
        payload[dbField] = value;
      }
    }
    
    const duplicados = await verificarClienteExistente(payload);
    
    if (duplicados.length > 0) {
      return res.json({
        duplicado: true,
        message: 'Ya existe un cliente similar en la base de datos',
        clientes: duplicados.map(d => ({
          id: d.cliente.Id || d.cliente.id,
          nombre: d.cliente.Nombre_Razon_Social || d.cliente.Nombre,
          dni_cif: d.cliente.DNI_CIF || d.cliente.dni_cif,
          direccion: d.cliente.Direccion || d.cliente.direccion,
          poblacion: d.cliente.Poblacion || d.cliente.poblacion,
          provincia: d.cliente.Provincia || d.cliente.provincia || d.cliente.Nombre_Provincia || d.cliente.nombre_provincia,
          codigo_postal: d.cliente.CodigoPostal || d.cliente.Codigo_Postal || d.cliente.codigo_postal,
          telefono: d.cliente.Telefono || d.cliente.telefono || d.cliente.Movil || d.cliente.movil,
          email: d.cliente.Email || d.cliente.email,
          coincidencias: d.coincidencias
        }))
      });
    }
    
    return res.json({ duplicado: false });
  } catch (error) {
    console.error('❌ [VERIFICAR DUPLICADO] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/dashboard/clientes/nuevo', requireAuth, async (req, res) => {
  try {
    console.log('📝 [CREAR CLIENTE] Iniciando creación:', { body: req.body });

    const esAdmin = getUserIsAdmin(req);
    const comercialIdAutenticado = getComercialId(req);
    
    // Mapear campos del formulario a los nombres reales en la base de datos
    const payload = {};
    
    // Mapeo de campos: { campoFormulario: nombreEnBD }
    const fieldMapping = {
      'Nombre_Razon_Social': 'Nombre_Razon_Social',
      'Nombre_Cial': 'Nombre_Cial',
      'DNI_CIF': 'DNI_CIF',
      'NumeroFarmacia': 'NumeroFarmacia',
      'Id_Cial': 'Id_Cial',
      'Email': 'Email',
      'Telefono': 'Telefono',
      'Movil': 'Movil',
      'Direccion': 'Direccion',
      'Poblacion': 'Poblacion',
      'Id_Provincia': 'Id_Provincia',
      'CodigoPostal': 'CodigoPostal',
      'Id_Pais': 'Id_Pais',
      'CodPais': 'CodPais',
      'Id_Idioma': 'Id_Idioma',
      'Id_Moneda': 'Id_Moneda',
      'Id_FormaPago': 'Id_FormaPago',
      'Id_TipoCliente': 'Id_TipoCliente',
      'Tarifa': 'Tarifa',
      'Dto': 'Dto',
      'RE': 'RE',
      'CuentaContable': 'CuentaContable',
      'Banco': 'Banco',
      'Swift': 'Swift',
      'IBAN': 'IBAN'
    };
    
    // Mapear campos del formulario
    for (const [formField, dbField] of Object.entries(fieldMapping)) {
      if (req.body[formField] !== undefined && req.body[formField] !== null && req.body[formField] !== '') {
        const rawValue = req.body[formField];
        let value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
        
        // Especial para DNI_CIF: si viene vacío o "Pendiente", guardar como "Pendiente"
        if (formField === 'DNI_CIF') {
          if (typeof rawValue === 'string' && (rawValue.trim() === '' || rawValue.trim().toLowerCase() === 'pendiente')) {
            value = 'Pendiente';
          }
        }

        // NumeroFarmacia: en producción suele tener UNIQUE. Guardar NULL si viene vacío para permitir múltiples "sin número".
        if (formField === 'NumeroFarmacia') {
          if (typeof rawValue === 'string' && rawValue.trim() === '') {
            value = null;
          }
        }
        
        // Convertir campos numéricos
        // Nota: Tarifa en producción suele ser INT (0 = PVL/base). Si viene vacío, usar 0.
        if (formField.startsWith('Id_') || formField === 'Dto' || formField === 'RE' || formField === 'CuentaContable' || formField === 'Tarifa') {
          if (formField === 'Tarifa' && (value === null || value === undefined || value === '')) {
            value = 0;
          } else {
            value = value !== null && value !== undefined && value !== '' ? Number(String(value).replace(',', '.')) : null;
          }
        }
        
        payload[dbField] = value;
      }
    }

    // Contacto por defecto (opcional)
    const contactoDefaultId = Number(req.body.Id_Contacto_Default || 0);
    let contactoDefault = null;
    if (Number.isFinite(contactoDefaultId) && contactoDefaultId > 0) {
      contactoDefault = await crm.getContactoById(contactoDefaultId).catch(() => null);
      if (contactoDefault) {
        const nombre = String(contactoDefault.Nombre || '').trim();
        const apellidos = String(contactoDefault.Apellidos || '').trim();
        const display = `${nombre}${apellidos ? ` ${apellidos}` : ''}`.trim();
        if (display) payload.NomContacto = display; // campo legacy en clientes
      }
    }

    // Asignación automática: si es Comercial, forzar Id_Cial al comercial logueado (ignorar el formulario).
    if (!esAdmin) {
      const comId = parseInt(String(comercialIdAutenticado || ''), 10);
      if (!Number.isFinite(comId) || comId <= 0) {
        return res.status(400).render('error', {
          error: 'Error de validación',
          message: 'No se pudo determinar el comercial logueado para asignar el cliente.'
        });
      }
      payload.Id_Cial = comId;
      console.log(`🔐 [CREAR CLIENTE] Comercial: asignando automáticamente Id_Cial=${comId}`);
    }
    
    // Manejar OK_KO (Estado) - validar y convertir valor a 1 (Activo) o 0 (Inactivo)
    // OK_KO es el campo que determina si un cliente está activo o no
    if (req.body.OK_KO !== undefined && req.body.OK_KO !== null && req.body.OK_KO !== '') {
      const val = req.body.OK_KO;
      let okKoValue = 1; // Por defecto activo
      
      if (typeof val === 'string') {
        const valLower = val.toLowerCase().trim();
        // Validar que solo acepte valores válidos: "activo", "inactivo", "ok", "ko", "1", "0", "true", "false"
        if (!['activo', 'inactivo', 'ok', 'ko', '1', '0', 'true', 'false'].includes(valLower)) {
          return res.status(400).render('error', {
            error: 'Error de validación',
            message: `El campo Estado (OK_KO) solo puede ser "Activo" o "Inactivo". Valor recibido: "${val}"`
          });
        }
        okKoValue = (valLower === 'activo' || valLower === 'ok' || valLower === 'true' || valLower === '1') ? 1 : 0;
      } else if (typeof val === 'boolean') {
        okKoValue = val ? 1 : 0;
      } else if (typeof val === 'number') {
        // Validar que solo sea 0 o 1
        if (val !== 0 && val !== 1) {
          return res.status(400).render('error', {
            error: 'Error de validación',
            message: `El campo Estado (OK_KO) solo puede ser 1 (Activo) o 0 (Inactivo). Valor recibido: ${val}`
          });
        }
        okKoValue = val;
      } else {
        return res.status(400).render('error', {
          error: 'Error de validación',
          message: `El campo Estado (OK_KO) tiene un formato inválido. Valor recibido: ${val} (tipo: ${typeof val})`
        });
      }
      
      console.log('🔄 [OK_KO/Estado] Conversión:', { valorRecibido: req.body.OK_KO, valorEnviado: okKoValue });
      payload['OK_KO'] = okKoValue;
    } else {
      // Por defecto activo si no se especifica
      payload['OK_KO'] = 1;
    }
    
    // Manejar Modelo_347 (solo para modelo contable, no para estado)
    if (req.body.Modelo_347 !== undefined && req.body.Modelo_347 !== null && req.body.Modelo_347 !== '') {
      const val = req.body.Modelo_347;
      let modelo347Value = 1; // Por defecto
      
      if (typeof val === 'string') {
        const valLower = val.toLowerCase().trim();
        modelo347Value = (valLower === 'activo' || valLower === 'ok' || valLower === 'true' || valLower === '1') ? 1 : 0;
      } else if (typeof val === 'boolean') {
        modelo347Value = val ? 1 : 0;
      } else if (typeof val === 'number') {
        modelo347Value = (val === 0 || val === 1) ? val : 1;
      }
      
      payload['Modelo_347'] = modelo347Value;
    }
    
    // Validar campos requeridos
    if (!payload.Nombre_Razon_Social) {
      return res.status(400).render('error', {
        error: 'Error de validación',
        message: 'El nombre/razón social es obligatorio'
      });
    }
    
    if (!payload.Id_Cial) {
      return res.status(400).render('error', {
        error: 'Error de validación',
        message: 'El comercial es obligatorio'
      });
    }
    
    console.log('📦 [CREAR CLIENTE] Payload a enviar:', JSON.stringify(payload, null, 2));
    
    // Verificar si existe un cliente similar antes de crear (solo si no se fuerza la creación)
    if (!req.body.forzar_creacion) {
      console.log('🔍 [CREAR CLIENTE] Verificando duplicados...');
      const duplicados = await verificarClienteExistente(payload);
      
      if (duplicados.length > 0) {
      console.log(`⚠️ [CREAR CLIENTE] Se encontraron ${duplicados.length} cliente(s) similar(es)`);
      
      // Si es una petición AJAX (esperando JSON), devolver JSON
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(409).json({
          duplicado: true,
          message: 'Ya existe un cliente similar en la base de datos',
          clientes: duplicados.map(d => ({
            id: d.cliente.Id || d.cliente.id,
            nombre: d.cliente.Nombre_Razon_Social || d.cliente.Nombre,
            dni_cif: d.cliente.DNI_CIF || d.cliente.dni_cif,
            direccion: d.cliente.Direccion || d.cliente.direccion,
            poblacion: d.cliente.Poblacion || d.cliente.poblacion,
            provincia: d.cliente.Provincia || d.cliente.provincia || d.cliente.Nombre_Provincia || d.cliente.nombre_provincia,
            codigo_postal: d.cliente.CodigoPostal || d.cliente.Codigo_Postal || d.cliente.codigo_postal,
            telefono: d.cliente.Telefono || d.cliente.telefono || d.cliente.Movil || d.cliente.movil,
            email: d.cliente.Email || d.cliente.email,
            coincidencias: d.coincidencias
          }))
        });
      }
      
      // Si no es AJAX, renderizar formulario con error
      const provincias = await crm.getProvincias();
      const paises = await crm.getPaises();
      // Normalizar nombres de países antes de pasarlos a la vista
      const paisesNormalizados = paises ? paises.map(p => ({ ...p, Nombre_pais: normalizeUTF8(p.Nombre_pais || '') })) : [];
      
      const tiposClientes = await crm.query('SELECT id, Tipo FROM tipos_clientes').catch(() => []);
      const formasPago = await crm.getFormasPago();
      const idiomas = await crm.query('SELECT id, Nombre AS Idioma FROM idiomas').catch(() => []);
      const monedas = await crm.query('SELECT id, Nombre AS Moneda FROM monedas').catch(() => []);
      const comerciales = await crm.getComerciales().catch(() => []);
      
      return res.render('dashboard/cliente-editar', {
        title: 'Nuevo Cliente - Farmadescaso',
        user: req.comercial || req.session.comercial,
        cliente: null,
        provincias: provincias || [],
        paises: paisesNormalizados,
        cooperativasCliente: [],
        tiposClientes: tiposClientes || [],
        formasPago: formasPago || [],
        idiomas: idiomas || [],
        monedas: monedas || [],
        comerciales: comerciales || [],
        isNew: true,
        error: `⚠️ Ya existe un cliente similar en la base de datos. Por favor, revisa los datos antes de continuar.`,
        duplicados: duplicados.map(d => d.cliente),
        formData: req.body // Pasar los datos del formulario para mantenerlos
      });
      }
    }
    
    const nuevoCliente = await crm.createCliente(payload);
    console.log('✅ [CREAR CLIENTE] Cliente creado exitosamente:', nuevoCliente);
    
    const clienteId = nuevoCliente.insertId || nuevoCliente.Id || nuevoCliente.id;
    
    if (!clienteId) {
      console.error('❌ [CREAR CLIENTE] No se pudo obtener el ID del cliente creado:', nuevoCliente);
      throw new Error('No se pudo obtener el ID del cliente creado');
    }
    
    console.log(`✅ [CREAR CLIENTE] Redirigiendo a cliente ID: ${clienteId}`);

    // Vincular como contacto principal (mismo tratamiento que direccionesEnvio: opcional)
    if (contactoDefault && clienteId) {
      try {
        await crm.vincularContactoACliente(Number(clienteId), Number(contactoDefaultId), { Es_Principal: true });
      } catch (e) {
        console.warn('⚠️ [CREAR CLIENTE] No se pudo vincular contacto por defecto:', e?.message || e);
      }
    }
    res.redirect(`/dashboard/clientes/${clienteId}?success=cliente_creado`);
  } catch (error) {
    console.error('❌ [CREAR CLIENTE] Error completo:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    
    // Intentar recargar el formulario con los datos y el error
    try {
      const provincias = await crm.getProvincias();
      const paises = await crm.getPaises();
      // Normalizar nombres de países antes de pasarlos a la vista
      const paisesNormalizados = paises ? paises.map(p => ({ ...p, Nombre_pais: normalizeUTF8(p.Nombre_pais || '') })) : [];
      
      const tiposClientes = await crm.query('SELECT id, Tipo FROM tipos_clientes').catch(() => []);
      const formasPago = await crm.getFormasPago();
      const idiomas = await crm.query('SELECT id, Nombre AS Idioma FROM idiomas').catch(() => []);
      const monedas = await crm.query('SELECT id, Nombre AS Moneda FROM monedas').catch(() => []);
      const comerciales = await crm.getComerciales().catch(() => []);
      
      const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
      const errorMessage = (process.env.NODE_ENV === 'development' || isLocalhost)
        ? `Error al crear cliente: ${error.message}` 
        : 'No se pudo crear el cliente. Por favor, verifica los datos e intenta nuevamente.';
      
      res.render('dashboard/cliente-editar', {
        title: 'Nuevo Cliente - Farmadescaso',
        user: req.comercial || req.session?.comercial || req.user || {},
        cliente: null,
        provincias: provincias || [],
        paises: paisesNormalizados,
        cooperativasCliente: [],
        tiposClientes: tiposClientes || [],
        formasPago: formasPago || [],
        idiomas: idiomas || [],
        monedas: monedas || [],
        comerciales: comerciales || [],
        isNew: true,
        error: errorMessage
      });
    } catch (renderError) {
      console.error('❌ [CREAR CLIENTE] Error al renderizar formulario de error:', renderError);
      res.status(500).render('error', {
        error: 'Error interno del servidor',
        message: `No se pudo crear el cliente: ${error.message}` 
      });
    }
  }
});

// Guardar edición de cliente
app.post('/dashboard/clientes/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    console.log('📝 [GUARDAR CLIENTE] Iniciando actualización:', { id, body: req.body });
    
    // Primero obtener el cliente para ver su estructura real
    const clienteExistente = await crm.getClienteById(id);
    if (!clienteExistente) {
      return res.status(404).render('error', { 
        error: 'Cliente no encontrado', 
        message: 'El cliente no existe' 
      });
    }
    
    console.log('🔍 [GUARDAR CLIENTE] Cliente existente - Campos disponibles:', Object.keys(clienteExistente));
    
    // Mapear campos del formulario a los nombres reales en la base de datos
    // Probar diferentes variantes de nombres de campos
    const payload = {};
    
    // Mapeo de campos: { campoFormulario: [posiblesNombresEnBD] }
    const fieldMapping = {
      'Nombre': ['Nombre_Razon_Social', 'Nombre_RazonSocial', 'Nombre', 'nombre', 'Name', 'name'],
      'Nombre_Razon_Social': ['Nombre_Razon_Social', 'Nombre_RazonSocial', 'Nombre', 'nombre', 'Name', 'name'],
      'Nombre_Cial': ['Nombre_Cial', 'NombreCial', 'nombre_cial', 'nombreCial'],
      'DNI_CIF': ['DNI_CIF', 'DNI/CIF', 'dni_cif', 'DniCif', 'DNI', 'dni'],
      'NumeroFarmacia': ['NumeroFarmacia', 'Numero Farmacia', 'numeroFarmacia', 'numero_farmacia'],
      'Id_Cial': ['Id_Cial', 'id_Cial', 'IdCial', 'idCial', 'ComercialId', 'comercialId'],
      'Email': ['Email', 'email', 'E-mail', 'e-mail'],
      'Telefono': ['Telefono', 'Teléfono', 'telefono', 'teléfono', 'Phone', 'phone'],
      'Movil': ['Movil', 'Móvil', 'movil', 'móvil', 'Mobile', 'mobile'],
      'NomContacto': ['NomContacto', 'Nom Contacto', 'nomContacto', 'nom_contacto', 'Contacto', 'contacto'],
      'Direccion': ['Direccion', 'Dirección', 'direccion', 'dirección', 'Address', 'address'],
      'Poblacion': ['Poblacion', 'Población', 'poblacion', 'población', 'City', 'city'],
      'Id_Provincia': ['Id_Provincia', 'id_Provincia', 'IdProvincia', 'idProvincia', 'Provincia_id', 'provincia_id'],
      'CodigoPostal': ['CodigoPostal', 'Código Postal', 'codigoPostal', 'codigo_postal', 'PostalCode', 'postal_code'],
      'Pais': ['Pais', 'País', 'pais', 'país', 'Country', 'country'],
      'CodPais': ['CodPais', 'Cod País', 'Código País', 'codPais', 'cod_pais', 'CountryCode', 'countryCode'],
      'Id_Pais': ['Id_Pais', 'id_Pais', 'IdPais', 'idPais', 'PaisId', 'paisId'],
      'Id_Idioma': ['Id_Idioma', 'id_Idioma', 'IdIdioma', 'idIdioma', 'IdiomaId', 'idiomaId'],
      'Id_Moneda': ['Id_Moneda', 'id_Moneda', 'IdMoneda', 'idMoneda', 'MonedaId', 'monedaId'],
      'Id_FormaPago': ['Id_FormaPago', 'id_FormaPago', 'IdFormaPago', 'idFormaPago', 'FormaPagoId', 'formaPagoId'],
      'Id_TipoCliente': ['Id_TipoCliente', 'id_TipoCliente', 'IdTipoCliente', 'idTipoCliente', 'TipoClienteId', 'tipoClienteId'],
      'Tarifa': ['Tarifa', 'tarifa', 'Rate', 'rate'],
      'Dto': ['Dto', 'dto', 'Descuento', 'descuento', 'Discount', 'discount'],
      'RE': ['RE', 're', 'Retencion', 'retencion', 'Retention', 'retention'],
      'CuentaContable': ['CuentaContable', 'Cuenta Contable', 'cuentaContable', 'cuenta_contable', 'Account', 'account'],
      'Banco': ['Banco', 'banco', 'Bank', 'bank'],
      'Swift': ['Swift', 'swift', 'BIC', 'bic'],
      'IBAN': ['IBAN', 'iban', 'Iban']
    };
    
    // Mapear campos del formulario a los nombres reales
    for (const [formField, dbFieldVariants] of Object.entries(fieldMapping)) {
      if (req.body[formField] !== undefined && req.body[formField] !== null) {
        const rawValue = req.body[formField];
        let value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
        // Nota (producción): varios campos de texto pueden ser NOT NULL (p.ej. DNI_CIF en algunos esquemas).
        // Para evitar ER_BAD_NULL_ERROR, en edición no usamos NULL para strings vacíos.
        // Especial para DNI_CIF: si viene vacío o "Pendiente", guardar "Pendiente"
        if (formField === 'DNI_CIF') {
          if (typeof rawValue === 'string' && (rawValue.trim() === '' || rawValue.trim().toLowerCase() === 'pendiente')) {
            value = 'Pendiente';
          }
        } else if (formField === 'NumeroFarmacia') {
          // NumeroFarmacia: puede tener UNIQUE; usar NULL cuando está vacío para evitar ER_DUP_ENTRY con ''.
          if (typeof rawValue === 'string' && rawValue.trim() === '') {
            value = null;
          }
        } else if (typeof rawValue === 'string' && rawValue.trim() === '') {
          // Mantener string vacío (no NULL) para columnas VARCHAR potencialmente NOT NULL
          value = '';
        }
        
        // Buscar el nombre correcto del campo en el cliente existente
        let fieldName = null;
        for (const variant of dbFieldVariants) {
          if (clienteExistente.hasOwnProperty(variant)) {
            fieldName = variant;
            break;
          }
        }
        // Si no se encuentra, usar el nombre del formulario como fallback
        if (!fieldName) {
          fieldName = formField;
        }
        payload[fieldName] = value;
      }
    }

    // Normalizar tipos (muy importante en producción):
    // - IDs numéricos: a Number o null
    // - Decimales (Dto/RE): aceptar "0,00" -> 0.00
    const toNullableInt = (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      const s = String(v).trim();
      if (s === '') return null;
      const n = Number.parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    };
    const toNullableDecimal = (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      const s = String(v).trim();
      if (s === '') return null;
      // convertir coma decimal a punto: "0,00" -> "0.00"
      const normalized = s.replace(',', '.');
      const n = Number.parseFloat(normalized);
      return Number.isFinite(n) ? n : null;
    };

    for (const [key, value] of Object.entries(payload)) {
      // Campos ID
      if (key.startsWith('Id_') || key === 'id' || key === 'Id') {
        payload[key] = toNullableInt(value);
        continue;
      }
      // Tarifa: en producción suele ser INT; si viene vacío, usar 0 (PVL/base)
      if (key === 'Tarifa') {
        const tarifaInt = toNullableInt(value);
        payload[key] = tarifaInt === null ? 0 : tarifaInt;
        continue;
      }
      // Campos numéricos conocidos
      if (key === 'Dto' || key === 'RE') {
        payload[key] = toNullableDecimal(value);
        continue;
      }
      if (key === 'CuentaContable') {
        payload[key] = toNullableInt(value);
        continue;
      }
    }
    
    // Manejar OK_KO (Estado) - validar y convertir valor a 1 (Activo) o 0 (Inactivo)
    // OK_KO es el campo que determina si un cliente está activo o no
    if (req.body.OK_KO !== undefined && req.body.OK_KO !== null && req.body.OK_KO !== '') {
      const val = req.body.OK_KO;
      let okKoValue = 1; // Por defecto activo
      
      if (typeof val === 'string') {
        const valLower = val.toLowerCase().trim();
        // Validar que solo acepte valores válidos: "activo", "inactivo", "ok", "ko", "1", "0", "true", "false"
        if (!['activo', 'inactivo', 'ok', 'ko', '1', '0', 'true', 'false'].includes(valLower)) {
          throw new Error(`El campo Estado (OK_KO) solo puede ser "Activo" o "Inactivo". Valor recibido: "${val}"`);
        }
        okKoValue = (valLower === 'activo' || valLower === 'ok' || valLower === 'true' || valLower === '1') ? 1 : 0;
      } else if (typeof val === 'boolean') {
        okKoValue = val ? 1 : 0;
      } else if (typeof val === 'number') {
        // Validar que solo sea 0 o 1
        if (val !== 0 && val !== 1) {
          throw new Error(`El campo Estado (OK_KO) solo puede ser 1 (Activo) o 0 (Inactivo). Valor recibido: ${val}`);
        }
        okKoValue = val;
      } else {
        throw new Error(`El campo Estado (OK_KO) tiene un formato inválido. Valor recibido: ${val} (tipo: ${typeof val})`);
      }
      
      console.log('🔄 [OK_KO/Estado] Conversión:', { valorRecibido: req.body.OK_KO, valorEnviado: okKoValue });
      payload['OK_KO'] = okKoValue;
    } else {
      // Por defecto activo si no se especifica
      payload['OK_KO'] = 1;
    }
    
    // Manejar Modelo_347 (solo para modelo contable, no para estado)
    if (req.body.Modelo_347 !== undefined && req.body.Modelo_347 !== null && req.body.Modelo_347 !== '') {
      const val = req.body.Modelo_347;
      let modelo347Value = 1; // Por defecto
      
      if (typeof val === 'string') {
        const valLower = val.toLowerCase().trim();
        modelo347Value = (valLower === 'activo' || valLower === 'ok' || valLower === 'true' || valLower === '1') ? 1 : 0;
      } else if (typeof val === 'boolean') {
        modelo347Value = val ? 1 : 0;
      } else if (typeof val === 'number') {
        modelo347Value = (val === 0 || val === 1) ? val : 1;
      }
      
      payload['Modelo_347'] = modelo347Value;
    }
    
    console.log('📦 [GUARDAR CLIENTE] Payload a enviar:', JSON.stringify(payload, null, 2));
    console.log('📦 [GUARDAR CLIENTE] Campos del cliente existente:', Object.keys(clienteExistente));
    
    if (Object.keys(payload).length === 0) {
      console.warn('⚠️ [GUARDAR CLIENTE] Payload vacío, no hay campos para actualizar');
      return res.render('dashboard/cliente-editar', {
        title: `Cliente #${id} - Editar`,
        user: req.comercial || req.session?.comercial || req.user || {},
        cliente: clienteExistente,
        error: 'No hay cambios para guardar',
        isNew: false
      });
    }
    
    const result = await crm.updateCliente(id, payload);
    console.log('✅ [GUARDAR CLIENTE] Cliente actualizado exitosamente:', result);
    res.redirect(`/dashboard/clientes/${id}?success=cliente_actualizado`);
  } catch (error) {
    // Log compacto y útil para Vercel (incluye info SQL si aplica)
    console.error('❌ [GUARDAR CLIENTE] Error:', {
      id: req.params.id,
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      sqlMessage: error?.sqlMessage,
      sql: error?.sql,
      stack: error?.stack
    });
    
    // Intentar obtener el cliente para mostrar el formulario con error
    try {
      const cliente = await crm.getClienteById(req.params.id);
      if (!cliente) {
        return res.status(404).render('error', { 
          error: 'Cliente no encontrado', 
          message: 'El cliente no existe o no se pudo cargar' 
        });
      }

      // Cargar datos necesarios para que la vista de edición no falle en producción
      const clienteId = req.params.id;
      const [provincias, paises, cooperativasCliente, tiposClientes, formasPago, idiomas, monedas, comerciales] = await Promise.all([
        crm.getProvincias().catch(err => { console.error('Error obteniendo provincias:', err); return []; }),
        crm.getPaises().catch(err => { console.error('Error obteniendo países:', err); return []; }),
        crm.getCooperativasByClienteId(clienteId).catch(err => { console.error('Error obteniendo cooperativas:', err); return []; }),
        crm.query('SELECT id, Tipo FROM tipos_clientes').catch(err => { console.error('Error obteniendo tipos clientes:', err); return []; }),
        crm.getFormasPago().catch(err => { console.error('Error obteniendo formas de pago:', err); return []; }),
        crm.query('SELECT id, Nombre AS Idioma FROM idiomas').catch(err => { console.error('Error obteniendo idiomas:', err); return []; }),
        crm.query('SELECT id, Nombre AS Moneda FROM monedas').catch(err => { console.error('Error obteniendo monedas:', err); return []; }),
        crm.getComerciales().catch(err => { console.error('Error obteniendo comerciales:', err); return []; })
      ]);
      const tarifasClientes = await crm.query('SELECT Id, NombreTarifa, Activa, FechaFin FROM tarifasClientes ORDER BY NombreTarifa ASC').catch(() => []);

      // Normalizar nombres de países antes de pasarlos a la vista
      const paisesNormalizados = paises ? paises.map(p => ({ ...p, Nombre_pais: normalizeUTF8(p.Nombre_pais || '') })) : [];
      
      // Mostrar error detallado:
      // - siempre en localhost/dev
      // - en producción SOLO si el usuario es admin (para depurar sin depender de logs de Vercel)
      const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
      const esAdmin = getUserIsAdmin(req);
      const shouldShowDetails = (process.env.NODE_ENV === 'development' || isLocalhost || esAdmin);
      const detailParts = [
        error?.message,
        error?.code ? `code=${error.code}` : null,
        error?.sqlMessage ? `sqlMessage=${error.sqlMessage}` : null
      ].filter(Boolean);
      const errorMessage = shouldShowDetails
        ? `Error al guardar: ${detailParts.join(' | ')}`
        : 'No se pudo guardar el cliente. Por favor, verifica los datos e intenta nuevamente.';
      
      const userForView =
        req.comercial ||
        req.session?.comercial ||
        req.user ||
        {};

      res.render('dashboard/cliente-editar', {
        title: `Cliente #${req.params.id} - Editar`,
        user: userForView,
        cliente: normalizeObjectUTF8(cliente),
        provincias: provincias || [],
        paises: paisesNormalizados,
        cooperativasCliente: cooperativasCliente ? cooperativasCliente.map(c => normalizeObjectUTF8(c)) : [],
        tiposClientes: tiposClientes || [],
        formasPago: formasPago || [],
        idiomas: idiomas || [],
        monedas: monedas || [],
        comerciales: comerciales || [],
        tarifasClientes: tarifasClientes || [],
        error: errorMessage,
        isNew: false
      });
    } catch (loadError) {
      console.error('❌ [GUARDAR CLIENTE] Error cargando cliente para mostrar formulario:', loadError);
      res.status(500).render('error', { 
        error: 'Error', 
        message: `No se pudo guardar el cliente: ${error.message}` 
      });
    }
  }
});

// API: Mover cliente a papelera (solo administradores)
// API para búsqueda inteligente de clientes
// Cache de metadatos para acelerar (evita information_schema + SHOW COLUMNS en cada pulsación)
const __clientesBuscarMetaCache = {
  loadedAt: 0,
  ttlMs: 10 * 60 * 1000, // 10 min
  tClientes: 'clientes',
  tPedidos: 'pedidos',
  clientesCols: null,
  pedidosCols: null,
  pkPrimary: 'Id',
  pkFallback: 'id',
  colComercialClientes: null,
  colTipoCliente: null,
  colProvincia: null,
  colEstadoCliente: null,
  colOkKo: null,
  colPedidoCliente: null,
  searchCols: []
};

// Schema conocido del proyecto (crm_farmadescanso)
// Usarlo como fallback cuando la introspección de columnas devuelve vacío.
const __KNOWN_CLIENTES_SCHEMA = {
  tClientes: 'clientes',
  tPedidos: 'pedidos',
  pkPrimary: 'id',
  pkFallback: 'Id',
  colComercialClientes: 'Id_Cial',
  colTipoCliente: 'Id_TipoCliente',
  colProvincia: 'Id_Provincia',
  colEstadoCliente: 'Id_EstdoCliente',
  colOkKo: 'OK_KO',
  colPedidoCliente: 'Id_Cliente',
  searchCols: [
    'Nombre_Razon_Social',
    'Nombre_Cial',
    'DNI_CIF',
    'Email',
    'Telefono',
    'Movil',
    'NumeroFarmacia',
    'Direccion',
    'Poblacion',
    'CodigoPostal',
    'NomContacto',
    'Observaciones'
  ]
};

app.get('/api/clientes/buscar', requireAuth, async (req, res) => {
  try {
    // Búsqueda en BD.
    // Nota: el schema de producción usa utf8mb4_unicode_ci (case-insensitive), así que evitamos LOWER()
    // para no inutilizar índices (p.ej. en Nombre_Razon_Social).
    const qRaw = (req.query.q || '').toString().trim();

    console.log(`🔍 [BUSCAR CLIENTES] Iniciando búsqueda: "${qRaw}"`);
    
    // Búsqueda en BD (evita cargar miles de clientes en memoria)
    const qLike = `%${qRaw}%`;
    const qPrefix = `${qRaw}%`;

    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    // Debug: permitir debug=1 para cualquier usuario autenticado (no expone datos sensibles: solo metadata y recuentos).
    const debug = String(req.query.debug || '').trim() === '1';

    // Si la query es demasiado corta, devolver vacío; en debug, incluir metadata para diagnóstico.
    if (!qRaw || qRaw.length < 2) {
      if (debug) {
        return res.json({
          clientes: [],
          debug: {
            q: qRaw,
            esAdmin,
            comercialIdAutenticado,
            reason: 'q_too_short'
          }
        });
      }
      return res.json({ clientes: [] });
    }

    // Cargar/renovar metadatos (cacheado)
    const now = Date.now();
    const cacheStale = !__clientesBuscarMetaCache.loadedAt || (now - __clientesBuscarMetaCache.loadedAt) > __clientesBuscarMetaCache.ttlMs;
    if (cacheStale) {
      // Resolver nombre real de tabla SIN depender de information_schema (en algunos hostings está restringido).
      // Estrategia: probar variantes comunes (minúsculas/Capitalizada/MAYÚSCULAS) con SHOW COLUMNS y quedarnos con la que funcione.
      const probeColumns = async (tableName) => {
        try {
          const rows = await crm.query(`SHOW COLUMNS FROM \`${tableName}\``);
          return Array.isArray(rows) ? rows : [];
        } catch (e) {
          return null; // null = no existe/no accesible
        }
      };
      const resolveTableAndColumns = async (baseName) => {
        const base = String(baseName || '').trim();
        const cap = base ? (base.charAt(0).toUpperCase() + base.slice(1)) : base;
        const upper = base ? base.toUpperCase() : base;
        const candidates = Array.from(new Set([base, cap, upper].filter(Boolean)));

        for (const cand of candidates) {
          const cols = await probeColumns(cand);
          if (cols && cols.length) {
            return { tableName: cand, colsRows: cols };
          }
        }

        // Fallback final: devolver base y columnas vacías (el endpoint seguirá respondiendo, aunque sin resultados)
        return { tableName: base || baseName, colsRows: [] };
      };

      const clientesResolved = await resolveTableAndColumns('clientes');
      const pedidosResolved = await resolveTableAndColumns('pedidos');

      const tClientes = clientesResolved.tableName;
      const tPedidos = pedidosResolved.tableName;
      const clientesColsRows = clientesResolved.colsRows || [];
      const pedidosColsRows = pedidosResolved.colsRows || [];

      const clientesCols = new Set((clientesColsRows || []).map(r => String(r.Field || r.field || '').trim()).filter(Boolean));
      const pedidosCols = new Set((pedidosColsRows || []).map(r => String(r.Field || r.field || '').trim()).filter(Boolean));
      const pickFirst = (cands, set) => (cands || []).find(c => set.has(c)) || null;

      const colComercialClientes = pickFirst(['Id_Cial', 'ComercialId', 'comercialId', 'Id_Comercial', 'id_comercial'], clientesCols);
      const colTipoCliente = pickFirst(['Id_TipoCliente', 'id_tipo_cliente', 'TipoClienteId', 'tipoClienteId'], clientesCols);
      const colProvincia = pickFirst(['Id_Provincia', 'id_provincia', 'ProvinciaId', 'provinciaId'], clientesCols);
      const colEstadoCliente = pickFirst(['Id_EstdoCliente', 'id_estdo_cliente', 'Id_EstadoCliente', 'id_estado_cliente', 'EstadoClienteId', 'estadoClienteId'], clientesCols);
      const colOkKo = pickFirst(['OK_KO', 'ok_ko'], clientesCols);
      const colPedidoCliente = pickFirst(['Id_Cliente', 'id_cliente', 'Cliente_id', 'cliente_id', 'ClienteId', 'clienteId'], pedidosCols);

      const searchCols = [
        pickFirst(['Nombre_Razon_Social', 'Nombre', 'nombre', 'RazonSocial', 'razon_social'], clientesCols),
        pickFirst(['Nombre_Cial', 'nombre_cial'], clientesCols),
        pickFirst(['DNI_CIF', 'dni_cif', 'NIF', 'nif'], clientesCols),
        pickFirst(['Email', 'email'], clientesCols),
        pickFirst(['Telefono', 'telefono'], clientesCols),
        pickFirst(['Movil', 'movil'], clientesCols),
        pickFirst(['NumeroFarmacia', 'numero_farmacia', 'Numero_Farmacia'], clientesCols),
        pickFirst(['Direccion', 'direccion'], clientesCols),
        pickFirst(['Poblacion', 'poblacion', 'Localidad', 'localidad'], clientesCols),
        pickFirst(['CodigoPostal', 'codigo_postal', 'codigoPostal'], clientesCols),
        pickFirst(['NomContacto', 'nom_contacto', 'Contacto', 'contacto'], clientesCols),
        pickFirst(['Observaciones', 'observaciones'], clientesCols)
      ].filter(Boolean);

      const pkPrimary = pickFirst(['id', 'Id'], clientesCols) || 'Id';
      const pkFallback = pkPrimary === 'id' ? 'Id' : 'id';

      // Si la introspección no devolvió columnas, usar el esquema conocido (evita devolver siempre 0 resultados).
      const useKnownSchema = !clientesCols || clientesCols.size === 0 || !searchCols || searchCols.length === 0;

      Object.assign(__clientesBuscarMetaCache, {
        loadedAt: now,
        tClientes: useKnownSchema ? __KNOWN_CLIENTES_SCHEMA.tClientes : tClientes,
        tPedidos: useKnownSchema ? __KNOWN_CLIENTES_SCHEMA.tPedidos : tPedidos,
        clientesCols: useKnownSchema ? new Set([
          __KNOWN_CLIENTES_SCHEMA.pkPrimary,
          __KNOWN_CLIENTES_SCHEMA.colComercialClientes,
          __KNOWN_CLIENTES_SCHEMA.colTipoCliente,
          __KNOWN_CLIENTES_SCHEMA.colProvincia,
          __KNOWN_CLIENTES_SCHEMA.colEstadoCliente,
          __KNOWN_CLIENTES_SCHEMA.colOkKo,
          ...__KNOWN_CLIENTES_SCHEMA.searchCols
        ]) : clientesCols,
        pedidosCols: useKnownSchema ? new Set([__KNOWN_CLIENTES_SCHEMA.colPedidoCliente]) : pedidosCols,
        pkPrimary: useKnownSchema ? __KNOWN_CLIENTES_SCHEMA.pkPrimary : pkPrimary,
        pkFallback: useKnownSchema ? __KNOWN_CLIENTES_SCHEMA.pkFallback : pkFallback,
        colComercialClientes: useKnownSchema ? __KNOWN_CLIENTES_SCHEMA.colComercialClientes : colComercialClientes,
        colTipoCliente: useKnownSchema ? __KNOWN_CLIENTES_SCHEMA.colTipoCliente : colTipoCliente,
        colProvincia: useKnownSchema ? __KNOWN_CLIENTES_SCHEMA.colProvincia : colProvincia,
        colEstadoCliente: useKnownSchema ? __KNOWN_CLIENTES_SCHEMA.colEstadoCliente : colEstadoCliente,
        colOkKo: useKnownSchema ? __KNOWN_CLIENTES_SCHEMA.colOkKo : colOkKo,
        colPedidoCliente: useKnownSchema ? __KNOWN_CLIENTES_SCHEMA.colPedidoCliente : colPedidoCliente,
        searchCols: useKnownSchema ? __KNOWN_CLIENTES_SCHEMA.searchCols : searchCols
      });
    }

    const {
      tClientes,
      tPedidos,
      clientesCols,
      pkPrimary,
      pkFallback,
      colComercialClientes,
      colTipoCliente,
      colProvincia,
      colEstadoCliente,
      colOkKo,
      colPedidoCliente,
      searchCols
    } = __clientesBuscarMetaCache;

    const pickFirst = (cands, set) => (cands || []).find(c => set.has(c)) || null;

    const where = [];
    const params = [];

    // Restricción por comercial (no-admin)
    // Nueva regla: un comercial ve sus clientes + el "pool" (Id_Cial = 1).
    if (!esAdmin && comercialIdAutenticado && colComercialClientes) {
      const comId = parseInt(String(comercialIdAutenticado), 10);
      if (Number.isFinite(comId) && comId > 0) {
        // Si el comercial ya es 1, no hace falta OR.
        if (comId === 1) {
          where.push(`c.\`${colComercialClientes}\` = ?`);
          params.push(comId);
        } else {
          where.push(`(c.\`${colComercialClientes}\` = ? OR c.\`${colComercialClientes}\` = 1)`);
          params.push(comId);
        }
      }
    }
    
    // Filtros opcionales (siempre deben aplicarse sobre TODA la BD, no sobre 50 filas)
    const estado = (req.query.estado || '').toString().trim().toLowerCase(); // legacy
    const estadoClienteRaw = (req.query.estadoCliente || '').toString().trim();
    const estadoClienteId = estadoClienteRaw !== '' && !Number.isNaN(Number(estadoClienteRaw)) ? Number(estadoClienteRaw) : null;
    const tipoCliente = req.query.tipoCliente !== undefined && req.query.tipoCliente !== null && String(req.query.tipoCliente).trim() !== ''
      ? Number(req.query.tipoCliente)
      : null;
    const provincia = req.query.provincia !== undefined && req.query.provincia !== null && String(req.query.provincia).trim() !== ''
      ? Number(req.query.provincia)
      : null;
    const conVentas = req.query.conVentas !== undefined && req.query.conVentas !== null && String(req.query.conVentas).trim() !== ''
      ? String(req.query.conVentas).trim().toLowerCase()
      : null;
    const comercialFiltro = req.query.comercial !== undefined && req.query.comercial !== null && String(req.query.comercial).trim() !== ''
      ? Number(req.query.comercial)
      : null;
    
    // Admin puede filtrar por comercial; no-admin siempre queda forzado arriba
    if (esAdmin && Number.isFinite(comercialFiltro) && comercialFiltro > 0 && colComercialClientes) {
      where.push(`c.\`${colComercialClientes}\` = ?`);
      params.push(comercialFiltro);
    }
    
    // Estado (nuevo catálogo): si viene estadoCliente y existe columna, usarlo.
    if (colEstadoCliente && Number.isFinite(estadoClienteId) && estadoClienteId > 0) {
      where.push(`c.\`${colEstadoCliente}\` = ?`);
      params.push(estadoClienteId);
    } else if (colOkKo) {
      // Compatibilidad: OK_KO puede venir como 1/0, 'OK'/'KO' o 'Activo'/'Inactivo'
      if (estado === 'activos') {
        where.push(`(
          c.\`${colOkKo}\` IS NULL OR TRIM(COALESCE(c.\`${colOkKo}\`, '')) = ''
          OR
          c.\`${colOkKo}\` = 1 OR c.\`${colOkKo}\` = '1'
          OR UPPER(c.\`${colOkKo}\`) IN ('OK','ACTIVO')
        )`);
      } else if (estado === 'inactivos') {
        where.push(`(
          c.\`${colOkKo}\` = 0 OR c.\`${colOkKo}\` = '0'
          OR UPPER(c.\`${colOkKo}\`) IN ('KO','INACTIVO')
        )`);
      }
    }
    
    if (Number.isFinite(tipoCliente) && tipoCliente > 0 && colTipoCliente) {
      where.push(`c.\`${colTipoCliente}\` = ?`);
      params.push(tipoCliente);
    }
    if (Number.isFinite(provincia) && provincia > 0 && colProvincia) {
      where.push(`c.\`${colProvincia}\` = ?`);
      params.push(provincia);
    }
    // Nota: algunas instalaciones tienen PK del cliente como `id` y otras como `Id`.
    // Elegimos la que exista para evitar fallos por "Unknown column".
    const runSearch = async (idCol) => {
      const whereLocal = [...where];
      const paramsLocal = [...params];

      if (colPedidoCliente) {
        if (conVentas === 'true' || conVentas === '1') {
          whereLocal.push(`EXISTS (SELECT 1 FROM \`${tPedidos}\` p WHERE p.\`${colPedidoCliente}\` = c.\`${idCol}\`)`);
        } else if (conVentas === 'false' || conVentas === '0') {
          whereLocal.push(`NOT EXISTS (SELECT 1 FROM \`${tPedidos}\` p WHERE p.\`${colPedidoCliente}\` = c.\`${idCol}\`)`);
        }
      }

      const qLikeLocal = qLike;
      // Si por permisos/entorno no pudimos detectar columnas (p.ej. SHOW COLUMNS restringido),
      // usar un fallback con el esquema conocido de `crm_farmadescanso`.
      const fallbackSearchCols = [
        'Nombre_Razon_Social',
        'Nombre_Cial',
        'DNI_CIF',
        'Email',
        'Telefono',
        'Movil',
        'NumeroFarmacia',
        'Direccion',
        'Poblacion',
        'CodigoPostal',
        'NomContacto',
        'Observaciones'
      ];

      const effectiveSearchCols = (searchCols && searchCols.length > 0) ? searchCols : fallbackSearchCols;
      // Evitar LOWER(IFNULL(...)) para permitir uso de índices cuando se use LIKE 'term%'.
      // Forzamos collation unicode_ci para robustez aunque la tabla no lo tuviera.
      // Nota MySQL: la sintaxis correcta es "<expr> COLLATE ... LIKE ?".
      whereLocal.push(`(${effectiveSearchCols.map(col => `c.\`${col}\` COLLATE utf8mb4_unicode_ci LIKE ?`).join(' OR ')})`);
      paramsLocal.push(...effectiveSearchCols.map(() => qLikeLocal));

      const limitLocal = Math.min(200, Math.max(10, parseInt(req.query.limit || '50', 10) || 50));

      const pickSelect = (alias, candidates) => {
        const chosen = pickFirst(candidates, clientesCols);
        return chosen ? `c.\`${chosen}\` AS \`${alias}\`` : `NULL AS \`${alias}\``;
      };
      const pickExpr = (candidates) => {
        const chosen = pickFirst(candidates, clientesCols);
        return chosen ? `c.\`${chosen}\`` : 'NULL';
      };

      const exprNombre = (clientesCols && clientesCols.size > 0)
        ? pickExpr(['Nombre_Razon_Social', 'Nombre', 'nombre', 'RazonSocial', 'razon_social'])
        : 'c.`Nombre_Razon_Social`';
      const exprDni = (clientesCols && clientesCols.size > 0)
        ? pickExpr(['DNI_CIF', 'dni_cif', 'NIF', 'nif'])
        : 'c.`DNI_CIF`';
      const exprEmail = (clientesCols && clientesCols.size > 0)
        ? pickExpr(['Email', 'email'])
        : 'c.`Email`';

      const sqlLocal = `
        SELECT
          c.\`${idCol}\` AS Id,
          ${colComercialClientes ? `c.\`${colComercialClientes}\` AS \`Id_Cial\`,` : 'NULL AS `Id_Cial`,'}
          ${pickSelect('Nombre_Razon_Social', ['Nombre_Razon_Social', 'Nombre', 'nombre', 'RazonSocial', 'razon_social'])},
          ${pickSelect('Nombre_Cial', ['Nombre_Cial', 'nombre_cial'])},
          ${pickSelect('DNI_CIF', ['DNI_CIF', 'dni_cif', 'NIF', 'nif'])},
          ${pickSelect('Email', ['Email', 'email'])},
          ${pickSelect('Telefono', ['Telefono', 'telefono'])},
          ${pickSelect('Movil', ['Movil', 'movil'])},
          ${pickSelect('Direccion', ['Direccion', 'direccion'])},
          ${pickSelect('Poblacion', ['Poblacion', 'poblacion', 'Localidad', 'localidad'])},
          ${pickSelect('CodigoPostal', ['CodigoPostal', 'codigo_postal', 'codigoPostal'])},
          ${pickSelect('NomContacto', ['NomContacto', 'nom_contacto', 'Contacto', 'contacto'])},
          ${pickSelect('Observaciones', ['Observaciones', 'observaciones'])},
          ${pickSelect('Tarifa', ['Tarifa', 'tarifa', 'Id_Tarifa', 'id_tarifa'])}
        FROM \`${tClientes}\` c
        WHERE ${whereLocal.join(' AND ')}
        ORDER BY
          CASE
            WHEN IFNULL(${exprNombre},'') COLLATE utf8mb4_unicode_ci LIKE ? THEN 0
            WHEN IFNULL(${exprDni},'') COLLATE utf8mb4_unicode_ci LIKE ? THEN 1
            WHEN IFNULL(${exprEmail},'') COLLATE utf8mb4_unicode_ci LIKE ? THEN 2
            ELSE 3
          END,
          COALESCE(${exprNombre}, '') COLLATE utf8mb4_unicode_ci ASC
        LIMIT ${limitLocal}
      `;

      const rowsLocal = await crm.query(sqlLocal, [...paramsLocal, qPrefix, qPrefix, qPrefix]);
      return rowsLocal || [];
    };

    let rows = [];
    try {
      rows = await runSearch(pkPrimary);
    } catch (e1) {
      const msg = String(e1?.sqlMessage || e1?.message || '');
      const isBadField = e1?.code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(msg);
      if (!isBadField) throw e1;
      // Reintentar con el otro nombre de PK solo si existe en esta tabla
        if (clientesCols && clientesCols.has(pkFallback)) {
        console.warn(`⚠️ [BUSCAR CLIENTES] Reintentando con PK \`${pkFallback}\` (fallback)...`, { msg });
        rows = await runSearch(pkFallback);
      } else {
        throw e1;
      }
    }
    const clientesFiltrados = (rows || []).map(r => ({
      Id: r.Id ?? r.id,
      Id_Cial: r.Id_Cial ?? r.id_cial ?? r.IdCial ?? null,
      Nombre_Razon_Social: r.Nombre_Razon_Social,
      Nombre_Cial: r.Nombre_Cial,
      DNI_CIF: r.DNI_CIF,
      Email: r.Email,
      Telefono: r.Telefono,
      Movil: r.Movil,
      Direccion: r.Direccion,
      Poblacion: r.Poblacion,
      Provincia: null,
      CodigoPostal: r.CodigoPostal,
      NomContacto: r.NomContacto || null,
      Observaciones: r.Observaciones || null,
      Tarifa: r.Tarifa ?? 0
    }));

    console.log(`✅ [BUSCAR CLIENTES] Resultados encontrados: ${clientesFiltrados.length}`);
    if (debug) {
      return res.json({
        clientes: clientesFiltrados,
        debug: {
          q: qRaw,
          esAdmin,
          comercialIdAutenticado,
          tClientes,
          pkPrimary,
          colComercialClientes,
          estado,
          tipoCliente,
          provincia,
          conVentas,
          comercialFiltro,
          whereCount: where.length,
          searchColsCount: (searchCols || []).length,
          usingFallbackSearchCols: !(searchCols && searchCols.length > 0)
        }
      });
    }
    res.json({ clientes: clientesFiltrados });
  } catch (error) {
    console.error('❌ Error buscando clientes:', error);
    console.error('❌ Stack:', error.stack);
    const msg = String(error?.sqlMessage || error?.message || 'Error desconocido');
    // No devolvemos el SQL completo, solo una pista corta para depurar desde el navegador.
    res.status(500).json({ error: 'Error al buscar clientes', details: msg.slice(0, 250), clientes: [] });
  }
});

// API: Direcciones de envío por cliente (para selector de pedidos)
app.get('/api/clientes/:id/direcciones-envio', requireAuth, async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return res.status(400).json({ success: false, error: 'clienteId inválido', direcciones: [] });
    }

    // Seguridad: mismo criterio que detalle de cliente
    const cliente = await crm.getClienteById(clienteId);
    if (!cliente) return res.status(404).json({ success: false, error: 'Cliente no encontrado', direcciones: [] });

    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    if (!esAdmin && comercialIdAutenticado) {
      const clienteComercialId = cliente.Id_Cial || cliente.id_Cial || cliente.Comercial_id || cliente.comercial_id;
      if (Number(clienteComercialId) !== Number(comercialIdAutenticado)) {
        return res.status(403).json({ success: false, error: 'Acceso denegado', direcciones: [] });
      }
    }

    const direcciones = await crm.getDireccionesEnvioByCliente(clienteId, { includeInactivas: false });
    return res.json({ success: true, direcciones: direcciones || [] });
  } catch (error) {
    console.error('❌ Error API direcciones de envío:', error);
    return res.status(500).json({ success: false, error: 'Error interno', direcciones: [] });
  }
});

// API: Obtener precio por tarifa (para rellenar el precio en pedido-nuevo / pedido-editar)
// Reglas:
// - Si el cliente no tiene tarifa o la tarifa está inactiva/terminada, usar General (0)
// - Si no hay precio en tarifa, fallback a General; si no existe, fallback a PVL del artículo
app.get('/api/tarifas-clientes/precio', requireAuth, async (req, res) => {
  try {
    const clienteId = req.query.clienteId ? Number(req.query.clienteId) : null;
    const articuloId = req.query.articuloId ? Number(req.query.articuloId) : null;
    const tarifaIdOverride = req.query.tarifaId !== undefined && req.query.tarifaId !== null && String(req.query.tarifaId).trim() !== ''
      ? Number(req.query.tarifaId)
      : null;
    const fechaParam = req.query.fecha ? String(req.query.fecha) : null;
    const yearParam = req.query.year ? Number(req.query.year) : null;

    if (!clienteId || !articuloId) {
      return res.status(400).json({ success: false, error: 'clienteId y articuloId son obligatorios' });
    }

    // Fecha de referencia (para históricos). Acepta:
    // - fecha=YYYY-MM-DD
    // - year=2025
    let fechaReferencia = null;
    if (fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)) {
      fechaReferencia = fechaParam;
    } else if (Number.isFinite(yearParam) && yearParam > 2000 && yearParam < 2100) {
      fechaReferencia = `${yearParam}-01-01`;
    }

    // 1) Tarifa del cliente (o override desde UI)
    let tarifaCliente = 0;
    if (Number.isFinite(tarifaIdOverride) && tarifaIdOverride >= 0) {
      tarifaCliente = tarifaIdOverride;
    } else {
      try {
        // Compatibilidad con esquemas donde la tabla se llama `Clientes` (MySQL en Linux puede ser case-sensitive).
        // Preferimos el nombre ya resuelto por el buscador si existe; si no, probamos variantes.
        const tClientesResolved = __clientesBuscarMetaCache?.tClientes || null;
        const candidates = Array.from(new Set([
          tClientesResolved,
          'clientes',
          'Clientes',
          'CLIENTES'
        ].filter(Boolean)));

        let rowsCliente = null;
        for (const t of candidates) {
          try {
            rowsCliente = await crm.query(`SELECT Tarifa FROM \`${t}\` WHERE Id = ? OR id = ? LIMIT 1`, [clienteId, clienteId]);
            break;
          } catch (_) {
            rowsCliente = null;
          }
        }
        if (rowsCliente && rowsCliente.length > 0) {
          const raw = rowsCliente[0].Tarifa ?? rowsCliente[0].tarifa ?? 0;
          const parsed = Number(raw);
          tarifaCliente = Number.isFinite(parsed) ? parsed : 0;
        }
      } catch (_) {
        tarifaCliente = 0;
      }
    }

    // 2) Validar si la tarifa está activa
    // Regla correcta:
    // - Activa=1
    // - y (FechaFin es null/vacía/0000-00-00 o FechaFin >= hoy)
    let tarifaAplicada = tarifaCliente || 0;
    const vieneDeOverride = Number.isFinite(tarifaIdOverride) && tarifaIdOverride >= 0;
    // Si viene un override explícito desde la UI (tarifaId), asumimos que es la tarifa que el usuario/cliente ha fijado
    // y NO la invalidamos por Activa/FechaFin. Si no viene override, aplicamos validación como antes.
    if (!vieneDeOverride && tarifaAplicada !== 0) {
      try {
        let rowsTarifa = [];
        try {
          rowsTarifa = await crm.query(
            `SELECT Activa, FechaFin
             FROM tarifasClientes
             WHERE Id = ?
             LIMIT 1`,
            [tarifaAplicada]
          );
        } catch (err) {
          // Fallback por si hay esquemas antiguos con otras columnas
          const msg = String(err?.sqlMessage || err?.message || '');
          const isBadField = err?.code === 'ER_BAD_FIELD_ERROR' && /Unknown column/i.test(msg);
          if (isBadField) {
            rowsTarifa = await crm.query(
              `SELECT Activa, FechaFin
               FROM tarifasClientes
               WHERE Id = ?
               LIMIT 1`,
              [tarifaAplicada]
            ).catch(() => []);
          } else {
            throw err;
          }
        }
        const t = rowsTarifa && rowsTarifa.length > 0 ? rowsTarifa[0] : null;
        const activa = Number(t?.Activa ?? 0) === 1;
        const fechaFin = t?.FechaFin ? String(t.FechaFin).slice(0, 10) : null;
        const hoy = new Date().toISOString().slice(0, 10);
        const fechaFinVacia = !fechaFin || fechaFin === '0000-00-00' || fechaFin === '';
        const sigueVigente = fechaFinVacia ? true : (fechaFin >= hoy);
        if (!activa || !sigueVigente) {
          tarifaAplicada = 0;
        }
      } catch (_) {
        tarifaAplicada = 0;
      }
    }

    // 3) Precio por tarifa/artículo con fallbacks
    const obtenerPrecioDesdeTarifa = async (tarifaId) => {
      const rows = await crm.query(
        'SELECT Precio FROM tarifasClientes_precios WHERE Id_Tarifa = ? AND Id_Articulo = ? LIMIT 1',
        [tarifaId, articuloId]
      );
      if (rows && rows.length > 0) {
        const precio = Number(rows[0].Precio ?? 0);
        return Number.isFinite(precio) ? precio : null;
      }
      return null;
    };

    let precio = null;
    try {
      precio = await obtenerPrecioDesdeTarifa(tarifaAplicada);
      if (precio === null) {
        // Si estamos consultando un año histórico, preferir una tarifa "PVL 2025" (si existe)
        if (fechaReferencia && /^2025-/.test(fechaReferencia)) {
          try {
            const tRows = await crm.query(
              `SELECT Id
               FROM tarifasClientes
               WHERE NombreTarifa = 'PVL 2025'
                 AND FechaInicio <= ?
                 AND FechaFin >= ?
               LIMIT 1`,
              [fechaReferencia, fechaReferencia]
            );
            const idGeneral2025 = tRows && tRows.length > 0 ? Number(tRows[0].Id) : null;
            if (Number.isFinite(idGeneral2025)) {
              precio = await obtenerPrecioDesdeTarifa(idGeneral2025);
            }
          } catch (_) {}
        }
      }
      if (precio === null) precio = await obtenerPrecioDesdeTarifa(0);
    } catch (_) {
      precio = null;
    }

    if (precio === null) {
      try {
        const rowsArticulo = await crm.query('SELECT PVL FROM articulos WHERE Id = ? OR id = ? LIMIT 1', [articuloId, articuloId]);
        const pvl = rowsArticulo && rowsArticulo.length > 0 ? Number(rowsArticulo[0].PVL ?? rowsArticulo[0].pvl ?? 0) : 0;
        precio = Number.isFinite(pvl) ? pvl : 0;
      } catch (_) {
        precio = 0;
      }
    }

    res.json({
      success: true,
      data: {
        clienteId,
        articuloId,
        tarifaCliente,
        tarifaAplicada,
        fechaReferencia,
        precio
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clientes/:id/borrar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clienteId = req.params.id;
    const eliminadoPor = req.comercialId || req.session.comercialId;

    if (!clienteId) {
      return res.status(400).json({ success: false, error: 'ID de cliente requerido' });
    }

    if (!eliminadoPor) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    console.log('🗑️ [BORRAR CLIENTE] Moviendo cliente a papelera:', { clienteId, eliminadoPor });

    const result = await crm.moverClienteAPapelera(clienteId, eliminadoPor);
    
    res.json({ 
      success: true, 
      message: 'Cliente movido a la papelera correctamente',
      data: result 
    });
  } catch (error) {
    console.error('❌ [BORRAR CLIENTE] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al mover el cliente a la papelera' 
    });
  }
});

// API: Alternar OK_KO
app.post('/api/clientes/:id/okko', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { value } = req.body; // true/false | 'OK'/'KO' | 'Cliente activo'
    
    console.log('🔁 [OK_KO] Toggle solicitado:', { id, value, body: req.body });
    
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID de cliente requerido' });
    }

    const result = await crm.toggleClienteOkKo(id, value);
    console.log('✅ [OK_KO] Actualizado en NocoDB:', { id, result });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ [OK_KO] Error completo:', {
      message: error.message,
      stack: error.stack,
      id: req.params.id,
      body: req.body
    });
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al actualizar el estado del cliente',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API: reasignar un cliente del "pool" (Id_Cial=1) al comercial logueado.
// Regla:
// - Admin: puede reasignar a cualquier comercial pasando body.toComercialId
// - Comercial: solo puede reasignar clientes que estén en el pool (Id_Cial=1) hacia sí mismo
app.post('/api/clientes/:id/asignar', requireAuth, async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return res.status(400).json({ success: false, error: 'ID de cliente inválido' });
    }

    const esAdmin = getUserIsAdmin(req);
    const comercialIdAutenticado = Number(getComercialId(req) || 0);
    if (!Number.isFinite(comercialIdAutenticado) || comercialIdAutenticado <= 0) {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }

    const toComercialId = esAdmin
      ? Number(req.body?.toComercialId || comercialIdAutenticado)
      : comercialIdAutenticado;

    if (!Number.isFinite(toComercialId) || toComercialId <= 0) {
      return res.status(400).json({ success: false, error: 'toComercialId inválido' });
    }

    // Obtener estado actual (para validar pool y evitar reasignaciones indebidas)
    const rows = await crm.query('SELECT id, Id_Cial FROM clientes WHERE id = ? LIMIT 1', [clienteId]).catch(() => []);
    const cliente = rows && rows.length ? rows[0] : null;
    if (!cliente) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }

    const currentCial = Number(cliente.Id_Cial || 0);

    if (!esAdmin) {
      if (currentCial !== 1) {
        return res.status(403).json({
          success: false,
          error: 'Solo puedes asignar clientes del pool (Id_Cial=1).'
        });
      }
      if (toComercialId === 1) {
        return res.status(400).json({ success: false, error: 'No puedes reasignar al pool.' });
      }
    }

    // UPDATE protegido: en modo no-admin, solo actualiza si sigue en pool (evita carreras)
    const result = esAdmin
      ? await crm.query('UPDATE clientes SET Id_Cial = ? WHERE id = ? LIMIT 1', [toComercialId, clienteId])
      : await crm.query('UPDATE clientes SET Id_Cial = ? WHERE id = ? AND Id_Cial = 1 LIMIT 1', [toComercialId, clienteId]);

    const affected = result?.affectedRows ?? result?.[0]?.affectedRows ?? 0;
    if (!affected) {
      return res.status(409).json({
        success: false,
        error: 'No se pudo reasignar (puede que ya no esté en pool).'
      });
    }

    return res.json({
      success: true,
      data: { clienteId, fromIdCial: currentCial, toIdCial: toComercialId }
    });
  } catch (error) {
    console.error('❌ [ASIGNAR CLIENTE] Error:', error);
    return res.status(500).json({ success: false, error: 'Error reasignando cliente', details: String(error?.message || '').slice(0, 200) });
  }
});

// Gestión de Cooperativas
app.get('/dashboard/cooperativas', requireAuth, async (req, res) => {
  try {
    const cooperativas = await crm.getCooperativas();
    res.render('dashboard/cooperativas', {
      title: 'Cooperativas - Farmadescaso',
      user: req.comercial || req.session.comercial,
      cooperativas: cooperativas || [],
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando cooperativas:', error);
    res.render('dashboard/cooperativas', {
      title: 'Cooperativas - Farmadescaso',
      user: req.comercial || req.session.comercial,
      cooperativas: [],
      error: 'Error cargando cooperativas',
      query: req.query
    });
  }
});

app.get('/dashboard/cooperativas/nuevo', requireAuth, async (req, res) => {
  res.render('dashboard/cooperativa-editar', {
    title: 'Nueva Cooperativa - Farmadescaso',
    user: req.comercial || req.session.comercial,
    cooperativa: null,
    error: null,
    isNew: true
  });
});

app.get('/dashboard/cooperativas/:id/editar', requireAuth, async (req, res) => {
  try {
    const cooperativa = await crm.getCooperativaById(req.params.id);
    if (!cooperativa) {
      return res.status(404).render('error', { error: 'Cooperativa no encontrada', message: 'La cooperativa no existe' });
    }
    res.render('dashboard/cooperativa-editar', {
      title: `Cooperativa #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      cooperativa,
      error: null,
      isNew: false
    });
  } catch (error) {
    console.error('Error cargando formulario de edición:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el formulario' });
  }
});

app.get('/dashboard/cooperativas/:id', requireAuth, async (req, res) => {
  try {
    const cooperativa = await crm.getCooperativaById(req.params.id);
    if (!cooperativa) {
      return res.status(404).render('error', { error: 'Cooperativa no encontrada', message: 'La cooperativa no existe' });
    }
    res.render('dashboard/cooperativa-detalle', {
      title: `Cooperativa #${req.params.id} - Detalle`,
      user: req.comercial || req.session.comercial,
      cooperativa,
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando detalle de cooperativa:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar la cooperativa' });
  }
});

app.post('/dashboard/cooperativas', requireAuth, async (req, res) => {
  try {
    const payload = {
      Nombre: req.body.Nombre,
      Email: req.body.Email,
      Telefono: req.body.Telefono || null,
      Contacto: req.body.Contacto || null
    };
    
    if (!payload.Nombre || !payload.Email) {
      return res.render('dashboard/cooperativa-editar', {
        title: 'Nueva Cooperativa - Farmadescaso',
        user: req.comercial || req.session.comercial,
        cooperativa: req.body,
        error: 'Nombre y Email son obligatorios',
        isNew: true
      });
    }

    const result = await crm.createCooperativa(payload.Nombre, { Email: payload.Email, Telefono: payload.Telefono, Contacto: payload.Contacto });
    const cooperativaId = result.insertId;
    res.redirect(`/dashboard/cooperativas/${cooperativaId}?success=cooperativa_creada`);
  } catch (error) {
    console.error('Error creando cooperativa:', error);
    res.render('dashboard/cooperativa-editar', {
      title: 'Nueva Cooperativa - Farmadescaso',
      user: req.comercial || req.session.comercial,
      cooperativa: req.body,
      error: error.message || 'Error al crear la cooperativa',
      isNew: true
    });
  }
});

app.post('/dashboard/cooperativas/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = {
      Nombre: req.body.Nombre,
      Email: req.body.Email,
      Telefono: req.body.Telefono || null,
      Contacto: req.body.Contacto || null
    };
    
    await crm.updateCooperativa(id, payload);
    res.redirect(`/dashboard/cooperativas/${id}?success=cooperativa_actualizada`);
  } catch (error) {
    console.error('Error actualizando cooperativa:', error);
    const cooperativa = await crm.getCooperativaById(req.params.id);
    res.render('dashboard/cooperativa-editar', {
      title: `Cooperativa #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      cooperativa: cooperativa || req.body,
      error: error.message || 'Error al actualizar la cooperativa',
      isNew: false
    });
  }
});

app.post('/dashboard/cooperativas/:id/eliminar', requireAuth, async (req, res) => {
  try {
    await crm.deleteCooperativa(req.params.id);
    res.redirect('/dashboard/cooperativas?success=cooperativa_eliminada');
  } catch (error) {
    console.error('Error eliminando cooperativa:', error);
    res.redirect(`/dashboard/cooperativas/${req.params.id}?error=error_eliminando`);
  }
});

// ============================================================
// Gestión de Grupos de compras
// ============================================================
app.get('/dashboard/grupos-compras', requireAuth, async (req, res) => {
  try {
    const gruposCompras = await crm.getGruposCompras().catch(() => []);
    res.render('dashboard/grupos-compras', {
      title: 'Grupos de compras - Farmadescaso',
      user: req.comercial || req.session.comercial,
      currentPage: 'grupos-compras',
      gruposCompras: gruposCompras || [],
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando grupos de compras:', error);
    res.render('dashboard/grupos-compras', {
      title: 'Grupos de compras - Farmadescaso',
      user: req.comercial || req.session.comercial,
      currentPage: 'grupos-compras',
      gruposCompras: [],
      error: 'Error cargando grupos de compras',
      query: req.query
    });
  }
});

app.get('/dashboard/grupos-compras/nuevo', requireAuth, async (req, res) => {
  res.render('dashboard/grupo-compra-editar', {
    title: 'Nuevo Grupo de compras - Farmadescaso',
    user: req.comercial || req.session.comercial,
    currentPage: 'grupos-compras',
    grupo: null,
    error: null,
    returnTo: sanitizeReturnTo(req.query.returnTo) || '/dashboard/grupos-compras',
    isNew: true
  });
});

app.get('/dashboard/grupos-compras/:id/editar', requireAuth, async (req, res) => {
  try {
    const grupo = await crm.getGrupoComprasById(req.params.id);
    if (!grupo) return res.status(404).render('error', { error: 'Grupo no encontrado', message: 'El grupo no existe' });
    res.render('dashboard/grupo-compra-editar', {
      title: `Grupo de compras #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      currentPage: 'grupos-compras',
      grupo,
      error: null,
      returnTo: sanitizeReturnTo(req.query.returnTo) || `/dashboard/grupos-compras/${req.params.id}`,
      isNew: false
    });
  } catch (error) {
    console.error('Error cargando formulario de grupo:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el formulario' });
  }
});

app.get('/dashboard/grupos-compras/:id', requireAuth, async (req, res) => {
  try {
    const grupo = await crm.getGrupoComprasById(req.params.id);
    if (!grupo) return res.status(404).render('error', { error: 'Grupo no encontrado', message: 'El grupo no existe' });
    res.render('dashboard/grupo-compra-detalle', {
      title: `Grupo de compras #${req.params.id} - Detalle`,
      user: req.comercial || req.session.comercial,
      currentPage: 'grupos-compras',
      grupo,
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando detalle de grupo:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el grupo' });
  }
});

app.post('/dashboard/grupos-compras', requireAuth, async (req, res) => {
  try {
    const payload = {
      Nombre: (req.body.Nombre || '').trim(),
      CIF: (req.body.CIF || '').trim() || null,
      Email: (req.body.Email || '').trim() || null,
      Telefono: (req.body.Telefono || '').trim() || null,
      Contacto: (req.body.Contacto || '').trim() || null,
      Direccion: (req.body.Direccion || '').trim() || null,
      Poblacion: (req.body.Poblacion || '').trim() || null,
      CodigoPostal: (req.body.CodigoPostal || '').trim() || null,
      Provincia: (req.body.Provincia || '').trim() || null,
      Pais: (req.body.Pais || '').trim() || null,
      Observaciones: (req.body.Observaciones || '').trim() || null,
      Activo: String(req.body.Activo || '1') === '1' ? 1 : 0
    };

    if (!payload.Nombre) {
      return res.render('dashboard/grupo-compra-editar', {
        title: 'Nuevo Grupo de compras - Farmadescaso',
        user: req.comercial || req.session.comercial,
        currentPage: 'grupos-compras',
        grupo: req.body,
        error: 'Nombre es obligatorio',
        returnTo: sanitizeReturnTo(req.body.returnTo) || '/dashboard/grupos-compras',
        isNew: true
      });
    }

    const result = await crm.createGrupoCompras(payload);
    const id = result.insertId;
    const returnTo = sanitizeReturnTo(req.body.returnTo);
    if (returnTo) return res.redirect(withSuccess(returnTo, 'grupo_compra_creado'));
    res.redirect(`/dashboard/grupos-compras/${id}?success=grupo_compra_creado`);
  } catch (error) {
    console.error('Error creando grupo de compras:', error);
    res.render('dashboard/grupo-compra-editar', {
      title: 'Nuevo Grupo de compras - Farmadescaso',
      user: req.comercial || req.session.comercial,
      currentPage: 'grupos-compras',
      grupo: req.body,
      error: error.message || 'Error al crear el grupo',
      returnTo: sanitizeReturnTo(req.body.returnTo) || '/dashboard/grupos-compras',
      isNew: true
    });
  }
});

app.post('/dashboard/grupos-compras/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = {
      Nombre: (req.body.Nombre || '').trim(),
      CIF: (req.body.CIF || '').trim() || null,
      Email: (req.body.Email || '').trim() || null,
      Telefono: (req.body.Telefono || '').trim() || null,
      Contacto: (req.body.Contacto || '').trim() || null,
      Direccion: (req.body.Direccion || '').trim() || null,
      Poblacion: (req.body.Poblacion || '').trim() || null,
      CodigoPostal: (req.body.CodigoPostal || '').trim() || null,
      Provincia: (req.body.Provincia || '').trim() || null,
      Pais: (req.body.Pais || '').trim() || null,
      Observaciones: (req.body.Observaciones || '').trim() || null,
      Activo: String(req.body.Activo || '1') === '1' ? 1 : 0
    };

    await crm.updateGrupoCompras(id, payload);
    const returnTo = sanitizeReturnTo(req.body.returnTo);
    if (returnTo) return res.redirect(withSuccess(returnTo, 'grupo_compra_actualizado'));
    res.redirect(`/dashboard/grupos-compras/${id}?success=grupo_compra_actualizado`);
  } catch (error) {
    console.error('Error actualizando grupo de compras:', error);
    const grupo = await crm.getGrupoComprasById(req.params.id).catch(() => null);
    res.render('dashboard/grupo-compra-editar', {
      title: `Grupo de compras #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      currentPage: 'grupos-compras',
      grupo: grupo || req.body,
      error: error.message || 'Error al actualizar el grupo',
      returnTo: sanitizeReturnTo(req.body.returnTo) || `/dashboard/grupos-compras/${req.params.id}`,
      isNew: false
    });
  }
});

app.post('/dashboard/grupos-compras/:id/eliminar', requireAuth, async (req, res) => {
  try {
    await crm.deleteGrupoCompras(req.params.id);
    res.redirect('/dashboard/grupos-compras?success=grupo_compra_eliminado');
  } catch (error) {
    console.error('Error eliminando grupo de compras:', error);
    res.redirect(`/dashboard/grupos-compras/${req.params.id}?error=error_eliminando`);
  }
});

// ============================================================
// Gestión de Clientes - Grupos de compras (1 activo por cliente)
// ============================================================
app.get('/dashboard/clientes-grupos-compras', requireAuth, async (req, res) => {
  try {
    const relaciones = await crm.getClientesGruposCompras().catch(() => []);
    res.render('dashboard/clientes-grupos-compras', {
      title: 'Clientes - Grupos de compras - Farmadescaso',
      user: req.comercial || req.session.comercial,
      currentPage: 'clientes-grupos-compras',
      relaciones: relaciones || [],
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando clientes-gruposCompras:', error);
    res.render('dashboard/clientes-grupos-compras', {
      title: 'Clientes - Grupos de compras - Farmadescaso',
      user: req.comercial || req.session.comercial,
      currentPage: 'clientes-grupos-compras',
      relaciones: [],
      error: 'Error cargando asignaciones',
      query: req.query
    });
  }
});

app.get('/dashboard/clientes-grupos-compras/nuevo', requireAuth, async (req, res) => {
  try {
    const [clientes, grupos] = await Promise.all([
      crm.getClientes().catch(() => []),
      crm.getGruposCompras().catch(() => [])
    ]);
    const prefillClienteId = Number(req.query.clienteId || 0) || null;
    res.render('dashboard/cliente-grupo-compra-editar', {
      title: 'Nueva asignación Cliente-Grupo de compras - Farmadescaso',
      user: req.comercial || req.session.comercial,
      currentPage: 'clientes-grupos-compras',
      relacion: null,
      clientes: clientes || [],
      grupos: grupos || [],
      prefillClienteId,
      returnTo: sanitizeReturnTo(req.query.returnTo) || '/dashboard/clientes-grupos-compras',
      error: null,
      isNew: true
    });
  } catch (error) {
    console.error('Error cargando formulario nuevo clientes-gruposCompras:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el formulario' });
  }
});

app.get('/dashboard/clientes-grupos-compras/:id/editar', requireAuth, async (req, res) => {
  try {
    const relacion = await crm.getClienteGrupoComprasById(req.params.id);
    if (!relacion) return res.status(404).render('error', { error: 'Asignación no encontrada', message: 'No existe' });
    const [clientes, grupos] = await Promise.all([
      crm.getClientes().catch(() => []),
      crm.getGruposCompras().catch(() => [])
    ]);
    res.render('dashboard/cliente-grupo-compra-editar', {
      title: `Asignación #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      currentPage: 'clientes-grupos-compras',
      relacion,
      clientes: clientes || [],
      grupos: grupos || [],
      prefillClienteId: null,
      returnTo: sanitizeReturnTo(req.query.returnTo) || `/dashboard/clientes-grupos-compras/${req.params.id}`,
      error: null,
      isNew: false
    });
  } catch (error) {
    console.error('Error cargando edición clientes-gruposCompras:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el formulario' });
  }
});

app.get('/dashboard/clientes-grupos-compras/:id', requireAuth, async (req, res) => {
  try {
    const relacion = await crm.getClienteGrupoComprasById(req.params.id);
    if (!relacion) return res.status(404).render('error', { error: 'Asignación no encontrada', message: 'No existe' });
    res.render('dashboard/cliente-grupo-compra-detalle', {
      title: `Asignación #${req.params.id} - Detalle`,
      user: req.comercial || req.session.comercial,
      currentPage: 'clientes-grupos-compras',
      relacion,
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando detalle clientes-gruposCompras:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el detalle' });
  }
});

app.post('/dashboard/clientes-grupos-compras', requireAuth, async (req, res) => {
  try {
    const payload = {
      Id_Cliente: Number(req.body.Id_Cliente),
      Id_GrupoCompras: Number(req.body.Id_GrupoCompras),
      NumSocio: (req.body.NumSocio || '').trim() || null,
      Observaciones: (req.body.Observaciones || '').trim() || null
    };
    if (!payload.Id_Cliente || !payload.Id_GrupoCompras) {
      const [clientes, grupos] = await Promise.all([
        crm.getClientes().catch(() => []),
        crm.getGruposCompras().catch(() => [])
      ]);
      return res.render('dashboard/cliente-grupo-compra-editar', {
        title: 'Nueva asignación Cliente-Grupo de compras - Farmadescaso',
        user: req.comercial || req.session.comercial,
        currentPage: 'clientes-grupos-compras',
        relacion: req.body,
        clientes: clientes || [],
        grupos: grupos || [],
        prefillClienteId: Number(req.body.Id_Cliente || 0) || null,
        returnTo: sanitizeReturnTo(req.body.returnTo) || '/dashboard/clientes-grupos-compras',
        error: 'Cliente y Grupo son obligatorios',
        isNew: true
      });
    }

    const result = await crm.createClienteGrupoCompras(payload);
    const id = result.insertId;
    const returnTo = sanitizeReturnTo(req.body.returnTo);
    if (returnTo) return res.redirect(withSuccess(returnTo, 'asignacion_grupo_compra_creada'));
    res.redirect(`/dashboard/clientes-grupos-compras/${id}?success=asignacion_grupo_compra_creada`);
  } catch (error) {
    console.error('Error creando asignación grupo compra:', error);
    const [clientes, grupos] = await Promise.all([
      crm.getClientes().catch(() => []),
      crm.getGruposCompras().catch(() => [])
    ]);
    res.render('dashboard/cliente-grupo-compra-editar', {
      title: 'Nueva asignación Cliente-Grupo de compras - Farmadescaso',
      user: req.comercial || req.session.comercial,
      currentPage: 'clientes-grupos-compras',
      relacion: req.body,
      clientes: clientes || [],
      grupos: grupos || [],
      prefillClienteId: Number(req.body.Id_Cliente || 0) || null,
      returnTo: sanitizeReturnTo(req.body.returnTo) || '/dashboard/clientes-grupos-compras',
      error: error.message || 'Error al crear la asignación',
      isNew: true
    });
  }
});

app.post('/dashboard/clientes-grupos-compras/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = {
      Id_GrupoCompras: Number(req.body.Id_GrupoCompras),
      NumSocio: (req.body.NumSocio || '').trim() || null,
      Observaciones: (req.body.Observaciones || '').trim() || null
    };
    await crm.updateClienteGrupoCompras(id, payload);
    const returnTo = sanitizeReturnTo(req.body.returnTo);
    if (returnTo) return res.redirect(withSuccess(returnTo, 'asignacion_grupo_compra_actualizada'));
    res.redirect(`/dashboard/clientes-grupos-compras/${id}?success=asignacion_grupo_compra_actualizada`);
  } catch (error) {
    console.error('Error actualizando asignación grupo compra:', error);
    const relacion = await crm.getClienteGrupoComprasById(req.params.id).catch(() => null);
    const [clientes, grupos] = await Promise.all([
      crm.getClientes().catch(() => []),
      crm.getGruposCompras().catch(() => [])
    ]);
    res.render('dashboard/cliente-grupo-compra-editar', {
      title: `Asignación #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      currentPage: 'clientes-grupos-compras',
      relacion: relacion || req.body,
      clientes: clientes || [],
      grupos: grupos || [],
      prefillClienteId: null,
      returnTo: sanitizeReturnTo(req.body.returnTo) || `/dashboard/clientes-grupos-compras/${req.params.id}`,
      error: error.message || 'Error al actualizar la asignación',
      isNew: false
    });
  }
});

app.post('/dashboard/clientes-grupos-compras/:id/cerrar', requireAuth, async (req, res) => {
  try {
    await crm.cerrarClienteGrupoCompras(req.params.id);
    const returnTo = sanitizeReturnTo(req.body.returnTo) || sanitizeReturnTo(req.query.returnTo);
    if (returnTo) return res.redirect(withSuccess(returnTo, 'asignacion_grupo_compra_cerrada'));
    res.redirect(`/dashboard/clientes-grupos-compras/${req.params.id}?success=asignacion_grupo_compra_cerrada`);
  } catch (error) {
    console.error('Error cerrando asignación grupo compra:', error);
    res.redirect(`/dashboard/clientes-grupos-compras/${req.params.id}?error=cerrar_error`);
  }
});

// Gestión de Clientes-Cooperativas
app.get('/dashboard/clientes-cooperativas', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [LISTADO] Obteniendo relaciones cliente-cooperativa...');
    const clientesCooperativas = await crm.getClientesCooperativa();
    console.log(`📊 [LISTADO] Relaciones obtenidas: ${clientesCooperativas ? clientesCooperativas.length : 0}`);
    
    const clientes = await crm.getClientes().catch(err => { console.error('Error obteniendo clientes:', err); return []; });
    const cooperativas = await crm.getCooperativas().catch(err => { console.error('Error obteniendo cooperativas:', err); return []; });
    
    // Asegurar que siempre es un array
    const relacionesArray = Array.isArray(clientesCooperativas) ? clientesCooperativas : [];
    
    res.render('dashboard/clientes-cooperativas', {
      title: 'Clientes-Cooperativas - Farmadescaso',
      user: req.comercial || req.session.comercial,
      clientesCooperativas: relacionesArray,
      clientes: clientes || [],
      cooperativas: cooperativas || [],
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('❌ Error cargando clientes-cooperativas:', error);
    console.error('❌ Stack:', error.stack);
    res.render('dashboard/clientes-cooperativas', {
      title: 'Clientes-Cooperativas - Farmadescaso',
      user: req.comercial || req.session.comercial,
      clientesCooperativas: [],
      clientes: [],
      cooperativas: [],
      error: `Error cargando relaciones cliente-cooperativa: ${error.message}`,
      query: req.query
    });
  }
});

app.get('/dashboard/clientes-cooperativas/nuevo', requireAuth, async (req, res) => {
  try {
    const [clientes, cooperativas] = await Promise.all([
      crm.getClientes().catch(err => { console.error('Error obteniendo clientes:', err); return []; }),
      crm.getCooperativas().catch(err => { console.error('Error obteniendo cooperativas:', err); return []; })
    ]);
    const prefillClienteId = Number(req.query.clienteId || 0) || null;
    
    res.render('dashboard/cliente-cooperativa-editar', {
      title: 'Nueva Relación Cliente-Cooperativa - Farmadescaso',
      user: req.comercial || req.session.comercial,
      currentPage: 'clientes-cooperativas',
      clienteCooperativa: null,
      clientes: clientes || [],
      cooperativas: cooperativas || [],
      prefillClienteId,
      returnTo: sanitizeReturnTo(req.query.returnTo) || '/dashboard/clientes-cooperativas',
      error: null,
      isNew: true
    });
  } catch (error) {
    console.error('Error cargando formulario nuevo:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el formulario' });
  }
});

app.get('/dashboard/clientes-cooperativas/:id/editar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    console.log(`🔍 [EDITAR RELACIÓN] Buscando relación con ID: ${id}`);
    
    const clienteCooperativa = await crm.getClienteCooperativaById(id);
    console.log(`🔍 [EDITAR RELACIÓN] Resultado:`, clienteCooperativa ? 'Encontrada' : 'No encontrada');
    
    if (!clienteCooperativa) {
      // Intentar consulta directa para diagnóstico
      try {
        const testQuery1 = await crm.query('SELECT * FROM `Clientes_Cooperativas` WHERE id = ? LIMIT 1', [id]);
        console.log('🔍 [EDITAR RELACIÓN] Consulta directa Clientes_Cooperativas:', testQuery1);
        if (testQuery1 && testQuery1.length > 0) {
          console.log('✅ [EDITAR RELACIÓN] Relación encontrada con consulta directa');
          const [clientes, cooperativas] = await Promise.all([
            crm.getClientes().catch(err => { console.error('Error obteniendo clientes:', err); return []; }),
            crm.getCooperativas().catch(err => { console.error('Error obteniendo cooperativas:', err); return []; })
          ]);
          
          return res.render('dashboard/cliente-cooperativa-editar', {
            title: `Relación #${id} - Editar`,
            user: req.comercial || req.session.comercial,
            clienteCooperativa: testQuery1[0],
            clientes: clientes || [],
            cooperativas: cooperativas || [],
            error: null,
            isNew: false
          });
        }
      } catch (testError1) {
        console.error('❌ [EDITAR RELACIÓN] Error en consulta directa Clientes_Cooperativas:', testError1.message);
        try {
          const testQuery2 = await crm.query('SELECT * FROM clientes_cooperativas WHERE id = ? LIMIT 1', [id]);
          console.log('🔍 [EDITAR RELACIÓN] Consulta directa clientes_cooperativas:', testQuery2);
          if (testQuery2 && testQuery2.length > 0) {
            console.log('✅ [EDITAR RELACIÓN] Relación encontrada con consulta directa (minúsculas)');
            const [clientes, cooperativas] = await Promise.all([
              crm.getClientes().catch(err => { console.error('Error obteniendo clientes:', err); return []; }),
              crm.getCooperativas().catch(err => { console.error('Error obteniendo cooperativas:', err); return []; })
            ]);
            
            return res.render('dashboard/cliente-cooperativa-editar', {
              title: `Relación #${id} - Editar`,
              user: req.comercial || req.session.comercial,
              clienteCooperativa: testQuery2[0],
              clientes: clientes || [],
              cooperativas: cooperativas || [],
              error: null,
              isNew: false
            });
          }
        } catch (testError2) {
          console.error('❌ [EDITAR RELACIÓN] Error en consulta directa clientes_cooperativas:', testError2.message);
        }
      }
      
      return res.status(404).render('error', { 
        error: 'Relación no encontrada', 
        message: `La relación cliente-cooperativa con ID ${id} no existe` 
      });
    }
    
    const [clientes, cooperativas] = await Promise.all([
      crm.getClientes().catch(err => { console.error('Error obteniendo clientes:', err); return []; }),
      crm.getCooperativas().catch(err => { console.error('Error obteniendo cooperativas:', err); return []; })
    ]);
    
    res.render('dashboard/cliente-cooperativa-editar', {
      title: `Relación #${id} - Editar`,
      user: req.comercial || req.session.comercial,
      clienteCooperativa,
      clientes: clientes || [],
      cooperativas: cooperativas || [],
      error: null,
      isNew: false
    });
  } catch (error) {
    console.error('❌ Error cargando formulario de edición:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).render('error', { error: 'Error', message: `No se pudo cargar el formulario: ${error.message}` });
  }
});

app.get('/dashboard/clientes-cooperativas/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    console.log('🔍 [DETALLE RELACIÓN] Buscando relación con ID:', id);
    const clienteCooperativa = await crm.getClienteCooperativaById(id);
    console.log('🔍 [DETALLE RELACIÓN] Resultado:', clienteCooperativa ? 'Encontrada' : 'No encontrada');
    
    if (!clienteCooperativa) {
      // Intentar verificar si existe en la tabla directamente
      console.log('⚠️ [DETALLE RELACIÓN] Relación no encontrada, verificando en BD...');
      try {
        const testQuery = await crm.query('SELECT * FROM `Clientes_Cooperativas` WHERE id = ? LIMIT 1', [id]);
        console.log('🔍 [DETALLE RELACIÓN] Consulta directa resultado:', testQuery);
        if (testQuery && testQuery.length > 0) {
          console.log('✅ [DETALLE RELACIÓN] Relación encontrada con consulta directa');
          return res.render('dashboard/cliente-cooperativa-detalle', {
            title: `Relación #${id} - Detalle`,
            user: req.comercial || req.session.comercial,
            clienteCooperativa: testQuery[0],
            error: null,
            query: req.query
          });
        }
      } catch (testError) {
        console.error('❌ [DETALLE RELACIÓN] Error en consulta de prueba:', testError.message);
        // Intentar con nombre de tabla en minúsculas
        try {
          const testQuery2 = await crm.query('SELECT * FROM clientes_cooperativas WHERE id = ? LIMIT 1', [id]);
          console.log('🔍 [DETALLE RELACIÓN] Consulta directa (minúsculas) resultado:', testQuery2);
          if (testQuery2 && testQuery2.length > 0) {
            console.log('✅ [DETALLE RELACIÓN] Relación encontrada con consulta directa (minúsculas)');
            return res.render('dashboard/cliente-cooperativa-detalle', {
              title: `Relación #${id} - Detalle`,
              user: req.comercial || req.session.comercial,
              clienteCooperativa: testQuery2[0],
              error: null,
              query: req.query
            });
          }
        } catch (testError2) {
          console.error('❌ [DETALLE RELACIÓN] Error en consulta de prueba (minúsculas):', testError2.message);
        }
      }
      
      return res.status(404).render('error', { 
        error: 'Relación no encontrada', 
        message: `La relación cliente-cooperativa con ID ${id} no existe` 
      });
    }
    res.render('dashboard/cliente-cooperativa-detalle', {
      title: `Relación #${req.params.id} - Detalle`,
      user: req.comercial || req.session.comercial,
      clienteCooperativa,
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('❌ Error cargando detalle de relación:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).render('error', { error: 'Error', message: `No se pudo cargar la relación: ${error.message}` });
  }
});

app.post('/dashboard/clientes-cooperativas', requireAuth, async (req, res) => {
  try {
    const payload = {
      Id_Cliente: parseInt(req.body.Id_Cliente),
      Id_Cooperativa: parseInt(req.body.Id_Cooperativa),
      NumAsociado: req.body.NumAsociado || null
    };
    
    if (!payload.Id_Cliente || !payload.Id_Cooperativa) {
      const [clientes, cooperativas] = await Promise.all([
        crm.getClientes().catch(err => { console.error('Error obteniendo clientes:', err); return []; }),
        crm.getCooperativas().catch(err => { console.error('Error obteniendo cooperativas:', err); return []; })
      ]);
      
      return res.render('dashboard/cliente-cooperativa-editar', {
        title: 'Nueva Relación Cliente-Cooperativa - Farmadescaso',
        user: req.comercial || req.session.comercial,
        currentPage: 'clientes-cooperativas',
        clienteCooperativa: req.body,
        clientes: clientes || [],
        cooperativas: cooperativas || [],
        prefillClienteId: Number(req.body.Id_Cliente || 0) || null,
        returnTo: sanitizeReturnTo(req.body.returnTo) || '/dashboard/clientes-cooperativas',
        error: 'Cliente y Cooperativa son obligatorios',
        isNew: true
      });
    }

    const result = await crm.createClienteCooperativa(payload);
    console.log('📝 [CREAR RELACIÓN] Resultado completo:', JSON.stringify(result, null, 2));
    const clienteCooperativaId = result.insertId || result.Id || result.id;
    console.log('📝 [CREAR RELACIÓN] ID obtenido:', clienteCooperativaId);
    
    if (!clienteCooperativaId) {
      throw new Error('No se pudo obtener el ID de la relación creada');
    }

    const returnTo = sanitizeReturnTo(req.body.returnTo);
    if (returnTo) return res.redirect(withSuccess(returnTo, 'relacion_creada'));
    res.redirect(`/dashboard/clientes-cooperativas/${clienteCooperativaId}?success=relacion_creada`);
  } catch (error) {
    console.error('Error creando relación cliente-cooperativa:', error);
    const [clientes, cooperativas] = await Promise.all([
      crm.getClientes().catch(err => { console.error('Error obteniendo clientes:', err); return []; }),
      crm.getCooperativas().catch(err => { console.error('Error obteniendo cooperativas:', err); return []; })
    ]);
    
    res.render('dashboard/cliente-cooperativa-editar', {
      title: 'Nueva Relación Cliente-Cooperativa - Farmadescaso',
      user: req.comercial || req.session.comercial,
      currentPage: 'clientes-cooperativas',
      clienteCooperativa: req.body,
      clientes: clientes || [],
      cooperativas: cooperativas || [],
      prefillClienteId: Number(req.body.Id_Cliente || 0) || null,
      returnTo: sanitizeReturnTo(req.body.returnTo) || '/dashboard/clientes-cooperativas',
      error: error.message || 'Error al crear la relación',
      isNew: true
    });
  }
});

app.post('/dashboard/clientes-cooperativas/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = {
      Id_Cliente: parseInt(req.body.Id_Cliente),
      Id_Cooperativa: parseInt(req.body.Id_Cooperativa),
      NumAsociado: req.body.NumAsociado || null
    };
    
    if (!payload.Id_Cliente || !payload.Id_Cooperativa) {
      const clienteCooperativa = await crm.getClienteCooperativaById(id);
      const [clientes, cooperativas] = await Promise.all([
        crm.getClientes().catch(err => { console.error('Error obteniendo clientes:', err); return []; }),
        crm.getCooperativas().catch(err => { console.error('Error obteniendo cooperativas:', err); return []; })
      ]);
      
      return res.render('dashboard/cliente-cooperativa-editar', {
        title: `Relación #${id} - Editar`,
        user: req.comercial || req.session.comercial,
        currentPage: 'clientes-cooperativas',
        clienteCooperativa: clienteCooperativa || req.body,
        clientes: clientes || [],
        cooperativas: cooperativas || [],
        prefillClienteId: Number(req.body.Id_Cliente || 0) || null,
        returnTo: sanitizeReturnTo(req.body.returnTo) || `/dashboard/clientes-cooperativas/${id}`,
        error: 'Cliente y Cooperativa son obligatorios',
        isNew: false
      });
    }
    
    await crm.updateClienteCooperativa(id, payload);
    const returnTo = sanitizeReturnTo(req.body.returnTo);
    if (returnTo) return res.redirect(withSuccess(returnTo, 'relacion_actualizada'));
    res.redirect(`/dashboard/clientes-cooperativas/${id}?success=relacion_actualizada`);
  } catch (error) {
    console.error('Error actualizando relación cliente-cooperativa:', error);
    const clienteCooperativa = await crm.getClienteCooperativaById(req.params.id);
    const [clientes, cooperativas] = await Promise.all([
      crm.getClientes().catch(err => { console.error('Error obteniendo clientes:', err); return []; }),
      crm.getCooperativas().catch(err => { console.error('Error obteniendo cooperativas:', err); return []; })
    ]);
    
    res.render('dashboard/cliente-cooperativa-editar', {
      title: `Relación #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      currentPage: 'clientes-cooperativas',
      clienteCooperativa: clienteCooperativa || req.body,
      clientes: clientes || [],
      cooperativas: cooperativas || [],
      prefillClienteId: Number(req.body.Id_Cliente || 0) || null,
      returnTo: sanitizeReturnTo(req.body.returnTo) || `/dashboard/clientes-cooperativas/${req.params.id}`,
      error: error.message || 'Error al actualizar la relación',
      isNew: false
    });
  }
});

app.post('/dashboard/clientes-cooperativas/:id/eliminar', requireAuth, async (req, res) => {
  try {
    await crm.deleteClienteCooperativa(req.params.id);
    res.redirect('/dashboard/clientes-cooperativas?success=relacion_eliminada');
  } catch (error) {
    console.error('Error eliminando relación cliente-cooperativa:', error);
    res.redirect(`/dashboard/clientes-cooperativas/${req.params.id}?error=error_eliminando`);
  }
});

// Gestión de Formas_Pago
app.get('/dashboard/formas-pago', requireAuth, requireAdmin, async (req, res) => {
  try {
    const formasPago = await crm.getFormasPago();
    res.render('dashboard/formas-pago', {
      title: 'Formas de Pago - Farmadescaso',
      user: req.comercial || req.session.comercial,
      formasPago: formasPago || [],
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando formas de pago:', error);
    res.render('dashboard/formas-pago', {
      title: 'Formas de Pago - Farmadescaso',
      user: req.comercial || req.session.comercial,
      formasPago: [],
      error: 'Error cargando formas de pago',
      query: req.query
    });
  }
});

app.get('/dashboard/formas-pago/nuevo', requireAuth, requireAdmin, async (req, res) => {
  res.render('dashboard/forma-pago-editar', {
    title: 'Nueva Forma de Pago - Farmadescaso',
    user: req.comercial || req.session.comercial,
    formaPago: null,
    error: null,
    isNew: true
  });
});

app.get('/dashboard/formas-pago/:id/editar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const formaPago = await crm.getFormaPagoById(req.params.id);
    if (!formaPago) {
      return res.status(404).render('error', { error: 'Forma de pago no encontrada', message: 'La forma de pago no existe' });
    }
    res.render('dashboard/forma-pago-editar', {
      title: `Forma de Pago #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      formaPago,
      error: null,
      isNew: false
    });
  } catch (error) {
    console.error('Error cargando formulario de edición:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el formulario' });
  }
});

app.get('/dashboard/formas-pago/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const formaPago = await crm.getFormaPagoById(req.params.id);
    if (!formaPago) {
      return res.status(404).render('error', { error: 'Forma de pago no encontrada', message: 'La forma de pago no existe' });
    }
    res.render('dashboard/forma-pago-detalle', {
      title: `Forma de Pago #${req.params.id} - Detalle`,
      user: req.comercial || req.session.comercial,
      formaPago,
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando detalle de forma de pago:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar la forma de pago' });
  }
});

app.post('/dashboard/formas-pago', requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = {
      FormaPago: req.body.FormaPago,
      Dias: parseInt(req.body.Dias) || 0
    };
    
    if (!payload.FormaPago) {
      return res.render('dashboard/forma-pago-editar', {
        title: 'Nueva Forma de Pago - Farmadescaso',
        user: req.comercial || req.session.comercial,
        formaPago: req.body,
        error: 'Forma de Pago es obligatorio',
        isNew: true
      });
    }

    const result = await crm.createFormaPago(payload);
    const formaPagoId = result.insertId;
    res.redirect(`/dashboard/formas-pago/${formaPagoId}?success=forma_pago_creada`);
  } catch (error) {
    console.error('Error creando forma de pago:', error);
    res.render('dashboard/forma-pago-editar', {
      title: 'Nueva Forma de Pago - Farmadescaso',
      user: req.comercial || req.session.comercial,
      formaPago: req.body,
      error: error.message || 'Error al crear la forma de pago',
      isNew: true
    });
  }
});

app.post('/dashboard/formas-pago/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = {
      FormaPago: req.body.FormaPago,
      Dias: parseInt(req.body.Dias) || 0
    };
    
    await crm.updateFormaPago(id, payload);
    res.redirect(`/dashboard/formas-pago/${id}?success=forma_pago_actualizada`);
  } catch (error) {
    console.error('Error actualizando forma de pago:', error);
    const formaPago = await crm.getFormaPagoById(req.params.id);
    res.render('dashboard/forma-pago-editar', {
      title: `Forma de Pago #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      formaPago: formaPago || req.body,
      error: error.message || 'Error al actualizar la forma de pago',
      isNew: false
    });
  }
});

app.post('/dashboard/formas-pago/:id/eliminar', requireAuth, requireAdmin, async (req, res) => {
  try {
    await crm.deleteFormaPago(req.params.id);
    res.redirect('/dashboard/formas-pago?success=forma_pago_eliminada');
  } catch (error) {
    console.error('Error eliminando forma de pago:', error);
    res.redirect(`/dashboard/formas-pago/${req.params.id}?error=error_eliminando`);
  }
});

// Gestión de Especialidades
function sanitizeReturnTo(returnTo) {
  if (!returnTo) return null;
  let s = String(returnTo || '').trim();
  if (!s) return null;

  // Si llega URL-encoded (p.ej. "%2Fdashboard%2Fclientes%2F764%2Feditar"), intentar decodificarlo.
  // Esto evita que un href con "%2F..." se trate como ruta relativa y acabe en URLs inválidas.
  try {
    if (/%2f/i.test(s) || /%3f/i.test(s) || /%26/i.test(s) || /%3d/i.test(s)) {
      s = decodeURIComponent(s);
    }
  } catch (_) {
    // Si decode falla, seguimos con el valor original
  }

  if (!s) return null;
  if (s.includes('://')) return null; // evita open redirect
  if (!s.startsWith('/dashboard')) return null;
  return s;
}

function withSuccess(url, successValue) {
  if (!url) return null;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}success=${encodeURIComponent(successValue)}`;
}

app.get('/dashboard/especialidades', requireAuth, async (req, res) => {
  try {
    const especialidades = await crm.getEspecialidades();
    res.render('dashboard/especialidades', {
      title: 'Especialidades - Farmadescaso',
      user: req.comercial || req.session.comercial,
      especialidades: especialidades || [],
      error: null,
      currentUrl: req.originalUrl,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando especialidades:', error);
    res.render('dashboard/especialidades', {
      title: 'Especialidades - Farmadescaso',
      user: req.comercial || req.session.comercial,
      especialidades: [],
      error: 'Error cargando especialidades',
      currentUrl: req.originalUrl,
      query: req.query
    });
  }
});

// ============================================
// CONTACTOS (CRUD) + vistas de relación
// ============================================

app.get('/dashboard/contactos', requireAuth, async (req, res) => {
  try {
    const userForView = req.comercial || req.session?.comercial || req.user || null;
    const esAdmin = getUserIsAdmin(req);

    const q = String(req.query.q || '').trim();
    const includeInactivos = String(req.query.includeInactivos || '0') === '1';
    const contactos = await crm.getContactos({
      search: q || '',
      includeInactivos,
      limit: 500,
      offset: 0
    });

    res.render('dashboard/contactos', {
      title: 'Contactos - Farmadescaso',
      user: userForView,
      esAdmin,
      isAdmin: esAdmin,
      currentPage: 'contactos',
      contactos: contactos || [],
      query: req.query,
      error: null
    });
  } catch (error) {
    console.error('❌ Error cargando contactos (dashboard):', error);
    const msg = String(error?.sqlMessage || error?.message || 'Error desconocido');
    const isNoSuchTable =
      msg.toLowerCase().includes("doesn't exist") ||
      msg.toLowerCase().includes('no such table') ||
      String(error?.code || '').toUpperCase() === 'ER_NO_SUCH_TABLE';

    const errorMsg = isNoSuchTable
      ? 'No existe la tabla `contactos` en la base de datos. Ejecuta primero el script: scripts/crear-contactos-y-clientes_contactos.sql (y, si quieres importar los contactos existentes de clientes, ejecuta scripts/migrar-contactos-desde-clientes.sql).'
      : msg;

    res.render('dashboard/contactos', {
      title: 'Contactos - Farmadescaso',
      user: req.comercial || req.session?.comercial || req.user || null,
      esAdmin: getUserIsAdmin(req),
      isAdmin: getUserIsAdmin(req),
      currentPage: 'contactos',
      contactos: [],
      query: req.query,
      error: errorMsg
    });
  }
});

app.get('/dashboard/contactos/nuevo', requireAuth, async (req, res) => {
  const userForView = req.comercial || req.session?.comercial || req.user || null;
  const esAdmin = getUserIsAdmin(req);
  res.render('dashboard/contacto-editar', {
    title: 'Nuevo Contacto - Farmadescaso',
    user: userForView,
    esAdmin,
    isAdmin: esAdmin,
    currentPage: 'contactos',
    isNew: true,
    contacto: null,
    error: null
  });
});

app.post('/dashboard/contactos/nuevo', requireAuth, async (req, res) => {
  try {
    const payload = {
      Nombre: (req.body.Nombre || '').trim(),
      Apellidos: (req.body.Apellidos || '').trim() || null,
      Cargo: (req.body.Cargo || '').trim() || null,
      Especialidad: (req.body.Especialidad || '').trim() || null,
      Email: (req.body.Email || '').trim() || null,
      Movil: (req.body.Movil || '').trim() || null,
      Telefono: (req.body.Telefono || '').trim() || null,
      Extension: (req.body.Extension || '').trim() || null,
      Notas: (req.body.Notas || '').trim() || null,
      Activo: String(req.body.Activo || '1') === '1' ? 1 : 0
    };

    const result = await crm.createContacto(payload);
    res.redirect(`/dashboard/contactos/${result.insertId}?success=contacto_creado`);
  } catch (error) {
    const userForView = req.comercial || req.session?.comercial || req.user || null;
    const esAdmin = getUserIsAdmin(req);
    res.render('dashboard/contacto-editar', {
      title: 'Nuevo Contacto - Farmadescaso',
      user: userForView,
      esAdmin,
      isAdmin: esAdmin,
      currentPage: 'contactos',
      isNew: true,
      contacto: req.body || null,
      error: error.message
    });
  }
});

app.get('/dashboard/contactos/:id/editar', requireAuth, async (req, res) => {
  try {
    const contacto = await crm.getContactoById(req.params.id);
    if (!contacto) {
      return res.status(404).render('error', { error: 'Contacto no encontrado', message: 'El contacto no existe' });
    }
    const userForView = req.comercial || req.session?.comercial || req.user || null;
    const esAdmin = getUserIsAdmin(req);
    res.render('dashboard/contacto-editar', {
      title: `Editar Contacto #${contacto.Id}`,
      user: userForView,
      esAdmin,
      isAdmin: esAdmin,
      currentPage: 'contactos',
      isNew: false,
      contacto,
      error: null
    });
  } catch (error) {
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el contacto' });
  }
});

app.post('/dashboard/contactos/:id/editar', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) throw new Error('ID inválido');

    const payload = {
      Nombre: (req.body.Nombre || '').trim(),
      Apellidos: (req.body.Apellidos || '').trim() || null,
      Cargo: (req.body.Cargo || '').trim() || null,
      Especialidad: (req.body.Especialidad || '').trim() || null,
      Email: (req.body.Email || '').trim() || null,
      Movil: (req.body.Movil || '').trim() || null,
      Telefono: (req.body.Telefono || '').trim() || null,
      Extension: (req.body.Extension || '').trim() || null,
      Notas: (req.body.Notas || '').trim() || null,
      Activo: String(req.body.Activo || '1') === '1' ? 1 : 0
    };

    await crm.updateContacto(id, payload);
    res.redirect(`/dashboard/contactos/${id}?success=contacto_actualizado`);
  } catch (error) {
    console.error('❌ Error actualizando contacto (dashboard):', error);
    res.redirect(`/dashboard/contactos/${req.params.id}?error=contacto_actualizar_error`);
  }
});

app.get('/dashboard/contactos/:id/clientes', requireAuth, async (req, res) => {
  try {
    const contacto = await crm.getContactoById(req.params.id);
    if (!contacto) {
      return res.status(404).render('error', { error: 'Contacto no encontrado', message: 'El contacto no existe' });
    }

    const includeHistorico = String(req.query.includeHistorico || '') === '1' || String(req.query.includeHistorico || '').toLowerCase() === 'true';
    const relaciones = await crm.getClientesByContacto(Number(contacto.Id), { includeHistorico });

    const userForView = req.comercial || req.session?.comercial || req.user || null;
    const esAdmin = getUserIsAdmin(req);

    res.render('dashboard/contacto-clientes', {
      title: `Clientes del contacto #${contacto.Id}`,
      user: userForView,
      esAdmin,
      isAdmin: esAdmin,
      currentPage: 'contactos',
      contacto,
      relaciones: relaciones || [],
      query: req.query,
      error: null
    });
  } catch (error) {
    console.error('❌ Error cargando clientes del contacto (dashboard):', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudieron cargar los clientes del contacto' });
  }
});

app.post('/dashboard/contactos/:id/clientes/vincular', requireAuth, async (req, res) => {
  try {
    const contactoId = Number(req.params.id);
    const clienteId = Number(req.body.clienteId);
    if (!Number.isFinite(contactoId) || contactoId <= 0) throw new Error('contactoId inválido');
    if (!Number.isFinite(clienteId) || clienteId <= 0) throw new Error('clienteId inválido');

    const options = {
      Rol: (req.body.Rol || '').trim() || null,
      Notas: (req.body.Notas || '').trim() || null,
      Es_Principal: String(req.body.Es_Principal || '0') === '1'
    };

    await crm.vincularContactoACliente(clienteId, contactoId, options);
    res.redirect(`/dashboard/contactos/${contactoId}/clientes?success=vinculo_creado`);
  } catch (error) {
    console.error('❌ Error vinculando cliente a contacto (dashboard):', error);
    res.redirect(`/dashboard/contactos/${req.params.id}/clientes?error=vinculo_error`);
  }
});

app.post('/dashboard/contactos/:id/clientes/:clienteId/cerrar', requireAuth, async (req, res) => {
  try {
    const contactoId = Number(req.params.id);
    const clienteId = Number(req.params.clienteId);
    if (!Number.isFinite(contactoId) || contactoId <= 0) throw new Error('contactoId inválido');
    if (!Number.isFinite(clienteId) || clienteId <= 0) throw new Error('clienteId inválido');

    await crm.cerrarVinculoContactoCliente(clienteId, contactoId, { MotivoBaja: null });
    res.redirect(`/dashboard/contactos/${contactoId}/clientes?success=vinculo_cerrado`);
  } catch (error) {
    console.error('❌ Error cerrando vínculo (dashboard contacto->clientes):', error);
    res.redirect(`/dashboard/contactos/${req.params.id}/clientes?error=cerrar_error`);
  }
});

app.get('/dashboard/contactos/:id', requireAuth, async (req, res) => {
  try {
    // Evitar conflicto con /dashboard/contactos/nuevo
    if (req.params.id === 'nuevo') return res.redirect('/dashboard/contactos/nuevo');

    const contacto = await crm.getContactoById(req.params.id);
    if (!contacto) {
      return res.status(404).render('error', { error: 'Contacto no encontrado', message: 'El contacto no existe' });
    }

    const userForView = req.comercial || req.session?.comercial || req.user || null;
    const esAdmin = getUserIsAdmin(req);

    res.render('dashboard/contacto-detalle', {
      title: `Contacto #${contacto.Id} - Detalle`,
      user: userForView,
      esAdmin,
      isAdmin: esAdmin,
      currentPage: 'contactos',
      contacto,
      query: req.query,
      error: null
    });
  } catch (error) {
    console.error('❌ Error cargando detalle de contacto:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el contacto' });
  }
});

app.get('/dashboard/especialidades/nuevo', requireAuth, async (req, res) => {
  res.render('dashboard/especialidad-editar', {
    title: 'Nueva Especialidad - Farmadescaso',
    user: req.comercial || req.session.comercial,
    especialidad: null,
    error: null,
    returnTo: sanitizeReturnTo(req.query.returnTo) || '/dashboard/especialidades',
    isNew: true
  });
});

app.get('/dashboard/especialidades/:id/editar', requireAuth, async (req, res) => {
  try {
    const especialidad = await crm.getEspecialidadById(req.params.id);
    if (!especialidad) {
      return res.status(404).render('error', { error: 'Especialidad no encontrada', message: 'La especialidad no existe' });
    }
    res.render('dashboard/especialidad-editar', {
      title: `Especialidad #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      especialidad,
      error: null,
      returnTo: sanitizeReturnTo(req.query.returnTo) || `/dashboard/especialidades/${req.params.id}`,
      isNew: false
    });
  } catch (error) {
    console.error('Error cargando formulario de edición:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el formulario' });
  }
});

app.get('/dashboard/especialidades/:id', requireAuth, async (req, res) => {
  try {
    const especialidad = await crm.getEspecialidadById(req.params.id);
    if (!especialidad) {
      return res.status(404).render('error', { error: 'Especialidad no encontrada', message: 'La especialidad no existe' });
    }
    res.render('dashboard/especialidad-detalle', {
      title: `Especialidad #${req.params.id} - Detalle`,
      user: req.comercial || req.session.comercial,
      especialidad,
      error: null,
      currentUrl: req.originalUrl,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando detalle de especialidad:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar la especialidad' });
  }
});

app.post('/dashboard/especialidades', requireAuth, async (req, res) => {
  try {
    const payload = {
      Especialidad: req.body.Especialidad,
      Observaciones: (req.body.Observaciones || '').trim() || null
    };
    
    if (!payload.Especialidad) {
      return res.render('dashboard/especialidad-editar', {
        title: 'Nueva Especialidad - Farmadescaso',
        user: req.comercial || req.session.comercial,
        especialidad: req.body,
        error: 'Especialidad es obligatorio',
        returnTo: sanitizeReturnTo(req.body.returnTo) || '/dashboard/especialidades',
        isNew: true
      });
    }

    const result = await crm.createEspecialidad(payload);
    const especialidadId = result.insertId;
    const returnTo = sanitizeReturnTo(req.body.returnTo);
    if (returnTo) return res.redirect(withSuccess(returnTo, 'especialidad_creada'));
    res.redirect(`/dashboard/especialidades/${especialidadId}?success=especialidad_creada`);
  } catch (error) {
    console.error('Error creando especialidad:', error);
    res.render('dashboard/especialidad-editar', {
      title: 'Nueva Especialidad - Farmadescaso',
      user: req.comercial || req.session.comercial,
      especialidad: req.body,
      error: error.message || 'Error al crear la especialidad',
      returnTo: sanitizeReturnTo(req.body.returnTo) || '/dashboard/especialidades',
      isNew: true
    });
  }
});

app.post('/dashboard/especialidades/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = {
      Especialidad: req.body.Especialidad,
      Observaciones: (req.body.Observaciones || '').trim() || null
    };
    
    await crm.updateEspecialidad(id, payload);
    const returnTo = sanitizeReturnTo(req.body.returnTo);
    if (returnTo) return res.redirect(withSuccess(returnTo, 'especialidad_actualizada'));
    res.redirect(`/dashboard/especialidades/${id}?success=especialidad_actualizada`);
  } catch (error) {
    console.error('Error actualizando especialidad:', error);
    const especialidad = await crm.getEspecialidadById(req.params.id);
    res.render('dashboard/especialidad-editar', {
      title: `Especialidad #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      especialidad: especialidad || req.body,
      error: error.message || 'Error al actualizar la especialidad',
      returnTo: sanitizeReturnTo(req.body.returnTo) || `/dashboard/especialidades/${req.params.id}`,
      isNew: false
    });
  }
});

app.post('/dashboard/especialidades/:id/eliminar', requireAuth, async (req, res) => {
  try {
    await crm.deleteEspecialidad(req.params.id);
    res.redirect('/dashboard/especialidades?success=especialidad_eliminada');
  } catch (error) {
    console.error('Error eliminando especialidad:', error);
    res.redirect(`/dashboard/especialidades/${req.params.id}?error=error_eliminando`);
  }
});

// Gestión de Especialidades
app.get('/dashboard/especialidades', requireAuth, async (req, res) => {
  try {
    const especialidades = await crm.getEspecialidades();
    res.render('dashboard/especialidades', {
      title: 'Especialidades - Farmadescaso',
      user: req.comercial || req.session.comercial,
      especialidades: especialidades || [],
      error: null,
      currentUrl: req.originalUrl,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando especialidades:', error);
    res.render('dashboard/especialidades', {
      title: 'Especialidades - Farmadescaso',
      user: req.comercial || req.session.comercial,
      especialidades: [],
      error: 'Error cargando especialidades',
      currentUrl: req.originalUrl,
      query: req.query
    });
  }
});

app.get('/dashboard/especialidades/nuevo', requireAuth, async (req, res) => {
  res.render('dashboard/especialidad-editar', {
    title: 'Nueva Especialidad - Farmadescaso',
    user: req.comercial || req.session.comercial,
    especialidad: null,
    error: null,
    returnTo: sanitizeReturnTo(req.query.returnTo) || '/dashboard/especialidades',
    isNew: true
  });
});

app.get('/dashboard/especialidades/:id/editar', requireAuth, async (req, res) => {
  try {
    const especialidad = await crm.getEspecialidadById(req.params.id);
    if (!especialidad) {
      return res.status(404).render('error', { error: 'Especialidad no encontrada', message: 'La especialidad no existe' });
    }
    res.render('dashboard/especialidad-editar', {
      title: `Especialidad #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      especialidad,
      error: null,
      returnTo: sanitizeReturnTo(req.query.returnTo) || `/dashboard/especialidades/${req.params.id}`,
      isNew: false
    });
  } catch (error) {
    console.error('Error cargando formulario de edición:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar el formulario' });
  }
});

app.get('/dashboard/especialidades/:id', requireAuth, async (req, res) => {
  try {
    const especialidad = await crm.getEspecialidadById(req.params.id);
    if (!especialidad) {
      return res.status(404).render('error', { error: 'Especialidad no encontrada', message: 'La especialidad no existe' });
    }
    res.render('dashboard/especialidad-detalle', {
      title: `Especialidad #${req.params.id} - Detalle`,
      user: req.comercial || req.session.comercial,
      especialidad,
      error: null,
      currentUrl: req.originalUrl,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando detalle de especialidad:', error);
    res.status(500).render('error', { error: 'Error', message: 'No se pudo cargar la especialidad' });
  }
});

app.post('/dashboard/especialidades', requireAuth, async (req, res) => {
  try {
    const payload = {
      Especialidad: req.body.Especialidad || null,
      Observaciones: (req.body.Observaciones || '').trim() || null
    };
    
    if (!payload.Especialidad) {
      return res.render('dashboard/especialidad-editar', {
        title: 'Nueva Especialidad - Farmadescaso',
        user: req.comercial || req.session.comercial,
        especialidad: req.body,
        error: 'Especialidad es obligatorio',
        returnTo: sanitizeReturnTo(req.body.returnTo) || '/dashboard/especialidades',
        isNew: true
      });
    }

    const result = await crm.createEspecialidad(payload);
    const especialidadId = result.insertId;
    const returnTo = sanitizeReturnTo(req.body.returnTo);
    if (returnTo) return res.redirect(withSuccess(returnTo, 'especialidad_creada'));
    res.redirect(`/dashboard/especialidades/${especialidadId}?success=especialidad_creada`);
  } catch (error) {
    console.error('Error creando especialidad:', error);
    res.render('dashboard/especialidad-editar', {
      title: 'Nueva Especialidad - Farmadescaso',
      user: req.comercial || req.session.comercial,
      especialidad: req.body,
      error: error.message || 'Error al crear la especialidad',
      returnTo: sanitizeReturnTo(req.body.returnTo) || '/dashboard/especialidades',
      isNew: true
    });
  }
});

app.post('/dashboard/especialidades/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = {
      Especialidad: req.body.Especialidad || null,
      Observaciones: (req.body.Observaciones || '').trim() || null
    };
    
    await crm.updateEspecialidad(id, payload);
    const returnTo = sanitizeReturnTo(req.body.returnTo);
    if (returnTo) return res.redirect(withSuccess(returnTo, 'especialidad_actualizada'));
    res.redirect(`/dashboard/especialidades/${id}?success=especialidad_actualizada`);
  } catch (error) {
    console.error('Error actualizando especialidad:', error);
    const especialidad = await crm.getEspecialidadById(req.params.id);
    res.render('dashboard/especialidad-editar', {
      title: `Especialidad #${req.params.id} - Editar`,
      user: req.comercial || req.session.comercial,
      especialidad: especialidad || req.body,
      error: error.message || 'Error al actualizar la especialidad',
      returnTo: sanitizeReturnTo(req.body.returnTo) || `/dashboard/especialidades/${req.params.id}`,
      isNew: false
    });
  }
});

app.post('/dashboard/especialidades/:id/eliminar', requireAuth, async (req, res) => {
  try {
    await crm.deleteEspecialidad(req.params.id);
    res.redirect('/dashboard/especialidades?success=especialidad_eliminada');
  } catch (error) {
    console.error('Error eliminando especialidad:', error);
    res.redirect(`/dashboard/especialidades/${req.params.id}?error=error_eliminando`);
  }
});

// Gestión de pedidos
app.get('/dashboard/pedidos', requireAuth, async (req, res) => {
  try {
    // Obtener el ID del comercial autenticado
    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    
    // Si no es admin, filtrar por el comercial autenticado
    const comercialIdFiltro = (!esAdmin && comercialIdAutenticado) ? comercialIdAutenticado : null;
    
    console.log('📋 [LISTADO PEDIDOS] Obteniendo pedidos...');
    console.log(`🔐 [PEDIDOS] Usuario: ${esAdmin ? 'Admin' : 'Comercial'} (ID: ${comercialIdAutenticado})`);
    console.log(`🔐 [PEDIDOS] Filtro aplicado: ${comercialIdFiltro ? `Comercial ${comercialIdFiltro}` : 'Todos'}`);
    
    const pedidosRaw = await crm.getPedidos(comercialIdFiltro);
    console.log(`📊 [LISTADO PEDIDOS] Pedidos raw obtenidos: ${pedidosRaw ? pedidosRaw.length : 0}`);
    
    if (pedidosRaw && pedidosRaw.length > 0) {
      console.log(`📋 [LISTADO PEDIDOS] Primer pedido (muestra):`, {
        Id: pedidosRaw[0].Id || pedidosRaw[0].id,
        NumPedido: pedidosRaw[0].NumPedido || pedidosRaw[0].Numero_Pedido || pedidosRaw[0].numero,
        FechaPedido: pedidosRaw[0].FechaPedido || pedidosRaw[0]['Fecha Pedido'] || pedidosRaw[0].fecha,
        Cliente_id: pedidosRaw[0].Cliente_id || pedidosRaw[0].Id_Cliente,
        Id_Cial: pedidosRaw[0].Id_Cial || pedidosRaw[0].Comercial_id,
        todasLasClaves: Object.keys(pedidosRaw[0])
      });
    }
    
    // Cargar todos los artículos de una vez para optimizar
    let articulosMap = null;
    try {
      const todosArticulos = await crm.getArticulos();
      articulosMap = new Map();
      todosArticulos.forEach(art => {
        const id = art.Id || art.id;
        if (id) {
          articulosMap.set(Number(id), art);
        }
      });
    } catch (error) {
      console.warn('⚠️ Error cargando artículos para optimización:', error.message);
    }

    // Cargar todas las marcas de una vez para optimizar
    let marcasMap = null;
    try {
      const todasMarcas = await crm.query('SELECT id, Nombre FROM marcas');
      marcasMap = new Map();
      todasMarcas.forEach(marca => {
        const id = marca.id || marca.Id;
        if (id) {
          marcasMap.set(Number(id), marca.Nombre || marca.nombre);
        }
      });
    } catch (error) {
      console.warn('⚠️ Error cargando marcas para optimización:', error.message);
    }

    // Cargar todos los comerciales de una vez para poder mostrar iniciales en el listado
    let comercialesMap = null;
    try {
      const comercialesRows = await crm.query('SELECT id, Nombre FROM comerciales');
      comercialesMap = new Map();
      (comercialesRows || []).forEach(c => {
        const id = c.id || c.Id;
        if (id) {
          comercialesMap.set(Number(id), c.Nombre || c.nombre || '');
        }
      });
    } catch (error) {
      console.warn('⚠️ Error cargando comerciales para iniciales:', error.message);
    }

    function obtenerInicialesComercial(nombre, maxLen = 3) {
      if (!nombre) return '';
      try {
        const stopWords = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y']);
        const limpio = String(nombre)
          .trim()
          .replace(/\s+/g, ' ')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, ''); // quitar acentos

        const partes = limpio
          .split(' ')
          .map(p => p.replace(/[^A-Za-zÑñ]/g, '').toUpperCase())
          .filter(Boolean)
          .filter(p => !stopWords.has(p));

        const iniciales = partes.map(p => p[0]).join('');
        return iniciales.slice(0, maxLen);
      } catch (_) {
        return '';
      }
    }
 
    // (Diagnóstico desactivado)

    // Calcular totales con IVA para cada pedido
    const pedidos = await Promise.all((pedidosRaw || []).map(async (pedido) => {
      const id = pedido.Id || pedido.id;
      // Usar el nombre correcto de la columna: FechaPedido (pero en algunos entornos puede venir con otros alias/casing)
      const fecha = pedido.FechaPedido
        || pedido.Fecha_Pedido
        || pedido['Fecha_Pedido']
        || pedido['Fecha Pedido']
        || pedido.fecha_pedido
        || pedido.fechaPedido
        || pedido.fechapedido
        || pedido.fecha
        || pedido.Fecha
        || pedido.CreatedAt
        || pedido.created_at
        || pedido.CreadoEn
        || pedido.creado_en
        || null;
      const numeroRaw = pedido.NumPedido || pedido['Número_Pedido'] || pedido['Número Pedido'] || pedido.Numero_Pedido || pedido.NumeroPedido || pedido.numero || pedido.Numero || id;
      const numeroOrden = obtenerParteNumericaPedido(numeroRaw, fecha) || 0;
      const numero = formatearNumeroPedido(numeroRaw, fecha) || `P${String(new Date().getFullYear()).slice(-2)}${String(numeroOrden || id).padStart(4, '0')}`;
      // Normalizar cliente: puede venir como Cliente_id, Id_Cliente, o ClienteId
      const clienteObj = pedido.Id_Cliente || pedido.Cliente_id || pedido.ClienteId;
      let clienteNombre = 'Sin cliente';
      
      if (clienteObj) {
        if (typeof clienteObj === 'object') {
          clienteNombre = clienteObj.Nombre || clienteObj.nombre || clienteObj.name || 'Sin cliente';
        } else if (typeof clienteObj === 'number' || typeof clienteObj === 'string') {
          // Si es solo un ID, intentar obtener el nombre del cliente
          try {
            const cliente = await crm.getClienteById(Number(clienteObj));
            if (cliente) {
              clienteNombre = cliente.Nombre || cliente.Nombre_Razon_Social || cliente.nombre || 'Sin cliente';
            }
          } catch (err) {
            console.warn(`⚠️ No se pudo obtener nombre del cliente ${clienteObj}:`, err.message);
            clienteNombre = `Cliente #${clienteObj}`;
          }
        } else {
          clienteNombre = String(clienteObj);
        }
      }
      
      // Normalizar estado: puede venir como Estado, EstadoPedido, o estado
      const estado = pedido.EstadoPedido || pedido.Estado || pedido.estado || 'Pendiente';

      // Comercial asignado al pedido (Id_Cial es el campo correcto en BD, con fallbacks por casing/alias)
      const comercialIdPedidoRaw =
        pedido.Id_Cial ??
        pedido.id_cial ??
        pedido.Comercial_id ??
        pedido.comercial_id ??
        pedido.ComercialId ??
        pedido.comercialId ??
        null;
      const comercial_id = comercialIdPedidoRaw ? Number(comercialIdPedidoRaw) : null;
      const comercial_nombre = (comercialesMap && comercial_id) ? (comercialesMap.get(Number(comercial_id)) || '') : '';
      const comercial_iniciales = obtenerInicialesComercial(comercial_nombre);
      
      // Normalizar fecha entrega - usar el nombre correcto de la columna (con fallbacks por alias/casing)
      const fechaEntrega = pedido.FechaEntrega
        || pedido.Fecha_Entrega
        || pedido['Fecha_Entrega']
        || pedido['Fecha Entrega']
        || pedido.fecha_entrega
        || pedido.fechaEntrega
        || pedido.fechaentrega
        || null;
      
      // Normalizar forma de pago - obtener desde Id_FormaPago
      let formaPago = '—';
      if (pedido.Id_FormaPago) {
        try {
          const formaPagoObj = await crm.getFormaPagoById(Number(pedido.Id_FormaPago));
          if (formaPagoObj) {
            formaPago = formaPagoObj.FormaPago || formaPagoObj.Forma || formaPagoObj.forma || '—';
          }
        } catch (err) {
          console.warn(`⚠️ No se pudo obtener forma de pago ${pedido.Id_FormaPago}:`, err.message);
        }
      }
      
      // Normalizar tipo de pedido - obtener desde Id_TipoPedido
      let tipoPedido = '—';
      if (pedido.Id_TipoPedido) {
        try {
          const tipoPedidoObj = await crm.query('SELECT Tipo FROM tipos_pedidos WHERE id = ? LIMIT 1', [Number(pedido.Id_TipoPedido)]);
          if (tipoPedidoObj && tipoPedidoObj.length > 0) {
            tipoPedido = tipoPedidoObj[0].Tipo || '—';
          }
        } catch (err) {
          console.warn(`⚠️ No se pudo obtener tipo de pedido ${pedido.Id_TipoPedido}:`, err.message);
        }
      }
      
      // Obtener número de cooperativa y nombre (solo para pedidos Transfer)
      let numeroCooperativa = pedido.numero_cooperativa || pedido['numero_cooperativa'] || null;
      let cooperativaNombre = pedido.cooperativa_nombre || pedido['cooperativa_nombre'] || null;
      
      // Si es un pedido Transfer y no tenemos el número de asociado, buscarlo en clientes_cooperativas
      const tipoPedidoLower = (tipoPedido || '').toLowerCase();
      if (tipoPedidoLower.includes('transfer') && clienteObj && !numeroCooperativa) {
        try {
          const clienteIdNumber = typeof clienteObj === 'object' 
            ? (clienteObj.Id || clienteObj.id) 
            : Number(clienteObj);
          
          if (!Number.isNaN(clienteIdNumber) && clienteIdNumber > 0) {
            // Mapear tipo de pedido a nombre de cooperativa
            const transferMap = {
              'transfer hefame': 'HEFAME',
              'transfer alliance': 'ALLIANCE',
              'transfer cofares': 'COFARES'
            };
            
            let nombreCooperativaBuscado = null;
            for (const [key, nombre] of Object.entries(transferMap)) {
              if (tipoPedidoLower.includes(key.replace('transfer ', ''))) {
                nombreCooperativaBuscado = nombre;
                break;
              }
            }
            
            if (nombreCooperativaBuscado) {
              const relaciones = await crm.getCooperativasByClienteId(clienteIdNumber);
              if (relaciones && relaciones.length > 0) {
                const relacionEncontrada = relaciones.find(r => {
                  const nombreRelacion = (r.Nombre || r.nombre || '').toUpperCase().trim();
                  return nombreRelacion === nombreCooperativaBuscado.toUpperCase();
                });
                
                if (relacionEncontrada && relacionEncontrada.NumAsociado) {
                  numeroCooperativa = relacionEncontrada.NumAsociado;
                  cooperativaNombre = nombreCooperativaBuscado;
                }
              }
            }
          }
        } catch (err) {
          console.warn(`⚠️ Error obteniendo número de asociado para pedido ${id}:`, err.message);
        }
      }
      
      // Calcular total con IVA desde las líneas del pedido
      // Usar el nombre correcto de la columna: TotalPedido
      let total = Number(pedido.TotalPedido || pedido.Total_pedido || pedido.Total_pedido_ || pedido.total || 0);
      let lineasCount = 0;
      let marcas = [];
      let esMixto = false;
      
      try {
        // Buscar líneas usando NumPedido (la tabla pedidos_articulos usa NumPedido, no Id_Pedido)
        const lineasRaw = await crm.query(
          'SELECT * FROM pedidos_articulos WHERE NumPedido = ?',
          [numeroRaw]
        );
        if (lineasRaw && lineasRaw.length > 0) {
          lineasCount = lineasRaw.length;
          // Calcular total sumando todas las líneas
          const totalCalculado = lineasRaw.reduce((sum, linea) => {
            const subtotal = Number(linea.Subtotal || linea.SubTotal || 0);
            const iva = Number(linea.IVA || linea.iva || 0);
            const totalLinea = subtotal + (subtotal * (iva / 100));
            return sum + totalLinea;
          }, 0);
          if (totalCalculado > 0) {
            total = totalCalculado;
          } else {
            // Si no se puede calcular desde líneas y no hay líneas, el total es 0
            // (no usar TotalPedido almacenado si no hay líneas, puede estar desactualizado)
            total = lineasCount > 0 ? Number(pedido.TotalPedido || pedido.Total_pedido || 0) : 0;
          }
          
          // Obtener marcas de los productos del pedido
          const marcasSet = new Set();
          if (articulosMap && marcasMap) {
            for (const linea of lineasRaw) {
              const articuloId = linea.Id_Articulo || linea.articuloId;
              if (articuloId) {
                const articulo = articulosMap.get(Number(articuloId));
                if (articulo && articulo.Id_Marca) {
                  const marcaNombre = marcasMap.get(Number(articulo.Id_Marca));
                  if (marcaNombre) {
                    marcasSet.add(marcaNombre);
                  }
                }
              }
            }
          }
          marcas = Array.from(marcasSet);
          esMixto = marcas.length > 1;
        } else {
          // Si no hay líneas, el total debe ser 0 (no usar TotalPedido almacenado)
          total = 0;
        }
      } catch (error) {
        console.warn(`⚠️ Error calculando total para pedido ${id}:`, error.message);
        // Si hay error, usar el total del pedido
        total = Number(pedido.TotalPedido || pedido.Total_pedido || 0);
      }
 
      return {
        id,
        numero,
        numeroOrden,
        cliente: clienteNombre,
        comercial_id,
        comercial_nombre,
        comercial_iniciales,
        estado,
        fecha,
        fechaEntrega,
        formaPago,
        tipoPedido,
        total,
        lineas: lineasCount,
        numero_cooperativa: numeroCooperativa,
        cooperativa_nombre: cooperativaNombre,
        marcas: marcas,
        esMixto: esMixto
      };
    }));

    // (Diagnóstico desactivado)
    
    // Ordenar por número de orden
    pedidos.sort((a, b) => (b.numeroOrden || 0) - (a.numeroOrden || 0));

    const resumen = pedidos.reduce((acc, pedido) => {
      acc.totalPedidos += 1;
      acc.totalImporte += pedido.total || 0;
      if ((pedido.estado || '').toLowerCase().includes('pend')) acc.pendientes += 1;
      if ((pedido.estado || '').toLowerCase().includes('complet')) acc.completados += 1;
      return acc;
    }, { totalPedidos: 0, pendientes: 0, completados: 0, totalImporte: 0 });

    // Obtener todas las marcas disponibles para el filtro
    let marcasDisponibles = [];
    try {
      const marcasRaw = await crm.query('SELECT id, Nombre FROM marcas ORDER BY Nombre ASC');
      marcasDisponibles = marcasRaw.map(m => ({
        id: m.id || m.Id,
        nombre: m.Nombre || m.nombre
      }));
    } catch (error) {
      console.warn('⚠️ Error obteniendo marcas para filtro:', error.message);
    }

    res.render('dashboard/pedidos', {
      title: 'Gestión de Pedidos - Farmadescaso',
      user: req.comercial || req.session.comercial,
      pedidos: pedidos ? pedidos.map(p => normalizeObjectUTF8(p)) : [],
      resumen,
      marcasDisponibles: marcasDisponibles ? marcasDisponibles.map(m => normalizeObjectUTF8(m)) : [],
      query: req.query,
      error: null
    });
  } catch (error) {
    console.error('Error cargando pedidos:', error);
    res.render('dashboard/pedidos', {
      title: 'Gestión de Pedidos - Farmadescaso',
      user: req.comercial || req.session.comercial,
      pedidos: [],
      resumen: { totalPedidos: 0, pendientes: 0, completados: 0, totalImporte: 0 },
      query: req.query,
      error: 'Error cargando pedidos del sistema'
    });
  }
});

// Informe completo de pedidos
app.get('/dashboard/pedidos/informe', requireAuth, async (req, res) => {
  try {
    console.log('📊 [INFORME PEDIDOS] Generando informe completo de pedidos...');
    const pedidosRaw = await crm.getPedidos();
    console.log(`📊 [INFORME PEDIDOS] Total pedidos encontrados: ${pedidosRaw ? pedidosRaw.length : 0}`);
    
    // Cargar todos los artículos de una vez para optimizar
    let articulosMap = null;
    try {
      const todosArticulos = await crm.getArticulos();
      articulosMap = new Map();
      todosArticulos.forEach(art => {
        const id = art.Id || art.id;
        if (id) {
          articulosMap.set(Number(id), art);
        }
      });
    } catch (error) {
      console.warn('⚠️ Error cargando artículos para informe:', error.message);
    }

    // Obtener información completa de cada pedido
    const pedidosCompletos = await Promise.all((pedidosRaw || []).map(async (pedidoRaw) => {
      const id = pedidoRaw.Id || pedidoRaw.id;
      const fecha = pedidoRaw.FechaPedido || pedidoRaw['Fecha Pedido'] || pedidoRaw.fecha || null;
      const numeroRaw = pedidoRaw.NumPedido || pedidoRaw['Número_Pedido'] || pedidoRaw['Número Pedido'] || 
                       pedidoRaw.Numero_Pedido || pedidoRaw.NumeroPedido || pedidoRaw.numero || id;
      const numero = formatearNumeroPedido(numeroRaw, fecha) || `P${String(new Date().getFullYear()).slice(-2)}${String(id).padStart(4, '0')}`;
      
      // Obtener cliente completo
      let cliente = null;
      const clienteId = pedidoRaw.Id_Cliente || pedidoRaw.Cliente_id;
      if (clienteId) {
        try {
          cliente = await crm.getClienteById(Number(clienteId));
        } catch (err) {
          console.warn(`⚠️ Error obteniendo cliente ${clienteId}:`, err.message);
        }
      }
      
      // Obtener comercial completo
      let comercial = null;
      const comercialId = pedidoRaw.Id_Cial || pedidoRaw.Comercial_id;
      if (comercialId) {
        try {
          comercial = await crm.getComercialById(Number(comercialId));
        } catch (err) {
          console.warn(`⚠️ Error obteniendo comercial ${comercialId}:`, err.message);
        }
      }
      
      // Obtener forma de pago
      let formaPago = null;
      if (pedidoRaw.Id_FormaPago) {
        try {
          formaPago = await crm.getFormaPagoById(Number(pedidoRaw.Id_FormaPago));
        } catch (err) {
          console.warn(`⚠️ Error obteniendo forma de pago ${pedidoRaw.Id_FormaPago}:`, err.message);
        }
      }
      
      // Obtener tipo de pedido
      let tipoPedido = null;
      if (pedidoRaw.Id_TipoPedido) {
        try {
          const tipoResult = await crm.query('SELECT * FROM tipos_pedidos WHERE id = ? LIMIT 1', [Number(pedidoRaw.Id_TipoPedido)]);
          if (tipoResult && tipoResult.length > 0) {
            tipoPedido = tipoResult[0];
          }
        } catch (err) {
          console.warn(`⚠️ Error obteniendo tipo de pedido ${pedidoRaw.Id_TipoPedido}:`, err.message);
        }
      }
      
      // Obtener líneas del pedido
      let lineas = [];
      try {
        // Buscar por Id_NumPedido primero
        let lineasRaw = await crm.query('SELECT * FROM pedidos_articulos WHERE Id_NumPedido = ?', [id]);
        if (!lineasRaw || lineasRaw.length === 0) {
          // Fallback: buscar por NumPedido
          lineasRaw = await crm.query('SELECT * FROM pedidos_articulos WHERE NumPedido = ?', [numeroRaw]);
        }
        
        if (lineasRaw && lineasRaw.length > 0) {
          lineas = await construirLineasDesdeRaw(lineasRaw, crm, articulosMap);
        }
      } catch (err) {
        console.warn(`⚠️ Error obteniendo líneas del pedido ${id}:`, err.message);
      }
      
      // Calcular totales
      const subtotal = lineas.reduce((sum, l) => sum + (l.subtotal || 0), 0);
      const totalIva = lineas.reduce((sum, l) => sum + (l.ivaMonto || 0), 0);
      const total = lineas.reduce((sum, l) => sum + (l.total || 0), 0);
      const totalDescuentos = lineas.reduce((sum, l) => sum + (l.descuentoValor || 0), 0);
      
      return {
        id,
        numero,
        numeroRaw,
        fecha: fecha ? new Date(fecha) : null,
        fechaEntrega: pedidoRaw.FechaEntrega ? new Date(pedidoRaw.FechaEntrega) : null,
        estado: pedidoRaw.EstadoPedido || pedidoRaw.Estado || 'Pendiente',
        cliente: cliente ? {
          id: cliente.Id || cliente.id,
          nombre: cliente.Nombre || cliente.Nombre_Razon_Social || cliente.nombre,
          dni: cliente.DNI_CIF || cliente.Dni_Cif || cliente.dni,
          email: cliente.Email || cliente.email,
          telefono: cliente.Telefono || cliente.telefono,
          direccion: cliente.Direccion || cliente.direccion,
          poblacion: cliente.Poblacion || cliente.poblacion,
          provincia: cliente.Provincia || cliente.provincia,
          codigoPostal: cliente.CodigoPostal || cliente.codigoPostal
        } : null,
        comercial: comercial ? {
          id: comercial.Id || comercial.id,
          nombre: comercial.Nombre || comercial.nombre,
          email: comercial.Email || comercial.email
        } : null,
        formaPago: formaPago ? {
          id: formaPago.id || formaPago.Id,
          nombre: formaPago.FormaPago || formaPago.Forma || formaPago.forma,
          dias: formaPago.Dias || formaPago.dias
        } : null,
        tipoPedido: tipoPedido ? {
          id: tipoPedido.id || tipoPedido.Id,
          nombre: tipoPedido.Tipo || tipoPedido.tipo
        } : null,
        observaciones: pedidoRaw.Observaciones || null,
        numero_cooperativa: pedidoRaw.numero_cooperativa || null,
        cooperativa_nombre: pedidoRaw.cooperativa_nombre || null,
        lineas: lineas,
        totales: {
          subtotal: Number(subtotal.toFixed(2)),
          descuentos: Number(totalDescuentos.toFixed(2)),
          iva: Number(totalIva.toFixed(2)),
          total: Number(total.toFixed(2))
        },
        totalesBD: {
          baseImponible: Number(pedidoRaw.BaseImponible || 0),
          totalDescuento: Number(pedidoRaw.TotalDescuento || 0),
          totalIva: Number(pedidoRaw.TotalIva || 0),
          totalPedido: Number(pedidoRaw.TotalPedido || 0)
        }
      };
    }));
    
    // Ordenar por fecha (más reciente primero)
    pedidosCompletos.sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return b.fecha.getTime() - a.fecha.getTime();
    });
    
    // Calcular estadísticas generales
    const estadisticas = pedidosCompletos.reduce((acc, pedido) => {
      acc.totalPedidos += 1;
      acc.totalImporte += pedido.totales.total || 0;
      acc.totalBaseImponible += pedido.totales.subtotal || 0;
      acc.totalIva += pedido.totales.iva || 0;
      acc.totalDescuentos += pedido.totales.descuentos || 0;
      acc.totalLineas += pedido.lineas.length;
      
      const estadoLower = (pedido.estado || '').toLowerCase();
      if (estadoLower.includes('pend')) acc.pendientes += 1;
      if (estadoLower.includes('complet') || estadoLower.includes('entreg')) acc.completados += 1;
      if (estadoLower.includes('cancel')) acc.cancelados += 1;
      if (estadoLower.includes('cerrado')) acc.cerrados += 1;
      
      return acc;
    }, {
      totalPedidos: 0,
      pendientes: 0,
      completados: 0,
      cancelados: 0,
      cerrados: 0,
      totalImporte: 0,
      totalBaseImponible: 0,
      totalIva: 0,
      totalDescuentos: 0,
      totalLineas: 0
    });
    
    res.render('dashboard/pedidos-informe', {
      title: 'Informe Completo de Pedidos - Farmadescaso',
      user: req.comercial || req.session.comercial,
      pedidos: pedidosCompletos,
      estadisticas,
      fechaGeneracion: new Date(),
      query: req.query,
      error: null
    });
  } catch (error) {
    console.error('❌ Error generando informe de pedidos:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).render('error', {
      error: 'Error generando informe',
      message: `No se pudo generar el informe de pedidos: ${error.message}`
    });
  }
});

app.get('/dashboard/pedidos/nuevo', requireAuth, async (req, res) => {
  try {
    const getTarifasClientesForSelect = async () => {
      // Para que SIEMPRE se muestre la tarifa aplicada (aunque esté inactiva),
      // traemos todas las tarifas y en la vista deshabilitamos las no activas.
      try {
        return await crm.query(
          `SELECT Id, NombreTarifa, Activa, FechaInicio, FechaFin
           FROM tarifasClientes
           ORDER BY CASE WHEN Id = 0 THEN 0 ELSE 1 END, NombreTarifa ASC`
        );
      } catch (err) {
        // Fallback: algunas BD podrían tener "Nombre" en vez de "NombreTarifa"
        const msg = String(err?.sqlMessage || err?.message || '');
        const isBadField = err?.code === 'ER_BAD_FIELD_ERROR' && /Unknown column/i.test(msg);
        if (isBadField) {
          console.warn('⚠️ [PEDIDO NUEVO] Columnas inesperadas en tarifasClientes. Reintentando con fallback Nombre AS NombreTarifa...', {
            code: err?.code,
            sqlMessage: err?.sqlMessage
          });
          try {
            return await crm.query(
              `SELECT Id, Nombre AS NombreTarifa, Activa, FechaInicio, FechaFin
               FROM tarifasClientes
               ORDER BY CASE WHEN Id = 0 THEN 0 ELSE 1 END, NombreTarifa ASC`
            );
          } catch (err2) {
            console.error('❌ [PEDIDO NUEVO] Error obteniendo tarifas (fallback):', {
              code: err2?.code,
              sqlMessage: err2?.sqlMessage,
              message: err2?.message
            });
            return [];
          }
        }
        console.error('❌ [PEDIDO NUEVO] Error obteniendo tarifas:', {
          code: err?.code,
          sqlMessage: err?.sqlMessage,
          message: err?.message
        });
        return [];
      }
    };

    const [clientes, articulos, clientesCooperativa, nuevaReferencia, comerciales, formasPago, tarifasClientes] = await Promise.all([
      crm.getClientes(),
      crm.getArticulos(),
      crm.getClientesCooperativa(),
      crm.getNextNumeroPedido(),
      crm.getComerciales(),
      crm.getFormasPago(),
      getTarifasClientesForSelect()
    ]);

    // Obtener el comercial logueado como valor por defecto
    const comercialLogueadoId = req.comercialId || req.session.comercialId;
    const esAdmin = isAdmin(req);

    console.log('🧾 [PEDIDO NUEVO] Carga de datos:', {
      comercialLogueadoId: comercialLogueadoId || null,
      rol: getUsuarioRol(req),
      esAdmin,
      clientes: clientes?.length || 0,
      articulos: articulos?.length || 0,
      comerciales: comerciales?.length || 0,
      tarifasActivas: tarifasClientes?.length || 0
    });
 
    res.render('dashboard/pedido-nuevo', {
      title: 'Nuevo Pedido - Farmadescaso',
      user: req.comercial || req.session?.comercial || req.user || {},
      clientes: clientes || [],
      articulos: articulos || [],
      clientesCooperativa: clientesCooperativa || [],
      comerciales: comerciales || [],
      formasPago: formasPago || [],
      tarifasClientes: tarifasClientes || [],
      comercialLogueadoId: comercialLogueadoId,
      esAdmin: esAdmin,
      formValues: {},
      lineasValores: [],
      nuevaReferencia,
      error: null
    });
  } catch (error) {
    console.error('Error cargando formulario de nuevo pedido:', error);
    res.render('dashboard/pedido-nuevo', {
      title: 'Nuevo Pedido - Farmadescaso',
      user: req.comercial || req.session?.comercial || req.user || {},
      clientes: [],
      articulos: [],
      clientesCooperativa: [],
      comerciales: [],
      formasPago: [],
      tarifasClientes: [],
      comercialLogueadoId: req.comercialId || req.session.comercialId,
      esAdmin: isAdmin(req),
      formValues: {},
      lineasValores: [],
      nuevaReferencia: null,
      error: 'No se pudo cargar la información necesaria para crear un pedido'
    });
  }
});

app.post('/dashboard/pedidos', requireAuth, async (req, res) => {
  // Timeout de seguridad: si la petición tarda más de 60 segundos, responder con error
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      console.error('⏱️ [CREAR PEDIDO] TIMEOUT: La petición tardó más de 30 segundos');
      console.error('⏱️ [CREAR PEDIDO] Esto indica que alguna operación se está bloqueando');
      console.error('⏱️ [CREAR PEDIDO] Revisa los logs anteriores para identificar el cuello de botella');
      console.error('⏱️ [CREAR PEDIDO] Última operación registrada antes del timeout');
      const acceptHeader = req.headers.accept || '';
      const acceptsJson = acceptHeader.includes('application/json');
      const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
      const isFetch = acceptHeader.includes('*/*') || acceptHeader.includes('application/json');
      
      if (acceptsJson || isAjax || isFetch) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(500).json({
          success: false,
          error: 'La petición tardó demasiado tiempo. Por favor, intenta nuevamente. Si el problema persiste, contacta con soporte técnico.',
          timeout: true
        });
      } else {
        res.status(500).send('La petición tardó demasiado tiempo. Por favor, intenta nuevamente.');
      }
    }
  }, 30000); // 30 segundos - si tarda más, hay un problema que necesita ser investigado
  
  // Wrapper de seguridad para evitar que el servidor se caiga
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📥 [CREAR PEDIDO] ===== INICIO DE PETICIÓN =====');
    console.log('📥 [CREAR PEDIDO] Recibida petición POST');
    console.log('📥 [CREAR PEDIDO] Headers recibidos:', {
      'content-type': req.headers['content-type'],
      'accept': req.headers.accept,
      'x-requested-with': req.headers['x-requested-with'],
      'user-agent': req.headers['user-agent']?.substring(0, 50)
    });
    console.log('📥 [CREAR PEDIDO] Body recibido (completo):', JSON.stringify(req.body, null, 2));
    console.log('📥 [CREAR PEDIDO] Campos críticos:');
    console.log('  - cliente_id:', req.body.cliente_id, '(tipo:', typeof req.body.cliente_id, ')');
    console.log('  - fecha_pedido:', req.body.fecha_pedido, '(tipo:', typeof req.body.fecha_pedido, ')');
    console.log('  - lineas_payload:', req.body.lineas_payload ? 'presente (' + req.body.lineas_payload.length + ' chars)' : 'ausente');
    
    // Verificar que req.body no esté vacío
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ [CREAR PEDIDO] req.body está vacío o undefined');
      const acceptHeader = req.headers.accept || '';
      const acceptsJson = acceptHeader.includes('application/json');
      const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
      const isFetch = acceptHeader.includes('*/*') || acceptHeader.includes('application/json');
      
      if (acceptsJson || isAjax || isFetch) {
        clearTimeout(timeoutId);
        return res.status(400).json({
          success: false,
          error: 'El cuerpo de la petición está vacío. Por favor, verifica que los datos se estén enviando correctamente.'
        });
      } else {
        clearTimeout(timeoutId);
        return res.status(400).send('El cuerpo de la petición está vacío.');
      }
    }
    
    const {
    cliente_id,
    fecha_pedido,
    fecha_entrega,
    tipo_pedido,
    forma_pago,
    estado,
    observaciones,
    numero_cooperativa,
    cooperativa_nombre,
    numero_pedido,
    tarifa_id
  } = req.body;

  const transferMap = {
    'transfer hefame': 'HEFAME',
    'transfer alliance': 'ALLIANCE',
    'transfer cofares': 'COFARES'
  };

  const errores = [];
  let lineasPayload = [];
  let descuentoGeneral = 0;

  if (req.body.lineas_payload) {
    try {
      const payloadParsed = JSON.parse(req.body.lineas_payload);
      // El payload puede ser un objeto con {lineas, descuentoGeneral} o un array (formato antiguo)
      if (Array.isArray(payloadParsed)) {
        lineasPayload = payloadParsed;
        descuentoGeneral = 0;
      } else if (payloadParsed && typeof payloadParsed === 'object') {
        lineasPayload = Array.isArray(payloadParsed.lineas) ? payloadParsed.lineas : [];
        descuentoGeneral = Number(payloadParsed.descuentoGeneral) || 0;
      } else {
        lineasPayload = [];
        descuentoGeneral = 0;
      }
    } catch (error) {
      console.error('Error parseando líneas de pedido:', error.message);
      lineasPayload = [];
      descuentoGeneral = 0;
      errores.push('No se pudo interpretar las líneas del pedido.');
    }
  }

  if (!cliente_id) {
    errores.push('Selecciona un cliente.');
  }
  if (!fecha_pedido) {
    errores.push('La fecha de pedido es obligatoria.');
  }
  if (!lineasPayload || !lineasPayload.length) {
    errores.push('Añade al menos una línea al pedido.');
  }

  const normalizarNumero = (valor, opciones = {}) => {
    if (valor === undefined || valor === null || valor === '') return opciones.defaultValue ?? 0;
    const numero = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (Number.isNaN(numero)) return opciones.defaultValue ?? 0;
    const precision = opciones.precision ?? 2;
    return Number(numero.toFixed(precision));
  };

  // Obtener todos los artículos de una vez para optimizar la búsqueda de IVA
  let articulosMap = null;
  try {
    console.log('📦 [CREAR PEDIDO] Obteniendo todos los artículos para mapa de IVA...');
    const inicioGetArticulos = Date.now();
    const todosArticulos = await Promise.race([
      crm.getArticulos(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout obteniendo artículos (10s)')), 10000))
    ]);
    const tiempoGetArticulos = Date.now() - inicioGetArticulos;
    console.log(`✅ [CREAR PEDIDO] Artículos obtenidos en ${tiempoGetArticulos}ms (total: ${todosArticulos?.length || 0})`);
    articulosMap = new Map();
    todosArticulos.forEach(art => {
      const id = art.Id || art.id;
      if (id) {
        articulosMap.set(Number(id), art);
      }
    });
    console.log(`✅ [CREAR PEDIDO] Mapa de artículos creado con ${articulosMap.size} entradas`);
  } catch (error) {
    console.warn('⚠️ [CREAR PEDIDO] Error cargando artículos para obtener IVA:', error.message);
    // Continuar sin el mapa de artículos - se obtendrá el IVA de otra forma
  }

  const lineasNormalizadas = [];
  if (Array.isArray(lineasPayload)) {
    for (let index = 0; index < lineasPayload.length; index++) {
      const linea = lineasPayload[index];
      const articuloId = linea && (linea.articuloId || linea.articulo || linea.articulo_id);
      const cantidad = normalizarNumero(linea && (linea.cantidad || linea.unidades), { defaultValue: 0, precision: 2 });
      let precio = normalizarNumero(linea && (linea.precio || linea.pvp || linea.valor), { defaultValue: 0, precision: 4 });
      let iva = normalizarNumero(linea && (linea.iva || linea.iva_porcentaje), { defaultValue: 0, precision: 2 });
      const descuentoLinea = normalizarNumero(linea && (linea.descuento || linea.descuento_porcentaje), { defaultValue: 0, precision: 2 });

      if (!articuloId) {
        errores.push(`Selecciona un artículo en la línea ${index + 1}.`);
        continue;
      }
      if (cantidad <= 0) {
        errores.push(`La cantidad debe ser mayor que cero en la línea ${index + 1}.`);
      }
      if (precio < 0) {
        errores.push(`El precio no puede ser negativo en la línea ${index + 1}.`);
      }

      // Si no hay IVA en el formulario, obtenerlo del artículo
      if ((!iva || iva === 0) && articuloId && articulosMap) {
        try {
          const articuloIdNumber = Number(articuloId);
          const articulo = articulosMap.get(articuloIdNumber);
          if (articulo) {
            // Buscar campo IVA en el artículo
            const ivaDelArticulo = Number(
              articulo.IVA || 
              articulo.iva || 
              articulo['IVA %'] || 
              articulo['Iva %'] || 
              articulo['IVA%'] || 
              articulo['Iva%'] ||
              articulo['% IVA'] ||
              articulo['% Iva'] ||
              0
            ) || 0;
            if (ivaDelArticulo > 0) {
              iva = ivaDelArticulo;
            }
            
            // Si no hay precio en el formulario, usar el precio del artículo (PVL)
            if (!precio || precio === 0) {
              precio = parseMoneyValue(
                articulo.PVL || 
                articulo.pvl || 
                articulo.Precio || 
                articulo.precio || 
                0
              );
            }
          }
        } catch (error) {
          console.warn(`⚠️ Error obteniendo IVA del artículo ${articuloId}:`, error.message);
        }
      }

      // Calcular subtotal sin descuento por línea
      const subtotalSinDescuento = Number((cantidad * precio).toFixed(2));
      
      // Aplicar descuento por línea
      const descuentoLineaValor = Number((subtotalSinDescuento * (descuentoLinea / 100)).toFixed(2));
      const subtotal = Number((subtotalSinDescuento - descuentoLineaValor).toFixed(2));
      
      // Aplicar descuento general después del subtotal
      const descuentoGeneralValor = Number((subtotal * (descuentoGeneral / 100)).toFixed(2));
      const subtotalConDescuentoGeneral = Number((subtotal - descuentoGeneralValor).toFixed(2));
      
      // Calcular impuestos sobre el subtotal con descuentos
      const impuesto = Number((subtotalConDescuentoGeneral * (iva / 100)).toFixed(2));
      const total = Number((subtotalConDescuentoGeneral + impuesto).toFixed(2));

      lineasNormalizadas.push({
        articuloId,
        cantidad,
        precio,
        iva,
        descuentoLinea,
        subtotal,
        descuentoGeneral,
        subtotalConDescuentoGeneral,
        impuesto,
        total
      });
    }
  }

  let numeroPedidoDisplay = (numero_pedido || '').toString().trim();
  if (!numeroPedidoDisplay) {
    console.log('📝 [CREAR PEDIDO] Obteniendo siguiente número de pedido...');
    const inicioGetNext = Date.now();
    numeroPedidoDisplay = await Promise.race([
      crm.getNextNumeroPedido(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout obteniendo siguiente número (5s)')), 5000))
    ]);
    const tiempoGetNext = Date.now() - inicioGetNext;
    console.log(`✅ [CREAR PEDIDO] Siguiente número obtenido en ${tiempoGetNext}ms: ${numeroPedidoDisplay}`);
  } else {
    console.log(`✅ [CREAR PEDIDO] Número de pedido proporcionado: ${numeroPedidoDisplay}`);
  }

  let numeroPedidoNumerico = obtenerParteNumericaPedido(numeroPedidoDisplay, fecha_pedido);
  if (!numeroPedidoNumerico) {
    const fallbackDisplay = await crm.getNextNumeroPedido();
    numeroPedidoDisplay = fallbackDisplay;
    numeroPedidoNumerico = obtenerParteNumericaPedido(numeroPedidoDisplay, fecha_pedido);
  }

  if (!numeroPedidoNumerico) {
    errores.push('No se pudo generar un número de pedido válido. Inténtalo de nuevo.');
  }

  if (errores.length) {
    console.error('❌ [CREAR PEDIDO] Errores de validación encontrados:', errores);
    try {
      const [clientes, articulos, clientesCooperativa, comerciales] = await Promise.all([
        crm.getClientes(),
        crm.getArticulos(),
        crm.getClientesCooperativa(),
        crm.getComerciales()
      ]);

      const comercialLogueadoId = req.comercialId || req.session.comercialId;
      const esAdmin = isAdmin(req);

      // Si la petición viene de fetch (AJAX), devolver JSON en lugar de render
      // Verificar si acepta JSON o si es una petición AJAX
      const acceptHeader = req.headers.accept || '';
      const acceptsJson = acceptHeader.includes('application/json');
      const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
      const isFetch = acceptHeader.includes('*/*') || acceptHeader.includes('application/json');
      
      console.log('🔍 [CREAR PEDIDO] Headers de petición:', {
        accept: acceptHeader,
        'x-requested-with': req.headers['x-requested-with'],
        'content-type': req.headers['content-type'],
        acceptsJson,
        isAjax,
        isFetch
      });
      
      // Siempre devolver JSON para errores de validación cuando hay errores
      // Esto facilita el manejo en el cliente
      console.log('📤 [CREAR PEDIDO] Devolviendo error 400 como JSON');
      // Establecer explícitamente el Content-Type como JSON
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({
        success: false,
        error: errores.join(' '),
        errores: errores
      });

      return res.status(400).render('dashboard/pedido-nuevo', {
        title: 'Nuevo Pedido - Farmadescaso',
        user: req.comercial || req.session.comercial,
        clientes: clientes || [],
        articulos: articulos || [],
        clientesCooperativa: clientesCooperativa || [],
        comerciales: comerciales || [],
        comercialLogueadoId: comercialLogueadoId,
        esAdmin: esAdmin,
        error: errores.join(' '),
        formValues: {
          cliente_id,
          comercial_id: req.body.comercial_id || '',
          fecha_pedido,
          fecha_entrega,
          tipo_pedido,
          forma_pago,
          estado,
          observaciones,
          numero_cooperativa,
          cooperativa_nombre,
          numero_pedido: numeroPedidoDisplay
        },
        lineasValores: lineasPayload || [],
        nuevaReferencia: numeroPedidoDisplay
      });
    } catch (innerError) {
      console.error('Error recargando formulario tras validación:', innerError.message);
      return res.status(500).render('dashboard/pedido-nuevo', {
        title: 'Nuevo Pedido - Farmadescaso',
        user: req.comercial || req.session.comercial,
        clientes: [],
        articulos: [],
        clientesCooperativa: [],
        comerciales: [],
        comercialLogueadoId: req.comercialId || req.session.comercialId,
        esAdmin: isAdmin(req),
        error: 'No se pudo validar la información del pedido. Inténtalo de nuevo más tarde.',
        formValues: {},
        lineasValores: [],
        nuevaReferencia: numeroPedidoDisplay
      });
    }
  }

  try {
    // Calcular totales considerando descuentos
    const subtotalPedido = lineasNormalizadas.reduce((sum, linea) => sum + (linea.subtotalConDescuentoGeneral || linea.subtotal), 0);
    const impuestoPedido = lineasNormalizadas.reduce((sum, linea) => sum + linea.impuesto, 0);
    const totalPedido = Number((subtotalPedido + impuestoPedido).toFixed(2));

    // Calcular descuentos totales
    // Sumar descuentos por línea
    const descuentosPorLinea = lineasNormalizadas.reduce((sum, linea) => {
      const subtotalSinDescuento = (linea.cantidad || 0) * (linea.precio || 0);
      const descuentoLineaValor = subtotalSinDescuento * ((linea.descuentoLinea || 0) / 100);
      return sum + descuentoLineaValor;
    }, 0);
    
    // Calcular descuento general sobre el subtotal después de descuentos por línea
    const subtotalDespuesDescuentosLinea = lineasNormalizadas.reduce((sum, linea) => {
      const subtotalSinDescuento = (linea.cantidad || 0) * (linea.precio || 0);
      const descuentoLineaValor = subtotalSinDescuento * ((linea.descuentoLinea || 0) / 100);
      const subtotal = subtotalSinDescuento - descuentoLineaValor;
      return sum + subtotal;
    }, 0);
    
    const descuentoGeneralValor = subtotalDespuesDescuentosLinea * (descuentoGeneral / 100);
    const totalDescuentos = Number((descuentosPorLinea + descuentoGeneralValor).toFixed(2));

    // Base imponible es el subtotal después de todos los descuentos
    const baseImponible = Number(subtotalPedido.toFixed(2));
    
    // Importe IVA es el total de impuestos
    const importeIva = Number(impuestoPedido.toFixed(2));

    // Preparar número de cooperativa y nombre solo si el tipo de pedido es Transfer
    let numeroCooperativaFinal = null;
    let cooperativaNombreFinal = null;
    
    const tipoPedidoLower = (tipo_pedido || '').toLowerCase().trim();
    if (tipoPedidoLower.includes('transfer')) {
      // SIEMPRE buscar el número de asociado en la tabla clientes_cooperativas cuando es Transfer
      // Priorizar el valor de la base de datos sobre el del formulario
      if (cliente_id) {
        try {
          const clienteIdNumber = Number(cliente_id);
          if (!Number.isNaN(clienteIdNumber) && clienteIdNumber > 0) {
            console.log(`🔍 [PEDIDO] Buscando número de asociado en clientes_cooperativas para cliente ${clienteIdNumber} (tipo: Transfer)...`);
            const inicioGetCoop = Date.now();
            const relaciones = await Promise.race([
              crm.getCooperativasByClienteId(clienteIdNumber),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout obteniendo cooperativas')), 10000))
            ]);
            const tiempoGetCoop = Date.now() - inicioGetCoop;
            console.log(`✅ [PEDIDO] Cooperativas obtenidas en ${tiempoGetCoop}ms (total: ${relaciones?.length || 0})`);
            if (relaciones && relaciones.length > 0) {
              // Buscar la relación que coincida con la cooperativa del tipo de pedido
              const nombreCooperativaBuscado = transferMap[tipoPedidoLower];
              if (nombreCooperativaBuscado) {
                const relacionEncontrada = relaciones.find(r => {
                  const nombreRelacion = (r.Nombre || r.nombre || '').toUpperCase().trim();
                  return nombreRelacion === nombreCooperativaBuscado.toUpperCase();
                });
                if (relacionEncontrada && relacionEncontrada.NumAsociado) {
                  // Priorizar el valor de la base de datos
                  numeroCooperativaFinal = relacionEncontrada.NumAsociado;
                  cooperativaNombreFinal = nombreCooperativaBuscado;
                  console.log(`✅ [PEDIDO] Número de asociado encontrado en BD: ${numeroCooperativaFinal} para ${nombreCooperativaBuscado}`);
                } else {
                  console.log(`⚠️ [PEDIDO] No se encontró relación con ${nombreCooperativaBuscado} para el cliente ${clienteIdNumber}`);
                }
              }
            } else {
              console.log(`⚠️ [PEDIDO] El cliente ${clienteIdNumber} no tiene relaciones con cooperativas registradas`);
            }
          }
        } catch (error) {
          console.warn('⚠️ [PEDIDO] Error obteniendo número de cooperativa de relación:', error.message);
        }
      }
      
      // Si no se encontró en la BD, usar el valor del formulario como fallback
      if (!numeroCooperativaFinal) {
        numeroCooperativaFinal = numero_cooperativa || null;
        cooperativaNombreFinal = cooperativa_nombre || transferMap[tipoPedidoLower] || null;
        if (numeroCooperativaFinal) {
          console.log(`ℹ️ [PEDIDO] Usando número de cooperativa del formulario (fallback): ${numeroCooperativaFinal}`);
        }
      }
    }

    // Mapear a los nombres reales de las columnas en la BD
    const pedidoPayload = {
      'NumPedido': numeroPedidoDisplay,
      'FechaPedido': fecha_pedido,
      'FechaEntrega': fecha_entrega || null,
      'EstadoPedido': estado || 'Pendiente',
      'TotalPedido': totalPedido,
      'BaseImponible': baseImponible,
      'TotalDescuento': totalDescuentos,
      'TotalIva': importeIva,
      'Serie': numeroPedidoDisplay ? numeroPedidoDisplay.substring(0, 1) : 'P', // Extraer serie (P, A, etc.)
      'Observaciones': observaciones || null // Campo Observaciones habilitado
    };
    
    // Buscar el ID de la forma de pago por nombre si viene como string
    // NOTA: El formulario ahora envía el ID directamente, pero mantenemos esta lógica por compatibilidad
    if (forma_pago !== undefined && forma_pago !== null && forma_pago !== '') {
      let formaPagoId = null;
      
      try {
        // Primero intentar como número (caso más común ahora)
        const formaPagoNumber = Number(forma_pago);
        if (!Number.isNaN(formaPagoNumber) && formaPagoNumber > 0) {
          formaPagoId = formaPagoNumber;
          console.log(`✅ [PEDIDO] Forma de pago recibida como ID: ${formaPagoId}`);
        } else if (typeof forma_pago === 'string' && forma_pago.trim() !== '') {
          // Si es un string, intentar convertir a número primero
          const stringAsNumber = Number(forma_pago.trim());
          if (!Number.isNaN(stringAsNumber) && stringAsNumber > 0) {
            formaPagoId = stringAsNumber;
            console.log(`✅ [PEDIDO] Forma de pago string convertida a ID: ${formaPagoId}`);
          } else {
            // Si no es un número, buscar el ID en la tabla formas_pago
            console.log(`🔍 [PEDIDO] Buscando forma de pago por nombre: "${forma_pago}"`);
            try {
              const formaPagoObj = await crm.getFormaPagoByNombre(forma_pago);
              if (formaPagoObj) {
                formaPagoId = formaPagoObj.id || formaPagoObj.Id;
                console.log(`✅ [PEDIDO] Forma de pago "${forma_pago}" encontrada con ID: ${formaPagoId}`);
              } else {
                console.warn(`⚠️ [PEDIDO] No se encontró forma de pago con nombre "${forma_pago}"`);
              }
            } catch (searchError) {
              console.error(`❌ [PEDIDO] Error buscando forma de pago "${forma_pago}":`, searchError.message);
              // Continuar sin forma de pago
            }
          }
        }
      } catch (error) {
        console.error(`❌ [PEDIDO] Error procesando forma de pago "${forma_pago}":`, error.message);
        console.error(`❌ [PEDIDO] Stack:`, error.stack);
        // No lanzar el error, solo registrar y continuar sin forma de pago
      }
      
      if (formaPagoId) {
        pedidoPayload['Id_FormaPago'] = formaPagoId;
      } else {
        console.warn(`⚠️ [PEDIDO] No se pudo determinar el ID de la forma de pago "${forma_pago}". El pedido se creará sin forma de pago.`);
      }
    } else {
      console.log(`ℹ️ [PEDIDO] No se proporcionó forma de pago (valor: ${forma_pago})`);
    }
    
    // Id_TipoPedido es requerido en la base de datos
    // Mapear el tipo de pedido del formulario al ID correspondiente en la tabla tipos_pedidos
    let tipoPedidoId = 1; // Valor por defecto: "Normal"
    
    if (tipo_pedido) {
      const tipoPedidoLower = (tipo_pedido || '').toLowerCase().trim();
      
      // Mapeo de tipos de pedido a IDs
      const tipoPedidoMap = {
        'normal': 1,
        'transfer hefame': 2,
        'transfer alliance': 3,
        'transfer cofares': 4
      };
      
      // Buscar el ID correspondiente
      for (const [key, id] of Object.entries(tipoPedidoMap)) {
        if (tipoPedidoLower.includes(key)) {
          tipoPedidoId = id;
          console.log(`✅ [PEDIDO] Tipo de pedido "${tipo_pedido}" mapeado a ID: ${tipoPedidoId}`);
          break;
        }
      }
      
      // Si no se encontró un mapeo, intentar buscar en la base de datos
      if (tipoPedidoId === 1 && !tipoPedidoLower.includes('normal')) {
        try {
          console.log(`🔍 [PEDIDO] Buscando tipo de pedido en base de datos: "${tipo_pedido}"`);
          const tipos = await crm.query('SELECT id FROM tipos_pedidos WHERE Tipo LIKE ? LIMIT 1', [`%${tipo_pedido}%`]);
          if (tipos && tipos.length > 0) {
            tipoPedidoId = tipos[0].id;
            console.log(`✅ [PEDIDO] Tipo de pedido encontrado en BD con ID: ${tipoPedidoId}`);
          } else {
            console.log(`⚠️ [PEDIDO] Tipo de pedido "${tipo_pedido}" no encontrado, usando ID por defecto: 1 (Normal)`);
          }
        } catch (searchError) {
          console.warn(`⚠️ [PEDIDO] Error buscando tipo de pedido: ${searchError.message}`);
        }
      }
    } else {
      console.log(`✅ [PEDIDO] No se proporcionó tipo de pedido, usando ID por defecto: 1 (Normal)`);
    }
    
    pedidoPayload['Id_TipoPedido'] = tipoPedidoId;
    
    // Agregar número de cooperativa y nombre solo si el tipo de pedido es Transfer
    // (tipoPedidoLower ya está declarado arriba)
    if (tipoPedidoLower.includes('transfer')) {
      pedidoPayload['numero_cooperativa'] = numeroCooperativaFinal || null;
      pedidoPayload['cooperativa_nombre'] = cooperativaNombreFinal || null;
    }

    const clienteIdNumber = Number(cliente_id);
    if (!Number.isNaN(clienteIdNumber) && clienteIdNumber > 0) {
      pedidoPayload['Id_Cliente'] = clienteIdNumber; // Usar Id_Cliente directamente
    }

    // Dirección de envío (opcional): si se marca como distinta, guardar FK
    const envioDiferente = String(req.body.envio_diferente || '0') === '1';
    const direccionEnvioId = Number(req.body.direccion_envio_id || 0);
    if (envioDiferente && Number.isFinite(direccionEnvioId) && direccionEnvioId > 0) {
      pedidoPayload['Id_DireccionEnvio'] = direccionEnvioId;
    } else {
      // Si no es diferente o no hay dirección válida, no forzar el campo (mantiene NULL por defecto)
    }

    // Tarifa aplicada al pedido (para congelar precios/comisiones)
    // Regla de negocio:
    // - Si el cliente tiene Tarifa > 0, esa se aplica de forma inamovible.
    // - Si el cliente tiene Tarifa = 0, se permite elegir una tarifa activa para el pedido.
    let tarifaClienteDb = 0;
    try {
      // Compatibilidad con esquemas donde la tabla se llama `Clientes` (MySQL en Linux puede ser case-sensitive).
      const tClientesResolved = __clientesBuscarMetaCache?.tClientes || null;
      const candidates = Array.from(new Set([
        tClientesResolved,
        'clientes',
        'Clientes',
        'CLIENTES'
      ].filter(Boolean)));

      let rowsCliente = null;
      for (const t of candidates) {
        try {
          rowsCliente = await crm.query(`SELECT Tarifa FROM \`${t}\` WHERE Id = ? OR id = ? LIMIT 1`, [clienteIdNumber, clienteIdNumber]);
          break;
        } catch (_) {
          rowsCliente = null;
        }
      }
      if (rowsCliente && rowsCliente.length > 0) {
        const raw = rowsCliente[0].Tarifa ?? rowsCliente[0].tarifa ?? 0;
        const parsed = Number(raw);
        tarifaClienteDb = Number.isFinite(parsed) ? parsed : 0;
      }
    } catch (_) {
      tarifaClienteDb = 0;
    }

    const tarifaElegida = tarifa_id !== undefined && tarifa_id !== null && String(tarifa_id).trim() !== ''
      ? Number(tarifa_id)
      : 0;

    const tarifaFinal = (Number.isFinite(tarifaClienteDb) && tarifaClienteDb > 0)
      ? tarifaClienteDb
      : (Number.isFinite(tarifaElegida) && tarifaElegida >= 0 ? tarifaElegida : 0);

    pedidoPayload['Id_Tarifa'] = tarifaFinal;

    // Determinar el comercial: si es admin y viene del formulario, usarlo; sino usar el logueado
    const esAdmin = isAdmin(req);
    let comercialIdNumber = null;
    
    if (esAdmin && req.body.comercial_id) {
      comercialIdNumber = Number(req.body.comercial_id);
    } else {
      comercialIdNumber = Number(req.comercialId || req.session.comercialId);
    }
    
    if (!Number.isNaN(comercialIdNumber) && comercialIdNumber > 0) {
      pedidoPayload['Id_Cial'] = comercialIdNumber; // Usar Id_Cial directamente
    }

    console.log('📝 [CREAR PEDIDO] Creando cabecera del pedido...');
    console.log('📝 [CREAR PEDIDO] Payload a enviar:', JSON.stringify(pedidoPayload, null, 2));
    console.log('📝 [CREAR PEDIDO] Campos en payload:', Object.keys(pedidoPayload));
    console.log('📝 [CREAR PEDIDO] Valores críticos:', {
      cliente_id: pedidoPayload.Id_Cliente,
      fecha_pedido: pedidoPayload.FechaPedido,
      forma_pago: pedidoPayload.Id_FormaPago,
      total: pedidoPayload.TotalPedido
    });
    try {
      console.log('📝 [CREAR PEDIDO] Llamando a crm.createPedido...');
      const inicioCreatePedido = Date.now();
      const nuevoPedido = await Promise.race([
        crm.createPedido(pedidoPayload),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout creando pedido (30s)')), 30000))
      ]);
      const tiempoCreatePedido = Date.now() - inicioCreatePedido;
      console.log(`📝 [CREAR PEDIDO] createPedido completado en ${tiempoCreatePedido}ms`);
      console.log('📝 [CREAR PEDIDO] Respuesta de createPedido:', nuevoPedido);
      const pedidoId = nuevoPedido.insertId || nuevoPedido.Id || nuevoPedido.id;

      if (!pedidoId) {
        console.error('❌ [CREAR PEDIDO] No se pudo obtener el ID del pedido:', nuevoPedido);
        throw new Error('No se pudo determinar el ID del pedido creado');
      }

      console.log(`✅ [CREAR PEDIDO] Cabecera creada con ID: ${pedidoId}`);
      console.log(`📦 [CREAR PEDIDO] Creando ${lineasNormalizadas.length} líneas de pedido...`);
      const inicioLineas = Date.now();

      const lineasIds = [];
      let lineasCreadas = 0;
      let lineasConError = 0;

      for (let i = 0; i < lineasNormalizadas.length; i += 1) {
      const linea = lineasNormalizadas[i];
      const articuloIdNumber = Number(linea.articuloId);

      try {
        // Obtener nombre del artículo para la línea
        let articuloNombre = 'Desconocido';
        try {
          console.log(`🔍 [CREAR PEDIDO] Obteniendo nombre del artículo ${articuloIdNumber}...`);
          const inicioQueryArticulo = Date.now();
          const articulo = await Promise.race([
            crm.query('SELECT Nombre FROM articulos WHERE Id = ? LIMIT 1', [articuloIdNumber]),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout obteniendo artículo (5s)')), 5000))
          ]);
          const tiempoQueryArticulo = Date.now() - inicioQueryArticulo;
          console.log(`✅ [CREAR PEDIDO] Nombre del artículo obtenido en ${tiempoQueryArticulo}ms`);
          if (articulo && articulo.length > 0) {
            articuloNombre = articulo[0].Nombre || articulo[0].nombre || 'Desconocido';
          }
        } catch (err) {
          console.warn(`⚠️ [CREAR PEDIDO] No se pudo obtener nombre del artículo ${articuloIdNumber}:`, err.message);
          // Continuar con nombre por defecto
        }

        // Mapear a los nombres reales de las columnas según la estructura verificada de pedidos_articulos
        const lineaPayload = {
          'Id_NumPedido': pedidoId,  // FK a pedidos.id
          'NumPedido': numeroPedidoDisplay,  // Número de pedido como string
          'Id_Articulo': articuloIdNumber,  // FK a articulos
          'Articulo': articuloNombre,  // Nombre del artículo
          'Cantidad': Math.round(linea.cantidad) || 0,
          'PVP': linea.precio || 0,  // Precio de venta al público
          'DtoLinea': linea.descuentoLinea || 0,  // Descuento por línea
          'Subtotal': linea.subtotalConDescuentoGeneral || linea.subtotal || 0,
          'DtoTotal': descuentoGeneral,  // Descuento general
          'IVA': linea.iva || 0  // IVA porcentaje
        };

          console.log(`📝 [CREAR PEDIDO] Creando línea ${i + 1}/${lineasNormalizadas.length}...`);
          const inicioCrearLinea = Date.now();
          const lineaCreada = await Promise.race([
            crm.createPedidoLinea(lineaPayload),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout creando línea (10s)')), 10000))
          ]);
          const tiempoCrearLinea = Date.now() - inicioCrearLinea;
          console.log(`✅ [CREAR PEDIDO] Línea ${i + 1} creada en ${tiempoCrearLinea}ms`);
          const lineaId = lineaCreada.insertId || lineaCreada.Id || lineaCreada.id;
          
          if (lineaId) {
            lineasIds.push(lineaId);
            lineasCreadas++;
            console.log(`✅ [CREAR PEDIDO] Línea ${i + 1} creada con ID: ${lineaId}`);
          } else {
            lineasConError++;
            console.error(`❌ [CREAR PEDIDO] Línea ${i + 1} no devolvió ID:`, lineaCreada);
          }
        } catch (lineaError) {
          lineasConError++;
          console.error(`❌ [CREAR PEDIDO] Error creando línea ${i + 1}:`, lineaError.message);
          // Continuar con las demás líneas
        }
      }

      const tiempoLineas = Date.now() - inicioLineas;
      console.log(`✅ [CREAR PEDIDO] Líneas creadas: ${lineasCreadas}/${lineasNormalizadas.length} en ${tiempoLineas}ms`);
      if (lineasConError > 0) {
        console.warn(`⚠️ [CREAR PEDIDO] ${lineasConError} líneas tuvieron errores`);
      }

      // Vincular líneas al pedido (aunque ya tienen PedidoId, esto asegura la vinculación)
      if (lineasIds.length > 0) {
        console.log(`🔗 [CREAR PEDIDO] Vinculando ${lineasIds.length} líneas al pedido ${pedidoId}...`);
        const inicioLink = Date.now();
        await Promise.race([
          crm.linkPedidoLineas(pedidoId, lineasIds),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout vinculando líneas (10s)')), 10000))
        ]);
        const tiempoLink = Date.now() - inicioLink;
        console.log(`✅ [CREAR PEDIDO] Líneas vinculadas correctamente en ${tiempoLink}ms`);
      } else {
        console.warn(`⚠️ [CREAR PEDIDO] No se crearon líneas para el pedido ${pedidoId}`);
        throw new Error('No se pudieron crear las líneas del pedido');
      }

      if (tipo_pedido && tipo_pedido.toLowerCase().includes('transfer')) {
        const clave = tipo_pedido.toLowerCase();
        const nombreCooperativa = cooperativa_nombre || transferMap[clave] || transferMap[clave.trim()];
        if (nombreCooperativa) {
          console.log(`🔗 [CREAR PEDIDO] Actualizando relación cliente-cooperativa...`);
          const inicioUpsert = Date.now();
          try {
            await Promise.race([
              crm.upsertClienteCooperativa({
                clienteId: Number(cliente_id),
                cooperativaNombre: nombreCooperativa,
                numeroAsociado: numero_cooperativa
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout actualizando relación cliente-cooperativa (10s)')), 10000))
            ]);
            const tiempoUpsert = Date.now() - inicioUpsert;
            console.log(`✅ [CREAR PEDIDO] Relación cliente-cooperativa actualizada en ${tiempoUpsert}ms`);
          } catch (upsertError) {
            console.warn(`⚠️ [CREAR PEDIDO] Error actualizando relación cliente-cooperativa:`, upsertError.message);
            // No lanzar el error, solo registrar - el pedido ya está creado
          }
        }
      }

      // NOTA IMPORTANTE: El pedido NO se debe enviar a NocoDB hasta que el estado sea "Cerrado"
      // Si en el futuro se implementa integración con NocoDB, usar esta función:
      // if (estado && estado.toLowerCase() === 'cerrado') {
      //   await syncPedidoToNocoDB(pedidoId);
      //   console.log(`✅ [PEDIDO] Pedido ${pedidoId} sincronizado con NocoDB (estado: Cerrado)`);
      // } else {
      //   console.log(`ℹ️ [PEDIDO] Pedido ${pedidoId} NO sincronizado con NocoDB (estado: ${estado}). Solo se sincroniza cuando el estado sea "Cerrado".`);
      // }
      
      // Recalcular comisiones automáticamente (en segundo plano, no bloquea la respuesta)
      recalcularComisionesPedido(pedidoId).catch(err => {
        console.error(`❌ [CREAR PEDIDO] Error recalculando comisiones (no crítico):`, err.message);
      });
      
      // Detectar si es una petición fetch/AJAX
      const acceptHeader = req.headers.accept || '';
      const acceptsJson = acceptHeader.includes('application/json');
      const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
      const isFetch = acceptHeader.includes('*/*') || acceptHeader.includes('application/json') || 
                      req.headers['content-type']?.includes('application/x-www-form-urlencoded');
      
      console.log('🔍 [CREAR PEDIDO] Headers de petición (éxito):', {
        accept: acceptHeader,
        'x-requested-with': req.headers['x-requested-with'],
        'content-type': req.headers['content-type'],
        acceptsJson,
        isAjax,
        isFetch
      });
      
      const redirectUrl = `/dashboard/pedidos/${pedidoId}?success=pedido_creado&numero=${numeroPedidoDisplay}`;
      
      // Si es una petición fetch/AJAX, responder con JSON
      if (acceptsJson || isAjax || isFetch) {
        console.log('📤 [CREAR PEDIDO] Devolviendo éxito como JSON para fetch/AJAX');
        console.log('📤 [CREAR PEDIDO] URL de redirección:', redirectUrl);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const jsonResponse = {
          success: true,
          message: 'Pedido creado correctamente',
          pedidoId: pedidoId,
          numeroPedido: numeroPedidoDisplay,
          redirect: redirectUrl
        };
        console.log('📤 [CREAR PEDIDO] Respuesta JSON:', JSON.stringify(jsonResponse));
        console.log('📤 [CREAR PEDIDO] Enviando respuesta JSON...');
        clearTimeout(timeoutId); // Cancelar timeout ya que vamos a responder
        const responseSent = res.status(200).json(jsonResponse);
        console.log('✅ [CREAR PEDIDO] Respuesta JSON enviada correctamente');
        console.log('═══════════════════════════════════════════════════════════');
        return responseSent;
      }
      
      // Si no es fetch, hacer redirect normal
      console.log('📤 [CREAR PEDIDO] Devolviendo redirect normal (no es fetch)');
      console.log('📤 [CREAR PEDIDO] Redirect URL:', redirectUrl);
      clearTimeout(timeoutId); // Cancelar timeout ya que vamos a responder
      const redirectSent = res.redirect(redirectUrl);
      console.log('✅ [CREAR PEDIDO] Redirect enviado correctamente');
      console.log('═══════════════════════════════════════════════════════════');
      return redirectSent;
    } catch (createError) {
      console.error('❌ [CREAR PEDIDO] Error en createPedido:', createError);
      console.error('❌ [CREAR PEDIDO] Error message:', createError.message);
      console.error('❌ [CREAR PEDIDO] Error stack:', createError.stack);
      if (createError.code) {
        console.error('❌ [CREAR PEDIDO] Error code:', createError.code);
      }
      if (createError.sqlState) {
        console.error('❌ [CREAR PEDIDO] SQL State:', createError.sqlState);
      }
      throw createError;
    }
  } catch (calcError) {
    console.error('❌ [CREAR PEDIDO] Error calculando totales:', calcError);
    throw calcError;
  }
  } catch (error) {
    console.error('❌ [CREAR PEDIDO] Error completo:', error);
    console.error('❌ [CREAR PEDIDO] Mensaje:', error.message);
    console.error('❌ [CREAR PEDIDO] Stack trace:', error.stack);
    if (error.code) {
      console.error('❌ [CREAR PEDIDO] Error code:', error.code);
    }
    if (error.sqlState) {
      console.error('❌ [CREAR PEDIDO] SQL State:', error.sqlState);
    }
    if (error.sqlMessage) {
      console.error('❌ [CREAR PEDIDO] SQL Message:', error.sqlMessage);
    }
    console.error('❌ [CREAR PEDIDO] Datos del pedido que fallaron:', {
      cliente_id,
      fecha_pedido,
      forma_pago,
      tipo_pedido,
      estado,
      numero_pedido: typeof numeroPedidoDisplay !== 'undefined' ? numeroPedidoDisplay : 'no definido',
      lineasCount: lineasNormalizadas ? lineasNormalizadas.length : 0,
      lineasPayload: lineasPayload ? lineasPayload.length : 0,
      totalPedido: typeof totalPedido !== 'undefined' ? totalPedido : 'no definido',
      baseImponible: typeof baseImponible !== 'undefined' ? baseImponible : 'no definido',
      importeIva: typeof importeIva !== 'undefined' ? importeIva : 'no definido'
    });

    // Construir mensaje de error más descriptivo
    let mensajeError = 'No se pudo crear el pedido. ';
    if (error.message) {
      mensajeError += `Error: ${error.message}. `;
    }
    if (error.sqlMessage) {
      mensajeError += `SQL: ${error.sqlMessage}. `;
    }
    mensajeError += 'Por favor, verifica los datos e inténtalo de nuevo.';

    // Si la petición viene de fetch (AJAX), devolver JSON
    const acceptHeader = req.headers.accept || '';
    const acceptsJson = acceptHeader.includes('application/json');
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
    const isFetch = acceptHeader.includes('*/*') || acceptHeader.includes('application/json');
    
    // SIEMPRE responder al cliente, incluso si hay un error
    clearTimeout(timeoutId); // Cancelar timeout ya que vamos a responder con error
    if (acceptsJson || isAjax || isFetch) {
      console.log('📤 [CREAR PEDIDO] Devolviendo error 500 como JSON');
      try {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(500).json({
          success: false,
          error: mensajeError,
          errorDetails: error.message,
          sqlError: error.sqlMessage || undefined,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } catch (responseError) {
        console.error('❌ [CREAR PEDIDO] Error al enviar respuesta de error:', responseError);
        // Si ya se envió la respuesta, no hacer nada
        if (!res.headersSent) {
          try {
            res.status(500).json({
              success: false,
              error: 'Error interno del servidor'
            });
          } catch (finalError) {
            console.error('❌ [CREAR PEDIDO] Error crítico al enviar respuesta final:', finalError);
          }
        }
        return;
      }
    }

    // Si no es una petición AJAX/Fetch, renderizar el formulario con error
    try {
      const nuevaReferencia = numero_pedido || numeroPedidoDisplay || await crm.getNextNumeroPedido();
      const [clientes, articulos, clientesCooperativa] = await Promise.all([
        crm.getClientes(),
        crm.getArticulos(),
        crm.getClientesCooperativa()
      ]);

      return res.status(500).render('dashboard/pedido-nuevo', {
        title: 'Nuevo Pedido - Farmadescaso',
        user: req.comercial || req.session.comercial,
        clientes: clientes || [],
        articulos: articulos || [],
        clientesCooperativa: clientesCooperativa || [],
        error: mensajeError,
        formValues: {
          cliente_id,
          fecha_pedido,
          fecha_entrega,
          tipo_pedido,
          forma_pago,
          estado,
          observaciones,
          numero_cooperativa,
          cooperativa_nombre,
          numero_pedido: nuevaReferencia
        },
        lineasValores: lineasPayload || [],
        nuevaReferencia: nuevaReferencia
      });
    } catch (innerError) {
      console.error('❌ Error recargando formulario tras fallo de creación:', innerError.message);
      console.error('❌ Stack trace:', innerError.stack);
      
      let nuevaReferencia = numeroPedidoDisplay;
      try {
        nuevaReferencia = numero_pedido || await crm.getNextNumeroPedido();
      } catch (refError) {
        console.error('❌ Error obteniendo nueva referencia:', refError.message);
      }
      
      return res.status(500).render('dashboard/pedido-nuevo', {
        title: 'Nuevo Pedido - Farmadescaso',
        user: req.comercial || req.session.comercial,
        clientes: [],
        articulos: [],
        clientesCooperativa: [],
        error: `Error crítico: ${innerError.message}. No se pudo recargar el formulario. Por favor, vuelve a la página de pedidos e inténtalo de nuevo.`,
        formValues: {
          cliente_id: cliente_id || '',
          fecha_pedido: fecha_pedido || '',
          fecha_entrega: fecha_entrega || '',
          tipo_pedido: tipo_pedido || '',
          forma_pago: forma_pago || '',
          estado: estado || 'Pendiente',
          observaciones: observaciones || '',
          numero_cooperativa: numero_cooperativa || '',
          cooperativa_nombre: cooperativa_nombre || '',
          numero_pedido: nuevaReferencia
        },
        lineasValores: lineasPayload || [],
        nuevaReferencia: nuevaReferencia
      });
    }
  }
});

const parseMoneyValue = (value) => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const normalized = String(value)
    .replace(/[^0-9,.-]/g, '')
    .replace(',', '.');
  const result = parseFloat(normalized);
  return Number.isNaN(result) ? 0 : result;
};

const construirLineasDesdeRaw = async (lineasRaw = [], crm = null, articulosMap = null) => {
  const lineas = [];
  
  try {
    console.log(`🔍 [CONSTRUIR LINEAS] Procesando ${lineasRaw?.length || 0} líneas raw`);
  
  // Si no hay mapa de artículos pero hay crm, obtener todos los artículos de una vez
  if (!articulosMap && crm) {
    try {
      const todosArticulos = await crm.getArticulos();
      articulosMap = new Map();
      todosArticulos.forEach(art => {
        const id = art.Id || art.id;
        if (id) {
          articulosMap.set(Number(id), art);
        }
      });
    } catch (error) {
      console.warn('⚠️ Error cargando artículos para mapa:', error.message);
      articulosMap = null;
    }
  }
  
  for (const linea of (lineasRaw || [])) {
    // Log de la primera línea para diagnóstico
    if (lineas.length === 0) {
      console.log('🔍 [CONSTRUIR LINEAS] Primera línea raw (muestra):', {
        Id: linea.Id || linea.id,
        Cantidad: linea.Cantidad,
        todasLasClaves: Object.keys(linea),
        camposArticulo: Object.keys(linea).filter(k => 
          k.toLowerCase().includes('articulo') || 
          k.toLowerCase().includes('artículo')
        ),
        muestraArtículo_id: linea['Artículo_id'],
        muestraArtículo_Id: linea['Artículo_Id'],
        muestraArticulo_id: linea['Articulo_id'],
        muestraArticulo_Id: linea['Articulo_Id']
      });
    }
    const cantidad = Number(linea.Cantidad || 0);
    // El nombre del artículo viene del campo 'Articulo' en la tabla pedidos_articulos
    let articuloNombre = linea.Articulo || linea['Articulo'] || linea['Nombre Artículo'] || linea.Nombre || null;
    
    // Si no hay nombre en la línea, intentar obtenerlo del artículo usando el ID
    if (!articuloNombre && articuloId && articulosMap) {
      try {
        const articuloIdNumber = Number(articuloId);
        if (articuloIdNumber && !Number.isNaN(articuloIdNumber)) {
          const articulo = articulosMap.get(articuloIdNumber);
          if (articulo) {
            articuloNombre = articulo.Nombre || articulo.nombre || 'Artículo desconocido';
            console.log(`✅ [CONSTRUIR LINEAS] Nombre de artículo obtenido del mapa: ${articuloNombre} (ID: ${articuloIdNumber})`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ [CONSTRUIR LINEAS] Error obteniendo nombre del artículo ${articuloId}:`, error.message);
      }
    }
    
    // Si aún no hay nombre, usar un valor por defecto
    if (!articuloNombre) {
      articuloNombre = articuloId ? `Artículo #${articuloId}` : 'Artículo desconocido';
      console.warn(`⚠️ [CONSTRUIR LINEAS] No se pudo obtener nombre del artículo, usando: ${articuloNombre}`);
    }
    
    // Obtener precio - puede venir de la línea o del artículo
    let precio = Array.isArray(linea.PVP)
      ? parseMoneyValue(linea.PVP[0])
      : parseMoneyValue(linea.PVP || linea.precio || linea.Precio || linea.Precio_Unitario || 0);
    
    // Obtener IVA del artículo
    let ivaPorcentaje = 0;
    // Intentar múltiples variantes del nombre del campo
    // La columna correcta en pedidos_articulos es Id_Articulo
    let articuloIdRaw = linea.Id_Articulo ||
                        linea['Artículo_id'] || 
                        linea['Artículo_Id'] || 
                        linea['Articulo_id'] || 
                        linea['Articulo_Id'] ||
                        linea.Articulo_Id || 
                        linea.articulo_id || 
                        linea.Artículo_id ||
                        linea['Artículo'] ||
                        linea.Artículo ||
                        linea.Articulo ||
                        linea['Articulo'] ||
                        null;
    
    // Si no se encuentra con los nombres estándar, buscar en todas las claves
    if (!articuloIdRaw) {
      const clavesArticulo = Object.keys(linea).filter(k => 
        k.toLowerCase().includes('articulo') || 
        k.toLowerCase().includes('artículo') ||
        k.toLowerCase().includes('article')
      );
      if (clavesArticulo.length > 0) {
        articuloIdRaw = linea[clavesArticulo[0]];
        console.log(`🔍 [CONSTRUIR LINEAS] Encontrado campo artículo en clave alternativa: ${clavesArticulo[0]}`, articuloIdRaw);
      }
    }
    
    // Normalizar articuloId: puede venir como array, objeto expandido o número/string
    let articuloId = null;
    if (articuloIdRaw) {
      if (Array.isArray(articuloIdRaw)) {
        // Si es array, tomar el primer elemento y extraer el ID
        const firstItem = articuloIdRaw[0];
        if (firstItem) {
          if (typeof firstItem === 'object' && firstItem !== null) {
            // Objeto expandido de NocoDB: puede tener Id, id, o ser el objeto completo
            articuloId = firstItem.Id || firstItem.id || firstItem.ID || firstItem._id || null;
            // Si aún no hay ID, puede que el objeto completo sea el artículo (caso raro)
            if (!articuloId && firstItem.Nombre) {
              // Intentar buscar el ID en otras propiedades
              articuloId = firstItem['Id'] || firstItem['ID'] || null;
            }
          } else {
            articuloId = firstItem;
          }
        }
      } else if (typeof articuloIdRaw === 'object' && articuloIdRaw !== null) {
        // Si es objeto expandido de NocoDB, extraer el ID
        articuloId = articuloIdRaw.Id || articuloIdRaw.id || articuloIdRaw.ID || articuloIdRaw._id || null;
        // Si no se encuentra, puede que sea un objeto con el ID en otra propiedad
        if (!articuloId) {
          // Buscar cualquier propiedad que contenga 'id' o 'Id'
          const idKeys = Object.keys(articuloIdRaw).filter(k => 
            k.toLowerCase() === 'id' || k.toLowerCase() === '_id'
          );
          if (idKeys.length > 0) {
            articuloId = articuloIdRaw[idKeys[0]];
          }
        }
      } else {
        // Si es número o string, usarlo directamente
        articuloId = articuloIdRaw;
      }
    }
    
    // Log para debugging cuando el ID es 1 o no se encuentra (temporal para diagnóstico)
    if (articuloId === 1 || articuloId === '1' || (!articuloId && articuloIdRaw)) {
      console.log('⚠️ [DEBUG ARTICULO ID] Problema detectado en línea:', {
        lineaId: linea.Id || linea.id,
        cantidad: cantidad,
        articuloIdRaw: articuloIdRaw,
        articuloIdRawType: typeof articuloIdRaw,
        articuloIdRawIsArray: Array.isArray(articuloIdRaw),
        articuloId: articuloId,
        camposRelevantes: {
          'Artículo_id': linea['Artículo_id'],
          'Artículo_Id': linea['Artículo_Id'],
          'Articulo_id': linea['Articulo_id'],
          'Articulo_Id': linea['Articulo_Id'],
          'Artículo': linea['Artículo'],
          'Articulo': linea['Articulo']
        },
        todasLasClaves: Object.keys(linea).filter(k => k.toLowerCase().includes('articulo') || k.toLowerCase().includes('artículo'))
      });
    }
    
    // Intentar obtener IVA desde la línea primero (puede venir de relaciones)
    const ivaFromLinea = linea.IVA || linea.iva || linea['IVA %'] || linea['Iva %'] || linea['IVA%'] || linea['Iva%'] || null;
    if (ivaFromLinea !== null && ivaFromLinea !== undefined) {
      ivaPorcentaje = Number(ivaFromLinea) || 0;
    } else if (articuloId) {
      // Si no hay IVA en la línea, obtenerlo del artículo (usar mapa si está disponible)
      try {
        const articuloIdNumber = Number(articuloId);
        
        if (articuloIdNumber && !Number.isNaN(articuloIdNumber)) {
          let articulo = null;
          
          // Intentar obtener del mapa primero (más eficiente)
          if (articulosMap) {
            articulo = articulosMap.get(articuloIdNumber);
          }
          
          // Si no está en el mapa y hay crm, obtenerlo individualmente
          if (!articulo && crm) {
            articulo = await crm.getArticuloById(articuloIdNumber);
          }
          
          if (articulo) {
            // Buscar campo IVA en el artículo (puede tener diferentes nombres)
            ivaPorcentaje = Number(
              articulo.IVA || 
              articulo.iva || 
              articulo['IVA %'] || 
              articulo['Iva %'] || 
              articulo['IVA%'] || 
              articulo['Iva%'] ||
              articulo['% IVA'] ||
              articulo['% Iva'] ||
              0
            ) || 0;
            
            // Si no hay precio en la línea, usar el precio del artículo (PVL)
            if (!precio || precio === 0) {
              precio = parseMoneyValue(
                articulo.PVL || 
                articulo.pvl || 
                articulo.Precio || 
                articulo.precio || 
                0
              );
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Error obteniendo IVA del artículo:', error.message);
      }
    }
    
    // Obtener descuento de la línea - usar el nombre correcto de la columna: DtoLinea
    const descuentoPorcentaje = Number(linea.DtoLinea || linea.Descuento || linea.descuento || 0) || 0;
    
    // Calcular subtotal sin descuento (sin IVA)
    const subtotalSinDescuento = cantidad * precio;
    
    // Aplicar descuento por línea
    const descuentoLineaValor = subtotalSinDescuento * (descuentoPorcentaje / 100);
    const subtotalSinIva = subtotalSinDescuento - descuentoLineaValor;
    
    // Calcular IVA sobre el subtotal con descuento
    const ivaMonto = (subtotalSinIva * ivaPorcentaje) / 100;
    
    // Calcular total (con IVA)
    const totalConIva = subtotalSinIva + ivaMonto;
    
    // Si ya hay un subtotal en la línea, usarlo como referencia pero recalcular con IVA
    // Las columnas en pedidos_articulos son: Subtotal (puede ser null) y no hay Total directamente
    const subtotal = parseMoneyValue(linea.Subtotal) || subtotalSinIva;
    // Calcular total desde subtotal + IVA (no hay columna Total en la tabla)
    const total = subtotal + ivaMonto;
    
    // Log detallado para diagnóstico
    if (!articuloId || articuloId === 1 || articuloId === '1') {
      console.log('🔍 [DEBUG ARTICULO ID] Línea completa:', {
        lineaId: linea.Id || linea.id,
        articuloIdExtraido: articuloId,
        articuloIdRaw: articuloIdRaw,
        articuloIdRawType: typeof articuloIdRaw,
        articuloIdRawIsArray: Array.isArray(articuloIdRaw),
        camposConArticulo: Object.keys(linea).filter(k => 
          k.toLowerCase().includes('articulo') || 
          k.toLowerCase().includes('artículo') ||
          k.toLowerCase().includes('article')
        ),
        muestraLinea: {
          Id: linea.Id,
          Cantidad: linea.Cantidad,
          'Artículo_id': linea['Artículo_id'],
          'Artículo_Id': linea['Artículo_Id'],
          'Articulo_id': linea['Articulo_id'],
          'Articulo_Id': linea['Articulo_Id']
        }
      });
    }
    
    lineas.push({
      id: linea.Id || linea.id,
      articuloId: articuloId,
      articulo: articuloNombre,
      cantidad,
      precio,
      iva: ivaPorcentaje,
      descuento: descuentoPorcentaje,
      descuentoValor: Number(descuentoLineaValor.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      subtotalSinDescuento: Number(subtotalSinDescuento.toFixed(2)),
      ivaMonto: Number(ivaMonto.toFixed(2)),
      total: Number(total.toFixed(2))
    });
  }
  
  return lineas;
  } catch (error) {
    console.error('❌ [CONSTRUIR LINEAS] Error construyendo líneas:', error);
    console.error('❌ [CONSTRUIR LINEAS] Error message:', error.message);
    console.error('❌ [CONSTRUIR LINEAS] Error stack:', error.stack);
    throw error; // Re-lanzar el error
  }
};

const construirPedidoDesdeRaw = (pedidoRaw, lineas = []) => {
  if (!pedidoRaw) return null;

  // Calcular totales desde las líneas (ya incluyen IVA)
  const totalBase = lineas.reduce((sum, l) => sum + (l.subtotal || 0), 0);
  const totalIva = lineas.reduce((sum, l) => sum + (l.ivaMonto || 0), 0);
  const totalConIva = lineas.reduce((sum, l) => sum + (l.total || 0), 0);
  
  // Usar el total calculado desde las líneas (con IVA) o el que viene en el pedido
  const totalPedido = parseMoneyValue(
    pedidoRaw.Total_pedido || pedidoRaw.Total_pedido_ || pedidoRaw.total || totalConIva
  );
  
  // Si el total del pedido no coincide con el calculado, usar el calculado (más preciso)
  const totalFinal = totalConIva > 0 ? totalConIva : totalPedido;
  const impuestoTotal = totalIva || (totalFinal - totalBase);

  // Usar los nombres correctos de las columnas de la base de datos
  const clienteObj = pedidoRaw.Id_Cliente || pedidoRaw.Cliente_id;
  const comercialObj = pedidoRaw.Id_Cial || pedidoRaw.Comercial_id;
  const fechaPedido = pedidoRaw.FechaPedido || pedidoRaw['Fecha Pedido'] || pedidoRaw.fecha || pedidoRaw.Fecha || '';
  const numeroRaw = pedidoRaw.NumPedido || pedidoRaw['Número_Pedido'] || pedidoRaw['Número Pedido'] ||
      pedidoRaw.Numero_Pedido || pedidoRaw.NumeroPedido || pedidoRaw.numero || pedidoRaw.Numero;

  return {
    id: pedidoRaw.Id || pedidoRaw.id,
    numero: formatearNumeroPedido(numeroRaw, fechaPedido),
    numeroOrden: obtenerParteNumericaPedido(numeroRaw, fechaPedido),
    estado: pedidoRaw.EstadoPedido || pedidoRaw.Estado || 'Pendiente',
    fecha: fechaPedido,
    fechaPedido: fechaPedido, // Alias para compatibilidad
    fechaEntrega: pedidoRaw.FechaEntrega || pedidoRaw['Fecha_Entrega'] || pedidoRaw['Fecha Entrega'] || pedidoRaw.fecha_entrega || '',
    formaPago: pedidoRaw['Forma_Pago'] || pedidoRaw['Forma Pago'] || '—', // Se obtendrá desde Id_FormaPago en la ruta
    tipoPedido: pedidoRaw['Tipo_Pedido'] || pedidoRaw['Tipo Pedido'] || '—', // Se obtendrá desde Id_TipoPedido en la ruta
    observaciones: pedidoRaw.Observaciones || '',
    numero_cooperativa: pedidoRaw.numero_cooperativa || pedidoRaw['numero_cooperativa'] || null,
    cooperativa_nombre: pedidoRaw.cooperativa_nombre || pedidoRaw['cooperativa_nombre'] || null,
    cliente: clienteObj && typeof clienteObj === 'object'
      ? (clienteObj.Nombre || clienteObj.nombre || 'Cliente')
      : (clienteObj || 'Cliente'),
    comercial: comercialObj && typeof comercialObj === 'object'
      ? (comercialObj.Nombre || comercialObj.nombre || 'Comercial')
      : (comercialObj || 'Comercial'),
    total: totalFinal,
    subtotal: totalBase,
    impuestos: impuestoTotal < 0 ? 0 : impuestoTotal,
    lineas: lineas.length
  };
};

const obtenerPedidoDetallado = async (pedidoId) => {
  const idNumerico = Number(pedidoId);
  if (Number.isNaN(idNumerico) || idNumerico <= 0) {
    console.error(`❌ [OBTENER PEDIDO] ID inválido: ${pedidoId}`);
    return null;
  }

  console.log(`🔍 [OBTENER PEDIDO] Obteniendo pedido ID: ${idNumerico}`);
  try {
    const pedidoRaw = await crm.getPedidoById(idNumerico);
    if (!pedidoRaw) {
      console.error(`❌ [OBTENER PEDIDO] Pedido no encontrado: ${idNumerico}`);
      return null;
    }
    console.log(`✅ [OBTENER PEDIDO] Pedido encontrado:`, {
      id: pedidoRaw.id || pedidoRaw.Id,
      NumPedido: pedidoRaw.NumPedido,
      Id_Cliente: pedidoRaw.Id_Cliente,
      Id_Cial: pedidoRaw.Id_Cial,
      FechaPedido: pedidoRaw.FechaPedido
    });

    // Obtener el número de pedido primero
    const pedidoNumero = pedidoRaw.NumPedido || pedidoRaw.Numero_Pedido || null;
  
  // Buscar líneas: la tabla pedidos_articulos tiene DOS campos para relacionar:
  // - Id_NumPedido (int) → FK a pedidos.id
  // - NumPedido (varchar) → número de pedido como texto
  // Buscar por AMBOS para asegurar que encontramos las líneas
  let lineasRaw = [];
  console.log(`🔍 [OBTENER PEDIDO] Buscando líneas para pedido ID: ${idNumerico}, NumPedido: "${pedidoNumero}"`);
  
  // Estrategia 1: Buscar por Id_NumPedido (clave foránea directa - más eficiente)
  try {
    lineasRaw = await crm.query('SELECT * FROM pedidos_articulos WHERE Id_NumPedido = ?', [idNumerico]);
    console.log(`✅ [OBTENER PEDIDO] Líneas encontradas por Id_NumPedido (${idNumerico}): ${lineasRaw ? lineasRaw.length : 0}`);
  } catch (error) {
    console.warn('⚠️ Error obteniendo líneas por Id_NumPedido:', error.message);
  }

  // Estrategia 2: Si no se encontraron por Id_NumPedido, buscar por NumPedido (texto)
  if ((!lineasRaw || lineasRaw.length === 0) && pedidoNumero) {
    try {
      const lineasPorNum = await crm.query('SELECT * FROM pedidos_articulos WHERE NumPedido = ?', [pedidoNumero]);
      if (lineasPorNum && lineasPorNum.length > 0) {
        lineasRaw = lineasPorNum;
        console.log(`✅ [OBTENER PEDIDO] Líneas encontradas por NumPedido ("${pedidoNumero}"): ${lineasRaw.length}`);
      }
    } catch (error) {
      console.warn('⚠️ Error obteniendo líneas por NumPedido:', error.message);
    }
  }

  // Estrategia 3: Fallback con getArticulosByPedido si existe
  if (!lineasRaw || lineasRaw.length === 0) {
    try {
      const lineasFallback = await crm.getArticulosByPedido(idNumerico);
      if (lineasFallback && lineasFallback.length > 0) {
        lineasRaw = lineasFallback;
        console.log(`✅ [OBTENER PEDIDO] Líneas encontradas por getArticulosByPedido: ${lineasRaw.length}`);
      }
    } catch (fallbackError) {
      console.warn('⚠️ Error en fallback getArticulosByPedido:', fallbackError.message);
    }
  }

  if (lineasRaw && lineasRaw.length > 0) {
    console.log(`📋 [OBTENER PEDIDO] Primera línea (muestra):`, {
      id: lineasRaw[0].Id || lineasRaw[0].id,
      Id_NumPedido: lineasRaw[0].Id_NumPedido,
      NumPedido: lineasRaw[0].NumPedido,
      Id_Articulo: lineasRaw[0].Id_Articulo,
      Cantidad: lineasRaw[0].Cantidad
    });
  } else {
    console.log(`⚠️ [OBTENER PEDIDO] No se encontraron líneas para el pedido`);
  }
  // Cargar artículos una vez para optimizar
  let articulosMap = null;
  try {
    const todosArticulos = await crm.getArticulos();
    articulosMap = new Map();
    todosArticulos.forEach(art => {
      const id = art.Id || art.id;
      if (id) {
        articulosMap.set(Number(id), art);
      }
    });
  } catch (error) {
    console.warn('⚠️ [OBTENER PEDIDO] Error cargando artículos para detalle:', error.message);
  }
  
  try {
    const lineas = await construirLineasDesdeRaw(lineasRaw, crm, articulosMap);
    const pedido = construirPedidoDesdeRaw(pedidoRaw, lineas);

    if (!pedido) {
      console.error('❌ [OBTENER PEDIDO] construirPedidoDesdeRaw devolvió null');
      throw new Error('No se pudo construir el objeto pedido desde los datos raw');
    }

    console.log(`✅ [OBTENER PEDIDO] Pedido construido:`, {
      id: pedido.id,
      numero: pedido.numero,
      cliente: pedido.cliente,
      lineasCount: lineas.length
    });

    return {
      pedidoRaw,
      lineasRaw,
      pedido,
      lineas
    };
  } catch (innerError) {
    console.error('❌ [OBTENER PEDIDO] Error construyendo pedido o líneas:', innerError);
    console.error('❌ [OBTENER PEDIDO] Inner error message:', innerError.message);
    console.error('❌ [OBTENER PEDIDO] Inner error stack:', innerError.stack);
    throw innerError; // Re-lanzar para que el catch principal lo maneje
  }
  } catch (error) {
    console.error('❌ [OBTENER PEDIDO] Error obteniendo pedido detallado:', error);
    console.error('❌ [OBTENER PEDIDO] Error message:', error.message);
    console.error('❌ [OBTENER PEDIDO] Error stack:', error.stack);
    throw error; // Re-lanzar el error para que la ruta lo maneje
  }
};

const enriquecerLineasConSku = async (lineas = []) => {
  const articulosPorId = {};
  const lineasNormalizadas = [];

  for (const linea of lineas) {
    const articuloId = linea.articuloId || linea['Artículo_id'] || linea.Articulo_Id || null;
    let codigo = linea.codigo || null;

    if (!codigo && articuloId) {
      if (!Object.prototype.hasOwnProperty.call(articulosPorId, articuloId)) {
        try {
          const articulo = await crm.getArticuloById(articuloId);
          articulosPorId[articuloId] = articulo || null;
        } catch (err) {
          console.warn('No se pudo obtener el artículo', articuloId, err.message);
          articulosPorId[articuloId] = null;
        }
      }

      const articuloDatos = articulosPorId[articuloId];
      if (articuloDatos) {
        codigo = articuloDatos['Código'] ||
          articuloDatos.Codigo ||
          articuloDatos.codigo ||
          articuloDatos.SKU ||
          articuloDatos.sku ||
          articuloDatos.id ||
          articuloDatos.Id ||
          null;
      }
    }

    lineasNormalizadas.push({
      ...linea,
      codigo: codigo || linea.codigo || linea.id || null
    });
  }

  return lineasNormalizadas;
};

// Ruta para documento sin valorar para agencia de transporte
// IMPORTANTE: Esta ruta debe estar ANTES de /dashboard/pedidos/:id para que Express la reconozca correctamente
console.log('✅ [RUTAS] Registrando GET /dashboard/pedidos/:id/transporte');
app.get('/dashboard/pedidos/:id/transporte', requireAuth, async (req, res) => {
  try {
    console.log(`📄 [TRANSPORTE] Generando documento de transporte para pedido ID: ${req.params.id}`);
    const detalle = await obtenerPedidoDetallado(req.params.id);
    if (!detalle || !detalle.pedido) {
      return res.status(404).render('error', {
        error: 'Pedido no encontrado',
        message: 'El pedido solicitado no existe'
      });
    }

    const { pedido, lineas, pedidoRaw } = detalle;
    
    // Obtener datos completos del cliente
    let clienteCompleto = null;
    let clienteId = null;
    if (pedidoRaw && (pedidoRaw.Id_Cliente || pedidoRaw.Cliente_id)) {
      const clienteObj = pedidoRaw.Id_Cliente || pedidoRaw.Cliente_id;
      if (typeof clienteObj === 'object' && clienteObj !== null) {
        clienteId = clienteObj.Id || clienteObj.id;
      } else if (typeof clienteObj === 'number' || (typeof clienteObj === 'string' && !isNaN(clienteObj))) {
        clienteId = parseInt(clienteObj);
      }
      
      if (clienteId) {
        try {
          clienteCompleto = await crm.getClienteById(clienteId);
        } catch (error) {
          console.warn('⚠️ Error obteniendo datos del cliente:', error.message);
        }
      }
    }

    // Obtener dirección de envío (si el pedido la tiene)
    let direccionEnvio = null;
    try {
      const dirId = Number(pedidoRaw?.Id_DireccionEnvio || pedidoRaw?.id_direccionenvio || pedidoRaw?.id_direccionEnvio || 0);
      if (Number.isFinite(dirId) && dirId > 0) {
        direccionEnvio = await crm.getDireccionEnvioById(dirId);
      }
    } catch (e) {
      direccionEnvio = null;
    }

    // Enriquecer líneas con datos completos del artículo (incluyendo SKU)
    const lineasEnriquecidas = [];
    for (const linea of lineas) {
      const articuloId = linea.articuloId || linea['Artículo_id'] || linea['Articulo_Id'] || linea.Id_Articulo || null;
      let articuloCompleto = null;
      
      if (articuloId) {
        try {
          articuloCompleto = await crm.getArticuloById(Number(articuloId));
        } catch (error) {
          console.warn(`⚠️ Error obteniendo artículo ${articuloId}:`, error.message);
        }
      }
      
      // Obtener código nacional (SKU) del artículo
      let codigoNacional = null;
      if (articuloCompleto) {
        // Usar SKU en vez de EAN13
        codigoNacional = articuloCompleto.SKU || articuloCompleto.sku || null;
        // Si el SKU es un número, convertirlo a string
        if (codigoNacional && typeof codigoNacional === 'number') {
          codigoNacional = codigoNacional.toString();
        }
      }
      
      lineasEnriquecidas.push({
        ...linea,
        articuloCompleto,
        codigoNacional: codigoNacional || '—',
        nombreArticulo: articuloCompleto?.Nombre || articuloCompleto?.nombre || linea.articulo || 'Artículo desconocido',
        cantidad: linea.cantidad || 0
      });
    }

    // Datos fiscales de Farmadescanso
    const datosEmpresa = {
      nombre: 'FARMADESCANSO 2021 SL',
      cif: 'B75359596',
      direccion: 'Calle Huerta, 15 Bajo',
      codigoPostal: '30193',
      poblacion: 'Yéchar, Mula',
      provincia: 'Murcia',
      pais: 'España'
    };

    res.render('dashboard/pedido-transporte', {
      title: `Documento Transporte - Pedido #${pedido.numero || pedido.id}`,
      pedido,
      pedidoRaw,
      lineas: lineasEnriquecidas,
      cliente: clienteCompleto,
      direccionEnvio,
      datosEmpresa,
      user: req.comercial || req.session.comercial,
      fechaGeneracion: new Date(),
      esPdf: Boolean(req.query.pdf === '1')
    });
  } catch (error) {
    console.error('Error generando documento de transporte:', error);
    res.status(500).render('error', {
      error: 'Error interno',
      message: `No se pudo generar el documento de transporte. Detalles: ${error.message || error}`
    });
  }
});

// Ruta para generar PDF del documento de transporte
app.get('/dashboard/pedidos/:id/transporte/pdf', requireAuth, async (req, res) => {
  let browser = null;
  try {
    console.log(`📄 [PDF-TRANSPORTE] Generando PDF para pedido ID: ${req.params.id}`);
    
    const detalle = await obtenerPedidoDetallado(req.params.id);
    if (!detalle || !detalle.pedido) {
      return res.status(404).render('error', {
        error: 'Pedido no encontrado',
        message: 'El pedido solicitado no existe'
      });
    }

    const { pedido, lineas, pedidoRaw } = detalle;
    
    // Obtener datos completos del cliente
    let clienteCompleto = null;
    let clienteId = null;
    if (pedidoRaw && (pedidoRaw.Id_Cliente || pedidoRaw.Cliente_id)) {
      const clienteObj = pedidoRaw.Id_Cliente || pedidoRaw.Cliente_id;
      if (typeof clienteObj === 'object' && clienteObj !== null) {
        clienteId = clienteObj.Id || clienteObj.id;
      } else if (typeof clienteObj === 'number' || (typeof clienteObj === 'string' && !isNaN(clienteObj))) {
        clienteId = parseInt(clienteObj);
      }
      
      if (clienteId) {
        try {
          clienteCompleto = await crm.getClienteById(clienteId);
        } catch (error) {
          console.warn('⚠️ Error obteniendo datos del cliente:', error.message);
        }
      }
    }

    // Enriquecer líneas con datos completos del artículo (incluyendo SKU)
    const lineasEnriquecidas = [];
    for (const linea of lineas) {
      const articuloId = linea.articuloId || linea['Artículo_id'] || linea['Articulo_Id'] || linea.Id_Articulo || null;
      let articuloCompleto = null;
      
      if (articuloId) {
        try {
          articuloCompleto = await crm.getArticuloById(Number(articuloId));
        } catch (error) {
          console.warn(`⚠️ Error obteniendo artículo ${articuloId}:`, error.message);
        }
      }
      
      let codigoNacional = null;
      if (articuloCompleto) {
        // Usar SKU en vez de EAN13
        codigoNacional = articuloCompleto.SKU || articuloCompleto.sku || null;
        if (codigoNacional && typeof codigoNacional === 'number') {
          codigoNacional = codigoNacional.toString();
        }
      }
      
      lineasEnriquecidas.push({
        ...linea,
        articuloCompleto,
        codigoNacional: codigoNacional || '—',
        nombreArticulo: articuloCompleto?.Nombre || articuloCompleto?.nombre || linea.articulo || 'Artículo desconocido',
        cantidad: linea.cantidad || 0
      });
    }

    const datosEmpresa = {
      nombre: 'FARMADESCANSO 2021 SL',
      cif: 'B75359596',
      direccion: 'Calle Huerta, 15 Bajo',
      codigoPostal: '30193',
      poblacion: 'Yéchar, Mula',
      provincia: 'Murcia',
      pais: 'España'
    };

    const baseUrl = `${getCanonicalOrigin()}`;
    
    // Convertir logo a base64 para incluirlo directamente en el PDF
    let logoBase64 = null;
    try {
      const logoPath = path.join(__dirname, 'public', 'images', 'logo.png');
      console.log('🔍 [PDF] Buscando logo en:', logoPath);
      console.log('🔍 [PDF] __dirname:', __dirname);
      console.log('🔍 [PDF] Existe:', fs.existsSync(logoPath));
      
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        console.log('✅ [PDF] Logo convertido a base64, tamaño:', logoBase64.length, 'caracteres');
      } else {
        // Intentar rutas alternativas
        const altPaths = [
          path.join(process.cwd(), 'public', 'images', 'logo.png'),
          path.join(__dirname, '..', 'public', 'images', 'logo.png'),
          './public/images/logo.png'
        ];
        
        for (const altPath of altPaths) {
          console.log('🔍 [PDF] Intentando ruta alternativa:', altPath);
          if (fs.existsSync(altPath)) {
            const logoBuffer = fs.readFileSync(altPath);
            logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            console.log('✅ [PDF] Logo encontrado en ruta alternativa, tamaño:', logoBase64.length, 'caracteres');
            break;
          }
        }
        
        if (!logoBase64) {
          console.warn('⚠️ [PDF] Logo no encontrado en ninguna ruta');
        }
      }
    } catch (error) {
      console.error('❌ [PDF] Error leyendo logo:', error.message);
      console.error('❌ [PDF] Stack:', error.stack);
    }
    
    const locals = {
      layout: false,
      title: `Documento Transporte - Pedido #${pedido.numero || pedido.id}`,
      pedido,
      pedidoRaw,
      lineas: lineasEnriquecidas,
      cliente: clienteCompleto,
      datosEmpresa,
      user: req.comercial || req.session.comercial,
      fechaGeneracion: new Date(),
      esPdf: true,
      baseUrl: baseUrl,
      logoBase64: logoBase64
    };
    
    console.log('🔍 [PDF] logoBase64 presente:', !!locals.logoBase64);
    console.log('🔍 [PDF] logoBase64 length:', locals.logoBase64 ? locals.logoBase64.length : 0);
    if (locals.logoBase64) {
      console.log('🔍 [PDF] logoBase64 primeros 50 chars:', locals.logoBase64.substring(0, 50));
      console.log('🔍 [PDF] logoBase64 empieza con data:image:', locals.logoBase64.startsWith('data:image'));
    }

    req.app.render('dashboard/pedido-transporte', locals, async (renderErr, html) => {
      if (renderErr) {
        console.error('❌ [PDF-TRANSPORTE] Error renderizando:', renderErr);
        return res.status(500).render('error', {
          error: 'Error interno',
          message: `No se pudo generar el documento. Error: ${renderErr.message || renderErr}`
        });
      }

      // Verificar que el logo esté en el HTML renderizado
      if (html && html.includes('data:image/png;base64,')) {
        console.log('✅ [PDF] Logo base64 encontrado en HTML renderizado');
        const base64Match = html.match(/data:image\/png;base64,([^"']+)/);
        if (base64Match) {
          console.log('✅ [PDF] Base64 encontrado, longitud:', base64Match[1].length);
        }
      } else {
        console.warn('⚠️ [PDF] Logo base64 NO encontrado en HTML renderizado');
        console.warn('⚠️ [PDF] HTML length:', html ? html.length : 0);
        // Buscar si hay alguna referencia al logo en el HTML
        if (html && html.includes('documento-logo')) {
          console.warn('⚠️ [PDF] Elemento .documento-logo encontrado pero sin base64');
          // Buscar qué src tiene el logo
          const logoMatch = html.match(/<img[^>]*class="documento-logo"[^>]*src="([^"]+)"/);
          if (logoMatch) {
            console.warn('⚠️ [PDF] Logo src encontrado:', logoMatch[1].substring(0, 100));
          }
        }
      }

      try {
        // Convertir URLs relativas a absolutas para Puppeteer
        const baseUrl = `${getCanonicalOrigin()}`;
        console.log(`📄 [PDF] Base URL para imágenes: ${baseUrl}`);
        // El template ya debería tener baseUrl renderizado, pero por si acaso convertimos todas las URLs relativas
        const htmlWithAbsoluteUrls = html
          .replace(/href="\/(css|images|js)\//g, `href="${baseUrl}/$1/`)
          .replace(/src="\/(css|images|js)\//g, `src="${baseUrl}/$1/`)
          .replace(/src="http:\/\/localhost:3000\/images\/logo\.png"/g, `src="${baseUrl}/images/logo.png"`)
          .replace(/src="http:\/\/127\.0\.0\.1:3000\/images\/logo\.png"/g, `src="${baseUrl}/images/logo.png"`)
          .replace(/<%= baseUrl %>/g, baseUrl);

        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
          ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
        // Configurar interceptor de requests para asegurar que las imágenes se carguen
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          request.continue();
        });
        
        await page.setContent(htmlWithAbsoluteUrls, { 
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        // Esperar específicamente a que el logo se cargue
        try {
          await page.waitForSelector('.documento-logo', { timeout: 10000 });
          
          // Verificar que el logo se haya cargado correctamente
          const logoLoaded = await page.evaluate(() => {
            const logo = document.querySelector('.documento-logo');
            if (logo) {
              // Si es una imagen, verificar que se haya cargado
              if (logo.tagName === 'IMG') {
                return logo.complete && logo.naturalWidth > 0;
              }
              return true; // Si no es una imagen, asumir que está bien
            }
            return false;
          });
          
          if (!logoLoaded) {
            console.warn('⚠️ [PDF] Logo no se cargó correctamente, esperando...');
            await page.evaluate(() => {
              const logo = document.querySelector('.documento-logo');
              if (logo && logo.tagName === 'IMG') {
                return new Promise((resolve) => {
                  if (logo.complete && logo.naturalWidth > 0) {
                    resolve();
                  } else {
                    logo.onload = () => resolve();
                    logo.onerror = () => {
                      console.error('Error cargando logo:', logo.src);
                      resolve();
                    };
                    setTimeout(resolve, 10000);
                  }
                });
              }
            });
          } else {
            console.log('✅ [PDF] Logo cargado correctamente');
          }
        } catch (error) {
          console.warn('⚠️ [PDF] Logo no encontrado o no se pudo cargar:', error.message);
        }
        
        // Esperar a que todas las imágenes se carguen
        await page.evaluate(() => {
          return Promise.all(
            Array.from(document.images).map(img => {
              if (img.complete && img.naturalWidth > 0) return Promise.resolve();
              return new Promise((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(resolve, 5000);
              });
            })
          );
        });
        
        // Esperar un poco más para asegurar que el logo se renderice
        await new Promise(resolve => setTimeout(resolve, 2000));

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20px', right: '10px', bottom: '25px', left: '10px' },
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: '<div style="font-size: 9pt; color: #666; text-align: center; width: 100%; padding: 0; margin: 0; font-family: Arial, sans-serif; height: 20px; display: flex; align-items: center; justify-content: center;"><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>',
          timeout: 30000
        });

        await browser.close();
        browser = null;

        const fileName = `Transporte-Pedido-${(pedido.numero || pedido.id || 'documento').toString().replace(/\s+/g, '_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(pdfBuffer);
        console.log(`✅ [PDF-TRANSPORTE] PDF generado: ${fileName}`);
      } catch (puppeteerError) {
        console.error('❌ [PDF-TRANSPORTE] Error con Puppeteer:', puppeteerError);
        if (browser) {
          try {
            await browser.close();
          } catch (closeError) {
            console.error('❌ [PDF-TRANSPORTE] Error cerrando navegador:', closeError);
          }
          browser = null;
        }
        return res.status(500).render('error', {
          error: 'Error interno',
          message: `No se pudo generar el PDF. Error: ${puppeteerError.message || puppeteerError}`
        });
      }
    });
  } catch (error) {
    console.error('❌ [PDF-TRANSPORTE] Error:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('❌ [PDF-TRANSPORTE] Error cerrando navegador:', closeError);
      }
    }
    res.status(500).render('error', {
      error: 'Error interno',
      message: `No se pudo generar el PDF. Detalles: ${error.message || error}`
    });
  }
});

// Ruta para enviar PDF del documento de transporte por email
// IMPORTANTE: Esta ruta debe estar ANTES de /dashboard/pedidos/:id para evitar conflictos
console.log('✅ [RUTAS] Registrando POST /dashboard/pedidos/:id/transporte/enviar');
app.post('/dashboard/pedidos/:id/transporte/enviar', requireAuth, async (req, res) => {
  let browser = null;
  try {
    console.log(`📧 [EMAIL-TRANSPORTE] Enviando PDF por email para pedido ID: ${req.params.id}`);
    console.log(`📧 [EMAIL-TRANSPORTE] Body recibido:`, req.body);
    
    // Asegurar que siempre devolvemos JSON
    res.setHeader('Content-Type', 'application/json');
    
    const { emails } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar al menos una dirección de email'
      });
    }

    const detalle = await obtenerPedidoDetallado(req.params.id);
    if (!detalle || !detalle.pedido) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    const { pedido, lineas, pedidoRaw } = detalle;
    
    // Obtener datos completos del cliente
    let clienteCompleto = null;
    let clienteId = null;
    if (pedidoRaw && (pedidoRaw.Id_Cliente || pedidoRaw.Cliente_id)) {
      const clienteObj = pedidoRaw.Id_Cliente || pedidoRaw.Cliente_id;
      if (typeof clienteObj === 'object' && clienteObj !== null) {
        clienteId = clienteObj.Id || clienteObj.id;
      } else if (typeof clienteObj === 'number' || (typeof clienteObj === 'string' && !isNaN(clienteObj))) {
        clienteId = parseInt(clienteObj);
      }
      
      if (clienteId) {
        try {
          clienteCompleto = await crm.getClienteById(clienteId);
        } catch (error) {
          console.warn('⚠️ Error obteniendo datos del cliente:', error.message);
        }
      }
    }

    // Enriquecer líneas
    const lineasEnriquecidas = [];
    for (const linea of lineas) {
      const articuloId = linea.articuloId || linea['Artículo_id'] || linea['Articulo_Id'] || linea.Id_Articulo || null;
      let articuloCompleto = null;
      
      if (articuloId) {
        try {
          articuloCompleto = await crm.getArticuloById(Number(articuloId));
        } catch (error) {
          console.warn(`⚠️ Error obteniendo artículo ${articuloId}:`, error.message);
        }
      }
      
      let codigoNacional = null;
      if (articuloCompleto) {
        // Usar SKU en vez de EAN13
        codigoNacional = articuloCompleto.SKU || articuloCompleto.sku || null;
        if (codigoNacional && typeof codigoNacional === 'number') {
          codigoNacional = codigoNacional.toString();
        }
      }
      
      lineasEnriquecidas.push({
        ...linea,
        articuloCompleto,
        codigoNacional: codigoNacional || '—',
        nombreArticulo: articuloCompleto?.Nombre || articuloCompleto?.nombre || linea.articulo || 'Artículo desconocido',
        cantidad: linea.cantidad || 0
      });
    }

    const datosEmpresa = {
      nombre: 'FARMADESCANSO 2021 SL',
      cif: 'B75359596',
      direccion: 'Calle Huerta, 15 Bajo',
      codigoPostal: '30193',
      poblacion: 'Yéchar, Mula',
      provincia: 'Murcia',
      pais: 'España'
    };

    // Generar HTML
    const baseUrl = `${getCanonicalOrigin()}`;
    
    // Convertir logo a base64 para incluirlo directamente en el PDF
    let logoBase64 = null;
    try {
      const logoPath = path.join(__dirname, 'public', 'images', 'logo.png');
      console.log('🔍 [EMAIL PDF] Buscando logo en:', logoPath);
      console.log('🔍 [EMAIL PDF] __dirname:', __dirname);
      console.log('🔍 [EMAIL PDF] Existe:', fs.existsSync(logoPath));
      
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        console.log('✅ [EMAIL PDF] Logo convertido a base64, tamaño:', logoBase64.length, 'caracteres');
      } else {
        // Intentar rutas alternativas
        const altPaths = [
          path.join(process.cwd(), 'public', 'images', 'logo.png'),
          path.join(__dirname, '..', 'public', 'images', 'logo.png'),
          './public/images/logo.png'
        ];
        
        for (const altPath of altPaths) {
          console.log('🔍 [EMAIL PDF] Intentando ruta alternativa:', altPath);
          if (fs.existsSync(altPath)) {
            const logoBuffer = fs.readFileSync(altPath);
            logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            console.log('✅ [EMAIL PDF] Logo encontrado en ruta alternativa, tamaño:', logoBase64.length, 'caracteres');
            break;
          }
        }
        
        if (!logoBase64) {
          console.warn('⚠️ [EMAIL PDF] Logo no encontrado en ninguna ruta');
        }
      }
    } catch (error) {
      console.error('❌ [EMAIL PDF] Error leyendo logo:', error.message);
      console.error('❌ [EMAIL PDF] Stack:', error.stack);
    }
    
    console.log('🔍 [EMAIL PDF] logoBase64 presente:', !!logoBase64);
    console.log('🔍 [EMAIL PDF] logoBase64 length:', logoBase64 ? logoBase64.length : 0);
    
    const htmlDocumento = await new Promise((resolve, reject) => {
      req.app.render('dashboard/pedido-transporte', {
        layout: false,
        title: `Documento Transporte - Pedido #${pedido.numero || pedido.id}`,
        pedido,
        pedidoRaw,
        lineas: lineasEnriquecidas,
        cliente: clienteCompleto,
        datosEmpresa,
        user: req.comercial || req.session.comercial,
        fechaGeneracion: new Date(),
        esPdf: true,
        baseUrl: baseUrl,
        logoBase64: logoBase64
      }, (err, html) => {
        if (err) reject(err);
        else {
          // Verificar que el logo esté en el HTML renderizado
          if (html && html.includes('data:image/png;base64,')) {
            console.log('✅ [EMAIL PDF] Logo base64 encontrado en HTML renderizado');
          } else {
            console.warn('⚠️ [EMAIL PDF] Logo base64 NO encontrado en HTML renderizado');
            console.warn('⚠️ [EMAIL PDF] HTML length:', html ? html.length : 0);
            // Buscar si hay alguna referencia al logo en el HTML
            if (html && html.includes('documento-logo')) {
              console.warn('⚠️ [EMAIL PDF] Elemento .documento-logo encontrado pero sin base64');
            }
          }
          resolve(html);
        }
      });
    });

    // Generar PDF
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    // Convertir URLs relativas a absolutas para Puppeteer
    // baseUrl ya está declarado arriba, reutilizamos la misma variable
    console.log(`📧 [EMAIL PDF] Base URL para imágenes: ${baseUrl}`);
    // El template ya debería tener baseUrl renderizado, pero por si acaso convertimos todas las URLs relativas
    const htmlWithAbsoluteUrls = htmlDocumento
      .replace(/href="\/(css|images|js)\//g, `href="${baseUrl}/$1/`)
      .replace(/src="\/(css|images|js)\//g, `src="${baseUrl}/$1/`)
      .replace(/src="http:\/\/localhost:3000\/images\/logo\.png"/g, `src="${baseUrl}/images/logo.png"`)
      .replace(/src="http:\/\/127\.0\.0\.1:3000\/images\/logo\.png"/g, `src="${baseUrl}/images/logo.png"`)
      .replace(/<%= baseUrl %>/g, baseUrl);

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    
    // Configurar interceptor de requests para asegurar que las imágenes se carguen
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      request.continue();
    });
    
    await page.setContent(htmlWithAbsoluteUrls, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Esperar específicamente a que el logo se cargue
    try {
      await page.waitForSelector('.documento-logo', { timeout: 10000 });
      
      // Verificar que el logo se haya cargado correctamente
      const logoLoaded = await page.evaluate(() => {
        const logo = document.querySelector('.documento-logo');
        if (logo) {
          // Si es una imagen, verificar que se haya cargado
          if (logo.tagName === 'IMG') {
            return logo.complete && logo.naturalWidth > 0;
          }
          return true; // Si no es una imagen, asumir que está bien
        }
        return false;
      });
      
      if (!logoLoaded) {
        console.warn('⚠️ [EMAIL PDF] Logo no se cargó correctamente, esperando...');
        await page.evaluate(() => {
          const logo = document.querySelector('.documento-logo');
          if (logo && logo.tagName === 'IMG') {
            return new Promise((resolve) => {
              if (logo.complete && logo.naturalWidth > 0) {
                resolve();
              } else {
                logo.onload = () => resolve();
                logo.onerror = () => {
                  console.error('Error cargando logo:', logo.src);
                  resolve();
                };
                setTimeout(resolve, 10000);
              }
            });
          }
        });
      } else {
        console.log('✅ [EMAIL PDF] Logo cargado correctamente');
      }
    } catch (error) {
      console.warn('⚠️ [EMAIL PDF] Logo no encontrado o no se pudo cargar:', error.message);
    }
    
    // Esperar a que todas las imágenes se carguen
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images).map(img => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 5000);
          });
        })
      );
    });
    
    // Esperar un poco más para asegurar que el logo se renderice
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '10px', bottom: '25px', left: '10px' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="font-size: 9pt; color: #666; text-align: center; width: 100%; padding: 0; margin: 0; font-family: Arial, sans-serif; height: 20px; display: flex; align-items: center; justify-content: center;"><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>',
      timeout: 30000
    });

    await browser.close();
    browser = null;

    // Enviar email
    const fileName = `Transporte-Pedido-${(pedido.numero || pedido.id || 'documento').toString().replace(/\s+/g, '_')}.pdf`;
    const clienteNombre = clienteCompleto ? (clienteCompleto.Nombre_Razon_Social || clienteCompleto.Nombre || clienteCompleto.nombre || 'Cliente') : 'Cliente';

    const mailOptions = {
      from: process.env.MAIL_USER || 'pedidos@farmadescanso.com',
      to: emails.join(', '),
      subject: `Documento Transporte - Pedido ${pedido.numero || pedido.id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0b7a3d;">Documento Sin Valorar para Transporte</h2>
          <p>Estimado/a,</p>
          <p>Le enviamos el documento sin valorar para transporte correspondiente al pedido <strong>${pedido.numero || pedido.id}</strong>.</p>
          <p><strong>Cliente:</strong> ${clienteNombre}</p>
          <p>El documento se adjunta en formato PDF.</p>
          <p>Si tiene alguna pregunta, no dude en contactarnos.</p>
          <p>Atentamente,<br><strong>Farmadescanso 2021 SL</strong></p>
          <hr>
          <p style="font-size: 12px; color: #666;">
            FARMADESCANSO 2021 SL<br>
            CIF: B75359596<br>
            Calle Huerta, 15 Bajo<br>
            30193 Yéchar, Mula, Murcia<br>
            España
          </p>
        </div>
      `,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await mailTransport.sendMail(mailOptions);
    console.log(`✅ [EMAIL-TRANSPORTE] PDF enviado a: ${emails.join(', ')}`);

    // Cambiar el estado del pedido a "Tramitado" si el estado actual es "Pendiente"
    try {
      const estadoActual = (pedidoRaw.EstadoPedido || pedidoRaw.Estado || pedido.estado || '').toLowerCase();
      if (estadoActual === 'pendiente' || estadoActual.includes('pend')) {
        await crm.updatePedido(req.params.id, { 'EstadoPedido': 'Tramitado' });
        console.log(`✅ [EMAIL-TRANSPORTE] Estado del pedido ${req.params.id} cambiado de "Pendiente" a "Tramitado"`);
      } else {
        console.log(`ℹ️ [EMAIL-TRANSPORTE] Estado actual del pedido es "${estadoActual}", no se cambia a "Tramitado"`);
      }
    } catch (estadoError) {
      console.warn('⚠️ [EMAIL-TRANSPORTE] Error al cambiar el estado del pedido:', estadoError.message);
      // No fallamos la respuesta si hay error al cambiar el estado, el email ya se envió
    }

    res.json({
      success: true,
      message: `PDF enviado correctamente a ${emails.length} destinatario(s)`
    });
  } catch (error) {
    console.error('❌ [EMAIL-TRANSPORTE] Error:', error);
    console.error('❌ [EMAIL-TRANSPORTE] Stack:', error.stack);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('❌ [EMAIL-TRANSPORTE] Error cerrando navegador:', closeError);
      }
    }
    // Asegurar que siempre devolvemos JSON
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      success: false,
      error: `No se pudo enviar el PDF. Detalles: ${error.message || error}`
    });
  }
});

// IMPORTANTE: Las rutas POST deben estar antes de las rutas GET generales
console.log('✅ [RUTAS] Registrando POST /dashboard/pedidos/:id/transporte/enviar');

app.get('/dashboard/pedidos/:id', requireAuth, async (req, res) => {
  try {
    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    
    const detalle = await obtenerPedidoDetallado(req.params.id);
    if (!detalle || !detalle.pedido) {
      return res.status(404).render('error', {
        error: 'Pedido no encontrado',
        message: 'El pedido solicitado no existe'
      });
    }

    const { pedido, lineas, pedidoRaw } = detalle;
    
    // Si no es admin, verificar que el pedido pertenezca al comercial autenticado
    if (!esAdmin && comercialIdAutenticado && pedidoRaw) {
      const pedidoComercialId = pedidoRaw.Id_Cial || pedidoRaw.id_cial || pedidoRaw.Comercial_id || pedidoRaw.comercial_id;
      if (Number(pedidoComercialId) !== Number(comercialIdAutenticado)) {
        return res.status(403).render('error', {
          error: 'Acceso denegado',
          message: 'No tienes permiso para ver este pedido.'
        });
      }
    }
    const lineasConSku = await enriquecerLineasConSku(lineas);

    // Obtener nombre del cliente si solo tenemos el ID
    let nombreCliente = null;
    let clienteId = null;
    if (pedidoRaw && (pedidoRaw.Id_Cliente || pedidoRaw.Cliente_id)) {
      const clienteObj = pedidoRaw.Id_Cliente || pedidoRaw.Cliente_id;
      if (typeof clienteObj === 'object' && clienteObj !== null) {
        clienteId = clienteObj.Id || clienteObj.id;
        nombreCliente = clienteObj.Nombre_Razon_Social || clienteObj.Nombre || clienteObj.nombre;
      } else if (typeof clienteObj === 'number' || (typeof clienteObj === 'string' && !isNaN(clienteObj))) {
        clienteId = parseInt(clienteObj);
        try {
          const cliente = await crm.getClienteById(clienteId);
          if (cliente) {
            nombreCliente = cliente.Nombre_Razon_Social || cliente.Nombre || cliente.nombre;
          }
        } catch (error) {
          console.warn('⚠️ Error obteniendo nombre del cliente:', error.message);
        }
      }
    }

    // Actualizar el campo cliente en el objeto pedido para incluir el nombre
    if (nombreCliente) {
      pedido.cliente = nombreCliente;
    } else if (clienteId) {
      pedido.cliente = `Cliente #${clienteId}`;
    }

    // Obtener nombre del comercial si solo tenemos el ID
    let nombreComercial = null;
    let comercialId = null;
    if (pedidoRaw && (pedidoRaw.Id_Cial || pedidoRaw.Comercial_id)) {
      const comercialObj = pedidoRaw.Id_Cial || pedidoRaw.Comercial_id;
      if (typeof comercialObj === 'object' && comercialObj !== null && comercialObj.Id) {
        comercialId = comercialObj.Id;
        nombreComercial = comercialObj.Nombre || comercialObj.nombre;
      } else if (typeof comercialObj === 'number' || (typeof comercialObj === 'string' && !isNaN(comercialObj))) {
        comercialId = parseInt(comercialObj);
        try {
          const comercial = await crm.getComercialById(comercialId);
          if (comercial) {
            nombreComercial = comercial.Nombre || comercial.nombre;
          }
        } catch (error) {
          console.warn('⚠️ Error obteniendo nombre del comercial:', error.message);
        }
      }
    }

    // Actualizar el campo comercial en el objeto pedido para incluir ID y nombre
    if (nombreComercial) {
      pedido.comercial = nombreComercial;
    } else if (comercialId) {
      pedido.comercial = `Comercial #${comercialId}`;
    }

    // Obtener forma de pago desde Id_FormaPago
    if (pedidoRaw && pedidoRaw.Id_FormaPago) {
      try {
        const formaPagoId = Number(pedidoRaw.Id_FormaPago);
        if (!Number.isNaN(formaPagoId) && formaPagoId > 0) {
          const formaPagoObj = await crm.getFormaPagoById(formaPagoId);
          if (formaPagoObj) {
            pedido.formaPago = formaPagoObj.FormaPago || formaPagoObj.Forma || formaPagoObj.forma || '—';
          }
        }
      } catch (error) {
        console.warn('⚠️ Error obteniendo forma de pago:', error.message);
      }
    }

    // Obtener tipo de pedido desde Id_TipoPedido
    if (pedidoRaw && pedidoRaw.Id_TipoPedido) {
      try {
        const tipoPedidoId = Number(pedidoRaw.Id_TipoPedido);
        if (!Number.isNaN(tipoPedidoId) && tipoPedidoId > 0) {
          // Consulta directa a la tabla tipos_pedidos
          const tipoPedidoResult = await crm.query('SELECT Tipo FROM tipos_pedidos WHERE id = ? LIMIT 1', [tipoPedidoId]);
          if (tipoPedidoResult && tipoPedidoResult.length > 0) {
            pedido.tipoPedido = tipoPedidoResult[0].Tipo || '—';
          }
        }
      } catch (error) {
        console.warn('⚠️ Error obteniendo tipo de pedido:', error.message);
      }
    }

    const puedeAgregarLineas = (pedido.estado || '').toLowerCase() === 'pendiente';
    let articulosDisponibles = [];

    if (puedeAgregarLineas) {
      try {
        articulosDisponibles = await crm.getArticulos();
      } catch (articulosError) {
        console.error('Error obteniendo artículos para agregar líneas:', articulosError);
      }
    }

    res.render('dashboard/pedido-detalle', {
      title: `Pedido #${pedido.numero || pedido.id}`,
      user: req.comercial || req.session.comercial,
      pedido,
      lineas: lineasConSku,
      query: req.query,
      error: null,
      puedeAgregarLineas,
      articulosDisponibles,
      fechaLineaSugerida: pedido.fecha ? new Date(pedido.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error cargando detalle de pedido:', error);
    res.status(500).render('error', {
      error: 'Error interno',
    message: `No se pudo cargar el detalle del pedido. Detalles: ${error.message || error}`
    });
  }
});

app.get('/dashboard/pedidos/:id/editar', requireAuth, async (req, res) => {
  try {
    const pedidoId = req.params.id;
    console.log(`📝 [EDITAR PEDIDO] Cargando pedido ID: ${pedidoId}`);
    const detalle = await obtenerPedidoDetallado(pedidoId);
    if (!detalle || !detalle.pedido) {
      console.error(`❌ [EDITAR PEDIDO] Pedido no encontrado: ${req.params.id}`);
      return res.status(404).render('error', {
        error: 'Pedido no encontrado',
        message: 'El pedido solicitado no existe'
      });
    }

    const { pedido, lineas, pedidoRaw } = detalle;
    console.log(`✅ [EDITAR PEDIDO] Pedido cargado:`, {
      id: pedido.id,
      numero: pedido.numero,
      clienteId: pedidoRaw.Id_Cliente,
      comercialId: pedidoRaw.Id_Cial,
      fechaPedido: pedidoRaw.FechaPedido
    });

    if (!pedido || !pedido.id) {
      console.error(`❌ [EDITAR PEDIDO] Pedido inválido después de obtener detalle`);
      return res.status(404).render('error', {
        error: 'Pedido no encontrado',
        message: 'El pedido solicitado no existe o no se pudo cargar'
      });
    }

    if ((pedido.estado || '').toLowerCase() === 'cerrado') {
      return res.redirect(`/dashboard/pedidos/${pedidoId}?error=pedido_cerrado`);
    }

    // Obtener todos los datos necesarios para el formulario
    console.log(`🔍 [EDITAR PEDIDO] Obteniendo datos para el formulario...`);
    let clientes = [];
    let articulos = [];
    let clientesCooperativa = [];
    let comerciales = [];
    let formasPago = [];
    let tiposPedido = [];
    
    try {
      const formasPagoPromise = crm.getFormasPago().catch(err => { 
        console.error('❌ [EDITAR PEDIDO] Error obteniendo formas de pago:', err.message);
        console.error('❌ [EDITAR PEDIDO] Stack:', err.stack);
        return []; 
      });
      
      const tiposPedidoPromise = crm.query('SELECT id, Tipo FROM tipos_pedidos ORDER BY Tipo ASC').catch(err => { 
        console.error('❌ [EDITAR PEDIDO] Error obteniendo tipos de pedido:', err.message);
        console.error('❌ [EDITAR PEDIDO] Stack:', err.stack);
        return []; 
      });
      
      [clientes, articulos, clientesCooperativa, comerciales, formasPago, tiposPedido] = await Promise.all([
        crm.getClientes().catch(err => { console.warn('⚠️ [EDITAR PEDIDO] Error obteniendo clientes:', err.message); return []; }),
        crm.getArticulos().catch(err => { console.warn('⚠️ [EDITAR PEDIDO] Error obteniendo artículos:', err.message); return []; }),
        crm.getClientesCooperativa().catch(err => { console.warn('⚠️ [EDITAR PEDIDO] Error obteniendo clientes-cooperativa:', err.message); return []; }),
        crm.getComerciales().catch(err => { console.warn('⚠️ [EDITAR PEDIDO] Error obteniendo comerciales:', err.message); return []; }),
        formasPagoPromise,
        tiposPedidoPromise
      ]);
      
      // Verificar que tiposPedido sea un array
      if (!Array.isArray(tiposPedido)) {
        console.warn(`⚠️ [EDITAR PEDIDO] tiposPedido no es un array, tipo: ${typeof tiposPedido}`);
        tiposPedido = [];
      }
      
      // Verificar que formasPago sea un array
      if (!Array.isArray(formasPago)) {
        console.warn(`⚠️ [EDITAR PEDIDO] formasPago no es un array, tipo: ${typeof formasPago}`);
        formasPago = [];
      }
      
      // Debug: Verificar qué se obtuvo
      console.log(`🔍 [EDITAR PEDIDO] Debug de datos obtenidos:`, {
        formasPagoType: typeof formasPago,
        formasPagoIsArray: Array.isArray(formasPago),
        formasPagoLength: formasPago?.length,
        formasPagoFirst3: formasPago?.slice(0, 3),
        tiposPedidoType: typeof tiposPedido,
        tiposPedidoIsArray: Array.isArray(tiposPedido),
        tiposPedidoLength: tiposPedido?.length,
        tiposPedidoFirst3: tiposPedido?.slice(0, 3)
      });
      console.log(`✅ [EDITAR PEDIDO] Datos obtenidos:`, {
        clientes: clientes?.length || 0,
        articulos: articulos?.length || 0,
        clientesCooperativa: clientesCooperativa?.length || 0,
        comerciales: comerciales?.length || 0,
        formasPago: formasPago?.length || 0,
        tiposPedido: tiposPedido?.length || 0
      });
    } catch (error) {
      console.error('❌ [EDITAR PEDIDO] Error obteniendo datos del formulario:', error);
      throw error; // Re-lanzar para que el catch principal lo maneje
    }

    // Extraer ID del cliente del pedido - usar el nombre correcto de la columna
    const clienteIdRaw = pedidoRaw.Id_Cliente || pedidoRaw.Cliente_id;
    const clienteId = Array.isArray(clienteIdRaw)
      ? (clienteIdRaw[0]?.Id || clienteIdRaw[0]?.id || clienteIdRaw[0])
      : (typeof clienteIdRaw === 'object' ? (clienteIdRaw?.Id || clienteIdRaw?.id) : clienteIdRaw);

    // Extraer ID del comercial del pedido - usar el nombre correcto de la columna
    const comercialIdRaw = pedidoRaw.Id_Cial || pedidoRaw.Comercial_id;
    const comercialId = Array.isArray(comercialIdRaw)
      ? (comercialIdRaw[0]?.Id || comercialIdRaw[0]?.id || comercialIdRaw[0])
      : (typeof comercialIdRaw === 'object' ? (comercialIdRaw?.Id || comercialIdRaw?.id) : comercialIdRaw);

    const esAdmin = isAdmin(req);

    // Preparar líneas para el formulario
    // Nota: articuloId ya viene normalizado desde construirLineasDesdeRaw
    console.log(`🔍 [EDITAR PEDIDO] Preparando ${lineas?.length || 0} líneas para el formulario...`);
    console.log(`🔍 [EDITAR PEDIDO] Líneas raw recibidas:`, lineas?.map(l => ({
      id: l.id,
      articuloId: l.articuloId,
      cantidad: l.cantidad,
      precio: l.precio
    })));
    let lineasValores = [];
    try {
      lineasValores = (lineas || []).map((linea, index) => {
        // Asegurar que articuloId sea un número o string simple (ya debería estar normalizado)
        let articuloId = linea.articuloId;
        if (articuloId) {
          if (Array.isArray(articuloId)) {
            articuloId = articuloId[0]?.Id || articuloId[0]?.id || articuloId[0] || null;
          } else if (typeof articuloId === 'object') {
            articuloId = articuloId.Id || articuloId.id || null;
          }
        }
        
        const lineaValor = {
          articuloId: articuloId || linea.articuloId || null,
          cantidad: linea.cantidad || 0,
          precio: linea.precio || linea.PVP || 0,
          iva: linea.iva || linea.IVA || 21,
          descuento: linea.descuento || linea.DtoLinea || 0
        };
        
        console.log(`🔍 [EDITAR PEDIDO] Línea ${index + 1} preparada:`, lineaValor);
        return lineaValor;
      });
      console.log(`✅ [EDITAR PEDIDO] Líneas preparadas: ${lineasValores.length}`);
    } catch (error) {
      console.error('❌ [EDITAR PEDIDO] Error preparando líneas:', error);
      lineasValores = []; // Continuar con array vacío si hay error
    }

    const formatDateInput = (value) => {
      if (!value) return '';
      try {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
        return value;
      } catch (e) {
        return value;
      }
    };

    // Obtener forma de pago desde Id_FormaPago
    let formaPagoId = pedidoRaw.Id_FormaPago || null;
    let formaPagoNombre = '';
    console.log(`🔍 [EDITAR PEDIDO] Obteniendo forma de pago: Id_FormaPago=${formaPagoId}`);
    if (formaPagoId) {
      try {
        const formaPagoObj = await crm.getFormaPagoById(Number(formaPagoId));
        console.log(`🔍 [EDITAR PEDIDO] Forma de pago obtenida:`, formaPagoObj);
        if (formaPagoObj) {
          formaPagoNombre = formaPagoObj.FormaPago || formaPagoObj.Forma || formaPagoObj.forma || '';
          console.log(`✅ [EDITAR PEDIDO] Forma de pago nombre: "${formaPagoNombre}"`);
        } else {
          console.warn(`⚠️ [EDITAR PEDIDO] Forma de pago no encontrada para ID ${formaPagoId}`);
        }
      } catch (err) {
        console.warn(`⚠️ No se pudo obtener forma de pago ${formaPagoId}:`, err.message);
      }
    } else {
      console.warn(`⚠️ [EDITAR PEDIDO] No hay Id_FormaPago en el pedido`);
    }
    
    // Si no se encontró el nombre, usar el ID como fallback
    if (!formaPagoNombre && formaPagoId) {
      formaPagoNombre = String(formaPagoId);
      console.log(`⚠️ [EDITAR PEDIDO] Usando ID como fallback para forma de pago: "${formaPagoNombre}"`);
    }

    // Obtener tipo de pedido desde Id_TipoPedido
    let tipoPedidoNombre = '';
    console.log(`🔍 [EDITAR PEDIDO] Obteniendo tipo de pedido: Id_TipoPedido=${pedidoRaw.Id_TipoPedido}`);
    if (pedidoRaw.Id_TipoPedido) {
      try {
        const tipoPedidoObj = await crm.query('SELECT Tipo FROM tipos_pedidos WHERE id = ? LIMIT 1', [Number(pedidoRaw.Id_TipoPedido)]);
        console.log(`🔍 [EDITAR PEDIDO] Tipo de pedido obtenido:`, tipoPedidoObj);
        if (tipoPedidoObj && tipoPedidoObj.length > 0) {
          tipoPedidoNombre = tipoPedidoObj[0].Tipo || '';
          console.log(`✅ [EDITAR PEDIDO] Tipo de pedido nombre: "${tipoPedidoNombre}"`);
        } else {
          console.warn(`⚠️ [EDITAR PEDIDO] Tipo de pedido no encontrado para ID ${pedidoRaw.Id_TipoPedido}`);
        }
      } catch (err) {
        console.warn(`⚠️ No se pudo obtener tipo de pedido ${pedidoRaw.Id_TipoPedido}:`, err.message);
      }
    } else {
      console.warn(`⚠️ [EDITAR PEDIDO] No hay Id_TipoPedido en el pedido`);
    }

    // Preparar valores del formulario
    // Asegurar que cliente_id sea un string para la comparación en la vista
    const formValues = {
      cliente_id: String(clienteId || ''),
      comercial_id: comercialId || '',
      fecha_pedido: formatDateInput(pedido.fecha || pedido.fechaPedido || pedidoRaw.FechaPedido),
      fecha_entrega: formatDateInput(pedido.fechaEntrega || pedidoRaw.FechaEntrega),
      tipo_pedido: tipoPedidoNombre || pedido.tipoPedido || '',
      forma_pago: formaPagoNombre || formaPagoId || pedido.formaPago || '', // Enviar el nombre si está disponible, sino el ID
      estado: pedido.estado || pedidoRaw.EstadoPedido || 'Pendiente',
      observaciones: pedido.observaciones || pedidoRaw.Observaciones || '',
      numero_cooperativa: pedido.numero_cooperativa || pedidoRaw.numero_cooperativa || '',
      cooperativa_nombre: pedido.cooperativa_nombre || pedidoRaw.cooperativa_nombre || '',
      numero_pedido: pedido.numero || pedidoRaw.NumPedido || '',
      envio_diferente: (pedidoRaw && (pedidoRaw.Id_DireccionEnvio || pedidoRaw.id_direccionenvio || pedidoRaw.id_direccionEnvio)) ? '1' : '0',
      direccion_envio_id: String(pedidoRaw.Id_DireccionEnvio || pedidoRaw.id_direccionenvio || pedidoRaw.id_direccionEnvio || '')
    };
    
    console.log(`📋 [EDITAR PEDIDO] formValues preparado:`, {
      tipo_pedido: formValues.tipo_pedido,
      forma_pago: formValues.forma_pago,
      tipoPedidoNombre: tipoPedidoNombre,
      formaPagoNombre: formaPagoNombre,
      formaPagoId: formaPagoId
    });
    
    // Obtener número de asociado del cliente si existe relación con cooperativa
    let numeroAsociado = formValues.numero_cooperativa || '';
    if (!numeroAsociado && clienteId) {
      try {
        const relaciones = await crm.getCooperativasByClienteId(Number(clienteId));
        if (relaciones && relaciones.length > 0) {
          // Buscar relación con la cooperativa del tipo de pedido si es Transfer
          const tipoPedidoLower = (tipoPedidoNombre || '').toLowerCase();
          if (tipoPedidoLower.includes('transfer')) {
            // Mapear tipo de pedido a nombre de cooperativa
            const transferMap = {
              'transfer hefame': 'HEFAME',
              'transfer alliance': 'ALLIANCE',
              'transfer cofares': 'COFARES'
            };
            
            let nombreCooperativaBuscado = null;
            for (const [key, nombre] of Object.entries(transferMap)) {
              if (tipoPedidoLower.includes(key.replace('transfer ', ''))) {
                nombreCooperativaBuscado = nombre;
                break;
              }
            }
            
            if (nombreCooperativaBuscado) {
              const relacionEncontrada = relaciones.find(r => {
                const nombreRelacion = (r.Nombre || r.nombre || '').toUpperCase().trim();
                return nombreRelacion === nombreCooperativaBuscado.toUpperCase();
              });
              
              if (relacionEncontrada && relacionEncontrada.NumAsociado) {
                numeroAsociado = relacionEncontrada.NumAsociado;
                formValues.numero_cooperativa = numeroAsociado;
                formValues.cooperativa_nombre = nombreCooperativaBuscado;
                console.log(`✅ [EDITAR PEDIDO] Número de asociado obtenido: ${numeroAsociado} para ${nombreCooperativaBuscado}`);
              }
            }
          }
        }
      } catch (err) {
        console.warn(`⚠️ [EDITAR PEDIDO] Error obteniendo número de asociado:`, err.message);
      }
    }

    // Validar que todos los datos necesarios estén presentes
    if (!pedido || !pedido.id) {
      console.error('❌ [EDITAR PEDIDO] Pedido inválido:', pedido);
      throw new Error('El objeto pedido no es válido');
    }

    console.log(`✅ [EDITAR PEDIDO] Todo listo, renderizando formulario...`);
    console.log(`📋 [EDITAR PEDIDO] formValues:`, JSON.stringify(formValues, null, 2));
    console.log(`📋 [EDITAR PEDIDO] lineasValores count:`, lineasValores.length);
    console.log(`📋 [EDITAR PEDIDO] pedido:`, {
      id: pedido?.id,
      numero: pedido?.numero,
      estado: pedido?.estado
    });
      console.log(`📋 [EDITAR PEDIDO] Datos para render:`, {
        clientesCount: (clientes || []).length,
        articulosCount: (articulos || []).length,
        clientesCooperativaCount: (clientesCooperativa || []).length,
        comercialesCount: (comerciales || []).length,
        formasPagoCount: (formasPago || []).length,
        formasPagoNombres: (formasPago || []).map(f => f.FormaPago || f.formaPago || 'N/A').join(', '),
        tiposPedidoCount: (tiposPedido || []).length,
        tiposPedidoNombres: (tiposPedido || []).map(t => t.Tipo || t.tipo || 'N/A').join(', '),
        formaPagoSeleccionada: formValues.forma_pago || 'N/A',
        formaPagoId: formaPagoId || 'N/A',
        formaPagoNombre: formaPagoNombre || 'N/A',
        tipoPedidoSeleccionado: formValues.tipo_pedido || 'N/A',
        tipoPedidoNombre: tipoPedidoNombre || 'N/A',
        esAdmin: esAdmin
      });
    console.log(`📋 [EDITAR PEDIDO] formValues completo:`, JSON.stringify(formValues, null, 2));
    
    try {
      // Asegurar que todos los valores estén definidos
      // Verificar que formasPago esté disponible antes de renderizar
      if (!Array.isArray(formasPago)) {
        console.warn(`⚠️ [EDITAR PEDIDO] formasPago no es un array, obteniendo de nuevo...`);
        try {
          formasPago = await crm.getFormasPago();
          console.log(`✅ [EDITAR PEDIDO] formasPago obtenido de nuevo: ${formasPago?.length || 0} formas`);
        } catch (err) {
          console.error(`❌ [EDITAR PEDIDO] Error obteniendo formasPago:`, err.message);
          formasPago = [];
        }
      }
      
      const renderData = {
        title: `Editar Pedido #${pedido.numero || pedido.id || 'N/A'}`,
        user: req.comercial || req.session.comercial || null,
        pedido: pedido || { id: pedidoId, numero: '', estado: 'Pendiente' },
        clientes: Array.isArray(clientes) ? clientes : [],
        articulos: Array.isArray(articulos) ? articulos : [],
        clientesCooperativa: Array.isArray(clientesCooperativa) ? clientesCooperativa : [],
        comerciales: Array.isArray(comerciales) ? comerciales : [],
        formasPago: Array.isArray(formasPago) ? formasPago : [],
        esAdmin: Boolean(esAdmin),
        formValues: formValues || {},
        lineasValores: Array.isArray(lineasValores) ? lineasValores : [],
        nuevaReferencia: pedido.numero || pedido.numeroOrden || '',
        error: null
      };
      
      // Verificación final antes de renderizar
      if (!Array.isArray(renderData.formasPago) || renderData.formasPago.length === 0) {
        console.error(`❌ [EDITAR PEDIDO] CRÍTICO: formasPago está vacío o no es un array antes de renderizar!`);
        console.error(`   Tipo: ${typeof renderData.formasPago}, Length: ${renderData.formasPago?.length || 'N/A'}`);
      }
      
      console.log(`📋 [EDITAR PEDIDO] Renderizando vista 'dashboard/pedido-editar'...`);
      console.log(`📋 [EDITAR PEDIDO] Render data keys:`, Object.keys(renderData));
      console.log(`📋 [EDITAR PEDIDO] formasPago en renderData:`, {
        existe: typeof renderData.formasPago !== 'undefined',
        esArray: Array.isArray(renderData.formasPago),
        length: renderData.formasPago?.length || 0,
        primeros3: renderData.formasPago?.slice(0, 3).map(f => f.FormaPago || 'N/A')
      });
      
      // Asegurar que formasPago esté disponible explícitamente
      if (!renderData.formasPago || !Array.isArray(renderData.formasPago) || renderData.formasPago.length === 0) {
        console.error(`❌ [EDITAR PEDIDO] ERROR CRÍTICO: formasPago no está disponible antes de renderizar!`);
        console.error(`   Reintentando obtener formasPago...`);
        try {
          const formasPagoNuevo = await crm.getFormasPago();
          renderData.formasPago = Array.isArray(formasPagoNuevo) ? formasPagoNuevo : [];
          console.log(`✅ [EDITAR PEDIDO] formasPago obtenido de nuevo: ${renderData.formasPago.length} formas`);
        } catch (err) {
          console.error(`❌ [EDITAR PEDIDO] Error crítico obteniendo formasPago:`, err.message);
          renderData.formasPago = [];
        }
      }
      
      // Renderizar con verificación explícita
      console.log(`📋 [EDITAR PEDIDO] Última verificación antes de renderizar:`);
      console.log(`   - formasPago existe: ${typeof renderData.formasPago !== 'undefined'}`);
      console.log(`   - formasPago es array: ${Array.isArray(renderData.formasPago)}`);
      console.log(`   - formasPago length: ${renderData.formasPago?.length || 0}`);
      console.log(`   - tiposPedido existe: ${typeof renderData.tiposPedido !== 'undefined'}`);
      console.log(`   - tiposPedido es array: ${Array.isArray(renderData.tiposPedido)}`);
      console.log(`   - tiposPedido length: ${renderData.tiposPedido?.length || 0}`);
      console.log(`   - formValues.tipo_pedido: ${renderData.formValues?.tipo_pedido || 'N/A'}`);
      console.log(`   - formValues.forma_pago: ${renderData.formValues?.forma_pago || 'N/A'}`);
      
      res.render('dashboard/pedido-editar', renderData);
      console.log(`✅ [EDITAR PEDIDO] Formulario renderizado correctamente`);
    } catch (renderError) {
      console.error('❌ [EDITAR PEDIDO] Error renderizando formulario:', renderError);
      console.error('❌ [EDITAR PEDIDO] Render error message:', renderError.message);
      console.error('❌ [EDITAR PEDIDO] Render error stack:', renderError.stack);
      if (renderError.message) {
        console.error('❌ [EDITAR PEDIDO] Render error details:', {
          name: renderError.name,
          message: renderError.message,
          line: renderError.line,
          column: renderError.column
        });
      }
      throw renderError; // Re-lanzar para que el catch principal lo maneje
    }
  } catch (error) {
    console.error('❌ [EDITAR PEDIDO] Error cargando formulario de edición de pedido:', error);
    console.error('❌ [EDITAR PEDIDO] Error message:', error.message);
    console.error('❌ [EDITAR PEDIDO] Error stack:', error.stack);
    if (error.code) {
      console.error('❌ [EDITAR PEDIDO] Error code:', error.code);
    }
    if (error.sqlState) {
      console.error('❌ [EDITAR PEDIDO] SQL State:', error.sqlState);
    }
    if (error.sqlMessage) {
      console.error('❌ [EDITAR PEDIDO] SQL Message:', error.sqlMessage);
    }
    
    // Intentar cargar datos básicos para mostrar un formulario con error
    try {
      const [clientes, articulos, clientesCooperativa, comerciales, formasPago, tiposPedido] = await Promise.all([
        crm.getClientes().catch(() => []),
        crm.getArticulos().catch(() => []),
        crm.getClientesCooperativa().catch(() => []),
        crm.getComerciales().catch(() => []),
        crm.getFormasPago().catch(() => []),
        crm.query('SELECT id, Tipo FROM tipos_pedidos ORDER BY Tipo ASC').catch(() => [])
      ]);
      
      res.status(500).render('dashboard/pedido-editar', {
        title: `Editar Pedido #${req.params.id}`,
        user: req.comercial || req.session.comercial,
        pedido: { id: req.params.id },
        clientes: clientes || [],
        articulos: articulos || [],
        formasPago: formasPago || [],
        tiposPedido: tiposPedido || [],
        clientesCooperativa: clientesCooperativa || [],
        comerciales: comerciales || [],
        esAdmin: isAdmin(req),
        formValues: {},
        lineasValores: [],
        nuevaReferencia: '',
        error: `Error al cargar el pedido: ${error.message || 'Error desconocido'}`
      });
    } catch (fallbackError) {
      console.error('❌ [EDITAR PEDIDO] Error en fallback:', fallbackError);
      res.status(500).render('error', {
        error: 'Error interno',
        message: `No se pudo cargar el formulario de edición del pedido. Detalles: ${error.message || error}`
      });
    }
  }
});

app.get('/dashboard/pedidos/:id/cerrar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const pedido = await crm.getPedidoById(id);
    if (!pedido) {
      return res.redirect(`/dashboard/pedidos/${id}?error=pedido_no_encontrado`);
    }

    const estadoActual = (pedido.Estado || '').toLowerCase();
    if (estadoActual === 'cerrado') {
      return res.redirect(`/dashboard/pedidos/${id}?error=pedido_cerrado`);
    }

    await crm.updatePedido(id, { 'EstadoPedido': 'Cerrado' });
    
    // NOTA IMPORTANTE: Cuando el pedido se cierra, aquí es donde se debe enviar a NocoDB
    // Si en el futuro se implementa integración con NocoDB, usar esta función:
    // await syncPedidoToNocoDB(id);
    // console.log(`✅ [CERRAR PEDIDO] Pedido ${id} sincronizado con NocoDB (estado: Cerrado)`);
    
    res.redirect(`/dashboard/pedidos/${id}?success=pedido_cerrado`);
  } catch (error) {
    console.error('Error cerrando pedido:', error);
    res.redirect(`/dashboard/pedidos/${req.params.id}?error=pedido_no_cerrado`);
  }
});

app.post('/dashboard/pedidos/:id', requireAuth, async (req, res) => {
  const requestStartTime = Date.now();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📝 [UPDATE PEDIDO] ===== PETICIÓN POST RECIBIDA =====');
  console.log(`📝 [UPDATE PEDIDO] Timestamp: ${new Date().toISOString()}`);
  console.log(`📝 [UPDATE PEDIDO] ID del pedido: ${req.params.id}`);
  console.log(`📝 [UPDATE PEDIDO] Headers:`, {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
    'user-agent': req.headers['user-agent']?.substring(0, 50)
  });
  
  try {
    const id = req.params.id;
    console.log(`📝 [UPDATE PEDIDO] Iniciando actualización del pedido ID: ${id}`);
    console.log(`📝 [UPDATE PEDIDO] Body recibido (primeros 500 chars):`, JSON.stringify(req.body).substring(0, 500));
    console.log(`📝 [UPDATE PEDIDO] Keys en req.body:`, Object.keys(req.body));
    console.log(`📝 [UPDATE PEDIDO] Content-Type:`, req.headers['content-type']);
    
    const {
      cliente_id,
      fecha_pedido,
      fecha_entrega,
      tipo_pedido,
      forma_pago,
      estado,
      observaciones,
      numero_cooperativa,
      cooperativa_nombre,
      numero_pedido
    } = req.body;
    
    console.log(`📝 [UPDATE PEDIDO] Valores extraídos del body:`);
    console.log(`  - cliente_id: ${cliente_id} (tipo: ${typeof cliente_id})`);
    console.log(`  - fecha_pedido: ${fecha_pedido} (tipo: ${typeof fecha_pedido})`);
    console.log(`  - lineas_payload existe: ${!!req.body.lineas_payload}`);

  const transferMap = {
    'transfer hefame': 'HEFAME',
    'transfer alliance': 'ALLIANCE',
    'transfer cofares': 'COFARES'
  };

  const errores = [];
  let lineasPayload = [];
  let descuentoGeneral = 0;

  // Verificar que el pedido existe y no está cerrado
  let pedidoActual = null;
  try {
    pedidoActual = await crm.getPedidoById(id);
    if (!pedidoActual) {
      errores.push('El pedido no existe.');
      return res.redirect(`/dashboard/pedidos/${id}?error=pedido_no_encontrado`);
    }
    if ((pedidoActual.Estado || '').toLowerCase() === 'cerrado') {
      return res.redirect(`/dashboard/pedidos/${id}?error=pedido_cerrado`);
    }
  } catch (error) {
    console.error('Error verificando pedido:', error);
    return res.redirect(`/dashboard/pedidos/${id}?error=error_verificando_pedido`);
  }

  console.log('🔍 [UPDATE PEDIDO] Verificando lineas_payload...');
  console.log('🔍 [UPDATE PEDIDO] req.body.lineas_payload existe?', !!req.body.lineas_payload);
  console.log('🔍 [UPDATE PEDIDO] req.body.lineas_payload tipo:', typeof req.body.lineas_payload);
  console.log('🔍 [UPDATE PEDIDO] req.body.lineas_payload valor (primeros 200 chars):', req.body.lineas_payload ? String(req.body.lineas_payload).substring(0, 200) : 'null/undefined');
  
  if (req.body.lineas_payload) {
    try {
      console.log('🔍 [UPDATE PEDIDO] Intentando parsear JSON...');
      const payloadParsed = JSON.parse(req.body.lineas_payload);
      console.log('🔍 [UPDATE PEDIDO] JSON parseado correctamente. Tipo:', Array.isArray(payloadParsed) ? 'Array' : typeof payloadParsed);
      console.log('🔍 [UPDATE PEDIDO] Contenido parseado:', JSON.stringify(payloadParsed).substring(0, 300));
      
      if (Array.isArray(payloadParsed)) {
        lineasPayload = payloadParsed;
        descuentoGeneral = 0;
        console.log(`✅ [UPDATE PEDIDO] Líneas extraídas de array: ${lineasPayload.length} líneas`);
      } else if (payloadParsed && typeof payloadParsed === 'object') {
        lineasPayload = Array.isArray(payloadParsed.lineas) ? payloadParsed.lineas : [];
        descuentoGeneral = Number(payloadParsed.descuentoGeneral) || 0;
        console.log(`✅ [UPDATE PEDIDO] Líneas extraídas de objeto: ${lineasPayload.length} líneas, descuento: ${descuentoGeneral}`);
      } else {
        console.warn('⚠️ [UPDATE PEDIDO] Payload parseado no es array ni objeto válido');
        lineasPayload = [];
        descuentoGeneral = 0;
      }
    } catch (error) {
      console.error('❌ [UPDATE PEDIDO] Error parseando líneas de pedido:', error.message);
      console.error('❌ [UPDATE PEDIDO] Error stack:', error.stack);
      console.error('❌ [UPDATE PEDIDO] Valor que falló:', req.body.lineas_payload);
      lineasPayload = [];
      descuentoGeneral = 0;
      errores.push('No se pudo interpretar las líneas del pedido.');
    }
  } else {
    console.warn('⚠️ [UPDATE PEDIDO] req.body.lineas_payload no existe o está vacío');
    console.warn('⚠️ [UPDATE PEDIDO] Keys en req.body:', Object.keys(req.body));
  }

  if (!cliente_id) {
    errores.push('Selecciona un cliente.');
  }
  if (!fecha_pedido) {
    errores.push('La fecha de pedido es obligatoria.');
  }
  if (!lineasPayload || !lineasPayload.length) {
    errores.push('Añade al menos una línea al pedido.');
  }

  const normalizarNumero = (valor, opciones = {}) => {
    if (valor === undefined || valor === null || valor === '') return opciones.defaultValue ?? 0;
    const numero = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (Number.isNaN(numero)) return opciones.defaultValue ?? 0;
    const precision = opciones.precision ?? 2;
    return Number(numero.toFixed(precision));
  };

  // Obtener todos los artículos de una vez para optimizar la búsqueda de IVA
  let articulosMap = null;
  try {
    const todosArticulos = await crm.getArticulos();
    articulosMap = new Map();
    todosArticulos.forEach(art => {
      const artId = art.Id || art.id;
      if (artId) {
        articulosMap.set(Number(artId), art);
      }
    });
  } catch (error) {
    console.warn('⚠️ Error cargando artículos para obtener IVA:', error.message);
  }

  const lineasNormalizadas = [];
  if (Array.isArray(lineasPayload)) {
    for (let index = 0; index < lineasPayload.length; index++) {
      const linea = lineasPayload[index];
      const articuloId = linea && (linea.articuloId || linea.articulo || linea.articulo_id);
      const cantidad = normalizarNumero(linea && (linea.cantidad || linea.unidades), { defaultValue: 0, precision: 2 });
      let precio = normalizarNumero(linea && (linea.precio || linea.pvp || linea.valor), { defaultValue: 0, precision: 4 });
      let iva = normalizarNumero(linea && (linea.iva || linea.iva_porcentaje), { defaultValue: 0, precision: 2 });
      const descuentoLinea = normalizarNumero(linea && (linea.descuento || linea.descuento_porcentaje), { defaultValue: 0, precision: 2 });

      if (!articuloId) {
        errores.push(`Selecciona un artículo en la línea ${index + 1}.`);
        continue;
      }
      if (cantidad <= 0) {
        errores.push(`La cantidad debe ser mayor que cero en la línea ${index + 1}.`);
      }
      if (precio < 0) {
        errores.push(`El precio no puede ser negativo en la línea ${index + 1}.`);
      }

      // Si no hay IVA en el formulario, obtenerlo del artículo
      if ((!iva || iva === 0) && articuloId && articulosMap) {
        try {
          const articuloIdNumber = Number(articuloId);
          const articulo = articulosMap.get(articuloIdNumber);
          if (articulo) {
            const ivaDelArticulo = Number(
              articulo.IVA || 
              articulo.iva || 
              articulo['IVA %'] || 
              articulo['Iva %'] || 
              articulo['IVA%'] || 
              articulo['Iva%'] ||
              articulo['% IVA'] ||
              articulo['% Iva'] ||
              0
            ) || 0;
            if (ivaDelArticulo > 0) {
              iva = ivaDelArticulo;
            }
            
            if (!precio || precio === 0) {
              precio = parseMoneyValue(
                articulo.PVL || 
                articulo.pvl || 
                articulo.Precio || 
                articulo.precio || 
                0
              );
            }
          }
        } catch (error) {
          console.warn(`⚠️ Error obteniendo IVA del artículo ${articuloId}:`, error.message);
        }
      }

      // Calcular subtotal sin descuento por línea
      const subtotalSinDescuento = Number((cantidad * precio).toFixed(2));
      
      // Aplicar descuento por línea
      const descuentoLineaValor = Number((subtotalSinDescuento * (descuentoLinea / 100)).toFixed(2));
      const subtotal = Number((subtotalSinDescuento - descuentoLineaValor).toFixed(2));
      
      // Aplicar descuento general después del subtotal
      const descuentoGeneralValor = Number((subtotal * (descuentoGeneral / 100)).toFixed(2));
      const subtotalConDescuentoGeneral = Number((subtotal - descuentoGeneralValor).toFixed(2));
      
      // Calcular impuestos sobre el subtotal con descuentos
      const impuesto = Number((subtotalConDescuentoGeneral * (iva / 100)).toFixed(2));
      const total = Number((subtotalConDescuentoGeneral + impuesto).toFixed(2));

      lineasNormalizadas.push({
        articuloId,
        cantidad,
        precio,
        iva,
        descuentoLinea,
        subtotal,
        descuentoGeneral,
        subtotalConDescuentoGeneral,
        impuesto,
        total
      });
    }
  }

  if (errores.length) {
    try {
      const detalle = await obtenerPedidoDetallado(id);
      const { pedido: pedidoData, lineas: lineasExistentes } = detalle || { pedido: null, lineas: [] };
      
      if (!pedidoData) {
        return res.redirect(`/dashboard/pedidos/${id}?error=pedido_no_encontrado`);
      }

      const [clientes, articulos, clientesCooperativa, comerciales] = await Promise.all([
        crm.getClientes(),
        crm.getArticulos(),
        crm.getClientesCooperativa(),
        crm.getComerciales()
      ]);

      // Preparar líneas para el formulario
      const lineasValores = lineasExistentes.map(linea => {
        const articuloIdRaw = linea.articuloId;
        const articuloId = Array.isArray(articuloIdRaw)
          ? (articuloIdRaw[0]?.Id || articuloIdRaw[0]?.id || articuloIdRaw[0])
          : (typeof articuloIdRaw === 'object' ? (articuloIdRaw?.Id || articuloIdRaw?.id) : articuloIdRaw);

        return {
          articuloId: articuloId,
          cantidad: linea.cantidad || 0,
          precio: linea.precio || 0,
          iva: linea.iva || 21,
          descuento: linea.descuento || 0
        };
      });

      const clienteIdRaw = pedidoData.clienteId || pedidoData.Cliente_id;
      const clienteId = Array.isArray(clienteIdRaw)
        ? (clienteIdRaw[0]?.Id || clienteIdRaw[0]?.id || clienteIdRaw[0])
        : (typeof clienteIdRaw === 'object' ? (clienteIdRaw?.Id || clienteIdRaw?.id) : clienteIdRaw);

      const formatDateInput = (value) => {
        if (!value) return '';
        try {
          const date = new Date(value);
          if (!Number.isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
          return value;
        } catch (e) {
          return value;
        }
      };

      // Extraer ID del comercial del pedido actual
      const comercialIdRaw = pedidoData.comercialId || pedidoData.Comercial_id;
      const comercialIdActual = Array.isArray(comercialIdRaw)
        ? (comercialIdRaw[0]?.Id || comercialIdRaw[0]?.id || comercialIdRaw[0])
        : (typeof comercialIdRaw === 'object' ? (comercialIdRaw?.Id || comercialIdRaw?.id) : comercialIdRaw);

      const formValues = {
        cliente_id: cliente_id || clienteId || '',
        comercial_id: req.body.comercial_id || comercialIdActual || '',
        fecha_pedido: fecha_pedido || formatDateInput(pedidoData.fecha || pedidoData.fechaPedido),
        fecha_entrega: fecha_entrega || formatDateInput(pedidoData.fechaEntrega),
        tipo_pedido: tipo_pedido || pedidoData.tipoPedido || '',
        forma_pago: forma_pago || pedidoData.formaPago || '',
        estado: estado || pedidoData.estado || 'Pendiente',
        observaciones: observaciones || pedidoData.observaciones || '',
        numero_cooperativa: numero_cooperativa || '',
        cooperativa_nombre: cooperativa_nombre || '',
        numero_pedido: numero_pedido || pedidoData.numero || ''
      };

      const esAdmin = isAdmin(req);

      // Si la petición viene de fetch() (AJAX), devolver JSON en lugar de renderizar HTML
      const isAjaxRequest = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                           req.headers.accept?.includes('application/json');
      
      if (isAjaxRequest) {
        console.log('📤 [UPDATE PEDIDO] Devolviendo respuesta JSON por petición AJAX');
        return res.status(400).json({
          success: false,
          error: errores.join(' '),
          errores: errores
        });
      }
      
      return res.status(400).render('dashboard/pedido-editar', {
        title: `Editar Pedido #${pedidoData.numero || id}`,
        user: req.comercial || req.session.comercial,
        pedido: pedidoData,
        clientes: clientes || [],
        articulos: articulos || [],
        clientesCooperativa: clientesCooperativa || [],
        comerciales: comerciales || [],
        esAdmin: esAdmin,
        error: errores.join(' '),
        formValues,
        lineasValores: lineasPayload.length ? lineasPayload.map(l => ({
          articuloId: l.articuloId,
          cantidad: l.cantidad,
          precio: l.precio,
          iva: l.iva,
          descuento: l.descuento || 0
        })) : lineasValores,
        nuevaReferencia: pedidoData.numero || ''
      });
    } catch (innerError) {
      console.error('Error recargando formulario tras validación:', innerError.message);
      return res.status(500).render('error', {
        error: 'Error interno',
        message: 'No se pudo validar la información del pedido. Inténtalo de nuevo más tarde.'
      });
    }
  }

  // Si no hay errores, proceder con la actualización
    // Calcular totales considerando descuentos
    // IMPORTANTE: Si no hay líneas, todos los totales deben ser 0
    let subtotalPedido = 0;
    let impuestoPedido = 0;
    let totalPedido = 0;
    let totalDescuentos = 0;
    let baseImponible = 0;
    let importeIva = 0;
    
    if (lineasNormalizadas && lineasNormalizadas.length > 0) {
      // Calcular subtotal del pedido (después de descuentos por línea y descuento general)
      subtotalPedido = lineasNormalizadas.reduce((sum, linea) => sum + (linea.subtotalConDescuentoGeneral || linea.subtotal || 0), 0);
      
      // Calcular impuestos totales
      impuestoPedido = lineasNormalizadas.reduce((sum, linea) => sum + (linea.impuesto || 0), 0);
      
      // Calcular descuentos totales
      // Sumar descuentos por línea
      const descuentosPorLinea = lineasNormalizadas.reduce((sum, linea) => {
        const subtotalSinDescuento = (linea.cantidad || 0) * (linea.precio || 0);
        const descuentoLineaValor = subtotalSinDescuento * ((linea.descuentoLinea || 0) / 100);
        return sum + descuentoLineaValor;
      }, 0);
      
      // Calcular descuento general sobre el subtotal después de descuentos por línea
      const subtotalDespuesDescuentosLinea = lineasNormalizadas.reduce((sum, linea) => {
        const subtotalSinDescuento = (linea.cantidad || 0) * (linea.precio || 0);
        const descuentoLineaValor = subtotalSinDescuento * ((linea.descuentoLinea || 0) / 100);
        const subtotal = subtotalSinDescuento - descuentoLineaValor;
        return sum + subtotal;
      }, 0);
      
      const descuentoGeneralValor = subtotalDespuesDescuentosLinea * (descuentoGeneral / 100);
      totalDescuentos = Number((descuentosPorLinea + descuentoGeneralValor).toFixed(2));

      // Base imponible es el subtotal después de todos los descuentos
      baseImponible = Number(subtotalPedido.toFixed(2));
      
      // Importe IVA es el total de impuestos
      importeIva = Number(impuestoPedido.toFixed(2));
      
      // Total del pedido es base imponible + IVA
      totalPedido = Number((baseImponible + importeIva).toFixed(2));
    } else {
      // Si no hay líneas, todos los totales son 0
      console.log('⚠️ [UPDATE PEDIDO] No hay líneas, estableciendo todos los totales a 0');
      subtotalPedido = 0;
      impuestoPedido = 0;
      totalPedido = 0;
      totalDescuentos = 0;
      baseImponible = 0;
      importeIva = 0;
    }
    
    console.log(`💰 [UPDATE PEDIDO] Totales calculados: TotalPedido=${totalPedido}, BaseImponible=${baseImponible}, TotalIva=${importeIva}, TotalDescuento=${totalDescuentos}, Líneas=${lineasNormalizadas?.length || 0}`);

    // Obtener número de pedido actual si no se proporciona uno nuevo
    const numeroPedidoFinal = numero_pedido && numero_pedido.trim() 
      ? numero_pedido.trim() 
      : (pedidoActual?.NumPedido || pedidoActual?.['Número_Pedido'] || pedidoActual?.['Número Pedido'] || null);

    // Actualizar cabecera del pedido
    const pedidoPayload = {};
    
    // Solo incluir campos que tienen valor o que queremos actualizar explícitamente
    // Usar los nombres correctos de las columnas de la base de datos
    if (numeroPedidoFinal) {
      pedidoPayload['NumPedido'] = numeroPedidoFinal;
    }
    if (fecha_pedido) {
      pedidoPayload['FechaPedido'] = fecha_pedido;
    }
    if (fecha_entrega !== undefined) {
      pedidoPayload['FechaEntrega'] = fecha_entrega || null;
    }

    // Dirección de envío (opcional)
    const envioDiferente = String(req.body.envio_diferente || '0') === '1';
    const direccionEnvioId = Number(req.body.direccion_envio_id || 0);
    if (envioDiferente && Number.isFinite(direccionEnvioId) && direccionEnvioId > 0) {
      pedidoPayload['Id_DireccionEnvio'] = direccionEnvioId;
    } else if (!envioDiferente) {
      // Si el usuario marca "igual que fiscal", limpiar FK
      pedidoPayload['Id_DireccionEnvio'] = null;
    }
    if (estado) {
      pedidoPayload['EstadoPedido'] = estado || 'Pendiente';
    }
    // Buscar el ID de la forma de pago por nombre si viene como string
    if (forma_pago !== undefined && forma_pago !== null && forma_pago !== '') {
      let formaPagoId = null;
      
      // Si es un número, usarlo directamente
      const formaPagoNumber = Number(forma_pago);
      if (!Number.isNaN(formaPagoNumber) && formaPagoNumber > 0) {
        formaPagoId = formaPagoNumber;
      } else if (typeof forma_pago === 'string') {
        // Si es un string, buscar el ID en la tabla formas_pago
        try {
          const formaPagoObj = await crm.getFormaPagoByNombre(forma_pago);
          if (formaPagoObj) {
            formaPagoId = formaPagoObj.id || formaPagoObj.Id;
            console.log(`✅ [UPDATE PEDIDO] Forma de pago "${forma_pago}" encontrada con ID: ${formaPagoId}`);
          } else {
            console.warn(`⚠️ [UPDATE PEDIDO] No se encontró forma de pago con nombre "${forma_pago}"`);
          }
        } catch (error) {
          console.warn(`⚠️ [UPDATE PEDIDO] Error buscando forma de pago "${forma_pago}":`, error.message);
        }
      }
      
      if (formaPagoId) {
        pedidoPayload['Id_FormaPago'] = formaPagoId;
      }
    }
    // Obtener ID del tipo de pedido por nombre si viene como string
    if (tipo_pedido !== undefined && tipo_pedido) {
      let tipoPedidoId = null;
      
      // Si es un número, usarlo directamente
      const tipoPedidoNumber = Number(tipo_pedido);
      if (!Number.isNaN(tipoPedidoNumber) && tipoPedidoNumber > 0) {
        tipoPedidoId = tipoPedidoNumber;
      } else if (typeof tipo_pedido === 'string') {
        // Si es un string, buscar el ID en la tabla tipos_pedidos
        try {
          const tipoPedidoObj = await crm.query('SELECT id FROM tipos_pedidos WHERE Tipo = ? LIMIT 1', [tipo_pedido]);
          if (tipoPedidoObj && tipoPedidoObj.length > 0) {
            tipoPedidoId = tipoPedidoObj[0].id;
            console.log(`✅ [UPDATE PEDIDO] Tipo de pedido "${tipo_pedido}" encontrado con ID: ${tipoPedidoId}`);
          } else {
            console.warn(`⚠️ [UPDATE PEDIDO] No se encontró tipo de pedido con nombre "${tipo_pedido}"`);
          }
        } catch (error) {
          console.warn(`⚠️ [UPDATE PEDIDO] Error buscando tipo de pedido "${tipo_pedido}":`, error.message);
        }
      }
      
      if (tipoPedidoId) {
        pedidoPayload['Id_TipoPedido'] = tipoPedidoId;
      }
    }
    // Guardar observaciones si se proporcionan
    if (observaciones !== undefined) {
      pedidoPayload['Observaciones'] = observaciones || null;
    }
    pedidoPayload['TotalPedido'] = totalPedido;
    pedidoPayload['BaseImponible'] = baseImponible;
    pedidoPayload['TotalDescuento'] = totalDescuentos;
    pedidoPayload['TotalIva'] = importeIva;

    // Actualizar cliente siempre (es obligatorio) - usar el nombre correcto de la columna
    const clienteIdNumber = Number(cliente_id);
    if (!Number.isNaN(clienteIdNumber) && clienteIdNumber > 0) {
      pedidoPayload['Id_Cliente'] = clienteIdNumber;
    } else {
      console.warn('⚠️ [UPDATE PEDIDO] Cliente ID no válido:', cliente_id);
    }

    // Actualizar comercial si es admin y se proporciona uno - usar el nombre correcto de la columna
    const esAdmin = isAdmin(req);
    if (esAdmin && req.body.comercial_id) {
      const comercialIdNumber = Number(req.body.comercial_id);
      if (!Number.isNaN(comercialIdNumber) && comercialIdNumber > 0) {
        pedidoPayload['Id_Cial'] = comercialIdNumber;
      }
    }

    // La forma de pago ya se procesó arriba y se guardó como Id_FormaPago
    // Eliminar Forma_Pago si existe (es un campo antiguo de NocoDB)
    if (pedidoPayload.Forma_Pago) {
      delete pedidoPayload.Forma_Pago;
    }

    console.log('🔄 [UPDATE PEDIDO] Actualizando pedido con payload:', JSON.stringify(pedidoPayload, null, 2));
    console.log('🔄 [UPDATE PEDIDO] ID del pedido:', id);
    console.log('🔄 [UPDATE PEDIDO] Campos en payload:', Object.keys(pedidoPayload));
    
    const updateStartTime = Date.now();
    try {
      console.log('⏱️ [UPDATE PEDIDO] Iniciando updatePedido...');
      const resultado = await crm.updatePedido(id, pedidoPayload);
      const updateDuration = Date.now() - updateStartTime;
      console.log(`✅ [UPDATE PEDIDO] Pedido actualizado correctamente en ${updateDuration}ms. Resultado:`, resultado);
    } catch (updateError) {
      const updateDuration = Date.now() - updateStartTime;
      console.error(`❌ [UPDATE PEDIDO] Error al actualizar después de ${updateDuration}ms:`, updateError.message);
      console.error('❌ [UPDATE PEDIDO] Stack:', updateError.stack);
      throw updateError;
    }

    // Obtener número de pedido para eliminar líneas
    const pedidoNumeroParaEliminar = numeroPedidoFinal || pedidoActual?.NumPedido || null;
    console.log(`🔄 [UPDATE PEDIDO] Eliminando líneas existentes con NumPedido: ${pedidoNumeroParaEliminar}`);

    // Eliminar todas las líneas existentes usando Id_NumPedido (clave foránea - más eficiente y seguro)
    // También eliminar por NumPedido como respaldo
    try {
      // Estrategia 1: Eliminar por Id_NumPedido (FK directa - más eficiente)
      const deleteResult1 = await crm.query('DELETE FROM pedidos_articulos WHERE Id_NumPedido = ?', [id]);
      console.log(`✅ [UPDATE PEDIDO] Líneas eliminadas por Id_NumPedido (${id}): ${deleteResult1.affectedRows || 0}`);
      
      // Estrategia 2: Eliminar también por NumPedido como respaldo (por si hay líneas huérfanas)
      if (pedidoNumeroParaEliminar) {
        const deleteResult2 = await crm.query('DELETE FROM pedidos_articulos WHERE NumPedido = ? AND Id_NumPedido IS NULL', [pedidoNumeroParaEliminar]);
        if (deleteResult2.affectedRows > 0) {
          console.log(`✅ [UPDATE PEDIDO] Líneas huérfanas eliminadas por NumPedido: ${deleteResult2.affectedRows}`);
        }
      }
    } catch (deleteError) {
      console.warn(`⚠️ [UPDATE PEDIDO] Error eliminando líneas:`, deleteError.message);
      // Fallback: intentar eliminar por ID individual si falla el DELETE masivo
      try {
        const detalle = await obtenerPedidoDetallado(id);
        const lineasExistentes = detalle?.lineas || [];
        for (const lineaExistente of lineasExistentes) {
          const lineaId = lineaExistente.id;
          if (lineaId) {
            await crm.deletePedidoLinea(lineaId);
          }
        }
      } catch (fallbackError) {
        console.error(`❌ [UPDATE PEDIDO] Error en fallback de eliminación:`, fallbackError.message);
      }
    }

    // Crear nuevas líneas usando INSERT masivo (mucho más rápido)
    const pedidoNumero = numeroPedidoFinal || pedidoActual?.NumPedido || null;
    console.log(`🔄 [UPDATE PEDIDO] Creando ${lineasNormalizadas.length} nuevas líneas con NumPedido: ${pedidoNumero}`);
    
    const insertStartTime = Date.now();
    if (lineasNormalizadas.length > 0 && pedidoNumero) {
      try {
        // Cargar artículos para obtener nombres (necesario para el campo 'Articulo' que es NOT NULL)
        console.log('⏱️ [UPDATE PEDIDO] Cargando artículos para obtener nombres...');
        const todosArticulos = await crm.getArticulos();
        const articulosMap = new Map();
        todosArticulos.forEach(art => {
          const artId = art.Id || art.id;
          if (artId) {
            articulosMap.set(Number(artId), art);
          }
        });
        console.log(`✅ [UPDATE PEDIDO] ${articulosMap.size} artículos cargados para mapeo`);
        
        // Preparar datos para INSERT masivo
        const values = [];
        const placeholders = [];
        
        console.log('⏱️ [UPDATE PEDIDO] Preparando datos para INSERT masivo...');
        for (const linea of lineasNormalizadas) {
          const articuloIdNumber = Number(linea.articuloId);
          if (Number.isNaN(articuloIdNumber) || articuloIdNumber <= 0) {
            console.warn(`⚠️ [UPDATE PEDIDO] Saltando línea con artículo ID inválido: ${linea.articuloId}`);
            continue;
          }
          
          // Obtener nombre del artículo
          const articulo = articulosMap.get(articuloIdNumber);
          const articuloNombre = articulo ? (articulo.Nombre || articulo.nombre || 'Artículo desconocido') : 'Artículo desconocido';
          
          if (!articulo) {
            console.warn(`⚠️ [UPDATE PEDIDO] Artículo con ID ${articuloIdNumber} no encontrado, usando nombre por defecto`);
          }
          
          values.push(
            id,                              // Id_NumPedido (FK a pedidos.id - más eficiente)
            pedidoNumero,                    // NumPedido (texto del número de pedido)
            articuloIdNumber,                // Id_Articulo
            articuloNombre,                  // Articulo (nombre del artículo - REQUERIDO)
            linea.cantidad,                  // Cantidad
            linea.precio || 0,              // PVP
            linea.iva || 0,                  // IVA
            linea.descuentoLinea || 0,       // DtoLinea
            linea.subtotalConDescuentoGeneral || linea.subtotal || 0  // Subtotal
            // Nota: La tabla pedidos_articulos NO tiene columna Total, solo Subtotal
          );
          placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?)');
        }
        
        if (values.length > 0) {
          const sql = `INSERT INTO pedidos_articulos (Id_NumPedido, NumPedido, Id_Articulo, Articulo, Cantidad, PVP, IVA, DtoLinea, Subtotal) VALUES ${placeholders.join(', ')}`;
          console.log(`⏱️ [UPDATE PEDIDO] Ejecutando INSERT masivo con ${placeholders.length} líneas...`);
          console.log(`⏱️ [UPDATE PEDIDO] SQL (primeros 200 chars): ${sql.substring(0, 200)}...`);
          console.log(`⏱️ [UPDATE PEDIDO] Valores count: ${values.length}`);
          
          // Agregar timeout para evitar bloqueos indefinidos
          const insertPromise = crm.pool.execute(sql, values);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout: INSERT masivo tardó más de 30 segundos')), 30000);
          });
          
          const [result] = await Promise.race([insertPromise, timeoutPromise]);
          const insertDuration = Date.now() - insertStartTime;
          console.log(`✅ [UPDATE PEDIDO] ${result.affectedRows} líneas creadas correctamente con INSERT masivo en ${insertDuration}ms`);
        } else {
          console.warn(`⚠️ [UPDATE PEDIDO] No hay líneas válidas para crear`);
        }
      } catch (batchError) {
        const insertDuration = Date.now() - insertStartTime;
        console.error(`❌ [UPDATE PEDIDO] Error en INSERT masivo después de ${insertDuration}ms:`, batchError.message);
        console.error(`❌ [UPDATE PEDIDO] Error stack:`, batchError.stack);
        if (batchError.code) {
          console.error(`❌ [UPDATE PEDIDO] Error code:`, batchError.code);
        }
        if (batchError.sqlState) {
          console.error(`❌ [UPDATE PEDIDO] SQL State:`, batchError.sqlState);
        }
        if (batchError.sqlMessage) {
          console.error(`❌ [UPDATE PEDIDO] SQL Message:`, batchError.sqlMessage);
        }
        console.log(`🔄 [UPDATE PEDIDO] Intentando crear líneas una por una como fallback...`);
        // Fallback: crear una por una si el batch falla
        const lineasIds = [];
        for (let i = 0; i < lineasNormalizadas.length; i += 1) {
          const linea = lineasNormalizadas[i];
          const articuloIdNumber = Number(linea.articuloId);
          
          // Obtener nombre del artículo para el campo 'Articulo' (REQUERIDO)
          let articuloNombre = 'Artículo desconocido';
          try {
            const articulo = await crm.getArticuloById(articuloIdNumber);
            if (articulo) {
              articuloNombre = articulo.Nombre || articulo.nombre || 'Artículo desconocido';
            }
          } catch (artError) {
            console.warn(`⚠️ [UPDATE PEDIDO] Error obteniendo nombre del artículo ${articuloIdNumber}:`, artError.message);
          }
          
          const lineaPayload = {
            'Id_NumPedido': id,              // FK a pedidos.id (clave foránea directa)
            'NumPedido': pedidoNumero,       // Número de pedido como texto
            'Id_Articulo': articuloIdNumber, // FK a articulos.id
            'Articulo': articuloNombre,      // Nombre del artículo (REQUERIDO - NOT NULL)
            'Cantidad': linea.cantidad,
            'PVP': linea.precio || 0,
            'IVA': linea.iva || 0,
            'DtoLinea': linea.descuentoLinea || 0,
            'Subtotal': linea.subtotalConDescuentoGeneral || linea.subtotal || 0
            // Nota: La tabla pedidos_articulos NO tiene columna Total, solo Subtotal
          };

          try {
            const lineaCreada = await crm.createPedidoLinea(lineaPayload);
            const lineaId = lineaCreada && (lineaCreada.Id || lineaCreada.id);
            if (lineaId) {
              lineasIds.push(lineaId);
            }
          } catch (error) {
            console.error(`❌ [UPDATE PEDIDO] Error creando línea ${i + 1}:`, error.message);
          }
        }
        console.log(`✅ [UPDATE PEDIDO] ${lineasIds.length} líneas creadas en modo fallback`);
      }
    } else {
      console.warn(`⚠️ [UPDATE PEDIDO] No se puede crear líneas: pedidoNumero=${pedidoNumero}, lineasCount=${lineasNormalizadas.length}`);
    }

    // No necesitamos linkPedidoLineas si usamos NumPedido en las líneas
    // if (lineasIds.length) {
    //   await crm.linkPedidoLineas(id, lineasIds);
    // }

    // Actualizar cooperativa si aplica
    if (tipo_pedido && tipo_pedido.toLowerCase().includes('transfer')) {
      const clave = tipo_pedido.toLowerCase();
      const nombreCooperativa = cooperativa_nombre || transferMap[clave] || transferMap[clave.trim()];
      if (nombreCooperativa && cliente_id) {
        await crm.upsertClienteCooperativa({
          clienteId: Number(cliente_id),
          cooperativaNombre: nombreCooperativa,
          numeroAsociado: numero_cooperativa
        });
      }
    }

    // Si la petición viene de fetch() (AJAX), devolver JSON en lugar de redirect
    const isAjaxRequest = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                         req.headers.accept?.includes('application/json');
    
    if (isAjaxRequest) {
      console.log('📤 [UPDATE PEDIDO] Devolviendo respuesta JSON por petición AJAX');
      return res.json({
        success: true,
        message: 'Pedido actualizado correctamente',
        redirect: `/dashboard/pedidos/${id}?success=pedido_actualizado`
      });
    }

    // Recalcular comisiones automáticamente (en segundo plano, no bloquea la respuesta)
    recalcularComisionesPedido(id).catch(err => {
      console.error(`❌ [UPDATE PEDIDO] Error recalculando comisiones (no crítico):`, err.message);
    });
    
    return res.redirect(`/dashboard/pedidos/${id}?success=pedido_actualizado`);
  } catch (error) {
    const pedidoId = req.params.id; // Obtener id del parámetro de la ruta para usar en el catch
    console.error('❌ Error actualizando pedido:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Datos del pedido que fallaron:', {
      id: pedidoId,
      cliente_id,
      fecha_pedido,
      lineasCount: lineasNormalizadas.length,
      lineasPayload: lineasPayload.length
    });

    // Construir mensaje de error más descriptivo
    let mensajeError = 'No se pudo actualizar el pedido. ';
    if (error.message) {
      mensajeError += `Error: ${error.message}. `;
    }
    mensajeError += 'Por favor, verifica los datos e inténtalo de nuevo. Los datos del formulario se han preservado.';

    try {
      const detalle = await obtenerPedidoDetallado(pedidoId);
      const { pedido: pedidoData, lineas: lineasExistentes } = detalle || { pedido: null, lineas: [] };
      
      if (!pedidoData) {
        return res.redirect(`/dashboard/pedidos/${pedidoId}?error=pedido_no_encontrado`);
      }

      const [clientes, articulos, clientesCooperativa] = await Promise.all([
        crm.getClientes(),
        crm.getArticulos(),
        crm.getClientesCooperativa()
      ]);

      // Preparar líneas para el formulario
      const lineasValores = lineasExistentes.map(linea => {
        const articuloIdRaw = linea.articuloId;
        const articuloId = Array.isArray(articuloIdRaw)
          ? (articuloIdRaw[0]?.Id || articuloIdRaw[0]?.id || articuloIdRaw[0])
          : (typeof articuloIdRaw === 'object' ? (articuloIdRaw?.Id || articuloIdRaw?.id) : articuloIdRaw);

        return {
          articuloId: articuloId,
          cantidad: linea.cantidad || 0,
          precio: linea.precio || 0,
          iva: linea.iva || 21,
          descuento: 0
        };
      });

      const clienteIdRaw = pedidoData.clienteId || pedidoData.Cliente_id;
      const clienteId = Array.isArray(clienteIdRaw)
        ? (clienteIdRaw[0]?.Id || clienteIdRaw[0]?.id || clienteIdRaw[0])
        : (typeof clienteIdRaw === 'object' ? (clienteIdRaw?.Id || clienteIdRaw?.id) : clienteIdRaw);

      const formatDateInput = (value) => {
        if (!value) return '';
        try {
          const date = new Date(value);
          if (!Number.isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
          return value;
        } catch (e) {
          return value;
        }
      };

      const formValues = {
        cliente_id: cliente_id || clienteId || '',
        fecha_pedido: fecha_pedido || formatDateInput(pedidoData.fecha || pedidoData.fechaPedido),
        fecha_entrega: fecha_entrega || formatDateInput(pedidoData.fechaEntrega),
        tipo_pedido: tipo_pedido || pedidoData.tipoPedido || '',
        forma_pago: forma_pago || pedidoData.formaPago || '',
        estado: estado || pedidoData.estado || 'Pendiente',
        observaciones: observaciones || pedidoData.observaciones || '',
        numero_cooperativa: numero_cooperativa || '',
        cooperativa_nombre: cooperativa_nombre || '',
        numero_pedido: numero_pedido || pedidoData.numero || ''
      };

      return res.status(500).render('dashboard/pedido-editar', {
        title: `Editar Pedido #${pedidoData.numero || pedidoId}`,
        user: req.comercial || req.session.comercial,
        pedido: pedidoData,
        clientes: clientes || [],
        articulos: articulos || [],
        clientesCooperativa: clientesCooperativa || [],
        error: mensajeError,
        formValues,
        lineasValores: lineasPayload.length ? lineasPayload.map(l => ({
          articuloId: l.articuloId,
          cantidad: l.cantidad,
          precio: l.precio,
          iva: l.iva,
          descuento: l.descuento || 0
        })) : lineasValores,
        nuevaReferencia: pedidoData.numero || ''
      });
    } catch (innerError) {
      console.error('❌ Error recargando formulario tras fallo de actualización:', innerError.message);
      return res.redirect(`/dashboard/pedidos/${pedidoId}?error=error_critico_actualizacion`);
    }
  }
});

app.post('/api/pedidos/:id/estado', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const estado = req.body.estado || req.query.estado || 'Enviado';
    const pedido = await crm.getPedidoById(id);
    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }
    const estadoActual = (pedido.EstadoPedido || pedido.Estado || pedido.estado_pedido || pedido.estado || '').toLowerCase();
    if (estadoActual === 'cerrado') {
      if (req.accepts('json') && !req.body.__fromDashboard) {
        return res.status(400).json({ success: false, error: 'Pedido cerrado. No se puede modificar.' });
      }
      return res.redirect(`/dashboard/pedidos/${id}?error=pedido_cerrado`);
    }

    await crm.updatePedido(id, { 'EstadoPedido': estado });

    // Trigger de comisiones: solo cuando pasa de Pendiente -> Tramitado
    const nuevoEstado = String(estado || '').toLowerCase();
    const eraPendiente = estadoActual.includes('pend');
    const pasaATramitado = nuevoEstado.includes('tramit');
    if (eraPendiente && pasaATramitado) {
      recalcularComisionesPedido(id).catch(err => {
        console.error(`❌ [PEDIDO ESTADO] Error recalculando comisiones (no crítico):`, err.message);
      });
    }

    if (req.accepts('json') && !req.body.__fromDashboard) {
      return res.json({ success: true, data: { id, estado } });
    }
    res.redirect(`/dashboard/pedidos/${id}?success=estado_actualizado`);
  } catch (error) {
    console.error('Error cambiando estado de pedido:', error);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.redirect(`/dashboard/pedidos/${req.params.id}?error=estado_no_actualizado`);
  }
});

/**
 * =====================================================
 * RECÁLCULO ADMIN DE COMISIONES (desde pedido / por comercial)
 * =====================================================
 */

// Recalcular comisiones del mes del pedido (solo admin)
// Nota: se permite independientemente del estado del pedido, EXCEPTO si la comisión del mes está pagada.
app.post('/dashboard/pedidos/:id/recalcular-comisiones', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pedidoId = Number(req.params.id);
    if (!Number.isFinite(pedidoId) || pedidoId <= 0) {
      throw new Error('ID de pedido inválido');
    }

    const pedido = await crm.getPedidoById(pedidoId);
    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }

    const comercialIdRaw =
      pedido.Id_Cial ??
      pedido.id_cial ??
      pedido.Comercial_id ??
      pedido.comercial_id ??
      pedido.ComercialId ??
      pedido.comercialId ??
      null;
    const comercialId = comercialIdRaw ? Number(comercialIdRaw) : null;
    if (!Number.isFinite(comercialId) || comercialId <= 0) {
      throw new Error('El pedido no tiene comercial asignado (Id_Cial)');
    }

    const fechaPedido = pedido.FechaPedido || pedido.fecha_pedido || pedido['Fecha Pedido'] || pedido.fecha || null;
    if (!fechaPedido) {
      throw new Error('El pedido no tiene fecha (FechaPedido)');
    }
    const d = new Date(fechaPedido);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`FechaPedido inválida: ${fechaPedido}`);
    }
    const mes = d.getMonth() + 1;
    const año = d.getFullYear();

    // Confirmación explícita desde el front (no se toca el estado del pedido)
    const confirmRecalc =
      String(req.body?.confirm_recalculo || req.query?.confirm_recalculo || 'false') === 'true' ||
      // compatibilidad con versiones anteriores del botón
      String(req.body?.confirm_change_to_pendiente || req.query?.confirm_change_to_pendiente || 'false') === 'true';
    if (!confirmRecalc) {
      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(400).json({
          success: false,
          error: 'Confirmación requerida para recalcular comisiones desde este pedido.'
        });
      }
      return res.redirect(`/dashboard/pedidos/${pedidoId}?error=confirmacion_requerida_recalculo`);
    }

    // Bloqueo: si la comisión mensual ya está pagada, NO permitir recálculo.
    try {
      const comisionesCRM = require('./config/mysql-crm-comisiones');
      const rows = await comisionesCRM.query(
        'SELECT id, estado FROM comisiones WHERE comercial_id = ? AND mes = ? AND año = ? LIMIT 1',
        [comercialId, mes, año]
      );
      const estadoComision = String(rows?.[0]?.estado || '').toLowerCase();
      if (estadoComision.includes('pagad')) {
        const msg = `La comisión del ${String(mes).padStart(2, '0')}/${año} para el comercial ${comercialId} está marcada como PAGADA. No se permite recalcular.`;
        if (req.accepts('json') && !req.accepts('html')) {
          return res.status(409).json({ success: false, error: msg });
        }
        return res.redirect(`/dashboard/pedidos/${pedidoId}?error=comision_pagada_no_recalcular`);
      }
    } catch (e) {
      // Si falla el check, no bloqueamos el recálculo (pero lo logeamos)
      console.warn('⚠️ [RECALC PEDIDO] No se pudo verificar estado pagado (no crítico):', e.message);
    }

    // Ejecutar recalculo mensual (misma lógica que scripts internos, pero sin spawn)
    const calculadoPor = req.comercialId || req.session?.comercialId || null;
    await calculadorComisiones.calcularComisionMensual(comercialId, mes, año, calculadoPor);

    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({
        success: true,
        data: { pedidoId, comercialId, mes, año }
      });
    }
    return res.redirect(`/dashboard/pedidos/${pedidoId}?success=recalculo_comisiones_ok`);
  } catch (error) {
    console.error('❌ Error recalculando comisiones desde pedido:', error);
    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.redirect(`/dashboard/pedidos/${req.params.id}?error=recalculo_comisiones_error&detalle=${encodeURIComponent(error.message)}`);
  }
});

app.post('/dashboard/pedidos/:id/eliminar', requireAuth, async (req, res) => {
  try {
    const pedido = await crm.getPedidoById(req.params.id);
    if (!pedido) {
      return res.redirect(`/dashboard/pedidos/${req.params.id}?error=pedido_no_encontrado`);
    }
    const estadoActual = (pedido.Estado || '').toLowerCase();
    if (estadoActual === 'cerrado') {
      return res.redirect(`/dashboard/pedidos/${req.params.id}?error=pedido_cerrado`);
    }

    await crm.deletePedido(req.params.id);
    res.redirect('/dashboard/pedidos?success=pedido_eliminado');
  } catch (error) {
    console.error('Error eliminando pedido:', error);
    res.redirect(`/dashboard/pedidos/${req.params.id}?error=pedido_no_eliminado`);
  }
});
 
app.post('/dashboard/pedidos/:id/lineas', requireAuth, async (req, res) => {
  try {
    const pedidoId = Number(req.params.id);
    if (Number.isNaN(pedidoId) || pedidoId <= 0) {
      return res.redirect(`/dashboard/pedidos/${req.params.id}?error=linea_no_agregada`);
    }

    const pedidoRaw = await crm.getPedidoById(pedidoId);
    if (!pedidoRaw) {
      return res.redirect(`/dashboard/pedidos/${req.params.id}?error=pedido_no_encontrado`);
    }

    const estadoActual = (pedidoRaw.Estado || '').toLowerCase();
    if (estadoActual !== 'pendiente') {
      return res.redirect(`/dashboard/pedidos/${req.params.id}?error=linea_estado_no_permitido`);
    }

    const articuloIdNumber = Number(req.body.articulo_id);
    const cantidadNumber = Number(req.body.cantidad || 1);
    const fechaLinea = req.body.fecha_linea && req.body.fecha_linea.trim()
      ? req.body.fecha_linea.trim()
      : (pedidoRaw['Fecha Pedido'] || new Date().toISOString().split('T')[0]);

    if (Number.isNaN(articuloIdNumber) || articuloIdNumber <= 0 || Number.isNaN(cantidadNumber) || cantidadNumber <= 0) {
      return res.redirect(`/dashboard/pedidos/${req.params.id}?error=linea_datos_invalidos`);
    }

    // Obtener el artículo para obtener precio e IVA
    let precioArticulo = 0;
    let ivaArticulo = 21;
    try {
      const articulo = await crm.getArticuloById(articuloIdNumber);
      if (articulo) {
        precioArticulo = parseMoneyValue(articulo.PVL || articulo.Pvl || articulo.Precio || articulo.precio || 0);
        ivaArticulo = Number(articulo.IVA || articulo.iva || articulo['IVA %'] || articulo['Iva %'] || 21) || 21;
      }
    } catch (error) {
      console.warn('⚠️ Error obteniendo datos del artículo:', error.message);
    }

    // Calcular valores de la línea
    const subtotalSinDescuento = cantidadNumber * precioArticulo;
    const subtotal = subtotalSinDescuento;
    const impuesto = subtotal * (ivaArticulo / 100);
    const total = subtotal + impuesto;

    const lineaPayload = {
      'Cantidad': Number(cantidadNumber.toFixed(2)),
      'Fecha': fechaLinea,
      'Precio': precioArticulo,
      'IVA': ivaArticulo,
      'Descuento': 0,
      'Subtotal': subtotal,
      'Impuesto': impuesto,
      'Total': total,
      'Pedido_número': [{ Id: pedidoId }],
      'Artículo_id': [{ Id: articuloIdNumber }]
    };

    const lineaCreada = await crm.createPedidoLinea(lineaPayload);
    const lineaId = lineaCreada && (lineaCreada.Id || lineaCreada.id);
    if (!lineaId) {
      throw new Error('No se pudo determinar el ID de la línea creada');
    }

    let lineasActualizadas = await crm.getArticulosByPedido(pedidoId);
    const lineasIds = lineasActualizadas
      .map(linea => Number(linea.Id || linea.id))
      .filter(id => !Number.isNaN(id) && id > 0);

    if (!lineasIds.includes(Number(lineaId))) {
      lineasIds.push(Number(lineaId));
    }

    if (lineasIds.length) {
      await crm.linkPedidoLineas(pedidoId, lineasIds);
    }

    lineasActualizadas = await crm.getArticulosByPedido(pedidoId);
    // Calcular total con IVA usando la función construirLineasDesdeRaw
    const lineasConIva = await construirLineasDesdeRaw(lineasActualizadas, crm);
    const totalPedidoConIva = lineasConIva.reduce((sum, linea) => sum + (linea.total || 0), 0);
    await crm.updatePedido(pedidoId, {
      'Total_pedido_': Number(totalPedidoConIva.toFixed(2))
    });

    res.redirect(`/dashboard/pedidos/${pedidoId}?success=linea_agregada`);
  } catch (error) {
    console.error('Error agregando línea al pedido:', error);
    const detalle = encodeURIComponent(error.message || error);
    res.redirect(`/dashboard/pedidos/${req.params.id}?error=linea_no_agregada&detalle=${detalle}`);
  }
});

app.post('/dashboard/pedidos/:id/holded', requireAuth, async (req, res) => {
  try {
    const detalle = await obtenerPedidoDetallado(req.params.id);
    if (!detalle || !detalle.pedido) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }

    if ((detalle.pedido.estado || '').toLowerCase() === 'cerrado') {
      return res.status(400).json({ success: false, error: 'Pedido cerrado' });
    }

    const payload = {
      ...((req.body && Object.keys(req.body).length) ? req.body : {}),
      pedido: detalle.pedido,
      pedidoRaw: detalle.pedidoRaw,
      lineas: detalle.lineas,
      lineasRaw: detalle.lineasRaw,
      generadoEn: new Date().toISOString()
    };

    const webhookUrl = 'https://farmadescanso-n8n.6f4r35.easypanel.host/webhook-test/eb9249d4-6353-4da2-b6d2-d3482c2d3b05';
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook respondió ${response.status}: ${errorText}`);
    }

    await crm.updatePedido(detalle.pedido.id, { 'Estado': 'Cerrado' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error enviando pedido a Holded:', error);
    return res.status(500).json({ success: false, error: error.message || 'Error interno' });
  }
});

app.post('/dashboard/pedidos/:id/email', requireAuth, async (req, res) => {
  let browser;
  try {
    console.log(`📧 [EMAIL] Iniciando envío de email para pedido ID: ${req.params.id}`);
    
    const detalle = await obtenerPedidoDetallado(req.params.id);
    if (!detalle || !detalle.pedido) {
      console.error(`❌ [EMAIL] Pedido no encontrado: ${req.params.id}`);
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }

    console.log(`✅ [EMAIL] Pedido encontrado: ${detalle.pedido.numero || detalle.pedido.id}`);

    const commercialEmail = req.session?.comercial?.email
      || req.session?.comercial?.Email
      || req.session?.comercial?.correo
      || req.session?.comercial?.Correo
      || null;

    const recipients = [
      'pedidos@farmadescanso.com',
      commercialEmail
    ]
      .filter(Boolean)
      .map(r => r.trim())
      .filter(r => /.+@.+\..+/.test(r));

    const uniqueRecipients = Array.from(new Set(recipients));

    if (!uniqueRecipients.length) {
      return res.status(400).json({ success: false, error: 'No hay destinatarios configurados para el envío.' });
    }

    const lineasConSku = await enriquecerLineasConSku(detalle.lineas);

    const htmlDocumento = await new Promise((resolve, reject) => {
      req.app.render('dashboard/pedido-documento', {
        layout: false,
        title: `Documento Pedido #${detalle.pedido.numero || detalle.pedido.id}`,
        pedido: detalle.pedido,
        lineas: lineasConSku,
        pedidoRaw: detalle.pedidoRaw,
        lineasRaw: detalle.lineasRaw,
        user: req.comercial || req.session.comercial,
        fechaGeneracion: new Date(),
        esPdf: true,
        formatearMonedaES: formatearMonedaES,
        formatearNumeroES: formatearNumeroES,
        formatearNumeroPedido: formatearNumeroPedido
      }, (err, html) => {
        if (err) {
          console.error('❌ [EMAIL] Error renderizando documento para email:', err);
          console.error('❌ [EMAIL] Stack:', err.stack);
          return reject(err);
        }
        resolve(html);
      });
    });

    console.log(`🌐 [EMAIL] Iniciando Puppeteer para generar PDF...`);
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    console.log(`✅ [EMAIL] Puppeteer iniciado`);
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    console.log(`🔄 [EMAIL] Estableciendo contenido HTML...`);
    await page.setContent(htmlDocumento, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    console.log(`✅ [EMAIL] Contenido establecido`);
    
    console.log(`🔄 [EMAIL] Generando PDF...`);
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '2px', bottom: '18mm', left: '2px' },
      timeout: 30000
    });
    console.log(`✅ [EMAIL] PDF generado (${pdfBuffer.length} bytes)`);
    
    await browser.close();
    browser = null;
    console.log(`✅ [EMAIL] Navegador cerrado`);

    const numeroPedido = formatearNumeroPedido(
      detalle.pedidoRaw && (
        detalle.pedidoRaw['Número_Pedido'] ||
        detalle.pedidoRaw['Número Pedido'] ||
        detalle.pedidoRaw.Numero_Pedido ||
        detalle.pedidoRaw.NumeroPedido ||
        detalle.pedidoRaw.numero ||
        detalle.pedidoRaw.Numero
      ),
      detalle.pedido.fecha
    ) || detalle.pedido.numero || detalle.pedido.id;

    const clienteNombre = detalle.pedido.cliente || 'cliente';

    console.log(`📧 [EMAIL] Enviando email a: ${uniqueRecipients.join(', ')}`);
    await mailTransport.sendMail({
      from: process.env.MAIL_FROM || 'pedidos@farmadescanso.com',
      to: uniqueRecipients,
      subject: `Pedido ${numeroPedido}`,
      text: `Estimado/a ${clienteNombre}:\n\nAdjuntamos el pedido ${numeroPedido}.\n` +
        `Si necesitas cualquier aclaración, responde a este correo.\n\nSaludos.\nFarmadescaso 2021 SL`,
      html: `<p>Estimado/a ${clienteNombre}:</p>
        <p>Adjuntamos el pedido <strong>${numeroPedido}</strong>.</p>
        <p>Si necesitas cualquier aclaración, responde a este correo.</p>
        <p>Saludos.<br>Farmadescaso 2021 SL</p>`,
      attachments: [{
        filename: `Pedido-${numeroPedido}.pdf`,
        content: pdfBuffer
      }]
    });

    console.log(`✅ [EMAIL] Email enviado exitosamente a ${uniqueRecipients.length} destinatario(s)`);
    res.json({ success: true, recipients: uniqueRecipients });
  } catch (error) {
    console.error('❌ [EMAIL] Error enviando pedido por email:', error);
    console.error('❌ [EMAIL] Stack:', error.stack);
    res.status(500).json({ success: false, error: error.message || 'Error interno al enviar el correo' });
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log(`🔒 [EMAIL] Navegador cerrado en finally`);
      } catch (err) {
        console.warn('⚠️ [EMAIL] No se pudo cerrar navegador:', err.message);
      }
    }
  }
});

app.get('/dashboard/pedidos/:id/documento', requireAuth, async (req, res) => {
  try {
    const tipoDocumento = req.query.tipo || 'pedido'; // 'pedido' o 'factura'
    const detalle = await obtenerPedidoDetallado(req.params.id);
    if (!detalle || !detalle.pedido) {
      return res.status(404).render('error', {
        error: 'Pedido no encontrado',
        message: 'El pedido solicitado no existe'
      });
    }

    const { pedido, lineas, pedidoRaw } = detalle;
    const lineasConSku = await enriquecerLineasConSku(lineas);

    // Obtener datos adicionales: forma de pago, tipo de pedido, comercial, cooperativa
    let formaPagoInfo = null;
    if (pedidoRaw && pedidoRaw.Id_FormaPago) {
      try {
        const formaPagoId = Number(pedidoRaw.Id_FormaPago);
        if (!Number.isNaN(formaPagoId) && formaPagoId > 0) {
          const formaPagoObj = await crm.getFormaPagoById(formaPagoId);
          if (formaPagoObj) {
            formaPagoInfo = {
              nombre: formaPagoObj.FormaPago || formaPagoObj.Forma || formaPagoObj.forma || '—',
              dias: formaPagoObj.Dias || formaPagoObj.dias || 0
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ Error obteniendo forma de pago:', error.message);
      }
    }

    let tipoPedidoInfo = null;
    if (pedidoRaw && pedidoRaw.Id_TipoPedido) {
      try {
        const tipoPedidoId = Number(pedidoRaw.Id_TipoPedido);
        if (!Number.isNaN(tipoPedidoId) && tipoPedidoId > 0) {
          const tipoPedidoResult = await crm.query('SELECT Tipo FROM tipos_pedidos WHERE id = ? LIMIT 1', [tipoPedidoId]);
          if (tipoPedidoResult && tipoPedidoResult.length > 0) {
            tipoPedidoInfo = {
              tipo: tipoPedidoResult[0].Tipo || '—'
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ Error obteniendo tipo de pedido:', error.message);
      }
    }

    let comercialInfo = null;
    if (pedidoRaw && pedidoRaw.Id_Cial) {
      try {
        const comercialId = Number(pedidoRaw.Id_Cial);
        if (!Number.isNaN(comercialId) && comercialId > 0) {
          const comercial = await crm.getComercialById(comercialId);
          if (comercial) {
            comercialInfo = {
              nombre: comercial.Nombre || comercial.nombre || '—',
              email: comercial.Email || comercial.email || null
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ Error obteniendo comercial:', error.message);
      }
    }

    // Seleccionar la plantilla según el tipo
    const plantilla = tipoDocumento === 'factura' ? 'dashboard/pedido-factura' : 'dashboard/pedido-documento';
    const titulo = tipoDocumento === 'factura' 
      ? `Factura #${pedido.numero || pedido.id}` 
      : `Documento Pedido #${pedido.numero || pedido.id}`;

    res.render(plantilla, {
      title: titulo,
      pedido,
      lineas: lineasConSku,
      pedidoRaw,
      lineasRaw: detalle.lineasRaw,
      user: req.comercial || req.session.comercial,
      fechaGeneracion: new Date(),
      esPdf: Boolean(req.query.pdf === '1'),
      tipoDocumento: tipoDocumento,
      formatearMonedaES: formatearMonedaES,
      formatearNumeroES: formatearNumeroES,
      formatearNumeroPedido: formatearNumeroPedido,
      formaPagoInfo,
      tipoPedidoInfo,
      comercialInfo
    });
  } catch (error) {
    console.error('Error generando documento de pedido:', error);
    res.status(500).render('error', {
      error: 'Error interno',
      message: `No se pudo generar el documento del pedido. Detalles: ${error.message || error}`
    });
  }
});

app.get('/dashboard/pedidos/:id/pdf', requireAuth, async (req, res) => {
  let browser = null;
  try {
    console.log(`📄 [PDF] Iniciando generación de PDF para pedido ID: ${req.params.id}`);
    
    const detalle = await obtenerPedidoDetallado(req.params.id);
    if (!detalle || !detalle.pedido) {
      console.error(`❌ [PDF] Pedido no encontrado: ${req.params.id}`);
      return res.status(404).render('error', {
        error: 'Pedido no encontrado',
        message: 'El pedido solicitado no existe'
      });
    }

    console.log(`✅ [PDF] Pedido encontrado: ${detalle.pedido.numero || detalle.pedido.id}`);

    const tipoDocumento = req.query.tipo || 'pedido'; // 'pedido' o 'factura'
    const { pedido, lineas, pedidoRaw } = detalle;
    const lineasConSku = await enriquecerLineasConSku(lineas);
    console.log(`✅ [PDF] Líneas enriquecidas: ${lineasConSku.length}`);
    console.log(`📄 [PDF] Tipo de documento: ${tipoDocumento}`);

    // Obtener datos adicionales: forma de pago, tipo de pedido, comercial, cooperativa
    let formaPagoInfo = null;
    if (pedidoRaw && pedidoRaw.Id_FormaPago) {
      try {
        const formaPagoId = Number(pedidoRaw.Id_FormaPago);
        if (!Number.isNaN(formaPagoId) && formaPagoId > 0) {
          const formaPagoObj = await crm.getFormaPagoById(formaPagoId);
          if (formaPagoObj) {
            formaPagoInfo = {
              nombre: formaPagoObj.FormaPago || formaPagoObj.Forma || formaPagoObj.forma || '—',
              dias: formaPagoObj.Dias || formaPagoObj.dias || 0
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ [PDF] Error obteniendo forma de pago:', error.message);
      }
    }

    let tipoPedidoInfo = null;
    if (pedidoRaw && pedidoRaw.Id_TipoPedido) {
      try {
        const tipoPedidoId = Number(pedidoRaw.Id_TipoPedido);
        if (!Number.isNaN(tipoPedidoId) && tipoPedidoId > 0) {
          const tipoPedidoResult = await crm.query('SELECT Tipo FROM tipos_pedidos WHERE id = ? LIMIT 1', [tipoPedidoId]);
          if (tipoPedidoResult && tipoPedidoResult.length > 0) {
            tipoPedidoInfo = {
              tipo: tipoPedidoResult[0].Tipo || '—'
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ [PDF] Error obteniendo tipo de pedido:', error.message);
      }
    }

    let comercialInfo = null;
    if (pedidoRaw && pedidoRaw.Id_Cial) {
      try {
        const comercialId = Number(pedidoRaw.Id_Cial);
        if (!Number.isNaN(comercialId) && comercialId > 0) {
          const comercial = await crm.getComercialById(comercialId);
          if (comercial) {
            comercialInfo = {
              nombre: comercial.Nombre || comercial.nombre || '—',
              email: comercial.Email || comercial.email || null
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ [PDF] Error obteniendo comercial:', error.message);
      }
    }

    // Seleccionar la plantilla según el tipo
    const plantilla = tipoDocumento === 'factura' ? 'dashboard/pedido-factura' : 'dashboard/pedido-documento';
    const titulo = tipoDocumento === 'factura' 
      ? `Factura #${pedido.numero || pedido.id}` 
      : `Documento Pedido #${pedido.numero || pedido.id}`;

    const locals = {
      layout: false,
      title: titulo,
      pedido,
      lineas: lineasConSku,
      pedidoRaw,
      lineasRaw: detalle.lineasRaw,
      user: req.comercial || req.session.comercial,
      fechaGeneracion: new Date(),
      esPdf: true,
      tipoDocumento: tipoDocumento,
      formatearMonedaES: formatearMonedaES,
      formatearNumeroES: formatearNumeroES,
      formatearNumeroPedido: formatearNumeroPedido,
      formaPagoInfo,
      tipoPedidoInfo,
      comercialInfo
    };

    console.log(`🔄 [PDF] Renderizando vista: ${plantilla}...`);
    req.app.render(plantilla, locals, async (renderErr, html) => {
      if (renderErr) {
        console.error('❌ [PDF] Error renderizando documento para PDF:', renderErr);
        console.error('❌ [PDF] Stack:', renderErr.stack);
        return res.status(500).render('error', {
          error: 'Error interno',
          message: `No se pudo generar el documento del pedido. Error: ${renderErr.message || renderErr}`
        });
      }

      if (!html || html.length === 0) {
        console.error('❌ [PDF] HTML renderizado está vacío');
        return res.status(500).render('error', {
          error: 'Error interno',
          message: 'El documento renderizado está vacío'
        });
      }

      console.log(`✅ [PDF] Vista renderizada (${html.length} caracteres)`);
      console.log(`🌐 [PDF] Iniciando Puppeteer...`);

      try {
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
          ]
        });
        console.log(`✅ [PDF] Puppeteer iniciado`);

        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
        console.log(`🔄 [PDF] Estableciendo contenido HTML...`);
        await page.setContent(html, { 
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        console.log(`✅ [PDF] Contenido establecido`);

        console.log(`🔄 [PDF] Generando PDF...`);
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '18mm', right: '2px', bottom: '18mm', left: '2px' },
          timeout: 30000
        });
        console.log(`✅ [PDF] PDF generado (${pdfBuffer.length} bytes)`);

        if (browser) {
          await browser.close();
          browser = null;
        }

        const prefijo = tipoDocumento === 'factura' ? 'Factura' : 'Pedido';
        const fileName = `${prefijo}-${(pedido.numero || pedido.id || 'documento').toString().replace(/\s+/g, '_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(pdfBuffer);
        console.log(`✅ [PDF] PDF enviado al cliente: ${fileName}`);
      } catch (puppeteerError) {
        console.error('❌ [PDF] Error con Puppeteer:', puppeteerError);
        console.error('❌ [PDF] Stack:', puppeteerError.stack);
        if (browser) {
          try {
            await browser.close();
          } catch (closeError) {
            console.error('❌ [PDF] Error cerrando navegador:', closeError);
          }
          browser = null;
        }
        return res.status(500).render('error', {
          error: 'Error interno',
          message: `No se pudo generar el PDF. Error: ${puppeteerError.message || puppeteerError}`
        });
      }
    });
  } catch (error) {
    console.error('❌ [PDF] Error generando PDF del pedido:', error);
    console.error('❌ [PDF] Stack:', error.stack);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('❌ [PDF] Error cerrando navegador:', closeError);
      }
    }
    res.status(500).render('error', {
      error: 'Error interno',
      message: `No se pudo generar el PDF del pedido. Detalles: ${error.message || error}`
    });
  }
});

// Ruta para enviar documento a webhook
app.post('/dashboard/pedidos/:id/webhook', requireAuth, async (req, res) => {
  let browser = null;
  try {
    const { destinatario, tipoDocumento } = req.body;
    const pedidoId = req.params.id;

    console.log(`🔗 [WEBHOOK] Enviando documento ${tipoDocumento} a ${destinatario} para pedido ID: ${pedidoId}`);

    if (!destinatario || !tipoDocumento) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros: destinatario y tipoDocumento son obligatorios'
      });
    }

    // Obtener datos del pedido
    const detalle = await obtenerPedidoDetallado(pedidoId);
    if (!detalle || !detalle.pedido) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    const { pedido, lineas, pedidoRaw } = detalle;
    const lineasConSku = await enriquecerLineasConSku(lineas);

    // Obtener datos adicionales
    let formaPagoInfo = null;
    if (pedidoRaw && pedidoRaw.Id_FormaPago) {
      try {
        const formaPagoId = Number(pedidoRaw.Id_FormaPago);
        if (!Number.isNaN(formaPagoId) && formaPagoId > 0) {
          const formaPagoObj = await crm.getFormaPagoById(formaPagoId);
          if (formaPagoObj) {
            formaPagoInfo = {
              nombre: formaPagoObj.FormaPago || formaPagoObj.Forma || formaPagoObj.forma || '—',
              dias: formaPagoObj.Dias || formaPagoObj.dias || 0
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ [WEBHOOK] Error obteniendo forma de pago:', error.message);
      }
    }

    let tipoPedidoInfo = null;
    if (pedidoRaw && pedidoRaw.Id_TipoPedido) {
      try {
        const tipoPedidoId = Number(pedidoRaw.Id_TipoPedido);
        if (!Number.isNaN(tipoPedidoId) && tipoPedidoId > 0) {
          const tipoPedidoResult = await crm.query('SELECT Tipo FROM tipos_pedidos WHERE id = ? LIMIT 1', [tipoPedidoId]);
          if (tipoPedidoResult && tipoPedidoResult.length > 0) {
            tipoPedidoInfo = {
              tipo: tipoPedidoResult[0].Tipo || '—'
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ [WEBHOOK] Error obteniendo tipo de pedido:', error.message);
      }
    }

    let comercialInfo = null;
    if (pedidoRaw && pedidoRaw.Id_Cial) {
      try {
        const comercialId = Number(pedidoRaw.Id_Cial);
        if (!Number.isNaN(comercialId) && comercialId > 0) {
          const comercial = await crm.getComercialById(comercialId);
          if (comercial) {
            comercialInfo = {
              nombre: comercial.Nombre || comercial.nombre || '—',
              email: comercial.Email || comercial.email || null
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ [WEBHOOK] Error obteniendo comercial:', error.message);
      }
    }

    // Generar PDF del documento
    const plantilla = tipoDocumento === 'factura' ? 'dashboard/pedido-factura' : 'dashboard/pedido-documento';
    const titulo = tipoDocumento === 'factura' 
      ? `Factura #${pedido.numero || pedido.id}` 
      : `Documento Pedido #${pedido.numero || pedido.id}`;

    const htmlDocumento = await new Promise((resolve, reject) => {
      req.app.render(plantilla, {
        layout: false,
        title: titulo,
        pedido,
        lineas: lineasConSku,
        pedidoRaw,
        lineasRaw: detalle.lineasRaw,
        user: req.comercial || req.session.comercial,
        fechaGeneracion: new Date(),
        esPdf: true,
        tipoDocumento: tipoDocumento,
        formatearMonedaES: formatearMonedaES,
        formatearNumeroES: formatearNumeroES,
        formatearNumeroPedido: formatearNumeroPedido,
        formaPagoInfo,
        tipoPedidoInfo,
        comercialInfo
      }, (err, html) => {
        if (err) {
          console.error('❌ [WEBHOOK] Error renderizando documento:', err);
          return reject(err);
        }
        resolve(html);
      });
    });

    // Generar PDF con Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.setContent(htmlDocumento, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '2px', bottom: '18mm', left: '2px' },
      timeout: 30000
    });

    await browser.close();
    browser = null;

    // Preparar payload para webhook
    const webhookUrl = process.env[`WEBHOOK_URL_${destinatario.toUpperCase()}_${tipoDocumento.toUpperCase()}`] || 
                      process.env.WEBHOOK_URL_PEDIDOS || 
                      null;

    if (!webhookUrl) {
      console.warn('⚠️ [WEBHOOK] No se configuró URL de webhook. Usar variables de entorno:');
      console.warn(`   WEBHOOK_URL_${destinatario.toUpperCase()}_${tipoDocumento.toUpperCase()} o WEBHOOK_URL_PEDIDOS`);
      return res.status(400).json({
        success: false,
        error: 'Webhook no configurado. Contacta al administrador.'
      });
    }

    // Preparar datos para el webhook
    const webhookPayload = {
      pedidoId: pedido.id,
      pedidoNumero: pedido.numero || pedido.id,
      tipoDocumento: tipoDocumento,
      destinatario: destinatario,
      fecha: new Date().toISOString(),
      cliente: {
        id: pedidoRaw.Id_Cliente,
        nombre: pedido.cliente
      },
      total: pedido.total || 0,
      estado: pedido.estado,
      pdfBase64: pdfBuffer.toString('base64'),
      pdfNombre: `${tipoDocumento === 'factura' ? 'Factura' : 'Pedido'}-${pedido.numero || pedido.id}.pdf`
    };

    // Enviar a webhook
    console.log(`📤 [WEBHOOK] Enviando a: ${webhookUrl}`);
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
      timeout: 30000
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      throw new Error(`Webhook respondió con error: ${webhookResponse.status} - ${errorText}`);
    }

    const webhookResult = await webhookResponse.json().catch(() => ({}));
    console.log(`✅ [WEBHOOK] Documento enviado correctamente`);

    res.json({
      success: true,
      message: `Documento ${tipoDocumento} enviado a ${destinatario} correctamente`,
      webhookResponse: webhookResult
    });

  } catch (error) {
    console.error('❌ [WEBHOOK] Error enviando documento:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('❌ [WEBHOOK] Error cerrando navegador:', closeError);
      }
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Error al enviar el documento al webhook'
    });
  }
});

// Función para obtener color por comercial ID
const obtenerColorComercial = (comercialId, totalComerciales) => {
  const colores = [
    '#007bff', // Azul
    '#28a745', // Verde
    '#ffc107', // Amarillo
    '#dc3545', // Rojo
    '#17a2b8', // Cyan
    '#6f42c1', // Púrpura
    '#fd7e14', // Naranja
    '#20c997', // Verde agua
    '#e83e8c', // Rosa
    '#6c757d'  // Gris
  ];
  const index = Number(comercialId || 0) % colores.length;
  return colores[index] || colores[0];
};

// Gestión de agenda - Lista
// IMPORTANTE: Esta ruta debe estar ANTES de /dashboard/agenda/:id para evitar conflictos
app.get('/dashboard/agenda', requireAuth, async (req, res) => {
  try {
    console.log(`✅ [AGENDA] Ruta /dashboard/agenda accedida - Query:`, req.query);
    const comercialId = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    const vista = req.query.vista || 'lista'; // 'lista' o 'calendario'
    
    // Si no es admin, filtrar por el comercial autenticado
    const comercialIdFiltro = (!esAdmin && comercialId) ? comercialId : null;
    
    console.log(`🔐 [AGENDA] Usuario: ${esAdmin ? 'Admin' : 'Comercial'} (ID: ${comercialId})`);
    console.log(`🔐 [AGENDA] Filtro aplicado: ${comercialIdFiltro ? `Comercial ${comercialIdFiltro}` : 'Todos'}`);
    
    const [todasLasVisitas, todosLosComerciales, todosLosClientes, todosLosCentrosSalud] = await Promise.all([
      crm.getVisitas(comercialIdFiltro),
      crm.getComerciales(),
      crm.getClientes(comercialIdFiltro), // También filtrar clientes si no es admin
      crm.getCentrosSalud()
    ]);

    console.log(`🔍 [AGENDA] Total citas obtenidas: ${todasLasVisitas.length}`);
    console.log(`🔍 [AGENDA] Comercial ID para filtrar: ${comercialId}`);
    
    // Debug: Mostrar estructura de las primeras visitas
    if (todasLasVisitas.length > 0) {
      console.log(`🔍 [VISITAS] Estructura de la primera visita:`, {
        Id: todasLasVisitas[0].Id || todasLasVisitas[0].id,
        Comercial_id: todasLasVisitas[0].Comercial_id,
        comercial_id: todasLasVisitas[0].comercial_id,
        Comercial_Id: todasLasVisitas[0].Comercial_Id,
        comercial_Id: todasLasVisitas[0].comercial_Id,
        todasLasKeys: Object.keys(todasLasVisitas[0]).filter(k => k.toLowerCase().includes('comercial'))
      });
    }

    // Filtrar visitas por comercial
    // NocoDB usa: Comerciales (número) o _nc_m2m_Visitas_Comerciales (array many-to-many)
    const visitas = todasLasVisitas.filter(v => {
      // Primero intentar con el campo directo Comerciales (número)
      const comercialDirecto = v.Comerciales;
      
      // Si existe y es un número, comparar directamente
      // IMPORTANTE: Si Comerciales es 0, significa que no tiene comercial asignado
      // En ese caso, incluirlo también para que el usuario pueda ver y asignar visitas sin comercial
      if (comercialDirecto !== undefined && comercialDirecto !== null) {
        // Si el comercial es 0 (sin asignar), incluir la visita
        if (Number(comercialDirecto) === 0) {
          console.log(`ℹ️ [VISITAS] Visita ${v.Id}: Sin comercial asignado (Comerciales: 0), incluyendo en el listado`);
          return true;
        }
        const coincide = Number(comercialDirecto) === Number(comercialId);
        if (!coincide) {
          console.log(`🔍 [VISITAS] Visita ${v.Id}: Comerciales directo ${comercialDirecto} !== ${comercialId}`);
        }
        return coincide;
      }
      
      // Si no, intentar con la relación many-to-many
      const relacionM2M = v._nc_m2m_Visitas_Comerciales;
      if (Array.isArray(relacionM2M) && relacionM2M.length > 0) {
        // La relación tiene estructura: [{ Comerciales_id: X, Comerciales: {...} }]
        const comercialIdDeRelacion = relacionM2M[0]?.Comerciales_id || relacionM2M[0]?.Comerciales?.Id;
        if (comercialIdDeRelacion) {
          const coincide = Number(comercialIdDeRelacion) === Number(comercialId);
          if (!coincide) {
            console.log(`🔍 [VISITAS] Visita ${v.Id}: M2M comercial ID ${comercialIdDeRelacion} !== ${comercialId}`);
          }
          return coincide;
        }
      }
      
      // Fallback: buscar en campos antiguos por compatibilidad
      const comercialRef = v.Comercial_id || v.comercial_id || v.Comercial_Id || v.comercial_Id;
      if (comercialRef) {
        if (Array.isArray(comercialRef) && comercialRef.length > 0) {
          const comercialIdFromArray = comercialRef[0]?.Id || comercialRef[0]?.id || comercialRef[0];
          return Number(comercialIdFromArray) === Number(comercialId);
        }
        if (typeof comercialRef === 'object' && comercialRef !== null) {
          const comercialIdFromObj = comercialRef.Id || comercialRef.id;
          return Number(comercialIdFromObj) === Number(comercialId);
        }
        return Number(comercialRef) === Number(comercialId);
      }
      
      // Si no hay referencia de comercial, incluir la visita para que pueda ser asignada
      // Esto permite ver visitas que aún no tienen comercial asignado
      console.log(`ℹ️ [VISITAS] Visita ${v.Id} sin referencia de comercial, incluyendo en el listado para asignación`);
      return true;
    });

    console.log(`✅ [VISITAS] Visitas filtradas: ${visitas.length} de ${todasLasVisitas.length}`);
    
    // Si hay menos visitas filtradas que totales, revisar qué está pasando
    if (visitas.length < todasLasVisitas.length) {
      console.log(`🔍 [VISITAS] Revisando visitas que no pasaron el filtro:`);
      todasLasVisitas.forEach(v => {
        const comercialDirecto = v.Comerciales;
        const relacionM2M = v._nc_m2m_Visitas_Comerciales;
        const comercialRef = v.Comercial_id || v.comercial_id || v.Comercial_Id || v.comercial_Id;
        const tieneComercial = comercialDirecto !== undefined && comercialDirecto !== null ||
                              (Array.isArray(relacionM2M) && relacionM2M.length > 0) ||
                              comercialRef !== undefined && comercialRef !== null;
        
        if (!tieneComercial) {
          console.log(`  ⚠️ Visita ${v.Id}: Sin referencia de comercial`);
        } else {
          const comercialIdEnVisita = comercialDirecto !== undefined ? comercialDirecto :
                                     (relacionM2M && relacionM2M[0]?.Comerciales_id) ||
                                     (Array.isArray(comercialRef) ? comercialRef[0]?.Id : comercialRef);
          if (Number(comercialIdEnVisita) !== Number(comercialId)) {
            console.log(`  ℹ️ Visita ${v.Id}: Comercial ${comercialIdEnVisita} !== ${comercialId} (sesión actual)`);
          }
        }
      });
    }
    
    // Si no hay visitas filtradas pero sí hay visitas totales, mostrar todas temporalmente para debug
    // Esto ayuda a identificar si el problema es el filtrado
    let visitasAMostrar = visitas;
    if (visitas.length === 0 && todasLasVisitas.length > 0) {
      console.warn(`⚠️ [VISITAS] No se encontraron visitas con el filtro. Mostrando todas las visitas para debug.`);
      console.warn(`⚠️ [VISITAS] Esto puede indicar que las visitas no tienen el campo Comercial_id correctamente asignado.`);
      visitasAMostrar = todasLasVisitas; // Mostrar todas temporalmente
    }

    // Mapear visitas con información completa
    const visitasMapeadas = visitasAMostrar.map(visita => {
      // Función helper para extraer ID de referencia (puede ser array, objeto o número)
      const extraerIdDeReferencia = (ref) => {
        // Si es null o undefined, retornar null
        if (!ref) return null;
        
        // Si es un array (formato NocoDB para relaciones)
        if (Array.isArray(ref)) {
          if (ref.length === 0) return null;
          // El primer elemento puede ser un objeto con Id o un número directo
          const first = ref[0];
          if (typeof first === 'object' && first !== null) {
            // Buscar Id o id en el objeto
            return first.Id || first.id || null;
          }
          // Si es un número directo
          return typeof first === 'number' ? first : Number(first) || null;
        }
        
        // Si es un objeto (relación expandida de NocoDB)
        if (typeof ref === 'object' && ref !== null) {
          return ref.Id || ref.id || null;
        }
        
        // Si es un número o string que representa un número
        if (typeof ref === 'number') return ref;
        if (typeof ref === 'string') {
          const num = Number(ref);
          return isNaN(num) ? null : num;
        }
        
        return null;
      };

      // Usar los nombres correctos de campos según la estructura real de NocoDB
      // IMPORTANTE: Según la estructura real de NocoDB, FarmaciaCliente es un campo numérico directo
      // También buscar en relaciones Many-to-Many por si acaso
      let clienteRef = null;
      if (visita.FarmaciaCliente !== undefined && visita.FarmaciaCliente !== null && visita.FarmaciaCliente !== 0) {
        clienteRef = visita.FarmaciaCliente;
      } else if (visita._nc_m2m_Visitas_Clientes && Array.isArray(visita._nc_m2m_Visitas_Clientes) && visita._nc_m2m_Visitas_Clientes.length > 0) {
        clienteRef = visita._nc_m2m_Visitas_Clientes[0]?.Clientes_id || visita._nc_m2m_Visitas_Clientes[0]?.Cliente_id || null;
      } else if (visita.Cliente_id !== undefined) {
        clienteRef = visita.Cliente_id;
      } else if (visita.cliente_id !== undefined) {
        clienteRef = visita.cliente_id;
      } else if (visita.Cliente_Id !== undefined) {
        clienteRef = visita.Cliente_Id;
      } else if (visita.cliente_Id !== undefined) {
        clienteRef = visita.cliente_Id;
      }
      
      const centroRef = visita.CentroSalud !== undefined ? visita.CentroSalud :
                        visita.Centro_Salud_id !== undefined ? visita.Centro_Salud_id :
                        visita.centro_salud_id !== undefined ? visita.centro_salud_id :
                        visita.Centro_Salud_Id !== undefined ? visita.Centro_Salud_Id :
                        visita.centro_Salud_Id !== undefined ? visita.centro_Salud_Id : null;
      
      const comercialRef = visita.Comerciales !== undefined ? visita.Comerciales : 
                          (visita._nc_m2m_Visitas_Comerciales && Array.isArray(visita._nc_m2m_Visitas_Comerciales) && visita._nc_m2m_Visitas_Comerciales.length > 0 ? 
                            visita._nc_m2m_Visitas_Comerciales[0]?.Comerciales_id : null) ||
                          visita.Comercial_id || visita.comercial_id || visita.Comercial_Id || visita.comercial_Id;
      
      let comercial = null;
      let cliente = null;
      let centroSalud = null;
      let comercialIdVisita = null;

      // Extraer ID de comercial - los campos nuevos son números directos
      comercialIdVisita = typeof comercialRef === 'number' ? comercialRef : extraerIdDeReferencia(comercialRef);
      if (comercialIdVisita) {
        comercial = todosLosComerciales.find(c => (c.Id || c.id) === Number(comercialIdVisita));
      }

      // Extraer ID de cliente (farmacia) - según la estructura real, FarmaciaCliente es un número directo
      let clienteIdVisita = null;
      if (clienteRef !== null && clienteRef !== undefined && clienteRef !== 0) {
        // FarmaciaCliente es un número directo en NocoDB
        if (typeof clienteRef === 'number') {
          clienteIdVisita = clienteRef;
        } else {
          // Si viene como array u objeto (relación Many-to-Many), extraer el ID
          clienteIdVisita = extraerIdDeReferencia(clienteRef);
        }
        console.log('🔍 [VISITAS] ClienteRef:', JSON.stringify(clienteRef), '-> ClienteIdVisita:', clienteIdVisita, '(type:', typeof clienteRef + ')');
      }
      if (clienteIdVisita && clienteIdVisita > 0) {
        cliente = todosLosClientes.find(c => {
          const clienteId = Number(c.Id || c.id);
          const match = clienteId === Number(clienteIdVisita);
          if (match) {
            console.log(`✅ [VISITAS] Cliente encontrado: ID ${clienteIdVisita} -> ${c.Nombre || c.nombre}`);
          }
          return match;
        });
        if (!cliente && clienteIdVisita) {
          console.warn(`⚠️ [VISITAS] Cliente no encontrado con ID: ${clienteIdVisita}`);
          console.warn(`⚠️ [VISITAS] Total clientes disponibles: ${todosLosClientes.length}`);
          console.warn(`⚠️ [VISITAS] Primeros 5 clientes:`, todosLosClientes.slice(0, 5).map(c => ({ id: c.Id || c.id, nombre: c.Nombre || c.nombre })));
        }
      } else {
        if (clienteRef === 0 || clienteRef === null || clienteRef === undefined) {
          console.log('ℹ️ [VISITAS] FarmaciaCliente es 0/null/undefined (visita sin cliente asignado)');
        } else {
          console.warn('⚠️ [VISITAS] ClienteRef existe pero clienteIdVisita es inválido:', clienteRef);
        }
      }

      // Extraer ID de centro de salud - los campos nuevos son números directos
      console.log('🔍 [VISITAS] CentroRef recibido:', JSON.stringify(centroRef), '(type:', typeof centroRef + ')');
      const centroIdVisita = typeof centroRef === 'number' ? centroRef : extraerIdDeReferencia(centroRef);
      console.log('🔍 [VISITAS] CentroIdVisita extraído:', centroIdVisita, '(type:', typeof centroIdVisita + ')');
      if (centroIdVisita && centroIdVisita > 0) {
        console.log('🔍 [VISITAS] Buscando centro de salud con ID:', centroIdVisita);
        console.log('🔍 [VISITAS] Total centros disponibles:', todosLosCentrosSalud.length);
        console.log('🔍 [VISITAS] Primeros 5 centros:', todosLosCentrosSalud.slice(0, 5).map(c => ({ 
          id: c.Id || c.id, 
          nombre: c.NombreCentro || c.nombreCentro || c.Nombre || c.nombre || 'Sin nombre'
        })));
        centroSalud = todosLosCentrosSalud.find(c => {
          const centroId = Number(c.Id || c.id);
          const match = centroId === Number(centroIdVisita);
          if (match) {
            console.log(`✅ [VISITAS] Centro encontrado: ID ${centroIdVisita} -> ${c.NombreCentro || c.nombreCentro || c.Nombre || c.nombre || 'Sin nombre'}`);
          }
          return match;
        });
        if (!centroSalud && centroIdVisita) {
          console.warn(`⚠️ [VISITAS] Centro de salud NO encontrado con ID: ${centroIdVisita}`);
          console.warn(`⚠️ [VISITAS] CentroRef original:`, JSON.stringify(centroRef));
          console.warn(`⚠️ [VISITAS] IDs de centros disponibles:`, todosLosCentrosSalud.map(c => ({ 
            id: c.Id || c.id, 
            nombre: c.NombreCentro || c.nombreCentro || c.Nombre || c.nombre || 'Sin nombre'
          })));
        }
      } else {
        console.log('ℹ️ [VISITAS] CentroIdVisita es inválido o no existe:', centroIdVisita, '(centroRef:', JSON.stringify(centroRef) + ')');
      }

      // Normalizar el tipo de visita a los valores válidos: Farmacia, Sanitarios, Reunión, Notas
      let tipoVisita = visita.TipoVisita || visita.tipoVisita || visita.Tipo_Visita || visita.tipo_visita || 'Farmacia';
      // Convertir "Centro de Salud" o "Centro Salud" a "Sanitarios" si existe
      if (tipoVisita === 'Centro de Salud' || tipoVisita === 'Centro Salud') {
        tipoVisita = 'Sanitarios';
      }
      // Convertir "Otro" a "Notas" si existe
      if (tipoVisita === 'Otro') {
        tipoVisita = 'Notas';
      }
      const tipoDetalle = visita.Descripcion || visita.Tipo || visita.tipo || visita.descripcion || 'General';

      // Función helper para extraer nombre del centro de salud
      // Según la estructura real: el campo es "NombreCentro"
      const obtenerNombreCentroSalud = (centro) => {
        if (!centro) return null;
        return centro.NombreCentro 
          || centro.nombreCentro
          || centro.Nombre_Centro
          || centro.nombre_centro
          || centro.Nombre
          || centro.nombre
          || null;
      };
      
      // Función helper para extraer nombre del cliente/farmacia
      // Según la estructura real: el campo es "Nombre"
      const obtenerNombreCliente = (cliente) => {
        if (!cliente) return null;
        return cliente.Nombre 
          || cliente.nombre
          || null;
      };

      // Formatear fecha para el calendario (formato ISO: YYYY-MM-DD)
      let fechaRaw = visita.Fecha || visita.fecha || visita.Fecha_Visita || visita.fecha_visita;
      let fechaFormateada = '';
      let fechaHoraCompleta = '';
      
      if (fechaRaw) {
        try {
          const fechaObj = new Date(fechaRaw);
          if (!isNaN(fechaObj.getTime())) {
            const year = fechaObj.getFullYear();
            const month = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const day = String(fechaObj.getDate()).padStart(2, '0');
            fechaFormateada = `${year}-${month}-${day}`;
          } else if (typeof fechaRaw === 'string' && fechaRaw.includes('-')) {
            // Si ya está en formato YYYY-MM-DD, usarlo directamente
            fechaFormateada = fechaRaw.split('T')[0].split(' ')[0];
          }
        } catch (e) {
          // Si falla, intentar extraer fecha del string
          if (typeof fechaRaw === 'string') {
            fechaFormateada = fechaRaw.split('T')[0].split(' ')[0];
          }
        }
      }

      // Formatear hora (asegurar formato HH:MM)
      let horaRaw = visita.Hora || visita.hora || visita.Hora_Visita || visita.hora_visita || '09:00';
      let horaFormateada = '09:00';
      
      if (horaRaw) {
        if (typeof horaRaw === 'string' && horaRaw.includes(':')) {
          // Extraer solo HH:MM si tiene más información
          const horaMatch = horaRaw.match(/(\d{1,2}):(\d{2})/);
          if (horaMatch) {
            const horas = String(parseInt(horaMatch[1])).padStart(2, '0');
            const minutos = horaMatch[2];
            horaFormateada = `${horas}:${minutos}`;
          } else {
            horaFormateada = '09:00';
          }
        } else {
          horaFormateada = '09:00';
        }
      }

      // Construir fecha-hora completa para FullCalendar con zona horaria de Madrid
      if (fechaFormateada) {
        // Formato ISO 8601 con zona horaria de Madrid (Europe/Madrid = UTC+1 o UTC+2 según DST)
        // FullCalendar manejará la conversión automáticamente con timeZone: 'Europe/Madrid'
        fechaHoraCompleta = `${fechaFormateada}T${horaFormateada}:00`;
      }

      return {
        id: visita.Id || visita.id,
        fecha: fechaRaw,
        fechaFormateada: fechaFormateada,
        fechaHoraCompleta: fechaHoraCompleta,
        hora: horaRaw,
        horaFormateada: horaFormateada,
        cliente: cliente ? obtenerNombreCliente(cliente) : (centroSalud ? obtenerNombreCentroSalud(centroSalud) : 'No encontrado'),
        clienteId: cliente ? (cliente.Id || cliente.id) : null,
        centroSalud: obtenerNombreCentroSalud(centroSalud),
        centroSaludId: centroSalud ? (centroSalud.Id || centroSalud.id) : null,
        comercial: comercial ? (comercial.Nombre || comercial.nombre) : 'Comercial no encontrado',
        comercialId: comercialIdVisita,
        tipoVisita: tipoVisita,
        tipo: tipoDetalle,
        estado: visita.EstadoVisita || visita.Estado || visita.estado || visita.estadoVisita || 'Pendiente',
        observaciones: visita.Notas || visita.Observaciones || visita.observaciones || visita.notas || '',
        direccion: visita.Direccion || visita.direccion || (cliente ? (cliente.Direccion || cliente.CALLE) : (centroSalud ? (centroSalud.Direccion || centroSalud.CALLE) : '')),
        telefono: visita.Telefono || visita.telefono || (cliente ? (cliente.Telefono || cliente.Telefono_Contacto) : (centroSalud ? (centroSalud.Telefono || centroSalud.Telefono_Contacto) : '')),
        color: obtenerColorComercial(comercialIdVisita, todosLosComerciales.length),
        emoji: obtenerEmojiTipoVisita(tipoVisita)
      };
    });

    // Determinar si se están mostrando todas las visitas por problemas de filtrado
    const mostrarTodasPorDebug = visitas.length === 0 && todasLasVisitas.length > 0;
    
    if (vista === 'calendario') {
      res.render('dashboard/agenda-calendario', {
        title: 'Agenda - Farmadescaso',
        user: req.comercial || req.session.comercial,
        visitas: visitasMapeadas,
        comerciales: todosLosComerciales,
        error: mostrarTodasPorDebug ? '⚠️ Mostrando todas las citas. Algunas pueden no estar asignadas a tu comercial.' : null,
        query: req.query,
        mostrarTodasPorDebug: mostrarTodasPorDebug,
        currentPage: 'agenda'
      });
    } else {
      // Verificar si hay datos de visita creada para mostrar
      const visitaCreadaDatos = req.session.visitaCreadaDatos || null;
      if (req.query.success === 'cita_creada') {
        console.log('📋 [RENDER AGENDA] Mostrando mensaje de éxito de cita creada');
        console.log('📋 [RENDER AGENDA] visitaCreadaDatos disponible?:', !!visitaCreadaDatos);
        if (visitaCreadaDatos) {
          console.log('📋 [RENDER AGENDA] Datos a mostrar:', JSON.stringify(visitaCreadaDatos, null, 2));
        }
      }
      
      res.render('dashboard/agenda', {
        title: 'Agenda - Farmadescaso',
        user: req.comercial || req.session.comercial,
        visitas: visitasMapeadas,
        comerciales: todosLosComerciales,
        error: mostrarTodasPorDebug ? '⚠️ Mostrando todas las citas. Algunas pueden no estar asignadas a tu comercial.' : null,
        query: req.query,
        session: req.session,
        visitaCreadaDatos: visitaCreadaDatos,
        mostrarTodasPorDebug: mostrarTodasPorDebug,
        currentPage: 'agenda'
      });
      
      // Limpiar los datos de la cita creada después de mostrarlos
      if (req.query.success === 'cita_creada' && req.session.visitaCreadaDatos) {
        delete req.session.visitaCreadaDatos;
      }
    }
  } catch (error) {
    console.error('Error cargando visitas:', error);
    res.render('dashboard/agenda', {
      title: 'Agenda - Farmadescaso',
      user: req.comercial || req.session.comercial,
      visitas: [],
      comerciales: [],
      error: 'Error cargando citas: ' + error.message,
      query: req.query,
      session: req.session,
      currentPage: 'agenda'
    });
  }
});

// Función para obtener emoji según tipo de visita
const obtenerEmojiTipoVisita = (tipo) => {
  if (!tipo) return '📅';
  const tipoLower = String(tipo).toLowerCase();
  if (tipoLower.includes('farmacia')) return '💊';
  if (tipoLower.includes('sanitarios') || tipoLower.includes('centro') || tipoLower.includes('salud')) return '🏥';
  if (tipoLower.includes('reunión') || tipoLower.includes('reunion')) return '🤝';
  if (tipoLower.includes('presentación') || tipoLower.includes('presentacion')) return '📢';
  if (tipoLower.includes('seguimiento')) return '👁️';
  if (tipoLower.includes('pedido')) return '🛒';
  if (tipoLower.includes('reclamación') || tipoLower.includes('reclamacion')) return '⚠️';
  if (tipoLower.includes('notas') || tipoLower.includes('otro')) return '📝';
  return '📅'; // Default
};

// Las rutas de confirmación han sido eliminadas - ahora el flujo es directo desde /dashboard/agenda/nuevo

// Ruta GET para mostrar la página de espera mientras N8N procesa la visita
app.get('/dashboard/agenda/procesando', requireAuth, (req, res) => {
  const procesoId = req.query.procesoId;
  const proceso = req.session.visitaProcesando;
  
  if (!procesoId || !proceso || proceso.procesoId !== procesoId) {
    return res.redirect('/dashboard/agenda/nuevo?error=proceso_no_encontrado');
  }
  
  res.render('dashboard/agenda-procesando', {
    title: 'Procesando Cita - Farmadescaso',
    procesoId: procesoId,
    proceso: proceso
  });
});

// Ruta GET para verificar el estado del procesamiento (usado por polling)
app.get('/api/visita/proceso/estado', requireAuth, (req, res) => {
  const procesoId = req.query.procesoId;
  
  if (!procesoId) {
    return res.status(400).json({ error: 'procesoId requerido' });
  }
  
  const proceso = req.session.visitaProcesando;
  
  if (!proceso || proceso.procesoId !== procesoId) {
    return res.status(404).json({ error: 'Proceso no encontrado' });
  }
  
  // Verificar si hay un resultado guardado en el almacenamiento compartido
  // El resultado viene directamente de la respuesta del webhook de N8N (usando "Respond to Webhook")
  let resultado = null;
  if (global.visitaProcesos && global.visitaProcesos[procesoId]) {
    resultado = global.visitaProcesos[procesoId];
    
    // Si hay resultado, actualizar el estado del proceso y marcar como completado
    proceso.estado = resultado.success ? 'completado' : 'error';
    proceso.resultado = resultado;
    proceso.error = resultado.error || null;
    
    // Guardar los datos en la sesión para mostrarlos en el mensaje de éxito
    if (resultado.success && proceso.visitaPendiente) {
      const visitaPendiente = proceso.visitaPendiente;
      const visitaData = JSON.parse(visitaPendiente.visitaData);
      
      req.session.visitaCreadaDatos = {
        tipo_visita: visitaPendiente.tipoVisitaNormalizado,
        fecha: visitaData.Fecha || visitaPendiente.fecha,
        hora: visitaData.Hora || visitaPendiente.hora,
        estado: visitaData.Estado || visitaPendiente.estado,
        direccion: visitaData.Direccion || visitaPendiente.direccion,
        telefono: visitaData.Telefono || visitaPendiente.telefono,
        observaciones: visitaData.Observaciones || visitaPendiente.observaciones,
        centro_salud_id_recibido: visitaPendiente.centroSaludIdNumber,
        centro_salud_id_guardado: visitaPendiente.centroSaludIdNumber || null,
        cliente_id_recibido: visitaPendiente.clienteIdNumber,
        cliente_id_guardado: visitaPendiente.clienteIdNumber || null,
        comercial_id_guardado: visitaPendiente.comercialIdNumber,
        impactos_farmacia: visitaData.ImpactosFarmacia || visitaPendiente.impactos_farmacia || 0,
        impactos_centro_salud: visitaData.ImpactosCentroSalud || visitaPendiente.impactos_centro_salud || 0,
        visita_id_n8n: resultado.visitaId || null,
        procesado_por_n8n: true
      };
      
      // Limpiar la sesión de proceso
      delete req.session.visitaProcesando;
      
      // Limpiar del almacenamiento compartido después de un tiempo (opcional)
      setTimeout(() => {
        if (global.visitaProcesos && global.visitaProcesos[procesoId]) {
          delete global.visitaProcesos[procesoId];
        }
      }, 60000); // Limpiar después de 1 minuto
    }
  }
  
  res.json({
    estado: proceso.estado,
    procesoId: procesoId,
    timestamp: proceso.timestamp,
    resultado: proceso.resultado || null,
    error: proceso.error || null
  });
});

// Ruta GET para recibir el callback de N8N cuando termine de procesar
app.get('/api/webhook/visita/callback', async (req, res) => {
  try {
    const procesoId = req.query.procesoId;
    const success = req.query.success === 'true' || req.query.success === '1';
    const visitaId = req.query.visitaId || null;
    const error = req.query.error || null;
    
    console.log('📥 [WEBHOOK CALLBACK GET] Recibido callback de N8N:');
    console.log('   - Proceso ID:', procesoId);
    console.log('   - Success:', success);
    console.log('   - Visita ID:', visitaId);
    console.log('   - Error:', error);
    
    if (!procesoId) {
      return res.status(400).json({ error: 'procesoId requerido' });
    }
    
    // Guardar el resultado en un almacenamiento compartido
    // NOTA: En producción, deberías usar Redis o una base de datos compartida
    // Por ahora, usamos un objeto en memoria (solo funciona en una instancia del servidor)
    if (!global.visitaProcesos) {
      global.visitaProcesos = {};
    }
    
    global.visitaProcesos[procesoId] = {
      success: success,
      visitaId: visitaId,
      error: error,
      timestamp: new Date().toISOString()
    };
    
    // Responder OK a N8N inmediatamente
    res.json({ 
      ok: true, 
      mensaje: 'Callback recibido correctamente',
      procesoId: procesoId
    });
    
    console.log('✅ [WEBHOOK CALLBACK GET] Respuesta enviada a N8N');
  } catch (error) {
    console.error('❌ [WEBHOOK CALLBACK GET] Error procesando callback:', error);
    res.status(500).json({ error: 'Error procesando callback' });
  }
});

// Ruta POST alternativa para recibir el callback de N8N (por si prefiere POST)
app.post('/api/webhook/visita/callback', async (req, res) => {
  try {
    const { procesoId, success, visitaId, error, datos } = req.body;
    
    console.log('📥 [WEBHOOK CALLBACK POST] Recibido callback de N8N:');
    console.log('   - Proceso ID:', procesoId);
    console.log('   - Success:', success);
    console.log('   - Visita ID:', visitaId);
    console.log('   - Error:', error);
    console.log('   - Datos:', datos ? 'Presentes' : 'No presentes');
    
    if (!procesoId) {
      return res.status(400).json({ error: 'procesoId requerido' });
    }
    
    // Guardar el resultado en un almacenamiento compartido
    // NOTA: En producción, deberías usar Redis o una base de datos compartida
    // Por ahora, usamos un objeto en memoria (solo funciona en una instancia del servidor)
    if (!global.visitaProcesos) {
      global.visitaProcesos = {};
    }
    
    global.visitaProcesos[procesoId] = {
      success: success,
      visitaId: visitaId,
      error: error,
      datos: datos || null,
      timestamp: new Date().toISOString()
    };
    
    console.log('💾 [WEBHOOK CALLBACK POST] Resultado guardado para proceso:', procesoId);
    
    // Responder OK a N8N inmediatamente
    res.json({ 
      ok: true, 
      mensaje: 'Callback recibido correctamente',
      procesoId: procesoId
    });
    
    console.log('✅ [WEBHOOK CALLBACK POST] Respuesta enviada a N8N');
  } catch (error) {
    console.error('❌ [WEBHOOK CALLBACK POST] Error procesando callback:', error);
    res.status(500).json({ error: 'Error procesando callback' });
  }
});

// Gestión de agenda - Crear
app.get('/dashboard/agenda/nuevo', requireAuth, async (req, res) => {
  try {
    const comercialId = req.comercialId || req.session.comercialId;
    // Obtener TODOS los clientes (farmacias) de la tabla, no solo los del comercial
    // Esto permite seleccionar cualquier farmacia para la visita
    const [clientes, comerciales, centrosSalud] = await Promise.all([
      crm.getClientes(), // Cambiado: obtener todos los clientes, no solo los del comercial
      crm.getComerciales(),
      crm.getCentrosSalud() // Ya obtiene todos los centros de salud
    ]);

    console.log('📋 [NUEVA VISITA] Clientes disponibles:', clientes.length);
    console.log('📋 [NUEVA VISITA] Centros de salud disponibles:', centrosSalud.length);
    
    // Función helper para extraer el nombre del centro de salud
    // Según la estructura real: el campo es "NombreCentro"
    const obtenerNombreCentro = (centro) => {
      if (!centro) return 'Centro sin nombre';
      return centro.NombreCentro 
        || centro.nombreCentro
        || centro.Nombre_Centro
        || centro.nombre_centro
        || centro.Nombre
        || centro.nombre
        || 'Centro sin nombre';
    };
    
    // Procesar centros de salud para agregar el nombre extraído
    const centrosSaludProcesados = centrosSalud.map(centro => ({
      ...centro,
      nombreMostrar: obtenerNombreCentro(centro)
    }));
    
    // DEBUG: Ver estructura del primer centro de salud
    if (centrosSalud.length > 0) {
      console.log('🔍 [DEBUG NUEVA VISITA] Primer centro de salud:', JSON.stringify(centrosSalud[0], null, 2));
      console.log('🔍 [DEBUG NUEVA VISITA] Campos del primer centro:', Object.keys(centrosSalud[0]));
      console.log('🔍 [DEBUG NUEVA VISITA] Valor de coqmahyqo5gi3yc:', centrosSalud[0].coqmahyqo5gi3yc);
      console.log('🔍 [DEBUG NUEVA VISITA] Valor de Nombre:', centrosSalud[0].Nombre);
      console.log('🔍 [DEBUG NUEVA VISITA] Valor de nombre:', centrosSalud[0].nombre);
      console.log('🔍 [DEBUG NUEVA VISITA] Nombre extraído:', centrosSaludProcesados[0].nombreMostrar);
    }

    // Obtener el comercial logueado para usarlo como valor por defecto
    const comercialLogueado = req.comercial || req.session.comercial;
    const comercialLogueadoId = req.comercialId || req.session.comercialId;
    
    res.render('dashboard/agenda-nuevo', {
      title: 'Nueva Cita - Farmadescaso',
      user: comercialLogueado,
      clientes,
      comerciales,
      centrosSalud: centrosSaludProcesados,
      currentPage: 'agenda',
      error: null,
      formValues: {
        comercial_id: comercialLogueadoId // Valor por defecto: comercial logueado
      }
    });
  } catch (error) {
    console.error('Error cargando formulario de nueva visita:', error);
    res.render('dashboard/agenda-nuevo', {
      title: 'Nueva Cita - Farmadescaso',
      user: req.comercial || req.session.comercial,
      clientes: [],
      comerciales: [],
      centrosSalud: [],
      currentPage: 'agenda',
      error: 'Error cargando formulario: ' + error.message,
      formValues: {}
    });
  }
});

// Gestión de agenda - Crear (POST)
app.post('/dashboard/agenda/nuevo', requireAuth, async (req, res) => {
  try {
    // LOG DETALLADO DE TODO EL REQUEST
    console.log('🔍 [CREATE VISITA] ========== INICIO REQUEST ==========');
    console.log('🔍 [CREATE VISITA] req.body completo:', JSON.stringify(req.body, null, 2));
    console.log('🔍 [CREATE VISITA] req.body keys:', Object.keys(req.body));
    console.log('🔍 [CREATE VISITA] Content-Type:', req.headers['content-type']);
    
    // Obtener el comercial seleccionado del formulario, o usar el de la sesión como fallback
    const { tipo_visita, cliente_id, centro_salud_id, fecha, hora, tipo_detalle, estado, observaciones, direccion, telefono, enlace_reunion, plataforma_reunion, emails_invitados, comercial_id, impactos_farmacia, impactos_centro_salud } = req.body;
    
    // Verificar si el usuario es administrador para permitir cambiar el comercial
    const user = req.comercial || req.session.comercial || req.user;
    const isAdmin = user && ((user.Roll && user.Roll.toLowerCase() === 'administrador') || (user.roll && user.roll.toLowerCase() === 'administrador'));
    
    // Variables para almacenar los IDs procesados (necesarios para el mensaje de éxito)
    let clienteIdNumber = null;
    let centroSaludIdNumber = null;
    
    // LOG DETALLADO DE LOS CAMPOS EXTRACTOS
    console.log('🔍 [CREATE VISITA] tipo_visita (raw):', tipo_visita);
    console.log('🔍 [CREATE VISITA] tipo_visita (typeof):', typeof tipo_visita);
    console.log('🔍 [CREATE VISITA] centro_salud_id (raw):', centro_salud_id);
    console.log('🔍 [CREATE VISITA] centro_salud_id (typeof):', typeof centro_salud_id);
    console.log('🔍 [CREATE VISITA] cliente_id (raw):', cliente_id);
    console.log('🔍 [CREATE VISITA] comercial_id (raw):', comercial_id);
    console.log('🔍 [CREATE VISITA] impactos_farmacia:', impactos_farmacia);
    console.log('🔍 [CREATE VISITA] impactos_centro_salud:', impactos_centro_salud);
    console.log('🔍 [CREATE VISITA] isAdmin:', isAdmin);
    
    // Usar el comercial_id del formulario si existe y el usuario es admin, sino usar el de la sesión
    const comercialId = (isAdmin && comercial_id) ? comercial_id : (req.comercialId || req.session.comercialId);
    if (!comercialId) {
      throw new Error('No se pudo identificar el comercial. Por favor, selecciona un comercial o inicia sesión nuevamente.');
    }

    // Validar que se proporcione el tipo de visita
    if (!tipo_visita) {
      console.error('❌ [CREATE VISITA] tipo_visita es undefined o vacío');
      throw new Error('El tipo de visita es requerido');
    }

    // Normalizar el tipo de visita: eliminar TODOS los espacios y caracteres invisibles
    // Primero convertir a string y eliminar caracteres no imprimibles
    let tipoVisitaNormalizado = String(tipo_visita || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    
    // Log para debugging ANTES de normalizar
    console.log('🔍 [CREATE VISITA] Tipo de visita recibido (raw):', JSON.stringify(tipo_visita));
    console.log('🔍 [CREATE VISITA] Tipo de visita recibido (type):', typeof tipo_visita);
    console.log('🔍 [CREATE VISITA] Tipo de visita recibido (length):', tipo_visita ? tipo_visita.length : 0);
    if (tipo_visita) {
      console.log('🔍 [CREATE VISITA] Tipo de visita charCodes:', Array.from(tipo_visita).map(c => c.charCodeAt(0)));
    }
    
    // Normalizar: eliminar espacios múltiples, tabs, newlines, etc.
    tipoVisitaNormalizado = tipoVisitaNormalizado.replace(/[\s\t\n\r]+/g, ' ').trim();
    
    // Convertir variantes de "Centro de Salud" o "Centro Salud" a "Sanitarios" si existe
    const tipoLower = tipoVisitaNormalizado.toLowerCase();
    if (tipoLower === 'centro de salud' || tipoLower === 'centro salud' || tipoVisitaNormalizado === 'Centro de Salud' || tipoVisitaNormalizado === 'Centro Salud') {
      tipoVisitaNormalizado = 'Sanitarios';
      console.log('🔄 [CREATE VISITA] Convertido "Centro de Salud"/"Centro Salud" a "Sanitarios"');
    }
    // Convertir "Otro" a "Notas" si existe
    if (tipoLower === 'otro' || tipoVisitaNormalizado === 'Otro') {
      tipoVisitaNormalizado = 'Notas';
      console.log('🔄 [CREATE VISITA] Convertido "Otro" a "Notas"');
    }

    // Log para debugging DESPUÉS de normalizar
    console.log('🔍 [CREATE VISITA] Tipo de visita normalizado (primera pasada):', JSON.stringify(tipoVisitaNormalizado));
    console.log('🔍 [CREATE VISITA] Tipo de visita normalizado (length):', tipoVisitaNormalizado.length);
    console.log('🔍 [CREATE VISITA] Tipo de visita normalizado (charCodes):', Array.from(tipoVisitaNormalizado).map(c => c.charCodeAt(0)));

    // Mapear el tipo normalizado al valor EXACTO que espera NocoDB
    // IMPORTANTE: NocoDB acepta EXACTAMENTE estos valores:
    // "Farmacia", "Sanitarios", "Notas", "Reunión"
    const tiposValidosNocoDB = {
      'farmacia': 'Farmacia',
      'sanitarios': 'Sanitarios',
      'centro salud': 'Sanitarios',
      'centro de salud': 'Sanitarios',
      'notas': 'Notas',
      'otro': 'Notas',
      'reunión': 'Reunión',
      'reunion': 'Reunión'
    };
    
    // Los tipos válidos exactos de NocoDB (definidos como constantes para evitar problemas de referencia)
    const TIPO_FARMACIA = 'Farmacia';
    const TIPO_SANITARIOS = 'Sanitarios';
    const TIPO_REUNION = 'Reunión';
    const TIPO_NOTAS = 'Notas';
    const tiposValidosExactos = [TIPO_FARMACIA, TIPO_SANITARIOS, TIPO_REUNION, TIPO_NOTAS];
    
    // Normalizar una vez más para asegurar que no haya espacios extra
    tipoVisitaNormalizado = String(tipoVisitaNormalizado).replace(/[\s\t\n\r]+/g, ' ').trim();
    
    // Verificación de coincidencia exacta (comparación directa y normalizada)
    const esTipoValidoExacto = tiposValidosExactos.some(tipo => {
      const comparacion = tipo === tipoVisitaNormalizado;
      const comparacionNormalizada = tipo.toLowerCase().trim() === tipoVisitaNormalizado.toLowerCase().trim();
      if (comparacion || comparacionNormalizada) {
        console.log(`✅ [CREATE VISITA] Coincidencia encontrada: "${tipo}" === "${tipoVisitaNormalizado}"`);
        if (!comparacion && comparacionNormalizada) {
          // Si la comparación normalizada coincide pero la exacta no, normalizar el valor
          tipoVisitaNormalizado = tipo;
          console.log(`✅ [CREATE VISITA] Normalizado "${tipoVisitaNormalizado}" a "${tipo}"`);
        }
        return true;
      }
      return false;
    });
    
    if (esTipoValidoExacto) {
      console.log('✅ [CREATE VISITA] Tipo ya es un valor exacto válido:', tipoVisitaNormalizado);
    } else {
      // Si no, mapear usando el diccionario
      const tipoLower = tipoVisitaNormalizado.toLowerCase().trim();
      const tipoValidoNocoDB = tiposValidosNocoDB[tipoLower];
      
      console.log('🔍 [CREATE VISITA] Tipo recibido:', JSON.stringify(tipo_visita));
      console.log('🔍 [CREATE VISITA] Tipo normalizado:', JSON.stringify(tipoVisitaNormalizado));
      console.log('🔍 [CREATE VISITA] Tipo lowercase:', tipoLower);
      console.log('🔍 [CREATE VISITA] Tipo válido en NocoDB:', tipoValidoNocoDB);
      
      if (tipoValidoNocoDB) {
        tipoVisitaNormalizado = tipoValidoNocoDB;
        console.log('✅ [CREATE VISITA] Tipo normalizado a valor exacto de NocoDB:', tipoVisitaNormalizado);
      } else {
        // Si no está en el mapeo, verificar si hay coincidencias parciales
        console.warn('⚠️ [CREATE VISITA] Tipo no encontrado en mapeo de tipos válidos');
        console.warn('⚠️ [CREATE VISITA] Tipo recibido:', JSON.stringify(tipo_visita));
        console.warn('⚠️ [CREATE VISITA] Tipo normalizado:', JSON.stringify(tipoVisitaNormalizado));
        console.warn('⚠️ [CREATE VISITA] Tipo lowercase:', tipoLower);
        
        // Intentar normalizar manualmente si contiene palabras clave
        const tipoLowerParaNormalizacion = tipoVisitaNormalizado.toLowerCase().trim();
        if (tipoLowerParaNormalizacion.includes('centro') && tipoLowerParaNormalizacion.includes('salud')) {
          tipoVisitaNormalizado = TIPO_SANITARIOS;
          console.log('✅ [CREATE VISITA] Tipo normalizado manualmente a "Sanitarios"');
        } else if (tipoLowerParaNormalizacion.includes('farmacia')) {
          tipoVisitaNormalizado = TIPO_FARMACIA;
          console.log('✅ [CREATE VISITA] Tipo normalizado manualmente a "Farmacia"');
        } else if (tipoLowerParaNormalizacion.includes('reunión') || tipoLowerParaNormalizacion.includes('reunion')) {
          tipoVisitaNormalizado = TIPO_REUNION;
          console.log('✅ [CREATE VISITA] Tipo normalizado manualmente a "Reunión"');
        } else if (tipoLowerParaNormalizacion.includes('notas') || tipoLowerParaNormalizacion.includes('otro')) {
          tipoVisitaNormalizado = TIPO_NOTAS;
          console.log('✅ [CREATE VISITA] Tipo normalizado manualmente a "Notas"');
        }
      }
    }
    
    // Verificación final: normalización SIMPLE y directa basada en palabras clave
    // Si contiene las palabras clave, forzar directamente al valor exacto sin más validaciones
    const tipoFinalNormalizado = String(tipoVisitaNormalizado).replace(/[\s\t\n\r]+/g, ' ').trim();
    const tipoFinalLower = tipoFinalNormalizado.toLowerCase();
    
      // Normalización final basada en palabras clave (SIMPLE y DIRECTA)
      if (tipoFinalLower.includes('sanitarios') || (tipoFinalLower.includes('centro') && tipoFinalLower.includes('salud'))) {
        tipoVisitaNormalizado = TIPO_SANITARIOS;
        console.log(`✅ [CREATE VISITA] Forzado directamente a TIPO_SANITARIOS: "${tipoFinalNormalizado}" -> "${tipoVisitaNormalizado}"`);
      } else if (tipoFinalLower.includes('farmacia')) {
        tipoVisitaNormalizado = TIPO_FARMACIA;
        console.log(`✅ [CREATE VISITA] Forzado directamente a TIPO_FARMACIA: "${tipoFinalNormalizado}" -> "${tipoVisitaNormalizado}"`);
      } else if (tipoFinalLower.includes('reunión') || tipoFinalLower.includes('reunion')) {
        tipoVisitaNormalizado = TIPO_REUNION;
        console.log(`✅ [CREATE VISITA] Forzado directamente a TIPO_REUNION: "${tipoFinalNormalizado}" -> "${tipoVisitaNormalizado}"`);
      } else if (tipoFinalLower.includes('notas') || tipoFinalLower.includes('otro')) {
        tipoVisitaNormalizado = TIPO_NOTAS;
        console.log(`✅ [CREATE VISITA] Forzado directamente a TIPO_NOTAS: "${tipoFinalNormalizado}" -> "${tipoVisitaNormalizado}"`);
      }
    
    // En este punto, tipoVisitaNormalizado DEBE ser uno de los tipos válidos exactos
    // porque acabamos de forzarlo directamente usando las constantes
    // Si aún así no está en la lista, forzar directamente usando las constantes SIN lanzar error
    // (esto debería evitar cualquier problema de comparación de strings)
    if (!tiposValidosExactos.includes(tipoVisitaNormalizado)) {
      console.warn('⚠️ [CREATE VISITA] ADVERTENCIA: Tipo no está en lista después de forzar, corrigiendo directamente con constante...');
      console.warn('⚠️ [CREATE VISITA] Valor original:', JSON.stringify(tipo_visita));
      console.warn('⚠️ [CREATE VISITA] Valor normalizado:', JSON.stringify(tipoFinalNormalizado));
      console.warn('⚠️ [CREATE VISITA] Valor tipoVisitaNormalizado antes de corregir:', JSON.stringify(tipoVisitaNormalizado));
      console.warn('⚠️ [CREATE VISITA] TIPO_SANITARIOS:', JSON.stringify(TIPO_SANITARIOS));
      console.warn('⚠️ [CREATE VISITA] tipoVisitaNormalizado === TIPO_SANITARIOS:', tipoVisitaNormalizado === TIPO_SANITARIOS);
      
      // Forzar directamente usando las constantes (no strings)
      if (tipoFinalLower.includes('sanitarios') || (tipoFinalLower.includes('centro') && tipoFinalLower.includes('salud'))) {
        tipoVisitaNormalizado = TIPO_SANITARIOS; // Usar constante directamente
        console.log('✅ [CREATE VISITA] Tipo corregido a TIPO_SANITARIOS (usando constante)');
      } else if (tipoFinalLower.includes('farmacia')) {
        tipoVisitaNormalizado = TIPO_FARMACIA; // Usar constante directamente
        console.log('✅ [CREATE VISITA] Tipo corregido a TIPO_FARMACIA (usando constante)');
      } else if (tipoFinalLower.includes('reunión') || tipoFinalLower.includes('reunion')) {
        tipoVisitaNormalizado = TIPO_REUNION; // Usar constante directamente
        console.log('✅ [CREATE VISITA] Tipo corregido a TIPO_REUNION (usando constante)');
      } else if (tipoFinalLower.includes('notas') || tipoFinalLower.includes('otro')) {
        tipoVisitaNormalizado = TIPO_NOTAS; // Usar constante directamente
        console.log('✅ [CREATE VISITA] Tipo corregido a TIPO_NOTAS (usando constante)');
      } else {
        // Último recurso: usar TIPO_SANITARIOS por defecto
        tipoVisitaNormalizado = TIPO_SANITARIOS; // Usar constante directamente
        console.warn('🔧 [CREATE VISITA] Usando TIPO_SANITARIOS como último recurso (usando constante)');
      }
    }
    
    console.log('✅ [CREATE VISITA] Tipo final validado y normalizado:', JSON.stringify(tipoVisitaNormalizado));

    // Validar que se proporcione fecha
    if (!fecha) {
      throw new Error('La fecha es requerida');
    }

    // Formatear IDs numéricos para relaciones en NocoDB
    const comercialIdNumber = Number(comercialId);
    if (Number.isNaN(comercialIdNumber) || comercialIdNumber <= 0) {
      throw new Error('ID de comercial inválido');
    }

    // Construir objeto de datos de visita con los nombres correctos según estructura real de NocoDB
    // NOTA: TipoVisita NO se asigna aquí, se asignará después de la normalización completa
    // IMPORTANTE: En NocoDB, las relaciones se envían como arrays de objetos con { Id: id }
    const visitaData = {
      Fecha: fecha,
      Hora: hora ? (hora.includes(':') && hora.split(':').length === 2 ? hora + ':00' : hora) : '09:00:00',
      Descripcion: tipo_detalle || tipoVisitaNormalizado || 'General',
      EstadoVisita: estado || 'Pendiente',
      Notas: observaciones || '',
      Comerciales: [{ Id: comercialIdNumber }] // Relación: array con objeto { Id: id }
    };
    
    // TipoVisita se establecerá después de toda la validación, asegurando el valor exacto de NocoDB
    
    // Agregar enlace de reunión si existe (para tipo Reunión)
    if (enlace_reunion && enlace_reunion.trim()) {
      visitaData.EnalaceReunion = enlace_reunion.trim(); // Campo según estructura de NocoDB (con typo)
    }
    
    // Agregar plataforma de reunión si existe (para tipo Reunión)
    if (plataforma_reunion && (plataforma_reunion === 'teams' || plataforma_reunion === 'meet' || plataforma_reunion === 'manual')) {
      visitaData.plataforma_reunion = plataforma_reunion;
    }
    
    // Agregar emails de invitados si existen (para tipo Reunión)
    if (emails_invitados && emails_invitados.trim()) {
      visitaData.emails_invitados = emails_invitados.trim();
    }

    // Agregar FarmaciaCliente o CentroSalud según corresponda (campos directos numéricos)
    // IMPORTANTE: tipoVisitaNormalizado ya fue normalizado y validado arriba
    // Usar comparación directa con los valores exactos de NocoDB
    console.log('🔍 [CREATE VISITA] Procesando tipo normalizado y validado:', tipoVisitaNormalizado);
    console.log('🔍 [CREATE VISITA] tipoVisitaNormalizado === "Sanitarios":', tipoVisitaNormalizado === 'Sanitarios');
    console.log('🔍 [CREATE VISITA] tipoVisitaNormalizado === "Farmacia":', tipoVisitaNormalizado === 'Farmacia');
    console.log('🔍 [CREATE VISITA] tipoVisitaNormalizado === "Reunión":', tipoVisitaNormalizado === 'Reunión');
    console.log('🔍 [CREATE VISITA] tipoVisitaNormalizado === "Notas":', tipoVisitaNormalizado === 'Notas');
    
    // Usar comparación directa con las constantes (el tipo ya está validado y normalizado arriba)
    console.log('🔍 [CREATE VISITA] Antes de procesar tipo:');
    console.log('   - tipoVisitaNormalizado:', JSON.stringify(tipoVisitaNormalizado));
    console.log('   - tipoVisitaNormalizado === TIPO_FARMACIA:', tipoVisitaNormalizado === TIPO_FARMACIA);
    console.log('   - tipoVisitaNormalizado === TIPO_SANITARIOS:', tipoVisitaNormalizado === TIPO_SANITARIOS);
    console.log('   - tipoVisitaNormalizado === TIPO_REUNION:', tipoVisitaNormalizado === TIPO_REUNION);
    console.log('   - tipoVisitaNormalizado === TIPO_NOTAS:', tipoVisitaNormalizado === TIPO_NOTAS);
    
    if (tipoVisitaNormalizado === TIPO_FARMACIA) {
      if (!cliente_id) {
        throw new Error('Debes seleccionar una farmacia para el tipo de visita "Farmacia"');
      }
      clienteIdNumber = Number(cliente_id);
      if (!Number.isNaN(clienteIdNumber) && clienteIdNumber > 0) {
        // NocoDB espera las relaciones Many-to-Many como arrays con objetos [{ Id: id }]
        visitaData.FarmaciaCliente = [{ Id: clienteIdNumber }]; // Relación: array con objeto { Id: id }
        visitaData.CentroSalud = null; // Asegurar que CentroSalud esté vacío para farmacias
        // Campo de impacto comercial para Farmacias
        const impactosFarmaciaValue = Number(impactos_farmacia || '0');
        visitaData.ImpactosFarmacia = isNaN(impactosFarmaciaValue) ? 0 : impactosFarmaciaValue;
        // También mantener compatibilidad con el campo antiguo si existe
        visitaData.cii5t6mnoj9v3uo = visitaData.ImpactosFarmacia;
        visitaData.ImpactosCentroSalud = 0;
        visitaData.cu2rrm8y6uatep9 = 0; // Asegurar que el impacto de Centros de Salud sea 0
        // Asegurar tipo exacto
        tipoVisitaNormalizado = TIPO_FARMACIA;
      } else {
        throw new Error('ID de farmacia inválido');
      }
    } else if (tipoVisitaNormalizado === TIPO_SANITARIOS) {
      // Asegurar que el tipo normalizado sea exactamente TIPO_SANITARIOS
      tipoVisitaNormalizado = TIPO_SANITARIOS;
      console.log('🔍 [CREATE VISITA] Procesando tipo "Sanitarios"');
      console.log('🔍 [CREATE VISITA] tipoVisitaNormalizado confirmado:', tipoVisitaNormalizado);
      console.log('🔍 [CREATE VISITA] centro_salud_id recibido:', centro_salud_id);
      console.log('🔍 [CREATE VISITA] centro_salud_id type:', typeof centro_salud_id);
      console.log('🔍 [CREATE VISITA] centro_salud_id truthy?', !!centro_salud_id);
      console.log('🔍 [CREATE VISITA] req.body completo:', JSON.stringify(req.body, null, 2));
      console.log('🔍 [CREATE VISITA] Todos los campos centro_salud_id posibles:', {
        'req.body.centro_salud_id': req.body.centro_salud_id,
        'centro_salud_id': centro_salud_id,
        'centro_salud_id (string)': String(centro_salud_id || ''),
        'centro_salud_id (number)': Number(centro_salud_id || 0)
      });
      
      if (!centro_salud_id || centro_salud_id === '' || centro_salud_id === '0') {
        console.error('❌ [CREATE VISITA] centro_salud_id está vacío o inválido');
        // Preservar valores del formulario antes de lanzar el error
        const formValues = {
          ...req.body,
          tipo_visita: tipoVisitaNormalizado,
          centro_salud_id: req.body.centro_salud_id !== undefined && req.body.centro_salud_id !== null && req.body.centro_salud_id !== '' ? String(req.body.centro_salud_id) : ''
        };
        const [clientes, comerciales, centrosSalud] = await Promise.all([
          crm.getClientes(),
          crm.getComerciales(),
          crm.getCentrosSalud()
        ]);
        const obtenerNombreCentro = (centro) => {
          if (!centro) return 'Centro sin nombre';
          return centro.NombreCentro || centro.nombreCentro || centro.Nombre || centro.nombre || 'Centro sin nombre';
        };
        const centrosSaludProcesados = centrosSalud.map(centro => ({
          ...centro,
          nombreMostrar: obtenerNombreCentro(centro)
        }));
        return res.render('dashboard/agenda-nuevo', {
          title: 'Nueva Cita - Farmadescaso',
          user: req.comercial || req.session.comercial,
          clientes,
          comerciales,
          centrosSalud: centrosSaludProcesados,
          error: 'Debes seleccionar un centro de salud para el tipo de visita "Sanitarios"',
          formValues: formValues
        });
      }
      
      centroSaludIdNumber = Number(centro_salud_id);
      console.log('🔍 [CREATE VISITA] centroSaludIdNumber convertido:', centroSaludIdNumber);
      console.log('🔍 [CREATE VISITA] ¿Es válido?', !Number.isNaN(centroSaludIdNumber) && centroSaludIdNumber > 0);
      
      if (!Number.isNaN(centroSaludIdNumber) && centroSaludIdNumber > 0) {
        // NocoDB espera las relaciones Many-to-Many como arrays con objetos [{ Id: id }]
        visitaData.CentroSalud = [{ Id: centroSaludIdNumber }]; // Relación: array con objeto { Id: id }
        visitaData.FarmaciaCliente = null; // Asegurar que FarmaciaCliente esté vacío para sanitarios
        // Campo de impacto comercial para Sanitarios
        const impactosCentroSaludValue = Number(impactos_centro_salud || '0');
        visitaData.ImpactosCentroSalud = isNaN(impactosCentroSaludValue) ? 0 : impactosCentroSaludValue;
        // También mantener compatibilidad con el campo antiguo si existe
        visitaData.cu2rrm8y6uatep9 = visitaData.ImpactosCentroSalud;
        visitaData.ImpactosFarmacia = 0;
        visitaData.cii5t6mnoj9v3uo = 0; // Asegurar que el impacto de Farmacias sea 0
        console.log('✅ [CREATE VISITA] Centro de salud asignado correctamente:', centroSaludIdNumber);
        console.log('✅ [CREATE VISITA] Tipo confirmado como "Sanitarios" (valor exacto de NocoDB)');
      } else {
        console.error('❌ [CREATE VISITA] ID de centro de salud inválido:', centro_salud_id, '->', centroSaludIdNumber);
        throw new Error('ID de centro de salud inválido: ' + centro_salud_id);
      }
    } else if (tipoVisitaNormalizado === TIPO_REUNION) {
      // Para Reunión, no se requiere Cliente_id ni Centro_Salud_id
      // El tipo_detalle debe contener la descripción
      if (!tipo_detalle || !tipo_detalle.trim()) {
        throw new Error('La descripción del tipo de visita es requerida para Reunión');
      }
        // Establecer explícitamente como arrays vacíos para evitar confusiones
        visitaData.FarmaciaCliente = null;
        visitaData.CentroSalud = null;
      // Para Reunión, no hay impactos comerciales
      visitaData.ImpactosFarmacia = 0;
      visitaData.ImpactosCentroSalud = 0;
      visitaData.cii5t6mnoj9v3uo = 0;
      visitaData.cu2rrm8y6uatep9 = 0;
      // Asegurar tipo exacto
      tipoVisitaNormalizado = TIPO_REUNION;
      console.log('✅ [CREATE VISITA] Tipo confirmado como "Reunión"');
    } else if (tipoVisitaNormalizado === TIPO_NOTAS) {
      // Para Notas, no se requiere Cliente_id ni Centro_Salud_id
      // El tipo_detalle debe contener la descripción
      if (!tipo_detalle || !tipo_detalle.trim()) {
        throw new Error('La descripción del tipo de visita es requerida para Notas');
      }
        // Establecer explícitamente como arrays vacíos para evitar confusiones
        visitaData.FarmaciaCliente = null;
        visitaData.CentroSalud = null;
      // Para Notas, no hay impactos comerciales
      visitaData.ImpactosFarmacia = 0;
      visitaData.ImpactosCentroSalud = 0;
      visitaData.cii5t6mnoj9v3uo = 0;
      visitaData.cu2rrm8y6uatep9 = 0;
      // Asegurar tipo exacto
      tipoVisitaNormalizado = TIPO_NOTAS;
    } else {
      // Si no reconocemos el tipo, intentar normalizar una vez más basado en palabras clave
      console.warn('⚠️ [CREATE VISITA] Tipo de visita no reconocido en procesamiento, intentando normalizar:');
      console.warn('   - tipoVisitaNormalizado:', JSON.stringify(tipoVisitaNormalizado));
      console.warn('   - tipoVisitaNormalizado type:', typeof tipoVisitaNormalizado);
      console.warn('   - tipoVisitaNormalizado length:', tipoVisitaNormalizado.length);
      console.warn('   - tipoVisitaNormalizado charCodes:', Array.from(tipoVisitaNormalizado).map(c => c.charCodeAt(0)));
      console.warn('   - Comparaciones:');
      console.warn(`     tipoVisitaNormalizado === TIPO_FARMACIA: ${tipoVisitaNormalizado === TIPO_FARMACIA}`);
      console.warn(`     tipoVisitaNormalizado === TIPO_SANITARIOS: ${tipoVisitaNormalizado === TIPO_SANITARIOS}`);
      console.warn(`     tipoVisitaNormalizado === TIPO_REUNION: ${tipoVisitaNormalizado === TIPO_REUNION}`);
      console.warn(`     tipoVisitaNormalizado === TIPO_NOTAS: ${tipoVisitaNormalizado === TIPO_NOTAS}`);
      
      // Último intento de normalización basado en palabras clave
      const tipoLowerUltimo = String(tipoVisitaNormalizado).toLowerCase().trim();
      if (tipoLowerUltimo.includes('sanitarios') || (tipoLowerUltimo.includes('centro') && tipoLowerUltimo.includes('salud'))) {
        tipoVisitaNormalizado = TIPO_SANITARIOS;
        console.log('✅ [CREATE VISITA] Corregido a TIPO_SANITARIOS en último intento');
        // Re-procesar como Sanitarios
        if (!centro_salud_id || centro_salud_id === '' || centro_salud_id === '0') {
          throw new Error('Debes seleccionar un centro de salud para el tipo de visita "Sanitarios"');
        }
        const centroSaludIdNumber = Number(centro_salud_id);
        if (!Number.isNaN(centroSaludIdNumber) && centroSaludIdNumber > 0) {
          visitaData.CentroSalud = { Id: centroSaludIdNumber };
          visitaData.FarmaciaCliente = null;
          const impactosCentroSaludValue2 = Number(impactos_centro_salud || '0');
          visitaData.ImpactosCentroSalud = isNaN(impactosCentroSaludValue2) ? 0 : impactosCentroSaludValue2;
          visitaData.cu2rrm8y6uatep9 = visitaData.ImpactosCentroSalud;
          visitaData.ImpactosFarmacia = 0;
          visitaData.cii5t6mnoj9v3uo = 0;
        } else {
          throw new Error('ID de centro de salud inválido: ' + centro_salud_id);
        }
      } else if (tipoLowerUltimo.includes('farmacia')) {
        tipoVisitaNormalizado = TIPO_FARMACIA;
        console.log('✅ [CREATE VISITA] Corregido a TIPO_FARMACIA en último intento');
        // Re-procesar como Farmacia
        if (!cliente_id) {
          throw new Error('Debes seleccionar una farmacia para el tipo de visita "Farmacia"');
        }
        const clienteIdNumber = Number(cliente_id);
        if (!Number.isNaN(clienteIdNumber) && clienteIdNumber > 0) {
          // En NocoDB, las relaciones se envían como arrays al crear
          visitaData.FarmaciaCliente = [{ Id: clienteIdNumber }]; // Relación: array con objeto { Id: id }
          visitaData.CentroSalud = null; // Asegurar que CentroSalud esté vacío
          const impactosFarmaciaValue2 = Number(impactos_farmacia || '0');
          visitaData.ImpactosFarmacia = isNaN(impactosFarmaciaValue2) ? 0 : impactosFarmaciaValue2;
          visitaData.cii5t6mnoj9v3uo = visitaData.ImpactosFarmacia;
          visitaData.ImpactosCentroSalud = 0;
          visitaData.cu2rrm8y6uatep9 = 0;
        } else {
          throw new Error('ID de farmacia inválido');
        }
      } else if (tipoLowerUltimo.includes('reunión') || tipoLowerUltimo.includes('reunion')) {
        tipoVisitaNormalizado = TIPO_REUNION;
        console.log('✅ [CREATE VISITA] Corregido a TIPO_REUNION en último intento');
        visitaData.FarmaciaCliente = null;
        visitaData.CentroSalud = null;
        visitaData.ImpactosFarmacia = 0;
        visitaData.ImpactosCentroSalud = 0;
        visitaData.cii5t6mnoj9v3uo = 0;
        visitaData.cu2rrm8y6uatep9 = 0;
        if (!tipo_detalle || !tipo_detalle.trim()) {
          throw new Error('La descripción del tipo de visita es requerida para Reunión');
        }
      } else if (tipoLowerUltimo.includes('notas') || tipoLowerUltimo.includes('otro')) {
        tipoVisitaNormalizado = TIPO_NOTAS;
        console.log('✅ [CREATE VISITA] Corregido a TIPO_NOTAS en último intento');
        visitaData.FarmaciaCliente = null;
        visitaData.CentroSalud = null;
        visitaData.ImpactosFarmacia = 0;
        visitaData.ImpactosCentroSalud = 0;
        visitaData.cii5t6mnoj9v3uo = 0;
        visitaData.cu2rrm8y6uatep9 = 0;
        if (!tipo_detalle || !tipo_detalle.trim()) {
          throw new Error('La descripción del tipo de visita es requerida para Notas');
        }
      } else {
        // Si aún no se puede normalizar, forzar como Sanitarios como último recurso
        // (No debería llegar aquí si la normalización funciona correctamente)
        console.warn('⚠️ [CREATE VISITA] No se pudo normalizar el tipo de visita, usando TIPO_SANITARIOS como último recurso');
        console.warn('⚠️ [CREATE VISITA] Valor original:', JSON.stringify(tipo_visita));
        console.warn('⚠️ [CREATE VISITA] Valor normalizado:', JSON.stringify(tipoVisitaNormalizado));
        tipoVisitaNormalizado = TIPO_SANITARIOS;
        // Intentar procesar como Sanitarios si tiene centro_salud_id, sino usar valores por defecto
        if (centro_salud_id && centro_salud_id !== '' && centro_salud_id !== '0') {
          const centroSaludIdNumber = Number(centro_salud_id);
          if (!Number.isNaN(centroSaludIdNumber) && centroSaludIdNumber > 0) {
            // En NocoDB, las relaciones se envían como arrays al crear
            visitaData.CentroSalud = [{ Id: centroSaludIdNumber }]; // Relación: array con objeto { Id: id }
            visitaData.FarmaciaCliente = null; // Asegurar que FarmaciaCliente esté vacío
          const impactosCentroSaludValue3 = Number(impactos_centro_salud || '0');
          visitaData.ImpactosCentroSalud = isNaN(impactosCentroSaludValue3) ? 0 : impactosCentroSaludValue3;
          visitaData.cu2rrm8y6uatep9 = visitaData.ImpactosCentroSalud;
          visitaData.ImpactosFarmacia = 0;
          visitaData.cii5t6mnoj9v3uo = 0;
          }
        } else {
          visitaData.FarmaciaCliente = null;
          visitaData.CentroSalud = 0;
          visitaData.ImpactosFarmacia = 0;
          visitaData.ImpactosCentroSalud = 0;
          visitaData.cii5t6mnoj9v3uo = 0;
          visitaData.cu2rrm8y6uatep9 = 0;
        }
        console.log('✅ [CREATE VISITA] Usando TIPO_SANITARIOS como último recurso');
      }
    }
    
    // Asegurar que TipoVisita tenga el valor EXACTO que espera NocoDB
    // El tipoVisitaNormalizado ya fue normalizado arriba con el mapeo de tipos válidos
    // IMPORTANTE: NocoDB acepta EXACTAMENTE estos valores:
    // "Farmacia", "Sanitarios", "Notas", "Reunión"
    // Usar directamente el valor normalizado (ya debería ser el valor exacto de NocoDB)
    visitaData.TipoVisita = tipoVisitaNormalizado;
    
    console.log('✅ [CREATE VISITA] TipoVisita final que se enviará a NocoDB:', JSON.stringify(visitaData.TipoVisita));
    console.log('✅ [CREATE VISITA] TipoVisita length:', visitaData.TipoVisita.length);
    console.log('✅ [CREATE VISITA] TipoVisita === "Sanitarios":', visitaData.TipoVisita === 'Sanitarios');
    console.log('✅ [CREATE VISITA] TipoVisita === "Farmacia":', visitaData.TipoVisita === 'Farmacia');
    console.log('✅ [CREATE VISITA] TipoVisita === "Reunión":', visitaData.TipoVisita === 'Reunión');
    console.log('✅ [CREATE VISITA] TipoVisita === "Notas":', visitaData.TipoVisita === 'Notas');
    console.log('✅ [CREATE VISITA] TipoVisita charCodes:', Array.from(visitaData.TipoVisita).map(c => c.charCodeAt(0)));

    // Log detallado de todos los datos antes de enviar
    console.log('📝 [CREATE VISITA] Creando visita con datos completos:');
    console.log('📝 [CREATE VISITA] - Fecha:', visitaData.Fecha);
    console.log('📝 [CREATE VISITA] - Hora:', visitaData.Hora);
    console.log('📝 [CREATE VISITA] - TipoVisita:', visitaData.TipoVisita);
    console.log('📝 [CREATE VISITA] - Tipo:', visitaData.Tipo);
    console.log('📝 [CREATE VISITA] - Estado:', visitaData.Estado);
    console.log('📝 [CREATE VISITA] - Observaciones:', visitaData.Observaciones);
    console.log('📝 [CREATE VISITA] - Direccion:', visitaData.Direccion);
    console.log('📝 [CREATE VISITA] - Telefono:', visitaData.Telefono);
    console.log('📝 [CREATE VISITA] - Comercial_id:', JSON.stringify(visitaData.Comercial_id));
    console.log('📝 [CREATE VISITA] - Cliente_id:', JSON.stringify(visitaData.Cliente_id));
    console.log('📝 [CREATE VISITA] - Centro_Salud_id:', JSON.stringify(visitaData.Centro_Salud_id));
    console.log('📝 [CREATE VISITA] - Objeto completo:', JSON.stringify(visitaData, null, 2));
    console.log('👤 [CREATE VISITA] Comercial asignado automáticamente desde sesión:', comercialIdNumber);
    console.log('📝 [CREATE VISITA] - Comerciales:', JSON.stringify(visitaData.Comerciales));
    console.log('📝 [CREATE VISITA] - FarmaciaCliente:', JSON.stringify(visitaData.FarmaciaCliente));
    console.log('📝 [CREATE VISITA] - CentroSalud:', JSON.stringify(visitaData.CentroSalud));
    console.log('📝 [CREATE VISITA] - ImpactosFarmacia:', visitaData.ImpactosFarmacia);
    console.log('📝 [CREATE VISITA] - ImpactosCentroSalud:', visitaData.ImpactosCentroSalud);
    console.log('📝 [CREATE VISITA] - Impacto Farmacias (cii5t6mnoj9v3uo):', visitaData.cii5t6mnoj9v3uo);
    console.log('📝 [CREATE VISITA] - Impacto Centros (cu2rrm8y6uatep9):', visitaData.cu2rrm8y6uatep9);
    
    // PASO 1: VALIDAR Y BUSCAR RELACIONES ANTES DE CREAR
    console.log('🔍 [VALIDATE VISITA] Validando relaciones antes de crear...');
    
    // Buscar las relaciones en NocoDB para verificar que existen
    let relacionCliente = null;
    let relacionCentroSalud = null;
    let relacionComercial = null;
    
    if (clienteIdNumber && clienteIdNumber > 0) {
      relacionCliente = await crm.getClienteById(clienteIdNumber);
      if (!relacionCliente) {
        throw new Error(`No se encontró la farmacia con ID ${clienteIdNumber}. Por favor, verifica que existe.`);
      }
      console.log('✅ [VALIDATE VISITA] Farmacia encontrada:', relacionCliente);
    }
    
    if (centroSaludIdNumber && centroSaludIdNumber > 0) {
      relacionCentroSalud = await crm.getCentroSaludById(centroSaludIdNumber);
      if (!relacionCentroSalud) {
        throw new Error(`No se encontró el centro de salud con ID ${centroSaludIdNumber}. Por favor, verifica que existe.`);
      }
      console.log('✅ [VALIDATE VISITA] Centro de salud encontrado:', relacionCentroSalud);
    }
    
    if (comercialIdNumber && comercialIdNumber > 0) {
      relacionComercial = await crm.getComercialById(comercialIdNumber);
      if (!relacionComercial) {
        throw new Error(`No se encontró el comercial con ID ${comercialIdNumber}. Por favor, verifica que existe.`);
      }
      console.log('✅ [VALIDATE VISITA] Comercial encontrado:', relacionComercial);
    }
    
    console.log('✅ [VALIDATE VISITA] Todas las relaciones validadas. Enviando a N8N...');
    
    // Generar ID único para esta operación
    const procesoId = `visita_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // URL del webhook de N8N (configurable mediante base de datos o variable de entorno)
    let n8nWebhookUrl = await crm.getConfiguracionValor('n8n_webhook_url', '');
    if (!n8nWebhookUrl) {
      n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || '';
    }
    
    if (!n8nWebhookUrl) {
      console.error('❌ [CREATE VISITA] No se ha configurado el webhook de N8N');
      // Si no hay webhook configurado, intentar crear directamente como antes
      console.log('⚠️ [CREATE VISITA] N8N webhook no configurado, creando visita directamente...');
      const visitaCreada = await crm.createVisita(visitaData);
      console.log('✅ [CREATE VISITA] Visita creada exitosamente:', visitaCreada);
      
      const datosGuardados = {
        tipo_visita: tipoVisitaNormalizado,
        fecha: visitaData.Fecha || fecha,
        hora: visitaData.Hora || hora,
        estado: visitaData.Estado || estado,
        direccion: visitaData.Direccion || direccion,
        telefono: visitaData.Telefono || telefono,
        observaciones: visitaData.Observaciones || observaciones,
        centro_salud_id_recibido: centroSaludIdNumber,
        centro_salud_id_guardado: centroSaludIdNumber || null,
        cliente_id_recibido: clienteIdNumber,
        cliente_id_guardado: clienteIdNumber || null,
        comercial_id_guardado: comercialIdNumber,
        impactos_farmacia: visitaData.ImpactosFarmacia || impactos_farmacia || 0,
        impactos_centro_salud: visitaData.ImpactosCentroSalud || impactos_centro_salud || 0,
        CentroSalud_enviado: JSON.stringify(visitaData.CentroSalud),
        FarmaciaCliente_enviado: JSON.stringify(visitaData.FarmaciaCliente),
        Comerciales_enviado: JSON.stringify(visitaData.Comerciales),
        payload_final_enviado: visitaCreada._payloadFinal ? JSON.stringify(visitaCreada._payloadFinal, null, 2) : 'N/A',
        column_ids_usados: visitaCreada._columnIds ? JSON.stringify(visitaCreada._columnIds, null, 2) : 'N/A',
        relaciones_extraidas: visitaCreada._relacionesExtraidas ? JSON.stringify(visitaCreada._relacionesExtraidas, null, 2) : 'N/A',
        relaciones_intentos: visitaCreada._relacionesIntentos ? JSON.stringify(visitaCreada._relacionesIntentos, null, 2) : 'N/A',
        columnas_relacion_meta: visitaCreada._columnasRelacionMeta ? JSON.stringify(visitaCreada._columnasRelacionMeta, null, 2) : 'N/A',
        visita_completa: JSON.stringify(visitaCreada, null, 2),
        payload_completo: JSON.stringify(visitaData, null, 2),
        relacionCliente: relacionCliente,
        relacionCentroSalud: relacionCentroSalud,
        relacionComercial: relacionComercial
      };
      
      req.session.visitaCreadaDatos = datosGuardados;
      return res.redirect('/dashboard/agenda?success=cita_creada');
    }
    
    // URL del callback para que N8N nos notifique cuando termine
    const callbackUrl = `${getCanonicalOrigin()}/api/webhook/visita/callback?procesoId=${procesoId}`;
    
    // Preparar datos para enviar al webhook de N8N
    const webhookPayload = {
      procesoId: procesoId,
      callbackUrl: callbackUrl,
      visitaData: visitaData,
      relaciones: {
        CentroSalud: centroSaludIdNumber ? {
          id: centroSaludIdNumber,
          data: relacionCentroSalud
        } : null,
        FarmaciaCliente: clienteIdNumber ? {
          id: clienteIdNumber,
          data: relacionCliente
        } : null,
        Comerciales: comercialIdNumber ? {
          id: comercialIdNumber,
          data: relacionComercial
        } : null
      },
      columnIds: {
        centroSalud: 'c73w3ocj1ec9p2q',
        farmaciaCliente: 'cymchdg11gko49n',
        comerciales: 'cwr81mq8p4glwgu'
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 [CREATE VISITA] Enviando webhook a N8N:', n8nWebhookUrl);
    console.log('📤 [CREATE VISITA] Proceso ID:', procesoId);
    console.log('📤 [CREATE VISITA] Callback URL:', callbackUrl);
    
    // Guardar el estado del proceso en la sesión antes de enviar
    req.session.visitaProcesando = {
      procesoId: procesoId,
      estado: 'procesando',
      timestamp: new Date().toISOString(),
      visitaPendiente: {
        visitaData: JSON.stringify(visitaData),
        tipoVisitaNormalizado: tipoVisitaNormalizado,
        relacionCliente: relacionCliente ? JSON.stringify(relacionCliente) : null,
        relacionCentroSalud: relacionCentroSalud ? JSON.stringify(relacionCentroSalud) : null,
        relacionComercial: relacionComercial ? JSON.stringify(relacionComercial) : null,
        clienteIdNumber: clienteIdNumber,
        centroSaludIdNumber: centroSaludIdNumber,
        comercialIdNumber: comercialIdNumber,
        fecha: fecha,
        hora: hora,
        estado: estado,
        observaciones: observaciones,
        direccion: direccion,
        telefono: telefono,
        enlace_reunion: enlace_reunion,
        impactos_farmacia: impactos_farmacia,
        impactos_centro_salud: impactos_centro_salud
      }
    };
    
    // Guardar también los datos de la visita pendiente
    req.session[`visita_${procesoId}`] = {
      visitaPendiente: {
        visitaData: JSON.stringify(visitaData),
        tipoVisitaNormalizado: tipoVisitaNormalizado,
        relacionCliente: relacionCliente ? JSON.stringify(relacionCliente) : null,
        relacionCentroSalud: relacionCentroSalud ? JSON.stringify(relacionCentroSalud) : null,
        relacionComercial: relacionComercial ? JSON.stringify(relacionComercial) : null,
        clienteIdNumber: clienteIdNumber,
        centroSaludIdNumber: centroSaludIdNumber,
        comercialIdNumber: comercialIdNumber,
        fecha: fecha,
        hora: hora,
        estado: estado,
        observaciones: observaciones,
        direccion: direccion,
        telefono: telefono,
        enlace_reunion: enlace_reunion,
        impactos_farmacia: impactos_farmacia,
        impactos_centro_salud: impactos_centro_salud
      },
      visitaData: visitaData
    };
    
    // Redirigir a la página de espera inmediatamente (el procesamiento es asíncrono)
    res.redirect(`/dashboard/agenda/procesando?procesoId=${procesoId}`);
    
    // Obtener headers de autenticación si están configurados
    const authHeaderKey = await crm.getConfiguracionValor('n8n_webhook_auth_header_key', '');
    const authHeaderValue = await crm.getConfiguracionValor('n8n_webhook_auth_header_value', '');
    
    // Preparar headers
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Añadir header de autenticación si está configurado
    if (authHeaderKey && authHeaderValue) {
      headers[authHeaderKey] = authHeaderValue;
      console.log(`🔐 [CREATE VISITA] Usando autenticación header: ${authHeaderKey}`);
    }
    
    // Enviar POST al webhook de N8N y procesar la respuesta
    // N8N usa "Respond to Webhook" que devuelve directamente la respuesta cuando termina
    fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(webhookPayload)
    }).then(async (webhookResponse) => {
      const responseText = await webhookResponse.text();
      console.log('📨 [CREATE VISITA] Respuesta del webhook N8N:', webhookResponse.status, responseText);
      
      if (!webhookResponse.ok) {
        console.error('❌ [CREATE VISITA] Error al enviar webhook a N8N:', webhookResponse.status, responseText);
        
        // Guardar error en el almacenamiento compartido
        if (!global.visitaProcesos) {
          global.visitaProcesos = {};
        }
        global.visitaProcesos[procesoId] = {
          success: false,
          visitaId: null,
          error: `Error HTTP ${webhookResponse.status}: ${responseText}`,
          timestamp: new Date().toISOString()
        };
        return;
      }
      
      // Parsear la respuesta de N8N
      try {
        const n8nResponse = JSON.parse(responseText);
        console.log('✅ [CREATE VISITA] Respuesta parseada de N8N:', JSON.stringify(n8nResponse, null, 2));
        
        // N8N devuelve: { "ok": true, "mensaje": "...", "procesoId": "..." }
        // El procesoId en la respuesta debe coincidir con el que enviamos
        const responseProcesoId = n8nResponse.procesoId || procesoId;
        const success = n8nResponse.ok === true || n8nResponse.success === true;
        const visitaId = n8nResponse.visitaId || n8nResponse.visita_id || null;
        const error = n8nResponse.error || null;
        
        // Guardar el resultado en el almacenamiento compartido
        if (!global.visitaProcesos) {
          global.visitaProcesos = {};
        }
        global.visitaProcesos[responseProcesoId] = {
          success: success,
          visitaId: visitaId,
          error: error,
          n8nResponse: n8nResponse,
          timestamp: new Date().toISOString()
        };
        
        console.log('💾 [CREATE VISITA] Resultado guardado para proceso:', responseProcesoId);
        console.log('   - Success:', success);
        console.log('   - Visita ID:', visitaId);
        console.log('   - Error:', error);
        
        // Si el procesoId de la respuesta es diferente, también guardar con el original
        if (responseProcesoId !== procesoId) {
          global.visitaProcesos[procesoId] = global.visitaProcesos[responseProcesoId];
        }
        
      } catch (parseError) {
        console.error('❌ [CREATE VISITA] Error al parsear respuesta de N8N:', parseError.message);
        console.error('❌ [CREATE VISITA] Respuesta recibida:', responseText);
        
        // Guardar error de parsing
        if (!global.visitaProcesos) {
          global.visitaProcesos = {};
        }
        global.visitaProcesos[procesoId] = {
          success: false,
          visitaId: null,
          error: `Error al parsear respuesta: ${parseError.message}`,
          timestamp: new Date().toISOString()
        };
      }
    }).catch((webhookError) => {
      console.error('❌ [CREATE VISITA] Error al enviar webhook a N8N:', webhookError.message);
      
      // Guardar error de conexión
      if (!global.visitaProcesos) {
        global.visitaProcesos = {};
      }
      global.visitaProcesos[procesoId] = {
        success: false,
        visitaId: null,
        error: `Error de conexión: ${webhookError.message}`,
        timestamp: new Date().toISOString()
      };
    });
  } catch (error) {
    // Información detallada del error
    const errorLine = error.stack ? error.stack.split('\n')[1]?.trim() : 'N/A';
    const errorFileName = errorLine.match(/([^\/\\]+\.js):(\d+):(\d+)/)?.[1] || 'N/A';
    const errorLineNumber = errorLine.match(/([^\/\\]+\.js):(\d+):(\d+)/)?.[2] || 'N/A';
    const errorColumnNumber = errorLine.match(/([^\/\\]+\.js):(\d+):(\d+)/)?.[3] || 'N/A';
    
    console.error('❌ [CREATE VISITA] ========== ERROR DETALLADO ==========');
    console.error('❌ [CREATE VISITA] Error creando visita:', error);
    console.error('❌ [CREATE VISITA] Error message:', error.message);
    console.error('❌ [CREATE VISITA] Error stack:', error.stack);
    console.error('❌ [CREATE VISITA] Archivo:', errorFileName);
    console.error('❌ [CREATE VISITA] Línea:', errorLineNumber);
    console.error('❌ [CREATE VISITA] Columna:', errorColumnNumber);
    console.error('❌ [CREATE VISITA] Ubicación completa:', errorLine);
    
    // Información del estado en el momento del error
    console.error('❌ [CREATE VISITA] Estado de variables en el momento del error:');
    try {
      console.error('   - tipo_visita (original):', JSON.stringify(req.body.tipo_visita));
      console.error('   - tipo_visita (type):', typeof req.body.tipo_visita);
      console.error('   - tipo_visita (length):', req.body.tipo_visita ? req.body.tipo_visita.length : 'N/A');
      if (typeof tipoVisitaNormalizado !== 'undefined') {
        console.error('   - tipoVisitaNormalizado:', JSON.stringify(tipoVisitaNormalizado));
        console.error('   - tipoVisitaNormalizado (type):', typeof tipoVisitaNormalizado);
        console.error('   - tipoVisitaNormalizado (length):', tipoVisitaNormalizado ? tipoVisitaNormalizado.length : 'N/A');
        console.error('   - tipoVisitaNormalizado === TIPO_SANITARIOS:', tipoVisitaNormalizado === TIPO_SANITARIOS);
        console.error('   - tipoVisitaNormalizado === "Sanitarios":', tipoVisitaNormalizado === 'Sanitarios');
        console.error('   - TIPO_SANITARIOS:', JSON.stringify(TIPO_SANITARIOS));
        console.error('   - tiposValidosExactos.includes(tipoVisitaNormalizado):', tiposValidosExactos ? tiposValidosExactos.includes(tipoVisitaNormalizado) : 'N/A');
      } else {
        console.error('   - tipoVisitaNormalizado: NO DEFINIDO (error antes de normalización)');
      }
      console.error('   - centro_salud_id:', JSON.stringify(req.body.centro_salud_id));
      console.error('   - cliente_id:', JSON.stringify(req.body.cliente_id));
      console.error('   - comercial_id:', JSON.stringify(req.body.comercial_id));
    } catch (e) {
      console.error('   - Error obteniendo estado de variables:', e.message);
    }
    
    // Determinar si el error viene de NocoDB
    const errorMessage = error.message || error.toString();
    const isNocoDBError = errorMessage.includes('Invalid option') || 
                         errorMessage.includes('NocoDB') || 
                         errorMessage.includes('HTTP') ||
                         error.statusCode ||
                         error.errorDetails;
    
    if (isNocoDBError) {
      console.error('❌ [CREATE VISITA] Error detectado como error de NocoDB');
      console.error('❌ [CREATE VISITA] Error statusCode:', error.statusCode);
      console.error('❌ [CREATE VISITA] Error errorDetails:', error.errorDetails);
      console.error('❌ [CREATE VISITA] Error payload:', error.payload);
      console.error('❌ [CREATE VISITA] Error originalMessage:', error.originalMessage);
      
      // Si el error viene de NocoDB y está relacionado con TipoVisita, añadir información detallada
      if (errorMessage.includes('TipoVisita') || errorMessage.includes('Tipo de visita') || errorMessage.includes('Invalid option')) {
        if (error.payload && error.payload.TipoVisita) {
          console.error('❌ [CREATE VISITA] TipoVisita que se intentó enviar:', JSON.stringify(error.payload.TipoVisita));
          console.error('❌ [CREATE VISITA] TipoVisita charCodes:', Array.from(error.payload.TipoVisita).map(c => c.charCodeAt(0)));
        }
      }
    }
    
    console.error('❌ [CREATE VISITA] =========================================');
    
    const comercialId = req.comercialId || req.session.comercialId;
    // Obtener TODOS los clientes (farmacias) de la tabla, no solo los del comercial
    const [clientes, comerciales, centrosSalud] = await Promise.all([
      crm.getClientes(), // Cambiado: obtener todos los clientes, no solo los del comercial
      crm.getComerciales(),
      crm.getCentrosSalud() // Ya obtiene todos los centros de salud
    ]);
    
    // Preservar los valores del formulario, especialmente centro_salud_id
    // Asegurar que los valores numéricos se preserven correctamente
    const formValues = {
      ...req.body,
      tipo_visita: req.body.tipo_visita || '',
      // Preservar centro_salud_id como está (puede ser string numérico)
      centro_salud_id: req.body.centro_salud_id !== undefined && req.body.centro_salud_id !== null && req.body.centro_salud_id !== '' ? String(req.body.centro_salud_id) : '',
      cliente_id: req.body.cliente_id !== undefined && req.body.cliente_id !== null && req.body.cliente_id !== '' ? String(req.body.cliente_id) : '',
      comercial_id: req.body.comercial_id !== undefined && req.body.comercial_id !== null && req.body.comercial_id !== '' ? String(req.body.comercial_id) : ''
    };
    
    console.log('🔍 [CREATE VISITA] Preservando valores del formulario:', JSON.stringify(formValues, null, 2));
    console.log('🔍 [CREATE VISITA] centro_salud_id preservado:', formValues.centro_salud_id, '(type:', typeof formValues.centro_salud_id + ')');
    
    // Construir mensaje de error detallado
    let errorDisplayMessage = 'Error creando visita: ' + errorMessage;
    
    // Añadir información adicional si el error está relacionado con tipo de visita
    if (errorMessage.includes('Tipo de visita') || errorMessage.includes('tipo de visita') || errorMessage.includes('TipoVisita') || errorMessage.includes('Invalid option')) {
      const additionalInfo = [];
      
      if (errorLineNumber !== 'N/A') {
        additionalInfo.push(`Línea de código: ${errorLineNumber} (archivo: ${errorFileName})`);
      }
      
      if (error.statusCode) {
        additionalInfo.push(`Código HTTP: ${error.statusCode}`);
      }
      
      if (error.errorDetails) {
        additionalInfo.push(`Detalles del error: ${JSON.stringify(error.errorDetails)}`);
      }
      
      // Información del valor que se intentó enviar
      if (error.payload && error.payload.TipoVisita) {
        const tipoEnviado = error.payload.TipoVisita;
        additionalInfo.push(`TipoVisita enviado a NocoDB: "${tipoEnviado}"`);
        additionalInfo.push(`Tipo (datatype): ${typeof tipoEnviado}`);
        additionalInfo.push(`Longitud: ${tipoEnviado.length}`);
        const charCodes = Array.from(tipoEnviado).map(c => c.charCodeAt(0));
        additionalInfo.push(`CharCodes: [${charCodes.join(', ')}]`);
      }
      
      // Información del valor recibido del formulario
      if (typeof tipoVisitaNormalizado !== 'undefined') {
        additionalInfo.push(`Valor recibido del formulario: "${req.body.tipo_visita || 'N/A'}"`);
        additionalInfo.push(`Valor normalizado en servidor: "${tipoVisitaNormalizado}"`);
        if (tiposValidosExactos) {
          additionalInfo.push(`Valores válidos esperados: ${tiposValidosExactos.join(', ')}`);
          additionalInfo.push(`¿Está en lista de válidos?: ${tiposValidosExactos.includes(tipoVisitaNormalizado)}`);
          
          // Comparaciones detalladas
          tiposValidosExactos.forEach(tipo => {
            const esIgual = tipo === tipoVisitaNormalizado;
            const tipoCharCodes = Array.from(tipo).map(c => c.charCodeAt(0));
            const normalizadoCharCodes = Array.from(tipoVisitaNormalizado).map(c => c.charCodeAt(0));
            additionalInfo.push(`Comparación "${tipo}" === "${tipoVisitaNormalizado}": ${esIgual ? '✓ IGUAL' : '✗ DIFERENTE'}`);
            if (!esIgual) {
              additionalInfo.push(`  - "${tipo}" charCodes: [${tipoCharCodes.join(', ')}]`);
              additionalInfo.push(`  - "${tipoVisitaNormalizado}" charCodes: [${normalizadoCharCodes.join(', ')}]`);
            }
          });
        }
      }
      
      if (additionalInfo.length > 0) {
        errorDisplayMessage += '\n\n═══════════════════════════════════════════════════════';
        errorDisplayMessage += '\nINFORMACIÓN DE DEPURACIÓN:';
        errorDisplayMessage += '\n═══════════════════════════════════════════════════════\n';
        additionalInfo.forEach(info => {
          errorDisplayMessage += '  • ' + info + '\n';
        });
        errorDisplayMessage += '\n═══════════════════════════════════════════════════════';
        errorDisplayMessage += '\nRevisa la consola del servidor para más detalles técnicos.';
        errorDisplayMessage += '\n═══════════════════════════════════════════════════════';
      }
    }
    
    res.render('dashboard/agenda-nuevo', {
      title: 'Nueva Cita - Farmadescaso',
      user: req.comercial || req.session.comercial,
      clientes,
      comerciales,
      centrosSalud,
      error: errorDisplayMessage,
      currentPage: 'agenda',
      formValues: formValues
    });
  }
});

// Gestión de agenda - Detalle
app.get('/dashboard/agenda/:id', requireAuth, async (req, res) => {
  try {
    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    const visitaId = req.params.id;
    const visita = await crm.getVisitaById(visitaId);

    if (!visita) {
      return res.status(404).render('error', {
        error: 'Visita no encontrada',
        message: 'La visita que buscas no existe'
      });
    }
    
    // Si no es admin, verificar que la visita pertenezca al comercial autenticado
    if (!esAdmin && comercialIdAutenticado) {
      const visitaComercialId = visita.Id_Cial || visita.id_cial || visita.ComercialId || visita.comercialId || 
                                 visita.Comercial_id || visita.comercial_id || visita.Comerciales;
      if (Number(visitaComercialId) !== Number(comercialIdAutenticado)) {
        return res.status(403).render('error', {
          error: 'Acceso denegado',
          message: 'No tienes permiso para ver esta visita.'
        });
      }
    }

    // Función helper para extraer ID de referencia
    const extraerIdDeReferencia = (ref) => {
      // Si es null o undefined, retornar null
      if (!ref) return null;
      
      // Si es un array (formato NocoDB para relaciones)
      if (Array.isArray(ref)) {
        if (ref.length === 0) return null;
        // El primer elemento puede ser un objeto con Id o un número directo
        const first = ref[0];
        if (typeof first === 'object' && first !== null) {
          // Buscar Id o id en el objeto
          return first.Id || first.id || null;
        }
        // Si es un número directo
        return typeof first === 'number' ? first : Number(first) || null;
      }
      
      // Si es un objeto (relación expandida de NocoDB)
      if (typeof ref === 'object' && ref !== null) {
        return ref.Id || ref.id || null;
      }
      
      // Si es un número o string que representa un número
      if (typeof ref === 'number') return ref;
      if (typeof ref === 'string') {
        const num = Number(ref);
        return isNaN(num) ? null : num;
      }
      
      return null;
    };

    // Obtener información relacionada
    // Usar los nombres correctos de campos según la estructura real de NocoDB
    const comercialRef = visita.Comerciales !== undefined ? visita.Comerciales : 
                        (visita._nc_m2m_Visitas_Comerciales && Array.isArray(visita._nc_m2m_Visitas_Comerciales) && visita._nc_m2m_Visitas_Comerciales.length > 0 ? 
                          visita._nc_m2m_Visitas_Comerciales[0]?.Comerciales_id : null) ||
                        visita.Comercial_id || visita.comercial_id || visita.Comercial_Id || visita.comercial_Id;
    
    // IMPORTANTE: Según la estructura real de NocoDB, FarmaciaCliente es un campo numérico directo
    // También buscar en relaciones Many-to-Many por si acaso
    let clienteRef = null;
    if (visita.FarmaciaCliente !== undefined && visita.FarmaciaCliente !== null && visita.FarmaciaCliente !== 0) {
      clienteRef = visita.FarmaciaCliente;
    } else if (visita._nc_m2m_Visitas_Clientes && Array.isArray(visita._nc_m2m_Visitas_Clientes) && visita._nc_m2m_Visitas_Clientes.length > 0) {
      clienteRef = visita._nc_m2m_Visitas_Clientes[0]?.Clientes_id || visita._nc_m2m_Visitas_Clientes[0]?.Cliente_id || null;
    } else if (visita.Cliente_id !== undefined) {
      clienteRef = visita.Cliente_id;
    } else if (visita.cliente_id !== undefined) {
      clienteRef = visita.cliente_id;
    } else if (visita.Cliente_Id !== undefined) {
      clienteRef = visita.Cliente_Id;
    } else if (visita.cliente_Id !== undefined) {
      clienteRef = visita.cliente_Id;
    }
    
    const centroRef = visita.CentroSalud !== undefined ? visita.CentroSalud :
                      visita.Centro_Salud_id !== undefined ? visita.Centro_Salud_id :
                      visita.centro_salud_id !== undefined ? visita.centro_salud_id :
                      visita.Centro_Salud_Id !== undefined ? visita.Centro_Salud_Id :
                      visita.centro_Salud_Id !== undefined ? visita.centro_Salud_Id : null;
    
    let comercial = null;
    let cliente = null;
    let centroSalud = null;

    // Extraer IDs - pueden venir como arrays, objetos o números
    const comercialIdFromRef = comercialRef !== null && comercialRef !== undefined 
      ? (typeof comercialRef === 'number' ? comercialRef : extraerIdDeReferencia(comercialRef))
      : null;
    if (comercialIdFromRef) {
      comercial = await crm.getComercialById(comercialIdFromRef);
    }

    // FarmaciaCliente es un número directo en NocoDB
    const clienteIdFromRef = clienteRef !== null && clienteRef !== undefined && clienteRef !== 0 
      ? (typeof clienteRef === 'number' ? clienteRef : extraerIdDeReferencia(clienteRef))
      : null;
    console.log('🔍 [VISITA DETALLE] ClienteRef:', JSON.stringify(clienteRef), '-> ClienteIdFromRef:', clienteIdFromRef, '(type:', typeof clienteRef + ')');
    if (clienteIdFromRef && clienteIdFromRef > 0) {
      cliente = await crm.getClienteById(clienteIdFromRef);
      if (!cliente) {
        console.warn(`⚠️ [VISITA DETALLE] Cliente no encontrado con ID: ${clienteIdFromRef}`);
      } else {
        console.log(`✅ [VISITA DETALLE] Cliente encontrado:`, cliente.Nombre || cliente.nombre);
      }
    } else {
      if (clienteRef === 0 || clienteRef === null || clienteRef === undefined) {
        console.log('ℹ️ [VISITA DETALLE] FarmaciaCliente es 0/null/undefined (visita sin cliente asignado)');
      } else {
        console.warn('⚠️ [VISITA DETALLE] ClienteRef existe pero clienteIdFromRef es inválido:', clienteRef);
        console.log('⚠️ [VISITA DETALLE] Campos de la visita:', Object.keys(visita));
        console.log('⚠️ [VISITA DETALLE] FarmaciaCliente:', JSON.stringify(visita.FarmaciaCliente));
        console.log('⚠️ [VISITA DETALLE] _nc_m2m_Visitas_Clientes:', JSON.stringify(visita._nc_m2m_Visitas_Clientes));
      }
    }

    const centroIdFromRef = centroRef !== null && centroRef !== undefined 
      ? (typeof centroRef === 'number' ? centroRef : extraerIdDeReferencia(centroRef))
      : null;
    if (centroIdFromRef) {
      centroSalud = await crm.getCentroSaludById(centroIdFromRef);
    }

    const tipoVisita = visita.TipoVisita || visita.tipoVisita || visita.Tipo_Visita || visita.tipo_visita || 'Farmacia';

    res.render('dashboard/agenda-detalle', {
      title: 'Detalle de Cita - Farmadescaso',
      user: req.comercial || req.session.comercial,
      visita,
      comercial,
      cliente,
      currentPage: 'agenda',
      centroSalud,
      tipoVisita,
      emoji: obtenerEmojiTipoVisita(tipoVisita),
      error: null,
      query: req.query
    });
  } catch (error) {
    console.error('Error cargando visita:', error);
    res.status(500).render('error', {
      error: 'Error cargando visita',
      message: error.message
    });
  }
});

// Gestión de agenda - Editar
app.get('/dashboard/agenda/:id/editar', requireAuth, async (req, res) => {
  // Validar acceso antes de cargar datos
  try {
    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    const visitaId = req.params.id;
    const visita = await crm.getVisitaById(visitaId);
    
    if (!visita) {
      return res.status(404).render('error', {
        error: 'Visita no encontrada',
        message: 'La visita que buscas no existe'
      });
    }
    
    // Si no es admin, verificar que la visita pertenezca al comercial autenticado
    if (!esAdmin && comercialIdAutenticado) {
      const visitaComercialId = visita.Id_Cial || visita.id_cial || visita.ComercialId || visita.comercialId || 
                                 visita.Comercial_id || visita.comercial_id || visita.Comerciales;
      if (Number(visitaComercialId) !== Number(comercialIdAutenticado)) {
        return res.status(403).render('error', {
          error: 'Acceso denegado',
          message: 'No tienes permiso para editar esta visita.'
        });
      }
    }
  } catch (error) {
    console.error('Error validando acceso a visita:', error);
    return res.status(500).render('error', { error: 'Error', message: 'No se pudo validar el acceso' });
  }
  
  // Continuar con la lógica original
  try {
    const visitaId = req.params.id;
    const comercialId = req.comercialId || req.session.comercialId;
    // Obtener TODOS los clientes (farmacias) de la tabla, no solo los del comercial
    const [visita, clientes, comerciales, centrosSalud] = await Promise.all([
      crm.getVisitaById(visitaId),
      crm.getClientes(), // Cambiado: obtener todos los clientes, no solo los del comercial
      crm.getComerciales(),
      crm.getCentrosSalud() // Ya obtiene todos los centros de salud
    ]);

    if (!visita) {
      return res.status(404).render('error', {
        error: 'Visita no encontrada',
        message: 'La visita que buscas no existe'
      });
    }

    // Función helper para extraer el nombre del centro de salud
    // Según la estructura real: el campo es "NombreCentro"
    const obtenerNombreCentro = (centro) => {
      if (!centro) return 'Centro sin nombre';
      return centro.NombreCentro 
        || centro.nombreCentro
        || centro.Nombre_Centro
        || centro.nombre_centro
        || centro.Nombre
        || centro.nombre
        || 'Centro sin nombre';
    };
    
    // Procesar centros de salud para agregar el nombre extraído
    const centrosSaludProcesados = centrosSalud.map(centro => ({
      ...centro,
      nombreMostrar: obtenerNombreCentro(centro)
    }));

    res.render('dashboard/agenda-editar', {
      title: 'Editar Cita - Farmadescaso',
      user: req.comercial || req.session.comercial,
      visita,
      clientes,
      comerciales,
      currentPage: 'agenda',
      centrosSalud: centrosSaludProcesados,
      error: null,
      formValues: visita
    });
  } catch (error) {
    console.error('Error cargando formulario de edición:', error);
    res.status(500).render('error', {
      error: 'Error cargando formulario',
      message: error.message
    });
  }
});

// Gestión de agenda - Editar (POST)
app.post('/dashboard/agenda/:id/editar', requireAuth, async (req, res) => {
  try {
    const visitaId = req.params.id;
    
    // Obtener el comercial seleccionado del formulario, o usar el de la sesión como fallback
    const { tipo_visita, cliente_id, centro_salud_id, fecha, hora, tipo_detalle, estado, observaciones, direccion, telefono, enlace_reunion, comercial_id, impactos_farmacia, impactos_centro_salud } = req.body;
    
    // Verificar si el usuario es administrador para permitir cambiar el comercial
    const user = req.comercial || req.session.comercial || req.user;
    const isAdmin = user && ((user.Roll && user.Roll.toLowerCase() === 'administrador') || (user.roll && user.roll.toLowerCase() === 'administrador'));
    
    // Usar el comercial_id del formulario si existe y el usuario es admin, sino usar el de la sesión
    const comercialId = (isAdmin && comercial_id) ? comercial_id : (req.comercialId || req.session.comercialId);
    if (!comercialId) {
      throw new Error('No se pudo identificar el comercial. Por favor, selecciona un comercial o inicia sesión nuevamente.');
    }

    // Validar que se proporcione el tipo de visita
    if (!tipo_visita) {
      throw new Error('El tipo de visita es requerido');
    }

    // Normalizar el tipo de visita: trim espacios y convertir valores antiguos
    let tipoVisitaNormalizado = String(tipo_visita).trim();
    // Convertir "Centro de Salud" o "Centro Salud" a "Sanitarios" si existe
    const tipoLower = tipoVisitaNormalizado.toLowerCase();
    if (tipoLower === 'centro de salud' || tipoLower === 'centro salud' || tipoVisitaNormalizado === 'Centro de Salud' || tipoVisitaNormalizado === 'Centro Salud') {
      tipoVisitaNormalizado = 'Sanitarios';
    }
    // Convertir "Otro" a "Notas" si existe
    if (tipoVisitaNormalizado === 'Otro' || tipoLower === 'otro') {
      tipoVisitaNormalizado = 'Notas';
    }

    // Validar que el tipo de visita normalizado sea válido
    const tiposValidos = ['Farmacia', 'Sanitarios', 'Reunión', 'Notas'];
    if (!tiposValidos.includes(tipoVisitaNormalizado)) {
      console.error('❌ [UPDATE VISITA] Tipo de visita no válido. Recibido:', JSON.stringify(tipo_visita), 'Normalizado:', JSON.stringify(tipoVisitaNormalizado));
      throw new Error('Tipo de visita no válido: "' + tipo_visita + '". Valores válidos: ' + tiposValidos.join(', '));
    }

    // Validar que se proporcione fecha
    if (!fecha) {
      throw new Error('La fecha es requerida');
    }

    // Formatear ID de comercial numérico para relaciones en NocoDB
    const comercialIdNumber = Number(comercialId);
    if (Number.isNaN(comercialIdNumber) || comercialIdNumber <= 0) {
      throw new Error('ID de comercial inválido');
    }

    // IMPORTANTE: En NocoDB, las relaciones se envían como arrays de objetos con { Id: id }
    const visitaData = {
      Fecha: fecha,
      Hora: hora ? (hora.includes(':') && hora.split(':').length === 2 ? hora + ':00' : hora) : '09:00:00',
      TipoVisita: tipoVisitaNormalizado, // Usar el tipo normalizado
      Descripcion: tipo_detalle || tipoVisitaNormalizado || 'General',
      EstadoVisita: estado || 'Pendiente',
      Notas: observaciones || '',
      Comerciales: [{ Id: comercialIdNumber }] // Relación: array con objeto { Id: id }
    };
    
    // Agregar enlace de reunión si existe (para tipo Reunión)
    if (enlace_reunion && enlace_reunion.trim()) {
      visitaData.EnalaceReunion = enlace_reunion.trim(); // Campo según estructura de NocoDB (con typo)
    }

    // Agregar FarmaciaCliente o CentroSalud según corresponda (relaciones como arrays)
    // Usar el tipo normalizado para las comparaciones
    if (tipoVisitaNormalizado === 'Farmacia' && cliente_id) {
      const clienteIdNumber = Number(cliente_id);
      if (!Number.isNaN(clienteIdNumber) && clienteIdNumber > 0) {
        // En NocoDB, FarmaciaCliente es un campo numérico directo
        // En NocoDB, las relaciones se envían como arrays al crear/editar
        visitaData.FarmaciaCliente = { Id: clienteIdNumber }; // Relación: objeto con Id
        // Limpiar centro de salud si cambió a farmacia
        visitaData.CentroSalud = null;
        // Campo de impacto comercial para Farmacias
        const impactosFarmaciaValue = Number(impactos_farmacia || '0');
        visitaData.ImpactosFarmacia = isNaN(impactosFarmaciaValue) ? 0 : impactosFarmaciaValue;
        visitaData.cii5t6mnoj9v3uo = visitaData.ImpactosFarmacia; // Compatibilidad
        visitaData.ImpactosCentroSalud = 0;
        visitaData.cu2rrm8y6uatep9 = 0; // Asegurar que el impacto de Centros de Salud sea 0
      } else {
        throw new Error('ID de farmacia inválido');
      }
    } else if (tipoVisitaNormalizado === 'Sanitarios' && centro_salud_id) {
      const centroSaludIdNumber = Number(centro_salud_id);
      if (!Number.isNaN(centroSaludIdNumber) && centroSaludIdNumber > 0) {
        // En NocoDB, las relaciones se envían como arrays al crear
            visitaData.CentroSalud = [{ Id: centroSaludIdNumber }]; // Relación: array con objeto { Id: id }
        // Limpiar cliente si cambió a sanitarios
        visitaData.FarmaciaCliente = null;
        // Campo de impacto comercial para Sanitarios
        const impactosCentroSaludValue = Number(impactos_centro_salud || '0');
        visitaData.ImpactosCentroSalud = isNaN(impactosCentroSaludValue) ? 0 : impactosCentroSaludValue;
        visitaData.cu2rrm8y6uatep9 = visitaData.ImpactosCentroSalud; // Compatibilidad
        visitaData.ImpactosFarmacia = 0;
        visitaData.cii5t6mnoj9v3uo = 0; // Asegurar que el impacto de Farmacias sea 0
      } else {
        throw new Error('ID de centro de salud inválido');
      }
    } else if (tipoVisitaNormalizado === 'Reunión' || tipoVisitaNormalizado === 'Notas') {
      // Para Reunión y Notas, limpiar ambas relaciones
      visitaData.FarmaciaCliente = 0;
      visitaData.CentroSalud = 0;
      // Para Reunión y Notas, no hay impactos comerciales
      visitaData.cii5t6mnoj9v3uo = 0;
      visitaData.cu2rrm8y6uatep9 = 0;
      // Validar que se proporcione tipo_detalle
      if (!tipo_detalle || !tipo_detalle.trim()) {
        throw new Error('La descripción del tipo de visita es requerida para ' + tipoVisitaNormalizado);
      }
    } else {
      throw new Error('Tipo de visita no válido o falta información requerida. Valores válidos: Farmacia, Sanitarios, Reunión, Notas');
    }

    console.log('📝 [UPDATE VISITA] Actualizando visita con datos:', JSON.stringify(visitaData, null, 2));
    console.log('👤 [UPDATE VISITA] Comercial asignado automáticamente desde sesión:', comercialIdNumber);
    console.log('📝 [UPDATE VISITA] - Impacto Farmacias (cii5t6mnoj9v3uo):', visitaData.cii5t6mnoj9v3uo);
    console.log('📝 [UPDATE VISITA] - Impacto Centros (cu2rrm8y6uatep9):', visitaData.cu2rrm8y6uatep9);
    await crm.updateVisita(visitaId, visitaData);
    res.redirect(`/dashboard/agenda/${visitaId}?success=cita_actualizada`);
  } catch (error) {
    console.error('❌ [UPDATE VISITA] Error actualizando visita:', error);
    const comercialId = req.comercialId || req.session.comercialId;
    // Obtener TODOS los clientes (farmacias) de la tabla, no solo los del comercial
    const [visita, clientes, comerciales, centrosSalud] = await Promise.all([
      crm.getVisitaById(visitaId),
      crm.getClientes(), // Cambiado: obtener todos los clientes, no solo los del comercial
      crm.getComerciales(),
      crm.getCentrosSalud() // Ya obtiene todos los centros de salud
    ]);
    res.render('dashboard/agenda-editar', {
      title: 'Editar Cita - Farmadescaso',
      user: req.comercial || req.session.comercial,
      visita,
      clientes,
      comerciales,
      currentPage: 'agenda',
      centrosSalud,
      error: 'Error actualizando visita: ' + error.message,
      formValues: req.body
    });
  }
});

// Gestión de agenda - Eliminar
app.post('/dashboard/agenda/:id/eliminar', requireAuth, async (req, res) => {
  try {
    const visitaId = req.params.id;
    await crm.deleteVisita(visitaId);
    res.redirect('/dashboard/agenda?success=cita_eliminada');
  } catch (error) {
    console.error('Error eliminando visita:', error);
    res.redirect(`/dashboard/agenda/${visitaId}?error=error_eliminando`);
  }
});

// API para generar enlace de Google Meet
// Endpoint para generar reunión de Google Meet
app.post('/api/visitas/generar-meet', requireAuth, async (req, res) => {
  try {
    if (!MEETING_INTEGRATIONS_ENABLED) {
      return res.status(410).json({
        success: false,
        disabled: true,
        error: 'Integración de reuniones desactivada',
        meetUrl: 'https://meet.google.com/new',
        message: 'La generación automática está desactivada. Puedes crear una reunión manualmente en meet.google.com.'
      });
    }
    const { fecha, hora, titulo, duracionMinutos, emailsInvitados } = req.body;
    const comercialId = req.comercialId || req.session.comercialId;
    
    if (!comercialId) {
      return res.status(401).json({
        success: false,
        error: 'No se pudo identificar el comercial'
      });
    }

    const meetReuniones = require('./utils/reuniones-meet');
    
    try {
      // Procesar emailsInvitados: puede venir como string separado por comas
      let emailsArray = [];
      if (emailsInvitados) {
        if (typeof emailsInvitados === 'string') {
          emailsArray = emailsInvitados.split(/[,\n]/).map(e => e.trim()).filter(e => e);
        } else if (Array.isArray(emailsInvitados)) {
          emailsArray = emailsInvitados;
        }
      }

      const resultado = await meetReuniones.generarReunion(comercialId, {
        titulo: titulo || 'Reunión',
        fecha,
        hora: hora || '09:00',
        duracionMinutos: duracionMinutos || 60,
        emailsInvitados: emailsArray
      });

      res.json({
        success: true,
        meetUrl: resultado.joinUrl,
        meetingId: resultado.meetingId,
        titulo: resultado.titulo,
        fechaInicio: resultado.fechaInicio,
        fechaFin: resultado.fechaFin,
        message: 'Reunión de Google Meet generada exitosamente'
      });
    } catch (error) {
      console.log('❌ [GENERAR-MEET] Error capturado:', error.message);
      
      // Si falla por falta de credenciales, devolver mensaje útil con enlace al perfil
      if (error.message.includes('No hay credenciales') || 
          error.message.includes('configuradas') || 
          error.message.includes('OAuth2 no están configuradas') ||
          error.message.includes('No hay credenciales de Google Meet')) {
        const perfilUrl = `/dashboard/comerciales/${comercialId}/editar`;
        console.log('❌ [GENERAR-MEET] Credenciales no configuradas, devolviendo error 400 con mensaje útil');
        return res.status(400).json({
          success: false,
          error: error.message,
          meetUrl: 'https://meet.google.com/new',
          perfilUrl: perfilUrl,
          message: `Para generar reuniones automáticamente, necesitas conectar tu cuenta de Google. <a href="${perfilUrl}" target="_blank">Haz clic aquí para configurar tu cuenta de Google Meet</a>. Mientras tanto, puedes usar <a href="https://meet.google.com/new" target="_blank">este enlace</a> para crear una reunión manualmente.`
        });
      }
      
      console.error('❌ Error generando reunión de Meet:', error);
      console.error('❌ Stack trace:', error.stack);
      
      // Mensaje de error más específico
      let errorMessage = 'Error generando reunión de Google Meet';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response && error.response.data) {
        errorMessage = JSON.stringify(error.response.data);
      }
      
      res.status(500).json({
        success: false,
        error: errorMessage,
        meetUrl: 'https://meet.google.com/new',
        message: 'No se pudo generar la reunión automáticamente. Puedes crear una reunión manualmente en meet.google.com'
      });
      }
  } catch (error) {
    console.error('Error en endpoint generar-meet:', error);
    res.status(500).json({
      success: false,
      error: 'Error generando enlace de Meet',
      meetUrl: 'https://meet.google.com/new'
    });
  }
});

// Endpoint para generar reunión de Microsoft Teams
app.post('/api/visitas/generar-teams', requireAuth, async (req, res) => {
  try {
    if (!MEETING_INTEGRATIONS_ENABLED) {
      return res.status(410).json({
        success: false,
        disabled: true,
        error: 'Integración de reuniones desactivada',
        teamsUrl: null,
        message: 'La generación automática está desactivada. Crea la reunión manualmente en Microsoft Teams.'
      });
    }
    const { fecha, hora, titulo, duracionMinutos, emailsInvitados } = req.body;
    const comercialId = req.comercialId || req.session.comercialId;
    
    if (!comercialId) {
      return res.status(401).json({
        success: false,
        error: 'No se pudo identificar el comercial'
      });
    }

    const teamsReuniones = require('./utils/reuniones-teams');
    
    try {
      const resultado = await teamsReuniones.generarReunion(comercialId, {
        titulo: titulo || 'Reunión',
        fecha,
        hora: hora || '09:00',
        duracionMinutos: duracionMinutos || 60,
        emailsInvitados: emailsInvitados || ''
      });

      res.json({
        success: true,
        teamsUrl: resultado.joinUrl,
        meetingId: resultado.meetingId,
        titulo: resultado.titulo,
        fechaInicio: resultado.fechaInicio,
        fechaFin: resultado.fechaFin,
        message: 'Reunión de Microsoft Teams generada exitosamente'
      });
    } catch (error) {
      // Si falla por falta de credenciales, devolver mensaje útil
      if (error.message.includes('No hay credenciales') || error.message.includes('configuradas')) {
        return res.status(400).json({
          success: false,
          error: error.message,
          teamsUrl: null,
          message: 'Por favor, configura tu cuenta de Microsoft Teams en tu perfil.'
        });
      }
      
      console.error('Error generando reunión de Teams:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error generando reunión de Microsoft Teams',
        teamsUrl: null,
        message: 'No se pudo generar la reunión automáticamente. Por favor, crea la reunión manualmente en Teams.'
      });
    }
  } catch (error) {
    console.error('Error en endpoint generar-teams:', error);
    res.status(500).json({
      success: false,
      error: 'Error generando reunión de Teams'
    });
  }
});

app.get('/api/articulos', requireAuth, async (req, res) => {
  try {
    const articulos = await crm.getArticulos();
    res.json({ success: true, data: articulos, count: articulos.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// API REST con Swagger Documentation
// ============================================

// Configurar Swagger UI (solo admin autenticado)
app.use('/api-docs', requireAuth, requireAdmin, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Farmadescaso CRM API Documentation'
}));

// Endpoint para obtener el contador actualizado de clientes (ANTES de otras rutas API para evitar conflictos)
app.get('/api/clientes/count', async (req, res) => {
  try {
    // Verificar autenticación de forma opcional - si no hay autenticación, devolver 0
    const isAuthenticated = (req.user && req.comercialId) || (req.session && req.session.comercialId);
    
    if (!isAuthenticated) {
      // Si no está autenticado, devolver 0 en lugar de error para evitar problemas en el frontend
      return res.json({ count: 0, totalClientes: 0 });
    }

    // Por rol: admin => total; comercial => solo asignados (Id_Cial)
    const count = await obtenerTotalClientesPorRol(crm, req);
    res.json({ count: count, totalClientes: count });
  } catch (error) {
    console.error('Error obteniendo contador de clientes:', error);
    res.status(500).json({ error: 'Error al obtener contador', count: 0 });
  }
});

// ============================================
// DIAGNÓSTICO (solo autenticados)
// ============================================
// Nota: estos endpoints ayudan a confirmar si Vercel está apuntando a la BD correcta
// y si el buscador de clientes está detectando columnas/filtros.
app.get('/api/_diag/db', requireAuth, async (req, res) => {
  try {
    const rows = await crm.query('SELECT DATABASE() AS db').catch(() => []);
    const db = rows?.[0]?.db || null;
    const dbNameCfg = crm?.config?.database || process.env.DB_NAME || null;
    const isVercel = Boolean(process.env.VERCEL);
    return res.json({
      success: true,
      data: {
        database: db,
        dbNameCfg,
        isVercel,
        nodeEnv: process.env.NODE_ENV || null
      }
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'diag_failed', details: String(e?.message || '').slice(0, 200) });
  }
});

app.get('/api/_diag/clientes-buscar', requireAuth, async (req, res) => {
  try {
    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);

    // Conteo real en BD
    const totalRows = await crm.query('SELECT COUNT(*) AS c FROM clientes').catch(() => []);
    const totalClientes = Number(totalRows?.[0]?.c || 0);

    // Columnas existentes (si SHOW COLUMNS falla, aquí lo veremos)
    const colsRows = await crm.query('SHOW COLUMNS FROM clientes').catch(() => []);
    const cols = (colsRows || []).map(r => r.Field).filter(Boolean);

    // Probar búsqueda mínima contra BD (sin filtros) para ver si devuelve algo
    const q = (req.query.q || 'joa').toString();
    const like = `%${q}%`;
    const sample = await crm.query(
      `SELECT id, Id_Cial, Nombre_Razon_Social, DNI_CIF, Email, OK_KO
       FROM clientes
       WHERE Nombre_Razon_Social LIKE ? OR Nombre_Cial LIKE ? OR DNI_CIF LIKE ? OR Email LIKE ?
       LIMIT 5`,
      [like, like, like, like]
    ).catch(() => []);

    return res.json({
      success: true,
      data: {
        esAdmin,
        comercialIdAutenticado,
        totalClientes,
        columnasClientesCount: cols.length,
        columnasClientes: cols.slice(0, 50),
        sampleCount: sample.length,
        sample
      }
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'diag_failed', details: String(e?.message || '').slice(0, 250) });
  }
});

// Endpoint para obtener clientes por código postal - DEBE IR ANTES DE /api/clientes
console.log('✅ [RUTAS] Registrando GET /api/clientes/codigo-postal/:idCodigoPostal');
app.get('/api/clientes/codigo-postal/:idCodigoPostal', requireAuth, async (req, res) => {
  try {
    console.log('✅ [API-CLIENTES-CP] Endpoint accedido:', req.path);
    console.log('✅ [API-CLIENTES-CP] Parámetros:', req.params);
    
    const idCodigoPostal = parseInt(req.params.idCodigoPostal);
    
    console.log('✅ [API-CLIENTES-CP] ID código postal parseado:', idCodigoPostal);
    
    if (!idCodigoPostal || isNaN(idCodigoPostal)) {
      console.error('❌ [API-CLIENTES-CP] ID inválido');
      return res.status(400).json({ 
        success: false, 
        error: 'ID de código postal inválido' 
      });
    }

    console.log('✅ [API-CLIENTES-CP] Llamando a getClientesByCodigoPostal...');
    const clientes = await crm.getClientesByCodigoPostal(idCodigoPostal);
    console.log('✅ [API-CLIENTES-CP] Clientes obtenidos:', clientes ? clientes.length : 0);
    
    // Asegurar que el Content-Type sea application/json
    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      clientes: clientes || [],
      total: clientes ? clientes.length : 0
    });
  } catch (error) {
    console.error('❌ [API-CLIENTES-CP] Error obteniendo clientes por código postal:', error);
    console.error('❌ [API-CLIENTES-CP] Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      clientes: []
    });
  }
});

// ============================================
// API: Resolver CP -> Provincia/País/Idioma/Moneda (para auto-relleno en cliente-editar)
// ============================================
app.get('/api/codigos-postales/resolve', requireAuth, async (req, res) => {
  try {
    const raw = String(req.query.cp || '').trim();
    const cp = raw.replace(/[^0-9]/g, '');
    if (!cp || cp.length < 4) {
      return res.status(400).json({ success: false, error: 'Código postal inválido' });
    }

    const { detectarPais } = require('./scripts/asociar-provincia-por-codigo-postal');
    const paisIso = detectarPais(cp) || 'ES';

    // Provincias: para ES/PT resolvemos por prefijo/código.
    const provincias = await crm.getProvincias(paisIso).catch(() => []);
    let provincia = null;
    if (paisIso === 'ES' && cp.length >= 2) {
      const pref = cp.slice(0, 2);
      const codeNum = Number(pref);
      // Match robusto: id==codeNum OR Codigo==codeNum OR Codigo=='XX'
      provincia = (provincias || []).find(p => Number(p.id || p.Id) === codeNum)
        || (provincias || []).find(p => Number(p.Codigo) === codeNum)
        || (provincias || []).find(p => String(p.Codigo || '').padStart(2, '0') === pref);
    } else if (paisIso === 'PT') {
      // Para PT la función necesita provinciasDB con "Codigo" tipo PTxx
      const { obtenerCodigoProvinciaPortugal } = require('./scripts/asociar-provincia-por-codigo-postal');
      const cod = obtenerCodigoProvinciaPortugal(cp);
      if (cod) provincia = (provincias || []).find(p => String(p.Codigo || '').trim() === String(cod).trim()) || null;
    }

    const pais = await crm.getPaisByCodigoISO(paisIso).catch(() => null);

    // Idioma/Moneda por defecto por país (mínimo viable)
    const idiomaPorPais = {
      ES: 'Español',
      PT: 'Portugués'
    };
    const monedaPorPais = {
      ES: 'Euro',
      PT: 'Euro'
    };

    const idiomaNombre = idiomaPorPais[paisIso] || null;
    const monedaNombre = monedaPorPais[paisIso] || 'Euro';

    const idiomaRow = idiomaNombre
      ? await crm.query('SELECT id, Nombre FROM idiomas WHERE LOWER(Nombre) = LOWER(?) LIMIT 1', [idiomaNombre]).catch(() => [])
      : [];
    const monedaRow = monedaNombre
      ? await crm.query('SELECT id, Nombre FROM monedas WHERE LOWER(Nombre) = LOWER(?) LIMIT 1', [monedaNombre]).catch(() => [])
      : [];

    const idiomaId = idiomaRow?.[0]?.id || null;
    const monedaId = monedaRow?.[0]?.id || null;

    return res.json({
      success: true,
      data: {
        cp,
        paisIso,
        paisId: pais ? (pais.id || pais.Id) : null,
        paisNombre: pais ? (pais.Nombre_pais || pais.Nombre || null) : null,
        provinciaId: provincia ? (provincia.id || provincia.Id) : null,
        provinciaNombre: provincia ? (provincia.Nombre || provincia.nombre || null) : null,
        idiomaId,
        monedaId
      }
    });
  } catch (error) {
    console.error('❌ [CP RESOLVE] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Error resolviendo código postal' });
  }
});

// API: Clientes paginados para "cargar más" en /dashboard/clientes (scroll/botón)
// Nota: debe ir ANTES de GET /api/clientes (legacy) para no entrar en conflictos futuros.
app.get('/api/clientes/paged', requireAuth, async (req, res) => {
  try {
    const comercialIdAutenticado = getComercialId(req);
    const esAdmin = getUserIsAdmin(req);
    
    const limit = Math.min(200, Math.max(10, parseInt(req.query.limit || '50', 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
    
    // Filtros en query (mismos que /dashboard/clientes)
    const filtersForQuery = {};
    const tipoCliente = req.query.tipoCliente !== undefined && req.query.tipoCliente !== null && String(req.query.tipoCliente).trim() !== ''
      ? Number(req.query.tipoCliente)
      : null;
    const provincia = req.query.provincia !== undefined && req.query.provincia !== null && String(req.query.provincia).trim() !== ''
      ? Number(req.query.provincia)
      : null;
    const conVentas = req.query.conVentas !== undefined && req.query.conVentas !== null && String(req.query.conVentas).trim() !== ''
      ? req.query.conVentas
      : undefined;
    // Nuevo: estadoCliente (catálogo). Compatibilidad legacy: estado=activos/inactivos/todos
    const estadoClienteRaw = req.query.estadoCliente !== undefined && req.query.estadoCliente !== null && String(req.query.estadoCliente).trim() !== ''
      ? Number(req.query.estadoCliente)
      : null;
    const estadoLegacy = req.query.estado ? String(req.query.estado).trim().toLowerCase() : null;
    const comercialFiltro = req.query.comercial !== undefined && req.query.comercial !== null && String(req.query.comercial).trim() !== ''
      ? Number(req.query.comercial)
      : null;
    
    if (Number.isFinite(tipoCliente) && tipoCliente > 0) filtersForQuery.tipoCliente = tipoCliente;
    if (Number.isFinite(provincia) && provincia > 0) filtersForQuery.provincia = provincia;
    if (conVentas !== undefined) filtersForQuery.conVentas = conVentas;
    if (Number.isFinite(estadoClienteRaw) && estadoClienteRaw > 0) {
      filtersForQuery.estadoCliente = estadoClienteRaw;
    } else if (estadoLegacy === 'activos') {
      filtersForQuery.estadoCliente = 2;
    } else if (estadoLegacy === 'inactivos') {
      filtersForQuery.estadoCliente = 3;
    }
    
    // No-admin: siempre restringir al comercial autenticado
    if (!esAdmin && comercialIdAutenticado) {
      const comId = Number(comercialIdAutenticado);
      if (Number.isFinite(comId) && comId > 0) {
        filtersForQuery.comercial = comId;
        // Regla de visibilidad: comercial ve sus clientes + pool (1)
        filtersForQuery.comercialIncludePool = true;
      }
    } else if (esAdmin && Number.isFinite(comercialFiltro) && comercialFiltro > 0) {
      filtersForQuery.comercial = comercialFiltro;
    }
    
    const clientes = await crm.getClientesOptimizadoPaged(filtersForQuery, { limit, offset });
    const totalFiltrados = await crm.countClientesOptimizado(filtersForQuery);
    
    res.json({
      success: true,
      clientes: (clientes || []).map(c => normalizeObjectUTF8(c)),
      totalFiltrados,
      offset,
      limit,
      hasMore: offset + (clientes?.length || 0) < (totalFiltrados || 0)
    });
  } catch (error) {
    console.error('❌ [API CLIENTES PAGED] Error:', error);
    res.status(500).json({ success: false, error: error.message, clientes: [] });
  }
});

app.get('/api/clientes', requireAuth, async (req, res) => {
  try {
    const comercialId = req.session.comercialId;
    const clientes = await crm.getClientesByComercial(comercialId);
    res.json({ success: true, data: clientes, count: clientes.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/pedidos', requireAuth, async (req, res) => {
  try {
    const estado = (req.query.estado || 'todos').toLowerCase();
    const pedidos = await crm.getPedidos();
    const filtrados = pedidos.filter(p => {
      const estadoActual = (p.Estado || p.estado || '').toLowerCase();
      if (estado === 'activos') {
        return estadoActual !== 'inactivo';
      }
      if (estado === 'inactivos') {
        return estadoActual === 'inactivo';
      }
      return true;
    });
    res.json({ success: true, data: filtrados, count: filtrados.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/visitas', requireAuth, async (req, res) => {
  try {
    const comercialId = req.comercialId || req.session.comercialId;
    const visitas = await crm.getVisitasByComercial(comercialId);
    res.json({ success: true, data: visitas, count: visitas.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// API CONTACTOS (persona global) + vínculo con clientes (historial)
// ============================================

// Listado de contactos (búsqueda opcional)
app.get('/api/contactos', requireAuth, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const includeInactivos = String(req.query.includeInactivos || '').toLowerCase() === 'true' || String(req.query.includeInactivos || '') === '1';
    const limit = Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 50;
    const offset = Number.isFinite(Number(req.query.offset)) ? Number(req.query.offset) : 0;

    const contactos = await crm.getContactos({ search, includeInactivos, limit, offset });
    res.json({ success: true, data: contactos, count: contactos.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Crear contacto (persona)
app.post('/api/contactos', requireAuth, async (req, res) => {
  try {
    const result = await crm.createContacto(req.body || {});
    res.status(201).json({ success: true, data: { id: result.insertId }, message: 'Contacto creado exitosamente' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Detalle de contacto
app.get('/api/contactos/:id', requireAuth, async (req, res) => {
  try {
    const contacto = await crm.getContactoById(req.params.id);
    if (!contacto) return res.status(404).json({ success: false, error: 'Contacto no encontrado' });
    res.json({ success: true, data: contacto });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar contacto
app.put('/api/contactos/:id', requireAuth, async (req, res) => {
  try {
    const r = await crm.updateContacto(req.params.id, req.body || {});
    res.json({ success: true, affectedRows: r.affectedRows || 0 });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Listar contactos de un cliente
app.get('/api/clientes/:id/contactos', requireAuth, async (req, res) => {
  try {
    const includeHistorico = String(req.query.includeHistorico || '').toLowerCase() === 'true' || String(req.query.includeHistorico || '') === '1';
    const rows = await crm.getContactosByCliente(req.params.id, { includeHistorico });
    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Vincular contacto existente a un cliente (crea relación activa o actualiza la activa)
app.post('/api/clientes/:id/contactos/:contactoId', requireAuth, async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const contactoId = Number(req.params.contactoId);
    if (!Number.isFinite(clienteId) || clienteId <= 0) throw new Error('clienteId inválido');
    if (!Number.isFinite(contactoId) || contactoId <= 0) throw new Error('contactoId inválido');

    const r = await crm.vincularContactoACliente(clienteId, contactoId, req.body || {});
    res.status(201).json({ success: true, data: r });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Cerrar vínculo activo (histórico: pone VigenteHasta)
app.delete('/api/clientes/:id/contactos/:contactoId', requireAuth, async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const contactoId = Number(req.params.contactoId);
    if (!Number.isFinite(clienteId) || clienteId <= 0) throw new Error('clienteId inválido');
    if (!Number.isFinite(contactoId) || contactoId <= 0) throw new Error('contactoId inválido');

    const r = await crm.cerrarVinculoContactoCliente(clienteId, contactoId, req.body || {});
    res.json({ success: true, affectedRows: r.affectedRows || 0 });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/estadisticas', requireAuth, async (req, res) => {
  try {
    const comercialId = req.session.comercialId;
    const estadisticas = await crm.getEstadisticasComercial(comercialId);
    res.json({ success: true, data: estadisticas });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('═══════════════════════════════════════════════════════════');
  console.error('❌ [MIDDLEWARE ERROR] Error capturado por middleware global:');
  console.error('❌ [MIDDLEWARE ERROR] Path:', req.path);
  console.error('❌ [MIDDLEWARE ERROR] Mensaje:', err.message);
  console.error('❌ [MIDDLEWARE ERROR] Stack:', err.stack);
  console.error('═══════════════════════════════════════════════════════════');
  
  // Si la respuesta ya fue enviada, no intentar enviar otra
  if (res.headersSent) {
    console.error('⚠️ [MIDDLEWARE ERROR] Headers ya enviados, no se puede enviar respuesta');
    return next(err);
  }
  
  // SIEMPRE mostrar detalles para rentabilidad-pedidos, incluso si falla el render
  if (req.path.includes('rentabilidad-pedidos')) {
    console.error('🔍 [MIDDLEWARE ERROR] Es ruta de rentabilidad-pedidos, mostrando detalles');
    // Forzar el envío directo sin usar render
    const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Error 500 - Rentabilidad Pedidos</title>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #dc3545; }
    pre { background: #f8f9fa; padding: 15px; border: 1px solid #dee2e6; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Error 500 - Rentabilidad Pedidos</h1>
    <p><strong>Path:</strong> ${req.path || 'N/A'}</p>
    <p><strong>Mensaje:</strong> ${(err && err.message) ? err.message.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Error desconocido'}</p>
    <h2>Stack Trace:</h2>
    <pre>${(err && err.stack) ? err.stack.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'No hay stack trace disponible'}</pre>
  </div>
</body>
</html>`;
    
    try {
      res.status(500).send(errorHtml);
      return;
    } catch (sendError) {
      console.error('❌ [MIDDLEWARE ERROR] Error al enviar respuesta de error:', sendError.message);
      // Último recurso: intentar enviar texto plano
      try {
        res.status(500).end(`Error 500: ${err.message || 'Error desconocido'}`);
        return;
      } catch (e) {
        console.error('❌ [MIDDLEWARE ERROR] No se pudo enviar respuesta de error');
        return;
      }
    }
  } else {
    try {
      // Intentar renderizar la vista de error, pero con un mensaje más detallado
      const errorMessage = err.message || 'Error desconocido';
      const errorPath = req.path || 'N/A';
      console.log(`📋 [MIDDLEWARE ERROR] Intentando renderizar vista de error para: ${errorPath}`);
      
      res.status(500).render('error', { 
        error: 'Error interno del servidor',
        message: isDevelopment ? errorMessage : 'Algo salió mal. Por favor, contacta al administrador.'
      });
    } catch (renderError) {
      console.error('❌ [MIDDLEWARE ERROR] Error al renderizar vista de error:', renderError.message);
      console.error('❌ [MIDDLEWARE ERROR] Render error stack:', renderError.stack);
      // Fallback: enviar HTML simple con más detalles
      try {
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Error 500</title>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
              .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              h1 { color: #dc3545; }
              pre { background: #f8f9fa; padding: 15px; border: 1px solid #dee2e6; border-radius: 4px; overflow-x: auto; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Error 500 - Error interno del servidor</h1>
              <p><strong>Path:</strong> ${req.path || 'N/A'}</p>
              <p><strong>Mensaje:</strong> ${(err && err.message) ? String(err.message).replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Error desconocido'}</p>
              <h2>Stack Trace:</h2>
              <pre>${(err && err.stack) ? String(err.stack).replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'No hay stack trace disponible'}</pre>
            </div>
          </body>
          </html>
        `;
        res.status(500).send(errorHtml);
      } catch (sendError) {
        console.error('❌ [MIDDLEWARE ERROR] Error crítico al enviar respuesta de error:', sendError.message);
        res.status(500).end(`Error 500: ${err.message || 'Error desconocido'}`);
      }
    }
  }
});

// Registrar rutas de rentabilidad-pedidos ANTES del debug para asegurar que se registren
// Ruta de prueba ULTRA SIMPLE
app.get('/test-rentabilidad-simple', blockInProduction, (req, res) => {
  res.send('<h1>✅ Ruta de prueba funcionando</h1><p>Si ves esto, el servidor está funcionando.</p>');
});

// Ruta temporal SIN middlewares para diagnosticar - VERSIÓN HTML SIMPLE
app.get('/dashboard/ajustes/rentabilidad-pedidos-sin-auth', blockInProduction, async (req, res) => {
  try {
    console.log('✅ [RENTABILIDAD-PEDIDOS-SIN-AUTH] Ruta accedida');
    
    const pedidosRaw = await crm.getPedidos();
    console.log(`✅ [RENTABILIDAD-PEDIDOS-SIN-AUTH] Pedidos obtenidos: ${pedidosRaw ? pedidosRaw.length : 0}`);
    
    const pedidos = (pedidosRaw || []).slice(0, 10).map(p => ({
      id: p.Id || p.id,
      NumPedido: p.NumPedido || '-',
      FechaPedido: p.FechaPedido || null,
      BaseImponible: parseFloat(p.BaseImponible || 0)
    }));
    
    console.log(`✅ [RENTABILIDAD-PEDIDOS-SIN-AUTH] Pedidos formateados: ${pedidos.length}`);
    
    // Devolver HTML simple sin usar la vista EJS
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rentabilidad por Pedido - Test</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
        </style>
      </head>
      <body>
        <h1>Rentabilidad por Pedido - Test (Sin Auth)</h1>
        <p>✅ Esta ruta funciona sin middlewares</p>
        <h2>Pedidos (${pedidos.length}):</h2>
        <table>
          <thead>
            <tr>
              <th>Nº Pedido</th>
              <th>Fecha</th>
              <th>Base Imponible</th>
            </tr>
          </thead>
          <tbody>
            ${pedidos.map(p => `
              <tr>
                <td>${p.NumPedido}</td>
                <td>${p.FechaPedido ? new Date(p.FechaPedido).toLocaleDateString('es-ES') : '-'}</td>
                <td>€ ${p.BaseImponible.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p><a href="/dashboard/ajustes/rentabilidad-pedidos">Ir a la ruta con auth</a></p>
      </body>
      </html>
    `;
    
    res.send(html);
    console.log('✅ [RENTABILIDAD-PEDIDOS-SIN-AUTH] HTML enviado correctamente');
    
  } catch (error) {
    console.error('❌ [RENTABILIDAD-PEDIDOS-SIN-AUTH] Error:', error.message);
    console.error('❌ [RENTABILIDAD-PEDIDOS-SIN-AUTH] Stack:', error.stack);
    res.status(500).send(`<h1>Error</h1><pre>${error.message}\n${error.stack}</pre>`);
  }
});

// Endpoint de diagnóstico temporal - mostrar todas las rutas registradas
app.get('/debug/rutas', requireAuth, requireAdmin, (req, res) => {
  const rutas = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
      rutas.push({
        metodo: methods,
        ruta: middleware.route.path
      });
    } else if (middleware.name === 'router') {
      // Rutas de routers
      if (middleware.regexp) {
        const basePath = middleware.regexp.source.replace('\\/?', '').replace('(?=\\/|$)', '').replace(/\\\//g, '/');
        rutas.push({
          metodo: 'ROUTER',
          ruta: basePath
        });
      }
    }
  });
  
  const rutasAjustes = rutas.filter(r => r.ruta.includes('/ajustes'));
  const rutasCodigosPostales = rutas.filter(r => r.ruta.includes('codigos-postales'));
  const rutasAsignaciones = rutas.filter(r => r.ruta.includes('asignaciones-comerciales'));
  
  res.json({
    totalRutas: rutas.length,
    rutasAjustes: rutasAjustes,
    rutasCodigosPostales: rutasCodigosPostales,
    rutasAsignaciones: rutasAsignaciones,
    todasLasRutas: rutas
  });
});

// Ruta 404
app.use((req, res) => {
  console.log(`⚠️ [404] Ruta no encontrada: ${req.method} ${req.path}`);
  console.log(`⚠️ [404] Query:`, req.query);
  console.log(`⚠️ [404] Headers:`, req.headers);
  res.status(404).render('error', { 
    error: 'Página no encontrada',
    message: 'La página que buscas no existe'
  });
});

// Iniciar servidor solo si se ejecuta directamente (no cuando se importa como módulo)
if (require.main === module) {
  // Manejo de errores global para evitar que el servidor se caiga
  process.on('uncaughtException', (error) => {
    console.error('❌ [UNCAUGHT EXCEPTION] Error no capturado:', error);
    console.error('❌ [UNCAUGHT EXCEPTION] Stack:', error.stack);
    // No cerrar el proceso, solo registrar el error
    // En producción, podrías querer cerrar el proceso y reiniciarlo
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ [UNHANDLED REJECTION] Promesa rechazada sin manejar:', reason);
    console.error('❌ [UNHANDLED REJECTION] Promise:', promise);
    if (reason instanceof Error) {
      console.error('❌ [UNHANDLED REJECTION] Stack:', reason.stack);
    }
    // No cerrar el proceso, solo registrar el error
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Farmadescaso CRM ejecutándose en puerto ${PORT}`);
    console.log(`🌐 Disponible en http://localhost:${PORT}`);
    console.log(`🌐 También disponible en http://127.0.0.1:${PORT}`);
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Error: El puerto ${PORT} ya está en uso`);
      console.error(`💡 Intenta usar otro puerto o detén el proceso que está usando el puerto ${PORT}`);
      process.exit(1);
    } else {
      console.error(`❌ Error al iniciar el servidor:`, err);
      process.exit(1);
    }
  });
  
  server.on('listening', () => {
    console.log(`✅ Servidor escuchando en http://127.0.0.1:${PORT}`);
    console.log(`📚 Documentación API (Swagger) disponible en http://127.0.0.1:${PORT}/api-docs`);
    console.log(`🔑 API REST disponible en http://127.0.0.1:${PORT}/api`);
  });
}

// Exportar app y requireAuth para uso en módulos externos
module.exports = { app, requireAuth };
module.exports.default = app;
module.exports.default = app;