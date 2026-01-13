<aside class="admin-sidebar">
    <nav class="sidebar-nav">
        <ul>
            <li>
                <a href="/admin/index.php" class="nav-link <?php echo basename($_SERVER['PHP_SELF']) === 'index.php' ? 'active' : ''; ?>">
                    <i class="fas fa-home"></i>
                    <span>Dashboard</span>
                </a>
            </li>
            <li>
                <a href="/admin/kanban.php" class="nav-link <?php echo basename($_SERVER['PHP_SELF']) === 'kanban.php' ? 'active' : ''; ?>">
                    <i class="fas fa-columns"></i>
                    <span>Kanban</span>
                </a>
            </li>
            <li>
                <a href="#" class="nav-link">
                    <i class="fas fa-users"></i>
                    <span>Clientes</span>
                </a>
            </li>
            <li>
                <a href="#" class="nav-link">
                    <i class="fas fa-shopping-cart"></i>
                    <span>Pedidos</span>
                </a>
            </li>
            <li>
                <a href="#" class="nav-link">
                    <i class="fas fa-calendar"></i>
                    <span>Visitas</span>
                </a>
            </li>
            <li>
                <a href="#" class="nav-link">
                    <i class="fas fa-chart-bar"></i>
                    <span>Reportes</span>
                </a>
            </li>
        </ul>
    </nav>
</aside>

