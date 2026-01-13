<?php
/**
 * Configuración de conexión a MySQL
 * CRM Farmadescanso
 */

// Configuración de la base de datos - Base de datos remota Easypanel
define('DB_HOST', getenv('DB_HOST') ?: 'farmadescanso_sql-crm-farmadescanso');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_USER', getenv('DB_USER') ?: 'mysql');
define('DB_PASSWORD', getenv('DB_PASSWORD') ?: 'SqlFarma21');
define('DB_NAME', getenv('DB_NAME') ?: 'farmadescanso');

// Configuración de sesión
define('SESSION_LIFETIME', 3600); // 1 hora
define('SESSION_NAME', 'CRM_FARMADESCANSO');

// Configuración de seguridad
define('SALT', 'farmadescanso_2024_salt'); // Cambiar en producción

// Iniciar sesión
if (session_status() === PHP_SESSION_NONE) {
    session_name(SESSION_NAME);
    session_start();
}

/**
 * Conexión a MySQL
 */
class Database {
    private static $instance = null;
    private $connection;
    
    private function __construct() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ];
            
            $this->connection = new PDO($dsn, DB_USER, DB_PASSWORD, $options);
        } catch (PDOException $e) {
            error_log("Error de conexión a MySQL: " . $e->getMessage());
            die("Error de conexión a la base de datos. Por favor, contacte al administrador.");
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->connection;
    }
    
    public function query($sql, $params = []) {
        try {
            $stmt = $this->connection->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            error_log("Error en consulta SQL: " . $e->getMessage());
            error_log("SQL: " . $sql);
            throw $e;
        }
    }
    
    public function fetchAll($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetchAll();
    }
    
    public function fetchOne($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetch();
    }
    
    public function lastInsertId() {
        return $this->connection->lastInsertId();
    }
}

/**
 * Helper para obtener la conexión
 */
function getDB() {
    return Database::getInstance()->getConnection();
}

/**
 * Verificar si el usuario está autenticado
 */
function isAuthenticated() {
    return isset($_SESSION['user_id']) && isset($_SESSION['user_email']);
}

/**
 * Requerir autenticación
 */
function requireAuth() {
    if (!isAuthenticated()) {
        header('Location: /admin/login.php');
        exit;
    }
}

/**
 * Obtener usuario actual
 */
function getCurrentUser() {
    if (!isAuthenticated()) {
        return null;
    }
    
    $db = Database::getInstance();
    $user = $db->fetchOne(
        "SELECT * FROM comerciales WHERE Id = ? LIMIT 1",
        [$_SESSION['user_id']]
    );
    
    return $user;
}

/**
 * Sanitizar entrada
 */
function sanitize($data) {
    return htmlspecialchars(strip_tags(trim($data)), ENT_QUOTES, 'UTF-8');
}

/**
 * Respuesta JSON
 */
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

