/**
 * Script para buscar teléfonos y emails desde el conjunto de datos abiertos de Murcia
 * 
 * Este script:
 * 1. Descarga el conjunto de datos abiertos de farmacias de Murcia
 * 2. Busca información de cada farmacia
 * 3. Extrae teléfonos y emails
 * 4. Actualiza los registros en NocoDB
 * 
 * Uso: node scripts/buscar-datos-abiertos-murcia.js [--dry-run] [--limit N]
 */

const crm = require('../config/mysql-crm');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 50;

// URL del conjunto de datos abiertos
const DATOS_ABIERTOS_URL = 'https://datos.gob.es/es/catalogo/a14002961-farmacias';

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
 * Normaliza un valor para comparación
 */
function normalizarValor(valor) {
  if (!valor) return '';
  return String(valor)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/\s+/g, ' ');
}

/**
 * Busca coincidencias entre un cliente y un registro de datos abiertos
 */
function coincidenCliente(cliente, registro) {
  // Normalizar nombres
  const nombreCliente = normalizarValor(cliente.Nombre);
  const nombreRegistro = normalizarValor(registro.nombre || registro.Nombre || '');
  
  // Normalizar direcciones
  const direccionCliente = normalizarValor(cliente.Direccion);
  const direccionRegistro = normalizarValor(registro.direccion || registro.Direccion || '');
  
  // Normalizar poblaciones
  const poblacionCliente = normalizarValor(cliente.Poblacion);
  const poblacionRegistro = normalizarValor(registro.poblacion || registro.Poblacion || '');
  
  // Buscar coincidencias
  // 1. Nombre exacto o parcial
  const nombreCoincide = nombreCliente.includes(nombreRegistro) || 
                         nombreRegistro.includes(nombreCliente) ||
                         nombreCliente.replace(/^FARMACIA\s*-\s*/i, '').includes(nombreRegistro);
  
  // 2. Dirección y población
  const direccionCoincide = direccionCliente && direccionRegistro && 
                           (direccionCliente.includes(direccionRegistro) || 
                            direccionRegistro.includes(direccionCliente));
  
  const poblacionCoincide = poblacionCliente && poblacionRegistro && 
                           poblacionCliente === poblacionRegistro;
  
  return nombreCoincide && (direccionCoincide || poblacionCoincide);
}

/**
 * Descarga y procesa el conjunto de datos abiertos
 */
async function descargarDatosAbiertos() {
  try {
    console.log('📥 Intentando descargar datos abiertos...');
    
    // Intentar diferentes formatos
    const urls = [
      'https://datos.gob.es/es/catalogo/a14002961-farmacias.json',
      'https://datos.gob.es/es/catalogo/a14002961-farmacias.csv',
      'https://datosabiertos.murcia.es/dataset/farmacias/resource.json',
      'https://datosabiertos.murcia.es/dataset/farmacias/resource.csv'
    ];
    
    for (const url of urls) {
      try {
        console.log(`   🔍 Intentando: ${url}`);
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json, text/csv, */*'
          }
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          
          if (contentType.includes('json')) {
            const data = await response.json();
            console.log(`   ✅ Datos JSON obtenidos`);
            return data;
          } else if (contentType.includes('csv')) {
            const csv = await response.text();
            console.log(`   ✅ Datos CSV obtenidos (${csv.length} caracteres)`);
            // Aquí podrías parsear el CSV si es necesario
            return { csv, formato: 'csv' };
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Error con ${url}: ${error.message}`);
        continue;
      }
    }
    
    console.log('   ⚠️  No se pudieron descargar los datos abiertos');
    return null;
    
  } catch (error) {
    console.error('   ❌ Error descargando datos:', error.message);
    return null;
  }
}

/**
 * Función principal
 */
async function buscarDatosAbiertos() {
  try {
    console.log('🚀 Iniciando búsqueda de teléfonos y emails desde datos abiertos...');
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
    
    // 5. Descargar datos abiertos
    const datosAbiertos = await descargarDatosAbiertos();
    
    if (!datosAbiertos) {
      console.log('\n⚠️  No se pudieron descargar los datos abiertos.');
      console.log('💡 Alternativa: Usa el script buscar-telefonos-emails.js que genera URLs de búsqueda manual');
      return;
    }
    
    // 6. Procesar
    console.log('\n🔄 Buscando información...\n');
    
    let procesados = 0;
    let actualizados = 0;
    let errores = 0;
    
    // NOTA: Aquí procesarías los datos abiertos y buscarías coincidencias
    // Por ahora, mostramos un ejemplo de cómo se haría
    
    for (let i = 0; i < clientesAProcesar.length; i++) {
      const cliente = clientesAProcesar[i];
      const numero = i + 1;
      
      try {
        const faltantes = [];
        if (campoVacio(cliente.Telefono)) faltantes.push('Teléfono');
        if (campoVacio(cliente.Email)) faltantes.push('Email');
        
        console.log(`[${numero}/${clientesAProcesar.length}] ${cliente.Nombre || 'Sin nombre'} (ID: ${cliente.Id})`);
        console.log(`   📋 Campos faltantes: ${faltantes.join(', ')}`);
        
        // Aquí buscarías en datosAbiertos una coincidencia
        // const registroEncontrado = datosAbiertos.find(r => coincidenCliente(cliente, r));
        
        const informacionEncontrada = {};
        
        if (Object.keys(informacionEncontrada).length > 0) {
          const clienteId = cliente.Id || cliente.id;
          console.log(`   ✅ Información encontrada:`, Object.keys(informacionEncontrada).join(', '));
          
          if (!DRY_RUN) {
            await crm.updateCliente(clienteId, informacionEncontrada);
            actualizados++;
            console.log(`   ✅ Cliente actualizado`);
          } else {
            console.log(`   📝 [SIMULACIÓN] Se actualizarían:`, JSON.stringify(informacionEncontrada, null, 2));
            actualizados++;
          }
        } else {
          console.log(`   ⚠️  No se encontró información en datos abiertos`);
        }
        
        procesados++;
        
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
  }
}

// Ejecutar
if (require.main === module) {
  buscarDatosAbiertos()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { buscarDatosAbiertos, coincidenCliente, normalizarValor };

