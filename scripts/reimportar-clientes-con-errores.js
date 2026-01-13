/**
 * Script para reimportar clientes que tuvieron errores en la importación
 * Lee los datos del Excel y procesa solo los que fallaron
 */

const XLSX = require('xlsx');
const path = require('path');
const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

const EXCEL_FILE = 'C:\\Users\\pacol\\Downloads\\Clientes_exported_1.xlsx';

// Lista de filas que tuvieron errores (basado en el reporte)
const FILAS_CON_ERRORES = [
  686,   // Oliver Hurtado, Maria - Telefono largo
  750,   // Farmacia - Quilis Arocas, Rosa Maria - Telefono largo
  761,   // Fernández Muñoz, Antonio - Telefono largo
  784,   // Top-to-toe Sl - Telefono largo
  789,   // Imas Rpm Obispo Javier Azagra - CuentaContable duplicada
  790,   // Mirafarma Sociedad Limitada. - CuentaContable duplicada
  805,   // Farmacia Mayor - Soto Fernandez, Juan Angel - CuentaContable duplicada
  806,   // Farmacia Aeropuerto - García Pérez, Marco Antonio - CuentaContable duplicada
  807,   // Farmacia Torrealta - Campillo Ruiz, Cayetana - CuentaContable duplicada
  808,   // Gómez Abellán, Jesús Joaquín - CuentaContable duplicada
  809,   // Farmacia - Carreño Arias, Josefa - CuentaContable duplicada
  810    // Farmacia - Bueno Gimenez, Rafael - CuentaContable duplicada
];

// Importar funciones del script principal
const fs = require('fs');
const scriptPrincipal = fs.readFileSync(path.join(__dirname, 'importar-clientes-excel.js'), 'utf8');
eval(scriptPrincipal.replace(/if \(require\.main === module\)[\s\S]*$/, ''));

/**
 * Procesa solo los clientes con errores
 */
async function reimportarClientesConErrores() {
  try {
    console.log('🔄 Reimportando clientes con errores...\n');
    
    // Conectar a MySQL
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Cargar lookups
    await cargarLookups();
    console.log('');
    
    // Leer Excel
    const clientes = leerExcel(EXCEL_FILE);
    console.log(`✅ ${clientes.length} clientes totales en Excel\n`);
    
    // Cargar clientes existentes
    const clientesDB = await crm.getClientes();
    console.log(`✅ ${clientesDB.length} clientes existentes en BD\n`);
    
    // Filtrar solo los que tuvieron errores (índice - 1 porque Excel empieza en fila 2)
    const clientesConErrores = FILAS_CON_ERRORES.map(numFila => {
      const index = numFila - 2; // -2 porque Excel empieza en fila 1 y la fila 1 son headers
      return clientes[index];
    }).filter(c => c !== undefined);
    
    console.log(`📋 Procesando ${clientesConErrores.length} clientes con errores...\n`);
    
    const resultados = {
      importados: 0,
      actualizados: 0,
      errores: 0,
      requiereRevision: []
    };
    
    for (let i = 0; i < clientesConErrores.length; i++) {
      const cliente = clientesConErrores[i];
      const numero = FILAS_CON_ERRORES[i];
      const nombre = cliente.Nombre_Razon_Social || 'Sin nombre';
      
      try {
        // Buscar si existe (por CuentaContable u otros campos)
        const clienteExistente = buscarClienteExistente(cliente, clientesDB);
        
        if (clienteExistente) {
          // Actualizar existente
          const clienteId = clienteExistente.Id || clienteExistente.id;
          const datosActualizacion = { ...cliente };
          delete datosActualizacion.Id;
          delete datosActualizacion.id;
          
          // Si la CuentaContable está duplicada, quitarla del update
          if (cliente.CuentaContable) {
            const existeOtro = clientesDB.find(c => 
              c.CuentaContable === cliente.CuentaContable && 
              (c.Id !== clienteId || c.id !== clienteId)
            );
            if (existeOtro) {
              delete datosActualizacion.CuentaContable;
              console.log(`⚠️  [${numero}] CuentaContable duplicada, se omite en actualización: ${nombre}`);
            }
          }
          
          await actualizarCliente(clienteId, datosActualizacion);
          console.log(`[${numero}] 🔄 Actualizado: ${nombre} (ID: ${clienteId})`);
          resultados.actualizados++;
        } else {
          // Intentar crear nuevo, pero si CuentaContable está duplicada, quitarla
          if (cliente.CuentaContable) {
            const existe = clientesDB.find(c => c.CuentaContable === cliente.CuentaContable);
            if (existe) {
              delete cliente.CuentaContable;
              console.log(`⚠️  [${numero}] CuentaContable duplicada, se crea sin ella: ${nombre}`);
            }
          }
          
          await insertarCliente(cliente);
          console.log(`[${numero}] 🆕 Creado: ${nombre}`);
          resultados.importados++;
        }
      } catch (error) {
        resultados.errores++;
        const motivo = error.message.includes('Duplicate entry') ? 'CuentaContable duplicada' :
                      error.message.includes('Data too long') ? 'Campo demasiado largo' :
                      error.message;
        
        resultados.requiereRevision.push({
          fila: numero,
          nombre,
          motivo,
          datos: cliente
        });
        
        console.error(`❌ [${numero}] Error: ${nombre} - ${motivo}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN REIMPORTACIÓN:');
    console.log(`   ✅ Creados: ${resultados.importados}`);
    console.log(`   🔄 Actualizados: ${resultados.actualizados}`);
    console.log(`   ❌ Errores: ${resultados.errores}`);
    console.log('='.repeat(80));
    
    // Generar reporte de clientes que requieren revisión
    if (resultados.requiereRevision.length > 0) {
      console.log('\n📋 CLIENTES QUE REQUIEREN REVISIÓN MANUAL:');
      console.log('='.repeat(80));
      
      resultados.requiereRevision.forEach((item, index) => {
        console.log(`\n${index + 1}. Fila ${item.fila}: ${item.nombre}`);
        console.log(`   Motivo: ${item.motivo}`);
        if (item.datos.CuentaContable) {
          console.log(`   CuentaContable: ${item.datos.CuentaContable}`);
        }
        if (item.datos.Movil) {
          console.log(`   Teléfono: ${item.datos.Movil} (${item.datos.Movil.length} caracteres)`);
        }
        console.log(`   DNI_CIF: ${item.datos.DNI_CIF || 'N/A'}`);
        console.log(`   Email: ${item.datos.Email || 'N/A'}`);
      });
      
      console.log('\n' + '='.repeat(80));
      
      // Guardar reporte en archivo
      const reportePath = path.join(__dirname, 'clientes-requieren-revision.txt');
      let reporteTexto = 'CLIENTES QUE REQUIEREN REVISIÓN MANUAL\n';
      reporteTexto += '='.repeat(80) + '\n\n';
      
      resultados.requiereRevision.forEach((item, index) => {
        reporteTexto += `${index + 1}. Fila ${item.fila}: ${item.nombre}\n`;
        reporteTexto += `   Motivo: ${item.motivo}\n`;
        if (item.datos.CuentaContable) {
          reporteTexto += `   CuentaContable: ${item.datos.CuentaContable}\n`;
        }
        if (item.datos.Movil) {
          reporteTexto += `   Teléfono: ${item.datos.Movil} (${item.datos.Movil.length} caracteres)\n`;
        }
        reporteTexto += `   DNI_CIF: ${item.datos.DNI_CIF || 'N/A'}\n`;
        reporteTexto += `   Email: ${item.datos.Email || 'N/A'}\n`;
        reporteTexto += `   Población: ${item.datos.Poblacion || 'N/A'}\n`;
        reporteTexto += `   Dirección: ${item.datos.Direccion || 'N/A'}\n`;
        reporteTexto += '\n';
      });
      
      fs.writeFileSync(reportePath, reporteTexto, 'utf8');
      console.log(`\n📄 Reporte guardado en: ${reportePath}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  }
}

reimportarClientesConErrores();

