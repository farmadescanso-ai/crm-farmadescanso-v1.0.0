<header class="admin-header">
    <div class="header-content">
        <div class="header-left">
            <h1 class="logo">CRM Farmadescanso</h1>
        </div>
        <div class="header-right">
            <div class="user-menu">
                <span class="user-name">
                    <i class="fas fa-user"></i>
                    <?php echo htmlspecialchars($user['Nombre'] ?? $user['nombre'] ?? 'Usuario'); ?>
                </span>
                <a href="/admin/logout.php" class="btn-logout" title="Cerrar sesión">
                    <i class="fas fa-sign-out-alt"></i>
                    Salir
                </a>
            </div>
        </div>
    </div>
</header>

