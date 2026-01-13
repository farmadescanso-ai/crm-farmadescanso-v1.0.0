/**
 * Sistema de Notificaciones Personalizado - Farmadescanso CRM
 * Reemplaza los alert() nativos del navegador con notificaciones modernas
 */

(function() {
  'use strict';

  // Crear contenedor de notificaciones si no existe
  let notificationContainer = null;

  function getNotificationContainer() {
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.className = 'notification-container';
      document.body.appendChild(notificationContainer);
    }
    return notificationContainer;
  }

  /**
   * Muestra una notificación personalizada
   * @param {string} message - Mensaje a mostrar
   * @param {string} type - Tipo de notificación: 'success', 'error', 'warning', 'info'
   * @param {object} options - Opciones adicionales
   * @param {number} options.duration - Duración en milisegundos (0 = sin auto-cierre)
   * @param {boolean} options.showProgress - Mostrar barra de progreso
   * @param {string} options.title - Título personalizado
   */
  function showNotification(message, type = 'info', options = {}) {
    const container = getNotificationContainer();
    const notification = document.createElement('div');
    const notificationId = 'notification-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const duration = options.duration !== undefined ? options.duration : 5000;
    const showProgress = options.showProgress !== undefined ? options.showProgress : (duration > 0);
    const title = options.title || getDefaultTitle(type);
    
    // Configurar clases y estilos
    notification.id = notificationId;
    notification.className = `notification ${type}`;
    
    // Iconos por tipo
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };
    
    // Construir HTML
    let html = `
      <div class="notification-header">
        <div class="notification-title">
          <i class="${icons[type] || icons.info}"></i>
          <span>${title}</span>
        </div>
        <button class="notification-close" aria-label="Cerrar" onclick="window.closeNotification('${notificationId}')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="notification-body">
        <p class="notification-message">${escapeHtml(message)}</p>
      </div>
    `;
    
    if (showProgress && duration > 0) {
      html += `<div class="notification-progress" style="animation-duration: ${duration}ms;"></div>`;
    }
    
    notification.innerHTML = html;
    
    // Agregar al contenedor
    container.appendChild(notification);
    
    // Auto-cierre si hay duración
    if (duration > 0) {
      setTimeout(() => {
        closeNotification(notificationId);
      }, duration);
    }
    
    // Retornar ID para control manual
    return notificationId;
  }

  /**
   * Cierra una notificación específica
   * @param {string} notificationId - ID de la notificación a cerrar
   */
  function closeNotification(notificationId) {
    const notification = document.getElementById(notificationId);
    if (notification) {
      notification.classList.add('closing');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }

  /**
   * Obtiene el título por defecto según el tipo
   */
  function getDefaultTitle(type) {
    const titles = {
      success: 'Operación exitosa',
      error: 'Error',
      warning: 'Advertencia',
      info: 'Información'
    };
    return titles[type] || titles.info;
  }

  /**
   * Escapa HTML para prevenir XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Reemplaza alert() nativo con notificaciones personalizadas
   */
  function replaceNativeAlerts() {
    // Guardar alert original si se necesita
    window._originalAlert = window.alert;
    
    // Reemplazar alert
    window.alert = function(message) {
      // Detectar tipo por el contenido del mensaje
      let type = 'info';
      if (message.includes('✅') || message.includes('correctamente') || message.includes('éxito') || message.includes('exitoso')) {
        type = 'success';
      } else if (message.includes('❌') || message.includes('Error') || message.includes('error')) {
        type = 'error';
      } else if (message.includes('⚠️') || message.includes('Advertencia') || message.includes('advertencia')) {
        type = 'warning';
      }
      
      // Limpiar emojis del mensaje
      const cleanMessage = message
        .replace(/✅/g, '')
        .replace(/❌/g, '')
        .replace(/⚠️/g, '')
        .replace(/⏱️/g, '')
        .trim();
      
      showNotification(cleanMessage, type, {
        duration: type === 'error' ? 7000 : 5000,
        showProgress: true
      });
    };
  }

  /**
   * API pública
   */
  window.showNotification = showNotification;
  window.closeNotification = closeNotification;
  
  // Funciones de conveniencia
  window.showSuccess = function(message, options) {
    return showNotification(message, 'success', options);
  };
  
  window.showError = function(message, options) {
    return showNotification(message, 'error', options);
  };
  
  window.showWarning = function(message, options) {
    return showNotification(message, 'warning', options);
  };
  
  window.showInfo = function(message, options) {
    return showNotification(message, 'info', options);
  };

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', replaceNativeAlerts);
  } else {
    replaceNativeAlerts();
  }

})();
