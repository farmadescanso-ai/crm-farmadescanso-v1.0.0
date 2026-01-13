/**
 * Script para buscar teléfonos y emails desde el Colegio de Farmacéuticos de Murcia
 * 
 * Este script:
 * 1. Accede al buscador del Colegio de Farmacéuticos
 * 2. Busca información de cada farmacia
 * 3. Extrae teléfonos y emails
 * 4. Actualiza los registros en NocoDB
 * 
 * Uso: node scripts/buscar-colegio-farmaceuticos.js [--dry-run] [--limit N]
 */

const crm = require('../config/mysql-crm');
const puppeteer = require('puppeteer');

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 30;

// URL del buscador del Colegio de Farmacéuticos
const COFRM_BUSCADOR = 'https://web.cofrm.com/buscador-de-farmacias/';

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
 * Construye búsqueda para el buscador del Colegio
 */
function construirBusqueda(cliente) {
  const nombre = cliente.Nombre || '';
  const direccion = cliente.Direccion || '';
  const poblacion = cliente.Poblacion || 'Murcia';
  
  // Limpiar nombre
  const nombreLimpio = nombre.replace(/^Farmacia\s*-\s*/i, '').trim();
  
  // Extraer apellidos (generalmente antes de la coma)
  const partes = nombreLimpio.split(',');
  const apellidos = partes[0]?.trim() || nombreLimpio;
  
  return {
    nombre: nombreLimpio,
    apellidos: apellidos,
    poblacion: poblacion,
    direccion: direccion
  };
}

/**
 * Extrae información de un texto
 */
function extraerInformacion(texto, cliente) {
  const info = {};
  
  if (!texto) return info;
  
  // Buscar email
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/gi;
  const emails = texto.match(emailRegex);
  if (emails && emails.length > 0) {
    const email = emails[0].toLowerCase();
    if (!email.includes('example.com') && 
        !email.includes('test.com') &&
        campoVacio(cliente.Email)) {
      info.Email = email;
    }
  }
  
  // Buscar teléfonos (formato español)
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
  
  return info;
}

/**
 * Busca información de una farmacia en el buscador del Colegio
 */
async function buscarEnColegio(page, cliente) {
  try {
    const busqueda = construirBusqueda(cliente);
    
    // Navegar al buscador
    await page.goto(COFRM_BUSCADOR, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Buscar la farmacia en el buscador
    const resultados = await page.evaluate((busqueda) => {
      const info = {
        Telefono: '',
        Email: ''
      };
      
      // Buscar en el texto de la página
      const textoCompleto = document.body.textContent || '';
      
      // Buscar si aparece el nombre de la farmacia
      const nombreMatch = busqueda.apellidos.toLowerCase();
      if (textoCompleto.toLowerCase().includes(nombreMatch) || 
          textoCompleto.toLowerCase().includes(busqueda.poblacion.toLowerCase())) {
        
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
      }
      
      return info;
    }, busqueda);
    
    return resultados;
    
  } catch (error) {
    console.error(`    ⚠️  Error buscando en Colegio: ${error.message}`);
    return { Telefono: '', Email: '' };
  }
}

/**
 * Función principal
 */
async function buscarEnColegioFarmaceuticos() {
  let browser = null;
  
  try {
    console.log('🚀 Iniciando búsqueda de teléfonos y emails...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales');
    }
    console.log('');
    
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
    
    // 4. Limitar
    const clientesAProcesar = clientesConFaltantes.slice(0, LIMIT);
    console.log(`⚠️  Procesando los primeros ${LIMIT} clientes (usa --limit=N para cambiar)\n`);
    
    // 5. Iniciar navegador
    console.log('🌐 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 6. Procesar
    console.log('🔄 Buscando información...\n');
    
    let procesados = 0;
    let actualizados = 0;
    let errores = 0;
    
    for (let i = 0; i < clientesAProcesar.length; i++) {
      const cliente = clientesAProcesar[i];
      const numero = i + 1;
      
      try {
        const faltantes = [];
        if (campoVacio(cliente.Telefono)) faltantes.push('Teléfono');
        if (campoVacio(cliente.Email)) faltantes.push('Email');
        
        console.log(`[${numero}/${clientesAProcesar.length}] ${cliente.Nombre || 'Sin nombre'} (ID: ${cliente.Id})`);
        console.log(`   📋 Campos faltantes: ${faltantes.join(', ')}`);
        
        // Buscar en el Colegio de Farmacéuticos
        const informacionEncontrada = await buscarEnColegio(page, cliente);
        
        // Filtrar solo los campos que realmente se encontraron
        const infoParaActualizar = {};
        if (informacionEncontrada.Telefono && campoVacio(cliente.Telefono)) {
          infoParaActualizar.Telefono = informacionEncontrada.Telefono;
        }
        if (informacionEncontrada.Email && campoVacio(cliente.Email)) {
          infoParaActualizar.Email = informacionEncontrada.Email;
        }
        
        if (Object.keys(infoParaActualizar).length > 0) {
          const clienteId = cliente.Id || cliente.id;
          console.log(`   ✅ Información encontrada:`, Object.keys(infoParaActualizar).join(', '));
          
          if (!DRY_RUN) {
            await crm.updateCliente(clienteId, infoParaActualizar);
            actualizados++;
            console.log(`   ✅ Cliente actualizado`);
          } else {
            console.log(`   📝 [SIMULACIÓN] Se actualizarían:`, JSON.stringify(infoParaActualizar, null, 2));
            actualizados++;
          }
        } else {
          console.log(`   ⚠️  No se encontró información en el buscador del Colegio`);
        }
        
        procesados++;
        
        // Pausa para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
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
      console.log('📊 RESUMEN DE BÚSQUEDA');
    }
    console.log('='.repeat(60));
    console.log(`✅ Clientes procesados: ${procesados}`);
    console.log(`🔄 Clientes actualizados: ${actualizados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total con datos faltantes: ${clientesConFaltantes.length}`);
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
  buscarEnColegioFarmaceuticos()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { buscarEnColegioFarmaceuticos };

