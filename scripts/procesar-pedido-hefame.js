/**
 * Script para procesar pedidos tipo Transfer Hefame desde Excel
 * - Verifica/crea el cliente
 * - Crea el pedido
 * - Crea las líneas del pedido con cantidades > 0
 */

const XLSX = require('xlsx');
const path = require('path');
const readline = require('readline');
const crm = require('../config/mysql-crm');

// Configuración
const EXCEL_FILE = process.argv[2] || 'C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\202501030 Transfer Directo Juan Pablo Conejero.xlsx';
const COMERCIAL_NOMBRE = process.argv[3] || 'Cristina Rico'; // Puede ser nombre o ID
const SERIE_PEDIDO = 'Transfer';
const TIPO_PEDIDO_NOMBRE = 'Transfer';

// Mayoristas y sus formas de pago
const MAYORISTAS = {
  'hefame': 'Hefame',
  'cofares': 'Cofares',
  'alliance': 'Alliance'
};

// Cache para lookups
let comercialId = null;
let tipoPedidoId = null;
let formaPagoId = null;

/**
 * Carga los datos de lookup necesarios
 */
async function cargarLookups() {
  console.log('📚 Cargando datos de lookup...');
  
  // Buscar comercial por nombre o ID
  const comerciales = await crm.getComerciales();
  let comercial = null;
  
  // Si es un número, buscar por ID
  if (!isNaN(COMERCIAL_NOMBRE)) {
    comercial = comerciales.find(c => (c.id || c.Id) == COMERCIAL_NOMBRE);
  } else {
    // Buscar por nombre (búsqueda flexible)
    const nombreBusqueda = COMERCIAL_NOMBRE.toLowerCase();
    comercial = comerciales.find(c => {
      const nombre = (c.Nombre || '').toLowerCase();
      // Buscar si contiene "rico" o "cristian" o "cristina"
      return nombre.includes('rico') || 
             nombre.includes('cristian') || 
             nombre.includes('cristina') ||
             nombre === nombreBusqueda ||
             nombre.includes(nombreBusqueda);
    });
  }
  
  if (!comercial) {
    console.error(`\n⚠️  Comerciales disponibles:`);
    comerciales.forEach(c => {
      console.error(`   - ID: ${c.id || c.Id}, Nombre: ${c.Nombre}`);
    });
    throw new Error(`No se encontró el comercial "${COMERCIAL_NOMBRE}". Use el ID o nombre exacto.`);
  }
  
  comercialId = comercial.id || comercial.Id;
  console.log(`  ✅ Comercial encontrado: ${comercial.Nombre} (ID: ${comercialId})`);
  
  // Buscar tipo de pedido (Transfer)
  try {
    const tiposPedido = await crm.query('SELECT id, Tipo FROM tipos_pedidos');
    let tipoPedido = tiposPedido.find(tp => 
      (tp.Tipo || '').toLowerCase().includes('transfer')
    );
    
    if (!tipoPedido && tiposPedido.length > 0) {
      // Si no encuentra, usar el primero disponible
      tipoPedido = tiposPedido[0];
      console.log(`  ⚠️  Tipo de pedido "Transfer" no encontrado, usando: ${tipoPedido.Tipo}`);
    } else if (!tipoPedido) {
      throw new Error('No se encontró ningún tipo de pedido en la base de datos');
    }
    
    tipoPedidoId = tipoPedido.id || tipoPedido.Id;
    console.log(`  ✅ Tipo de pedido: ${tipoPedido.Tipo} (ID: ${tipoPedidoId})`);
  } catch (error) {
    console.error(`  ❌ Error obteniendo tipos de pedido: ${error.message}`);
    throw error;
  }
  
  // La forma de pago se asignará después según el mayorista detectado
  // Por ahora solo cargamos las formas de pago disponibles
  try {
    await crm.query('SELECT id, FormaPago FROM formas_pago');
    console.log(`  ✅ Formas de pago cargadas`);
  } catch (error) {
    console.error(`  ❌ Error obteniendo formas de pago: ${error.message}`);
    throw error;
  }
}

/**
 * Detecta el mayorista del nombre del archivo
 */
function detectarMayorista(nombreArchivo) {
  const nombreLower = nombreArchivo.toLowerCase();
  
  for (const [key, mayorista] of Object.entries(MAYORISTAS)) {
    if (nombreLower.includes(key)) {
      return mayorista;
    }
  }
  
  return null;
}

/**
 * Obtiene la forma de pago según el mayorista
 */
async function obtenerFormaPagoMayorista(mayorista) {
  if (!mayorista) {
    // Si no se detecta mayorista, usar Transferencia por defecto
    const formasPago = await crm.query('SELECT id, FormaPago FROM formas_pago');
    let formaPago = formasPago.find(fp => 
      (fp.FormaPago || '').toLowerCase().includes('transferencia') ||
      (fp.FormaPago || '').toLowerCase().includes('transfer')
    );
    
    if (!formaPago && formasPago.length > 0) {
      formaPago = formasPago[0];
    }
    
    return formaPago ? (formaPago.id || formaPago.Id) : null;
  }
  
  // Buscar forma de pago del mayorista
  const formasPago = await crm.query('SELECT id, FormaPago FROM formas_pago WHERE FormaPago = ? LIMIT 1', [mayorista]);
  
  if (formasPago.length > 0) {
    return formasPago[0].id || formasPago[0].Id;
  }
  
  return null;
}

/**
 * Extrae la fecha del nombre del archivo (formato: YYYYMMDD Resto)
 */
function extraerFechaDelNombreArchivo(nombreArchivo) {
  // Extraer solo el nombre del archivo sin la ruta
  const nombre = path.basename(nombreArchivo, path.extname(nombreArchivo));
  
  // Buscar patrón YYYYMMDD al inicio
  const match = nombre.match(/^(\d{4})(\d{2})(\d{2})/);
  
  if (match) {
    const año = match[1];
    const mes = match[2];
    const dia = match[3];
    return `${año}-${mes}-${dia}`;
  }
  
  return null;
}

/**
 * Parsea el archivo Excel y extrae los datos
 */
function parsearExcel(archivo) {
  console.log(`\n📄 Leyendo archivo: ${archivo}`);
  
  const wb = XLSX.readFile(archivo);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const dataArray = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  
  const datos = {
    numPedido: null,
    fechaPedido: null,
    mayorista: null,
    cliente: {
      codigoMayorista: null // Código de asociado (ej: Código Hefame: 22225)
    },
    lineas: []
  };
  
  // Detectar mayorista del nombre del archivo
  datos.mayorista = detectarMayorista(archivo);
  if (datos.mayorista) {
    console.log(`  🏢 Mayorista detectado: ${datos.mayorista}`);
  }
  
  // Intentar extraer fecha del nombre del archivo primero
  datos.fechaPedido = extraerFechaDelNombreArchivo(archivo);
  if (datos.fechaPedido) {
    console.log(`  📅 Fecha extraída del nombre del archivo: ${datos.fechaPedido}`);
  }
  
  // Buscar número de pedido (fila que contiene "Nº Pedido:")
  for (let i = 0; i < dataArray.length; i++) {
    const row = dataArray[i];
    const rowStr = row.join('|').toLowerCase();
    if (rowStr.includes('nº pedido') || rowStr.includes('pedido:')) {
      // Buscar el número en la misma fila
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (cell && typeof cell === 'number' && cell > 0) {
          const numPedidoStr = String(cell);
          datos.numPedido = numPedidoStr;
          
          // Extraer fecha del número de pedido (formato YYYYMMDD) si no se había extraído antes
          // Ejemplo: 20251030 → 2025-10-30
          if (!datos.fechaPedido && numPedidoStr.length === 8) {
            const año = numPedidoStr.substring(0, 4);
            const mes = numPedidoStr.substring(4, 6);
            const dia = numPedidoStr.substring(6, 8);
            datos.fechaPedido = `${año}-${mes}-${dia}`;
            console.log(`  📅 Fecha extraída del número de pedido: ${datos.fechaPedido}`);
          }
          break;
        }
      }
      break;
    }
  }
  
  // Si no se encontró fecha, intentar extraerla del nombre del archivo
  if (!datos.fechaPedido) {
    datos.fechaPedido = extraerFechaDelNombreArchivo(archivo);
    if (datos.fechaPedido) {
      console.log(`  📅 Fecha extraída del nombre del archivo (fallback): ${datos.fechaPedido}`);
    }
  }
  
  // Buscar datos del cliente
  let enSeccionCliente = false;
  for (let i = 0; i < dataArray.length; i++) {
    const row = dataArray[i];
    const rowStr = row.join('|').toLowerCase();
    
    if (rowStr.includes('datos farmacia')) {
      enSeccionCliente = true;
      continue;
    }
    
    if (enSeccionCliente) {
      if (row[0] && typeof row[0] === 'string') {
        const campo = row[0].toLowerCase().trim();
        const valor = row[1];
        
        if (campo.includes('nombre')) {
          datos.cliente.Nombre_Razon_Social = String(valor || '').trim();
        } else if (campo.includes('código hefame') || campo.includes('codigo hefame')) {
          const codigoHefame = String(valor || '').trim().replace(/\r\n/g, '');
          datos.cliente.NumeroFarmacia = codigoHefame;
          datos.cliente.codigoMayorista = codigoHefame; // Guardar también como código de mayorista
        } else if (campo.includes('dni') || campo.includes('cif')) {
          datos.cliente.DNI_CIF = String(valor || '').trim();
        } else if (campo.includes('teléfono') || campo.includes('telefono')) {
          datos.cliente.Telefono = String(valor || '').trim();
          datos.cliente.Movil = String(valor || '').trim();
        } else if (campo.includes('email')) {
          datos.cliente.Email = String(valor || '').trim();
        } else if (campo.includes('código postal') || campo.includes('codigo postal')) {
          datos.cliente.CodigoPostal = String(valor || '').trim();
        } else if (campo.includes('población') || campo.includes('poblacion')) {
          datos.cliente.Poblacion = String(valor || '').trim();
        }
      }
      
      // Si encontramos "DATOS DE CONTENIDO", terminamos la sección de cliente
      if (rowStr.includes('datos de contenido')) {
        break;
      }
    }
  }
  
  // Buscar líneas del pedido
  let enSeccionLineas = false;
  let encabezadosLineas = null;
  
  for (let i = 0; i < dataArray.length; i++) {
    const row = dataArray[i];
    const rowStr = row.join('|').toLowerCase();
    
    if (rowStr.includes('cantidad') && rowStr.includes('descripción')) {
      encabezadosLineas = row;
      enSeccionLineas = true;
      continue;
    }
    
    if (enSeccionLineas && encabezadosLineas) {
      // Buscar la columna de cantidad
      const idxCantidad = encabezadosLineas.findIndex(h => 
        String(h || '').toLowerCase().includes('cantidad')
      );
      const idxCN = encabezadosLineas.findIndex(h => 
        String(h || '').toLowerCase() === 'cn' || String(h || '').toLowerCase().includes('código')
      );
      const idxDescripcion = encabezadosLineas.findIndex(h => 
        String(h || '').toLowerCase().includes('descripción') || 
        String(h || '').toLowerCase().includes('descripcion')
      );
      const idxDto = encabezadosLineas.findIndex(h => 
        String(h || '').toLowerCase().includes('dto') || 
        String(h || '').toLowerCase().includes('descuento')
      );
      
      // Leer cantidad
      const cantidad = idxCantidad >= 0 ? row[idxCantidad] : null;
      const cantidadNum = cantidad ? Number(cantidad) : 0;
      
      // Solo procesar líneas con cantidad > 0
      if (cantidadNum > 0) {
        const linea = {
          Cantidad: cantidadNum,
          CN: idxCN >= 0 ? String(row[idxCN] || '').trim() : '',
          Descripcion: idxDescripcion >= 0 ? String(row[idxDescripcion] || '').trim() : '',
          Dto: idxDto >= 0 ? (row[idxDto] ? Number(row[idxDto]) : 0) : 0
        };
        
        datos.lineas.push(linea);
      }
      
      // Si la fila está vacía o tiene un asterisco, puede ser el final
      if (rowStr.includes('*') || (row.every(cell => !cell || cell === ''))) {
        // Continuar un poco más por si hay más líneas
        continue;
      }
    }
  }
  
  console.log(`  ✅ Número de pedido: ${datos.numPedido || 'NO ENCONTRADO'}`);
  console.log(`  ✅ Cliente: ${datos.cliente.Nombre_Razon_Social || 'NO ENCONTRADO'}`);
  console.log(`  ✅ Líneas con cantidad > 0: ${datos.lineas.length}`);
  
  return datos;
}

/**
 * Calcula la similitud entre dos cadenas (número de caracteres coincidentes)
 */
function calcularSimilitud(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Contar caracteres coincidentes en orden
  let coincidencias = 0;
  const minLen = Math.min(s1.length, s2.length);
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) coincidencias++;
  }
  
  // También verificar si una cadena contiene la otra
  if (s1.includes(s2) || s2.includes(s1)) {
    coincidencias += Math.max(s1.length, s2.length);
  }
  
  return coincidencias;
}

/**
 * Busca un cliente por DNI_CIF, Email o nombre similar
 */
async function buscarCliente(datosCliente) {
  // Primero buscar por DNI_CIF (más preciso)
  if (datosCliente.DNI_CIF) {
    const sql = `SELECT * FROM clientes WHERE DNI_CIF = ? LIMIT 1`;
    const resultados = await crm.query(sql, [datosCliente.DNI_CIF]);
    if (resultados.length > 0) {
      return resultados[0];
    }
  }
  
  // Si no se encuentra por DNI, buscar por email
  if (datosCliente.Email) {
    const sql = `SELECT * FROM clientes WHERE Email = ? LIMIT 1`;
    const resultados = await crm.query(sql, [datosCliente.Email]);
    if (resultados.length > 0) {
      return resultados[0];
    }
  }
  
  // Si no se encuentra, buscar por nombre similar
  if (datosCliente.Nombre_Razon_Social) {
    const nombreBusqueda = datosCliente.Nombre_Razon_Social.trim();
    
    // Extraer palabras clave del nombre (palabras de más de 3 caracteres)
    const palabras = nombreBusqueda.split(/\s+/).filter(p => p.length > 3);
    
    // Buscar por nombre completo primero
    let sql = `SELECT * FROM clientes WHERE Nombre_Razon_Social LIKE ? LIMIT 20`;
    let resultados = await crm.query(sql, [`%${nombreBusqueda}%`]);
    
    // Si no hay resultados, buscar por palabras clave
    if (resultados.length === 0 && palabras.length > 0) {
      const condiciones = palabras.map(() => 'Nombre_Razon_Social LIKE ?').join(' OR ');
      const valores = palabras.map(p => `%${p}%`);
      sql = `SELECT * FROM clientes WHERE ${condiciones} LIMIT 20`;
      resultados = await crm.query(sql, valores);
    }
    
    if (resultados.length > 0) {
      // Encontrar el que tenga mayor similitud
      let mejorMatch = null;
      let mejorSimilitud = 0;
      
      for (const cliente of resultados) {
        const similitud = calcularSimilitud(
          cliente.Nombre_Razon_Social || '',
          nombreBusqueda
        );
        if (similitud > mejorSimilitud) {
          mejorSimilitud = similitud;
          mejorMatch = cliente;
        }
      }
      
      // Si la similitud es razonable (al menos 10 caracteres coincidentes), devolverlo
      if (mejorMatch && mejorSimilitud >= 10) {
        console.log(`  🔍 Cliente encontrado por similitud de nombre (${mejorSimilitud} caracteres coincidentes)`);
        return mejorMatch;
      }
    }
  }
  
  return null;
}

/**
 * Muestra los datos del cliente y pide confirmación
 */
function mostrarDatosYConfirmar(datosCliente) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  CLIENTE NO ENCONTRADO - DATOS DEL PEDIDO:');
    console.log('='.repeat(80));
    console.log(`Nombre: ${datosCliente.Nombre_Razon_Social || 'N/A'}`);
    console.log(`DNI/CIF: ${datosCliente.DNI_CIF || 'N/A'}`);
    console.log(`Email: ${datosCliente.Email || 'N/A'}`);
    console.log(`Teléfono: ${datosCliente.Telefono || datosCliente.Movil || 'N/A'}`);
    console.log(`Código Postal: ${datosCliente.CodigoPostal || 'N/A'}`);
    console.log(`Población: ${datosCliente.Poblacion || 'N/A'}`);
    console.log(`Número Farmacia: ${datosCliente.NumeroFarmacia || 'N/A'}`);
    console.log('='.repeat(80));
    
    rl.question('\n¿Deseas crear un nuevo cliente con estos datos? (s/n): ', (respuesta) => {
      rl.close();
      resolve(respuesta.toLowerCase() === 's' || respuesta.toLowerCase() === 'si' || respuesta.toLowerCase() === 'y' || respuesta.toLowerCase() === 'yes');
    });
  });
}

/**
 * Busca o crea la cooperativa según el mayorista
 */
async function obtenerCooperativaMayorista(mayorista) {
  if (!mayorista) return null;
  
  // Mapear mayoristas a nombres de cooperativas
  const mapeoMayoristas = {
    'Hefame': 'HEFAME',
    'Cofares': 'COFARES',
    'Alliance': 'Alliance Healthcare España'
  };
  
  const nombreCooperativa = mapeoMayoristas[mayorista] || mayorista.toUpperCase();
  
  // Buscar cooperativa
  const cooperativas = await crm.query(
    'SELECT * FROM cooperativas WHERE Nombre = ? OR Nombre LIKE ? LIMIT 1',
    [nombreCooperativa, `%${nombreCooperativa}%`]
  );
  
  if (cooperativas.length > 0) {
    return cooperativas[0];
  }
  
  // Si no existe, crear la cooperativa
  console.log(`  🆕 Creando cooperativa: ${nombreCooperativa}`);
  const resultado = await crm.query(
    'INSERT INTO cooperativas (Nombre, Email, Contacto) VALUES (?, ?, ?)',
    [nombreCooperativa, `${nombreCooperativa.toLowerCase().replace(/\s+/g, '')}@mayorista.es`, 'Departamento Comercial']
  );
  
  const nuevaCooperativa = await crm.query(
    'SELECT * FROM cooperativas WHERE id = ? LIMIT 1',
    [resultado.insertId]
  );
  
  return nuevaCooperativa.length > 0 ? nuevaCooperativa[0] : null;
}

/**
 * Crea o actualiza la relación cliente-cooperativa
 */
async function gestionarRelacionClienteCooperativa(clienteId, cooperativaId, codigoAsociado) {
  if (!clienteId || !cooperativaId || !codigoAsociado) {
    return;
  }
  
  // Verificar si ya existe la relación
  const relacionesExistentes = await crm.query(
    'SELECT * FROM clientes_cooperativas WHERE Id_Cliente = ? AND Id_Cooperativa = ? LIMIT 1',
    [clienteId, cooperativaId]
  );
  
  if (relacionesExistentes.length > 0) {
    // Actualizar relación existente
    const relacionId = relacionesExistentes[0].id || relacionesExistentes[0].Id;
    await crm.query(
      'UPDATE clientes_cooperativas SET NumAsociado = ? WHERE id = ?',
      [codigoAsociado, relacionId]
    );
    console.log(`  🔄 Relación cliente-cooperativa actualizada (ID: ${relacionId})`);
  } else {
    // Crear nueva relación
    const resultado = await crm.query(
      'INSERT INTO clientes_cooperativas (Id_Cliente, Id_Cooperativa, NumAsociado) VALUES (?, ?, ?)',
      [clienteId, cooperativaId, codigoAsociado]
    );
    const relacionId = resultado.insertId || resultado.Id || resultado.id;
    console.log(`  ✅ Relación cliente-cooperativa creada (ID: ${relacionId})`);
  }
}

/**
 * Crea o actualiza un cliente
 */
async function gestionarCliente(datosCliente) {
  console.log(`\n👤 Gestionando cliente: ${datosCliente.Nombre_Razon_Social}`);
  
  // Buscar cliente existente
  const clienteExistente = await buscarCliente(datosCliente);
  
  if (clienteExistente) {
    console.log(`  ✅ Cliente encontrado (ID: ${clienteExistente.id || clienteExistente.Id})`);
    console.log(`     Nombre en BD: ${clienteExistente.Nombre_Razon_Social || 'N/A'}`);
    console.log(`     DNI/CIF en BD: ${clienteExistente.DNI_CIF || 'N/A'}`);
    
    // Preparar datos para actualizar (solo campos que tienen valor)
    const datosActualizar = {
      Id_Cial: comercialId
    };
    
    // Actualizar solo campos que tienen valor y son diferentes
    // Excluir codigoMayorista ya que va en Clientes_Cooperativas
    Object.keys(datosCliente).forEach(key => {
      if (key === 'codigoMayorista') return; // No actualizar este campo en clientes
      
      if (datosCliente[key] && datosCliente[key] !== '') {
        const valorActual = clienteExistente[key];
        if (valorActual !== datosCliente[key]) {
          datosActualizar[key] = datosCliente[key];
        }
      }
    });
    
    if (Object.keys(datosActualizar).length > 1) { // Más que solo Id_Cial
      console.log(`  🔄 Actualizando cliente con campos: ${Object.keys(datosActualizar).join(', ')}`);
      await crm.updateCliente(clienteExistente.id || clienteExistente.Id, datosActualizar);
      console.log(`  ✅ Cliente actualizado`);
    } else {
      console.log(`  ℹ️  No hay cambios necesarios`);
    }
    
    return clienteExistente.id || clienteExistente.Id;
  } else {
    console.log(`  ⚠️  Cliente no encontrado`);
    
    // Mostrar datos y pedir confirmación
    const confirmar = await mostrarDatosYConfirmar(datosCliente);
    
    if (!confirmar) {
      throw new Error('Proceso cancelado por el usuario');
    }
    
    console.log(`  🆕 Creando nuevo cliente...`);
    
    // Preparar datos para crear
    const datosCrear = {
      ...datosCliente,
      Id_Cial: comercialId,
      OK_KO: 1 // Activo por defecto
    };
    
    // Obtener país por defecto (España)
    try {
      const espana = await crm.getPaisByCodigoISO('ES');
      if (espana) {
        datosCrear.Id_Pais = espana.id;
        datosCrear.CodPais = espana.Id_pais;
        datosCrear.Pais = espana.Nombre_pais;
      }
    } catch (error) {
      console.warn(`  ⚠️  No se pudo asignar país por defecto: ${error.message}`);
    }
    
    // Obtener provincia por código postal si es posible
    if (datosCrear.CodigoPostal) {
      try {
        const provincias = await crm.getProvincias();
        // Buscar provincia por código postal (simplificado)
        // En un caso real, usarías una función más sofisticada
      } catch (error) {
        console.warn(`  ⚠️  No se pudo asignar provincia: ${error.message}`);
      }
    }
    
    const nuevoCliente = await crm.createCliente(datosCrear);
    const clienteId = nuevoCliente.id || nuevoCliente.Id || nuevoCliente.insertId;
    console.log(`  ✅ Cliente creado (ID: ${clienteId})`);
    
    return clienteId;
  }
}

/**
 * Busca un artículo por código CN (que corresponde al SKU)
 */
async function buscarArticuloPorCN(cn) {
  if (!cn) return null;
  
  // El código CN del Excel puede tener decimales (216962.3) pero el SKU es entero (216962)
  // Limpiar el código: quitar puntos decimales y espacios
  const cnLimpio = String(cn).replace(/\./g, '').trim();
  
  // Buscar primero con el código exacto, luego sin decimales
  let sql = `SELECT * FROM articulos WHERE SKU = ? OR SKU = ? OR EAN13 = ? LIMIT 1`;
  let resultados = await crm.query(sql, [cn, cnLimpio, cn]);
  
  // Si no se encuentra, intentar buscar por los primeros dígitos (sin el último dígito decimal)
  if (resultados.length === 0 && cn.includes('.')) {
    const cnSinDecimal = cn.split('.')[0];
    sql = `SELECT * FROM articulos WHERE SKU = ? OR SKU LIKE ? LIMIT 1`;
    resultados = await crm.query(sql, [cnSinDecimal, `${cnSinDecimal}%`]);
  }
  
  return resultados.length > 0 ? resultados[0] : null;
}

/**
 * Genera el siguiente número de pedido según el año
 */
async function generarNumeroPedido(fechaPedido) {
  // Extraer año de la fecha (YYYY-MM-DD)
  const año = fechaPedido ? new Date(fechaPedido).getFullYear() : new Date().getFullYear();
  const añoCorto = año.toString().slice(-2); // Últimos 2 dígitos (25, 26, etc.)
  const yearPrefix = `P${añoCorto}`;
  
  // Buscar el último pedido del mismo año
  const sql = `
    SELECT 
      NumPedido,
      CAST(SUBSTRING(NumPedido, 4) AS UNSIGNED) as secuencia
    FROM pedidos 
    WHERE NumPedido LIKE ?
    ORDER BY secuencia DESC
    LIMIT 1
  `;
  
  const rows = await crm.query(sql, [`${yearPrefix}%`]);
  
  let maxSecuencia = 0;
  if (rows.length > 0 && rows[0].secuencia) {
    maxSecuencia = parseInt(rows[0].secuencia, 10) || 0;
  }
  
  // Generar el siguiente número: P25 + 4 dígitos (0001, 0002, etc.)
  const nextSecuencia = (maxSecuencia + 1).toString().padStart(4, '0');
  const nextNumero = `${yearPrefix}${nextSecuencia}`;
  
  console.log(`  📝 Generando número de pedido: Año ${año} (${añoCorto}), Última secuencia: ${maxSecuencia}, Nuevo: ${nextNumero}`);
  
  return nextNumero;
}

/**
 * Crea el pedido y sus líneas
 */
async function crearPedido(datos, clienteId) {
  console.log(`\n📦 Creando pedido`);
  
  // Usar la fecha extraída del número de pedido, o la fecha actual si no se pudo extraer
  const fechaPedido = datos.fechaPedido 
    ? `${datos.fechaPedido} 00:00:00`
    : new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  console.log(`  📅 Fecha del pedido: ${fechaPedido}`);
  
  // Verificar primero si ya existe un pedido similar (mismo cliente, misma fecha, misma serie)
  // Esto previene duplicados incluso si el número de pedido es diferente
  const fechaPedidoDate = fechaPedido.split(' ')[0]; // Solo la fecha sin hora
  const pedidosSimilares = await crm.query(
    `SELECT * FROM pedidos 
     WHERE Id_Cliente = ? 
     AND DATE(FechaPedido) = ? 
     AND Serie = ? 
     LIMIT 1`,
    [clienteId, fechaPedidoDate, datos.mayorista ? `Transfer ${datos.mayorista}` : SERIE_PEDIDO]
  );
  
  if (pedidosSimilares.length > 0) {
    const pedidoExistente = pedidosSimilares[0];
    const pedidoIdExistente = pedidoExistente.id || pedidoExistente.Id;
    console.log(`  ⚠️  Ya existe un pedido similar para este cliente y fecha:`);
    console.log(`     Número: ${pedidoExistente.NumPedido} (ID: ${pedidoIdExistente})`);
    console.log(`     Fecha: ${pedidoExistente.FechaPedido}`);
    console.log(`  🗑️  Eliminando pedido existente para recrearlo...`);
    
    // Eliminar líneas del pedido existente
    await crm.query('DELETE FROM pedidos_articulos WHERE Id_NumPedido = ? OR NumPedido = ?', 
      [pedidoIdExistente, pedidoExistente.NumPedido]);
    console.log(`  ✅ Líneas del pedido eliminadas`);
    
    // Eliminar el pedido
    await crm.query('DELETE FROM pedidos WHERE id = ?', [pedidoIdExistente]);
    console.log(`  ✅ Pedido eliminado`);
  }
  
  // Generar el número de pedido correcto según el año
  const numeroPedido = await generarNumeroPedido(fechaPedido);
  console.log(`  🔢 Número de pedido generado: ${numeroPedido}`);
  
  // Verificar también si el número de pedido específico ya existe (por si acaso)
  const pedidosExistentes = await crm.query(
    'SELECT * FROM pedidos WHERE NumPedido = ? LIMIT 1',
    [numeroPedido]
  );
  
  let pedidoId;
  if (pedidosExistentes.length > 0) {
    console.log(`  ⚠️  El pedido ${numeroPedido} ya existe (ID: ${pedidosExistentes[0].id})`);
    console.log(`  🗑️  Eliminando pedido existente para recrearlo...`);
    
    // Eliminar líneas del pedido existente
    const pedidoIdExistente = pedidosExistentes[0].id || pedidosExistentes[0].Id;
    await crm.query('DELETE FROM pedidos_articulos WHERE Id_NumPedido = ? OR NumPedido = ?', 
      [pedidoIdExistente, numeroPedido]);
    console.log(`  ✅ Líneas del pedido eliminadas`);
    
    // Eliminar el pedido
    await crm.query('DELETE FROM pedidos WHERE id = ?', [pedidoIdExistente]);
    console.log(`  ✅ Pedido eliminado`);
  }
  
  // Determinar la serie según el mayorista
  const seriePedido = datos.mayorista 
    ? `Transfer ${datos.mayorista}`
    : SERIE_PEDIDO;
  
  const pedidoData = {
    NumPedido: numeroPedido,
    FechaPedido: fechaPedido,
    EstadoPedido: 'Pendiente',
    Serie: seriePedido,
    Id_Cial: comercialId,
    Id_Cliente: clienteId,
    Id_FormaPago: formaPagoId,
    Id_TipoPedido: tipoPedidoId,
    BaseImponible: 0,
    TotalIva: 0,
    TotalPedido: 0
  };
  
  console.log(`  📋 Serie del pedido: ${seriePedido}`);
  
  const nuevoPedido = await crm.createPedido(pedidoData);
  pedidoId = nuevoPedido.id || nuevoPedido.Id || nuevoPedido.insertId;
  console.log(`  ✅ Pedido creado (ID: ${pedidoId})`);
  
  // Crear líneas del pedido
  console.log(`\n📋 Creando ${datos.lineas.length} líneas del pedido...`);
  
  let totalBase = 0;
  let totalIva = 0;
  let lineasCreadas = 0;
  let lineasNoEncontradas = 0;
  
  for (const linea of datos.lineas) {
    try {
      // Buscar artículo por CN
      const articulo = await buscarArticuloPorCN(linea.CN);
      
      if (!articulo) {
        console.log(`  ⚠️  Artículo no encontrado para CN: ${linea.CN} - ${linea.Descripcion}`);
        lineasNoEncontradas++;
        continue;
      }
      
      const articuloId = articulo.id || articulo.Id;
      // La tabla Articulos usa PVL (Precio Venta Laboratorio), no PVP
      const pvp = Number(articulo.PVL || articulo.PVP || articulo.Precio || 0);
      const iva = Number(articulo.IVA || 21); // Por defecto 21%
      
      // Convertir descuento: si viene como 0.2, convertirlo a 20%
      let dtoLinea = linea.Dto || 0;
      if (dtoLinea > 0 && dtoLinea < 1) {
        // Si el descuento está entre 0 y 1, asumir que es decimal (0.2 = 20%)
        dtoLinea = dtoLinea * 100;
        console.log(`  ℹ️  Descuento convertido: ${linea.Dto} → ${dtoLinea}%`);
      }
      
      // Calcular subtotal
      const subtotal = pvp * linea.Cantidad;
      const descuento = subtotal * (dtoLinea / 100);
      const baseImponible = subtotal - descuento;
      const ivaImporte = baseImponible * (iva / 100);
      
      totalBase += baseImponible;
      totalIva += ivaImporte;
      
      // Crear línea
      const lineaData = {
        Id_NumPedido: pedidoId,
        Id_Articulo: articuloId,
        NumPedido: numeroPedido, // Usar el número de pedido generado
        Articulo: linea.Descripcion || articulo.Articulo || articulo.Nombre || '',
        Cantidad: linea.Cantidad,
        PVP: pvp,
        DtoLinea: dtoLinea,
        Subtotal: subtotal,
        DtoTotal: dtoLinea,
        IVA: iva
      };
      
      await crm.createPedidoLinea(lineaData);
      lineasCreadas++;
      console.log(`  ✅ Línea creada: ${linea.Cantidad}x ${linea.Descripcion.substring(0, 40)}...`);
      
    } catch (error) {
      console.error(`  ❌ Error creando línea para ${linea.Descripcion}: ${error.message}`);
    }
  }
  
  // Actualizar totales del pedido
  if (lineasCreadas > 0) {
    await crm.updatePedido(pedidoId, {
      BaseImponible: totalBase,
      TotalIva: totalIva,
      TotalPedido: totalBase + totalIva
    });
    console.log(`\n  ✅ Totales actualizados: Base ${totalBase.toFixed(2)}€, IVA ${totalIva.toFixed(2)}€, Total ${(totalBase + totalIva).toFixed(2)}€`);
  }
  
  console.log(`\n  📊 Resumen:`);
  console.log(`     ✅ Líneas creadas: ${lineasCreadas}`);
  if (lineasNoEncontradas > 0) {
    console.log(`     ⚠️  Artículos no encontrados: ${lineasNoEncontradas}`);
  }
  
  return pedidoId;
}

/**
 * Función principal
 */
async function procesarPedido() {
  try {
    console.log('🚀 Iniciando procesamiento de pedido Hefame\n');
    console.log('='.repeat(80));
    
    // Conectar a la base de datos
    await crm.connect();
    
    // Cargar lookups
    await cargarLookups();
    
    // Parsear Excel
    const datos = parsearExcel(EXCEL_FILE);
    
    // Obtener forma de pago según el mayorista detectado
    formaPagoId = await obtenerFormaPagoMayorista(datos.mayorista);
    if (formaPagoId) {
      const formaPago = await crm.query('SELECT FormaPago FROM formas_pago WHERE id = ? LIMIT 1', [formaPagoId]);
      console.log(`  ✅ Forma de pago asignada: ${formaPago[0]?.FormaPago || 'N/A'} (ID: ${formaPagoId})`);
    } else {
      throw new Error('No se pudo determinar la forma de pago');
    }
    
    if (!datos.fechaPedido) {
      throw new Error('No se pudo encontrar la fecha del pedido (ni en el Excel ni en el nombre del archivo)');
    }
    
    if (!datos.cliente.Nombre_Razon_Social) {
      throw new Error('No se pudo encontrar el nombre del cliente en el archivo Excel');
    }
    
    // Gestionar cliente
    const clienteId = await gestionarCliente(datos.cliente);
    
    // Gestionar relación cliente-cooperativa si hay código de mayorista
    if (datos.mayorista && datos.cliente.codigoMayorista) {
      console.log(`\n🔗 Gestionando relación cliente-cooperativa...`);
      const cooperativa = await obtenerCooperativaMayorista(datos.mayorista);
      if (cooperativa) {
        const cooperativaId = cooperativa.id || cooperativa.Id;
        console.log(`  ✅ Cooperativa encontrada: ${cooperativa.Nombre} (ID: ${cooperativaId})`);
        await gestionarRelacionClienteCooperativa(
          clienteId,
          cooperativaId,
          datos.cliente.codigoMayorista
        );
        console.log(`  ✅ Código de asociado: ${datos.cliente.codigoMayorista}`);
      } else {
        console.log(`  ⚠️  No se pudo encontrar o crear la cooperativa para ${datos.mayorista}`);
      }
    }
    
    // Crear pedido y líneas
    const pedidoId = await crearPedido(datos, clienteId);
    
    // Obtener el número de pedido final del pedido creado
    const pedidoFinal = await crm.query('SELECT NumPedido FROM pedidos WHERE id = ? LIMIT 1', [pedidoId]);
    const numeroPedidoFinal = pedidoFinal.length > 0 ? pedidoFinal[0].NumPedido : 'N/A';
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Procesamiento completado exitosamente');
    console.log(`   Cliente ID: ${clienteId}`);
    console.log(`   Pedido ID: ${pedidoId}`);
    console.log(`   Número de pedido: ${numeroPedidoFinal}`);
    console.log(`   Fecha del pedido: ${datos.fechaPedido || 'N/A'}`);
    console.log('='.repeat(80));
    
    await crm.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await crm.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Ejecutar
procesarPedido();
