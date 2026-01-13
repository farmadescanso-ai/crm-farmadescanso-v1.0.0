/**
 * Script para buscar información adicional de clínicas y actualizar el JSON
 * NOTA: Este script debe ser ejecutado con acceso a herramientas de búsqueda web
 */

const fs = require('fs');
const path = require('path');

const archivoDatos = path.join(__dirname, '..', 'datos-clinicas-preparados.json');

/**
 * Extrae información de texto de búsqueda
 */
function extraerInfoDeTexto(texto, nombreClinica) {
  const info = {
    direccion: null,
    telefono: null,
    email: null,
    codigoPostal: null,
    poblacion: null
  };
  
  if (!texto) return info;
  
  const textoLower = texto.toLowerCase();
  
  // Buscar código postal (5 dígitos españoles)
  const cpMatch = texto.match(/\b(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}\b/);
  if (cpMatch) {
    info.codigoPostal = cpMatch[0];
  }
  
  // Buscar teléfono (formato español)
  const telMatches = texto.match(/(\+?34)?[-\s]?[9][0-9]{2}[-\s]?[0-9]{3}[-\s]?[0-9]{3}/g);
  if (telMatches && telMatches.length > 0) {
    // Limpiar y tomar el primero
    info.telefono = telMatches[0].replace(/[^\d]/g, '').substring(0, 13);
  }
  
  // Buscar email
  const emailMatch = texto.match(/[\w\.-]+@[\w\.-]+\.\w+/);
  if (emailMatch) {
    const email = emailMatch[0].toLowerCase();
    if (!email.includes('example.com') && !email.includes('test.com')) {
      info.email = email;
    }
  }
  
  // Buscar dirección (patrones comunes)
  // Buscar "Calle", "Avenida", "Plaza", etc.
  const direcciones = texto.match(/(Calle|Avenida|Av\.|Plaza|Paseo|Camino|Carretera)[^,\.\n]{5,50}/gi);
  if (direcciones && direcciones.length > 0) {
    // Intentar encontrar la dirección completa (incluye número)
    const dirCompleta = texto.match(/(Calle|Avenida|Av\.|Plaza|Paseo|Camino|Carretera)[^,\.\n]{10,80}/gi);
    if (dirCompleta && dirCompleta.length > 0) {
      info.direccion = dirCompleta[0].trim();
    }
  }
  
  // Buscar población
  const poblaciones = ['Murcia', 'Alicante', 'Cartagena', 'Lorca', 'Elche', 'Torrevieja', 
                       'Benidorm', 'Alcoy', 'Molina de Segura', 'Cieza', 'Yecla', 'Caravaca',
                       'San Javier', 'San Pedro del Pinatar', 'Fuente Álamo', 'Mazarrón',
                       'Águilas', 'Totana', 'Jumilla', 'Alhama de Murcia'];
  for (const pob of poblaciones) {
    if (textoLower.includes(pob.toLowerCase())) {
      info.poblacion = pob;
      break;
    }
  }
  
  return info;
}

/**
 * Limpia un teléfono
 */
function limpiarTelefono(tel) {
  if (!tel) return null;
  return String(tel).replace(/[^\d]/g, '').substring(0, 13);
}

/**
 * Función para procesar una clínica (requiere acceso a web_search)
 * Esta función muestra cómo se procesaría, pero necesita ser integrada
 */
async function procesarClinica(clinica, indice, total) {
  console.log(`\n[${indice + 1}/${total}] Buscando: ${clinica.Nombre_Razon_Social}`);
  
  // Construir búsqueda
  const busqueda = `${clinica.Nombre_Razon_Social} dirección teléfono Murcia Alicante`;
  
  console.log(`   Búsqueda: "${busqueda}"`);
  console.log(`   ⚠️  Requiere herramienta web_search - se necesita ejecutar en contexto apropiado`);
  
  return {
    ...clinica,
    // Los datos se actualizarían aquí con los resultados de la búsqueda
  };
}

/**
 * Función principal
 */
function mostrarInstrucciones() {
  console.log('='.repeat(80));
  console.log('📋 SCRIPT DE BÚSQUEDA DE INFORMACIÓN DE CLÍNICAS');
  console.log('='.repeat(80));
  console.log('\nEste script necesita ser ejecutado con acceso a herramientas de búsqueda web.');
  console.log('Las búsquedas se deben hacer usando web_search para cada clínica.');
  console.log('\nEstructura sugerida:');
  console.log('1. Leer el JSON de clínicas');
  console.log('2. Para cada clínica (o lote):');
  console.log('   - Buscar en Google: "[Nombre] dirección teléfono Murcia/Alicante"');
  console.log('   - Buscar en Axesor si es posible');
  console.log('   - Extraer: dirección, teléfono, email, CP, población');
  console.log('3. Actualizar el JSON con la información encontrada');
  console.log('\nPara 197 clínicas, esto tomará tiempo considerable.');
  console.log('Recomendación: Procesar en lotes de 10-20 clínicas.');
  console.log('='.repeat(80));
}

if (require.main === module) {
  mostrarInstrucciones();
  
  try {
    const datos = JSON.parse(fs.readFileSync(archivoDatos, 'utf8'));
    console.log(`\n📊 Total de clínicas en el archivo: ${datos.length}`);
    console.log(`📄 Archivo: ${archivoDatos}\n`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

module.exports = { extraerInfoDeTexto, limpiarTelefono, procesarClinica };
