// Utilidad para generar reuniones de Microsoft Teams
const axios = require('axios');
const crm = require('../config/mysql-crm');

class TeamsReuniones {
  /**
   * Obtener token de acceso de Teams para un comercial
   */
  async getAccessToken(comercialId) {
    try {
      const comercial = await crm.getComercialById(comercialId);
      if (!comercial) {
        throw new Error('Comercial no encontrado');
      }

      // Verificar si hay token y si no ha expirado
      if (comercial.teams_access_token && comercial.teams_token_expires_at) {
        const expiresAt = new Date(comercial.teams_token_expires_at);
        if (expiresAt > new Date()) {
          return comercial.teams_access_token;
        }
      }

      // Si el token expiró o no existe, intentar refrescarlo
      if (comercial.teams_refresh_token) {
        return await this.refreshAccessToken(comercialId, comercial.teams_refresh_token);
      }

      throw new Error('No hay credenciales de Teams configuradas. Por favor, configura tu cuenta de Teams en tu perfil.');
    } catch (error) {
      console.error('❌ Error obteniendo token de Teams:', error.message);
      throw error;
    }
  }

  /**
   * Refrescar token de acceso de Teams
   */
  async refreshAccessToken(comercialId, refreshToken) {
    try {
      // TODO: Implementar refresh token con Microsoft OAuth2
      // Por ahora, lanzar error para que el usuario reconfigure
      throw new Error('Token expirado. Por favor, reconecta tu cuenta de Teams.');
    } catch (error) {
      console.error('❌ Error refrescando token de Teams:', error.message);
      throw error;
    }
  }

  /**
   * Generar una reunión de Teams
   */
  async generarReunion(comercialId, { titulo, fecha, hora, duracionMinutos = 60, emailsInvitados = [] }) {
    try {
      const accessToken = await this.getAccessToken(comercialId);
      
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
            .map(email => ({
              emailAddress: {
                address: email,
                name: email.split('@')[0] // Usar parte antes del @ como nombre
              },
              type: 'required'
            }));
        } else if (Array.isArray(emailsInvitados)) {
          attendees = emailsInvitados
            .map(email => typeof email === 'string' ? email.trim() : email)
            .filter(email => email && this.validarEmail(email))
            .map(email => ({
              emailAddress: {
                address: email,
                name: email.split('@')[0]
              },
              type: 'required'
            }));
        }
      }

      // Crear evento en Microsoft Graph API
      const eventData = {
        subject: titulo || 'Reunión',
        start: {
          dateTime: fechaHora.toISOString(),
          timeZone: 'Europe/Madrid'
        },
        end: {
          dateTime: fechaFin.toISOString(),
          timeZone: 'Europe/Madrid'
        },
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness'
      };

      // Agregar invitados si hay
      if (attendees.length > 0) {
        eventData.attendees = attendees;
      }

      const response = await axios.post(
        'https://graph.microsoft.com/v1.0/me/calendar/events',
        eventData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.onlineMeeting && response.data.onlineMeeting.joinUrl) {
        // Enviar invitaciones por separado si hay invitados (Teams no las envía automáticamente)
        let invitadosEnviados = 0;
        if (attendees.length > 0) {
          try {
            // Microsoft Graph envía las invitaciones automáticamente cuando se crea el evento con attendees
            invitadosEnviados = attendees.length;
          } catch (error) {
            console.warn('⚠️ Advertencia al enviar invitaciones de Teams:', error.message);
          }
        }

        return {
          success: true,
          joinUrl: response.data.onlineMeeting.joinUrl,
          meetingId: response.data.id,
          titulo: response.data.subject,
          fechaInicio: response.data.start.dateTime,
          fechaFin: response.data.end.dateTime,
          invitadosEnviados: invitadosEnviados,
          emailsInvitados: attendees.map(a => a.emailAddress.address)
        };
      }

      throw new Error('No se pudo generar el enlace de la reunión');
    } catch (error) {
      console.error('❌ Error generando reunión de Teams:', error.message);
      if (error.response) {
        console.error('❌ Respuesta de error:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Guardar credenciales de Teams para un comercial
   */
  async guardarCredenciales(comercialId, { accessToken, refreshToken, email, expiresIn }) {
    try {
      const expiresAt = expiresIn 
        ? new Date(Date.now() + expiresIn * 1000)
        : new Date(Date.now() + 3600 * 1000); // Por defecto 1 hora

      await crm.query(
        `UPDATE comerciales SET 
         teams_access_token = ?, 
         teams_refresh_token = ?, 
         teams_email = ?, 
         teams_token_expires_at = ?
         WHERE id = ?`,
        [accessToken, refreshToken, email, expiresAt, comercialId]
      );

      return { success: true };
    } catch (error) {
      console.error('❌ Error guardando credenciales de Teams:', error.message);
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

module.exports = new TeamsReuniones();

