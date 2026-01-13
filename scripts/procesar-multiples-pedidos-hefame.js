/**
 * Script para procesar múltiples pedidos tipo Transfer Hefame desde Excel
 * Reutiliza la lógica del script procesar-pedido-hefame.js
 */

const XLSX = require('xlsx');
const path = require('path');
const readline = require('readline');
const crm = require('../config/mysql-crm');

// Lista de archivos Excel a procesar
const ARCHIVOS_EXCEL = [
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250923 Transfer Farmacia Ana de Bejar.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250918 Transfer Compartido JORDAN BUESO, J. JOAQUIN.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250917  Transfer Directo Ruiz Martinez, José Javier.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250912  Transfer Directo Ruiz Martinez, José Javier.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250910 Transfer Directo Cristina Bernal 1385.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250716 Transfer Directo Ruiz Martinez, José Javier.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250707 Transfer Directo Farmacia Soto Fernández Elena..xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250625 Transfer Directo Ruiz Martinez, José Javier.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250528 Transfer Directo GÓMEZ ABELLÁN, JESÚS JOAQUÍN.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250528 Transfer Farmacia Ana de Bejar.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250520 Transfer Directo Ruiz Martinez, José Javier.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250507 Transfer Directo PARAFARMACIA CONSUL SL.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250423 Transfer Directo Ruiz Martinez, José Javier.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250331 Transfer Directo Cristina Bernal 1385.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250325 Transfer Directo Juan Pablo Conejero.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250324 Transfer Directo Rosa María Quilis Arocas.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250314 Transfer Directo Ruiz Martinez, José Javier.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250314 Transfer Directo Cayetana Campillo (Retirada y Entrega).xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250312 Transfer Directo Cayetana Campillo.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250310 Transfer Directo SOTO FERNANDEZ, JUAN ANGEL.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250304 Transfer Directo Carlos Briones.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250206 Transfer Teresa Bueno - El Esparragal.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250123 Transfer Directo GÓMEZ ABELLÁN, JESÚS JOAQUÍN.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250121 Transfer Directo GÓMEZ ABELLÁN, JESÚS JOAQUÍN.xlsx",
  "C:\\Users\\pacol\\iCloudDrive\\01 FARMADESCANSO SL\\02 PEDIDOS\\05 HEFAME\\20250120 Transfer Directo Cayetana Campillo Ruiz.xlsx"
];

const COMERCIAL_NOMBRE = 'Cristina Rico';
const SERIE_PEDIDO = 'Transfer';
const TIPO_PEDIDO_NOMBRE = 'Transfer';

// Mayoristas y sus formas de pago
const MAYORISTAS = {
  'hefame': 'Hefame',
  'cofares': 'Cofares',
  'alliance': 'Alliance'
};

// Cache para lookups (se cargan una vez al inicio)
let comercialId = null;
let tipoPedidoId = null;
let formaPagoId = null;

// Importar funciones del script original copiándolas aquí
// (Para simplificar, voy a usar el mismo código pero adaptado para múltiples archivos)

/**
 * Carga los datos de lookup necesarios (solo una vez)
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
  const nombre = path.basename(nombreArchivo, path.extname(nombreArchivo));
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
      codigoMayorista: null
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
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (cell && typeof cell === 'number' && cell > 0) {
          const numPedidoStr = String(cell);
          datos.numPedido = numPedidoStr;
          
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
          datos.cliente.codigoMayorista = codigoHefame;
        } else if (campo.includes('dni') || campo.includes('cif')) {
          datos.cliente.DNI_CIF = String(valor || '').trim();
        } else if (campo.includes('teléfono') || campo.includes('telefono')) {
          datos.cliente.Telefono = String(valor || '').trim();
          datos.cliente.Movil = String(valor || '').trim();
        } else if (campo.includes('email')) {
          datos.cliente.Email = String(valor || '').trim();
        } else if (campo.includes('código postal') || campo.includes('codigo postal')) {
          // Extraer solo el código postal numérico (primeros 5 dígitos)
          const codigoPostalRaw = String(valor || '').trim();
          // Buscar el primer grupo de 5 dígitos consecutivos
          const match = codigoPostalRaw.match(/\b(\d{5})\b/);
          if (match) {
            datos.cliente.CodigoPostal = match[1];
          } else {
            // Si no hay 5 dígitos, tomar los primeros 5 caracteres numéricos
            const numeros = codigoPostalRaw.replace(/\D/g, '').substring(0, 5);
            if (numeros.length >= 5) {
              datos.cliente.CodigoPostal = numeros;
            } else {
              datos.cliente.CodigoPostal = codigoPostalRaw.substring(0, 10); // Limitar a 10 caracteres máximo
            }
          }
        } else if (campo.includes('población') || campo.includes('poblacion')) {
          datos.cliente.Poblacion = String(valor || '').trim();
        }
      }
      
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
      
      const cantidad = idxCantidad >= 0 ? row[idxCantidad] : null;
      const cantidadNum = cantidad ? Number(cantidad) : 0;
      
      if (cantidadNum > 0) {
        const linea = {
          Cantidad: cantidadNum,
          CN: idxCN >= 0 ? String(row[idxCN] || '').trim() : '',
          Descripcion: idxDescripcion >= 0 ? String(row[idxDescripcion] || '').trim() : '',
          Dto: idxDto >= 0 ? (row[idxDto] ? Number(row[idxDto]) : 0) : 0
        };
        
        datos.lineas.push(linea);
      }
      
      if (rowStr.includes('*') || (row.every(cell => !cell || cell === ''))) {
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
 * Calcula la similitud entre dos cadenas
 */
function calcularSimilitud(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  let coincidencias = 0;
  const minLen = Math.min(s1.length, s2.length);
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) coincidencias++;
  }
  
  if (s1.includes(s2) || s2.includes(s1)) {
    coincidencias += Math.max(s1.length, s2.length);
  }
  
  return coincidencias;
}

/**
 * Busca un cliente por DNI_CIF, Email o nombre similar
 */
async function buscarCliente(datosCliente) {
  if (datosCliente.DNI_CIF) {
    const sql = `SELECT * FROM clientes WHERE DNI_CIF = ? LIMIT 1`;
    const resultados = await crm.query(sql, [datosCliente.DNI_CIF]);
    if (resultados.length > 0) {
      return resultados[0];
    }
  }
  
  if (datosCliente.Email) {
    const sql = `SELECT * FROM clientes WHERE Email = ? LIMIT 1`;
    const resultados = await crm.query(sql, [datosCliente.Email]);
    if (resultados.length > 0) {
      return resultados[0];
    }
  }
  
  if (datosCliente.Nombre_Razon_Social) {
    const nombreBusqueda = datosCliente.Nombre_Razon_Social.trim();
    const palabras = nombreBusqueda.split(/\s+/).filter(p => p.length > 3);
    
    let sql = `SELECT * FROM clientes WHERE Nombre_Razon_Social LIKE ? LIMIT 20`;
    let resultados = await crm.query(sql, [`%${nombreBusqueda}%`]);
    
    if (resultados.length === 0 && palabras.length > 0) {
      const condiciones = palabras.map(() => 'Nombre_Razon_Social LIKE ?').join(' OR ');
      const valores = palabras.map(p => `%${p}%`);
      sql = `SELECT * FROM clientes WHERE ${condiciones} LIMIT 20`;
      resultados = await crm.query(sql, valores);
    }
    
    if (resultados.length > 0) {
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
 * En modo batch, siempre crea el cliente automáticamente
 */
function mostrarDatosYConfirmar(datosCliente) {
  // En modo batch (procesamiento múltiple), crear automáticamente
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
  console.log('✅ Creando cliente automáticamente (modo batch)...');
  
  return Promise.resolve(true); // Siempre crear en modo batch
}

/**
 * Busca o crea la cooperativa según el mayorista
 */
async function obtenerCooperativaMayorista(mayorista) {
  if (!mayorista) return null;
  
  const mapeoMayoristas = {
    'Hefame': 'HEFAME',
    'Cofares': 'COFARES',
    'Alliance': 'Alliance Healthcare España'
  };
  
  const nombreCooperativa = mapeoMayoristas[mayorista] || mayorista.toUpperCase();
  
  const cooperativas = await crm.query(
    'SELECT * FROM cooperativas WHERE Nombre = ? OR Nombre LIKE ? LIMIT 1',
    [nombreCooperativa, `%${nombreCooperativa}%`]
  );
  
  if (cooperativas.length > 0) {
    return cooperativas[0];
  }
  
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
  
  const relacionesExistentes = await crm.query(
    'SELECT * FROM clientes_cooperativas WHERE Id_Cliente = ? AND Id_Cooperativa = ? LIMIT 1',
    [clienteId, cooperativaId]
  );
  
  if (relacionesExistentes.length > 0) {
    const relacionId = relacionesExistentes[0].id || relacionesExistentes[0].Id;
    await crm.query(
      'UPDATE clientes_cooperativas SET NumAsociado = ? WHERE id = ?',
      [codigoAsociado, relacionId]
    );
    console.log(`  🔄 Relación cliente-cooperativa actualizada (ID: ${relacionId})`);
  } else {
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
  
  const clienteExistente = await buscarCliente(datosCliente);
  
  if (clienteExistente) {
    console.log(`  ✅ Cliente encontrado (ID: ${clienteExistente.id || clienteExistente.Id})`);
    console.log(`     Nombre en BD: ${clienteExistente.Nombre_Razon_Social || 'N/A'}`);
    console.log(`     DNI/CIF en BD: ${clienteExistente.DNI_CIF || 'N/A'}`);
    
    const datosActualizar = {
      Id_Cial: comercialId
    };
    
    Object.keys(datosCliente).forEach(key => {
      if (key === 'codigoMayorista') return;
      
      if (datosCliente[key] && datosCliente[key] !== '') {
        // Limitar la longitud del código postal a 10 caracteres y validar formato
        if (key === 'CodigoPostal') {
          const codigoPostal = String(datosCliente[key]).trim();
          // Si tiene más de 10 caracteres, intentar extraer solo el código numérico
          if (codigoPostal.length > 10) {
            const match = codigoPostal.match(/\b(\d{5})\b/);
            if (match) {
              datosActualizar[key] = match[1];
            } else {
              // Si no hay 5 dígitos, tomar los primeros 10 caracteres
              datosActualizar[key] = codigoPostal.substring(0, 10);
            }
          } else {
            const valorActual = clienteExistente[key];
            if (valorActual !== codigoPostal) {
              datosActualizar[key] = codigoPostal;
            }
          }
        } else {
          const valorActual = clienteExistente[key];
          if (valorActual !== datosCliente[key]) {
            datosActualizar[key] = datosCliente[key];
          }
        }
      }
    });
    
    if (Object.keys(datosActualizar).length > 1) {
      console.log(`  🔄 Actualizando cliente con campos: ${Object.keys(datosActualizar).join(', ')}`);
      try {
        await crm.updateCliente(clienteExistente.id || clienteExistente.Id, datosActualizar);
        console.log(`  ✅ Cliente actualizado`);
      } catch (error) {
        // Si falla la actualización, intentar sin el campo problemático
        if (error.message.includes('CodigoPostal') || error.message.includes('código postal')) {
          console.log(`  ⚠️  Error actualizando código postal, intentando sin ese campo...`);
          delete datosActualizar.CodigoPostal;
          if (Object.keys(datosActualizar).length > 1) {
            try {
              await crm.updateCliente(clienteExistente.id || clienteExistente.Id, datosActualizar);
              console.log(`  ✅ Cliente actualizado (sin código postal)`);
            } catch (error2) {
              console.log(`  ⚠️  Error actualizando cliente: ${error2.message}`);
            }
          }
        } else {
          console.log(`  ⚠️  Error actualizando cliente: ${error.message}`);
        }
      }
    } else {
      console.log(`  ℹ️  No hay cambios necesarios`);
    }
    
    return clienteExistente.id || clienteExistente.Id;
  } else {
    console.log(`  ⚠️  Cliente no encontrado`);
    
    const confirmar = await mostrarDatosYConfirmar(datosCliente);
    
    if (!confirmar) {
      throw new Error('Proceso cancelado por el usuario');
    }
    
    console.log(`  🆕 Creando nuevo cliente...`);
    
    const datosCrear = {
      ...datosCliente,
      Id_Cial: comercialId,
      OK_KO: 1
    };
    
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
    
    const nuevoCliente = await crm.createCliente(datosCrear);
    const clienteId = nuevoCliente.id || nuevoCliente.Id || nuevoCliente.insertId;
    console.log(`  ✅ Cliente creado (ID: ${clienteId})`);
    
    return clienteId;
  }
}

/**
 * Busca un artículo por código CN
 */
async function buscarArticuloPorCN(cn) {
  if (!cn) return null;
  
  const cnLimpio = String(cn).replace(/\./g, '').trim();
  
  let sql = `SELECT * FROM articulos WHERE SKU = ? OR SKU = ? OR EAN13 = ? LIMIT 1`;
  let resultados = await crm.query(sql, [cn, cnLimpio, cn]);
  
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
  const año = fechaPedido ? new Date(fechaPedido).getFullYear() : new Date().getFullYear();
  const añoCorto = año.toString().slice(-2);
  const yearPrefix = `P${añoCorto}`;
  
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
  
  const fechaPedido = datos.fechaPedido 
    ? `${datos.fechaPedido} 00:00:00`
    : new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  console.log(`  📅 Fecha del pedido: ${fechaPedido}`);
  
  // Verificar primero si ya existe un pedido similar (mismo cliente, misma fecha, misma serie)
  const fechaPedidoDate = fechaPedido.split(' ')[0];
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
    
    await crm.query('DELETE FROM pedidos_articulos WHERE Id_NumPedido = ? OR NumPedido = ?', 
      [pedidoIdExistente, pedidoExistente.NumPedido]);
    console.log(`  ✅ Líneas del pedido eliminadas`);
    
    await crm.query('DELETE FROM pedidos WHERE id = ?', [pedidoIdExistente]);
    console.log(`  ✅ Pedido eliminado`);
  }
  
  const numeroPedido = await generarNumeroPedido(fechaPedido);
  console.log(`  🔢 Número de pedido generado: ${numeroPedido}`);
  
  const pedidosExistentes = await crm.query(
    'SELECT * FROM pedidos WHERE NumPedido = ? LIMIT 1',
    [numeroPedido]
  );
  
  let pedidoId;
  if (pedidosExistentes.length > 0) {
    console.log(`  ⚠️  El pedido ${numeroPedido} ya existe (ID: ${pedidosExistentes[0].id})`);
    console.log(`  🗑️  Eliminando pedido existente para recrearlo...`);
    
    const pedidoIdExistente = pedidosExistentes[0].id || pedidosExistentes[0].Id;
    await crm.query('DELETE FROM pedidos_articulos WHERE Id_NumPedido = ? OR NumPedido = ?', 
      [pedidoIdExistente, numeroPedido]);
    console.log(`  ✅ Líneas del pedido eliminadas`);
    
    await crm.query('DELETE FROM pedidos WHERE id = ?', [pedidoIdExistente]);
    console.log(`  ✅ Pedido eliminado`);
  }
  
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
      const articulo = await buscarArticuloPorCN(linea.CN);
      
      if (!articulo) {
        console.log(`  ⚠️  Artículo no encontrado para CN: ${linea.CN} - ${linea.Descripcion}`);
        lineasNoEncontradas++;
        continue;
      }
      
      const articuloId = articulo.id || articulo.Id;
      const pvp = Number(articulo.PVL || articulo.PVP || articulo.Precio || 0);
      const iva = Number(articulo.IVA || 21);
      
      let dtoLinea = linea.Dto || 0;
      if (dtoLinea > 0 && dtoLinea < 1) {
        dtoLinea = dtoLinea * 100;
        console.log(`  ℹ️  Descuento convertido: ${linea.Dto} → ${dtoLinea}%`);
      }
      
      const subtotal = pvp * linea.Cantidad;
      const descuento = subtotal * (dtoLinea / 100);
      const baseImponible = subtotal - descuento;
      const ivaImporte = baseImponible * (iva / 100);
      
      totalBase += baseImponible;
      totalIva += ivaImporte;
      
      const lineaData = {
        Id_NumPedido: pedidoId,
        Id_Articulo: articuloId,
        NumPedido: numeroPedido,
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
 * Procesa un archivo Excel individual
 */
async function procesarArchivo(archivoExcel) {
  try {
    // Continuar aunque haya errores en la actualización del cliente
    // Parsear Excel
    const datos = parsearExcel(archivoExcel);
    
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
    
    // Gestionar cliente (continuar aunque haya errores menores)
    let clienteId;
    try {
      clienteId = await gestionarCliente(datos.cliente);
    } catch (error) {
      // Si falla la gestión del cliente, intentar buscar solo por DNI/CIF para obtener el ID
      if (datos.cliente.DNI_CIF) {
        try {
          const cliente = await buscarCliente(datos.cliente);
          if (cliente) {
            clienteId = cliente.id || cliente.Id;
            console.log(`  ⚠️  Usando cliente existente sin actualizar (ID: ${clienteId})`);
          } else {
            throw new Error(`No se pudo gestionar el cliente: ${error.message}`);
          }
        } catch (error2) {
          throw new Error(`No se pudo gestionar el cliente: ${error.message}`);
        }
      } else {
        throw new Error(`No se pudo gestionar el cliente: ${error.message}`);
      }
    }
    
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
    
    return { exito: true, pedidoId, numeroPedido: numeroPedidoFinal };
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return { exito: false, error: error.message };
  }
}

/**
 * Función principal
 */
async function procesarTodos() {
  try {
    console.log('🚀 Iniciando procesamiento de múltiples pedidos Hefame\n');
    console.log(`📋 Total de archivos a procesar: ${ARCHIVOS_EXCEL.length}\n`);
    
    // Conectar a la base de datos una sola vez
    await crm.connect();
    
    // Cargar lookups una sola vez
    await cargarLookups();
    
    const resultados = [];
    const inicioTotal = Date.now();
    
    for (let i = 0; i < ARCHIVOS_EXCEL.length; i++) {
      const archivo = ARCHIVOS_EXCEL[i];
      const nombreArchivo = path.basename(archivo);
      
      console.log('\n' + '='.repeat(80));
      console.log(`[${i + 1}/${ARCHIVOS_EXCEL.length}] 📄 Procesando: ${nombreArchivo}`);
      console.log('='.repeat(80));
      
      const resultado = await procesarArchivo(archivo);
      resultados.push({
        ...resultado,
        archivo: archivo,
        nombre: nombreArchivo
      });
      
      // Pequeña pausa entre archivos
      if (i < ARCHIVOS_EXCEL.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const tiempoTotal = Date.now() - inicioTotal;
    
    // Desconectar de la base de datos
    await crm.disconnect();
    
    // Resumen final
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(80));
    
    const exitosos = resultados.filter(r => r.exito).length;
    const fallidos = resultados.filter(r => !r.exito).length;
    
    console.log(`✅ Procesados exitosamente: ${exitosos}`);
    console.log(`❌ Fallidos: ${fallidos}`);
    console.log(`📋 Total: ${resultados.length}`);
    console.log(`⏱️  Tiempo total: ${(tiempoTotal / 1000).toFixed(2)} segundos`);
    
    if (exitosos > 0) {
      console.log('\n✅ Pedidos creados exitosamente:');
      resultados.filter(r => r.exito).forEach(r => {
        console.log(`   - ${r.nombre}: Pedido ${r.numeroPedido} (ID: ${r.pedidoId})`);
      });
    }
    
    if (fallidos > 0) {
      console.log('\n⚠️  Archivos con errores:');
      resultados.filter(r => !r.exito).forEach(r => {
        console.log(`   - ${r.nombre}: ${r.error}`);
      });
    }
    
    console.log('\n✅ Proceso completado');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error general:', error.message);
    console.error(error.stack);
    await crm.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Ejecutar
procesarTodos();
