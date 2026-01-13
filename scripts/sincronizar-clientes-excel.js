/**
 * Script para sincronizar clientes desde un archivo Excel con MySQL
 * 
 * Este script:
 * 1. Lee el archivo Excel con datos de clientes
 * 2. Obtiene todos los clientes existentes en MySQL
 * 3. Compara y actualiza los clientes existentes
 * 4. Crea los nuevos clientes que no existen
 * 
 * Uso: node scripts/sincronizar-clientes-excel.js [ruta-al-excel]
 */

const path = require('path');
const XLSX = require('xlsx');
const crm = require('../config/mysql-crm');

// Configuración - Parsear argumentos correctamente
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');

// Buscar el archivo Excel en los argumentos (excluyendo flags)
const excelArg = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-'));
const EXCEL_FILE = excelArg || path.join(__dirname, '..', '01 Farmacias_Murcia_Completado.xlsx');

// Mapeo de columnas del Excel a campos de NocoDB
// Basado en las columnas reales del archivo Excel
const COLUMN_MAPPING = {
  // Columnas del Excel -> Campos en NocoDB
  'Farmacéutico Titular': 'Nombre',
  'Farmacéutico titular': 'Nombre',
  'FARMACÉUTICO TITULAR': 'Nombre',
  'Nombre': 'Nombre',
  'NOMBRE': 'Nombre',
  'nombre': 'Nombre',
  'Farmacia': 'Nombre',
  'FARMACIA': 'Nombre',
  
  'DNI/CIF': 'DNI_CIF',
  'DNI_CIF': 'DNI_CIF',
  'CIF': 'DNI_CIF',
  'Dni/Cif': 'DNI_CIF',
  'dni_cif': 'DNI_CIF',
  
  'Télefono': 'Telefono', // Nota: en el Excel está escrito con tilde
  'Teléfono': 'Telefono',
  'Telefono': 'Telefono',
  'TELEFONO': 'Telefono',
  'Tel': 'Telefono',
  
  'Móvil': 'Movil',
  'Movil': 'Movil',
  'MOVIL': 'Movil',
  'Mobile': 'Movil',
  
  'Email': 'Email',
  'email': 'Email',
  'EMAIL': 'Email',
  'Correo': 'Email',
  
  'Dirección': 'Direccion',
  'Direccion': 'Direccion',
  'DIRECCION': 'Direccion',
  
  'Población': 'Poblacion',
  'Poblacion': 'Poblacion',
  'POBLACION': 'Poblacion',
  
  'Municipio': 'Provincia', // En el Excel, Municipio contiene la provincia (Murcia)
  'MUNICIPIO': 'Provincia',
  
  'Provincia': 'Provincia',
  'PROVINCIA': 'Provincia',
  'provincia': 'Provincia',
  
  'Código Postal': 'CodigoPostal',
  'Codigo Postal': 'CodigoPostal',
  'CódigoPostal': 'CodigoPostal',
  'CP': 'CodigoPostal',
  'CodigoPostal': 'CodigoPostal',
  
  'Código Hefame': 'CodigoHefame',
  'Codigo Hefame': 'CodigoHefame',
  'CodigoHefame': 'CodigoHefame',
  'Hefame': 'CodigoHefame',
  
  'Código Alliance': 'CodigoAlliance',
  'Codigo Alliance': 'CodigoAlliance',
  'CodigoAlliance': 'CodigoAlliance',
  'Alliance': 'CodigoAlliance',
  
  'Código Cofares': 'CodigoCofares',
  'Codigo Cofares': 'CodigoCofares',
  'CodigoCofares': 'CodigoCofares',
  'Cofares': 'CodigoCofares',
  
  'Ubicación': 'Direccion', // Puede ser parte de la dirección
  'Ubicacion': 'Direccion',
};

/**
 * Normaliza el nombre de una columna del Excel
 */
function normalizeColumnName(columnName) {
  if (!columnName) return null;
  return String(columnName).trim();
}

/**
 * Mapea una fila del Excel a un objeto de cliente para NocoDB
 */
function mapExcelRowToCliente(row, headers) {
  const cliente = {};
  
  // Mapear cada columna del Excel al campo correspondiente en NocoDB
  headers.forEach((header, index) => {
    const normalizedHeader = normalizeColumnName(header);
    if (!normalizedHeader) return;
    
    // Buscar el mapeo correspondiente (búsqueda case-insensitive)
    let campoNocoDB = COLUMN_MAPPING[normalizedHeader];
    
    // Si no se encuentra exacto, buscar sin tildes y case-insensitive
    if (!campoNocoDB) {
      const headerSinTildes = normalizedHeader
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      
      for (const [key, value] of Object.entries(COLUMN_MAPPING)) {
        const keySinTildes = key
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        if (keySinTildes === headerSinTildes) {
          campoNocoDB = value;
          break;
        }
      }
    }
    
    if (campoNocoDB && row[index] !== undefined && row[index] !== null && row[index] !== '') {
      let valor = String(row[index]).trim();
      
      // Limpiar valores numéricos que vienen como números
      if (typeof row[index] === 'number') {
        valor = String(row[index]);
      }
      
      if (valor && valor !== 'undefined' && valor !== 'null') {
        // Si el campo ya existe, combinarlo (útil para dirección + ubicación)
        if (cliente[campoNocoDB] && campoNocoDB === 'Direccion') {
          cliente[campoNocoDB] = `${cliente[campoNocoDB]}, ${valor}`;
        } else {
          cliente[campoNocoDB] = valor;
        }
      }
    }
  });
  
  // Si no hay nombre, no podemos crear el cliente
  if (!cliente.Nombre || cliente.Nombre.trim() === '') {
    return null;
  }
  
  // Establecer valores por defecto
  if (!cliente.OK_KO) {
    cliente.OK_KO = 'OK'; // Por defecto, activo
  }
  
  // Nota: No usamos "Número farmacia" como DNI_CIF porque no es un identificador real
  // Si no hay DNI_CIF en el Excel, el campo quedará vacío y se buscará por otros campos
  
  return cliente;
}

/**
 * Lee el archivo Excel y extrae los datos de clientes
 */
function leerExcel(archivo) {
  try {
    console.log(`📖 Leyendo archivo Excel: ${archivo}`);
    const workbook = XLSX.readFile(archivo);
    
    // Obtener la primera hoja
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`📄 Hoja encontrada: ${sheetName}`);
    
    // Convertir a JSON
    const datos = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    if (datos.length < 2) {
      throw new Error('El archivo Excel no tiene suficientes filas (se espera al menos una fila de encabezados y una fila de datos)');
    }
    
    // La primera fila son los encabezados
    const headers = datos[0].map(h => normalizeColumnName(h));
    console.log(`📊 Encabezados encontrados:`, headers);
    
    // Las siguientes filas son los datos
    const clientes = [];
    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i];
      const cliente = mapExcelRowToCliente(fila, headers);
      if (cliente) {
        clientes.push(cliente);
      }
    }
    
    console.log(`✅ ${clientes.length} clientes extraídos del Excel`);
    return clientes;
  } catch (error) {
    console.error('❌ Error leyendo el archivo Excel:', error.message);
    throw error;
  }
}

/**
 * Normaliza un valor para comparación (elimina espacios, convierte a mayúsculas, etc.)
 */
function normalizarValor(valor) {
  if (!valor) return '';
  return String(valor).trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Busca un cliente en la base de datos por DNI_CIF, Nombre o Email
 */
function buscarClienteExistente(clienteExcel, clientesDB) {
  // 1. Intentar buscar por DNI_CIF primero (más preciso)
  if (clienteExcel.DNI_CIF) {
    const dniNormalizado = normalizarValor(clienteExcel.DNI_CIF);
    const encontrado = clientesDB.find(c => {
      const dniDB = normalizarValor(c.DNI_CIF || c.dni_cif || c['DNI/CIF'] || '');
      return dniDB === dniNormalizado && dniDB !== '';
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  // 2. Si no se encuentra por DNI_CIF, buscar por Email (muy preciso)
  if (clienteExcel.Email) {
    const emailNormalizado = normalizarValor(clienteExcel.Email);
    const encontrado = clientesDB.find(c => {
      const emailDB = normalizarValor(c.Email || c.email || '');
      return emailDB === emailNormalizado && emailDB !== '';
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  // 3. Si no se encuentra por Email, buscar por Nombre y Teléfono (combinación)
  if (clienteExcel.Nombre && (clienteExcel.Telefono || clienteExcel.Movil)) {
    const nombreNormalizado = normalizarValor(clienteExcel.Nombre);
    const telefonoNormalizado = normalizarValor(clienteExcel.Telefono || clienteExcel.Movil || '');
    const encontrado = clientesDB.find(c => {
      const nombreDB = normalizarValor(c.Nombre || c.nombre || '');
      const telefonoDB = normalizarValor(c.Telefono || c.Teléfono || c.Movil || c.Móvil || '');
      return nombreDB === nombreNormalizado && 
             nombreDB !== '' && 
             telefonoDB !== '' && 
             (telefonoDB === telefonoNormalizado || 
              telefonoNormalizado.includes(telefonoDB) || 
              telefonoDB.includes(telefonoNormalizado));
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  // 4. Buscar por Nombre + Dirección/Población (combinación más precisa que solo nombre)
  if (clienteExcel.Nombre && (clienteExcel.Direccion || clienteExcel.Poblacion)) {
    const nombreNormalizado = normalizarValor(clienteExcel.Nombre);
    const direccionNormalizada = normalizarValor(clienteExcel.Direccion || '');
    const poblacionNormalizada = normalizarValor(clienteExcel.Poblacion || '');
    
    const encontrado = clientesDB.find(c => {
      const nombreDB = normalizarValor(c.Nombre || c.nombre || '');
      const direccionDB = normalizarValor(c.Direccion || c.Dirección || '');
      const poblacionDB = normalizarValor(c.Poblacion || c.Población || '');
      
      const nombreCoincide = nombreDB === nombreNormalizado && nombreDB !== '';
      const direccionCoincide = direccionNormalizada && direccionDB && 
        (direccionDB.includes(direccionNormalizada) || direccionNormalizada.includes(direccionDB));
      const poblacionCoincide = poblacionNormalizada && poblacionDB && 
        (poblacionDB === poblacionNormalizada || poblacionDB.includes(poblacionNormalizada) || poblacionNormalizada.includes(poblacionDB));
      
      return nombreCoincide && (direccionCoincide || poblacionCoincide);
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  // 5. Último recurso: buscar solo por Nombre (menos preciso, puede haber duplicados)
  if (clienteExcel.Nombre) {
    const nombreNormalizado = normalizarValor(clienteExcel.Nombre);
    const encontrado = clientesDB.find(c => {
      const nombreDB = normalizarValor(c.Nombre || c.nombre || '');
      // Buscar coincidencia exacta
      return nombreDB === nombreNormalizado && nombreDB !== '';
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  return null;
}

/**
 * Prepara el payload para actualizar un cliente (solo campos que han cambiado)
 */
function prepararPayloadActualizacion(clienteExcel, clienteDB) {
  const payload = {};
  
  // Campos a comparar y actualizar
  const campos = [
    'Nombre', 'DNI_CIF', 'Telefono', 'Movil', 'Email',
    'Direccion', 'Poblacion', 'Provincia', 'CodigoPostal',
    'CodigoHefame', 'CodigoAlliance', 'CodigoCofares', 'OK_KO'
  ];
  
  campos.forEach(campo => {
    const valorExcel = clienteExcel[campo];
    if (valorExcel !== undefined && valorExcel !== null && valorExcel !== '') {
      // Normalizar valores para comparación
      const valorExcelNormalizado = normalizarValor(valorExcel);
      const valorDBNormalizado = normalizarValor(
        clienteDB[campo] || 
        clienteDB[campo.toLowerCase()] || 
        clienteDB[campo.toUpperCase()] || 
        ''
      );
      
      // Solo actualizar si el valor es diferente
      if (valorExcelNormalizado !== valorDBNormalizado) {
        payload[campo] = valorExcel;
      }
    }
  });
  
  return payload;
}

/**
 * Función principal de sincronización
 */
async function sincronizarClientes() {
  try {
    console.log('🚀 Iniciando sincronización de clientes...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales');
    }
    console.log(`📁 Archivo Excel: ${EXCEL_FILE}`);
    console.log('');
    
    // 1. Conectar a NocoDB
    console.log('📡 Conectando a NocoDB...');
    await crm.connect();
    console.log('✅ Conectado a NocoDB\n');
    
    // 2. Leer el archivo Excel
    console.log('📖 Leyendo archivo Excel...');
    const clientesExcel = leerExcel(EXCEL_FILE);
    console.log(`✅ ${clientesExcel.length} clientes encontrados en el Excel\n`);
    
    // 3. Obtener todos los clientes de la base de datos
    console.log('📊 Obteniendo clientes existentes de NocoDB...');
    const clientesDB = await crm.getClientes();
    console.log(`✅ ${clientesDB.length} clientes encontrados en la base de datos\n`);
    
    // 4. Procesar cada cliente del Excel
    let actualizados = 0;
    let creados = 0;
    let errores = 0;
    let sinCambios = 0;
    
    console.log('🔄 Procesando clientes...\n');
    
    for (let i = 0; i < clientesExcel.length; i++) {
      const clienteExcel = clientesExcel[i];
      const numero = i + 1;
      const nombre = clienteExcel.Nombre || 'Sin nombre';
      
      try {
        // Buscar si el cliente ya existe
        const clienteExistente = buscarClienteExistente(clienteExcel, clientesDB);
        
        if (clienteExistente) {
          // Cliente existe, verificar si hay cambios
          const payload = prepararPayloadActualizacion(clienteExcel, clienteExistente);
          
          if (Object.keys(payload).length > 0) {
            // Hay cambios, actualizar
            const clienteId = clienteExistente.Id || clienteExistente.id;
            console.log(`[${numero}/${clientesExcel.length}] 🔄 ${DRY_RUN ? '[SIMULACIÓN] ' : ''}Actualizando cliente: ${nombre} (ID: ${clienteId})`);
            if (DRY_RUN) {
              console.log(`    📝 Campos a actualizar:`, Object.keys(payload).join(', '));
              console.log(`    📝 Valores:`, JSON.stringify(payload, null, 2));
              actualizados++;
            } else {
              await crm.updateCliente(clienteId, payload);
              actualizados++;
            }
          } else {
            // No hay cambios
            console.log(`[${numero}/${clientesExcel.length}] ✓ Cliente sin cambios: ${nombre}`);
            sinCambios++;
          }
        } else {
          // Cliente no existe, crear nuevo
          console.log(`[${numero}/${clientesExcel.length}] 🆕 ${DRY_RUN ? '[SIMULACIÓN] ' : ''}Creando nuevo cliente: ${nombre}`);
          if (DRY_RUN) {
            console.log(`    📝 Datos del cliente:`, JSON.stringify(clienteExcel, null, 2));
            creados++;
          } else {
            await crm.createCliente(clienteExcel);
            creados++;
          }
        }
        
        // Pequeña pausa para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`[${numero}/${clientesExcel.length}] ❌ Error procesando cliente "${nombre}":`, error.message);
        errores++;
      }
    }
    
    // 5. Resumen final
    console.log('\n' + '='.repeat(60));
    if (DRY_RUN) {
      console.log('📊 RESUMEN DE SIMULACIÓN (NO SE REALIZARON CAMBIOS)');
    } else {
      console.log('📊 RESUMEN DE SINCRONIZACIÓN');
    }
    console.log('='.repeat(60));
    console.log(`✅ Clientes actualizados: ${actualizados}`);
    console.log(`🆕 Clientes creados: ${creados}`);
    console.log(`✓ Clientes sin cambios: ${sinCambios}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total procesado: ${clientesExcel.length}`);
    console.log('='.repeat(60));
    
    if (DRY_RUN) {
      console.log('\n✅ Simulación completada exitosamente');
      console.log('💡 Para aplicar los cambios, ejecuta el script sin el flag --dry-run');
    } else {
      if (errores === 0) {
        console.log('\n✅ Sincronización completada exitosamente');
      } else {
        console.log(`\n⚠️ Sincronización completada con ${errores} error(es)`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error en la sincronización:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar la sincronización
if (require.main === module) {
  sincronizarClientes()
    .then(() => {
      console.log('\n🏁 Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { sincronizarClientes, leerExcel, mapExcelRowToCliente };

