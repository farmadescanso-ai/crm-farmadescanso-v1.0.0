// Objeto Farmadescaso con utilidades básicas
const Farmadescaso = {
    // Hacer peticiones HTTP
    async makeRequest(url, options = {}) {
        try {
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            const data = await response.json();
            return { success: response.ok, data };
        } catch (error) {
            console.error('Error en petición:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Mostrar loading
    showLoading(element) {
        if (element) {
            element.disabled = true;
            const originalHTML = element.innerHTML;
            element.dataset.originalHTML = originalHTML;
            element.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
    },
    
    // Ocultar loading
    hideLoading(element) {
        if (element) {
            element.disabled = false;
            if (element.dataset.originalHTML) {
                element.innerHTML = element.dataset.originalHTML;
            }
        }
    },
    
    // Mostrar toast/notificación
    showToast(message, type = 'info') {
        // Implementación simple con console.log por ahora
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Si hay Bootstrap disponible, usar sus toasts
        if (typeof bootstrap !== 'undefined') {
            // Crear toast de Bootstrap si es necesario
        }
    },
    
    // Formatear moneda
    formatCurrency(value) {
        const num = Number(value || 0);
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR'
        }).format(num);
    },
    
    // Formatear fecha
    formatDate(date) {
        if (!date) return '-';
        const d = new Date(date);
        return d.toLocaleDateString('es-ES');
    },
    
    // Exportar a CSV
    exportToCSV(data, filename) {
        // Implementación básica de exportación CSV
        console.log('Exportar a CSV:', filename, data);
    }
};

// JavaScript específico para el dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar gráficos
    initializeCharts();
    
    // Configurar eventos del dashboard
    setupDashboardEvents();
    
    // Cargar datos iniciales (comentado porque las APIs no existen)
    // loadDashboardData();
});

// Función para inicializar los gráficos
function initializeCharts() {
    // Gráfico de ventas por mes
    const salesCtx = document.getElementById('salesChart');
    if (salesCtx) {
        new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
                datasets: [{
                    label: 'Ventas (€)',
                    data: [12000, 15000, 18000, 14000, 20000, 22000],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 6,
                        hoverRadius: 8
                    }
                }
            }
        });
    }

    // Gráfico de productos más vendidos
    const productsCtx = document.getElementById('productsChart');
    if (productsCtx) {
        new Chart(productsCtx, {
            type: 'doughnut',
            data: {
                labels: ['Producto A', 'Producto B', 'Producto C', 'Otros'],
                datasets: [{
                    data: [35, 25, 20, 20],
                    backgroundColor: [
                        '#667eea',
                        '#764ba2',
                        '#28a745',
                        '#ffc107'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
}

// Función para configurar eventos del dashboard
function setupDashboardEvents() {
    // Botón de actualizar datos
    const refreshBtn = document.querySelector('[onclick="refreshData()"]');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }

    // Auto-refresh cada 5 minutos
    setInterval(refreshData, 300000);

    // Configurar sidebar toggle para móviles
    const sidebarToggle = document.querySelector('.navbar-toggler');
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    // Cerrar sidebar al hacer clic en un enlace en móviles
    const sidebarLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 991.98) {
                sidebar.classList.remove('show');
            }
        });
    });
}

// Función para refrescar datos del dashboard
async function refreshData() {
    const refreshBtn = document.querySelector('[onclick="refreshData()"]');
    if (refreshBtn) {
        Farmadescaso.showLoading(refreshBtn);
    }

    try {
        // Obtener estadísticas actualizadas
        const statsResponse = await Farmadescaso.makeRequest('/api/estadisticas');
        
        if (statsResponse.success) {
            updateStatsCards(statsResponse.data);
            updateCharts(statsResponse.data);
        }

        // Obtener ventas recientes
        const ventasResponse = await Farmadescaso.makeRequest('/api/ventas');
        
        if (ventasResponse.success) {
            updateRecentSales(ventasResponse.data);
        }

        Farmadescaso.showToast('Datos actualizados correctamente', 'success');
    } catch (error) {
        console.error('Error actualizando datos:', error);
        Farmadescaso.showToast('Error al actualizar datos', 'danger');
    } finally {
        if (refreshBtn) {
            Farmadescaso.hideLoading(refreshBtn);
        }
    }
}

// Función para actualizar las tarjetas de estadísticas
function updateStatsCards(data) {
    const statCards = document.querySelectorAll('.stat-card');
    
    statCards.forEach(card => {
        const valueElement = card.querySelector('.stat-value');
        const labelElement = card.querySelector('.stat-label');
        
        if (valueElement && labelElement) {
            const label = labelElement.textContent.toLowerCase();
            
            switch (label) {
                case 'total ventas':
                    valueElement.textContent = Farmadescaso.formatCurrency(data.totalVentas);
                    break;
                case 'este mes':
                    valueElement.textContent = Farmadescaso.formatCurrency(data.totalEsteMes);
                    break;
                case 'ventas este mes':
                    valueElement.textContent = data.ventasEsteMes;
                    break;
                case 'productos':
                    valueElement.textContent = data.totalProductos;
                    break;
            }
        }
    });
}

// Función para actualizar los gráficos
function updateCharts(data) {
    // Actualizar gráfico de ventas por mes
    const salesChart = Chart.getChart('salesChart');
    if (salesChart && data.ventasPorMes) {
        const labels = data.ventasPorMes.map(item => item.mes);
        const values = data.ventasPorMes.map(item => item.total);
        
        salesChart.data.labels = labels;
        salesChart.data.datasets[0].data = values;
        salesChart.update();
    }
}

// Función para actualizar la tabla de ventas recientes
function updateRecentSales(ventas) {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;

    if (ventas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    <i class="fas fa-inbox me-2"></i>No hay ventas registradas
                </td>
            </tr>
        `;
        return;
    }

    const ventasHTML = ventas.slice(0, 10).map(venta => `
        <tr>
            <td>${venta.producto_nombre || 'Producto'}</td>
            <td>${venta.cantidad}</td>
            <td>${Farmadescaso.formatCurrency(venta.precio_unitario)}</td>
            <td class="fw-bold">${Farmadescaso.formatCurrency(venta.cantidad * venta.precio_unitario)}</td>
            <td>${Farmadescaso.formatDate(venta.fecha)}</td>
        </tr>
    `).join('');

    tbody.innerHTML = ventasHTML;
}

// Función para cargar datos iniciales del dashboard
async function loadDashboardData() {
    try {
        // Mostrar loading en las tarjetas de estadísticas
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => {
            card.style.opacity = '0.6';
        });

        // Las APIs /api/estadisticas y /api/ventas no existen, 
        // los datos ya vienen renderizados desde el servidor
        // Por lo tanto, no necesitamos cargar datos adicionales

        // Restaurar opacidad de las tarjetas
        statCards.forEach(card => {
            card.style.opacity = '1';
        });

    } catch (error) {
        console.error('Error cargando datos del dashboard:', error);
        // No mostrar toast si Farmadescaso no está disponible
        if (typeof Farmadescaso !== 'undefined' && Farmadescaso.showToast) {
            Farmadescaso.showToast('Error cargando datos del dashboard', 'danger');
        }
    }
}

// Función para exportar datos del dashboard
function exportDashboardData() {
    const data = {
        fecha: new Date().toISOString(),
        estadisticas: {
            totalVentas: document.querySelector('.stat-card:nth-child(1) .stat-value').textContent,
            ventasEsteMes: document.querySelector('.stat-card:nth-child(2) .stat-value').textContent,
            totalEsteMes: document.querySelector('.stat-card:nth-child(3) .stat-value').textContent,
            totalProductos: document.querySelector('.stat-card:nth-child(4) .stat-value').textContent
        }
    };

    Farmadescaso.exportToCSV([data], `dashboard-${new Date().toISOString().split('T')[0]}.csv`);
}

// Función para imprimir dashboard
function printDashboard() {
    window.print();
}

// Función para configurar notificaciones push (solo cuando el usuario lo solicite)
function setupNotifications() {
    // Solo solicitar permisos si el usuario ya ha interactuado con la página
    // No solicitar automáticamente al cargar para evitar violaciones de políticas
    if ('Notification' in window && Notification.permission === 'default') {
        // No solicitar automáticamente - solo cuando el usuario haga clic en un botón
        console.log('Las notificaciones están disponibles pero requieren un gesto del usuario');
        return;
    }
    
    // Si ya se concedió o denegó, solo loguear
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            console.log('Permisos de notificación ya concedidos');
        } else if (Notification.permission === 'denied') {
            console.log('Permisos de notificación denegados');
        }
    }
}

// Función para solicitar permisos de notificación (debe llamarse desde un evento de usuario)
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Permisos de notificación concedidos');
            } else {
                console.log('Permisos de notificación denegados');
            }
        });
    } else if (Notification.permission === 'granted') {
        console.log('Permisos de notificación ya concedidos');
    } else {
        console.log('Permisos de notificación no disponibles o denegados');
    }
}

// Función para mostrar modal de nueva venta rápida
function showQuickSaleModal() {
    // Esta función se implementaría con un modal de Bootstrap
    Farmadescaso.showToast('Función de venta rápida en desarrollo', 'info');
}

// Función para configurar shortcuts de teclado
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl + R para refrescar datos
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            refreshData();
        }
        
        // Ctrl + N para nueva venta
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            window.location.href = '/dashboard/ventas/nueva';
        }
        
        // Escape para cerrar sidebar en móviles
        if (e.key === 'Escape') {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('show')) {
                sidebar.classList.remove('show');
            }
        }
    });
}

// Inicializar shortcuts de teclado
setupKeyboardShortcuts();

// Verificar estado de notificaciones (sin solicitar permisos automáticamente)
setupNotifications();

// Exportar funciones globales del dashboard
window.Dashboard = {
    refreshData,
    exportDashboardData,
    printDashboard,
    showQuickSaleModal
};























