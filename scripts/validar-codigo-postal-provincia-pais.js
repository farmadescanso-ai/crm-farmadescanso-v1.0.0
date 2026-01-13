/**
 * Valida que el código postal corresponda a la provincia y al país
 * @param {string|number} codigoPostal - Código postal a validar
 * @param {number} provinciaId - ID de la provincia
 * @param {number} paisId - ID del país
 * @param {Array} provincias - Array de provincias con estructura {id, Codigo, Pais, CodigoPais}
 * @param {Array} paises - Array de países con estructura {id, Id_pais, Nombre_pais}
 * @returns {Object} - {valido: boolean, error: string|null}
 */
function validarCodigoPostalProvinciaPais(codigoPostal, provinciaId, paisId, provincias, paises) {
  // Si no hay código postal, no validar (es opcional)
  if (!codigoPostal || codigoPostal.toString().trim() === '') {
    return { valido: true, error: null };
  }

  const cpLimpio = String(codigoPostal).trim().replace(/[^0-9]/g, '');
  
  // Si no hay provincia ni país, no validar
  if (!provinciaId && !paisId) {
    return { valido: true, error: null };
  }

  // Obtener provincia si existe
  let provincia = null;
  if (provinciaId && provincias && provincias.length > 0) {
    provincia = provincias.find(p => p.id === provinciaId || p.Id === provinciaId);
  }

  // Obtener país si existe
  let pais = null;
  if (paisId && paises && paises.length > 0) {
    pais = paises.find(p => p.id === paisId || p.Id === paisId);
  }

  // Validar España
  if (pais && pais.Id_pais === 'ES') {
    if (cpLimpio.length < 5) {
      return { valido: false, error: 'El código postal español debe tener al menos 5 dígitos' };
    }
    
    const codigoProvincia = cpLimpio.substring(0, 2);
    
    if (provincia) {
      // Verificar que el código postal corresponde a la provincia
      if (provincia.Codigo !== codigoProvincia) {
        return { 
          valido: false, 
          error: `El código postal ${cpLimpio} no corresponde a la provincia ${provincia.Nombre}. El código postal debería comenzar con ${provincia.Codigo}` 
        };
      }
      
      // Verificar que la provincia pertenece a España
      if (provincia.Pais !== 'España' && provincia.CodigoPais !== 'ES') {
        return { 
          valido: false, 
          error: `La provincia ${provincia.Nombre} no pertenece a España` 
        };
      }
    } else {
      // Si hay país pero no provincia, verificar que el código postal es español
      const provinciasEspana = provincias.filter(p => p.Pais === 'España' || p.CodigoPais === 'ES');
      const provinciaPorCP = provinciasEspana.find(p => p.Codigo === codigoProvincia);
      
      if (!provinciaPorCP) {
        return { 
          valido: false, 
          error: `El código postal ${cpLimpio} no corresponde a ninguna provincia española` 
        };
      }
    }
  }
  
  // Validar Portugal
  if (pais && pais.Id_pais === 'PT') {
    if (cpLimpio.length < 4) {
      return { valido: false, error: 'El código postal portugués debe tener al menos 4 dígitos' };
    }
    
    // Los códigos postales portugueses tienen 4 dígitos seguidos de guion y 3 dígitos más
    // Pero en la BD pueden estar sin guion
    const cpNum = parseInt(cpLimpio.substring(0, 4));
    
    if (provincia) {
      // Verificar que la provincia pertenece a Portugal
      if (provincia.Pais !== 'Portugal' && provincia.CodigoPais !== 'PT') {
        return { 
          valido: false, 
          error: `La provincia ${provincia.Nombre} no pertenece a Portugal` 
        };
      }
    }
  }

  // Si hay provincia y país, verificar que corresponden
  if (provincia && pais) {
    const provinciaCodigoPais = provincia.CodigoPais || (provincia.Pais === 'España' ? 'ES' : provincia.Pais === 'Portugal' ? 'PT' : null);
    const paisCodigoISO = pais.Id_pais;
    
    if (provinciaCodigoPais && provinciaCodigoPais !== paisCodigoISO) {
      return { 
        valido: false, 
        error: `La provincia ${provincia.Nombre} (${provinciaCodigoPais}) no pertenece al país ${pais.Nombre_pais} (${paisCodigoISO})` 
      };
    }
  }

  return { valido: true, error: null };
}

module.exports = {
  validarCodigoPostalProvinciaPais
};

