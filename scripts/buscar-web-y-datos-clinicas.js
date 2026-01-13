/**
 * Script para buscar páginas web de clínicas y extraer información de contacto
 * Procesa todas las clínicas en lotes
 */

const fs = require('fs');
const path = require('path');
const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

const archivoDatos = path.join(__dirname, '..', 'datos-clinicas-preparados.json');
const archivoResultados = path.join(__dirname, '..', 'resultados-busqueda-clinicas.json');

// Configuración
const TAMANO_LOTE = 10; // Procesar de 10 en 10 para no sobrecargar
const DELAY_ENTRE_BUSQUEDAS = 2000; // 2 segundos entre búsquedas

let provinciasDB = [];

/**
 * Limpia un teléfono
 */
function limpiarTelefono(tel) {
  if (!tel) return null;
  return String(tel).replace(/[^\d]/g, '').substring(0, 13);
}

/**
 * Convierte a Title Case
 */
function toTitleCase(texto) {
  if (!texto) return '';
  const palabras = String(texto).trim().split(/\s+/);
  return palabras.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

/**
 * Extrae información de texto de resultados de búsqueda
 */
function extraerInfoDeTexto(texto, nombreClinica) {
  const info = {
    direccion: null,
    telefono: null,
    email: null,
    codigoPostal: null,
    poblacion: null,
    web: null
  };
  
  if (!texto) return info;
  
  const textoLower = texto.toLowerCase();
  
  // Buscar URL/web
  const urlMatch = texto.match(/(https?:\/\/[^\s\)]+)/i);
  if (urlMatch) {
    info.web = urlMatch[0];
  }
  
  // Buscar código postal (5 dígitos españoles)
  const cpMatch = texto.match(/\b(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}\b/);
  if (cpMatch) {
    info.codigoPostal = cpMatch[0];
  }
  
  // Buscar teléfono (formato español)
  const telMatches = texto.match(/(\+?34)?[-\s]?[9][0-9]{2}[-\s]?[0-9]{3}[-\s]?[0-9]{3}/g);
  if (telMatches && telMatches.length > 0) {
    info.telefono = limpiarTelefono(telMatches[0]);
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
  const direcciones = texto.match(/(Calle|Avenida|Av\.|Plaza|Paseo|Camino|Carretera)[^,\.\n]{10,80}/gi);
  if (direcciones && direcciones.length > 0) {
    info.direccion = direcciones[0].trim();
  }
  
  // Buscar población
  const poblaciones = ['Murcia', 'Alicante', 'Cartagena', 'Lorca', 'Elche', 'Torrevieja', 
                       'Benidorm', 'Alcoy', 'Molina de Segura', 'Cieza', 'Yecla', 'Caravaca',
                       'San Javier', 'San Pedro del Pinatar', 'Fuente Álamo', 'Mazarrón',
                       'Águilas', 'Totana', 'Jumilla', 'Alhama de Murcia', 'Alcantarilla'];
  for (const pob of poblaciones) {
    if (textoLower.includes(pob.toLowerCase())) {
      info.poblacion = pob;
      break;
    }
  }
  
  return info;
}

/**
 * Actualiza un cliente con información encontrada
 */
function actualizarClienteConInfo(cliente, info, provinciasDB) {
  if (info.direccion && !cliente.Direccion) {
    cliente.Direccion = toTitleCase(info.direccion);
  }
  
  if (info.telefono && !cliente.Movil) {
    cliente.Movil = info.telefono;
  }
  
  if (info.email && !cliente.Email) {
    cliente.Email = info.email;
  }
  
  if (info.codigoPostal && !cliente.CodigoPostal) {
    cliente.CodigoPostal = info.codigoPostal;
    
    // Asociar provincia por código postal
    const provinciaId = obtenerProvinciaPorCodigoPostal(cliente.CodigoPostal, provinciasDB);
    if (provinciaId) {
      cliente.Id_Provincia = provinciaId;
      const provincia = provinciasDB.find(p => p.id === provinciaId);
      if (provincia && !cliente.Pais) {
        cliente.Pais = provincia.Pais || 'España';
        cliente.CodPais = provincia.CodigoPais || 'ES';
      }
    }
  }
  
  if (info.poblacion && !cliente.Poblacion) {
    cliente.Poblacion = toTitleCase(info.poblacion);
  }
  
  return cliente;
}

/**
 * Función principal - Esta función necesita ser ejecutada con acceso a web_search
 */
async function procesarClinicas() {
  try {
    console.log('📖 Leyendo datos actuales...');
    const datos = JSON.parse(fs.readFileSync(archivoDatos, 'utf8'));
    
    console.log('📚 Cargando provincias...');
    await crm.connect();
    provinciasDB = await crm.getProvincias();
    
    console.log(`✅ ${datos.length} clínicas encontradas`);
    console.log(`✅ ${provinciasDB.length} provincias cargadas\n`);
    
    // Guardar estado de resultados
    let resultados = {
      procesadas: 0,
      actualizadas: 0,
      conWeb: 0,
      conDatos: 0,
      errores: []
    };
    
    // Cargar resultados anteriores si existen
    if (fs.existsSync(archivoResultados)) {
      try {
        const resultadosAnteriores = JSON.parse(fs.readFileSync(archivoResultados, 'utf8'));
        resultados = resultadosAnteriores;
        console.log(`📂 Cargados resultados anteriores: ${resultados.procesadas} clínicas procesadas\n`);
      } catch (e) {
        console.log('⚠️  No se pudieron cargar resultados anteriores\n');
      }
    }
    
    console.log('='.repeat(80));
    console.log('⚠️  NOTA IMPORTANTE:');
    console.log('='.repeat(80));
    console.log('Este script está diseñado para usar herramientas de búsqueda web.');
    console.log('Para procesar todas las clínicas, se necesita ejecutar este script');
    console.log('en un contexto que tenga acceso a web_search o herramientas similares.');
    console.log(`\nTotal de clínicas a procesar: ${datos.length}`);
    console.log(`Clínicas ya procesadas: ${resultados.procesadas}`);
    console.log(`Clínicas pendientes: ${datos.length - resultados.procesadas}`);
    console.log('='.repeat(80));
    
    // Preparar lista de clínicas a procesar (solo las que no tienen datos completos)
    const clinicasPendientes = datos.filter(c => 
      !c.Direccion || !c.Movil || !c.CodigoPostal || !c.Poblacion
    );
    
    console.log(`\n📋 Clínicas pendientes de información: ${clinicasPendientes.length}`);
    console.log(`\nLas primeras 20 clínicas a buscar:\n`);
    clinicasPendientes.slice(0, 20).forEach((c, i) => {
      console.log(`${(i + 1).toString().padStart(2, '0')}. ${c.Nombre_Razon_Social}`);
    });
    
    if (clinicasPendientes.length > 20) {
      console.log(`\n... y ${clinicasPendientes.length - 20} más`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('💡 INSTRUCCIONES:');
    console.log('='.repeat(80));
    console.log('Este script necesita ser ejecutado con acceso a herramientas de búsqueda web.');
    console.log('Para cada clínica, se debe buscar:');
    console.log('  - Página web de la clínica');
    console.log('  - Información de contacto (dirección, teléfono, email)');
    console.log('\nEl script actualizará automáticamente el JSON con la información encontrada.');
    console.log('='.repeat(80));
    
    // Guardar lista de clínicas pendientes
    const listaPendientes = path.join(__dirname, '..', 'clinicas-pendientes-busqueda.json');
    fs.writeFileSync(listaPendientes, JSON.stringify(clinicasPendientes, null, 2), 'utf8');
    console.log(`\n📄 Lista de clínicas pendientes guardada en: ${listaPendientes}`);
    
    return {
      total: datos.length,
      pendientes: clinicasPendientes.length,
      completas: datos.length - clinicasPendientes.length
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

if (require.main === module) {
  procesarClinicas()
    .then((res) => {
      console.log('\n✅ Preparación completada');
      console.log(`   Total: ${res.total}`);
      console.log(`   Completas: ${res.completas}`);
      console.log(`   Pendientes: ${res.pendientes}`);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { procesarClinicas, extraerInfoDeTexto, actualizarClienteConInfo };
