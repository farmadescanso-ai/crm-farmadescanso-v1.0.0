/**
 * Script para sincronizar farmacias desde MurciaSalud.es con MySQL
 * 
 * Este script:
 * 1. Accede a https://www.murciasalud.es/farmacias.php?accion=listalocalidades&idsec=1456
 * 2. Navega por cada localidad y extrae datos de farmacias
 * 3. Obtiene todos los clientes existentes en MySQL
 * 4. Compara y actualiza los clientes existentes
 * 5. Crea los nuevos clientes que no existen (sin duplicados)
 * 
 * Uso: node scripts/sincronizar-farmacias-murciasalud.js [--dry-run]
 */

const crm = require('../config/mysql-crm');
const puppeteer = require('puppeteer');

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT_LOCALIDADES = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : null; // Limitar número de localidades para pruebas

// URL base del portal MurciaSalud
const MURCIASALUD_BASE = 'https://www.murciasalud.es';
const MURCIASALUD_LOCALIDADES = 'https://www.murciasalud.es/farmacias.php?accion=listalocalidades&idsec=1456';

/**
 * Normaliza un valor para comparación
 */
function normalizarValor(valor) {
  if (!valor) return '';
  return String(valor).trim().toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar tildes
    .replace(/\s+/g, ' ');
}

/**
 * Busca un cliente existente en la base de datos
 */
function buscarClienteExistente(clienteMurciaSalud, clientesDB) {
  // 1. Intentar buscar por DNI_CIF primero (más preciso)
  if (clienteMurciaSalud.DNI_CIF) {
    const dniNormalizado = normalizarValor(clienteMurciaSalud.DNI_CIF);
    const encontrado = clientesDB.find(c => {
      const dniDB = normalizarValor(c.DNI_CIF || c.dni_cif || c['DNI/CIF'] || '');
      return dniDB === dniNormalizado && dniDB !== '';
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  // 2. Buscar por Email (muy preciso)
  if (clienteMurciaSalud.Email) {
    const emailNormalizado = normalizarValor(clienteMurciaSalud.Email);
    const encontrado = clientesDB.find(c => {
      const emailDB = normalizarValor(c.Email || c.email || '');
      return emailDB === emailNormalizado && emailDB !== '';
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  // 3. Buscar por Nombre y Teléfono (combinación)
  if (clienteMurciaSalud.Nombre && clienteMurciaSalud.Telefono) {
    const nombreNormalizado = normalizarValor(clienteMurciaSalud.Nombre);
    const telefonoNormalizado = normalizarValor(clienteMurciaSalud.Telefono);
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
  
  // 4. Buscar por Nombre y Dirección/Población (combinación)
  if (clienteMurciaSalud.Nombre && (clienteMurciaSalud.Direccion || clienteMurciaSalud.Poblacion)) {
    const nombreNormalizado = normalizarValor(clienteMurciaSalud.Nombre);
    const direccionNormalizada = normalizarValor(clienteMurciaSalud.Direccion || '');
    const poblacionNormalizada = normalizarValor(clienteMurciaSalud.Poblacion || '');
    
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
  
  // 5. Último recurso: buscar solo por Nombre (menos preciso)
  if (clienteMurciaSalud.Nombre) {
    const nombreNormalizado = normalizarValor(clienteMurciaSalud.Nombre);
    const encontrado = clientesDB.find(c => {
      const nombreDB = normalizarValor(c.Nombre || c.nombre || '');
      return nombreDB === nombreNormalizado && nombreDB !== '';
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  return null;
}

/**
 * Prepara el payload para actualizar un cliente
 */
function prepararPayloadActualizacion(clienteMurciaSalud, clienteDB) {
  const payload = {};
  
  // Campos a comparar y actualizar
  const campos = [
    'Nombre', 'DNI_CIF', 'Telefono', 'Movil', 'Email',
    'Direccion', 'Poblacion', 'Provincia', 'CodigoPostal'
  ];
  
  campos.forEach(campo => {
    const valorMurciaSalud = clienteMurciaSalud[campo];
    if (valorMurciaSalud !== undefined && valorMurciaSalud !== null && valorMurciaSalud !== '') {
      const valorMurciaSaludNormalizado = normalizarValor(valorMurciaSalud);
      const valorDBNormalizado = normalizarValor(
        clienteDB[campo] || 
        clienteDB[campo.toLowerCase()] || 
        clienteDB[campo.toUpperCase()] || 
        ''
      );
      
      // Solo actualizar si el valor es diferente
      if (valorMurciaSaludNormalizado !== valorDBNormalizado) {
        payload[campo] = valorMurciaSalud;
      }
    }
  });
  
  return payload;
}

/**
 * Extrae datos detallados de una página de detalle de farmacia
 */
async function extraerDetalleFarmacia(page, urlDetalle) {
  try {
    await page.goto(urlDetalle, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const detalle = await page.evaluate(() => {
      const info = {
        Nombre: '',
        Direccion: '',
        Telefono: '',
        Email: '',
        CodigoPostal: '',
        DNI_CIF: ''
      };
      
      const textoCompleto = document.body.textContent || '';
      
      // Buscar nombre
      const nombreMatch = textoCompleto.match(/(?:Farmacia|Farmacéutico|Titular)[\s:]*([A-ZÁÉÍÓÚÑ][^,\n]{10,80})/i);
      if (nombreMatch) {
        info.Nombre = nombreMatch[1].trim();
      }
      
      // Buscar dirección
      const direccionMatch = textoCompleto.match(/(calle|avenida|av\.?|c\/?|plaza|paseo|ronda)[\s,]+[^,\n]{10,100}/i);
      if (direccionMatch) {
        info.Direccion = direccionMatch[0].trim();
      }
      
      // Buscar código postal
      const cpMatch = textoCompleto.match(/\b\d{5}\b/);
      if (cpMatch) {
        info.CodigoPostal = cpMatch[0];
      }
      
      // Buscar teléfono
      const telefonoMatch = textoCompleto.match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
      if (telefonoMatch) {
        info.Telefono = telefonoMatch[1].replace(/[\s-]/g, '');
      }
      
      // Buscar email
      const emailMatch = textoCompleto.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
      if (emailMatch) {
        info.Email = emailMatch[1];
      }
      
      // Buscar DNI/CIF
      const dniMatch = textoCompleto.match(/\b[A-Z]?\d{7,8}[A-Z]?\b/);
      if (dniMatch) {
        info.DNI_CIF = dniMatch[0];
      }
      
      return info;
    });
    
    return detalle;
  } catch (error) {
    console.error(`    ⚠️  Error accediendo a detalle: ${error.message}`);
    return null;
  }
}

/**
 * Extrae datos de farmacias de una página de localidad
 */
async function extraerFarmaciasDeLocalidad(page, urlLocalidad, localidad) {
  try {
    console.log(`  📄 Cargando: ${localidad}...`);
    await page.goto(urlLocalidad, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const farmacias = await page.evaluate((localidad) => {
      const resultados = [];
      
      // Obtener el texto visible de la página (sin scripts, estilos, etc.)
      const textoVisible = document.body.innerText || document.body.textContent || '';
      
      // El formato es: "Murcia Apellidos, Nombre. Dirección. (Plano de situación)."
      // O: "Población Apellidos, Nombre. Dirección. (Plano de situación)."
      
      // Buscar líneas que sigan este patrón
      const lineas = textoVisible.split('\n').map(l => l.trim()).filter(l => l.length > 10);
      
      lineas.forEach(linea => {
        // Patrón: Población Apellidos, Nombre. Dirección. (Plano...)
        // O: Apellidos, Nombre. Dirección. (Plano...)
        const patron = /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s-]+)\s+([A-ZÁÉÍÓÚÑ][^,]+),\s*([A-ZÁÉÍÓÚÑ][^\.]+)\.\s*([^\(]+)\.\s*\([^\)]+\)\.?$/;
        const match = linea.match(patron);
        
        if (match) {
          const [, poblacion, apellidos, nombre, direccion] = match;
          
          const farmacia = {
            Nombre: `${apellidos.trim()}, ${nombre.trim()}`,
            Direccion: direccion.trim(),
            Poblacion: poblacion.trim() || localidad,
            Provincia: 'Murcia',
            Telefono: '',
            Email: '',
            CodigoPostal: ''
          };
          
          // Buscar código postal en la dirección
          const cpMatch = direccion.match(/\b\d{5}\b/);
          if (cpMatch) {
            farmacia.CodigoPostal = cpMatch[0];
          }
          
          resultados.push(farmacia);
        } else {
          // Patrón alternativo: Apellidos, Nombre. Dirección. (sin población al inicio)
          const patronAlt = /^([A-ZÁÉÍÓÚÑ][^,]+),\s*([A-ZÁÉÍÓÚÑ][^\.]+)\.\s*([^\(]+)\.\s*\([^\)]+\)\.?$/;
          const matchAlt = linea.match(patronAlt);
          
          if (matchAlt && !linea.toLowerCase().includes('listado') && 
              !linea.toLowerCase().includes('oficinas de farmacia')) {
            const [, apellidos, nombre, direccion] = matchAlt;
            
            const farmacia = {
              Nombre: `${apellidos.trim()}, ${nombre.trim()}`,
              Direccion: direccion.trim(),
              Poblacion: localidad,
              Provincia: 'Murcia',
              Telefono: '',
              Email: '',
              CodigoPostal: ''
            };
            
            // Buscar código postal
            const cpMatch = direccion.match(/\b\d{5}\b/);
            if (cpMatch) {
              farmacia.CodigoPostal = cpMatch[0];
            }
            
            resultados.push(farmacia);
          }
        }
      });
      
      // Si no se encontraron con el patrón, buscar en el contenido principal
      if (resultados.length === 0) {
        const contenidoPrincipal = document.querySelector('main, .content, .contenido, #content, [role="main"]') || document.body;
      
        // Buscar tablas con datos de farmacias
        const tablas = contenidoPrincipal.querySelectorAll('table');
      tablas.forEach(tabla => {
        const filas = tabla.querySelectorAll('tr');
        filas.forEach((fila, index) => {
          if (index === 0) return; // Saltar encabezados
          
          const celdas = fila.querySelectorAll('td, th');
          if (celdas.length >= 1) {
            const farmacia = {
              Nombre: '',
              Direccion: '',
              Telefono: '',
              Email: '',
              CodigoPostal: '',
              Poblacion: localidad,
              Provincia: 'Murcia'
            };
            
            // Extraer todo el texto de la fila
            const textoCompleto = fila.textContent || '';
            
            // Intentar extraer datos de las celdas
            celdas.forEach((celda, idx) => {
              const texto = celda.textContent?.trim() || '';
              const enlaces = celda.querySelectorAll('a');
              
              // Buscar nombre (generalmente en la primera celda o en un enlace)
              if (idx === 0) {
                farmacia.Nombre = texto;
              } else if (texto.length > 10 && !farmacia.Nombre) {
                farmacia.Nombre = texto;
              }
              
              // Buscar dirección (contiene palabras como "calle", "avenida", "plaza", números)
              if (texto.match(/(calle|avenida|av\.?|c\/?|plaza|paseo|ronda|avenida)[\s,]+/i) || 
                  (texto.match(/\d+/) && texto.length > 15 && !texto.match(/^\d{9}$/))) {
                if (!farmacia.Direccion || farmacia.Direccion.length < texto.length) {
                  farmacia.Direccion = texto;
                }
              }
              
              // Buscar código postal (5 dígitos)
              const cpMatch = texto.match(/\b\d{5}\b/);
              if (cpMatch) {
                farmacia.CodigoPostal = cpMatch[0];
              }
              
              // Buscar teléfono (formato español: 9 dígitos)
              const telefonoMatch = texto.match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
              if (telefonoMatch) {
                farmacia.Telefono = telefonoMatch[1].replace(/[\s-]/g, '');
              }
              
              // Buscar email
              const emailMatch = texto.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
              if (emailMatch) {
                farmacia.Email = emailMatch[1];
              }
              
              // Buscar en enlaces
              enlaces.forEach(enlace => {
                const href = enlace.getAttribute('href') || '';
                const textoEnlace = enlace.textContent?.trim() || '';
                
                if (textoEnlace.length > 10 && !farmacia.Nombre) {
                  farmacia.Nombre = textoEnlace;
                }
                
                // Si el enlace es a detalles, seguir para obtener más info
                if (href.includes('accion=detalle') || href.includes('accion=mostrar') || href.includes('cod=')) {
                  farmacia.LinkDetalle = href.startsWith('http') ? href : href.startsWith('/') ? `https://www.murciasalud.es${href}` : `https://www.murciasalud.es/${href}`;
                }
              });
            });
            
            // Si no se encontró nombre en las celdas, buscar en el texto completo
            if (!farmacia.Nombre || farmacia.Nombre.length < 5) {
              // Buscar patrones de nombre de farmacia
              const nombreMatch = textoCompleto.match(/(?:Farmacia|Farmacéutico|Titular)[\s:]*([A-ZÁÉÍÓÚÑ][^,\n]{10,50})/i);
              if (nombreMatch) {
                farmacia.Nombre = nombreMatch[1].trim();
              } else {
                // Tomar las primeras palabras como nombre
                const palabras = textoCompleto.trim().split(/\s+/).slice(0, 5).join(' ');
                if (palabras.length > 10) {
                  farmacia.Nombre = palabras;
                }
              }
            }
            
            // Extraer datos del texto completo si no se encontraron en las celdas
            if (!farmacia.Telefono) {
              const telefonoMatch = textoCompleto.match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
              if (telefonoMatch) {
                farmacia.Telefono = telefonoMatch[1].replace(/[\s-]/g, '');
              }
            }
            
            if (!farmacia.Email) {
              const emailMatch = textoCompleto.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
              if (emailMatch) {
                farmacia.Email = emailMatch[1];
              }
            }
            
            if (!farmacia.CodigoPostal) {
              const cpMatch = textoCompleto.match(/\b\d{5}\b/);
              if (cpMatch) {
                farmacia.CodigoPostal = cpMatch[0];
              }
            }
            
            if (farmacia.Nombre && farmacia.Nombre.length > 5 && 
                !farmacia.Nombre.toLowerCase().includes('localidad') &&
                !farmacia.Nombre.toLowerCase().includes('población')) {
              resultados.push(farmacia);
            }
          }
        });
      });
      
        // Si no hay tablas, buscar en listas dentro del contenido principal
        if (resultados.length === 0) {
          const listas = contenidoPrincipal.querySelectorAll('ul, ol');
        listas.forEach(lista => {
          const items = lista.querySelectorAll('li');
          items.forEach(item => {
            const texto = item.textContent?.trim() || '';
            const enlace = item.querySelector('a');
            
            // Buscar items que contengan información de farmacia
            if (texto.length > 20 && (
              texto.toLowerCase().includes('farmacia') ||
              texto.match(/\d{5}/) || // Código postal
              texto.match(/\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}/) // Teléfono
            )) {
              const farmacia = {
                Nombre: '',
                Direccion: '',
                Telefono: '',
                Email: '',
                CodigoPostal: '',
                Poblacion: localidad,
                Provincia: 'Murcia'
              };
              
              // Extraer nombre (puede estar en el enlace o al inicio del texto)
              if (enlace) {
                const textoEnlace = enlace.textContent?.trim() || '';
                if (textoEnlace.length > 5) {
                  farmacia.Nombre = textoEnlace;
                }
              }
              
              // Si no hay nombre en el enlace, buscar al inicio del texto
              if (!farmacia.Nombre) {
                const lineas = texto.split('\n').filter(l => l.trim().length > 0);
                if (lineas.length > 0) {
                  farmacia.Nombre = lineas[0].trim();
                }
              }
              
              // Extraer código postal
              const cpMatch = texto.match(/\b\d{5}\b/);
              if (cpMatch) {
                farmacia.CodigoPostal = cpMatch[0];
              }
              
              // Extraer teléfono
              const telefonoMatch = texto.match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
              if (telefonoMatch) {
                farmacia.Telefono = telefonoMatch[1].replace(/[\s-]/g, '');
              }
              
              // Extraer email
              const emailMatch = texto.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
              if (emailMatch) {
                farmacia.Email = emailMatch[1];
              }
              
              // Extraer dirección (texto que contiene calle, avenida, etc. o números)
              const direccionMatch = texto.match(/(calle|avenida|av\.?|c\/?|plaza|paseo|ronda)[\s,]+[^,\n]{10,100}/i);
              if (direccionMatch) {
                farmacia.Direccion = direccionMatch[0].trim();
              } else {
                // Buscar cualquier texto largo que pueda ser dirección
                const lineas = texto.split('\n').filter(l => l.trim().length > 15 && l.trim().length < 100);
                if (lineas.length > 1 && !lineas[0].toLowerCase().includes('farmacia')) {
                  farmacia.Direccion = lineas[1].trim();
                }
              }
              
              if (farmacia.Nombre && farmacia.Nombre.length > 5) {
                resultados.push(farmacia);
              }
            }
          });
        });
      }
      
        // Si aún no hay resultados, buscar en enlaces que puedan ser farmacias
        if (resultados.length === 0) {
          const enlaces = contenidoPrincipal.querySelectorAll('a[href*="farmacias"], a[href*="accion="]');
        enlaces.forEach(enlace => {
          const texto = enlace.textContent?.trim() || '';
          const href = enlace.getAttribute('href') || '';
          
          // Filtrar enlaces que NO sean de navegación o genéricos
          const textoLower = texto.toLowerCase();
          if (textoLower.includes('listado') || 
              textoLower.includes('localidad') || 
              textoLower.includes('población') ||
              textoLower.includes('buscar') ||
              textoLower.includes('volver') ||
              textoLower.includes('inicio') ||
              texto.length < 5 ||
              texto.length > 200) {
            return; // Saltar este enlace
          }
          
          // Buscar enlaces que apunten a detalles de farmacias
          if ((href.includes('accion=mostrar') || href.includes('cod=') || 
               (href.includes('farmacias.php') && !href.includes('listalocalidades'))) &&
              texto.length > 5 && texto.length < 200) {
            
            // Obtener información del elemento padre (puede contener más datos)
            const padre = enlace.closest('li, div, p, td');
            const textoPadre = padre ? padre.textContent?.trim() || '' : '';
            const textoCompleto = textoPadre || texto;
            
            const linkDetalle = href.startsWith('http') ? href : href.startsWith('/') ? `https://www.murciasalud.es${href}` : `https://www.murciasalud.es/${href}`;
            
            const farmacia = {
              Nombre: texto,
              Direccion: '',
              Telefono: '',
              Email: '',
              CodigoPostal: '',
              Poblacion: localidad,
              Provincia: 'Murcia',
              LinkDetalle: linkDetalle
            };
            
            // Extraer datos del texto completo
            const cpMatch = textoCompleto.match(/\b\d{5}\b/);
            if (cpMatch) {
              farmacia.CodigoPostal = cpMatch[0];
            }
            
            const telefonoMatch = textoCompleto.match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
            if (telefonoMatch) {
              farmacia.Telefono = telefonoMatch[1].replace(/[\s-]/g, '');
            }
            
            const emailMatch = textoCompleto.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
            if (emailMatch) {
              farmacia.Email = emailMatch[1];
            }
            
            const direccionMatch = textoCompleto.match(/(calle|avenida|av\.?|c\/?|plaza|paseo|ronda)[\s,]+[^,\n]{10,100}/i);
            if (direccionMatch) {
              farmacia.Direccion = direccionMatch[0].trim();
            }
            
            resultados.push(farmacia);
          }
        });
      }
      
      // Buscar en todo el texto de la página si aún no hay resultados (último recurso)
      if (resultados.length === 0) {
        const bodyText = document.body.textContent || '';
        // Buscar patrones que indiquen farmacias (evitar texto genérico)
        const lineas = bodyText.split('\n').filter(l => {
          const lTrim = l.trim();
          return lTrim.length > 10 && 
                 lTrim.length < 150 &&
                 !lTrim.toLowerCase().includes('listado') &&
                 !lTrim.toLowerCase().includes('localidad') &&
                 !lTrim.toLowerCase().includes('población') &&
                 !lTrim.toLowerCase().includes('buscar') &&
                 !lTrim.toLowerCase().includes('volver');
        });
        
        lineas.forEach(linea => {
          const lineaLower = linea.toLowerCase();
          if ((lineaLower.includes('farmacia') && !lineaLower.includes('listado')) || 
              (linea.match(/\d{5}/) && linea.match(/\d{3}[\s-]?\d{2}[\s-]?\d{2}/))) {
            const farmacia = {
              Nombre: linea.substring(0, 100).trim(),
              Direccion: '',
              Telefono: '',
              Email: '',
              CodigoPostal: '',
              Poblacion: localidad,
              Provincia: 'Murcia'
            };
            
            const cpMatch = linea.match(/\b\d{5}\b/);
            if (cpMatch) {
              farmacia.CodigoPostal = cpMatch[0];
            }
            
            const telefonoMatch = linea.match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
            if (telefonoMatch) {
              farmacia.Telefono = telefonoMatch[1].replace(/[\s-]/g, '');
            }
            
            if (farmacia.Nombre.length > 10 && 
                !farmacia.Nombre.toLowerCase().includes('listado') &&
                !farmacia.Nombre.toLowerCase().includes('oficinas')) {
              resultados.push(farmacia);
            }
            }
          });
        }
      }
      
      return resultados;
    }, localidad);
    
    console.log(`  ✅ ${farmacias.length} farmacias encontradas en ${localidad}`);
    
    // Si hay enlaces de detalle, obtener información adicional (solo para las primeras 3 para no sobrecargar)
    const farmaciasConDetalle = [];
    for (let i = 0; i < Math.min(farmacias.length, 3); i++) {
      const farmacia = farmacias[i];
      if (farmacia.LinkDetalle) {
        try {
          console.log(`    🔍 Obteniendo detalles de: ${farmacia.Nombre.substring(0, 50)}...`);
          const detalle = await extraerDetalleFarmacia(page, farmacia.LinkDetalle);
          if (detalle) {
            // Combinar datos
            if (detalle.Nombre && !farmacia.Nombre) farmacia.Nombre = detalle.Nombre;
            if (detalle.Direccion && !farmacia.Direccion) farmacia.Direccion = detalle.Direccion;
            if (detalle.Telefono && !farmacia.Telefono) farmacia.Telefono = detalle.Telefono;
            if (detalle.Email && !farmacia.Email) farmacia.Email = detalle.Email;
            if (detalle.CodigoPostal && !farmacia.CodigoPostal) farmacia.CodigoPostal = detalle.CodigoPostal;
            if (detalle.DNI_CIF) farmacia.DNI_CIF = detalle.DNI_CIF;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          // Continuar aunque falle el detalle
        }
      }
      farmaciasConDetalle.push(farmacia);
    }
    
    // Agregar las farmacias restantes sin detalle
    farmaciasConDetalle.push(...farmacias.slice(3));
    
    return farmaciasConDetalle;
    
  } catch (error) {
    console.error(`  ❌ Error extrayendo farmacias de ${localidad}:`, error.message);
    return [];
  }
}

/**
 * Extrae todas las farmacias del portal MurciaSalud
 */
async function extraerFarmaciasMurciaSalud() {
  let browser = null;
  
  try {
    console.log(`📡 Accediendo al portal MurciaSalud: ${MURCIASALUD_LOCALIDADES}`);
    console.log('🌐 Iniciando navegador con Puppeteer...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navegar a la página de localidades
    console.log('📄 Cargando página de localidades...');
    await page.goto(MURCIASALUD_LOCALIDADES, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extraer lista de localidades
    console.log('🔍 Extrayendo lista de localidades...');
    const localidades = await page.evaluate(() => {
      const localidades = [];
      const nombresVistos = new Set();
      
      // Buscar todos los enlaces que puedan ser localidades
      const enlaces = document.querySelectorAll('a');
      enlaces.forEach(enlace => {
        const href = enlace.getAttribute('href') || '';
        const texto = enlace.textContent?.trim() || '';
        
        // Filtrar enlaces que parezcan ser de localidades
        if (texto && texto.length > 0 && texto.length < 50 && 
            (href.includes('farmacias') || href.includes('localidad') || href.includes('accion='))) {
          
          // Construir URL completa
          let urlCompleta = '';
          if (href.startsWith('http')) {
            urlCompleta = href;
          } else if (href.startsWith('/')) {
            urlCompleta = `https://www.murciasalud.es${href}`;
          } else if (href.startsWith('farmacias.php')) {
            urlCompleta = `https://www.murciasalud.es/${href}`;
          } else {
            urlCompleta = `https://www.murciasalud.es/farmacias.php?${href}`;
          }
          
          // Normalizar nombre y evitar duplicados
          const nombreNormalizado = texto.trim();
          if (!nombresVistos.has(nombreNormalizado)) {
            nombresVistos.add(nombreNormalizado);
            localidades.push({
              nombre: nombreNormalizado,
              url: urlCompleta
            });
          }
        }
      });
      
      // Si no se encontraron enlaces, buscar en listas
      if (localidades.length === 0) {
        const listas = document.querySelectorAll('ul, ol, .list, [class*="list"]');
        listas.forEach(lista => {
          const items = lista.querySelectorAll('li');
          items.forEach(item => {
            const enlace = item.querySelector('a');
            if (enlace) {
              const href = enlace.getAttribute('href') || '';
              const texto = enlace.textContent?.trim() || item.textContent?.trim() || '';
              
              if (texto && texto.length > 0 && texto.length < 50) {
                let urlCompleta = '';
                if (href.startsWith('http')) {
                  urlCompleta = href;
                } else if (href.startsWith('/')) {
                  urlCompleta = `https://www.murciasalud.es${href}`;
                } else if (href.startsWith('farmacias.php')) {
                  urlCompleta = `https://www.murciasalud.es/${href}`;
                } else if (href.includes('accion=') || href.includes('localidad=')) {
                  urlCompleta = `https://www.murciasalud.es/farmacias.php?${href}`;
                } else {
                  // Construir URL con parámetros
                  const nombreCodificado = encodeURIComponent(texto);
                  urlCompleta = `https://www.murciasalud.es/farmacias.php?accion=listafarmacias&localidad=${nombreCodificado}`;
                }
                
                const nombreNormalizado = texto.trim();
                if (!nombresVistos.has(nombreNormalizado)) {
                  nombresVistos.add(nombreNormalizado);
                  localidades.push({
                    nombre: nombreNormalizado,
                    url: urlCompleta
                  });
                }
              }
            }
          });
        });
      }
      
      return localidades;
    });
    
    console.log(`✅ ${localidades.length} localidades encontradas`);
    
    if (localidades.length === 0) {
      console.log('⚠️  No se encontraron localidades. Guardando captura de pantalla...');
      await page.screenshot({ path: 'murciasalud-localidades.png', fullPage: true });
      console.log('📸 Captura guardada: murciasalud-localidades.png');
      return [];
    }
    
    // Extraer farmacias de cada localidad
    const todasLasFarmacias = [];
    
    // Determinar cuántas localidades procesar
    const localidadesAProcesar = LIMIT_LOCALIDADES ? localidades.slice(0, LIMIT_LOCALIDADES) : localidades;
    
    if (LIMIT_LOCALIDADES) {
      console.log(`⚠️  Procesando solo las primeras ${LIMIT_LOCALIDADES} localidades (usa --limit=N para cambiar o elimínalo para procesar todas)`);
    } else {
      console.log(`📊 Procesando todas las ${localidades.length} localidades (esto puede tardar varios minutos)`);
    }
    
    // Procesar localidades
    for (let i = 0; i < localidadesAProcesar.length; i++) {
      const localidad = localidadesAProcesar[i];
      console.log(`\n[${i + 1}/${localidadesAProcesar.length}] Procesando: ${localidad.nombre}`);
      
      const farmacias = await extraerFarmaciasDeLocalidad(page, localidad.url, localidad.nombre);
      todasLasFarmacias.push(...farmacias);
      
      // Pausa para no sobrecargar el servidor
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mostrar progreso cada 10 localidades
      if ((i + 1) % 10 === 0) {
        console.log(`\n📊 Progreso: ${i + 1}/${localidadesAProcesar.length} localidades procesadas, ${todasLasFarmacias.length} farmacias encontradas hasta ahora`);
      }
    }
    
    console.log(`\n✅ Total de farmacias extraídas: ${todasLasFarmacias.length}`);
    
    // Limpiar y normalizar datos
    const farmaciasLimpias = todasLasFarmacias
      .filter(f => {
        const nombre = f.Nombre?.trim() || '';
        // Filtrar nombres inválidos
        return nombre.length > 10 && 
               nombre.length < 150 &&
               !nombre.includes('_gaq') &&
               !nombre.includes('push') &&
               !nombre.includes('setAccount') &&
               !nombre.includes('UA-') &&
               !nombre.includes('function') &&
               !nombre.includes('var ') &&
               !nombre.includes('document.') &&
               !nombre.includes('window.') &&
               !nombre.toLowerCase().includes('listado') &&
               !nombre.toLowerCase().includes('oficinas de farmacia') &&
               !nombre.toLowerCase().includes('localidad') &&
               !nombre.toLowerCase().includes('población') &&
               !nombre.toLowerCase().includes('buscar') &&
               !nombre.toLowerCase().includes('volver') &&
               !nombre.toLowerCase().includes('inicio') &&
               (nombre.match(/[A-ZÁÉÍÓÚÑ]/) || nombre.match(/[a-záéíóúñ]{3,}/)); // Debe tener letras
      })
      .map(f => {
        // Normalizar nombre
        let nombre = f.Nombre.trim();
        
        // Limpiar nombre de caracteres especiales al inicio/final
        nombre = nombre.replace(/^[^A-ZÁÉÍÓÚÑa-záéíóúñ]+/, ''); // Eliminar caracteres no alfabéticos al inicio
        nombre = nombre.replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s,\.\-]+$/, ''); // Eliminar caracteres especiales al final
        
        // Si no empieza con "Farmacia", agregarlo
        if (!nombre.toLowerCase().startsWith('farmacia')) {
          nombre = `Farmacia - ${nombre}`;
        }
        
        return {
          Nombre: nombre,
          Direccion: f.Direccion || '',
          Poblacion: f.Poblacion || 'Murcia',
          Provincia: f.Provincia || 'Murcia',
          CodigoPostal: f.CodigoPostal || '',
          Telefono: f.Telefono || '',
          Email: f.Email || '',
          DNI_CIF: f.DNI_CIF || '',
          OK_KO: 'OK'
        };
      });
    
    // Eliminar duplicados por nombre
    const farmaciasUnicas = [];
    const nombresVistos = new Set();
    
    farmaciasLimpias.forEach(farmacia => {
      const nombreNormalizado = normalizarValor(farmacia.Nombre);
      if (!nombresVistos.has(nombreNormalizado)) {
        nombresVistos.add(nombreNormalizado);
        farmaciasUnicas.push(farmacia);
      }
    });
    
    console.log(`✅ ${farmaciasUnicas.length} farmacias únicas después de eliminar duplicados`);
    
    return farmaciasUnicas;
    
  } catch (error) {
    console.error('❌ Error extrayendo datos del portal MurciaSalud:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Navegador cerrado');
    }
  }
}

/**
 * Función principal de sincronización
 */
async function sincronizarFarmaciasMurciaSalud() {
  try {
    console.log('🚀 Iniciando sincronización de farmacias desde MurciaSalud...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales');
    }
    console.log('');
    
    // 1. Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // 2. Extraer farmacias del portal MurciaSalud
    console.log('📖 Extrayendo farmacias del portal MurciaSalud...');
    const farmaciasMurciaSalud = await extraerFarmaciasMurciaSalud();
    console.log(`✅ ${farmaciasMurciaSalud.length} farmacias extraídas del portal MurciaSalud\n`);
    
    if (farmaciasMurciaSalud.length === 0) {
      console.log('⚠️  No se encontraron farmacias en el portal MurciaSalud');
      return;
    }
    
    // 3. Obtener todos los clientes de la base de datos
    console.log('📊 Obteniendo clientes existentes de MySQL...');
    const clientesDB = await crm.getClientes();
    console.log(`✅ ${clientesDB.length} clientes encontrados en la base de datos\n`);
    
    // 4. Procesar cada farmacia
    let actualizados = 0;
    let creados = 0;
    let errores = 0;
    let sinCambios = 0;
    
    console.log('🔄 Procesando farmacias...\n');
    
    for (let i = 0; i < farmaciasMurciaSalud.length; i++) {
      const farmaciaMurciaSalud = farmaciasMurciaSalud[i];
      const numero = i + 1;
      const nombre = farmaciaMurciaSalud.Nombre || 'Sin nombre';
      
      try {
        // Buscar si el cliente ya existe
        const clienteExistente = buscarClienteExistente(farmaciaMurciaSalud, clientesDB);
        
        if (clienteExistente) {
          // Cliente existe, verificar si hay cambios
          const payload = prepararPayloadActualizacion(farmaciaMurciaSalud, clienteExistente);
          
          if (Object.keys(payload).length > 0) {
            // Hay cambios, actualizar
            const clienteId = clienteExistente.Id || clienteExistente.id;
            console.log(`[${numero}/${farmaciasMurciaSalud.length}] 🔄 ${DRY_RUN ? '[SIMULACIÓN] ' : ''}Actualizando cliente: ${nombre} (ID: ${clienteId})`);
            if (DRY_RUN) {
              console.log(`    📝 Campos a actualizar:`, Object.keys(payload).join(', '));
              actualizados++;
            } else {
              await crm.updateCliente(clienteId, payload);
              actualizados++;
            }
          } else {
            // No hay cambios
            console.log(`[${numero}/${farmaciasMurciaSalud.length}] ✓ Cliente sin cambios: ${nombre}`);
            sinCambios++;
          }
        } else {
          // Cliente no existe, crear nuevo
          console.log(`[${numero}/${farmaciasMurciaSalud.length}] 🆕 ${DRY_RUN ? '[SIMULACIÓN] ' : ''}Creando nuevo cliente: ${nombre}`);
          if (DRY_RUN) {
            console.log(`    📝 Datos del cliente:`, JSON.stringify(farmaciaMurciaSalud, null, 2));
            creados++;
          } else {
            await crm.createCliente(farmaciaMurciaSalud);
            creados++;
          }
        }
        
        // Pequeña pausa para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`[${numero}/${farmaciasMurciaSalud.length}] ❌ Error procesando farmacia "${nombre}":`, error.message);
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
    console.log(`📊 Total procesado: ${farmaciasMurciaSalud.length}`);
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

// Ejecutar
if (require.main === module) {
  sincronizarFarmaciasMurciaSalud()
    .then(() => {
      console.log('\n🏁 Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { sincronizarFarmaciasMurciaSalud, extraerFarmaciasMurciaSalud };

