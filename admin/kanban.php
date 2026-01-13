<?php
/**
 * Sistema Kanban para gestión de leads
 * GET /admin/kanban.php
 */

require_once __DIR__ . '/../config.php';
requireAuth();

$db = Database::getInstance();
$user = getCurrentUser();

// Estados del Kanban
$estados = [
    'nuevo' => 'Nuevo',
    'contactado' => 'Contactado',
    'calificado' => 'Calificado',
    'propuesta' => 'Propuesta',
    'negociacion' => 'Negociación',
    'cerrado' => 'Cerrado',
    'perdido' => 'Perdido'
];

// Obtener todos los leads agrupados por estado
$leads_por_estado = [];
foreach ($estados as $estado_key => $estado_nombre) {
    $leads = $db->fetchAll(
        "SELECT * FROM clientes 
         WHERE (Estado = ? OR estado = ?) 
         ORDER BY FechaCreacion DESC",
        [$estado_key, $estado_key]
    );
    $leads_por_estado[$estado_key] = $leads;
}

// Si hay un lead_id en la URL, resaltarlo
$highlight_lead_id = isset($_GET['lead_id']) ? intval($_GET['lead_id']) : null;
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kanban - CRM Farmadescanso</title>
    <link rel="stylesheet" href="/admin/assets/css/admin.css">
    <link rel="stylesheet" href="/admin/assets/css/kanban.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <?php include __DIR__ . '/components/header.php'; ?>
    
    <div class="admin-container">
        <?php include __DIR__ . '/components/sidebar.php'; ?>
        
        <main class="main-content">
            <div class="page-header">
                <h1>Kanban de Leads</h1>
                <p>Gestión visual de leads por estado</p>
            </div>
            
            <div class="kanban-container">
                <?php foreach ($estados as $estado_key => $estado_nombre): ?>
                    <div class="kanban-column" data-estado="<?php echo htmlspecialchars($estado_key); ?>">
                        <div class="kanban-column-header">
                            <h3><?php echo htmlspecialchars($estado_nombre); ?></h3>
                            <span class="kanban-count"><?php echo count($leads_por_estado[$estado_key]); ?></span>
                        </div>
                        
                        <div class="kanban-cards" id="kanban-<?php echo htmlspecialchars($estado_key); ?>">
                            <?php foreach ($leads_por_estado[$estado_key] as $lead): ?>
                                <div 
                                    class="kanban-card <?php echo $highlight_lead_id === $lead['Id'] ? 'highlight' : ''; ?>" 
                                    data-lead-id="<?php echo $lead['Id']; ?>"
                                    draggable="true"
                                >
                                    <div class="kanban-card-header">
                                        <strong><?php echo htmlspecialchars($lead['Nombre'] ?? $lead['nombre'] ?? 'Sin nombre'); ?></strong>
                                        <span class="kanban-card-id">#<?php echo $lead['Id']; ?></span>
                                    </div>
                                    
                                    <div class="kanban-card-body">
                                        <p class="kanban-card-email">
                                            <i class="fas fa-envelope"></i>
                                            <?php echo htmlspecialchars($lead['Email'] ?? $lead['email'] ?? 'N/A'); ?>
                                        </p>
                                        <p class="kanban-card-phone">
                                            <i class="fas fa-phone"></i>
                                            <?php echo htmlspecialchars($lead['Telefono'] ?? $lead['telefono'] ?? 'N/A'); ?>
                                        </p>
                                        <?php if (!empty($lead['Empresa'] ?? $lead['empresa'])): ?>
                                            <p class="kanban-card-company">
                                                <i class="fas fa-building"></i>
                                                <?php echo htmlspecialchars($lead['Empresa'] ?? $lead['empresa']); ?>
                                            </p>
                                        <?php endif; ?>
                                    </div>
                                    
                                    <div class="kanban-card-footer">
                                        <small>
                                            <?php echo date('d/m/Y', strtotime($lead['FechaCreacion'] ?? $lead['fechaCreacion'] ?? 'now')); ?>
                                        </small>
                                        <div class="kanban-card-actions">
                                            <button 
                                                class="btn-icon" 
                                                onclick="editLead(<?php echo $lead['Id']; ?>)"
                                                title="Editar"
                                            >
                                                <i class="fas fa-edit"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </main>
    </div>
    
    <!-- Modal para editar lead -->
    <div id="editLeadModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Editar Lead</h2>
                <span class="modal-close" onclick="closeModal()">&times;</span>
            </div>
            <div class="modal-body">
                <form id="editLeadForm">
                    <input type="hidden" id="edit_lead_id" name="lead_id">
                    
                    <div class="form-group">
                        <label for="edit_nombre">Nombre</label>
                        <input type="text" id="edit_nombre" name="nombre" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit_email">Email</label>
                        <input type="email" id="edit_email" name="email" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit_telefono">Teléfono</label>
                        <input type="tel" id="edit_telefono" name="telefono" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit_empresa">Empresa</label>
                        <input type="text" id="edit_empresa" name="empresa">
                    </div>
                    
                    <div class="form-group">
                        <label for="edit_estado">Estado</label>
                        <select id="edit_estado" name="estado" required>
                            <?php foreach ($estados as $estado_key => $estado_nombre): ?>
                                <option value="<?php echo htmlspecialchars($estado_key); ?>">
                                    <?php echo htmlspecialchars($estado_nombre); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit_mensaje">Mensaje/Notas</label>
                        <textarea id="edit_mensaje" name="mensaje" rows="4"></textarea>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <script src="/admin/assets/js/admin.js"></script>
    <script src="/admin/assets/js/kanban.js"></script>
</body>
</html>

