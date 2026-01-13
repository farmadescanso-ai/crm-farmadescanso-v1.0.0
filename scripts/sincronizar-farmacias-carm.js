/**
 * Script para sincronizar farmacias desde el portal CARM con MySQL
 * 
 * Este script:
 * 1. Extrae datos de farmacias del portal CARM
 * 2. Obtiene todos los clientes existentes en MySQL
 * 3. Compara y actualiza los clientes existentes
 * 4. Crea los nuevos clientes que no existen (sin duplicados)
 * 
 * Uso: node scripts/sincronizar-farmacias-carm.js [--dry-run]
 */

const crm = require('../config/mysql-crm');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const puppeteer = require('puppeteer');

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');

// URL del portal CARM
const CARM_URL = 'https://www.carm.es/web/pagina?IDCONTENIDO=598&IDTIPO=1&q=farmacias';

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
function buscarClienteExistente(clienteCARM, clientesDB) {
  // 1. Intentar buscar por DNI_CIF primero (más preciso)
  if (clienteCARM.DNI_CIF) {
    const dniNormalizado = normalizarValor(clienteCARM.DNI_CIF);
    const encontrado = clientesDB.find(c => {
      const dniDB = normalizarValor(c.DNI_CIF || c.dni_cif || c['DNI/CIF'] || '');
      return dniDB === dniNormalizado && dniDB !== '';
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  // 2. Buscar por Email (muy preciso)
  if (clienteCARM.Email) {
    const emailNormalizado = normalizarValor(clienteCARM.Email);
    const encontrado = clientesDB.find(c => {
      const emailDB = normalizarValor(c.Email || c.email || '');
      return emailDB === emailNormalizado && emailDB !== '';
    });
    if (encontrado) {
      return encontrado;
    }
  }
  
  // 3. Buscar por Nombre y Teléfono (combinación)
  if (clienteCARM.Nombre && clienteCARM.Telefono) {
    const nombreNormalizado = normalizarValor(clienteCARM.Nombre);
    const telefonoNormalizado = normalizarValor(clienteCARM.Telefono);
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
  if (clienteCARM.Nombre && (clienteCARM.Direccion || clienteCARM.Poblacion)) {
    const nombreNormalizado = normalizarValor(clienteCARM.Nombre);
    const direccionNormalizada = normalizarValor(clienteCARM.Direccion || '');
    const poblacionNormalizada = normalizarValor(clienteCARM.Poblacion || '');
    
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
  if (clienteCARM.Nombre) {
    const nombreNormalizado = normalizarValor(clienteCARM.Nombre);
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
function prepararPayloadActualizacion(clienteCARM, clienteDB) {
  const payload = {};
  
  // Campos a comparar y actualizar
  const campos = [
    'Nombre', 'DNI_CIF', 'Telefono', 'Movil', 'Email',
    'Direccion', 'Poblacion', 'Provincia', 'CodigoPostal'
  ];
  
  campos.forEach(campo => {
    const valorCARM = clienteCARM[campo];
    if (valorCARM !== undefined && valorCARM !== null && valorCARM !== '') {
      const valorCARMNormalizado = normalizarValor(valorCARM);
      const valorDBNormalizado = normalizarValor(
        clienteDB[campo] || 
        clienteDB[campo.toLowerCase()] || 
        clienteDB[campo.toUpperCase()] || 
        ''
      );
      
      // Solo actualizar si el valor es diferente
      if (valorCARMNormalizado !== valorDBNormalizado) {
        payload[campo] = valorCARM;
      }
    }
  });
  
  return payload;
}

/**
 * Extrae datos de farmacias del portal CARM usando Puppeteer
 */
async function extraerFarmaciasCARM() {
  let browser = null;
  
  try {
    console.log(`📡 Accediendo al portal CARM: ${CARM_URL}`);
    console.log('🌐 Iniciando navegador con Puppeteer...');
    
    // Iniciar navegador
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Configurar viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navegar a la página
    console.log('📄 Cargando página del portal CARM...');
    await page.goto(CARM_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Esperar a que se cargue el contenido
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Guardar captura de pantalla para debugging
    try {
      await page.screenshot({ path: 'carm-screenshot.png', fullPage: true });
      console.log('📸 Captura de pantalla guardada: carm-screenshot.png');
    } catch (e) {
      console.log('⚠️  No se pudo guardar captura de pantalla');
    }
    
    // Obtener el HTML completo para análisis
    const htmlContent = await page.content();
    console.log(`📄 HTML obtenido: ${htmlContent.length} caracteres`);
    
    // Buscar si hay un iframe o contenido dinámico
    const iframes = await page.$$('iframe');
    console.log(`🔍 Encontrados ${iframes.length} iframes en la página`);
    
    // Intentar acceder a los iframes para extraer resultados del buscador
    let farmacias = [];
    
    for (let i = 0; i < iframes.length; i++) {
      try {
        const frame = await iframes[i].contentFrame();
        if (frame) {
          console.log(`📄 Accediendo al iframe ${i + 1}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const farmaciasFrame = await frame.evaluate(() => {
            const resultados = [];
            
            // Buscar resultados de Google (si el iframe contiene el buscador)
            const googleResults = document.querySelectorAll('.g, .result, .search-result, [class*="result"]');
            googleResults.forEach(result => {
              const titulo = result.querySelector('h3, .title, a h3, .LC20lb')?.textContent?.trim() || '';
              const snippet = result.querySelector('.snippet, .description, .VwiC3b, .IsZvec')?.textContent?.trim() || '';
              const link = result.querySelector('a')?.getAttribute('href') || '';
              
              if (titulo.toLowerCase().includes('farmacia') && titulo.length > 10) {
                const farmacia = {
                  Nombre: titulo,
                  Direccion: snippet,
                  Poblacion: '',
                  Telefono: '',
                  Email: '',
                  Link: link
                };
                
                // Extraer teléfono
                const telefonoMatch = (titulo + ' ' + snippet).match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
                if (telefonoMatch) {
                  farmacia.Telefono = telefonoMatch[1].replace(/[\s-]/g, '');
                }
                
                // Extraer email
                const emailMatch = (titulo + ' ' + snippet).match(/([\w\.-]+@[\w\.-]+\.\w+)/);
                if (emailMatch) {
                  farmacia.Email = emailMatch[1];
                }
                
                // Extraer población de la dirección o snippet
                const poblaciones = ['Murcia', 'Cartagena', 'Lorca', 'Molina', 'Alcantarilla', 'Cieza', 'Yecla', 'Totana', 'Caravaca', 'Mazarrón', 'Águilas', 'San Javier', 'Torre Pacheco', 'Los Alcázares', 'Santomera', 'Alhama', 'Jumilla', 'Bullas', 'Mula', 'Cehegín', 'Moratalla', 'Calasparra', 'Abarán', 'Fortuna', 'Archena', 'Blanca', 'Cieza', 'Abanilla', 'Beniel', 'Las Torres de Cotillas', 'Alguazas', 'Campos del Río', 'Molina de Segura', 'Alcantarilla', 'Sangonera', 'El Palmar', 'La Alberca', 'El Esparragal', 'Torrealta'];
                poblaciones.forEach(pob => {
                  if (snippet.toLowerCase().includes(pob.toLowerCase()) || titulo.toLowerCase().includes(pob.toLowerCase())) {
                    farmacia.Poblacion = pob;
                  }
                });
                
                resultados.push(farmacia);
              }
            });
            
            return resultados;
          });
          
          farmacias = farmacias.concat(farmaciasFrame);
          console.log(`✅ ${farmaciasFrame.length} farmacias encontradas en iframe ${i + 1}`);
        }
      } catch (error) {
        console.log(`⚠️  No se pudo acceder al iframe ${i + 1}: ${error.message}`);
      }
    }
    
    // Si no se encontraron farmacias en los iframes, buscar en la página principal
    if (farmacias.length === 0) {
      console.log('🔍 Buscando en la página principal...');
      
      const farmaciasPrincipal = await page.evaluate(() => {
      const resultados = [];
      
      // Intentar diferentes selectores posibles
      // El portal CARM puede tener diferentes estructuras
      
      // Opción 1: Buscar en tablas
      const tablas = document.querySelectorAll('table');
      tablas.forEach(tabla => {
        const filas = tabla.querySelectorAll('tr');
        filas.forEach((fila, index) => {
          if (index === 0) return; // Saltar encabezados
          
          const celdas = fila.querySelectorAll('td');
          if (celdas.length >= 3) {
            const farmacia = {
              Nombre: celdas[0]?.textContent?.trim() || '',
              Direccion: celdas[1]?.textContent?.trim() || '',
              Poblacion: celdas[2]?.textContent?.trim() || '',
              Telefono: celdas[3]?.textContent?.trim() || '',
              Email: celdas[4]?.textContent?.trim() || ''
            };
            
            if (farmacia.Nombre) {
              resultados.push(farmacia);
            }
          }
        });
      });
      
      // Opción 2: Buscar en listas
      const listas = document.querySelectorAll('ul, ol, .list, .results');
      listas.forEach(lista => {
        const items = lista.querySelectorAll('li, .item, .result');
        items.forEach(item => {
          const texto = item.textContent?.trim() || '';
          if (texto.toLowerCase().includes('farmacia') || texto.toLowerCase().includes('farmacéutico')) {
            // Intentar extraer información del texto
            const farmacia = {
              Nombre: texto.split('\n')[0] || texto,
              Direccion: '',
              Poblacion: '',
              Telefono: '',
              Email: ''
            };
            
            // Buscar teléfono en el texto
            const telefonoMatch = texto.match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
            if (telefonoMatch) {
              farmacia.Telefono = telefonoMatch[1].replace(/[\s-]/g, '');
            }
            
            // Buscar email en el texto
            const emailMatch = texto.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
            if (emailMatch) {
              farmacia.Email = emailMatch[1];
            }
            
            if (farmacia.Nombre) {
              resultados.push(farmacia);
            }
          }
        });
      });
      
      // Opción 3: Buscar en divs con clases específicas
      const divs = document.querySelectorAll('.farmacia, .pharmacy, [class*="farmacia"], [class*="pharmacy"]');
      divs.forEach(div => {
        const farmacia = {
          Nombre: div.querySelector('h1, h2, h3, .nombre, .name')?.textContent?.trim() || '',
          Direccion: div.querySelector('.direccion, .address, .dir')?.textContent?.trim() || '',
          Poblacion: div.querySelector('.poblacion, .city, .municipio')?.textContent?.trim() || '',
          Telefono: div.querySelector('.telefono, .phone, .tel')?.textContent?.trim() || '',
          Email: div.querySelector('.email, .mail')?.textContent?.trim() || ''
        };
        
        if (farmacia.Nombre) {
          resultados.push(farmacia);
        }
      });
      
      // Opción 4: Buscar en el buscador de Google del portal (si existe)
      const googleResults = document.querySelectorAll('.g, .result, .search-result');
      googleResults.forEach(result => {
        const titulo = result.querySelector('h3, .title, a')?.textContent?.trim() || '';
        const snippet = result.querySelector('.snippet, .description, p')?.textContent?.trim() || '';
        
        if (titulo.toLowerCase().includes('farmacia')) {
          const farmacia = {
            Nombre: titulo,
            Direccion: snippet,
            Poblacion: '',
            Telefono: '',
            Email: ''
          };
          
          // Extraer teléfono y email del snippet
          const telefonoMatch = snippet.match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
          if (telefonoMatch) {
            farmacia.Telefono = telefonoMatch[1].replace(/[\s-]/g, '');
          }
          
          const emailMatch = snippet.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
          if (emailMatch) {
            farmacia.Email = emailMatch[1];
          }
          
          resultados.push(farmacia);
        }
      });
      
      // Opción 5: Buscar en todo el texto de la página
      const bodyText = document.body.textContent || '';
      const farmaciaMatches = bodyText.match(/farmacia[^.]{0,200}/gi);
      if (farmaciaMatches) {
        farmaciaMatches.forEach(match => {
          const farmacia = {
            Nombre: match.substring(0, 100).trim(),
            Direccion: '',
            Poblacion: '',
            Telefono: '',
            Email: ''
          };
          
          // Buscar teléfono en el match
          const telefonoMatch = match.match(/(\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2})/);
          if (telefonoMatch) {
            farmacia.Telefono = telefonoMatch[1].replace(/[\s-]/g, '');
          }
          
          // Buscar email en el match
          const emailMatch = match.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
          if (emailMatch) {
            farmacia.Email = emailMatch[1];
          }
          
          if (farmacia.Nombre && farmacia.Nombre.length > 10) {
            resultados.push(farmacia);
          }
        });
      }
      
      // Opción 6: Buscar enlaces que contengan "farmacia"
      const enlaces = document.querySelectorAll('a[href*="farmacia"], a');
      enlaces.forEach(enlace => {
        const texto = enlace.textContent?.trim() || '';
        const href = enlace.getAttribute('href') || '';
        if ((texto.toLowerCase().includes('farmacia') || href.toLowerCase().includes('farmacia')) && texto.length > 5) {
          const farmacia = {
            Nombre: texto,
            Direccion: '',
            Poblacion: '',
            Telefono: '',
            Email: ''
          };
          resultados.push(farmacia);
        }
      });
      
        return resultados;
      });
      
      farmacias = farmacias.concat(farmaciasPrincipal);
    }
    
    console.log(`✅ ${farmacias.length} farmacias extraídas del portal`);
    
    // Limpiar y normalizar datos
    const farmaciasLimpias = farmacias
      .filter(f => {
        // Filtrar resultados válidos
        const nombre = f.Nombre?.trim() || '';
        // Debe tener al menos 10 caracteres y parecer un nombre real de farmacia
        return nombre.length >= 10 && 
               !nombre.toLowerCase().includes('carm.es') &&
               !nombre.toLowerCase().includes('buscar') &&
               !nombre.toLowerCase().includes('dirección general') &&
               !nombre.toLowerCase().includes('autorización') &&
               !nombre.toLowerCase().includes('transmisión') &&
               !nombre.toLowerCase().includes('comunicación') &&
               (nombre.toLowerCase().includes('farmacia') || 
                nombre.match(/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s,]+$/)); // Parece un nombre propio
      })
      .map(f => {
        // Normalizar nombre
        let nombre = f.Nombre.trim();
        
        // Limpiar nombre de prefijos/sufijos comunes
        nombre = nombre.replace(/^Farmacia\s*-\s*/i, '');
        nombre = nombre.replace(/\s*-\s*CARM\.es.*$/i, '');
        nombre = nombre.replace(/\s*\.\.\.\s*$/i, '');
        
        // Si no empieza con "Farmacia", agregarlo
        if (!nombre.toLowerCase().startsWith('farmacia')) {
          nombre = `Farmacia - ${nombre}`;
        }
        
        return {
          Nombre: nombre,
          Direccion: f.Direccion || '',
          Poblacion: f.Poblacion || 'Murcia',
          Provincia: 'Murcia',
          Telefono: f.Telefono || '',
          Email: f.Email || '',
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
    console.error('❌ Error extrayendo datos del portal CARM:', error.message);
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
async function sincronizarFarmaciasCARM() {
  try {
    console.log('🚀 Iniciando sincronización de farmacias desde CARM...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales');
    }
    console.log('');
    
    // 1. Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // 2. Extraer farmacias del portal CARM
    console.log('📖 Extrayendo farmacias del portal CARM...');
    const farmaciasCARM = await extraerFarmaciasCARM();
    console.log(`✅ ${farmaciasCARM.length} farmacias extraídas del portal CARM\n`);
    
    if (farmaciasCARM.length === 0) {
      console.log('⚠️  No se encontraron farmacias en el portal CARM');
      console.log('💡 Posibles razones:');
      console.log('   - El portal requiere autenticación');
      console.log('   - La estructura del HTML ha cambiado');
      console.log('   - Se necesita implementar scraping específico');
      console.log('   - El portal puede tener una API que requiere acceso');
      return;
    }
    
    // 3. Obtener todos los clientes de la base de datos
    console.log('📊 Obteniendo clientes existentes de MySQL...');
    const clientesDB = await crm.getClientes();
    console.log(`✅ ${clientesDB.length} clientes encontrados en la base de datos\n`);
    
    // 4. Procesar cada farmacia del CARM
    let actualizados = 0;
    let creados = 0;
    let errores = 0;
    let sinCambios = 0;
    let duplicados = 0;
    
    console.log('🔄 Procesando farmacias...\n');
    
    for (let i = 0; i < farmaciasCARM.length; i++) {
      const farmaciaCARM = farmaciasCARM[i];
      const numero = i + 1;
      const nombre = farmaciaCARM.Nombre || 'Sin nombre';
      
      try {
        // Buscar si el cliente ya existe
        const clienteExistente = buscarClienteExistente(farmaciaCARM, clientesDB);
        
        if (clienteExistente) {
          // Cliente existe, verificar si hay cambios
          const payload = prepararPayloadActualizacion(farmaciaCARM, clienteExistente);
          
          if (Object.keys(payload).length > 0) {
            // Hay cambios, actualizar
            const clienteId = clienteExistente.Id || clienteExistente.id;
            console.log(`[${numero}/${farmaciasCARM.length}] 🔄 ${DRY_RUN ? '[SIMULACIÓN] ' : ''}Actualizando cliente: ${nombre} (ID: ${clienteId})`);
            if (DRY_RUN) {
              console.log(`    📝 Campos a actualizar:`, Object.keys(payload).join(', '));
              actualizados++;
            } else {
              await crm.updateCliente(clienteId, payload);
              actualizados++;
            }
          } else {
            // No hay cambios
            console.log(`[${numero}/${farmaciasCARM.length}] ✓ Cliente sin cambios: ${nombre}`);
            sinCambios++;
          }
        } else {
          // Cliente no existe, crear nuevo
          console.log(`[${numero}/${farmaciasCARM.length}] 🆕 ${DRY_RUN ? '[SIMULACIÓN] ' : ''}Creando nuevo cliente: ${nombre}`);
          if (DRY_RUN) {
            console.log(`    📝 Datos del cliente:`, JSON.stringify(farmaciaCARM, null, 2));
            creados++;
          } else {
            await crm.createCliente(farmaciaCARM);
            creados++;
          }
        }
        
        // Pequeña pausa para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`[${numero}/${farmaciasCARM.length}] ❌ Error procesando farmacia "${nombre}":`, error.message);
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
    console.log(`🔄 Duplicados evitados: ${duplicados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total procesado: ${farmaciasCARM.length}`);
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
  sincronizarFarmaciasCARM()
    .then(() => {
      console.log('\n🏁 Proceso finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { sincronizarFarmaciasCARM, extraerFarmaciasCARM };

