<?php
/**
 * Panel Administrativo
 * Dashboard principal del CRM
 */

require_once __DIR__ . '/../config.php';
requireAuth();

$db = Database::getInstance();
$user = getCurrentUser();

// Obtener estadísticas
$stats = [
    'total_clientes' => $db->fetchOne("SELECT COUNT(*) as count FROM clientes")['count'] ?? 0,
    'total_pedidos' => $db->fetchOne("SELECT COUNT(*) as count FROM pedidos")['count'] ?? 0,
    'total_visitas' => $db->fetchOne("SELECT COUNT(*) as count FROM visitas")['count'] ?? 0,
    'pedidos_activos' => $db->fetchOne("SELECT COUNT(*) as count FROM pedidos WHERE Activo = 1")['count'] ?? 0,
    'leads_nuevos' => $db->fetchOne("SELECT COUNT(*) as count FROM clientes WHERE Estado = 'nuevo' OR estado = 'nuevo'")['count'] ?? 0
];

// Obtener leads recientes
$leads_recientes = $db->fetchAll(
    "SELECT * FROM clientes ORDER BY FechaCreacion DESC LIMIT 10"
);

// Obtener pedidos recientes
$pedidos_recientes = $db->fetchAll(
    "SELECT p.*, c.Nombre as ClienteNombre 
     FROM pedidos p 
     LEFT JOIN clientes c ON p.ClienteId = c.Id OR p.clienteId = c.Id 
     ORDER BY p.Id DESC LIMIT 10"
);
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel Administrativo - CRM Farmadescanso</title>
    <link rel="stylesheet" href="/admin/assets/css/admin.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <?php include __DIR__ . '/components/header.php'; ?>
    
    <div class="admin-container">
        <?php include __DIR__ . '/components/sidebar.php'; ?>
        
        <main class="main-content">
            <div class="page-header">
                <h1>Dashboard</h1>
                <p>Bienvenido, <?php echo htmlspecialchars($user['Nombre'] ?? $user['nombre'] ?? 'Usuario'); ?></p>
            </div>
            
            <!-- Estadísticas -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon" style="background: #667eea;">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-content">
                        <h3><?php echo number_format($stats['total_clientes']); ?></h3>
                        <p>Total Clientes</p>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: #764ba2;">
                        <i class="fas fa-shopping-cart"></i>
                    </div>
                    <div class="stat-content">
                        <h3><?php echo number_format($stats['total_pedidos']); ?></h3>
                        <p>Total Pedidos</p>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: #28a745;">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="stat-content">
                        <h3><?php echo number_format($stats['pedidos_activos']); ?></h3>
                        <p>Pedidos Activos</p>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: #ffc107;">
                        <i class="fas fa-star"></i>
                    </div>
                    <div class="stat-content">
                        <h3><?php echo number_format($stats['leads_nuevos']); ?></h3>
                        <p>Leads Nuevos</p>
                    </div>
                </div>
            </div>
            
            <!-- Leads Recientes -->
            <div class="content-section">
                <div class="section-header">
                    <h2>Leads Recientes</h2>
                    <a href="/admin/kanban.php" class="btn btn-primary">
                        <i class="fas fa-columns"></i> Ver Kanban
                    </a>
                </div>
                
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Teléfono</th>
                                <th>Estado</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if (empty($leads_recientes)): ?>
                                <tr>
                                    <td colspan="7" class="text-center">No hay leads recientes</td>
                                </tr>
                            <?php else: ?>
                                <?php foreach ($leads_recientes as $lead): ?>
                                    <tr>
                                        <td><?php echo htmlspecialchars($lead['Id']); ?></td>
                                        <td><?php echo htmlspecialchars($lead['Nombre'] ?? $lead['nombre'] ?? 'N/A'); ?></td>
                                        <td><?php echo htmlspecialchars($lead['Email'] ?? $lead['email'] ?? 'N/A'); ?></td>
                                        <td><?php echo htmlspecialchars($lead['Telefono'] ?? $lead['telefono'] ?? 'N/A'); ?></td>
                                        <td>
                                            <span class="badge badge-<?php echo ($lead['Estado'] ?? $lead['estado'] ?? 'nuevo') === 'nuevo' ? 'warning' : 'success'; ?>">
                                                <?php echo htmlspecialchars($lead['Estado'] ?? $lead['estado'] ?? 'nuevo'); ?>
                                            </span>
                                        </td>
                                        <td><?php echo date('d/m/Y H:i', strtotime($lead['FechaCreacion'] ?? $lead['fechaCreacion'] ?? 'now')); ?></td>
                                        <td>
                                            <a href="/admin/kanban.php?lead_id=<?php echo $lead['Id']; ?>" class="btn btn-sm btn-primary">
                                                <i class="fas fa-eye"></i>
                                            </a>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Pedidos Recientes -->
            <div class="content-section">
                <div class="section-header">
                    <h2>Pedidos Recientes</h2>
                </div>
                
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Número Pedido</th>
                                <th>Cliente</th>
                                <th>Fecha</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if (empty($pedidos_recientes)): ?>
                                <tr>
                                    <td colspan="6" class="text-center">No hay pedidos recientes</td>
                                </tr>
                            <?php else: ?>
                                <?php foreach ($pedidos_recientes as $pedido): ?>
                                    <tr>
                                        <td><?php echo htmlspecialchars($pedido['Id']); ?></td>
                                        <td><?php echo htmlspecialchars($pedido['NumeroPedido'] ?? $pedido['numeroPedido'] ?? 'N/A'); ?></td>
                                        <td><?php echo htmlspecialchars($pedido['ClienteNombre'] ?? 'N/A'); ?></td>
                                        <td><?php echo date('d/m/Y', strtotime($pedido['FechaCreacion'] ?? $pedido['fechaCreacion'] ?? 'now')); ?></td>
                                        <td>
                                            <span class="badge badge-<?php echo ($pedido['Activo'] ?? $pedido['activo'] ?? 0) ? 'success' : 'secondary'; ?>">
                                                <?php echo ($pedido['Activo'] ?? $pedido['activo'] ?? 0) ? 'Activo' : 'Inactivo'; ?>
                                            </span>
                                        </td>
                                        <td>
                                            <a href="#" class="btn btn-sm btn-primary">
                                                <i class="fas fa-eye"></i>
                                            </a>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>
    
    <script src="/admin/assets/js/admin.js"></script>
</body>
</html>

