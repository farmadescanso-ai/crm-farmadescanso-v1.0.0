/**
 * Kanban JavaScript
 * Funcionalidad drag & drop y gestión de leads
 */

let draggedElement = null;
let draggedFromColumn = null;

document.addEventListener('DOMContentLoaded', function() {
    initDragAndDrop();
    initEditLead();
});

/**
 * Inicializar drag and drop
 */
function initDragAndDrop() {
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-column');
    
    // Eventos para las tarjetas
    cards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.draggable = true;
    });
    
    // Eventos para las columnas
    columns.forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('dragleave', handleDragLeave);
        column.addEventListener('drop', handleDrop);
    });
}

/**
 * Inicio del arrastre
 */
function handleDragStart(e) {
    draggedElement = this;
    draggedFromColumn = this.closest('.kanban-column');
    
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

/**
 * Fin del arrastre
 */
function handleDragEnd(e) {
    this.classList.remove('dragging');
    
    // Limpiar clases de todas las columnas
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.classList.remove('drag-over');
    });
}

/**
 * Sobre una columna
 */
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    
    return false;
}

/**
 * Salir de una columna
 */
function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

/**
 * Soltar en una columna
 */
async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    e.preventDefault();
    this.classList.remove('drag-over');
    
    if (draggedElement !== null) {
        const targetColumn = this;
        const newEstado = targetColumn.getAttribute('data-estado');
        const leadId = draggedElement.getAttribute('data-lead-id');
        
        // Actualizar posición visual
        const cardsContainer = targetColumn.querySelector('.kanban-cards');
        cardsContainer.appendChild(draggedElement);
        
        // Actualizar contadores
        updateColumnCounts();
        
        // Actualizar estado en el servidor
        try {
            await updateLeadEstado(leadId, newEstado);
            
            // Mostrar mensaje de éxito
            if (window.adminUtils) {
                window.adminUtils.showAlert('Lead actualizado correctamente', 'success');
            }
        } catch (error) {
            console.error('Error actualizando lead:', error);
            
            // Revertir cambio visual
            const originalContainer = draggedFromColumn.querySelector('.kanban-cards');
            originalContainer.appendChild(draggedElement);
            updateColumnCounts();
            
            // Mostrar mensaje de error
            if (window.adminUtils) {
                window.adminUtils.showAlert('Error al actualizar el lead. Por favor, intente nuevamente.', 'error');
            }
        }
    }
    
    return false;
}

/**
 * Actualizar contadores de columnas
 */
function updateColumnCounts() {
    const columns = document.querySelectorAll('.kanban-column');
    
    columns.forEach(column => {
        const cardsContainer = column.querySelector('.kanban-cards');
        const count = cardsContainer.querySelectorAll('.kanban-card').length;
        const countElement = column.querySelector('.kanban-count');
        
        if (countElement) {
            countElement.textContent = count;
        }
    });
}

/**
 * Actualizar estado del lead en el servidor
 */
async function updateLeadEstado(leadId, nuevoEstado) {
    const formData = new FormData();
    formData.append('lead_id', leadId);
    formData.append('estado', nuevoEstado);
    formData.append('action', 'update_estado');
    
    const response = await fetch('/api/update-lead.php', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error('Error en la actualización');
    }
    
    return await response.json();
}

/**
 * Inicializar edición de leads
 */
function initEditLead() {
    const editLeadForm = document.getElementById('editLeadForm');
    
    if (editLeadForm) {
        editLeadForm.addEventListener('submit', handleEditLeadSubmit);
    }
}

/**
 * Editar lead
 */
function editLead(leadId) {
    // Obtener datos del lead
    fetch(`/api/get-lead.php?id=${leadId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const lead = data.lead;
                
                // Llenar formulario
                document.getElementById('edit_lead_id').value = lead.Id;
                document.getElementById('edit_nombre').value = lead.Nombre || lead.nombre || '';
                document.getElementById('edit_email').value = lead.Email || lead.email || '';
                document.getElementById('edit_telefono').value = lead.Telefono || lead.telefono || '';
                document.getElementById('edit_empresa').value = lead.Empresa || lead.empresa || '';
                document.getElementById('edit_estado').value = lead.Estado || lead.estado || 'nuevo';
                document.getElementById('edit_mensaje').value = lead.Mensaje || lead.mensaje || '';
                
                // Mostrar modal
                const modal = document.getElementById('editLeadModal');
                if (modal) {
                    modal.classList.add('show');
                }
            } else {
                if (window.adminUtils) {
                    window.adminUtils.showAlert('Error al cargar el lead', 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (window.adminUtils) {
                window.adminUtils.showAlert('Error al cargar el lead', 'error');
            }
        });
}

/**
 * Manejar envío del formulario de edición
 */
async function handleEditLeadSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    formData.append('action', 'update');
    
    try {
        const response = await fetch('/api/update-lead.php', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (window.adminUtils) {
                window.adminUtils.showAlert('Lead actualizado correctamente', 'success');
            }
            
            // Cerrar modal
            closeModal();
            
            // Recargar página después de un breve delay
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            if (window.adminUtils) {
                window.adminUtils.showAlert(data.message || 'Error al actualizar el lead', 'error');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        if (window.adminUtils) {
            window.adminUtils.showAlert('Error al actualizar el lead', 'error');
        }
    }
}

/**
 * Cerrar modal
 */
function closeModal() {
    const modal = document.getElementById('editLeadModal');
    if (modal) {
        modal.classList.remove('show');
    }
    
    // Limpiar formulario
    const form = document.getElementById('editLeadForm');
    if (form) {
        form.reset();
    }
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', function(e) {
    const modal = document.getElementById('editLeadModal');
    if (modal && e.target === modal) {
        closeModal();
    }
});

// Cerrar modal con ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// Exportar funciones globales
window.editLead = editLead;
window.closeModal = closeModal;

