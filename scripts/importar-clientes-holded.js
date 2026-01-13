/**
 * Script para importar clientes desde Excel de Holded a la tabla Clientes
 * - Solo importa clientes con DNI/CIF
 * - Solo importa clientes españoles
 * - No duplica registros
 * - Actualiza datos existentes
 */

const XLSX = require('xlsx');
const mysql = require('mysql2/promise');
require('dotenv').config();

const EXCEL_FILE = 'C:\\Users\\pacol\\Downloads\\FARMADESCANSO 2021 SL - Contactos (2).xlsx';
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');

// Mapeo de columnas del Excel de Holded a campos de la tabla Clientes
// Nota: Provincia no existe en la tabla clientes, se omite
const COLUMN_MAPPING = {
  'Nombre': 'Nombre_Razon_Social',
  'Email': 'Email',
  'Teléfono': 'Telefono',
  'Móvil': 'Movil',
  'Dirección': 'Direccion',
  'Población': 'Poblacion',
  'Código postal': 'CodigoPostal',
  'País': 'Pais',
  'Código país': 'CodPais',
  'Idioma': 'Idioma',
  'Moneda': 'Moneda',
  'Dto. %': 'Dto',
  'Cuenta': 'CuentaContable',
  'Régimen': 'RE',
  'IBAN': 'IBAN',
  'Swift': 'Swift',
  'Acumula en modelo 347': 'Modelo_347'
};

// Cache para lookups
let formasPagoMap = null;
let idiomasMap = null;
let monedasMap = null;
let comercialesMap = null;

/**
 * Normaliza un valor para comparación
 */
function normalizarValor(valor) {
  if (!valor) return '';
  return String(valor).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Valida si un valor parece ser un DNI/CIF español
 */
function esDNICIFValido(valor) {
  if (!valor) return false;
  const str = String(valor).trim().toUpperCase();
  
  // DNI: 8 dígitos + letra (ej: 12345678A)
  const dniPattern = /^[0-9]{8}[A-Z]$/;
  
  // CIF: Letra + 7 dígitos + letra/dígito (ej: B12345678, A1234567A)
  const cifPattern = /^[A-Z][0-9]{7}[0-9A-Z]$/;
  
  // NIE: X/Y/Z + 7 dígitos + letra (ej: X1234567A)
  const niePattern = /^[XYZ][0-9]{7}[A-Z]$/;
  
  return dniPattern.test(str) || cifPattern.test(str) || niePattern.test(str);
}

/**
 * Extrae DNI/CIF del registro de Holded
 */
function extraerDNICIF(row) {
  // Intentar desde el campo ID primero
  if (row['ID'] && esDNICIFValido(row['ID'])) {
    return String(row['ID']).trim().toUpperCase();
  }
  
  // Intentar desde Referencia
  if (row['Referencia'] && esDNICIFValido(row['Referencia'])) {
    return String(row['Referencia']).trim().toUpperCase();
  }
  
  return null;
}

/**
 * Verifica si el cliente es español
 */
function esEspanol(row) {
  const pais = String(row['País'] || '').trim().toLowerCase();
  const codigoPais = String(row['Código país'] || '').trim().toUpperCase();
  
  return pais === 'españa' || 
         pais.includes('spain') || 
         codigoPais === 'ES' ||
         codigoPais === 'ESP';
}

/**
 * Carga los datos de lookup necesarios
 */
async function cargarLookups(connection) {
  console.log('📚 Cargando datos de lookup...');
  
  // Formas de Pago
  const [formasPago] = await connection.query('SELECT id, FormaPago FROM formas_pago');
  formasPagoMap = new Map();
  formasPago.forEach(fp => {
    if (fp.FormaPago) {
      formasPagoMap.set(normalizarValor(fp.FormaPago), fp.id);
    }
  });
  console.log(`  ✅ ${formasPagoMap.size} formas de pago cargadas`);
  
  // Idiomas
  try {
    const [idiomas] = await connection.query('SELECT id, Codigo, Nombre FROM idiomas');
    idiomasMap = new Map();
    idiomas.forEach(i => {
      if (i.Codigo) {
        idiomasMap.set(normalizarValor(i.Codigo), i.id);
      }
      if (i.Nombre) {
        idiomasMap.set(normalizarValor(i.Nombre), i.id);
      }
    });
    console.log(`  ✅ ${idiomas.length} idiomas cargados`);
  } catch (error) {
    console.log(`  ⚠️  Tabla idiomas no existe`);
    idiomasMap = new Map();
  }
  
  // Monedas
  try {
    const [monedas] = await connection.query('SELECT id, Codigo, Nombre FROM monedas');
    monedasMap = new Map();
    monedas.forEach(m => {
      if (m.Codigo) {
        monedasMap.set(normalizarValor(m.Codigo), m.id);
      }
      if (m.Nombre) {
        monedasMap.set(normalizarValor(m.Nombre), m.id);
      }
    });
    console.log(`  ✅ ${monedas.length} monedas cargadas`);
  } catch (error) {
    console.log(`  ⚠️  Tabla monedas no existe`);
    monedasMap = new Map();
  }
  
  // Comerciales (para asignar Id_Cial - usar el primero disponible o null)
  try {
    const [comerciales] = await connection.query('SELECT id FROM comerciales LIMIT 1');
    comercialesMap = comerciales.length > 0 ? comerciales[0].id : null;
    console.log(`  ✅ Comercial por defecto: ${comercialesMap || 'No asignado'}`);
  } catch (error) {
    comercialesMap = null;
  }
}

/**
 * Busca un cliente existente por DNI/CIF o CuentaContable
 */
async function buscarClienteExistente(connection, dniCif, cuentaContable) {
  if (dniCif) {
    const dniNormalizado = normalizarValor(dniCif);
    const [clientes] = await connection.query(
      'SELECT * FROM clientes WHERE LOWER(TRIM(DNI_CIF)) = ? LIMIT 1',
      [dniNormalizado]
    );
    
    if (clientes.length > 0) {
      return clientes[0];
    }
  }
  
  // Si no se encuentra por DNI/CIF, buscar por CuentaContable (si es único)
  if (cuentaContable) {
    const [clientes] = await connection.query(
      'SELECT * FROM clientes WHERE CuentaContable = ? LIMIT 1',
      [cuentaContable]
    );
    
    if (clientes.length > 0) {
      return clientes[0];
    }
  }
  
  return null;
}

/**
 * Convierte un valor del Excel a formato adecuado para MySQL
 */
function convertirValor(valor, campoDestino) {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  
  let strValor = String(valor).trim();
  if (strValor === 'undefined' || strValor === 'null' || strValor === '') {
    return null;
  }
  
  // Limpiar teléfonos
  if (campoDestino === 'Movil' || campoDestino === 'Telefono') {
    const limpio = strValor.replace(/[^\d]/g, '');
    return limpio && limpio !== '0' ? limpio : null;
  }
  
  // Convertir Dto a número
  if (campoDestino === 'Dto' || campoDestino === 'RE') {
    const num = parseFloat(strValor.replace(',', '.'));
    return isNaN(num) ? null : num;
  }
  
  // Modelo 347: convertir "Sí"/"No" a 1/0
  if (campoDestino === 'Modelo_347') {
    const strLower = strValor.toLowerCase();
    return strLower === 'sí' || strLower === 'si' || strLower === 'yes' || strLower === '1' ? 1 : 0;
  }
  
  // Limitar longitud según campo
  if (campoDestino === 'DNI_CIF' && strValor.length > 15) {
    strValor = strValor.substring(0, 15);
  }
  if (campoDestino === 'CodigoPostal' && strValor.length > 8) {
    strValor = strValor.substring(0, 8);
  }
  if (campoDestino === 'CodPais' && strValor.length > 3) {
    strValor = strValor.substring(0, 3);
  }
  
  return strValor;
}

/**
 * Mapea un registro del Excel a un objeto cliente para la BBDD
 */
function mapearCliente(row) {
  const cliente = {};
  
  // DNI/CIF (prioritario)
  const dniCif = extraerDNICIF(row);
  if (!dniCif) {
    return null; // No importar si no tiene DNI/CIF
  }
  cliente.DNI_CIF = dniCif;
  
  // Nombre (obligatorio)
  cliente.Nombre_Razon_Social = String(row['Nombre'] || '').trim();
  if (!cliente.Nombre_Razon_Social) {
    return null; // No importar si no tiene nombre
  }
  
  // Mapear otros campos
  Object.keys(COLUMN_MAPPING).forEach(colExcel => {
    const campoBD = COLUMN_MAPPING[colExcel];
    if (row[colExcel] !== undefined && row[colExcel] !== null && row[colExcel] !== '') {
      cliente[campoBD] = convertirValor(row[colExcel], campoBD);
    }
  });
  
  // Lookups
  if (row['F.Pago']) {
    const formaPagoId = formasPagoMap.get(normalizarValor(row['F.Pago']));
    if (formaPagoId) {
      cliente.Id_FormaPago = formaPagoId;
    }
  }
  
  if (row['Idioma']) {
    const idiomaId = idiomasMap.get(normalizarValor(row['Idioma']));
    if (idiomaId) {
      cliente.Id_Idioma = idiomaId;
    }
  }
  
  if (row['Moneda']) {
    const monedaId = monedasMap.get(normalizarValor(row['Moneda']));
    if (monedaId) {
      cliente.Id_Moneda = monedaId;
    }
  }
  
  // Asignar comercial por defecto
  if (comercialesMap) {
    cliente.Id_Cial = comercialesMap;
  }
  
  // Valores por defecto
  cliente.OK_KO = 1; // Activo por defecto
  cliente.Pais = cliente.Pais || 'España';
  cliente.CodPais = cliente.CodPais || 'ES';
  
  return cliente;
}

/**
 * Importa los clientes
 */
async function importarClientes() {
  let connection;
  
  try {
    // Conectar a la base de datos
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'farmadescanso',
      charset: 'utf8mb4'
    };

    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado a la base de datos\n');

    // Cargar lookups
    await cargarLookups(connection);
    console.log('');

    // Leer Excel
    console.log('📖 Leyendo archivo Excel...');
    const workbook = XLSX.readFile(EXCEL_FILE);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Encontrar fila de encabezados
    const dataArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, dataArray.length); i++) {
      const row = dataArray[i];
      if (row && row.length > 0) {
        const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
        if (rowStr.includes('nombre') && rowStr.includes('email')) {
          headerRowIndex = i;
          break;
        }
      }
    }
    
    if (headerRowIndex === -1) {
      throw new Error('No se encontró la fila de encabezados en el Excel');
    }
    
    // Leer datos
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: headerRowIndex,
      range: headerRowIndex,
      defval: null 
    });
    
    console.log(`✅ ${data.length} registros leídos del Excel\n`);

    // Procesar registros
    let procesados = 0;
    let creados = 0;
    let actualizados = 0;
    let omitidos = 0;
    const errores = [];

    console.log('📝 Procesando registros...\n');

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Verificar que sea español
      if (!esEspanol(row)) {
        omitidos++;
        continue;
      }
      
      // Mapear cliente
      const cliente = mapearCliente(row);
      if (!cliente || !cliente.DNI_CIF) {
        omitidos++;
        continue;
      }
      
      procesados++;
      
      // Buscar cliente existente
      const clienteExistente = await buscarClienteExistente(connection, cliente.DNI_CIF, cliente.CuentaContable);
      
      if (clienteExistente) {
        // Actualizar cliente existente
        if (!DRY_RUN) {
          const camposUpdate = [];
          const valores = [];
          
          Object.keys(cliente).forEach(campo => {
            // No actualizar DNI_CIF, Id_Cial ni CuentaContable si ya existe
            if (campo !== 'DNI_CIF' && campo !== 'Id_Cial' && campo !== 'CuentaContable') {
              camposUpdate.push(`\`${campo}\` = ?`);
              valores.push(cliente[campo]);
            }
          });
          
          if (camposUpdate.length > 0) {
            valores.push(clienteExistente.id);
            await connection.query(
              `UPDATE clientes SET ${camposUpdate.join(', ')} WHERE id = ?`,
              valores
            );
          }
        }
        actualizados++;
        console.log(`  ✅ Actualizado: ${cliente.Nombre_Razon_Social} (DNI/CIF: ${cliente.DNI_CIF})`);
      } else {
        // Crear nuevo cliente
        if (!DRY_RUN) {
          const campos = Object.keys(cliente);
          const placeholders = campos.map(() => '?').join(', ');
          const valores = campos.map(c => cliente[c]);
          
          try {
            await connection.query(
              `INSERT INTO clientes (${campos.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
              valores
            );
            creados++;
            console.log(`  ➕ Creado: ${cliente.Nombre_Razon_Social} (DNI/CIF: ${cliente.DNI_CIF})`);
          } catch (error) {
            // Si hay error de duplicado en CuentaContable, omitir ese campo e intentar de nuevo
            if (error.code === 'ER_DUP_ENTRY' && error.message.includes('CuentaContable')) {
              console.log(`  ⚠️  CuentaContable duplicada para ${cliente.Nombre_Razon_Social}, omitiendo...`);
              const camposSinCuenta = campos.filter(c => c !== 'CuentaContable');
              const valoresSinCuenta = camposSinCuenta.map(c => cliente[c]);
              const placeholdersSinCuenta = camposSinCuenta.map(() => '?').join(', ');
              
              await connection.query(
                `INSERT INTO clientes (${camposSinCuenta.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholdersSinCuenta})`,
                valoresSinCuenta
              );
              creados++;
              console.log(`  ➕ Creado (sin CuentaContable): ${cliente.Nombre_Razon_Social} (DNI/CIF: ${cliente.DNI_CIF})`);
            } else {
              throw error;
            }
          }
        } else {
          creados++;
          console.log(`  ➕ Creado: ${cliente.Nombre_Razon_Social} (DNI/CIF: ${cliente.DNI_CIF})`);
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN DE IMPORTACIÓN');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Total registros en Excel: ${data.length}`);
    console.log(`  Procesados (españoles con DNI/CIF): ${procesados}`);
    console.log(`  Creados: ${creados}`);
    console.log(`  Actualizados: ${actualizados}`);
    console.log(`  Omitidos (sin DNI/CIF o no españoles): ${omitidos}`);
    if (DRY_RUN) {
      console.log(`\n  ⚠️  MODO SIMULACIÓN - No se realizaron cambios en la BBDD`);
    }
    console.log('═══════════════════════════════════════════════════════════');

    if (errores.length > 0) {
      console.log('\n⚠️  Errores encontrados:');
      errores.forEach(err => console.log(`  - ${err}`));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar importación
if (DRY_RUN) {
  console.log('⚠️  MODO SIMULACIÓN - No se realizarán cambios en la BBDD\n');
}

importarClientes();

