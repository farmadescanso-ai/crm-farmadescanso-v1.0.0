/**
 * Rutas de autenticación (/auth/*) — extraídas del monolito (Fase 2).
 * @param {object} deps dependencias inyectadas desde server-crm-completo.js
 */
const express = require('express');

module.exports = function createAuthRoutes(deps) {
  const router = express.Router();

// Rutas de autenticación
router.get('/auth/login', (req, res) => {
  // Verificar si ya está autenticado (JWT o sesión)
  if (req.user && req.comercialId) {
    return res.redirect('/dashboard');
  }
  
  if (req.session && req.session.comercialId) {
    return res.redirect('/dashboard');
  }
  
  const success = req.query.success === 'password_reset' ? 'Tu contraseña ha sido restablecida correctamente. Ya puedes iniciar sesión.' : null;
  
  res.render('auth/login', {
    title: 'Iniciar Sesión - Farmadescaso',
    error: null,
    success: success,
    email: ''
  });
});

router.post('/auth/login', async (req, res) => {
  const loginStartTime = Date.now();
  
  try {
    if (deps.isDevelopment) {
      console.log(`🔐 [LOGIN] Intento de login desde ${req.ip}`);
    }

    const { email, password } = req.body;
    
    // Validar entrada
    if (!email || !password) {
      const errorMsg = !email && !password 
        ? 'Email y contraseña son requeridos'
        : !email 
          ? 'Email es requerido'
          : 'Contraseña es requerida';
      
      if (deps.isDevelopment) {
        console.log(`⚠️ [LOGIN] Validación fallida: ${errorMsg}`);
      }
      
      return res.render('auth/login', {
        title: 'Iniciar Sesión - Farmadescaso',
        error: errorMsg,
        email: email || '',
        debugInfo: deps.isDevelopment ? { paso: 1, error: errorMsg } : undefined
      });
    }
    
    // Normalizar email
    const emailNormalizado = String(email).toLowerCase().trim();
    
    // Conectar a CRM y buscar comercial
    let comercial = null;
    let errorConexion = null;
    
    try {
      if (!deps.crm.connected) {
        await deps.crm.connect();
      }
      
      // Usar getComercialByEmail para obtener todos los campos incluyendo Password
      comercial = await deps.crm.getComercialByEmail(emailNormalizado);
      
    } catch (error) {
      errorConexion = error;
      console.error('❌ [LOGIN] Error conectando al CRM:', error.message);
      if (deps.isDevelopment) {
        console.error('❌ [LOGIN] Stack:', error.stack);
      }
    }
    
    if (!comercial) {
      const errorDetails = {
        paso: 3,
        emailBuscado: emailNormalizado,
        errorConexion: errorConexion ? errorConexion.message : null,
        mensaje: errorConexion 
          ? `Error conectando a la base de datos: ${errorConexion.message}`
          : `No se encontró ningún comercial con el email "${emailNormalizado}"`
      };
      
      if (deps.isDevelopment) {
        console.log(`❌ [LOGIN] Comercial no encontrado: ${emailNormalizado}`);
      }
      
      return res.render('auth/login', {
        title: 'Iniciar Sesión - Farmadescaso',
        error: errorConexion 
          ? `Error de conexión: ${errorConexion.message}. Por favor, intenta de nuevo.`
          : 'Email o contraseña incorrectos',
        email: email || '',
        debugInfo: deps.isDevelopment ? errorDetails : undefined
      });
    }
    
    if (deps.isDevelopment) {
      console.log(`✅ [LOGIN] Comercial encontrado: ${comercial.Nombre || comercial.nombre} (ID: ${comercial.Id || comercial.id})`);
      console.log(`📋 [LOGIN] Campos disponibles:`, Object.keys(comercial));
    }
    
    // Verificar contraseña
    const passwordFields = {
      password: comercial.password,
      Password: comercial.Password,
      contraseña: comercial.contraseña,
      Contraseña: comercial.Contraseña,
      DNI: comercial.DNI,
      dni: comercial.dni,
      Dni: comercial.Dni
    };
    
    if (deps.isDevelopment) {
      console.log(`🔑 [LOGIN] Campos de contraseña verificados:`, {
        password: passwordFields.password ? '✅' : '❌',
        Password: passwordFields.Password ? '✅' : '❌',
        contraseña: passwordFields.contraseña ? '✅' : '❌',
        Contraseña: passwordFields.Contraseña ? '✅' : '❌',
        DNI: passwordFields.DNI ? '✅' : '❌',
        dni: passwordFields.dni ? '✅' : '❌',
        Dni: passwordFields.Dni ? '✅' : '❌'
      });
    }
    
    const passwordField = passwordFields.password || 
                         passwordFields.Password || 
                         passwordFields.contraseña || 
                         passwordFields.Contraseña || 
                         passwordFields.DNI || 
                         passwordFields.dni ||
                         passwordFields.Dni ||
                         null;
    
    if (!passwordField) {
      const errorDetails = {
        paso: 4,
        comercialId: comercial.Id || comercial.id,
        mensaje: 'El comercial no tiene ningún campo de contraseña configurado',
        camposDisponibles: Object.keys(comercial),
        camposPasswordPresentes: Object.keys(passwordFields).filter((k) => passwordFields[k])
      };
      
      if (deps.isDevelopment) {
        console.log(`❌ [LOGIN] Contraseña no disponible para comercial ID: ${comercial.Id || comercial.id}`);
        console.log(`❌ [LOGIN] Campos disponibles:`, Object.keys(comercial));
        console.log(`❌ [LOGIN] Campos password presentes:`, errorDetails.camposPasswordPresentes);
      }
      
      return res.render('auth/login', {
        title: 'Iniciar Sesión - Farmadescaso',
        error: 'Error de configuración: El comercial no tiene contraseña configurada. Contacta con el administrador.',
        email: email || '',
        debugInfo: deps.isDevelopment ? errorDetails : undefined
      });
    }
    
    // Comparar contraseñas (soporta texto plano y hash bcrypt)
    const passwordNormalizada = String(password).trim();
    
    // Logging para depuración (solo en desarrollo)
    if (deps.isDevelopment) {
      console.log(`🔑 [LOGIN] Comparando contraseñas para: ${emailNormalizado}`);
      console.log(`🔑 [LOGIN] Password ingresada (longitud): ${passwordNormalizada.length}`);
      console.log(`🔑 [LOGIN] Password en BD (longitud): ${passwordField ? String(passwordField).trim().length : 0}`);
      console.log(`🔑 [LOGIN] Campos de contraseña disponibles:`, Object.keys(passwordFields).filter(k => passwordFields[k]));
    }
    
    // Verificar contraseña (soporta texto plano y hash bcrypt)
    const isPasswordValid = await deps.verifyPassword(passwordNormalizada, passwordField);
    
    if (!isPasswordValid) {
      if (deps.isDevelopment) {
        console.log(`❌ [LOGIN] Contraseña incorrecta para: ${emailNormalizado}`);
      }
      
      return res.render('auth/login', {
        title: 'Iniciar Sesión - Farmadescaso',
        error: 'Email o contraseña incorrectos',
        email: email || '',
        debugInfo: deps.isDevelopment ? { paso: 4, error: 'Contraseña incorrecta' } : undefined
      });
    }
    
    // Generar token JWT
    const comercialId = comercial.Id || comercial.id;
    
    if (!comercialId) {
      if (deps.isDevelopment) {
        console.log(`❌ [LOGIN] ID de comercial no válido`);
      }
      
      return res.render('auth/login', {
        title: 'Iniciar Sesión - Farmadescaso',
        error: 'Error interno: El comercial no tiene un ID válido. Contacta con el administrador.',
        email: email || '',
        debugInfo: deps.isDevelopment ? { paso: 5, error: 'ID no válido' } : undefined
      });
    }
    
    let token = null;
    try {
      token = deps.generateToken(comercial);
    } catch (error) {
      console.error('❌ [LOGIN] Error generando token:', error.message);
      return res.render('auth/login', {
        title: 'Iniciar Sesión - Farmadescaso',
        error: 'Error interno al generar la sesión. Por favor, intenta de nuevo.',
        email: email || '',
        debugInfo: deps.isDevelopment ? { paso: 5, error: error.message } : undefined
      });
    }
    
    // Establecer cookie y sesión
    try {
      res.cookie(deps.cookieName, token, deps.cookieConfig);
      
      // Parsear Roll si es un JSON string
      let rollValue = comercial.Roll || comercial.roll || 'Comercial';
      if (typeof rollValue === 'string' && rollValue.trim().startsWith('[')) {
        try {
          const rollArray = JSON.parse(rollValue);
          if (Array.isArray(rollArray) && rollArray.length > 0) {
            rollValue = rollArray[0]; // Tomar el primer rol
          }
        } catch (e) {
          // Si falla el parse, usar el valor original
        }
      } else if (Array.isArray(rollValue) && rollValue.length > 0) {
        rollValue = rollValue[0]; // Si ya es un array, tomar el primero
      }
      
      req.session.comercialId = comercialId;
      req.session.comercial = {
        id: comercialId,
        nombre: comercial.Nombre || comercial.nombre,
        email: comercial.Email || comercial.email,
        zona: comercial.Zona || comercial.zona || 'Sin zona asignada',
        dni: comercial.DNI || comercial.dni,
        roll: rollValue,
        Roll: rollValue // Mantener ambos para compatibilidad
      };
      
      req.session.save((err) => {
        if (err && deps.isDevelopment) {
          console.error('❌ [LOGIN] Error guardando sesión:', err);
        }
      });
      
      const loginDuration = Date.now() - loginStartTime;
      
      if (deps.isDevelopment) {
        console.log(`✅ [LOGIN] Login exitoso: ${comercial.Email || comercial.email} (${loginDuration}ms)`);
      }
      
      res.status(303).redirect('/dashboard');
      
    } catch (error) {
      console.error('❌ [LOGIN] Error estableciendo cookie/sesión:', error.message);
      if (deps.isDevelopment) {
        console.error('❌ [LOGIN] Stack:', error.stack);
      }
      
      return res.render('auth/login', {
        title: 'Iniciar Sesión - Farmadescaso',
        error: 'Error al iniciar sesión. Por favor, intenta de nuevo.',
        email: email || '',
        debugInfo: deps.isDevelopment ? { paso: 6, error: error.message } : undefined
      });
    }
    
  } catch (error) {
    const loginDuration = Date.now() - loginStartTime;
    console.error('❌ [LOGIN] Error general:', error.message);
    if (deps.isDevelopment) {
      console.error('❌ [LOGIN] Stack:', error.stack);
    }
    
    res.render('auth/login', {
      title: 'Iniciar Sesión - Farmadescaso',
      error: `Error interno del servidor: ${error.message}. Por favor, intenta de nuevo.`,
      email: req.body.email || '',
      debugInfo: deps.isDevelopment ? { 
        paso: 'ERROR GENERAL', 
        error: error.message,
        tiempo: `${loginDuration}ms`
      } : undefined
    });
  }
});

// ============================================
// INTEGRACIONES DE REUNIONES (GOOGLE MEET / TEAMS)
// Desactivadas: no deben aparecer ni ser accesibles.
// Para reactivarlas explícitamente: MEETING_INTEGRATIONS_ENABLED=true
// ============================================
const MEETING_INTEGRATIONS_ENABLED = String(process.env.MEETING_INTEGRATIONS_ENABLED || '').toLowerCase() === 'true';

function reunionesIntegracionDesactivada(req, res) {
  // 404 intencional para “cerrar” las rutas y que no sean accesibles por URL directa.
  return res.status(404).send('Integración de reuniones (Meet/Teams) desactivada.');
}

// Rutas OAuth de Google para Google Meet (accesible para todos los comerciales autenticados)
router.get('/auth/google', deps.requireAuth, async (req, res) => {
  try {
    if (!MEETING_INTEGRATIONS_ENABLED) return reunionesIntegracionDesactivada(req, res);
    const comercialId = req.comercialId || req.session.comercialId;
    if (!comercialId) {
      return res.redirect('/auth/login');
    }

    // Obtener credenciales desde la base de datos (Configuraciones)
    const clientId = await deps.crm.getConfiguracionValor('google_oauth_client_id', process.env.GOOGLE_CLIENT_ID || '');
    const clientSecret = await deps.crm.getConfiguracionValor('google_oauth_client_secret', process.env.GOOGLE_CLIENT_SECRET || '');
    const redirectUri = await deps.crm.getConfiguracionValor('google_oauth_redirect_uri', process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback');

    if (!clientId || !clientSecret) {
      console.error('❌ Credenciales de Google OAuth2 no configuradas');
      return res.redirect(`/dashboard/comerciales/${comercialId}/editar?error=oauth_no_configurado`);
    }

    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Scopes necesarios para Google Calendar y Meet
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email' // Para obtener el email del usuario
    ];

    // Generar URL de autorización
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Forzar consentimiento para obtener refresh_token
      state: comercialId.toString() // Pasar el ID del comercial en el state
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Error iniciando OAuth de Google:', error);
    res.redirect('/dashboard/comerciales?error=oauth_error');
  }
});

// Callback de OAuth de Google (accesible para todos los comerciales autenticados)
router.get('/auth/google/callback', deps.requireAuth, async (req, res) => {
  try {
    if (!MEETING_INTEGRATIONS_ENABLED) return reunionesIntegracionDesactivada(req, res);
    const { code, state, error } = req.query;
    const comercialId = parseInt(state) || req.comercialId || req.session.comercialId;

    // Si Google devuelve un error (como access_denied)
    if (error) {
      console.error('❌ Error en callback de Google OAuth:', error);
      let errorMessage = 'Error al autorizar la aplicación';
      let errorDetail = '';
      
      if (error === 'access_denied') {
        errorMessage = 'Acceso denegado';
        errorDetail = 'Tu email no está en la lista de usuarios de prueba. El administrador debe agregar tu email a Google Cloud Console.';
      } else {
        errorDetail = error;
      }
      
      return res.redirect(`/dashboard/comerciales/${comercialId}/editar?error=oauth_callback_error&message=${encodeURIComponent(errorMessage)}&detail=${encodeURIComponent(errorDetail)}`);
    }

    if (!code) {
      return res.redirect(`/dashboard/comerciales/${comercialId}/editar?error=oauth_no_code`);
    }

    if (!comercialId) {
      return res.redirect('/auth/login');
    }

    // Obtener credenciales desde la base de datos (Configuraciones)
    const clientId = await deps.crm.getConfiguracionValor('google_oauth_client_id', process.env.GOOGLE_CLIENT_ID || '');
    const clientSecret = await deps.crm.getConfiguracionValor('google_oauth_client_secret', process.env.GOOGLE_CLIENT_SECRET || '');
    const redirectUri = await deps.crm.getConfiguracionValor('google_oauth_redirect_uri', process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback');

    if (!clientId || !clientSecret) {
      console.error('❌ Credenciales de Google OAuth2 no configuradas');
      return res.redirect(`/dashboard/comerciales/${comercialId}/editar?error=oauth_no_configurado`);
    }

    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Intercambiar código por tokens
    console.log(`🔄 [OAUTH] Intercambiando código por tokens para comercial ${comercialId}...`);
    let tokenResponse;
    try {
      tokenResponse = await oauth2Client.getToken(code);
      console.log(`✅ [OAUTH] Tokens obtenidos exitosamente`);
    } catch (tokenError) {
      console.error('❌ [OAUTH] Error obteniendo tokens:', tokenError);
      throw new Error(`Error al obtener tokens: ${tokenError.message}`);
    }
    
    const tokens = tokenResponse.tokens;
    if (!tokens || !tokens.access_token) {
      throw new Error('No se recibieron tokens válidos de Google');
    }
    
    // Obtener información del usuario
    console.log(`🔄 [OAUTH] Obteniendo información del usuario...`);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    
    let userInfo;
    try {
      const userInfoResponse = await oauth2.userinfo.get();
      userInfo = userInfoResponse.data;
      console.log(`✅ [OAUTH] Información del usuario obtenida: ${userInfo.email}`);
    } catch (userInfoError) {
      console.error('❌ [OAUTH] Error obteniendo información del usuario:', userInfoError);
      // Si falla obtener el email, usar el email del comercial como fallback
      const comercial = await deps.crm.getComercialById(comercialId);
      const email = comercial && comercial.Email ? comercial.Email : null;
      if (!email) {
        throw new Error('No se pudo obtener el email del usuario ni del comercial');
      }
      userInfo = { email: email };
      console.log(`⚠️ [OAUTH] Usando email del comercial como fallback: ${email}`);
    }

    // Guardar credenciales en la base de datos
    console.log(`🔄 [OAUTH] Guardando credenciales en la base de datos...`);
    const meetReuniones = require('./utils/reuniones-meet');
    await meetReuniones.guardarCredenciales(comercialId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      email: userInfo.email,
      expiresIn: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600
    });

    console.log(`✅ [OAUTH] OAuth de Google configurado para comercial ${comercialId} (${userInfo.email})`);

    res.redirect(`/dashboard/comerciales/${comercialId}/editar?success=google_connected`);
  } catch (error) {
    console.error('❌ [OAUTH] Error en callback de OAuth de Google:', error);
    console.error('❌ [OAUTH] Stack trace:', error.stack);
    const comercialId = req.comercialId || req.session.comercialId || (req.query && req.query.state ? parseInt(req.query.state) : null);
    
    let errorMessage = 'Error desconocido';
    let errorDetail = error.message || 'Error al procesar la autorización';
    
    if (error.message) {
      errorMessage = error.message;
      errorDetail = error.message;
    }
    
    if (comercialId) {
      res.redirect(`/dashboard/comerciales/${comercialId}/editar?error=oauth_callback_error&message=${encodeURIComponent(errorMessage)}&detail=${encodeURIComponent(errorDetail)}`);
    } else {
      res.redirect(`/dashboard/comerciales?error=oauth_callback_error&message=${encodeURIComponent(errorMessage)}&detail=${encodeURIComponent(errorDetail)}`);
    }
  }
});

// Desconectar cuenta de Google
router.get('/auth/google/disconnect', deps.requireAuth, async (req, res) => {
  try {
    if (!MEETING_INTEGRATIONS_ENABLED) return reunionesIntegracionDesactivada(req, res);
    const comercialId = parseInt(req.query.comercial_id) || req.comercialId || req.session.comercialId;
    
    if (!comercialId) {
      return res.redirect('/auth/login');
    }

    // Verificar que el usuario solo pueda desconectar su propia cuenta (o ser admin)
    const user = req.comercial || req.session.comercial;
    const userRol = deps.parseRoll(user?.roll || user?.Roll || '');
    const isUserAdmin = userRol && (userRol.toLowerCase().includes('administrador') || userRol.toLowerCase().includes('admin'));
    const userId = req.comercialId || req.session.comercialId;

    if (!isUserAdmin && userId !== comercialId) {
      return res.redirect(`/dashboard/comerciales/${userId}/editar?error=sin_permisos`);
    }

    // Limpiar credenciales de Google
    await deps.crm.query(
      `UPDATE comerciales SET 
       meet_access_token = NULL, 
       meet_refresh_token = NULL, 
       meet_token_expires_at = NULL
       WHERE id = ?`,
      [comercialId]
    );

    console.log(`✅ Cuenta de Google desconectada para comercial ${comercialId}`);
    res.redirect(`/dashboard/comerciales/${comercialId}/editar?success=google_disconnected`);
  } catch (error) {
    console.error('❌ Error desconectando cuenta de Google:', error);
    const comercialId = req.comercialId || req.session.comercialId;
    res.redirect(`/dashboard/comerciales/${comercialId}/editar?error=error_desconectando`);
  }
});

router.post('/auth/logout', (req, res) => {
  const comercialId = req.user?.id || req.session?.comercialId;
  console.log(`🔓 [LOGOUT] Cerrando sesión para comercial ID: ${comercialId}`);
  
  // Limpiar cookie JWT
  res.clearCookie(deps.cookieName, deps.cookieConfig);
  console.log(`✅ [LOGOUT] Cookie JWT eliminada`);
  
  // Destruir sesión (compatibilidad)
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ [LOGOUT] Error cerrando sesión:', err);
    } else {
      console.log('✅ [LOGOUT] Sesión cerrada correctamente');
    }
    res.redirect('/');
  });
});

// ============================================
// RUTAS DE RECUPERACIÓN DE CONTRASEÑA

// GET /auth/forgot-password - Mostrar formulario de recuperación
router.get('/auth/forgot-password', (req, res) => {
  // Si ya está autenticado, redirigir al dashboard
  if (req.user && req.comercialId) {
    return res.redirect('/dashboard');
  }
  
  if (req.session && req.session.comercialId) {
    return res.redirect('/dashboard');
  }
  
  res.render('auth/forgot-password', {
    title: 'Recuperar Contraseña - Farmadescaso',
    error: null,
    success: null,
    email: ''
  });
});

// POST /auth/forgot-password - Enviar email de recuperación
router.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.render('auth/forgot-password', {
        title: 'Recuperar Contraseña - Farmadescaso',
        error: 'Por favor, introduce tu email',
        success: null,
        email: ''
      });
    }
    
    const emailNormalizado = String(email).toLowerCase().trim();

    if (!process.env.MAIL_PASS) {
      console.error('❌ [RECUPERACION] MAIL_PASS no está configurada en el entorno');
      return res.render('auth/forgot-password', {
        title: 'Recuperar Contraseña - Farmadescaso',
        error: 'El envío de correo no está configurado (MAIL_PASS). Contacta con administración.',
        success: null,
        email: emailNormalizado
      });
    }
    
    // Rate limiting (máximo 5 intentos por hora por email)
    const recentAttempts = await deps.crm.countRecentPasswordResetAttempts(emailNormalizado, 1);
    if (recentAttempts >= 5) {
      console.log(`⚠️ [RECUPERACION] Demasiados intentos para ${emailNormalizado}`);
      return res.render('auth/forgot-password', {
        title: 'Recuperar Contraseña - Farmadescaso',
        error: 'Demasiados intentos. Por favor, espera 1 hora antes de intentar de nuevo.',
        success: null,
        email: emailNormalizado
      });
    }
    
    // Buscar comercial por email
    const comercial = await deps.crm.getComercialByEmail(emailNormalizado);
    
    // Por seguridad, siempre mostrar el mismo mensaje si el email existe o no
    // Esto previene enumeración de emails
    if (comercial) {
      const comercialId = comercial.Id || comercial.id;
      const comercialEmail = comercial.Email || comercial.email || emailNormalizado;
      
      // Generar token seguro
      const token = deps.generateSecureToken();
      
      // Crear token en la base de datos (expira en 24 horas)
      await deps.crm.createPasswordResetToken(comercialId, comercialEmail, token, 24);
      
      // Crear enlace de recuperación (siempre dominio canónico de producción)
      const resetUrl = `${deps.getCanonicalOrigin()}/auth/reset-password/${token}`;
      
      // Enviar email
      try {
        console.log(`📧 [RECUPERACION] Intentando enviar email a: ${comercialEmail}`);
        console.log(`📧 [RECUPERACION] Desde: ${process.env.MAIL_USER || 'pedidos@farmadescanso.com'}`);
        console.log(`📧 [RECUPERACION] Host: ${process.env.MAIL_HOST || 'com1008.raiolanetworks.es'}`);
        console.log(`📧 [RECUPERACION] TLS insecure: ${process.env.MAIL_TLS_INSECURE === '1' ? 'sí' : 'no'}`);
        
        const emailResult = await deps.mailTransport.sendMail({
          from: process.env.MAIL_FROM || process.env.MAIL_USER || 'pedidos@farmadescanso.com',
          to: comercialEmail,
          subject: 'Recuperación de Contraseña - Farmadescaso',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f9f9f9; }
                .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Farmadescaso 2021 SL</h1>
                  <p>Recuperación de Contraseña</p>
                </div>
                <div class="content">
                  <p>Hola ${comercial.Nombre || comercial.nombre || 'Usuario'},</p>
                  <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente botón para crear una nueva contraseña:</p>
                  <p style="text-align: center;">
                    <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
                  </p>
                  <p>O copia y pega este enlace en tu navegador:</p>
                  <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
                  <div class="warning">
                    <strong>Importante:</strong> Este enlace expirará en 24 horas. Si no solicitaste este cambio, puedes ignorar este email.
                  </div>
                </div>
                <div class="footer">
                  <p>Este es un email automático, por favor no respondas.</p>
                  <p>© ${new Date().getFullYear()} Farmadescaso 2021 SL. Todos los derechos reservados.</p>
                </div>
              </div>
            </body>
            </html>
          `
        });
        
        console.log(`✅ [RECUPERACION] Email enviado a ${comercialEmail} messageId=${emailResult.messageId || 'N/A'}`);
      } catch (emailError) {
        console.error('❌ [RECUPERACION] Error enviando email:', emailError.message);
        console.error('❌ [RECUPERACION] Código:', emailError.code);
        console.error('❌ [RECUPERACION] Stack:', emailError.stack);
        try {
          await deps.crm.markPasswordResetTokenAsUsed(token);
        } catch (_) {
          // ignore
        }
        return res.render('auth/forgot-password', {
          title: 'Recuperar Contraseña - Farmadescaso',
          error: 'No se pudo enviar el email de recuperación. Revisa la configuración SMTP (MAIL_PASS / MAIL_HOST) o inténtalo más tarde.',
          success: null,
          email: emailNormalizado
        });
      }
    }
    
    // Mensaje genérico (no revela si el email existe)
    return res.render('auth/forgot-password', {
      title: 'Recuperar Contraseña - Farmadescaso',
      error: null,
      success: 'Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.',
      email: ''
    });
    
  } catch (error) {
    console.error('❌ [RECUPERACION] Error:', error);
    return res.render('auth/forgot-password', {
      title: 'Recuperar Contraseña - Farmadescaso',
      error: 'Error al procesar la solicitud. Por favor, intenta más tarde.',
      success: null,
      email: req.body.email || ''
    });
  }
});

// GET /auth/reset-password/:token - Mostrar formulario de restablecimiento
router.get('/auth/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.redirect('/auth/forgot-password?error=token_invalido');
    }
    
    // Buscar token válido (normalizar por si el email rompe el enlace)
    const tokenData = await deps.crm.findPasswordResetToken(String(token || '').trim().replace(/\s+/g, ''));
    
    if (!tokenData) {
      return res.render('auth/reset-password', {
        title: 'Restablecer Contraseña - Farmadescaso',
        error: 'El enlace de recuperación no es válido o ha expirado. Por favor, solicita uno nuevo.',
        success: null,
        token: null,
        valid: false
      });
    }
    
    res.render('auth/reset-password', {
      title: 'Restablecer Contraseña - Farmadescaso',
      error: null,
      success: null,
      token: String(token || '').trim().replace(/\s+/g, ''),
      valid: true
    });
    
  } catch (error) {
    console.error('❌ [RESET] Error:', error);
    return res.redirect('/auth/forgot-password?error=error_procesando');
  }
});

// POST /auth/reset-password - Procesar restablecimiento de contraseña
router.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    const cleanToken = String(token || '').trim().replace(/\s+/g, '');
    
    if (!cleanToken || !password || !confirmPassword) {
      return res.render('auth/reset-password', {
        title: 'Restablecer Contraseña - Farmadescaso',
        error: 'Por favor, completa todos los campos',
        success: null,
        token: cleanToken || null,
        valid: Boolean(cleanToken)
      });
    }
    
    // Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
      return res.render('auth/reset-password', {
        title: 'Restablecer Contraseña - Farmadescaso',
        error: 'Las contraseñas no coinciden',
        success: null,
        token: cleanToken,
        valid: true
      });
    }
    
    // Validar longitud mínima
    if (password.length < 6) {
      return res.render('auth/reset-password', {
        title: 'Restablecer Contraseña - Farmadescaso',
        error: 'La contraseña debe tener al menos 6 caracteres',
        success: null,
        token: cleanToken,
        valid: true
      });
    }
    
    // Buscar token válido
    const tokenData = await deps.crm.findPasswordResetToken(cleanToken);
    
    if (!tokenData) {
      return res.render('auth/reset-password', {
        title: 'Restablecer Contraseña - Farmadescaso',
        error: 'El enlace de recuperación no es válido o ha expirado. Por favor, solicita uno nuevo.',
        success: null,
        token: null,
        valid: false
      });
    }
    
    // Hashear nueva contraseña
    const hashedPassword = await deps.hashPassword(password);
    
    // Actualizar contraseña del comercial
    await deps.crm.updateComercial(tokenData.comercial_id, { Password: hashedPassword });
    
    // Marcar token como usado
    await deps.crm.markPasswordResetTokenAsUsed(cleanToken);
    
    console.log(`✅ [RESET] Contraseña restablecida para comercial ID: ${tokenData.comercial_id}`);
    
    // Redirigir a login con mensaje de éxito
    return res.redirect('/auth/login?success=password_reset');
    
  } catch (error) {
    console.error('❌ [RESET] Error:', error);
    return res.render('auth/reset-password', {
      title: 'Restablecer Contraseña - Farmadescaso',
      error: 'Error al restablecer la contraseña. Por favor, intenta más tarde.',
      success: null,
      token: req.body.token || null,
      valid: req.body.token ? true : false
    });
  }
});

// POST /auth/change-password - Cambiar contraseña desde el perfil (requiere autenticación)
router.post('/auth/change-password', deps.requireAuth, async (req, res) => {
  try {
    const comercialId = req.comercialId || req.session.comercialId;
    
    if (!comercialId) {
      return res.redirect('/auth/login');
    }
    
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.redirect('/dashboard/perfil?error=' + encodeURIComponent('Por favor, completa todos los campos'));
    }
    
    // Validar que las nuevas contraseñas coincidan
    if (newPassword !== confirmPassword) {
      return res.redirect('/dashboard/perfil?error=' + encodeURIComponent('Las nuevas contraseñas no coinciden'));
    }
    
    // Validar longitud mínima
    if (newPassword.length < 6) {
      return res.redirect('/dashboard/perfil?error=' + encodeURIComponent('La nueva contraseña debe tener al menos 6 caracteres'));
    }
    
    // Validar que la nueva contraseña sea diferente a la actual
    if (currentPassword === newPassword) {
      return res.redirect('/dashboard/perfil?error=' + encodeURIComponent('La nueva contraseña debe ser diferente a la actual'));
    }
    
    // Obtener comercial actual
    const comercial = await deps.crm.getComercialById(comercialId);
    
    if (!comercial) {
      return res.redirect('/dashboard/perfil?error=' + encodeURIComponent('Usuario no encontrado'));
    }
    
    // Verificar contraseña actual
    const passwordFields = {
      password: comercial.password,
      Password: comercial.Password,
      contraseña: comercial.contraseña,
      Contraseña: comercial.Contraseña,
      DNI: comercial.DNI,
      dni: comercial.dni,
      Dni: comercial.Dni
    };
    
    const currentPasswordHash = passwordFields.password || 
                               passwordFields.Password || 
                               passwordFields.contraseña || 
                               passwordFields.Contraseña || 
                               passwordFields.DNI || 
                               passwordFields.dni ||
                               passwordFields.Dni ||
                               null;
    
    if (!currentPasswordHash) {
      return res.redirect('/dashboard/perfil?error=' + encodeURIComponent('Error: No se pudo verificar la contraseña actual'));
    }
    
    // Verificar contraseña actual
    const isPasswordValid = await deps.verifyPassword(currentPassword, currentPasswordHash);
    
    if (!isPasswordValid) {
      return res.redirect('/dashboard/perfil?error=' + encodeURIComponent('La contraseña actual es incorrecta'));
    }
    
    // Hashear nueva contraseña
    const hashedPassword = await deps.hashPassword(newPassword);
    
    // Actualizar contraseña
    await deps.crm.updateComercial(comercialId, { Password: hashedPassword });
    
    console.log(`✅ [CAMBIO] Contraseña actualizada para comercial ID: ${comercialId}`);
    
    // Redirigir con mensaje de éxito
    return res.redirect('/dashboard/perfil?success=' + encodeURIComponent('Contraseña actualizada correctamente'));
    
  } catch (error) {
    console.error('❌ [CAMBIO] Error:', error);
    return res.redirect('/dashboard/perfil?error=' + encodeURIComponent('Error al cambiar la contraseña. Por favor, intenta más tarde.'));
  }
});

  return router;
};
