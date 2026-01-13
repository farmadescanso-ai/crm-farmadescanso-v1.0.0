/**
 * Script para corregir caracteres mal codificados en la tabla Clientes
 * 
 * Corrige problemas de codificación UTF-8 mal interpretados como:
 * - ESPA├æA → ESPAÑA
 * - ├│ → ó
 * - ├í → í
 * - ├® → é
 * - etc.
 * 
 * Uso: node scripts/corregir-caracteres-clientes.js [--dry-run] [--limit N]
 */

const crm = require('../config/mysql-crm');

// Configuración
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--simular');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : null;

// Mapeo de caracteres mal codificados a caracteres correctos
// Estos son patrones comunes cuando UTF-8 se interpreta como otra codificación
// IMPORTANTE: Los patrones específicos deben ir ANTES que los generales
const correcciones = [
  // Patrones específicos comunes (DEBEN IR PRIMERO)
  { mal: /ESPA├æA/gi, bien: 'ESPAÑA' },
  { mal: /Espa├æa/gi, bien: 'España' },
  { mal: /espa├æa/gi, bien: 'españa' },
  // Caracteres españoles comunes (después de los patrones específicos)
  { mal: /├æ/g, bien: 'ñ' },
  { mal: /├Ñ/g, bien: 'Ñ' },
  { mal: /├│/g, bien: 'ó' },
  { mal: /├Ó/g, bien: 'Ó' },
  { mal: /├í/g, bien: 'í' },
  { mal: /├Í/g, bien: 'Í' },
  { mal: /├®/g, bien: 'é' },
  { mal: /├É/g, bien: 'É' },
  { mal: /├ü/g, bien: 'ü' },
  { mal: /├Ü/g, bien: 'Ü' },
  { mal: /├á/g, bien: 'á' },
  { mal: /├Á/g, bien: 'Á' },
  { mal: /├ú/g, bien: 'ú' },
  { mal: /├Ú/g, bien: 'Ú' },
  // Otros caracteres especiales mal codificados
  { mal: /â€™/g, bien: "'" },  // Apóstrofe mal codificado
  { mal: /â€œ/g, bien: '"' },  // Comilla izquierda mal codificada
  { mal: /â€/g, bien: '"' },   // Comilla derecha mal codificada
  { mal: /â€"/g, bien: '—' },  // Em dash mal codificado
  { mal: /â€"/g, bien: '–' },  // En dash mal codificado
  { mal: /â€¦/g, bien: '…' },  // Puntos suspensivos mal codificados
];

// Lista de campos de texto en la tabla Clientes que necesitan corrección
const camposTexto = [
  'DNI_CIF',
  'Nombre_Razon_Social',
  'Nombre_Cial',
  'NumeroFarmacia',
  'Direccion',
  'Poblacion',
  'CodigoPostal',
  'Movil',
  'Email',
  'TipoCliente',
  'CodPais',
  'Pais',
  'Idioma',
  'Moneda',
  'NomContacto',
  'Tarifa',
  'Banco',
  'Swift',
  'IBAN'
];

/**
 * Corrige caracteres mal codificados en un texto
 * @param {string} texto - Texto a corregir
 * @returns {string} - Texto corregido
 */
function corregirCaracteres(texto) {
  if (!texto || typeof texto !== 'string') {
    return texto;
  }

  let textoCorregido = texto;

  // Aplicar todas las correcciones en orden
  for (const correccion of correcciones) {
    textoCorregido = textoCorregido.replace(correccion.mal, correccion.bien);
  }

  return textoCorregido;
}

/**
 * Verifica si un registro necesita corrección
 * @param {Object} cliente - Registro del cliente
 * @returns {Object|null} - Objeto con los campos a actualizar o null si no hay cambios
 */
function verificarCorrecciones(cliente) {
  const actualizaciones = {};
  let tieneCambios = false;

  for (const campo of camposTexto) {
    const valorOriginal = cliente[campo];
    if (valorOriginal) {
      const valorCorregido = corregirCaracteres(valorOriginal);
      if (valorCorregido !== valorOriginal) {
        actualizaciones[campo] = valorCorregido;
        tieneCambios = true;
      }
    }
  }

  return tieneCambios ? actualizaciones : null;
}

/**
 * Función principal
 */
async function corregirCaracteresClientes() {
  try {
    await crm.connect();

    console.log('🔍 Buscando clientes con caracteres mal codificados...\n');

    // Obtener todos los clientes
    let query = 'SELECT * FROM Clientes';
    if (LIMIT) {
      query += ` LIMIT ${LIMIT}`;
    }
    
    const clientes = await crm.query(query);
    console.log(`📊 Total de clientes a revisar: ${clientes.length}\n`);

    let totalCorregidos = 0;
    let totalActualizados = 0;
    const cambios = [];

    // Procesar cada cliente
    for (const cliente of clientes) {
      const actualizaciones = verificarCorrecciones(cliente);
      
      if (actualizaciones) {
        totalCorregidos++;
        cambios.push({
          id: cliente.id,
          nombre: cliente.Nombre_Razon_Social,
          cambios: actualizaciones
        });

        if (!DRY_RUN) {
          // Construir la consulta UPDATE
          const camposUpdate = Object.keys(actualizaciones).map(campo => `${campo} = ?`).join(', ');
          const valores = Object.values(actualizaciones);
          valores.push(cliente.id);

          const updateQuery = `UPDATE Clientes SET ${camposUpdate} WHERE id = ?`;
          await crm.query(updateQuery, valores);
          totalActualizados++;
        }
      }
    }

    // Mostrar resumen
    console.log('\n📊 RESUMEN DE CORRECCIONES\n');
    console.log(`   Total de clientes revisados: ${clientes.length}`);
    console.log(`   Clientes con caracteres a corregir: ${totalCorregidos}`);
    
    if (DRY_RUN) {
      console.log(`   ⚠️  MODO SIMULACIÓN - No se realizaron cambios\n`);
    } else {
      console.log(`   ✅ Clientes actualizados: ${totalActualizados}\n`);
    }

    // Mostrar algunos ejemplos de cambios
    if (cambios.length > 0) {
      console.log('📝 EJEMPLOS DE CAMBIOS:\n');
      const ejemplos = cambios.slice(0, 10);
      ejemplos.forEach((cambio, index) => {
        console.log(`   ${index + 1}. Cliente ID ${cambio.id}: ${cambio.nombre}`);
        Object.entries(cambio.cambios).forEach(([campo, nuevoValor]) => {
          const valorOriginal = clientes.find(c => c.id === cambio.id)[campo];
          console.log(`      ${campo}:`);
          console.log(`         Antes: ${valorOriginal}`);
          console.log(`         Después: ${nuevoValor}`);
        });
        console.log('');
      });

      if (cambios.length > 10) {
        console.log(`   ... y ${cambios.length - 10} cambios más\n`);
      }
    } else {
      console.log('   ✅ No se encontraron caracteres mal codificados\n');
    }

    // Buscar específicamente el patrón mencionado por el usuario
    console.log('🔍 Búsqueda específica de "ESPA├æA":\n');
    const clientesConEspana = await crm.query(
      "SELECT id, Nombre_Razon_Social, Pais, Poblacion, Direccion FROM Clientes WHERE Pais LIKE '%├%' OR Poblacion LIKE '%├%' OR Direccion LIKE '%├%' OR Nombre_Razon_Social LIKE '%├%' LIMIT 20"
    );

    if (clientesConEspana.length > 0) {
      console.log(`   ⚠️  Encontrados ${clientesConEspana.length} clientes con caracteres "├" (posible codificación incorrecta):\n`);
      clientesConEspana.forEach(cliente => {
        console.log(`   ID ${cliente.id}: ${cliente.Nombre_Razon_Social}`);
        if (cliente.Pais && cliente.Pais.includes('├')) {
          console.log(`      País: ${cliente.Pais}`);
        }
        if (cliente.Poblacion && cliente.Poblacion.includes('├')) {
          console.log(`      Población: ${cliente.Poblacion}`);
        }
        if (cliente.Direccion && cliente.Direccion.includes('├')) {
          console.log(`      Dirección: ${cliente.Direccion}`);
        }
        console.log('');
      });
    } else {
      console.log('   ✅ No se encontraron más clientes con caracteres "├"\n');
    }

    if (DRY_RUN) {
      console.log('\n💡 Para aplicar los cambios, ejecuta el script sin --dry-run\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await crm.disconnect();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  corregirCaracteresClientes();
}

module.exports = { corregirCaracteresClientes, corregirCaracteres };
