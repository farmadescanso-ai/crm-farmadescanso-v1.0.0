/**
 * Script para corregir nombres y poblaciones mezclados en los clientes
 * 
 * El problema:
 * - Nombre: "Farmacia - Mateos-Cartagena Ortega Ortega, Luís Alberto"
 * - Población: "Los"
 * 
 * Debe ser:
 * - Nombre: "Farmacia - Ortega Ortega, Luís Alberto"
 * - Población: "Los Mateos-Cartagena"
 * 
 * Uso: node scripts/corregir-nombre-poblacion.js [--dry-run] [--limit N]
 */

const crm = require('../config/mysql-crm');

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : null;

/**
 * Extrae la población del nombre si está mezclada
 * @param {string} nombre - Nombre completo del cliente
 * @param {string} poblacion - Población actual
 * @returns {Object|null} - Objeto con nombre corregido y población corregida, o null si no hay que corregir
 */
function extraerPoblacionDelNombre(nombre, poblacion) {
  if (!nombre || !poblacion) {
    return null;
  }

  // Verificar si el nombre empieza con "Farmacia - "
  const prefijo = 'Farmacia - ';
  if (!nombre.startsWith(prefijo)) {
    return null;
  }

  // Obtener el nombre sin el prefijo
  const nombreSinPrefijo = nombre.substring(prefijo.length).trim();
  
  // Verificar si la población actual solo tiene artículos
  const articulos = ['Los', 'La', 'El', 'Las', 'Le', 'Les'];
  const poblacionLimpia = poblacion.trim();
  
  if (!articulos.includes(poblacionLimpia)) {
    return null;
  }

  // Buscar patrón de población en el nombre usando regex
  // Casos:
  // 1. "Palabra-Provincia Apellido" (ej: "Mateos-Cartagena Ortega")
  // 2. "Palabra-San Palabra Apellido" (ej: "Manga-San Javier Jiménez")
  // 3. "Palabra-Del Palabra Apellido" (menos común)
  
  const provincias = ['Cartagena', 'Murcia', 'Lorca', 'Caravaca', 'Abanilla', 'Totana', 'Mula', 'Jumilla', 'Yecla', 'Cieza', 'Alcantarilla'];
  
  let poblacionDelNombre = '';
  let restoDelNombre = '';
  
  // Patrón 1: "Palabra-Provincia" seguido de espacio y apellido
  // Ejemplo: "Mateos-Cartagena Ortega Ortega, Luís Alberto"
  const patronProvincia = new RegExp(`^([A-Za-záéíóúñÁÉÍÓÚÑ]+-(?:${provincias.join('|')}))\\s+(.+)$`, 'i');
  const matchProvincia = nombreSinPrefijo.match(patronProvincia);
  
  if (matchProvincia && matchProvincia[2]) {
    poblacionDelNombre = matchProvincia[1].trim();
    restoDelNombre = matchProvincia[2].trim();
  } else {
    // Patrón 2: "Palabra-San Palabra" seguido de espacio y apellido
    // Ejemplo: "Manga-San Javier Jiménez Cervantes"
    const patronSan = /^([A-Za-záéíóúñÁÉÍÓÚÑ]+-San\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)\s+(.+)$/i;
    const matchSan = nombreSinPrefijo.match(patronSan);
    
    if (matchSan && matchSan[2]) {
      poblacionDelNombre = matchSan[1].trim();
      restoDelNombre = matchSan[2].trim();
    } else {
      // Patrón 3: "Palabra-Del Palabra" seguido de espacio y apellido
      const patronDel = /^([A-Za-záéíóúñÁÉÍÓÚÑ]+-Del\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)\s+(.+)$/i;
      const matchDel = nombreSinPrefijo.match(patronDel);
      
      if (matchDel && matchDel[2]) {
        poblacionDelNombre = matchDel[1].trim();
        restoDelNombre = matchDel[2].trim();
      } else {
        // Patrón 4: Genérico - "Palabra-Palabra" seguido de espacio y apellido
        // Último recurso para casos como "Palabra-OtraPalabra Apellido"
        const patronGenerico = /^([A-Za-záéíóúñÁÉÍÓÚÑ]+-[A-Za-záéíóúñÁÉÍÓÚÑ]+)\s+(.+)$/;
        const matchGenerico = nombreSinPrefijo.match(patronGenerico);
        
        if (matchGenerico && matchGenerico[2]) {
          poblacionDelNombre = matchGenerico[1].trim();
          restoDelNombre = matchGenerico[2].trim();
        } else {
          return null;
        }
      }
    }
  }
  
  // Validar que tenemos tanto población como resto del nombre
  if (!poblacionDelNombre || !restoDelNombre) {
    return null;
  }
  
  // Validar que el resto del nombre parece un apellido (empieza con mayúscula)
  if (!restoDelNombre.match(/^[A-ZÁÉÍÓÚÑ]/)) {
    return null;
  }
  
  // Construir la nueva población combinando el artículo y la población del nombre
  const nuevaPoblacion = `${poblacionLimpia} ${poblacionDelNombre}`.trim();
  
  // Construir el nuevo nombre con el prefijo y el resto del nombre
  const nuevoNombre = `${prefijo}${restoDelNombre}`;

  return {
    nombre: nuevoNombre,
    poblacion: nuevaPoblacion
  };
}

/**
 * Procesa y corrige los clientes
 */
async function corregirNombrePoblacion() {
  try {
    console.log('🚀 Iniciando corrección de nombres y poblaciones...');
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios reales');
    }
    console.log(`⚙️  Configuración: LIMIT=${LIMIT || 'sin límite'}, DRY_RUN=${DRY_RUN}\n`);
    
    // 1. Conectar a NocoDB
    console.log('📡 Conectando a NocoDB...');
    await crm.connect();
    console.log('✅ Conectado a NocoDB\n');
    
    // 2. Obtener todos los clientes
    console.log('📊 Obteniendo clientes de NocoDB...');
    const clientes = await crm.getClientes();
    console.log(`✅ ${clientes.length} clientes obtenidos\n`);
    
    // 3. Limitar si es necesario
    const clientesAProcesar = LIMIT ? clientes.slice(0, LIMIT) : clientes;
    if (LIMIT) {
      console.log(`⚠️  Procesando los primeros ${LIMIT} clientes (usa --limit=N para cambiar)\n`);
    }
    
    // 4. Procesar clientes
    console.log('🔄 Analizando clientes...\n');
    
    let procesados = 0;
    let corregidos = 0;
    let errores = 0;
    const correcciones = [];
    
    for (const cliente of clientesAProcesar) {
      try {
        const nombre = cliente.Nombre || '';
        const poblacion = cliente.Poblacion || '';
        
        // Intentar extraer la población del nombre
        const correccion = extraerPoblacionDelNombre(nombre, poblacion);
        
        if (correccion) {
          const clienteId = cliente.Id || cliente.id;
          console.log(`[${procesados + 1}/${clientesAProcesar.length}] Cliente ID: ${clienteId}`);
          console.log(`   📋 Nombre actual: "${nombre}"`);
          console.log(`   📋 Población actual: "${poblacion}"`);
          console.log(`   ✅ Nombre corregido: "${correccion.nombre}"`);
          console.log(`   ✅ Población corregida: "${correccion.poblacion}"`);
          
          correcciones.push({
            id: clienteId,
            nombreAntes: nombre,
            poblacionAntes: poblacion,
            nombreDespues: correccion.nombre,
            poblacionDespues: correccion.poblacion
          });
          
          if (!DRY_RUN) {
            // Actualizar cliente en NocoDB
            await crm.updateCliente(clienteId, {
              Nombre: correccion.nombre,
              Poblacion: correccion.poblacion
            });
            console.log(`   ✅ Cliente actualizado en NocoDB`);
          } else {
            console.log(`   📝 [SIMULACIÓN] Se actualizarían:`, {
              Nombre: correccion.nombre,
              Poblacion: correccion.poblacion
            });
          }
          
          corregidos++;
        }
        
        procesados++;
        
      } catch (error) {
        console.error(`   ❌ Error procesando cliente ${cliente.Id || cliente.id}:`, error.message);
        errores++;
      }
    }
    
    // 5. Resumen
    console.log('\n' + '='.repeat(60));
    if (DRY_RUN) {
      console.log('📊 RESUMEN DE SIMULACIÓN (NO SE REALIZARON CAMBIOS)');
    } else {
      console.log('📊 RESUMEN DE CORRECCIÓN');
    }
    console.log('='.repeat(60));
    console.log(`✅ Clientes procesados: ${procesados}`);
    console.log(`🔄 Clientes corregidos: ${corregidos}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total de clientes: ${clientes.length}`);
    console.log(`📈 Tasa de corrección: ${procesados > 0 ? ((correcciones.length / procesados) * 100).toFixed(1) : 0}%`);
    console.log('='.repeat(60));
    
    if (correcciones.length > 0) {
      console.log('\n📋 CORRECCIONES REALIZADAS:');
      correcciones.forEach((correccion, index) => {
        console.log(`\n${index + 1}. Cliente ID: ${correccion.id}`);
        console.log(`   Antes: Nombre="${correccion.nombreAntes}", Población="${correccion.poblacionAntes}"`);
        console.log(`   Después: Nombre="${correccion.nombreDespues}", Población="${correccion.poblacionDespues}"`);
      });
    }
    
    console.log('\n🏁 Proceso finalizado');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  corregirNombrePoblacion()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { corregirNombrePoblacion, extraerPoblacionDelNombre };

