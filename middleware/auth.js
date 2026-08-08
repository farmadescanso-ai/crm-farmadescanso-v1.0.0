/**
 * Middleware y helpers de autenticación (Fase 2).
 * Fuente única para JWT, requireAuth/requireAdmin y utilidades de password.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * @param {object} options
 * @param {string} options.jwtSecret
 * @param {string} [options.jwtExpiresIn]
 * @param {string} options.cookieName
 * @param {object} options.cookieConfig
 * @param {boolean} [options.isDevelopment]
 */
function createAuth(options) {
  const {
    jwtSecret,
    jwtExpiresIn = '30d',
    cookieName,
    cookieConfig,
    isDevelopment = false
  } = options;

  if (!jwtSecret) {
    throw new Error('createAuth: jwtSecret es obligatorio');
  }
  if (!cookieName) {
    throw new Error('createAuth: cookieName es obligatorio');
  }

  function parseRoll(rollValue) {
    if (!rollValue) return 'Comercial';

    if (typeof rollValue === 'string' && rollValue.trim().startsWith('[')) {
      try {
        const rollArray = JSON.parse(rollValue);
        if (Array.isArray(rollArray) && rollArray.length > 0) {
          return rollArray[0];
        }
      } catch (_) {
        // mantener valor original
      }
    } else if (Array.isArray(rollValue) && rollValue.length > 0) {
      return rollValue[0];
    }

    return rollValue;
  }

  function generateToken(comercial) {
    let rollValue = comercial.Roll || comercial.roll || 'Comercial';
    if (typeof rollValue === 'string' && rollValue.trim().startsWith('[')) {
      try {
        const rollArray = JSON.parse(rollValue);
        if (Array.isArray(rollArray) && rollArray.length > 0) {
          rollValue = rollArray[0];
        }
      } catch (_) {
        // mantener
      }
    } else if (Array.isArray(rollValue) && rollValue.length > 0) {
      rollValue = rollValue[0];
    }

    const payload = {
      id: comercial.Id || comercial.id,
      nombre: comercial.Nombre || comercial.nombre,
      email: comercial.Email || comercial.email,
      zona: comercial.Zona || comercial.zona || 'Sin zona asignada',
      dni: comercial.DNI || comercial.dni,
      roll: rollValue,
      Roll: rollValue
    };

    return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
  }

  function verifyToken(token) {
    try {
      return jwt.verify(token, jwtSecret);
    } catch (error) {
      console.log(`❌ [JWT] Token inválido:`, error.message);
      return null;
    }
  }

  function generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async function hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  async function verifyPassword(password, hash) {
    if (hash && (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$'))) {
      return bcrypt.compare(password, hash);
    }
    return password === hash;
  }

  /** Middleware global: lee cookie JWT y rellena req.user / sesión. */
  function attachJwtFromCookie(req, res, next) {
    const token = req.cookies[cookieName];

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const parsedRoll = parseRoll(decoded.roll || decoded.Roll);
        decoded.roll = parsedRoll;
        decoded.Roll = parsedRoll;

        req.user = decoded;
        req.comercialId = decoded.id;
        req.comercial = decoded;

        if (req.session) {
          req.session.comercialId = decoded.id;
          req.session.comercial = decoded;
        }

        if (isDevelopment) {
          console.log(`✅ [AUTH] Usuario autenticado: ${decoded.email} (ID: ${decoded.id}, Rol: ${parsedRoll})`);
        }
      } else {
        if (isDevelopment) {
          console.log(`⚠️ [AUTH] Token inválido, limpiando cookie`);
        }
        res.clearCookie(cookieName, cookieConfig);
      }
    } else if (req.session && req.session.comercial) {
      const sessionComercial = req.session.comercial;
      if (sessionComercial.Roll || sessionComercial.roll) {
        const parsedRoll = parseRoll(sessionComercial.Roll || sessionComercial.roll);
        sessionComercial.roll = parsedRoll;
        sessionComercial.Roll = parsedRoll;
        req.comercial = sessionComercial;
      }
    }

    next();
  }

  const requireAuth = (req, res, next) => {
    try {
      if (req.user && req.comercialId) {
        return next();
      }

      if (req.session && req.session.comercialId) {
        return next();
      }

      const originalUrl = String(req.originalUrl || req.url || '');
      const pathOnly = originalUrl.split('?')[0];
      const acceptHeader = req.headers.accept || '';
      const acceptsJson = acceptHeader.includes('application/json');
      const prefersHtml = acceptHeader.includes('text/html');
      const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
      // /api-docs y páginas HTML no deben devolver JSON 401 solo por Accept: */*
      const isApiJsonRoute =
        pathOnly.startsWith('/api/') &&
        !pathOnly.startsWith('/api-docs');

      if (isAjax || (isApiJsonRoute && (acceptsJson || !prefersHtml))) {
        return res.status(401).json({
          success: false,
          error: 'No autenticado',
          redirect: '/auth/login'
        });
      }

      return res.redirect('/auth/login');
    } catch (error) {
      console.error('❌ [AUTH] Error en requireAuth:', error.message);
      next(error);
    }
  };

  const getUsuarioRol = (req) => {
    try {
      const comercial = req.comercial || req.session?.comercial || req.user;
      if (!comercial) return null;

      let rollValue =
        comercial.roll ??
        comercial.Roll ??
        comercial.rol ??
        comercial.Rol ??
        comercial.role ??
        comercial.Role ??
        comercial.Roles ??
        comercial.roles ??
        null;

      if (!rollValue) return 'comercial';

      if (Array.isArray(rollValue)) {
        rollValue = rollValue.length > 0 ? rollValue[0] : 'comercial';
      } else if (typeof rollValue === 'string') {
        const trimmed = rollValue.trim();
        if (trimmed.startsWith('[')) {
          try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr) && arr.length > 0) {
              rollValue = arr[0];
            }
          } catch (_) {
            // mantener
          }
        }
      }

      return String(rollValue).toLowerCase();
    } catch (error) {
      console.error('❌ [GET_USUARIO_ROL] Error:', error.message);
      return null;
    }
  };

  const isAdmin = (req) => {
    try {
      const rol = getUsuarioRol(req);
      if (!rol) return false;
      return rol.includes('administrador') || rol.includes('admin');
    } catch (error) {
      console.error('❌ [IS_ADMIN] Error:', error.message);
      return false;
    }
  };

  const isComercial = (req) => {
    const rol = getUsuarioRol(req);
    return rol === 'comercial' || rol === null;
  };

  const getComercialId = (req) => {
    const direct = req.comercialId || req.session?.comercialId;
    if (direct) return direct;

    const comercialObj = req.comercial || req.session?.comercial || req.user || null;
    if (!comercialObj) return null;

    return (
      comercialObj.id ??
      comercialObj.Id ??
      comercialObj.comercialId ??
      comercialObj.ComercialId ??
      null
    );
  };

  const requireAdmin = (req, res, next) => {
    try {
      if (!req.user && !req.session?.comercialId) {
        if (req.path.startsWith('/api/')) {
          return res.status(401).json({ success: false, error: 'No autenticado' });
        }
        return res.redirect('/auth/login');
      }

      const adminCheck = isAdmin(req);

      if (!adminCheck) {
        if (req.path.startsWith('/api/')) {
          return res.status(403).json({
            success: false,
            error: 'Solo los administradores pueden acceder a esta sección.'
          });
        }
        return res.status(403).render('access-denied', {
          title: 'Acceso Denegado - Farmadescaso',
          user: req.comercial || req.session?.comercial || null
        });
      }

      next();
    } catch (error) {
      console.error('❌ [REQUIRE_ADMIN] Error en middleware:', error.message);
      next(error);
    }
  };

  const requireComercial = (req, res, next) => {
    if (!req.user && !req.session?.comercialId) {
      return res.redirect('/auth/login');
    }

    if (isAdmin(req)) {
      return next();
    }

    if (!isComercial(req)) {
      return res.status(403).render('error', {
        error: 'Acceso denegado',
        message: 'No tienes permisos para acceder a esta sección.'
      });
    }

    next();
  };

  /** Expone user/esAdmin a todas las vistas EJS. */
  function attachLocals(req, res, next) {
    try {
      res.locals.user = req.comercial || req.session?.comercial || req.user || null;
      res.locals.esAdmin = isAdmin(req);
    } catch (_) {
      res.locals.user = req.comercial || req.session?.comercial || req.user || null;
      res.locals.esAdmin = false;
    }
    next();
  }

  return {
    cookieName,
    cookieConfig,
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
    getUserIsAdmin: isAdmin
  };
}

module.exports = { createAuth };
