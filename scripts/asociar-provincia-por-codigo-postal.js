/**
 * Funciones para asociar provincia por código postal
 * Soporta códigos postales de España y Portugal
 */

// Mapeo de códigos postales españoles a códigos de provincia
// Los dos primeros dígitos del CP español indican la provincia
const ESPANA_CP_A_PROVINCIA = {
  '01': 1,   // Álava
  '02': 2,   // Albacete
  '03': 3,   // Alicante
  '04': 4,   // Almería
  '05': 5,   // Ávila
  '06': 6,   // Badajoz
  '07': 7,   // Baleares
  '08': 8,   // Barcelona
  '09': 9,   // Burgos
  '10': 10,  // Cáceres
  '11': 11,  // Cádiz
  '12': 12,  // Castellón
  '13': 13,  // Ciudad Real
  '14': 14,  // Córdoba
  '15': 15,  // La Coruña
  '16': 16,  // Cuenca
  '17': 17,  // Girona
  '18': 18,  // Granada
  '19': 19,  // Guadalajara
  '20': 20,  // Guipúzcoa
  '21': 21,  // Huelva
  '22': 22,  // Huesca
  '23': 23,  // Jaén
  '24': 24,  // León
  '25': 25,  // Lérida
  '26': 26,  // La Rioja
  '27': 27,  // Lugo
  '28': 28,  // Madrid
  '29': 29,  // Málaga
  '30': 30,  // Murcia
  '31': 31,  // Navarra
  '32': 32,  // Ourense
  '33': 33,  // Asturias
  '34': 34,  // Palencia
  '35': 35,  // Las Palmas
  '36': 36,  // Pontevedra
  '37': 37,  // Salamanca
  '38': 38,  // Santa Cruz de Tenerife
  '39': 39,  // Cantabria
  '40': 40,  // Segovia
  '41': 41,  // Sevilla
  '42': 42,  // Soria
  '43': 43,  // Tarragona
  '44': 44,  // Teruel
  '45': 45,  // Toledo
  '46': 46,  // Valencia
  '47': 47,  // Valladolid
  '48': 48,  // Vizcaya
  '49': 49,  // Zamora
  '50': 50,  // Zaragoza
  '51': 51,  // Ceuta
  '52': 52   // Melilla
};

// Mapeo aproximado de códigos postales portugueses a códigos de provincia
// Los CP portugueses tienen formato XXXX-XXX, usamos los primeros 4 dígitos
// NOTA: Los IDs reales se obtendrán de la BD, estos son códigos de provincia
const PORTUGAL_CP_A_CODIGO_PROVINCIA = {
  '3700': 'PT01', // Aveiro
  '7800': 'PT02', // Beja
  '4700': 'PT03', // Braga
  '5300': 'PT04', // Bragança
  '6000': 'PT05', // Castelo Branco
  '3000': 'PT06', // Coimbra
  '7000': 'PT07', // Évora
  '8000': 'PT08', // Faro
  '6300': 'PT09', // Guarda
  '2400': 'PT10', // Leiria
  '1000': 'PT11', // Lisboa (1000-1999)
  '7300': 'PT12', // Portalegre
  '4000': 'PT13', // Porto (4000-4999)
  '2000': 'PT14', // Santarém
  '2900': 'PT15', // Setúbal
  '4900': 'PT16', // Viana do Castelo
  '5000': 'PT17', // Vila Real
  '3500': 'PT18', // Viseu
  '9000': 'PT30', // Madeira
  '9500': 'PT20'  // Azores
};

/**
 * Determina si un código postal es español o portugués
 */
function detectarPais(codigoPostal) {
  if (!codigoPostal) return null;
  
  const cp = String(codigoPostal).trim().replace(/[^0-9]/g, '');
  
  // España: 5 dígitos
  if (/^\d{5}$/.test(cp)) {
    return 'ES';
  }
  
  // Portugal: 7-8 dígitos (formato XXXX-XXX)
  if (/^\d{7,8}$/.test(cp)) {
    return 'PT';
  }
  
  return null;
}

/**
 * Obtiene el código de provincia a partir de un código postal español
 */
function obtenerProvinciaEspaña(codigoPostal) {
  const cp = String(codigoPostal).trim().replace(/[^0-9]/g, '');
  
  if (cp.length < 2) return null;
  
  const prefijo = cp.substring(0, 2);
  return ESPANA_CP_A_PROVINCIA[prefijo] || null;
}

/**
 * Obtiene el código de provincia a partir de un código postal portugués
 * @returns {string|null} - Código de provincia (ej: 'PT11') o null
 */
function obtenerCodigoProvinciaPortugal(codigoPostal) {
  const cp = String(codigoPostal).trim().replace(/[^0-9]/g, '');
  
  if (cp.length < 4) return null;
  
  const prefijo = cp.substring(0, 4);
  const cpNum = parseInt(prefijo);
  
  // Buscar coincidencia por rango
  for (const [rango, codigoProvincia] of Object.entries(PORTUGAL_CP_A_CODIGO_PROVINCIA)) {
    const rangoNum = parseInt(rango);
    
    // Lisboa: 1000-1999
    if (rango === '1000' && cpNum >= 1000 && cpNum <= 1999) {
      return codigoProvincia;
    }
    // Porto: 4000-4999
    if (rango === '4000' && cpNum >= 4000 && cpNum <= 4999) {
      return codigoProvincia;
    }
    // Coincidencia aproximada para otros (rango de 100)
    if (cpNum >= rangoNum && cpNum < rangoNum + 100) {
      return codigoProvincia;
    }
  }
  
  return null;
}

/**
 * Obtiene el ID de provincia a partir de un código postal
 * @param {string} codigoPostal - Código postal
 * @param {Array} provinciasDB - Array de provincias de la BD (opcional, para Portugal)
 * @returns {number|null} - ID de la provincia o null si no se encuentra
 */
function obtenerProvinciaPorCodigoPostal(codigoPostal, provinciasDB = null) {
  if (!codigoPostal) return null;
  
  const pais = detectarPais(codigoPostal);
  
  if (pais === 'ES') {
    // España: los dos primeros dígitos indican la provincia (01-52)
    const provinciaId = obtenerProvinciaEspaña(codigoPostal);
    return provinciaId;
  } else if (pais === 'PT') {
    // Portugal: necesitamos buscar por código de provincia
    const codigoProvincia = obtenerCodigoProvinciaPortugal(codigoPostal);
    if (codigoProvincia && provinciasDB && provinciasDB.length > 0) {
      const provincia = provinciasDB.find(p => p.Codigo === codigoProvincia);
      return provincia ? provincia.id : null;
    }
    // Si no hay provinciasDB, retornar null (no podemos obtener el ID)
    return null;
  }
  
  return null;
}

/**
 * Obtiene información completa de provincia por código postal
 * @param {string} codigoPostal - Código postal
 * @param {Array} provinciasDB - Array de provincias de la BD
 * @returns {object|null} - Objeto con id, nombre, codigo, pais o null
 */
function obtenerProvinciaCompleta(codigoPostal, provinciasDB) {
  if (!codigoPostal || !provinciasDB || provinciasDB.length === 0) {
    return null;
  }
  
  const provinciaId = obtenerProvinciaPorCodigoPostal(codigoPostal);
  
  if (!provinciaId) return null;
  
  // Buscar la provincia en el array de la BD
  const provincia = provinciasDB.find(p => p.id === provinciaId);
  
  return provincia || null;
}

module.exports = {
  detectarPais,
  obtenerProvinciaPorCodigoPostal,
  obtenerProvinciaCompleta,
  obtenerProvinciaEspaña,
  obtenerCodigoProvinciaPortugal
};

