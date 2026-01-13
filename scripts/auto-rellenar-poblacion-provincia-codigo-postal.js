/**
 * Script para auto-rellenar campos: Población, Provincia (Id_Provincia), Código Postal
 * en la tabla Clientes basándose en la información disponible.
 * 
 * Lógica:
 * 1. Si tiene Código Postal -> obtener Provincia (y opcionalmente Población)
 * 2. Si tiene Población -> buscar Provincia y Código Postal
 * 3. Si tiene Provincia -> buscar Población y Código Postal (si es posible)
 * 
 * Uso: node scripts/auto-rellenar-poblacion-provincia-codigo-postal.js [--dry-run]
 */

const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');

// Mapeo de direcciones/barrios a códigos postales específicos
// Para ciudades grandes donde el CP depende de la dirección
const MAPEO_DIRECCION_CP = {
  // Murcia - Barrios y zonas
  'murcia': {
    'centro': '30001',
    'san andres': '30001',
    'san antonio': '30002',
    'san miguel': '30003',
    'san juan': '30004',
    'san pedro': '30005',
    'santa catalina': '30006',
    'santa eulalia': '30007',
    'santiago el mayor': '30008',
    'santo domingo': '30009',
    'vistalegre': '30010',
    'vistabella': '30011',
    'el carmen': '30001',
    'la merced': '30001',
    'plaza de las flores': '30001',
    'gran via': '30001',
    'traperia': '30001',
    'plateria': '30001',
    'santa clara': '30001',
    'barrio del carmen': '30001',
    'barrio de san antonio': '30002',
    'barrio de san miguel': '30003',
    'barrio de san juan': '30004',
    'barrio de san pedro': '30005',
    'barrio de santa catalina': '30006',
    'barrio de santa eulalia': '30007',
    'barrio de santiago': '30008',
    'barrio de santo domingo': '30009',
    'barrio de vistalegre': '30010',
    'barrio de vistabella': '30011',
    'espinardo': '30012',
    'barrio de espinardo': '30012',
    'el palmar': '30013',
    'barrio del palmar': '30013',
    'sangonera': '30014',
    'barrio de sangonera': '30014',
    'algezares': '30015',
    'barrio de algezares': '30015',
    'beniajan': '30016',
    'barrio de beniajan': '30016',
    'torreagüera': '30017',
    'barrio de torreagüera': '30017',
    'sucina': '30018',
    'barrio de sucina': '30018',
    'nonduermas': '30019',
    'barrio de nonduermas': '30019',
    'puente tocinos': '30020',
    'barrio de puente tocinos': '30020',
    'santa cruz': '30001',
    'barrio de santa cruz': '30001',
    'santiago y zaraiche': '30001',
    'barrio de santiago y zaraiche': '30001',
    'sangonera la verde': '30014',
    'sangonera la seca': '30014',
    'puebla de soto': '30020',
    'barrio de puebla de soto': '30020'
  },
  // Madrid - Zonas principales
  'madrid': {
    'centro': '28001',
    'sol': '28013',
    'gran via': '28013',
    'malasaña': '28004',
    'chueca': '28004',
    'salamanca': '28001',
    'barrio de salamanca': '28001',
    'chamberi': '28010',
    'barrio de chamberi': '28010',
    'retiro': '28009',
    'barrio de retiro': '28009',
    'argüelles': '28008',
    'barrio de argüelles': '28008',
    'moncloa': '28008',
    'barrio de moncloa': '28008',
    'tetuan': '28020',
    'barrio de tetuan': '28020',
    'chamartin': '28036',
    'barrio de chamartin': '28036',
    'vallecas': '28018',
    'barrio de vallecas': '28018',
    'carabanchel': '28025',
    'barrio de carabanchel': '28025',
    'usera': '28026',
    'barrio de usera': '28026',
    'villaverde': '28021',
    'barrio de villaverde': '28021',
    'vicalvaro': '28032',
    'barrio de vicalvaro': '28032',
    'san blas': '28037',
    'barrio de san blas': '28037',
    'hortaleza': '28043',
    'barrio de hortaleza': '28043',
    'fuencarral': '28049',
    'barrio de fuencarral': '28049'
  },
  // Barcelona - Zonas principales
  'barcelona': {
    'ciutat vella': '08001',
    'barrio gótico': '08002',
    'el raval': '08001',
    'el born': '08003',
    'barceloneta': '08003',
    'eixample': '08008',
    'gracia': '08012',
    'barrio de gracia': '08012',
    'sants': '08014',
    'barrio de sants': '08014',
    'les corts': '08028',
    'barrio de les corts': '08028',
    'sarria': '08017',
    'barrio de sarria': '08017',
    'sant gervasi': '08021',
    'barrio de sant gervasi': '08021',
    'horta': '08024',
    'barrio de horta': '08024',
    'nou barris': '08042',
    'barrio de nou barris': '08042',
    'sant andreu': '08030',
    'barrio de sant andreu': '08030',
    'sant marti': '08025',
    'barrio de sant marti': '08025'
  },
  // Valencia - Zonas principales
  'valencia': {
    'ciutat vella': '46001',
    'barrio del carmen': '46003',
    'barrio de ruzafa': '46006',
    'barrio de el cabanyal': '46011',
    'barrio de benimaclet': '46020',
    'barrio de patraix': '46015',
    'barrio de campanar': '46015',
    'barrio de benicalap': '46025',
    'barrio de la saidia': '46009',
    'barrio de extramurs': '46008',
    'barrio de l\'eixample': '46010',
    'barrio de jesus': '46007',
    'barrio de quatre carreres': '46023',
    'barrio de pobles del nord': '46020',
    'barrio de pobles del sud': '46026',
    'barrio de pobles de l\'oest': '46015'
  },
  // Sevilla - Zonas principales
  'sevilla': {
    'casco antiguo': '41001',
    'barrio de santa cruz': '41004',
    'barrio de triana': '41010',
    'barrio de los remedios': '41011',
    'barrio de macarena': '41009',
    'barrio de nervion': '41005',
    'barrio de san pablo': '41001',
    'barrio de el arenal': '41001',
    'barrio de alfalfa': '41004',
    'barrio de museos': '41001',
    'barrio de san lorenzo': '41002',
    'barrio de san vicente': '41003',
    'barrio de san bernardo': '41008',
    'barrio de pino montano': '41015',
    'barrio de torreblanca': '41020',
    'barrio de amate': '41013',
    'barrio de bellavista': '41014',
    'barrio de los pajaritos': '41014',
    'barrio de poligono sur': '41013'
  }
};

// Base de datos de correspondencias Población -> Provincia -> Código Postal
// Se puede expandir con más datos según sea necesario
const MAPEO_POBLACION_PROVINCIA_CP = {
  // Murcia
  'Yecla': { provincia: 'Murcia', codigoPostal: '30510', provinciaId: 30 },
  'Murcia': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Cartagena': { provincia: 'Murcia', codigoPostal: '30201', provinciaId: 30 },
  'Lorca': { provincia: 'Murcia', codigoPostal: '30800', provinciaId: 30 },
  'Molina de Segura': { provincia: 'Murcia', codigoPostal: '30500', provinciaId: 30 },
  'Alcantarilla': { provincia: 'Murcia', codigoPostal: '30820', provinciaId: 30 },
  'Cieza': { provincia: 'Murcia', codigoPostal: '30530', provinciaId: 30 },
  'Jumilla': { provincia: 'Murcia', codigoPostal: '30520', provinciaId: 30 },
  'Torre-Pacheco': { provincia: 'Murcia', codigoPostal: '30700', provinciaId: 30 },
  'San Javier': { provincia: 'Murcia', codigoPostal: '30730', provinciaId: 30 },
  'Águilas': { provincia: 'Murcia', codigoPostal: '30880', provinciaId: 30 },
  'Mazarrón': { provincia: 'Murcia', codigoPostal: '30870', provinciaId: 30 },
  
  // Jaén
  'Jaén': { provincia: 'Jaén', codigoPostal: '23001', provinciaId: 23 },
  'Linares': { provincia: 'Jaén', codigoPostal: '23700', provinciaId: 23 },
  'Úbeda': { provincia: 'Jaén', codigoPostal: '23400', provinciaId: 23 },
  'Andújar': { provincia: 'Jaén', codigoPostal: '23740', provinciaId: 23 },
  'Martos': { provincia: 'Jaén', codigoPostal: '23600', provinciaId: 23 },
  'Baeza': { provincia: 'Jaén', codigoPostal: '23440', provinciaId: 23 },
  'Alcalá la Real': { provincia: 'Jaén', codigoPostal: '23680', provinciaId: 23 },
  'Villacarrillo': { provincia: 'Jaén', codigoPostal: '23300', provinciaId: 23 },
  
  // Madrid
  'Madrid': { provincia: 'Madrid', codigoPostal: '28001', provinciaId: 28 },
  'Móstoles': { provincia: 'Madrid', codigoPostal: '28930', provinciaId: 28 },
  'Alcalá de Henares': { provincia: 'Madrid', codigoPostal: '28801', provinciaId: 28 },
  'Getafe': { provincia: 'Madrid', codigoPostal: '28901', provinciaId: 28 },
  'Leganés': { provincia: 'Madrid', codigoPostal: '28910', provinciaId: 28 },
  
  // Barcelona
  'Barcelona': { provincia: 'Barcelona', codigoPostal: '08001', provinciaId: 8 },
  'Badalona': { provincia: 'Barcelona', codigoPostal: '08910', provinciaId: 8 },
  'Sabadell': { provincia: 'Barcelona', codigoPostal: '08201', provinciaId: 8 },
  'Terrassa': { provincia: 'Barcelona', codigoPostal: '08221', provinciaId: 8 },
  
  // Valencia
  'Valencia': { provincia: 'Valencia', codigoPostal: '46001', provinciaId: 46 },
  'Alicante': { provincia: 'Alicante', codigoPostal: '03001', provinciaId: 3 },
  'Elche': { provincia: 'Alicante', codigoPostal: '03201', provinciaId: 3 },
  'Castellón de la Plana': { provincia: 'Castellón', codigoPostal: '12001', provinciaId: 12 },
  
  // Sevilla
  'Sevilla': { provincia: 'Sevilla', codigoPostal: '41001', provinciaId: 41 },
  'Córdoba': { provincia: 'Córdoba', codigoPostal: '14001', provinciaId: 14 },
  'Málaga': { provincia: 'Málaga', codigoPostal: '29001', provinciaId: 29 },
  'Granada': { provincia: 'Granada', codigoPostal: '18001', provinciaId: 18 },
  
  // Otras provincias importantes
  'Zaragoza': { provincia: 'Zaragoza', codigoPostal: '50001', provinciaId: 50 },
  'Bilbao': { provincia: 'Vizcaya', codigoPostal: '48001', provinciaId: 48 },
  'Vitoria': { provincia: 'Álava', codigoPostal: '01001', provinciaId: 1 },
  'San Sebastián': { provincia: 'Guipúzcoa', codigoPostal: '20001', provinciaId: 20 },
  'Oviedo': { provincia: 'Asturias', codigoPostal: '33001', provinciaId: 33 },
  'Santander': { provincia: 'Cantabria', codigoPostal: '39001', provinciaId: 39 },
  'Valladolid': { provincia: 'Valladolid', codigoPostal: '47001', provinciaId: 47 },
  'Salamanca': { provincia: 'Salamanca', codigoPostal: '37001', provinciaId: 37 },
  'León': { provincia: 'León', codigoPostal: '24001', provinciaId: 24 },
  'Palencia': { provincia: 'Palencia', codigoPostal: '34001', provinciaId: 34 },
  'Burgos': { provincia: 'Burgos', codigoPostal: '09001', provinciaId: 9 },
  'Soria': { provincia: 'Soria', codigoPostal: '42001', provinciaId: 42 },
  'Logroño': { provincia: 'La Rioja', codigoPostal: '26001', provinciaId: 26 },
  'Pamplona': { provincia: 'Navarra', codigoPostal: '31001', provinciaId: 31 },
  'Vigo': { provincia: 'Pontevedra', codigoPostal: '36201', provinciaId: 36 },
  'A Coruña': { provincia: 'La Coruña', codigoPostal: '15001', provinciaId: 15 },
  'Santiago de Compostela': { provincia: 'La Coruña', codigoPostal: '15705', provinciaId: 15 },
  'Ourense': { provincia: 'Ourense', codigoPostal: '32001', provinciaId: 32 },
  'Lugo': { provincia: 'Lugo', codigoPostal: '27001', provinciaId: 27 },
  'Badajoz': { provincia: 'Badajoz', codigoPostal: '06001', provinciaId: 6 },
  'Cáceres': { provincia: 'Cáceres', codigoPostal: '10001', provinciaId: 10 },
  'Toledo': { provincia: 'Toledo', codigoPostal: '45001', provinciaId: 45 },
  'Ciudad Real': { provincia: 'Ciudad Real', codigoPostal: '13001', provinciaId: 13 },
  'Albacete': { provincia: 'Albacete', codigoPostal: '02001', provinciaId: 2 },
  'Cuenca': { provincia: 'Cuenca', codigoPostal: '16001', provinciaId: 16 },
  'Guadalajara': { provincia: 'Guadalajara', codigoPostal: '19001', provinciaId: 19 },
  'Ávila': { provincia: 'Ávila', codigoPostal: '05001', provinciaId: 5 },
  'Segovia': { provincia: 'Segovia', codigoPostal: '40001', provinciaId: 40 },
  'Huesca': { provincia: 'Huesca', codigoPostal: '22001', provinciaId: 22 },
  'Teruel': { provincia: 'Teruel', codigoPostal: '44001', provinciaId: 44 },
  'Tarragona': { provincia: 'Tarragona', codigoPostal: '43001', provinciaId: 43 },
  'Lérida': { provincia: 'Lérida', codigoPostal: '25001', provinciaId: 25 },
  'Girona': { provincia: 'Girona', codigoPostal: '17001', provinciaId: 17 },
  'Huelva': { provincia: 'Huelva', codigoPostal: '21001', provinciaId: 21 },
  'Cádiz': { provincia: 'Cádiz', codigoPostal: '11001', provinciaId: 11 },
  'Almería': { provincia: 'Almería', codigoPostal: '04001', provinciaId: 4 },
  'Palma de Mallorca': { provincia: 'Baleares', codigoPostal: '07001', provinciaId: 7 },
  'Las Palmas de Gran Canaria': { provincia: 'Las Palmas', codigoPostal: '35001', provinciaId: 35 },
  'Santa Cruz de Tenerife': { provincia: 'Santa Cruz de Tenerife', codigoPostal: '38001', provinciaId: 38 },
  'Ceuta': { provincia: 'Ceuta', codigoPostal: '51001', provinciaId: 51 },
  'Melilla': { provincia: 'Melilla', codigoPostal: '52001', provinciaId: 52 }
};

/**
 * Normaliza el nombre de una población para buscar en el mapeo
 */
function normalizarPoblacion(poblacion) {
  if (!poblacion) return null;
  return String(poblacion)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[áàäâ]/gi, 'a')
    .replace(/[éèëê]/gi, 'e')
    .replace(/[íìïî]/gi, 'i')
    .replace(/[óòöô]/gi, 'o')
    .replace(/[úùüû]/gi, 'u')
    .replace(/[ñ]/gi, 'n')
    .toLowerCase();
}

/**
 * Normaliza una dirección para buscar en el mapeo
 */
function normalizarDireccion(direccion) {
  if (!direccion) return null;
  return String(direccion)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[áàäâ]/gi, 'a')
    .replace(/[éèëê]/gi, 'e')
    .replace(/[íìïî]/gi, 'i')
    .replace(/[óòöô]/gi, 'o')
    .replace(/[úùüû]/gi, 'u')
    .replace(/[ñ]/gi, 'n')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .toLowerCase();
}

/**
 * Busca código postal por dirección y población
 */
function buscarCPPorDireccion(direccion, poblacion) {
  if (!direccion || !poblacion) return null;
  
  const dirNormalizada = normalizarDireccion(direccion);
  const pobNormalizada = normalizarPoblacion(poblacion);
  
  // Buscar en el mapeo de direcciones
  if (MAPEO_DIRECCION_CP[pobNormalizada]) {
    const mapeoCiudad = MAPEO_DIRECCION_CP[pobNormalizada];
    
    // Buscar coincidencias exactas primero
    for (const [barrio, cp] of Object.entries(mapeoCiudad)) {
      if (dirNormalizada.includes(barrio) || barrio.includes(dirNormalizada)) {
        return cp;
      }
    }
    
    // Buscar coincidencias parciales (palabras clave)
    const palabrasDir = dirNormalizada.split(/\s+/);
    for (const palabra of palabrasDir) {
      if (palabra.length > 3 && mapeoCiudad[palabra]) {
        return mapeoCiudad[palabra];
      }
    }
  }
  
  return null;
}

/**
 * Busca información de población en el mapeo (con normalización)
 */
function buscarPoblacionEnMapeo(poblacion) {
  if (!poblacion) return null;
  
  const normalizada = normalizarPoblacion(poblacion);
  
  // Buscar coincidencia exacta normalizada
  for (const [key, value] of Object.entries(MAPEO_POBLACION_PROVINCIA_CP)) {
    if (normalizarPoblacion(key) === normalizada) {
      return value;
    }
  }
  
  // Buscar coincidencia parcial (contiene)
  for (const [key, value] of Object.entries(MAPEO_POBLACION_PROVINCIA_CP)) {
    const keyNormalizada = normalizarPoblacion(key);
    if (normalizada.includes(keyNormalizada) || keyNormalizada.includes(normalizada)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Obtiene el ID de provincia por nombre
 */
async function obtenerIdProvinciaPorNombre(nombreProvincia, provinciasDB) {
  if (!nombreProvincia || !provinciasDB) return null;
  
  const nombreNormalizado = normalizarPoblacion(nombreProvincia);
  
  for (const provincia of provinciasDB) {
    const provinciaNombre = normalizarPoblacion(provincia.Nombre || provincia.nombre || '');
    if (provinciaNombre === nombreNormalizado) {
      return provincia.id || provincia.Id;
    }
  }
  
  return null;
}

/**
 * Procesa un cliente y completa los campos faltantes
 */
async function procesarCliente(cliente, provinciasDB) {
  const updates = {};
  const razones = [];
  
  const poblacion = cliente.Poblacion || cliente.poblacion || null;
  const direccion = cliente.Direccion || cliente.direccion || null;
  const codigoPostal = cliente.CodigoPostal || cliente.codigoPostal || null;
  const idProvincia = cliente.Id_Provincia || cliente.id_Provincia || cliente.Id_Provincia || null;
  
  // CASO 1: Si tiene Código Postal, obtener Provincia
  if (codigoPostal && !idProvincia) {
    const provinciaId = obtenerProvinciaPorCodigoPostal(codigoPostal);
    if (provinciaId) {
      updates.Id_Provincia = provinciaId;
      razones.push(`CP ${codigoPostal} -> Provincia ID ${provinciaId}`);
    }
  }
  
  // CASO 2: Si tiene Dirección Y Población, buscar Código Postal específico
  // Esto aplica tanto si no tiene CP como si tiene un CP genérico que se puede mejorar
  if (direccion && poblacion) {
    const cpPorDireccion = buscarCPPorDireccion(direccion, poblacion);
    if (cpPorDireccion) {
      // Si no tiene CP, asignarlo
      if (!codigoPostal) {
        updates.CodigoPostal = cpPorDireccion;
        razones.push(`Dirección "${direccion.substring(0, 50)}" + Población "${poblacion}" -> CP ${cpPorDireccion} (específico)`);
      }
      // Si tiene CP genérico (como 30001 para Murcia), mejorarlo con uno específico
      else if (codigoPostal && cpPorDireccion !== codigoPostal) {
        // Verificar si el CP actual es genérico (primeros códigos de la ciudad)
        const pobNormalizada = normalizarPoblacion(poblacion);
        const datosPoblacion = buscarPoblacionEnMapeo(poblacion);
        
        if (datosPoblacion && datosPoblacion.codigoPostal === codigoPostal) {
          // El CP actual es el genérico, mejorarlo con el específico
          updates.CodigoPostal = cpPorDireccion;
          razones.push(`CP mejorado: ${codigoPostal} (genérico) -> ${cpPorDireccion} (específico) basado en dirección "${direccion.substring(0, 50)}"`);
        }
      }
    }
  }
  
  // CASO 3: Si tiene Población, buscar Provincia y Código Postal (solo si no se encontró por dirección)
  if (poblacion) {
    const datosPoblacion = buscarPoblacionEnMapeo(poblacion);
    
    if (datosPoblacion) {
      // Actualizar Provincia si no tiene
      if (!idProvincia && datosPoblacion.provinciaId) {
        updates.Id_Provincia = datosPoblacion.provinciaId;
        razones.push(`Población "${poblacion}" -> Provincia ${datosPoblacion.provincia} (ID: ${datosPoblacion.provinciaId})`);
      }
      
      // Actualizar Código Postal si no tiene (solo si no se encontró por dirección y no hay dirección específica)
      // Si hay dirección, usar CP genérico solo como último recurso
      if (!codigoPostal && !updates.CodigoPostal) {
        if (!direccion || !buscarCPPorDireccion(direccion, poblacion)) {
          // Solo usar CP genérico si no hay dirección o no se pudo determinar CP específico
          if (datosPoblacion.codigoPostal) {
            updates.CodigoPostal = datosPoblacion.codigoPostal;
            razones.push(`Población "${poblacion}" -> CP ${datosPoblacion.codigoPostal} (genérico)`);
          }
        }
      }
    }
  }
  
  // CASO 3: Si tiene Provincia pero no Población ni CP, intentar obtener CP
  if (idProvincia && !codigoPostal) {
    // Buscar en provinciasDB el nombre de la provincia
    const provincia = provinciasDB.find(p => (p.id || p.Id) == idProvincia);
    if (provincia) {
      const nombreProvincia = provincia.Nombre || provincia.nombre;
      // Buscar una población de esa provincia en el mapeo
      for (const [pob, datos] of Object.entries(MAPEO_POBLACION_PROVINCIA_CP)) {
        if (datos.provinciaId == idProvincia) {
          // Si no tiene población, usar la primera encontrada (capital típicamente)
          if (!poblacion && datos.codigoPostal) {
            updates.CodigoPostal = datos.codigoPostal;
            razones.push(`Provincia ${nombreProvincia} -> CP ${datos.codigoPostal} (ejemplo)`);
          }
          break;
        }
      }
    }
  }
  
  return { updates, razones };
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando auto-relleno de Población, Provincia y Código Postal...\n');
    
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios en la BD\n');
    }
    
    // Conectar a la BD
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener todas las provincias
    const provinciasDB = await crm.getProvincias();
    console.log(`📊 Cargadas ${provinciasDB.length} provincias de la BD\n`);
    
    // Obtener todos los clientes
    const clientes = await crm.getClientes();
    console.log(`📊 Total de clientes: ${clientes.length}\n`);
    
    // Estadísticas
    let clientesProcesados = 0;
    let clientesActualizados = 0;
    let totalUpdates = 0;
    
    console.log('🔍 Procesando clientes...\n');
    
    // Procesar cada cliente
    for (const cliente of clientes) {
      const clienteId = cliente.Id || cliente.id;
      const { updates, razones } = await procesarCliente(cliente, provinciasDB);
      
      if (Object.keys(updates).length > 0) {
        clientesActualizados++;
        totalUpdates += Object.keys(updates).length;
        
        console.log(`\n📝 Cliente ID ${clienteId}: ${cliente.Nombre_Razon_Social || cliente.Nombre || 'Sin nombre'}`);
        console.log(`   Razones: ${razones.join('; ')}`);
        console.log(`   Actualizaciones:`, updates);
        
        if (!DRY_RUN) {
          // Construir SQL UPDATE
          const setClauses = Object.keys(updates).map(key => `\`${key}\` = ?`).join(', ');
          const values = Object.values(updates);
          values.push(clienteId);
          
          const sql = `UPDATE clientes SET ${setClauses} WHERE Id = ?`;
          await crm.query(sql, values);
          console.log(`   ✅ Actualizado en BD`);
        } else {
          console.log(`   ⚠️  [SIMULACIÓN] No se actualizó`);
        }
      }
      
      clientesProcesados++;
      
      // Mostrar progreso cada 100 clientes
      if (clientesProcesados % 100 === 0) {
        console.log(`\n📊 Progreso: ${clientesProcesados}/${clientes.length} clientes procesados`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(60));
    console.log(`Total de clientes procesados: ${clientesProcesados}`);
    console.log(`Clientes actualizados: ${clientesActualizados}`);
    console.log(`Total de campos actualizados: ${totalUpdates}`);
    console.log('='.repeat(60));
    
    if (DRY_RUN) {
      console.log('\n⚠️  MODO SIMULACIÓN: No se realizaron cambios reales');
      console.log('   Ejecuta sin --dry-run para aplicar los cambios\n');
    } else {
      console.log('\n✅ Proceso completado exitosamente\n');
    }
    
    await crm.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await crm.disconnect();
    process.exit(1);
  }
}

// Ejecutar
main();
