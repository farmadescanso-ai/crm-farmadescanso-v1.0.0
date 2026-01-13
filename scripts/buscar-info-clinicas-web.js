/**
 * Script para buscar información adicional de clínicas dentales usando búsquedas web
 * Busca en Google, LinkedIn y Axesor
 */

const fs = require('fs');
const path = require('path');

const archivoDatos = path.join(__dirname, '..', 'datos-clinicas-preparados.json');
const LIMITE_CLINICAS = process.argv.find(arg => arg.startsWith('--limit=')) 
  ? parseInt(process.argv.find(arg => arg.startsWith('--limit=')).split('=')[1]) 
  : 10; // Por defecto, solo las primeras 10 para prueba

/**
 * Extrae información de una búsqueda web
 * Esta función parsea los resultados de búsqueda para extraer datos relevantes
 */
function extraerInfoDeBusqueda(nombreClinica, resultados) {
  const info = {
    direccion: null,
    telefono: null,
    email: null,
    codigoPostal: null,
    poblacion: null,
    web: null
  };
  
  // Buscar patrones comunes en los resultados
  const textoCompleto = JSON.stringify(resultados).toLowerCase();
  
  // Patrón para teléfono (formato español: 9XX XXX XXX o 968 XXX XXX)
  const patronTelefono = /(\+?34)?[-\s]?[9][0-9]{2}[-\s]?[0-9]{3}[-\s]?[0-9]{3}/g;
  const telefonos = textoCompleto.match(patronTelefono);
  if (telefonos && telefonos.length > 0) {
    // Tomar el primero y limpiarlo
    info.telefono = telefonos[0].replace(/[^\d]/g, '').substring(0, 13);
  }
  
  // Patrón para email
  const patronEmail = /[\w\.-]+@[\w\.-]+\.\w+/g;
  const emails = textoCompleto.match(patronEmail);
  if (emails && emails.length > 0) {
    // Filtrar emails comunes de spam
    const emailValido = emails.find(e => 
      !e.includes('example.com') && 
      !e.includes('test.com') &&
      !e.includes('placeholder')
    );
    if (emailValido) {
      info.email = emailValido.toLowerCase();
    }
  }
  
  // Patrón para código postal español (5 dígitos)
  const patronCP = /\b(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}\b/;
  const cpMatch = textoCompleto.match(patronCP);
  if (cpMatch) {
    info.codigoPostal = cpMatch[0];
  }
  
  // Buscar población (Murcia, Alicante, etc.)
  const poblaciones = ['murcia', 'alicante', 'cartagena', 'lorca', 'elche', 'torrevieja', 
                       'benidorm', 'alcoy', 'molina de segura', 'cieza', 'yecla', 'caravaca'];
  for (const pob of poblaciones) {
    if (textoCompleto.includes(pob)) {
      info.poblacion = pob.charAt(0).toUpperCase() + pob.slice(1);
      break;
    }
  }
  
  return info;
}

/**
 * Función principal (requiere ser llamada desde un contexto con acceso a búsqueda web)
 */
async function buscarInfoClinicas() {
  try {
    console.log('📖 Leyendo datos actuales...');
    const datos = JSON.parse(fs.readFileSync(archivoDatos, 'utf8'));
    
    console.log(`\n🔍 Buscando información para las primeras ${LIMITE_CLINICAS} clínicas...`);
    console.log('⚠️  NOTA: Este script requiere acceso a herramientas de búsqueda web externas\n');
    
    const clinicasProcesar = datos.slice(0, LIMITE_CLINICAS);
    const datosActualizados = [...datos];
    
    console.log('Las siguientes clínicas se procesarán:');
    clinicasProcesar.forEach((c, i) => {
      console.log(`${i + 1}. ${c.Nombre_Razon_Social}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  IMPORTANTE:');
    console.log('Este script está preparado para usar herramientas de búsqueda web,');
    console.log('pero necesita ser ejecutado en un contexto que tenga acceso a ellas.');
    console.log('='.repeat(80));
    
    // Guardar lista de clínicas a buscar
    const listaBusqueda = path.join(__dirname, '..', 'lista-clinicas-buscar.json');
    fs.writeFileSync(listaBusqueda, JSON.stringify(clinicasProcesar, null, 2), 'utf8');
    console.log(`\n📄 Lista de clínicas a buscar guardada en: ${listaBusqueda}`);
    
    return {
      total: datos.length,
      procesar: clinicasProcesar.length,
      datos: datosActualizados
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  buscarInfoClinicas()
    .then(() => {
      console.log('\n✅ Preparación completada');
      console.log('   Para buscar información real, este script necesita ser integrado');
      console.log('   con herramientas de búsqueda web (web_search, etc.)');
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { buscarInfoClinicas, extraerInfoDeBusqueda };
