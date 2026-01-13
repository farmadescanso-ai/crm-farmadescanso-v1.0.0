/**
 * Script para importar clientes desde Excel a la tabla Clientes
 * Adapta los datos del Excel a la estructura de la tabla MySQL
 */

const XLSX = require('xlsx');
const path = require('path');
const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

const EXCEL_FILE = 'C:\\Users\\pacol\\Downloads\\Clientes_exported_1.xlsx';
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');

// Mapeo de columnas del Excel a campos de la tabla Clientes
const COLUMN_MAPPING = {
  'Nombre': 'Nombre_Razon_Social',
  'NumeroFarmacia': 'NumeroFarmacia',
  'Poblacion': 'Poblacion',
  'DNI_CIF': 'DNI_CIF',
  'Ubicacion': 'Direccion', // Si no hay Direccion, usar Ubicacion
  'Direccion': 'Direccion',
  'Movil': 'Movil',
  'Telefono': 'Movil', // Si no hay Movil, usar Telefono
  'Email': 'Email',
  'CodigoPostal': 'CodigoPostal',
  'Provincia': null, // No existe en tabla, podría añadirse a Poblacion
  'Pais': 'Pais',
  'CodigoPais': 'CodPais',
  'Idioma': 'Idioma',
  'Dto_%': 'Dto',
  'Moneda': 'Moneda',
  'Cuenta': 'CuentaContable',
  'F_Pago': 'Id_FormaPago', // Necesita lookup
  'NombreCantacto': 'NomContacto',
  'Régimen': 'RE',
  'IBAN': 'IBAN',
  'Swift': 'Swift',
  'Tipo': 'TipoCliente', // Necesita lookup
  'Modelo_347': 'Modelo_347',
  'Comercial': 'Id_Cial' // Necesita lookup por email
};

// Cache para lookups
let comercialesMap = null;
let formasPagoMap = null;
let tiposClientesMap = null;
let idiomasMap = null;
let monedasMap = null;

/**
 * Normaliza el nombre de una columna
 */
function normalizeColumnName(columnName) {
  return String(columnName || '').trim();
}

/**
 * Carga los datos de lookup necesarios
 */
async function cargarLookups() {
  console.log('📚 Cargando datos de lookup...');
  
  // Comerciales (por email)
  const comerciales = await crm.query('SELECT id, Email FROM comerciales');
  comercialesMap = new Map();
  comerciales.forEach(c => {
    if (c.Email) {
      comercialesMap.set(c.Email.toLowerCase(), c.id);
    }
  });
  console.log(`  ✅ ${comercialesMap.size} comerciales cargados`);
  
  // Formas de Pago (por nombre)
  const formasPago = await crm.query('SELECT id, FormaPago FROM formas_pago');
  formasPagoMap = new Map();
  formasPago.forEach(fp => {
    if (fp.FormaPago) {
      formasPagoMap.set(fp.FormaPago.toLowerCase(), fp.id);
    }
  });
  console.log(`  ✅ ${formasPagoMap.size} formas de pago cargadas`);
  
  // Tipos de Cliente (por nombre - campo es "Tipo")
  try {
    const tiposClientes = await crm.query('SELECT id, Tipo FROM tipos_clientes');
    tiposClientesMap = new Map();
    tiposClientes.forEach(tc => {
      if (tc.Tipo) {
        tiposClientesMap.set(tc.Tipo.toLowerCase(), tc.id);
      }
    });
    console.log(`  ✅ ${tiposClientesMap.size} tipos de cliente cargados`);
  } catch (error) {
    console.log(`  ⚠️  Tabla tipos_clientes no existe o está vacía`);
    tiposClientesMap = new Map();
  }
  
  // Idiomas (por nombre o código)
  try {
    const idiomas = await crm.query('SELECT id, Codigo, Nombre FROM idiomas');
    idiomasMap = new Map();
    idiomas.forEach(i => {
      if (i.Codigo) {
        idiomasMap.set(i.Codigo.toLowerCase(), i.id);
      }
      if (i.Nombre) {
        idiomasMap.set(i.Nombre.toLowerCase(), i.id);
      }
    });
    console.log(`  ✅ ${idiomas.length} idiomas cargados`);
  } catch (error) {
    console.log(`  ⚠️  Tabla idiomas no existe o está vacía`);
    idiomasMap = new Map();
  }
  
  // Monedas (por código)
  try {
    const monedas = await crm.query('SELECT id, Codigo, Nombre FROM monedas');
    monedasMap = new Map();
    monedas.forEach(m => {
      if (m.Codigo) {
        monedasMap.set(m.Codigo.toLowerCase(), m.id);
      }
      if (m.Nombre) {
        monedasMap.set(m.Nombre.toLowerCase(), m.id);
      }
    });
    console.log(`  ✅ ${monedas.length} monedas cargadas`);
  } catch (error) {
    console.log(`  ⚠️  Tabla monedas no existe o está vacía`);
    monedasMap = new Map();
  }
  
  // Provincias
  try {
    provinciasDB = await crm.getProvincias();
    console.log(`  ✅ ${provinciasDB.length} provincias cargadas`);
  } catch (error) {
    console.log(`  ⚠️  Tabla provincias no existe o está vacía`);
    provinciasDB = [];
  }
  
  // Tipos de Cliente (verificar si existe)
  if (tiposClientesMap.size === 0) {
    console.log(`  ⚠️  Tabla tipos_clientes vacía, se guardará solo el nombre en TipoCliente`);
  }
}

/**
 * Limpia un número de teléfono: quita espacios, guiones, paréntesis y otros caracteres
 * Mantiene solo números (sin el + para ahorrar espacio)
 * Limita la longitud máxima a 13 caracteres (tamaño de columna Movil)
 */
function limpiarTelefono(telefono) {
  if (!telefono) return null;
  
  let limpio = String(telefono).trim();
  
  // Si tiene múltiples números separados por / o , tomar solo el primero
  if (limpio.includes('/')) {
    limpio = limpio.split('/')[0].trim();
  }
  if (limpio.includes(',')) {
    limpio = limpio.split(',')[0].trim();
  }
  
  // Eliminar todos los caracteres no numéricos
  limpio = limpio.replace(/[^\d]/g, '');
  
  // Eliminar ceros iniciales
  limpio = limpio.replace(/^0+/, '');
  if (!limpio || limpio === '') return null;
  
  // Limitar longitud a 13 caracteres (tamaño de columna Movil)
  if (limpio.length > 13) {
    limpio = limpio.substring(0, 13);
  }
  
  return limpio;
}

/**
 * Convierte un valor del Excel a un tipo adecuado para MySQL
 */
function convertirValor(valor, campoDestino) {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  
  // Convertir a string y limpiar
  let strValor = String(valor).trim();
  if (strValor === 'undefined' || strValor === 'null' || strValor === '') {
    return null;
  }
  
  // Limpieza especial para teléfonos
  if (campoDestino === 'Movil' || campoDestino === 'Telefono') {
    return limpiarTelefono(strValor);
  }
  
  // Conversiones específicas por tipo de campo
  if (campoDestino === 'Dto' || campoDestino === 'RE') {
    // Decimal
    const num = parseFloat(strValor);
    return isNaN(num) ? null : num;
  }
  
  if (campoDestino === 'CuentaContable' || campoDestino === 'Id_Cial' || 
      campoDestino === 'Id_FormaPago' || campoDestino === 'Id_TipoCliente' ||
      campoDestino === 'Id_Idioma' || campoDestino === 'Id_Moneda') {
    // Integer
    const num = parseInt(strValor);
    return isNaN(num) ? null : num;
  }
  
  if (campoDestino === 'Modelo_347') {
    // Boolean (tinyint)
    const val = strValor.toLowerCase();
    return (val === '1' || val === 'true' || val === 'si' || val === 'yes') ? 1 : 0;
  }
  
  // String por defecto
  return strValor;
}

/**
 * Busca el ID de comercial por email
 */
function buscarComercialId(email) {
  if (!email) return null;
  return comercialesMap.get(email.toLowerCase()) || null;
}

/**
 * Busca el ID de forma de pago por nombre
 */
function buscarFormaPagoId(nombre) {
  if (!nombre) return null;
  return formasPagoMap.get(nombre.toLowerCase()) || null;
}

/**
 * Busca el ID de tipo de cliente por nombre
 */
function buscarTipoClienteId(nombre) {
  if (!nombre) return null;
  return tiposClientesMap.get(nombre.toLowerCase()) || null;
}

/**
 * Busca el ID de idioma por nombre
 */
function buscarIdiomaId(nombre) {
  if (!nombre) return null;
  return idiomasMap.get(nombre.toLowerCase()) || null;
}

/**
 * Busca el ID de moneda por código
 */
function buscarMonedaId(codigo) {
  if (!codigo) return null;
  return monedasMap.get(codigo.toLowerCase()) || null;
}

/**
 * Mapea una fila del Excel a un objeto de cliente para MySQL
 */
function mapExcelRowToCliente(row, headers) {
  const cliente = {};
  
  // Crear mapa de headers a índices
  const headerMap = new Map();
  headers.forEach((header, index) => {
    const normalizedHeader = normalizeColumnName(header);
    if (normalizedHeader) {
      headerMap.set(normalizedHeader, index);
    }
  });
  
  // Mapear cada columna
  Object.entries(COLUMN_MAPPING).forEach(([excelCol, dbField]) => {
    if (!dbField) return; // Campo no mapeado
    
    const colIndex = headerMap.get(excelCol);
    if (colIndex === undefined) return;
    
    const valor = row[colIndex];
    if (valor === null || valor === undefined || valor === '') return;
    
    // Manejo especial para campos con lookup
    if (dbField === 'Id_Cial') {
      const comercialId = buscarComercialId(String(valor));
      if (comercialId) {
        cliente[dbField] = comercialId;
      }
    } else if (dbField === 'Id_FormaPago') {
      const formaPagoId = buscarFormaPagoId(String(valor));
      if (formaPagoId) {
        cliente[dbField] = formaPagoId;
      } else if (valor) {
        cliente['Tarifa'] = String(valor); // Guardar nombre como Tarifa si no se encuentra ID
      }
    } else if (dbField === 'TipoCliente') {
      const tipoClienteId = buscarTipoClienteId(String(valor));
      if (tipoClienteId) {
        cliente['Id_TipoCliente'] = tipoClienteId;
      }
      cliente[dbField] = String(valor); // Guardar también el nombre
    } else if (dbField === 'Idioma') {
      const idiomaId = buscarIdiomaId(String(valor));
      if (idiomaId) {
        cliente['Id_Idioma'] = idiomaId;
      }
      cliente[dbField] = String(valor); // Guardar también el nombre
    } else if (dbField === 'Moneda') {
      const monedaId = buscarMonedaId(String(valor));
      if (monedaId) {
        cliente['Id_Moneda'] = monedaId;
      }
      cliente[dbField] = String(valor); // Guardar también el código
    } else {
      // Campo normal
      const valorConvertido = convertirValor(valor, dbField);
      if (valorConvertido !== null) {
        cliente[dbField] = valorConvertido;
      }
    }
  });
  
  // Manejo especial para Direccion/Ubicacion
  if (!cliente.Direccion) {
    const ubicacionIndex = headerMap.get('Ubicacion');
    if (ubicacionIndex !== undefined && row[ubicacionIndex]) {
      cliente.Direccion = String(row[ubicacionIndex]).trim();
    }
  }
  
  // Manejo especial para Movil/Telefono (ya viene limpio de convertirValor, pero por si acaso)
  if (!cliente.Movil) {
    const telefonoIndex = headerMap.get('Telefono');
    if (telefonoIndex !== undefined && row[telefonoIndex]) {
      cliente.Movil = limpiarTelefono(row[telefonoIndex]);
    }
  } else {
    // Asegurar que Movil esté limpio
    cliente.Movil = limpiarTelefono(cliente.Movil);
  }
  
  // Asociar provincia por código postal (si hay código postal y provincias cargadas)
  if (cliente.CodigoPostal && provinciasDB && provinciasDB.length > 0) {
    const provinciaId = obtenerProvinciaPorCodigoPostal(cliente.CodigoPostal, provinciasDB);
    if (provinciaId) {
      cliente.Id_Provincia = provinciaId;
      // También actualizar Pais si se detectó la provincia
      const provincia = provinciasDB.find(p => p.id === provinciaId);
      if (provincia && !cliente.Pais) {
        cliente.Pais = provincia.Pais;
      }
      if (provincia && !cliente.CodPais) {
        cliente.CodPais = provincia.CodigoPais;
      }
    }
  }
  
  // Normalizar nombres a formato Title Case
  if (cliente.Nombre_Razon_Social) {
    cliente.Nombre_Razon_Social = toTitleCase(cliente.Nombre_Razon_Social);
  }
  if (cliente.NomContacto) {
    cliente.NomContacto = toTitleCase(cliente.NomContacto);
  }
  if (cliente.Poblacion) {
    cliente.Poblacion = toTitleCase(cliente.Poblacion);
  }
  if (cliente.Direccion) {
    // Para direcciones, normalizar pero mantener números y códigos
    cliente.Direccion = cliente.Direccion
      .split(',')
      .map(parte => toTitleCase(parte.trim()))
      .join(', ');
  }
  
  // Validar campos requeridos
  if (!cliente.Nombre_Razon_Social || cliente.Nombre_Razon_Social.trim() === '') {
    return null; // Sin nombre, no podemos crear
  }
  
  if (!cliente.DNI_CIF) {
    cliente.DNI_CIF = ''; // Campo requerido, poner vacío si no hay
  }
  
  if (!cliente.Id_Cial) {
    cliente.Id_Cial = 1; // Por defecto, comercial ID 1 (ajustar según necesidad)
  }
  
  return cliente;
}

/**
 * Lee el archivo Excel y extrae los datos de clientes
 */
function leerExcel(archivo) {
  try {
    console.log(`📖 Leyendo archivo Excel: ${archivo}`);
    const workbook = XLSX.readFile(archivo);
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`📄 Hoja encontrada: ${sheetName}`);
    
    const datos = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    if (datos.length < 2) {
      throw new Error('El archivo Excel no tiene suficientes filas');
    }
    
    const headers = datos[0].map(h => normalizeColumnName(h));
    console.log(`📊 ${headers.length} columnas encontradas`);
    
    const clientes = [];
    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i];
      const cliente = mapExcelRowToCliente(fila, headers);
      if (cliente) {
        clientes.push(cliente);
      }
    }
    
    console.log(`✅ ${clientes.length} clientes válidos extraídos del Excel`);
    return clientes;
  } catch (error) {
    console.error('❌ Error leyendo el archivo Excel:', error.message);
    throw error;
  }
}

/**
 * Normaliza un valor para comparación (sin tildes, mayúsculas, sin espacios extra)
 */
function normalizarValor(valor) {
  if (!valor) return '';
  return String(valor)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar tildes
    .replace(/\s+/g, ' ');
}

/**
 * Convierte un texto a formato Title Case (primera letra de cada palabra en mayúscula)
 * Respeta preposiciones comunes y mantiene algunas palabras en minúsculas
 * @param {string} texto - Texto a convertir
 * @returns {string} - Texto en formato Title Case
 */
function toTitleCase(texto) {
  if (!texto) return '';
  
  // Preposiciones y artículos que deben permanecer en minúsculas (excepto al inicio)
  const palabrasMinusculas = ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 
                              'en', 'por', 'para', 'con', 'sin', 'sobre', 'entre', 'durante',
                              'desde', 'hasta', 'según', 'mediante', 'durante', 'bajo', 'sobre',
                              'contra', 'tras', 'ante', 'cabe', 'so', 'versus', 'vía', 'v.', 'y', 'e'];
  
  // Normalizar espacios y convertir a array de palabras
  const palabras = String(texto)
    .trim()
    .split(/\s+/)
    .filter(p => p.length > 0);
  
  if (palabras.length === 0) return '';
  
  // Convertir cada palabra
  const palabrasConvertidas = palabras.map((palabra, index) => {
    // Si está vacía o solo tiene caracteres especiales, dejarla como está
    if (!palabra || /^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+$/.test(palabra)) {
      return palabra;
    }
    
    // Siempre poner en mayúscula la primera palabra
    if (index === 0) {
      return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
    }
    
    // Para palabras siguientes, verificar si es una preposición
    const palabraLower = palabra.toLowerCase().replace(/[.,;:!?()\-]/g, '');
    if (palabrasMinusculas.includes(palabraLower)) {
      // Mantener en minúscula, pero respetar formato original para guiones
      return palabra.toLowerCase();
    }
    
    // Convertir a Title Case
    // Manejar palabras con guiones o apóstrofes
    if (palabra.includes('-')) {
      return palabra
        .split('-')
        .map(parte => {
          if (!parte || /^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+$/.test(parte)) return parte;
          return parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase();
        })
        .join('-');
    }
    
    if (palabra.includes("'")) {
      return palabra
        .split("'")
        .map(parte => {
          if (!parte || /^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+$/.test(parte)) return parte;
          return parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase();
        })
        .join("'");
    }
    
    return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
  });
  
  return palabrasConvertidas.join(' ');
}

/**
 * Busca un cliente existente en la base de datos
 */
function buscarClienteExistente(clienteExcel, clientesDB) {
  // 1. Intentar buscar por NumeroFarmacia (campo único en BD)
  if (clienteExcel.NumeroFarmacia) {
    const numeroNormalizado = String(clienteExcel.NumeroFarmacia).trim();
    const encontrado = clientesDB.find(c => {
      const numeroDB = String(c.NumeroFarmacia || '').trim();
      return numeroDB === numeroNormalizado && numeroDB !== '';
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  // 2. Intentar buscar por CuentaContable (campo único en BD)
  if (clienteExcel.CuentaContable) {
    const cuentaNormalizada = String(clienteExcel.CuentaContable).trim();
    const encontrado = clientesDB.find(c => {
      const cuentaDB = String(c.CuentaContable || '').trim();
      return cuentaDB === cuentaNormalizada && cuentaDB !== '';
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  // 3. Intentar buscar por DNI_CIF (muy preciso)
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
  
  // 4. Buscar por Email (muy preciso)
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
  
  // 5. Buscar por Nombre_Razon_Social y Teléfono (combinación)
  if (clienteExcel.Nombre_Razon_Social && (clienteExcel.Movil || clienteExcel.Telefono)) {
    const nombreNormalizado = normalizarValor(clienteExcel.Nombre_Razon_Social);
    const telefonoNormalizado = normalizarValor(clienteExcel.Movil || clienteExcel.Telefono || '');
    const encontrado = clientesDB.find(c => {
      const nombreDB = normalizarValor(c.Nombre_Razon_Social || c.Nombre || c.nombre || '');
      const telefonoDB = normalizarValor(c.Movil || c.Telefono || c.Teléfono || c.Móvil || '');
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
  
  // 6. Buscar por Nombre_Razon_Social y Dirección/Población (combinación)
  if (clienteExcel.Nombre_Razon_Social && (clienteExcel.Direccion || clienteExcel.Poblacion)) {
    const nombreNormalizado = normalizarValor(clienteExcel.Nombre_Razon_Social);
    const direccionNormalizada = normalizarValor(clienteExcel.Direccion || '');
    const poblacionNormalizada = normalizarValor(clienteExcel.Poblacion || '');
    
    const encontrado = clientesDB.find(c => {
      const nombreDB = normalizarValor(c.Nombre_Razon_Social || c.Nombre || c.nombre || '');
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
  
  return null;
}

/**
 * Inserta un cliente en la base de datos
 */
async function insertarCliente(cliente) {
  const campos = Object.keys(cliente).map(c => `\`${c}\``).join(', ');
  const valores = Object.values(cliente);
  const placeholders = valores.map(() => '?').join(', ');
  
  const sql = `INSERT INTO clientes (${campos}) VALUES (${placeholders})`;
  await crm.query(sql, valores);
}

/**
 * Actualiza un cliente existente en la base de datos
 */
async function actualizarCliente(id, cliente) {
  const campos = Object.keys(cliente).map(c => `\`${c}\` = ?`).join(', ');
  const valores = Object.values(cliente);
  valores.push(id);
  
  const sql = `UPDATE clientes SET ${campos} WHERE Id = ?`;
  await crm.query(sql, valores);
}

/**
 * Función principal
 */
async function importarClientes() {
  try {
    console.log('🚀 Iniciando importación de clientes desde Excel...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    console.log(`📁 Archivo Excel: ${EXCEL_FILE}\n`);
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Cargar lookups
    await cargarLookups();
    console.log('');
    
    // Leer Excel
    const clientes = leerExcel(EXCEL_FILE);
    console.log(`✅ ${clientes.length} clientes a procesar\n`);
    
    if (clientes.length === 0) {
      console.log('⚠️  No hay clientes para importar');
      return;
    }
    
    // Cargar clientes existentes de la BD para detectar duplicados
    console.log('🔍 Cargando clientes existentes de la base de datos...');
    const clientesDB = await crm.getClientes();
    console.log(`✅ ${clientesDB.length} clientes encontrados en la base de datos\n`);
    
    // Mostrar estadísticas de campos mapeados
    const camposMapeados = new Set();
    clientes.forEach(c => {
      Object.keys(c).forEach(key => camposMapeados.add(key));
    });
    console.log(`📊 Campos que se importarán: ${Array.from(camposMapeados).join(', ')}\n`);
    
    // Mostrar ejemplo de primer cliente
    if (DRY_RUN && clientes.length > 0) {
      console.log('📋 Ejemplo del primer cliente a importar:');
      console.log(JSON.stringify(clientes[0], null, 2));
      console.log('');
    }
    
    // Importar clientes
    let importados = 0;
    let actualizados = 0;
    let duplicados = 0;
    let errores = 0;
    const erroresList = [];
    const duplicadosList = [];
    
    console.log(DRY_RUN ? '🔍 Simulando importación...' : '💾 Importando clientes...');
    console.log('');
    
    for (let i = 0; i < clientes.length; i++) {
      const cliente = clientes[i];
      const numero = i + 1;
      const nombre = cliente.Nombre_Razon_Social || 'Sin nombre';
      
      try {
        // Buscar si el cliente ya existe
        const clienteExistente = buscarClienteExistente(cliente, clientesDB);
        
        if (clienteExistente) {
          // Cliente existe, actualizar
          const clienteId = clienteExistente.Id || clienteExistente.id;
          
          if (DRY_RUN) {
            console.log(`[${numero}/${clientes.length}] 🔄 [SIMULACIÓN] Actualizando cliente existente: ${nombre} (ID: ${clienteId})`);
            actualizados++;
          } else {
            // Preparar datos para actualizar (excluir campos que no deben actualizarse)
            const datosActualizacion = { ...cliente };
            delete datosActualizacion.Id; // No actualizar el ID
            delete datosActualizacion.id; // Por si acaso
            
            await actualizarCliente(clienteId, datosActualizacion);
            console.log(`[${numero}/${clientes.length}] 🔄 Actualizado: ${nombre} (ID: ${clienteId})`);
            actualizados++;
          }
          
          duplicadosList.push({
            nombre,
            id: clienteId,
            motivo: clienteExistente.NumeroFarmacia ? 'NumeroFarmacia' : 
                   clienteExistente.CuentaContable ? 'CuentaContable' :
                   clienteExistente.DNI_CIF ? 'DNI_CIF' :
                   clienteExistente.Email ? 'Email' : 'Nombre+Otros'
          });
        } else {
          // Cliente no existe, crear nuevo
          if (DRY_RUN) {
            console.log(`[${numero}/${clientes.length}] 🆕 [SIMULACIÓN] Creando nuevo cliente: ${nombre}`);
            importados++;
          } else {
            await insertarCliente(cliente);
            console.log(`[${numero}/${clientes.length}] 🆕 Creado: ${nombre}`);
            importados++;
          }
        }
        
        // Pequeña pausa para no sobrecargar la BD
        if (!DRY_RUN && (i + 1) % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        errores++;
        const errorMsg = `Error en cliente ${numero} (${nombre}): ${error.message}`;
        erroresList.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
        
        // Si es error de duplicado único (NumeroFarmacia o CuentaContable), marcarlo
        if (error.message.includes('Duplicate entry') || error.message.includes('UNIQUE constraint')) {
          duplicados++;
          duplicadosList.push({
            nombre,
            motivo: 'Error de restricción única (NumeroFarmacia/CuentaContable)'
          });
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Importación completada');
    console.log('='.repeat(80));
    console.log(`📊 Resumen:`);
    console.log(`   ✅ Nuevos clientes creados: ${importados}`);
    console.log(`   🔄 Clientes actualizados: ${actualizados}`);
    if (duplicados > 0) {
      console.log(`   ⚠️  Duplicados detectados: ${duplicados}`);
    }
    console.log(`   ❌ Errores: ${errores}`);
    
    if (duplicadosList.length > 0 && DRY_RUN) {
      console.log(`\n📋 Duplicados encontrados (${duplicadosList.length}):`);
      duplicadosList.slice(0, 10).forEach(dup => {
        console.log(`   - ${dup.nombre} (${dup.motivo}${dup.id ? ` - ID: ${dup.id}` : ''})`);
      });
      if (duplicadosList.length > 10) {
        console.log(`   ... y ${duplicadosList.length - 10} más`);
      }
    }
    
    if (errores > 0) {
      console.log('\n❌ Errores encontrados:');
      erroresList.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      if (erroresList.length > 10) {
        console.log(`   ... y ${erroresList.length - 10} errores más`);
      }
    }
    
    if (DRY_RUN) {
      console.log('\n⚠️  MODO SIMULACIÓN: No se realizaron cambios reales');
      console.log('   Para realizar la importación real, ejecuta sin --dry-run');
    }
    
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error general:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  importarClientes()
    .then(() => {
      console.log('\n✅ Proceso completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { importarClientes, leerExcel };

