// Sistema de captura de logs del servidor
class ServerLogs {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000; // Mantener los últimos 1000 logs
    this.errors = [];
    this.maxErrors = 500; // Mantener los últimos 500 errores
    // Guardar referencias a los métodos originales ANTES de interceptarlos
    this.originalLog = console.log;
    this.originalError = console.error;
    this.originalWarn = console.warn;
    this.originalInfo = console.info;
    this.originalDebug = console.debug;
  }

  /**
   * Agregar un log
   */
  addLog(level, message, data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level, // 'info', 'warn', 'error', 'debug'
      message: message,
      data: data
    };

    this.logs.push(logEntry);
    
    // Mantener solo los últimos maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Si es un error, también guardarlo en la lista de errores
    if (level === 'error') {
      this.errors.push(logEntry);
      if (this.errors.length > this.maxErrors) {
        this.errors.shift();
      }
    }

    // Usar los métodos ORIGINALES para evitar bucle infinito
    const consoleMethod = this[`original${level.charAt(0).toUpperCase() + level.slice(1)}`] || this.originalLog;
    if (data) {
      consoleMethod.call(console, `[${logEntry.timestamp}] ${message}`, data);
    } else {
      consoleMethod.call(console, `[${logEntry.timestamp}] ${message}`);
    }
  }

  /**
   * Obtener todos los logs
   */
  getAllLogs(level = null) {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return this.logs;
  }

  /**
   * Obtener solo errores
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Obtener logs recientes (últimos N)
   */
  getRecentLogs(count = 100) {
    return this.logs.slice(-count);
  }

  /**
   * Limpiar logs
   */
  clearLogs() {
    this.logs = [];
    this.errors = [];
  }

  /**
   * Obtener logs como texto para exportar
   */
  getLogsAsText() {
    return this.logs.map(log => {
      const dataStr = log.data ? JSON.stringify(log.data, null, 2) : '';
      return `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${dataStr ? '\n' + dataStr : ''}`;
    }).join('\n\n');
  }
}

// Crear instancia singleton
const serverLogs = new ServerLogs();

// Interceptar console.log, console.error, etc. DESPUÉS de crear la instancia
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;
const originalDebug = console.debug;

console.log = function(...args) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  serverLogs.addLog('info', message);
  originalLog.apply(console, args);
};

console.error = function(...args) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  serverLogs.addLog('error', message);
  originalError.apply(console, args);
};

console.warn = function(...args) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  serverLogs.addLog('warn', message);
  originalWarn.apply(console, args);
};

console.info = function(...args) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  serverLogs.addLog('info', message);
  originalInfo.apply(console, args);
};

console.debug = function(...args) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  serverLogs.addLog('debug', message);
  originalDebug.apply(console, args);
};

module.exports = serverLogs;
