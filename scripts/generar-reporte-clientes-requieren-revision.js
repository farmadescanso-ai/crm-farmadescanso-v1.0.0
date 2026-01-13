/**
 * Script para generar un reporte de clientes que requieren revisión manual
 * Analiza los errores y genera un listado detallado
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const crm = require('../config/mysql-crm');

const EXCEL_FILE = 'C:\\Users\\pacol\\Downloads\\Clientes_exported_1.xlsx';

// Filas que tuvieron errores (basado en el reporte anterior)
const FILAS_CON_ERRORES = [
  { fila: 686, motivo: 'Teléfono demasiado largo', cliente: 'Oliver Hurtado, Maria' },
  { fila: 750, motivo: 'Teléfono demasiado largo', cliente: 'Farmacia - Quilis Arocas, Rosa Maria' },
  { fila: 761, motivo: 'Teléfono demasiado largo', cliente: 'Fernández Muñoz, Antonio' },
  { fila: 784, motivo: 'Teléfono demasiado largo', cliente: 'Top-to-toe Sl' },
  { fila: 789, motivo: 'CuentaContable duplicada', cliente: 'Imas Rpm Obispo Javier Azagra' },
  { fila: 790, motivo: 'CuentaContable duplicada', cliente: 'Mirafarma Sociedad Limitada.' },
  { fila: 805, motivo: 'CuentaContable duplicada', cliente: 'Farmacia Mayor - Soto Fernandez, Juan Angel' },
  { fila: 806, motivo: 'CuentaContable duplicada', cliente: 'Farmacia Aeropuerto - García Pérez, Marco Antonio' },
  { fila: 807, motivo: 'CuentaContable duplicada', cliente: 'Farmacia Torrealta - Campillo Ruiz, Cayetana' },
  { fila: 808, motivo: 'CuentaContable duplicada', cliente: 'Gómez Abellán, Jesús Joaquín' },
  { fila: 809, motivo: 'CuentaContable duplicada', cliente: 'Farmacia - Carreño Arias, Josefa' },
  { fila: 810, motivo: 'CuentaContable duplicada', cliente: 'Farmacia - Bueno Gimenez, Rafael' }
];

async function generarReporte() {
  try {
    console.log('📋 Generando reporte de clientes que requieren revisión...\n');
    
    // Leer Excel
    const workbook = XLSX.readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const datos = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    if (datos.length < 2) {
      throw new Error('El archivo Excel no tiene suficientes filas');
    }
    
    const headers = datos[0].map(h => String(h || '').trim());
    
    // Conectar a BD para verificar duplicados
    await crm.connect();
    const clientesDB = await crm.getClientes();
    
    let reporte = '═══════════════════════════════════════════════════════════════════════════════\n';
    reporte += '  CLIENTES QUE REQUIEREN REVISIÓN MANUAL\n';
    reporte += '═══════════════════════════════════════════════════════════════════════════════\n\n';
    reporte += `Fecha: ${new Date().toLocaleString('es-ES')}\n`;
    reporte += `Total de clientes con errores: ${FILAS_CON_ERRORES.length}\n\n`;
    reporte += '═══════════════════════════════════════════════════════════════════════════════\n\n';
    
    let numeroError = 1;
    
    for (const errorInfo of FILAS_CON_ERRORES) {
      const filaIndex = errorInfo.fila - 2; // -2 porque Excel empieza en 1 y fila 1 son headers
      
      if (filaIndex < 0 || filaIndex >= datos.length - 1) {
        continue;
      }
      
      const row = datos[filaIndex + 1];
      const cliente = {};
      
      // Mapear campos básicos
      const nombreIndex = headers.findIndex(h => h.toLowerCase().includes('nombre'));
      const movilIndex = headers.findIndex(h => h.toLowerCase().includes('movil') || h.toLowerCase().includes('tel'));
      const emailIndex = headers.findIndex(h => h.toLowerCase().includes('email'));
      const dniIndex = headers.findIndex(h => h.toLowerCase().includes('dni') || h.toLowerCase().includes('cif'));
      const cuentaIndex = headers.findIndex(h => h.toLowerCase().includes('cuenta'));
      const direccionIndex = headers.findIndex(h => h.toLowerCase().includes('direccion') || h.toLowerCase().includes('ubicacion'));
      const poblacionIndex = headers.findIndex(h => h.toLowerCase().includes('poblacion'));
      
      cliente.Nombre = nombreIndex >= 0 ? row[nombreIndex] : errorInfo.cliente;
      cliente.Movil = movilIndex >= 0 ? row[movilIndex] : null;
      cliente.Email = emailIndex >= 0 ? row[emailIndex] : null;
      cliente.DNI_CIF = dniIndex >= 0 ? row[dniIndex] : null;
      cliente.CuentaContable = cuentaIndex >= 0 ? row[cuentaIndex] : null;
      cliente.Direccion = direccionIndex >= 0 ? row[direccionIndex] : null;
      cliente.Poblacion = poblacionIndex >= 0 ? row[poblacionIndex] : null;
      
      reporte += `${numeroError}. FILA ${errorInfo.fila}: ${cliente.Nombre}\n`;
      reporte += `   ───────────────────────────────────────────────────────────────────────────\n`;
      reporte += `   Motivo del error: ${errorInfo.motivo}\n\n`;
      
      reporte += `   Datos del cliente:\n`;
      reporte += `   • Nombre: ${cliente.Nombre || 'N/A'}\n`;
      reporte += `   • DNI/CIF: ${cliente.DNI_CIF || 'N/A'}\n`;
      reporte += `   • Teléfono original: ${cliente.Movil || 'N/A'}`;
      if (cliente.Movil) {
        reporte += ` (${String(cliente.Movil).length} caracteres - máximo permitido: 13)`;
      }
      reporte += `\n`;
      reporte += `   • Email: ${cliente.Email || 'N/A'}\n`;
      reporte += `   • Cuenta Contable: ${cliente.CuentaContable || 'N/A'}`;
      
      // Si es error de CuentaContable duplicada, buscar el duplicado
      if (errorInfo.motivo.includes('CuentaContable')) {
        const duplicado = clientesDB.find(c => c.CuentaContable === cliente.CuentaContable);
        if (duplicado) {
          reporte += `\n      ⚠️  Esta cuenta ya está asignada a: "${duplicado.Nombre_Razon_Social || duplicado.Nombre || 'Cliente ID ' + duplicado.Id}" (ID: ${duplicado.Id || duplicado.id})`;
        }
      }
      reporte += `\n`;
      reporte += `   • Población: ${cliente.Poblacion || 'N/A'}\n`;
      reporte += `   • Dirección: ${cliente.Direccion || 'N/A'}\n`;
      
      // Recomendaciones
      reporte += `\n   Recomendaciones:\n`;
      if (errorInfo.motivo.includes('Teléfono')) {
        reporte += `   • Limpiar el teléfono quitando espacios, guiones y caracteres especiales\n`;
        reporte += `   • Si hay múltiples teléfonos separados por "/", usar solo el primero\n`;
        reporte += `   • Máximo 13 caracteres numéricos\n`;
        if (cliente.Movil) {
          const limpio = String(cliente.Movil).replace(/[^\d]/g, '').substring(0, 13);
          reporte += `   • Teléfono sugerido (limpiado): ${limpio}\n`;
        }
      } else if (errorInfo.motivo.includes('CuentaContable')) {
        reporte += `   • Verificar si este cliente es el mismo que el existente con esta cuenta\n`;
        reporte += `   • Si es diferente, asignar una nueva CuentaContable única\n`;
        reporte += `   • Si es el mismo cliente, actualizar el registro existente en lugar de crear uno nuevo\n`;
      }
      
      reporte += `\n\n`;
      numeroError++;
    }
    
    reporte += '═══════════════════════════════════════════════════════════════════════════════\n';
    reporte += 'FIN DEL REPORTE\n';
    reporte += '═══════════════════════════════════════════════════════════════════════════════\n';
    
    // Guardar reporte
    const reportePath = path.join(__dirname, 'clientes-requieren-revision.txt');
    fs.writeFileSync(reportePath, reporte, 'utf8');
    
    console.log(reporte);
    console.log(`\n✅ Reporte guardado en: ${reportePath}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

generarReporte();

