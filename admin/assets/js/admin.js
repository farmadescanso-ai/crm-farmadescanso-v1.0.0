/**
 * Admin Panel JavaScript
 * Funcionalidades generales del panel administrativo
 */

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar funcionalidades
    initTooltips();
    initConfirmations();
    initResponsiveMenu();
});

/**
 * Inicializar tooltips
 */
function initTooltips() {
    const tooltips = document.querySelectorAll('[title]');
    tooltips.forEach(element => {
        element.addEventListener('mouseenter', function(e) {
            // Aquí se podría agregar lógica de tooltips personalizados
        });
    });
}

/**
 * Inicializar confirmaciones de acciones
 */
function initConfirmations() {
    const deleteButtons = document.querySelectorAll('[data-confirm]');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const message = this.getAttribute('data-confirm');
            if (!confirm(message || '¿Está seguro de realizar esta acción?')) {
                e.preventDefault();
                return false;
            }
        });
    });
}

/**
 * Menú responsive
 */
function initResponsiveMenu() {
    const sidebar = document.querySelector('.admin-sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    
    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });
    }
    
    // Cerrar sidebar al hacer clic fuera en móvil
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (sidebar && sidebar.classList.contains('open')) {
                if (!sidebar.contains(e.target) && !e.target.closest('#sidebar-toggle')) {
                    sidebar.classList.remove('open');
                }
            }
        }
    });
}

/**
 * Mostrar alerta temporal
 */
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.insertBefore(alertDiv, mainContent.firstChild);
        
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transition = 'opacity 0.3s';
            setTimeout(() => alertDiv.remove(), 300);
        }, 3000);
    }
}

/**
 * Formatear fecha
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Formatear fecha y hora
 */
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Validar email
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Hacer petición AJAX
 */
async function makeRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error en la petición');
        }
        
        return data;
    } catch (error) {
        console.error('Error en petición:', error);
        throw error;
    }
}

/**
 * Exportar funciones globales
 */
window.adminUtils = {
    showAlert,
    formatDate,
    formatDateTime,
    isValidEmail,
    makeRequest
};

