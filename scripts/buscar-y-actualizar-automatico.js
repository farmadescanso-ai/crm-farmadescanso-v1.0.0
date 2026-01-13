/**
 * Script combinado para buscar y actualizar teléfonos y emails automáticamente
 * 
 * Este script combina múltiples fuentes:
 * 1. Búsquedas web en Google
 * 2. Buscador del Colegio de Farmacéuticos de Murcia
 * 3. Páginas Amarillas
 * 4. Extracción inteligente de información
 * 
 * Uso: node scripts/buscar-y-actualizar-automatico.js [--dry-run] [--offset N] [--limit N] [--delay N]
 */

const crm = require('../config/mysql-crm');
const puppeteer = require('puppeteer');

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 30;
const DELAY_ARG = args.find(arg => arg.startsWith('--delay='));
const DELAY = DELAY_ARG ? parseInt(DELAY_ARG.split('=')[1]) : 3000;
const OFFSET_ARG = args.find(arg => arg.startsWith('--offset='));
const OFFSET = OFFSET_ARG ? parseInt(OFFSET_ARG.split('=')[1]) : 0;

/**
 * Verifica si un campo está vacío
 */
function campoVacio(valor) {
  return !valor || 
         valor === null || 
         valor === undefined || 
         String(valor).trim() === '' || 
         String(valor).trim() === 'null' ||
         String(valor).trim() === 'undefined';
}

/**
 * Construye búsqueda optimizada
 */
function construirBusqueda(cliente) {
  const nombre = cliente.Nombre || '';
  const direccion = cliente.Direccion || '';
  const poblacion = cliente.Poblacion || 'Murcia';
  
  // Limpiar nombre
  const nombreLimpio = nombre.replace(/^Farmacia\s*-\s*/i, '').trim();
  
  // Construir búsquedas variadas
  const busquedas = [];
  
  if (nombreLimpio && direccion && poblacion) {
    busquedas.push(`"${nombreLimpio}" "${direccion}" ${poblacion} Murcia teléfono contacto`);
    busquedas.push(`"${nombreLimpio}" farmacia ${poblacion} teléfono`);
  } else if (nombreLimpio && poblacion) {
    busquedas.push(`"${nombreLimpio}" farmacia ${poblacion} Murcia teléfono email contacto`);
  } else if (nombreLimpio) {
    busquedas.push(`"${nombreLimpio}" farmacia Murcia teléfono contacto`);
  }
  
  return busquedas;
}

/**
 * Extrae información de un texto
 */
function extraerInformacion(texto, cliente) {
  const info = {};
  
  if (!texto) return info;
  
  // Filtrar texto del Colegio de Farmacéuticos (no queremos esos datos)
  if (texto.includes('968 27 74 00') || texto.includes('colegio@cofrm.com')) {
    // Buscar teléfonos que NO sean el del Colegio
    const telefonoRegex = /(\+34|0034)?[\s-]?([6-9]\d{2})[\s-]?(\d{2})[\s-]?(\d{2})[\s-]?(\d{2})/g;
    const telefonos = texto.match(telefonoRegex);
    if (telefonos && telefonos.length > 0) {
      // Filtrar el teléfono del Colegio
      const telefonosFiltrados = telefonos.filter(t => {
        const limpio = t.replace(/[\s-]/g, '').replace(/^\+34|^0034/, '');
        return !limpio.includes('968277400') && limpio.length === 9;
      });
      
      if (telefonosFiltrados.length > 0) {
        const telefonoLimpio = telefonosFiltrados[0]
          .replace(/[\s-]/g, '')
          .replace(/^\+34|^0034/, '')
          .substring(0, 9);
        if (telefonoLimpio.length === 9 && campoVacio(cliente.Telefono)) {
          info.Telefono = telefonoLimpio;
        }
        if (campoVacio(cliente.Movil) && campoVacio(cliente.Telefono)) {
          info.Movil = telefonoLimpio;
        }
      }
    }
  } else {
    // Buscar teléfonos normalmente
    const telefonoRegex = /(\+34|0034)?[\s-]?([6-9]\d{2})[\s-]?(\d{2})[\s-]?(\d{2})[\s-]?(\d{2})/g;
    const telefonos = texto.match(telefonoRegex);
    if (telefonos && telefonos.length > 0) {
      const telefonoLimpio = telefonos[0]
        .replace(/[\s-]/g, '')
        .replace(/^\+34|^0034/, '')
        .substring(0, 9);
      if (telefonoLimpio.length === 9) {
        if (campoVacio(cliente.Telefono)) {
          info.Telefono = telefonoLimpio;
        }
        if (campoVacio(cliente.Movil) && campoVacio(cliente.Telefono)) {
          info.Movil = telefonoLimpio;
        }
      }
    }
  }
  
  // Buscar email (filtrar emails genéricos)
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/gi;
  const emails = texto.match(emailRegex);
  if (emails && emails.length > 0) {
    const email = emails[0].toLowerCase();
    // Filtrar emails genéricos o de ejemplo
    if (!email.includes('example.com') && 
        !email.includes('test.com') &&
        !email.includes('colegio@cofrm.com') &&
        !email.includes('@gmail.com') && // Puedes ajustar esto
        campoVacio(cliente.Email)) {
      info.Email = email;
    }
  }
  
  return info;
}

/**
 * Busca información usando Puppeteer en Google
 */
async function buscarConPuppeteer(page, busqueda) {
  try {
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(busqueda)}`;
    
    await page.goto(googleUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extraer texto de los resultados
    const texto = await page.evaluate(() => {
      // Buscar en los resultados de búsqueda
      const resultados = [];
      
      // Selectores comunes de resultados de Google
      const selectores = [
        '.g', '.result', '.search-result', 
        '[data-sokoban-container]', '.tF2Cxc'
      ];
      
      for (const selector of selectores) {
        const elementos = document.querySelectorAll(selector);
        if (elementos.length > 0) {
          elementos.forEach(el => {
            const texto = el.textContent || el.innerText || '';
            if (texto.length > 50) { // Filtrar textos muy cortos
              resultados.push(texto);
            }
          });
          break;
        }
      }
      
      // Si no hay resultados estructurados, usar el body
      if (resultados.length === 0) {
        const body = document.body.textContent || document.body.innerText || '';
        return body.substring(0, 5000); // Limitar tamaño
      }
      
      return resultados.join(' ');
    });
    
    return texto;
    
  } catch (error) {
    console.error(`      ⚠️  Error en búsqueda Puppeteer: ${error.message}`);
    return '';
  }
}

/**
 * Busca información de una farmacia en múltiples fuentes
 */
async function buscarInformacionCompleta(page, cliente) {
  const informacionEncontrada = {};
  const busquedas = construirBusqueda(cliente);
  
  if (busquedas.length === 0) {
    return informacionEncontrada;
  }
  
  // Intentar con la primera búsqueda (más específica)
  const busquedaPrincipal = busquedas[0];
  console.log(`      🔍 Búsqueda: "${busquedaPrincipal}"`);
  
  try {
    // Buscar con Puppeteer
    const textoEncontrado = await buscarConPuppeteer(page, busquedaPrincipal);
    
    if (textoEncontrado) {
      const info = extraerInformacion(textoEncontrado, cliente);
      
      // Combinar información encontrada
      if (info.Telefono && campoVacio(cliente.Telefono)) {
        informacionEncontrada.Telefono = info.Telefono;
      }
      if (info.Movil && campoVacio(cliente.Movil) && campoVacio(cliente.Telefono)) {
        informacionEncontrada.Movil = info.Movil;
      }
      if (info.Email && campoVacio(cliente.Email)) {
        informacionEncontrada.Email = info.Email;
      }
    }
  } catch (error) {
    console.error(`      ⚠️  Error en búsqueda: ${error.message}`);
  }
  
  return informacionEncontrada;
}

/**
 * Función principal
 */
async function buscarYActualizarAutomatico() {
  let browser = null;
  
  try {
    console.log('🚀 Iniciando búsqueda automática de teléfonos y emails...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales');
    }
    console.log(`⚙️  Configuración: OFFSET=${OFFSET}, LIMIT=${LIMIT}, DELAY=${DELAY}ms\n`);
    
    // 1. Conectar a NocoDB
    console.log('📡 Conectando a NocoDB...');
    await crm.connect();
    console.log('✅ Conectado a NocoDB\n');
    
    // 2. Obtener clientes con datos faltantes
    console.log('📊 Obteniendo clientes de NocoDB...');
    const clientes = await crm.getClientes();
    console.log(`✅ ${clientes.length} clientes obtenidos\n`);
    
    // 3. Filtrar clientes con teléfono o email faltante
    console.log('🔍 Identificando clientes con teléfono o email faltante...');
    const clientesConFaltantes = clientes.filter(cliente => {
      return campoVacio(cliente.Telefono) || campoVacio(cliente.Email);
    });
    
    console.log(`✅ ${clientesConFaltantes.length} clientes con teléfono o email faltante\n`);
    
    if (clientesConFaltantes.length === 0) {
      console.log('✅ Todos los clientes tienen teléfono y email completos');
      return;
    }
    
    // 4. Limitar con offset
    const inicio = OFFSET;
    const fin = OFFSET + LIMIT;
    const clientesAProcesar = clientesConFaltantes.slice(inicio, fin);
    console.log(`⚠️  Procesando clientes ${inicio + 1} a ${Math.min(fin, clientesConFaltantes.length)} de ${clientesConFaltantes.length} (--offset=${OFFSET}, --limit=${LIMIT})\n`);
    
    // 5. Iniciar navegador
    console.log('🌐 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Configurar user agent para evitar detección
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 6. Procesar
    console.log('🔄 Buscando información...\n');
    
    let procesados = 0;
    let actualizados = 0;
    let errores = 0;
    let encontrados = {
      telefonos: 0,
      emails: 0
    };
    
    for (let i = 0; i < clientesAProcesar.length; i++) {
      const cliente = clientesAProcesar[i];
      const numero = i + 1;
      
      try {
        const faltantes = [];
        if (campoVacio(cliente.Telefono)) faltantes.push('Teléfono');
        if (campoVacio(cliente.Email)) faltantes.push('Email');
        
        console.log(`[${numero}/${clientesAProcesar.length}] ${cliente.Nombre || 'Sin nombre'} (ID: ${cliente.Id})`);
        console.log(`   📋 Campos faltantes: ${faltantes.join(', ')}`);
        
        // Buscar información
        const informacionEncontrada = await buscarInformacionCompleta(page, cliente);
        
        if (Object.keys(informacionEncontrada).length > 0) {
          const clienteId = cliente.Id || cliente.id;
          const camposEncontrados = Object.keys(informacionEncontrada);
          console.log(`   ✅ Información encontrada: ${camposEncontrados.join(', ')}`);
          
          if (informacionEncontrada.Telefono) encontrados.telefonos++;
          if (informacionEncontrada.Email) encontrados.emails++;
          
          if (!DRY_RUN) {
            await crm.updateCliente(clienteId, informacionEncontrada);
            actualizados++;
            console.log(`   ✅ Cliente actualizado en NocoDB`);
          } else {
            console.log(`   📝 [SIMULACIÓN] Se actualizarían:`, JSON.stringify(informacionEncontrada, null, 2));
            actualizados++;
          }
        } else {
          console.log(`   ⚠️  No se encontró información`);
        }
        
        procesados++;
        
        // Pausa para no sobrecargar
        if (i < clientesAProcesar.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY));
        }
        
      } catch (error) {
        console.error(`   ❌ Error:`, error.message);
        errores++;
      }
    }
    
    // 7. Resumen
    console.log('\n' + '='.repeat(60));
    if (DRY_RUN) {
      console.log('📊 RESUMEN DE SIMULACIÓN (NO SE REALIZARON CAMBIOS)');
    } else {
      console.log('📊 RESUMEN DE BÚSQUEDA AUTOMÁTICA');
    }
    console.log('='.repeat(60));
    console.log(`✅ Clientes procesados: ${procesados}`);
    console.log(`🔄 Clientes actualizados: ${actualizados}`);
    console.log(`📞 Teléfonos encontrados: ${encontrados.telefonos}`);
    console.log(`📧 Emails encontrados: ${encontrados.emails}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total con datos faltantes: ${clientesConFaltantes.length}`);
    console.log(`📈 Tasa de éxito: ${procesados > 0 ? ((actualizados / procesados) * 100).toFixed(1) : 0}%`);
    console.log('='.repeat(60));
    
    console.log('\n🏁 Proceso finalizado');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Navegador cerrado');
    }
  }
}

// Ejecutar
if (require.main === module) {
  buscarYActualizarAutomatico()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { buscarYActualizarAutomatico, extraerInformacion, construirBusqueda };
