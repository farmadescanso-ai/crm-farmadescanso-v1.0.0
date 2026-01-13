// Utilidad para generar reuniones de Google Meet
const { google } = require('googleapis');
const crm = require('../config/mysql-crm');

class MeetReuniones {
  /**
   * Obtener cliente OAuth2 de Google para un comercial
   */
  async getOAuth2Client(comercialId) {
    try {
      console.log(`🔍 [MEET] Obteniendo cliente OAuth2 para comercial ${comercialId}`);
      
      const comercial = await crm.getComercialById(comercialId);
      if (!comercial) {
        throw new Error('Comercial no encontrado');
      }

      console.log(`🔍 [MEET] Comercial encontrado: ${comercial.Nombre || comercial.nombre}`);
      console.log(`🔍 [MEET] Tiene access_token: ${!!comercial.meet_access_token}`);
      console.log(`🔍 [MEET] Tiene refresh_token: ${!!comercial.meet_refresh_token}`);

      if (!comercial.meet_access_token || !comercial.meet_refresh_token) {
        throw new Error('No hay credenciales de Google Meet configuradas. Por favor, configura tu cuenta de Google en tu perfil.');
      }

      // Obtener credenciales desde la base de datos (Configuraciones)
      console.log(`🔍 [MEET] Obteniendo credenciales OAuth2 desde Configuraciones...`);
      const clientId = await crm.getConfiguracionValor('google_oauth_client_id', process.env.GOOGLE_CLIENT_ID || '');
      const clientSecret = await crm.getConfiguracionValor('google_oauth_client_secret', process.env.GOOGLE_CLIENT_SECRET || '');
      const redirectUri = await crm.getConfiguracionValor('google_oauth_redirect_uri', process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback');

      console.log(`🔍 [MEET] Client ID obtenido: ${clientId ? clientId.substring(0, 30) + '...' : 'NO ENCONTRADO'}`);
      console.log(`🔍 [MEET] Client Secret obtenido: ${clientSecret ? 'SÍ' : 'NO'}`);

      if (!clientId || !clientSecret) {
        throw new Error('Las credenciales de Google OAuth2 no están configuradas. Por favor, configura las credenciales en Ajustes.');
      }

      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );

      oauth2Client.setCredentials({
        access_token: comercial.meet_access_token,
        refresh_token: comercial.meet_refresh_token,
        expiry_date: comercial.meet_token_expires_at ? new Date(comercial.meet_token_expires_at).getTime() : null
      });

      // Verificar y refrescar token si es necesario
      try {
        const expiryDate = comercial.meet_token_expires_at ? new Date(comercial.meet_token_expires_at).getTime() : null;
        const now = Date.now();
        
        // Si el token expira en menos de 5 minutos, refrescarlo
        if (expiryDate && (expiryDate - now) < 5 * 60 * 1000) {
          console.log('🔄 Token expirando pronto, refrescando...');
          const { credentials } = await oauth2Client.refreshAccessToken();
          await this.guardarCredenciales(comercialId, {
            accessToken: credentials.access_token,
            refreshToken: credentials.refresh_token || comercial.meet_refresh_token,
            email: comercial.meet_email,
            expiresIn: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600
          });
          oauth2Client.setCredentials(credentials);
          console.log('✅ Token refrescado exitosamente');
        }
      } catch (refreshError) {
        console.warn('⚠️ Advertencia al verificar/refrescar token:', refreshError.message);
        // Continuar con el token actual si el refresh falla
      }

      console.log(`✅ [MEET] Cliente OAuth2 configurado correctamente`);
      return oauth2Client;
    } catch (error) {
      console.error('❌ [MEET] Error obteniendo cliente OAuth2 de Google:', error.message);
      console.error('❌ [MEET] Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Generar una reunión de Google Meet
   */
  async generarReunion(comercialId, { titulo, fecha, hora, duracionMinutos = 60, emailsInvitados = [] }) {
    try {
      console.log(`🔄 [MEET] Iniciando generación de reunión para comercial ${comercialId}`);
      console.log(`🔄 [MEET] Parámetros:`, { titulo, fecha, hora, duracionMinutos, emailsInvitados });
      
      const oauth2Client = await this.getOAuth2Client(comercialId);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      console.log(`✅ [MEET] Cliente de calendario creado`);

      // Combinar fecha y hora
      const fechaHora = new Date(`${fecha}T${hora}`);
      const fechaFin = new Date(fechaHora);
      fechaFin.setMinutes(fechaFin.getMinutes() + (duracionMinutos || 60));

      // Procesar emails de invitados
      let attendees = [];
      if (emailsInvitados && emailsInvitados.length > 0) {
        // Si es string, convertir a array
        if (typeof emailsInvitados === 'string') {
          // Separar por comas o saltos de línea
          attendees = emailsInvitados
            .split(/[,\n]/)
            .map(email => email.trim())
            .filter(email => email && this.validarEmail(email))
            .map(email => ({ email }));
        } else if (Array.isArray(emailsInvitados)) {
          attendees = emailsInvitados
            .map(email => typeof email === 'string' ? email.trim() : email)
            .filter(email => email && this.validarEmail(email))
            .map(email => ({ email }));
        }
      }

      // Crear evento en Google Calendar con Meet
      const event = {
        summary: titulo || 'Reunión',
        start: {
          dateTime: fechaHora.toISOString(),
          timeZone: 'Europe/Madrid'
        },
        end: {
          dateTime: fechaFin.toISOString(),
          timeZone: 'Europe/Madrid'
        },
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${comercialId}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        }
      };

      // Agregar invitados si hay
      if (attendees.length > 0) {
        event.attendees = attendees;
        event.sendUpdates = 'all'; // Enviar invitaciones automáticamente
      }

      const response = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        requestBody: event
      });

      if (response.data && response.data.hangoutLink) {
        return {
          success: true,
          joinUrl: response.data.hangoutLink,
          meetingId: response.data.id,
          titulo: response.data.summary,
          fechaInicio: response.data.start.dateTime,
          fechaFin: response.data.end.dateTime,
          invitadosEnviados: attendees.length,
          emailsInvitados: attendees.map(a => a.email)
        };
      }

      throw new Error('No se pudo generar el enlace de la reunión');
    } catch (error) {
      console.error('❌ Error generando reunión de Google Meet:', error.message);
      if (error.response) {
        console.error('❌ Respuesta de error:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Guardar credenciales de Google Meet para un comercial
   */
  async guardarCredenciales(comercialId, { accessToken, refreshToken, email, expiresIn }) {
    try {
      console.log(`🔄 [MEET] Guardando credenciales para comercial ${comercialId}...`);
      
      if (!accessToken) {
        throw new Error('accessToken es requerido');
      }
      
      if (!email) {
        throw new Error('email es requerido');
      }
      
      const expiresAt = expiresIn 
        ? new Date(Date.now() + expiresIn * 1000)
        : new Date(Date.now() + 3600 * 1000); // Por defecto 1 hora

      const sql = `UPDATE comerciales SET 
         meet_access_token = ?, 
         meet_refresh_token = ?, 
         meet_email = ?, 
         meet_token_expires_at = ?
         WHERE id = ?`;
      
      const params = [
        accessToken, 
        refreshToken || null, 
        email, 
        expiresAt, 
        comercialId
      ];
      
      console.log(`🔄 [MEET] Ejecutando query:`, { comercialId, email, hasRefreshToken: !!refreshToken });
      
      const result = await crm.query(sql, params);
      
      console.log(`✅ [MEET] Credenciales guardadas exitosamente para comercial ${comercialId}`);
      
      return { success: true };
    } catch (error) {
      console.error('❌ [MEET] Error guardando credenciales de Google Meet:', error.message);
      console.error('❌ [MEET] Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Validar formato de email
   */
  validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
}

module.exports = new MeetReuniones();

