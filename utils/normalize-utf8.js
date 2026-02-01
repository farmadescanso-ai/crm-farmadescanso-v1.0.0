/**
 * Función helper para normalizar codificación UTF-8
 * Corrige caracteres mal codificados comunes
 */

function normalizeUTF8(str) {
  if (!str || typeof str !== 'string') return str;
  
  try {
    let fixed = str;
    const original = str;
    
    // Mapeo de caracteres mal codificados comunes
    const encodingFixMap = {
      'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú',
      'Ã': 'Á', 'Ã‰': 'É', 'Ã': 'Í', 'Ã"': 'Ó', 'Ãš': 'Ú',
      'Ã±': 'ñ', 'Ã\'': 'Ñ', 'Ã¼': 'ü', 'Ãœ': 'Ü',
      '├ü': 'á', '├®': 'é', '├¡': 'í', '├│': 'ó', '├║': 'ú',
      '├ë': 'É', '├ì': 'Í', '├ô': 'Ó', '├Ü': 'Ú',
      '├æ': 'ñ', '├╝': 'ü',
    };
    
    // Aplicar correcciones del mapa
    Object.keys(encodingFixMap).forEach(bad => {
      const regex = new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      fixed = fixed.replace(regex, encodingFixMap[bad]);
    });
    
    // CORRECCIÓN DEFINITIVA: Usar un enfoque más directo y agresivo
    // Reemplazar TODAS las ocurrencias de [áéíóúñ][A-Z] por [áéíóúñ][a-z]
    // Hacerlo de forma iterativa hasta que no haya más cambios
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;
    
    while (changed && iterations < maxIterations) {
      const before = fixed;
      iterations++;
      
      // Reemplazar letra acentuada minúscula seguida de mayúscula
      fixed = fixed.replace(/([áéíóúñ])([A-Z])/g, (match, accented, upper) => {
        return accented + upper.toLowerCase();
      });
      
      // Reemplazar letra acentuada mayúscula seguida de mayúscula (menos común pero posible)
      fixed = fixed.replace(/([ÁÉÍÓÚÑ])([A-Z])/g, (match, accented, upper) => {
        return accented + upper.toLowerCase();
      });
      
      changed = (before !== fixed);
    }
    
    return fixed;
  } catch (error) {
    console.warn('⚠️ Error normalizando UTF-8:', error.message);
    return str; // En caso de error, devolver el original
  }
}

/**
 * Normaliza a "Title Case" (tipo España, Afganistán) pensado para nombres en castellano.
 * Útil para catálogos como países/provincias donde a veces llegan MAYÚSCULAS con letras sueltas mal.
 *
 * Nota: NO usar para nombres libres (razón social, etc.) porque puede alterar formato deseado.
 */
function normalizeTitleCaseES(str) {
  if (str === null || str === undefined) return str;
  const s = normalizeUTF8(String(str));
  const trimmed = s.trim();
  if (!trimmed) return trimmed;

  // Preservar acrónimos cortos (p.ej. "USA", "UAE") si vienen así
  if (/^[A-Z0-9]{2,4}$/.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  const smallWords = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'o']);

  const capWord = (w) => {
    if (!w) return w;
    // Respetar palabras ya con números/símbolos, pero capitalizar primera letra
    return w.charAt(0).toUpperCase() + w.slice(1);
  };

  const out = lower
    .split(/\s+/)
    .map((word, idx) => {
      // Mantener conectores en minúscula salvo primera palabra
      if (idx > 0 && smallWords.has(word)) return word;
      // Capitalizar sub-partes separadas por guión
      return word
        .split('-')
        .map((part, pIdx) => {
          if (idx > 0 && pIdx > 0 && smallWords.has(part)) return part;
          return capWord(part);
        })
        .join('-');
    })
    .join(' ');

  return out;
}

/**
 * Normaliza recursivamente todos los strings en un objeto o array
 */
function normalizeObjectUTF8(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return normalizeUTF8(obj);
  }

  // Preservar tipos especiales de objeto (p.ej. Date) para no perder información.
  // Nota: un Date no tiene propiedades enumerables, por lo que el bloque genérico de "object"
  // lo convertiría en {} y rompería el render/formateo de fechas.
  if (obj instanceof Date) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeObjectUTF8(item));
  }
  
  if (typeof obj === 'object') {
    const normalized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        normalized[key] = normalizeObjectUTF8(obj[key]);
      }
    }
    return normalized;
  }
  
  // Para otros tipos (números, booleanos, etc.), devolver sin cambios
  return obj;
}

module.exports = {
  normalizeUTF8,
  normalizeTitleCaseES,
  normalizeObjectUTF8
};
