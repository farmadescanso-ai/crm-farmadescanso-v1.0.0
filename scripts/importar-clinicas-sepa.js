/**
 * Script para importar/complementar clientes desde Excel "Datos Clinicas SEPA.xlsx"
 * Si el cliente ya existe, complementa los datos nuevos
 * Si no existe, crea el cliente correctamente
 */

const XLSX = require('xlsx');
const path = require('path');
const crm = require('../config/mysql-crm');
const puppeteer = require('puppeteer');

const EXCEL_FILE = 'C:\\Users\\pacol\\Downloads\\Datos Clinicas SEPA.xlsx';
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');
const COMERCIAL_DEFAULT = 1; // ID del comercial Paco Lara
const BUSCAR_DATOS_WEB = !process.argv.includes('--sin-web'); // Por defecto buscar datos web
const TIPO_CLIENTE_SEPA = 'CLÍNICA SEPA'; // Nombre del tipo de cliente

// Función para normalizar texto (igual que en server-crm-completo.js)
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto
    .trim()
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Mapeo de nombres alternativos de provincias
 */
const MAPEO_PROVINCIAS_ALTERNATIVOS = {
  'castellon': 'Castellón',
  'castellón': 'Castellón',
  'guipuzkoa': 'Guipúzcoa',
  'guipúzcoa': 'Guipúzcoa',
  'bilbao': 'Vizcaya',
  'vizcaya': 'Vizcaya',
  'barceloma': 'Barcelona', // Error tipográfico común
  'barcelon': 'Barcelona'
};

/**
 * Busca un cliente existente en la BD usando múltiples criterios
 */
function buscarClienteExistente(clienteExcel, clientesDB) {
  const nombreExcel = normalizarTexto(clienteExcel.Nombre_Razon_Social || '');
  const direccionExcel = normalizarTexto(clienteExcel.Direccion || '');
  const telefonoExcel = normalizarTexto(clienteExcel.Telefono || clienteExcel.Movil || '');
  const empresaExcel = normalizarTexto(clienteExcel.Empresa || clienteExcel.Nombre_Comercial || '');
  
  for (const clienteDB of clientesDB) {
    const nombreDB = normalizarTexto(clienteDB.Nombre_Razon_Social || clienteDB.Nombre || '');
    const direccionDB = normalizarTexto(clienteDB.Direccion || clienteDB.direccion || '');
    const telefonoDB = normalizarTexto(clienteDB.Telefono || clienteDB.telefono || clienteDB.Movil || clienteDB.movil || '');
    const empresaDB = normalizarTexto(clienteDB.Nombre_Cial || clienteDB.NombreComercial || clienteDB.nombre_comercial || '');
    
    // Criterio 1: Nombre + Dirección (si ambos están disponibles)
    if (nombreExcel && direccionExcel && nombreExcel.length > 3 && direccionExcel.length > 5) {
      if (nombreDB === nombreExcel && direccionDB === direccionExcel && direccionDB.length > 5) {
        return clienteDB;
      }
    }
    
    // Criterio 2: Nombre + Teléfono (si ambos están disponibles)
    if (nombreExcel && telefonoExcel && nombreExcel.length > 3 && telefonoExcel.length > 5) {
      if (nombreDB === nombreExcel && telefonoDB === telefonoExcel && telefonoDB.length > 5) {
        return clienteDB;
      }
    }
    
    // Criterio 3: Empresa + Dirección (si ambos están disponibles)
    if (empresaExcel && direccionExcel && empresaExcel.length > 3 && direccionExcel.length > 5) {
      if (empresaDB === empresaExcel && direccionDB === direccionExcel && direccionDB.length > 5) {
        return clienteDB;
      }
    }
    
    // Criterio 4: Solo nombre (coincidencia exacta)
    if (nombreExcel && nombreExcel.length > 5) {
      if (nombreDB === nombreExcel && nombreDB.length > 5) {
        return clienteDB;
      }
    }
  }
  
  return null;
}

/**
 * Obtiene el ID de provincia por nombre (usando provincias ya cargadas)
 */
function obtenerIdProvincia(nombreProvincia, provinciasDB) {
  if (!nombreProvincia || !provinciasDB || provinciasDB.length === 0) return null;
  
  const nombreNormalizado = String(nombreProvincia).trim().toLowerCase();
  
  // Intentar con nombre directo
  let provincia = provinciasDB.find(p => {
    const nombreBD = String(p.Nombre || p.nombre || '').trim().toLowerCase();
    return nombreBD === nombreNormalizado;
  });
  
  // Si no se encuentra, intentar con mapeo de nombres alternativos
  if (!provincia && MAPEO_PROVINCIAS_ALTERNATIVOS[nombreNormalizado]) {
    const nombreAlternativo = MAPEO_PROVINCIAS_ALTERNATIVOS[nombreNormalizado];
    provincia = provinciasDB.find(p => {
      const nombreBD = String(p.Nombre || p.nombre || '').trim();
      return nombreBD.toLowerCase() === nombreAlternativo.toLowerCase();
    });
  }
  
  return provincia ? (provincia.Id || provincia.id) : null;
}

/**
 * Busca CIF/DNI en axesor.es (requiere autenticación, puede no funcionar)
 */
async function buscarCIFAxesor(page, nombreEmpresa, poblacion) {
  try {
    if (!nombreEmpresa) return null;
    
    // Axesor requiere búsqueda específica
    const busquedaAxesor = `site:axesor.es "${nombreEmpresa}" ${poblacion || ''} CIF`;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(busquedaAxesor)}`;
    
    await page.goto(googleUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const cif = await page.evaluate(() => {
      const texto = document.body.textContent || '';
      
      // Buscar patrones de CIF/DNI comunes
      const patrones = [
        /\bCIF[:\s]*([A-Z][0-9]{8})\b/i,
        /\bCIF[:\s]*([0-9]{8}[A-Z])\b/i,
        /\bCIF[:\s]*([A-Z]{2}[0-9]{7}[A-Z0-9])\b/i,
        /\b([A-Z][0-9]{8})\b/,
        /\b([A-Z]{2}[0-9]{7}[A-Z0-9])\b/
      ];
      
      for (const patron of patrones) {
        const match = texto.match(patron);
        if (match && match[1]) {
          return match[1];
        }
      }
      
      return null;
    });
    
    return cif;
  } catch (error) {
    return null;
  }
}

/**
 * Busca CIF/DNI, web y email de una clínica usando búsqueda web
 */
async function buscarDatosWeb(page, clienteExcel) {
  const datosEncontrados = {
    DNI_CIF: null,
    Web: null,
    Email: null
  };
  
  if (!BUSCAR_DATOS_WEB || !page) {
    return datosEncontrados;
  }
  
  try {
    const nombre = clienteExcel.Nombre_Razon_Social || '';
    const direccion = clienteExcel.Direccion || '';
    const poblacion = clienteExcel.Poblacion || '';
    
    // Búsqueda 1: Intentar buscar CIF/DNI en axesor.es a través de Google
    if (nombre && poblacion) {
      const cifAxesor = await buscarCIFAxesor(page, nombre, poblacion);
      if (cifAxesor) {
        datosEncontrados.DNI_CIF = cifAxesor;
        console.log(`      ✅ CIF/DNI encontrado en Axesor: ${cifAxesor}`);
      }
    }
    
    // Búsqueda 2: Buscar en Google el nombre + población para encontrar web y email
    if (nombre && poblacion) {
      const busqueda = `${nombre} ${poblacion} clínica dental`;
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(busqueda)}`;
      
      try {
        await page.goto(googleUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const resultados = await page.evaluate(() => {
          const datos = {
            web: null,
            email: null,
            cif: null
          };
          
          // Buscar URLs de sitios web
          const links = Array.from(document.querySelectorAll('a[href^="http"]'));
          for (const link of links) {
            const href = link.getAttribute('href');
            if (href && !href.includes('google.com') && !href.includes('facebook.com') && !href.includes('instagram.com')) {
              const match = href.match(/https?:\/\/(?:www\.)?([^\/]+)/);
              if (match && !datos.web) {
                datos.web = match[1].replace(/^www\./, '');
                break;
              }
            }
          }
          
          // Buscar emails en el texto visible
          const texto = document.body.textContent || '';
          const emailMatch = texto.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/);
          if (emailMatch) {
            datos.email = emailMatch[1].toLowerCase();
          }
          
          // Buscar CIF/DNI en el texto (si no se encontró antes)
          const cifMatch = texto.match(/\b([A-Z][0-9]{8}|[0-9]{8}[A-Z]|[A-Z]{2}[0-9]{7}[A-Z0-9])\b/);
          if (cifMatch) {
            datos.cif = cifMatch[1];
          }
          
          return datos;
        });
        
        if (resultados.web) datosEncontrados.Web = resultados.web;
        if (resultados.email) datosEncontrados.Email = resultados.email;
        if (resultados.cif && !datosEncontrados.DNI_CIF) datosEncontrados.DNI_CIF = resultados.cif;
        
        // Si encontramos web, intentar acceder a ella para buscar más datos
        if (resultados.web && (!datosEncontrados.Email || !datosEncontrados.DNI_CIF)) {
          try {
            const webUrl = `https://${resultados.web}`;
            await page.goto(webUrl, {
              waitUntil: 'networkidle2',
              timeout: 15000
            });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const datosWeb = await page.evaluate(() => {
              const datos = { email: null, cif: null };
              
              const texto = document.body.textContent || '';
              
              // Buscar email
              const emailMatch = texto.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/);
              if (emailMatch) {
                datos.email = emailMatch[1].toLowerCase();
              }
              
              // Buscar CIF/DNI
              const cifMatch = texto.match(/\b([A-Z][0-9]{8}|[0-9]{8}[A-Z]|[A-Z]{2}[0-9]{7}[A-Z0-9])\b/);
              if (cifMatch) {
                datos.cif = cifMatch[1];
              }
              
              return datos;
            });
            
            if (datosWeb.email && !datosEncontrados.Email) datosEncontrados.Email = datosWeb.email;
            if (datosWeb.cif && !datosEncontrados.DNI_CIF) datosEncontrados.DNI_CIF = datosWeb.cif;
          } catch (webError) {
            // Ignorar errores al acceder a la web
          }
        }
      } catch (googleError) {
        // Ignorar errores de búsqueda
        console.log(`      ⚠️  Error en búsqueda web: ${googleError.message}`);
      }
    }
  } catch (error) {
    // Ignorar errores generales
  }
  
  return datosEncontrados;
}

/**
 * Mapea una fila del Excel a un objeto cliente
 */
function mapExcelRowToCliente(row) {
  // Combinar Nombre + Apellidos o usar Empresa como Nombre_Razon_Social
  let nombreRazonSocial = '';
  let nombreCial = null;
  
  if (row.Empresa && String(row.Empresa).trim()) {
    nombreRazonSocial = String(row.Empresa).trim();
    // Si hay Empresa, usar Apellidos, Nombre como Nombre_Cial (Contacto)
    if (row.Nombre && row.Apellidos) {
      nombreCial = `${String(row.Apellidos).trim()}, ${String(row.Nombre).trim()}`.trim();
    } else if (row.Nombre) {
      nombreCial = String(row.Nombre).trim();
    } else if (row.Apellidos) {
      nombreCial = String(row.Apellidos).trim();
    }
  } else if (row.Nombre && row.Apellidos) {
    nombreRazonSocial = `${String(row.Nombre).trim()} ${String(row.Apellidos).trim()}`.trim();
  } else if (row.Nombre) {
    nombreRazonSocial = String(row.Nombre).trim();
  }
  
  if (!nombreRazonSocial) {
    return null; // Sin nombre, saltar
  }
  
  // Convertir código postal a string (puede venir como número)
  let codigoPostal = null;
  if (row['Código Postal']) {
    codigoPostal = String(row['Código Postal']).trim();
  }
  
  // Convertir teléfono a string (puede venir como número)
  let telefono = null;
  if (row.Teléfono) {
    telefono = String(row.Teléfono).trim();
  }
  
  const cliente = {
    Nombre_Razon_Social: nombreRazonSocial,
    DNI_CIF: '', // Se buscará en web
    Nombre_Cial: nombreCial, // Apellidos, Nombre (Contacto)
    Direccion: row.Dirección ? String(row.Dirección).trim() : null,
    Poblacion: row.Población ? String(row.Población).trim() : null,
    CodigoPostal: codigoPostal,
    // Provincia no se incluye (solo Id_Provincia se asigna después)
    Telefono: telefono,
    Movil: null, // No viene en el Excel
    Email: null, // Se buscará en web
    Web: null, // Se buscará en web (si existe el campo)
    Pais: row.País ? String(row.País).trim() : 'España',
    CodPais: 'ES', // Código de país para España
    Id_Cial: COMERCIAL_DEFAULT, // Comercial Paco Lara
    Id_TipoCliente: null, // Se asignará después al tipo CLÍNICA SEPA
    OK_KO: 1, // Activo por defecto
    Modelo_347: 1 // Por defecto
  };
  
  return cliente;
}

/**
 * Actualiza un cliente existente con datos nuevos (solo campos no nulos del Excel)
 */
async function actualizarCliente(clienteId, datosNuevos, clienteExistente) {
  const payload = {};
  
  // Solo actualizar campos que están en datosNuevos y no están en clienteExistente o están vacíos
  if (datosNuevos.Direccion && !clienteExistente.Direccion) {
    payload.Direccion = datosNuevos.Direccion;
  }
  if (datosNuevos.Poblacion && !clienteExistente.Poblacion) {
    payload.Poblacion = datosNuevos.Poblacion;
  }
  if (datosNuevos.CodigoPostal && !clienteExistente.CodigoPostal) {
    payload.CodigoPostal = datosNuevos.CodigoPostal;
  }
  if (datosNuevos.Id_Provincia && !clienteExistente.Id_Provincia) {
    payload.Id_Provincia = datosNuevos.Id_Provincia;
  }
  if (datosNuevos.Telefono && !clienteExistente.Telefono && !clienteExistente.Movil) {
    payload.Telefono = datosNuevos.Telefono;
  }
  if (datosNuevos.Nombre_Cial && !clienteExistente.Nombre_Cial) {
    payload.Nombre_Cial = datosNuevos.Nombre_Cial;
  }
  if (datosNuevos.DNI_CIF && (!clienteExistente.DNI_CIF || clienteExistente.DNI_CIF === '')) {
    payload.DNI_CIF = datosNuevos.DNI_CIF;
  }
  if (datosNuevos.Email && !clienteExistente.Email) {
    payload.Email = datosNuevos.Email;
  }
  if (datosNuevos.Web && !clienteExistente.Web) {
    payload.Web = datosNuevos.Web;
  }
  if (datosNuevos.Id_TipoCliente && !clienteExistente.Id_TipoCliente) {
    payload.Id_TipoCliente = datosNuevos.Id_TipoCliente;
  }
  
  if (Object.keys(payload).length === 0) {
    return false; // No hay nada que actualizar
  }
  
  if (!DRY_RUN) {
    await crm.updateCliente(clienteId, payload);
  }
  
  return true;
}

/**
 * Crea un nuevo cliente
 */
async function crearCliente(datosCliente) {
  if (!DRY_RUN) {
    // Eliminar campos que no existen en la tabla (Provincia, Web si no existe)
    const datosLimpios = { ...datosCliente };
    delete datosLimpios.Provincia; // No existe en la tabla, solo Id_Provincia
    
    // Intentar crear, si Web no existe se ignorará
    await crm.createCliente(datosLimpios);
  }
  return true;
}

/**
 * Crea o obtiene el tipo de cliente "CLÍNICA SEPA"
 */
async function obtenerOcrearTipoClienteSEPA() {
  try {
    // Buscar si ya existe
    const tipos = await crm.query('SELECT id, Tipo FROM tipos_clientes WHERE Tipo = ? OR Tipo = ?', [TIPO_CLIENTE_SEPA, 'CLINICA SEPA']);
    
    if (tipos && tipos.length > 0) {
      const tipoId = tipos[0].id || tipos[0].Id;
      console.log(`✅ Tipo de cliente "${TIPO_CLIENTE_SEPA}" ya existe (ID: ${tipoId})`);
      return tipoId;
    }
    
    // Si no existe, crearlo
    if (!DRY_RUN) {
      const result = await crm.query('INSERT INTO tipos_clientes (Tipo) VALUES (?)', [TIPO_CLIENTE_SEPA]);
      const tipoId = result.insertId || result.insertid;
      console.log(`✅ Tipo de cliente "${TIPO_CLIENTE_SEPA}" creado (ID: ${tipoId})`);
      return tipoId;
    } else {
      console.log(`⚠️  [SIMULACIÓN] Se crearía el tipo de cliente "${TIPO_CLIENTE_SEPA}"`);
      return null; // En simulación retornamos null
    }
  } catch (error) {
    console.error(`❌ Error creando/obteniendo tipo de cliente: ${error.message}`);
    // Si hay error, intentar buscar de nuevo
    try {
      const tipos = await crm.query('SELECT id, Tipo FROM tipos_clientes WHERE Tipo LIKE ?', [`%SEPA%`]);
      if (tipos && tipos.length > 0) {
        const tipoId = tipos[0].id || tipos[0].Id;
        console.log(`⚠️  Usando tipo de cliente existente: ${tipos[0].Tipo} (ID: ${tipoId})`);
        return tipoId;
      }
    } catch (e) {
      // Ignorar
    }
    return null;
  }
}

/**
 * Función principal
 */
async function importarClinicasSEPA() {
  try {
    console.log('🚀 Iniciando importación/complemento de clínicas SEPA desde Excel...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales\n');
    }
    console.log(`📁 Archivo Excel: ${EXCEL_FILE}\n`);
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Crear o obtener tipo de cliente SEPA
    console.log(`📋 Creando/obteniendo tipo de cliente "${TIPO_CLIENTE_SEPA}"...`);
    const tipoClienteSEPAId = await obtenerOcrearTipoClienteSEPA();
    console.log('');
    
    // Leer Excel
    console.log('📖 Leyendo archivo Excel...');
    const workbook = XLSX.readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const datos = XLSX.utils.sheet_to_json(worksheet);
    console.log(`✅ ${datos.length} filas leídas del Excel\n`);
    
    // Cargar clientes existentes
    console.log('🔍 Cargando clientes existentes de la base de datos...');
    const clientesDB = await crm.getClientes();
    console.log(`✅ ${clientesDB.length} clientes encontrados en la base de datos\n`);
    
    // Cargar provincias
    console.log('📍 Cargando provincias...');
    const provincias = await crm.getProvincias();
    console.log(`✅ ${provincias.length} provincias cargadas\n`);
    
    // Iniciar navegador para búsquedas web (si está habilitado)
    let browser = null;
    let page = null;
    if (BUSCAR_DATOS_WEB && !DRY_RUN) {
      console.log('🌐 Iniciando navegador para búsquedas web...');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      console.log('✅ Navegador iniciado\n');
    } else if (BUSCAR_DATOS_WEB && DRY_RUN) {
      console.log('⚠️  Búsqueda web deshabilitada en modo simulación\n');
    }
    
    // Procesar cada fila
    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    let errores = 0;
    const erroresList = [];
    let ejemplosMostrados = 0;
    
    console.log(DRY_RUN ? '🔍 Simulando procesamiento...' : '💾 Procesando clientes...');
    console.log('');
    
    for (let i = 0; i < datos.length; i++) {
      const row = datos[i];
      const numero = i + 1;
      
      try {
        // Mapear fila a cliente
        const clienteExcel = mapExcelRowToCliente(row);
        if (!clienteExcel) {
          console.log(`[${numero}/${datos.length}] ⚠️  Fila sin nombre válido, saltando`);
          continue;
        }
        
        const nombre = clienteExcel.Nombre_Razon_Social;
        
        // Asignar tipo de cliente SEPA
        if (tipoClienteSEPAId) {
          clienteExcel.Id_TipoCliente = tipoClienteSEPAId;
        }
        
        // Obtener Id_Provincia
        if (clienteExcel.Provincia) {
          const idProvincia = obtenerIdProvincia(clienteExcel.Provincia, provincias);
          if (idProvincia) {
            clienteExcel.Id_Provincia = idProvincia;
          } else {
            console.log(`[${numero}/${datos.length}] ⚠️  Provincia "${clienteExcel.Provincia}" no encontrada para ${nombre}`);
          }
        }
        
        // Buscar datos web (CIF/DNI, web, email)
        if (page && !DRY_RUN) {
          console.log(`[${numero}/${datos.length}] 🔍 Buscando datos web para: ${nombre}`);
          const datosWeb = await buscarDatosWeb(page, clienteExcel);
          if (datosWeb.DNI_CIF) {
            clienteExcel.DNI_CIF = datosWeb.DNI_CIF;
            console.log(`      ✅ CIF/DNI encontrado: ${datosWeb.DNI_CIF}`);
          }
          if (datosWeb.Web) {
            clienteExcel.Web = datosWeb.Web;
            console.log(`      ✅ Web encontrada: ${datosWeb.Web}`);
          }
          if (datosWeb.Email) {
            clienteExcel.Email = datosWeb.Email;
            console.log(`      ✅ Email encontrado: ${datosWeb.Email}`);
          }
        }
        
        // Buscar cliente existente
        const clienteExistente = buscarClienteExistente(clienteExcel, clientesDB);
        
        // Mostrar datos completos de los primeros 2 clientes
        if (ejemplosMostrados < 2) {
          console.log('\n' + '='.repeat(80));
          console.log(`📋 CLIENTE ${ejemplosMostrados + 1} - DATOS COMPLETOS`);
          console.log('='.repeat(80));
          console.log('Datos del Excel (fila original):');
          console.log(JSON.stringify(row, null, 2));
          console.log('\nDatos mapeados para la BD:');
          console.log(JSON.stringify(clienteExcel, null, 2));
          if (clienteExistente) {
            console.log('\n⚠️  CLIENTE EXISTENTE ENCONTRADO:');
            console.log(`   ID: ${clienteExistente.Id || clienteExistente.id}`);
            console.log(`   Nombre: ${clienteExistente.Nombre_Razon_Social || clienteExistente.Nombre}`);
            console.log('   Datos existentes:');
            console.log(JSON.stringify({
              Direccion: clienteExistente.Direccion || clienteExistente.direccion,
              Poblacion: clienteExistente.Poblacion || clienteExistente.poblacion,
              CodigoPostal: clienteExistente.CodigoPostal || clienteExistente.Codigo_Postal,
              Id_Provincia: clienteExistente.Id_Provincia || clienteExistente.id_Provincia,
              Telefono: clienteExistente.Telefono || clienteExistente.telefono || clienteExistente.Movil || clienteExistente.movil,
              Email: clienteExistente.Email || clienteExistente.email
            }, null, 2));
          } else {
            console.log('\n✅ NUEVO CLIENTE (no existe en BD)');
          }
          console.log('='.repeat(80) + '\n');
          ejemplosMostrados++;
        }
        
        if (clienteExistente) {
          // Cliente existe, actualizar si hay datos nuevos
          const clienteId = clienteExistente.Id || clienteExistente.id;
          const actualizado = await actualizarCliente(clienteId, clienteExcel, clienteExistente);
          
          if (actualizado) {
            console.log(`[${numero}/${datos.length}] 🔄 Actualizado: ${nombre} (ID: ${clienteId})`);
            actualizados++;
            
            // Actualizar en memoria para próximas búsquedas
            Object.assign(clienteExistente, clienteExcel);
          } else {
            console.log(`[${numero}/${datos.length}] ℹ️  Sin cambios: ${nombre} (ID: ${clienteId})`);
            sinCambios++;
          }
        } else {
          // Cliente no existe, crear nuevo
          if (DRY_RUN) {
            console.log(`[${numero}/${datos.length}] 🆕 [SIMULACIÓN] Crear nuevo: ${nombre}`);
          } else {
            await crearCliente(clienteExcel);
            console.log(`[${numero}/${datos.length}] 🆕 Creado: ${nombre}`);
          }
          creados++;
        }
        
        // Pequeña pausa para no sobrecargar
        if (!DRY_RUN && (i + 1) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        errores++;
        const errorMsg = `Error en fila ${numero}: ${error.message}`;
        erroresList.push(errorMsg);
        console.error(`[${numero}/${datos.length}] ❌ ${errorMsg}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Procesamiento completado');
    console.log('='.repeat(80));
    console.log(`📊 Resumen:`);
    console.log(`   🆕 Clientes creados: ${creados}`);
    console.log(`   🔄 Clientes actualizados: ${actualizados}`);
    console.log(`   ℹ️  Sin cambios: ${sinCambios}`);
    console.log(`   ❌ Errores: ${errores}`);
    
    if (erroresList.length > 0) {
      console.log('\n❌ Lista de errores:');
      erroresList.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
    }
    
    if (DRY_RUN) {
      console.log('\n⚠️  MODO SIMULACIÓN: No se realizaron cambios reales');
      console.log('💡 Ejecuta sin --dry-run para aplicar los cambios');
    }
    
    // Cerrar navegador
    if (browser) {
      console.log('\n🔒 Cerrando navegador...');
      await browser.close();
      console.log('✅ Navegador cerrado');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignorar errores al cerrar
      }
    }
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  importarClinicasSEPA();
}

module.exports = { importarClinicasSEPA };
