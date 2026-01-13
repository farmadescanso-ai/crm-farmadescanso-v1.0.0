<?php
/**
 * Página de login
 * GET /admin/login.php - Mostrar formulario
 * POST /admin/login.php - Procesar login
 */

require_once __DIR__ . '/../config.php';

// Si ya está autenticado, redirigir al panel
if (isAuthenticated()) {
    header('Location: /admin/index.php');
    exit;
}

$error = '';
$success = '';

// Procesar login
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = isset($_POST['email']) ? trim($_POST['email']) : '';
    $password = isset($_POST['password']) ? $_POST['password'] : '';
    
    if (empty($email) || empty($password)) {
        $error = 'Por favor, complete todos los campos';
    } else {
        try {
            $db = Database::getInstance();
            
            // Buscar comercial por email (case insensitive)
            $user = $db->fetchOne(
                "SELECT * FROM comerciales WHERE LOWER(Email) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1",
                [$email, $email]
            );
            
            if ($user) {
                // Verificar contraseña
                // Buscar en diferentes campos posibles
                $passwordFields = ['password', 'Password', 'contraseña', 'Contraseña', 'DNI', 'dni'];
                $passwordMatch = false;
                
                foreach ($passwordFields as $field) {
                    if (isset($user[$field]) && $user[$field] === $password) {
                        $passwordMatch = true;
                        break;
                    }
                }
                
                if ($passwordMatch) {
                    // Login exitoso
                    $_SESSION['user_id'] = $user['Id'];
                    $_SESSION['user_email'] = $user['Email'] ?? $user['email'];
                    $_SESSION['user_nombre'] = $user['Nombre'] ?? $user['nombre'] ?? '';
                    $_SESSION['login_time'] = time();
                    
                    // Regenerar ID de sesión por seguridad
                    session_regenerate_id(true);
                    
                    header('Location: /admin/index.php');
                    exit;
                } else {
                    $error = 'Email o contraseña incorrectos';
                }
            } else {
                $error = 'Email o contraseña incorrectos';
            }
        } catch (Exception $e) {
            error_log("Error en login: " . $e->getMessage());
            $error = 'Error al procesar el login. Por favor, intente más tarde.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - CRM Farmadescanso</title>
    <link rel="stylesheet" href="/admin/assets/css/login.css">
</head>
<body>
    <div class="login-container">
        <div class="login-box">
            <div class="login-header">
                <h1>CRM Farmadescanso</h1>
                <p>Panel Administrativo</p>
            </div>
            
            <?php if ($error): ?>
                <div class="alert alert-error">
                    <?php echo htmlspecialchars($error); ?>
                </div>
            <?php endif; ?>
            
            <?php if ($success): ?>
                <div class="alert alert-success">
                    <?php echo htmlspecialchars($success); ?>
                </div>
            <?php endif; ?>
            
            <form method="POST" action="/admin/login.php" class="login-form">
                <div class="form-group">
                    <label for="email">Email</label>
                    <input 
                        type="email" 
                        id="email" 
                        name="email" 
                        autocomplete="email"
                        required 
                        autofocus
                        placeholder="tu@email.com"
                        value="<?php echo isset($_POST['email']) ? htmlspecialchars($_POST['email']) : ''; ?>"
                    >
                </div>
                
                <div class="form-group">
                    <label for="password">Contraseña</label>
                    <input 
                        type="password" 
                        id="password" 
                        name="password" 
                        autocomplete="current-password"
                        required
                        placeholder="••••••••"
                    >
                </div>
                
                <button type="submit" class="btn btn-primary btn-block">
                    Iniciar Sesión
                </button>
            </form>
        </div>
    </div>
</body>
</html>

