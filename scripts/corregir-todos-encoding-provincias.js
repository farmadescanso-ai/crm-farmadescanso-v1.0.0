/**
 * Script para corregir TODOS los problemas de codificación UTF-8
 * en la tabla Provincias (nombres y país)
 * 
 * Uso: node scripts/corregir-todos-encoding-provincias.js
 */

const crm = require('../config/mysql-crm');

// Mapeo completo de nombres incorrectos a correctos
const correccionesNombres = {
  '├ülava': 'Álava',
  'Almer├¡a': 'Almería',
  '├üvila': 'Ávila',
  'C├íceres': 'Cáceres',
  'C├ídaz': 'Cádiz',
  'Castell├│n': 'Castellón',
  'C├│rdoba': 'Córdoba',
  'La Coru├▒a': 'La Coruña',
  'Guip├║zcoa': 'Guipúzcoa',
  'Ja├®n': 'Jaén',
  'Le├│n': 'León',
  'L├®rida': 'Lérida',
  'M├ílaga': 'Málaga'
};

// Mapeo de caracteres mal codificados individuales
const correccionesCaracteres = {
  '├ü': 'Á',
  '├®': 'é',
  '├¡': 'í',
  '├│': 'ó',
  '├║': 'ú',
  '├▒': 'ñ',
  '├®': 'É',
  '├í': 'á'
};

// Función para corregir problemas de codificación UTF-8
function corregirEncoding(texto) {
  if (!texto) return texto;
  
  let corregido = texto;
  
  // Primero aplicar correcciones específicas de nombres completos
  for (const [incorrecto, correcto] of Object.entries(correccionesNombres)) {
    if (corregido.includes(incorrecto)) {
      corregido = corregido.replace(new RegExp(incorrecto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correcto);
    }
  }
  
  // Luego aplicar correcciones de caracteres individuales
  for (const [incorrecto, correcto] of Object.entries(correccionesCaracteres)) {
    corregido = corregido.replace(new RegExp(incorrecto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correcto);
  }
  
  // Corrección específica para España
  corregido = corregido.replace(/Espa├▒a/g, 'España');
  
  return corregido;
}

async function corregirTodosEncodingProvincias() {
  try {
    console.log('🚀 Iniciando corrección completa de codificación UTF-8 en Provincias\n');
    
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Obtener una conexión directa para las transacciones
    const connection = await crm.pool.getConnection();
    
    try {
      // Iniciar transacción
      console.log('🔄 Iniciando transacción...');
      await connection.query('START TRANSACTION');
      
      // Obtener todas las provincias para ver qué necesita corrección
      console.log('🔍 Analizando provincias...');
      const [provincias] = await connection.query('SELECT * FROM `provincias` ORDER BY `id`');
      
      console.log(`   Total de provincias: ${provincias.length}\n`);
      
      let provinciasCorregidas = 0;
      let nombresCorregidos = 0;
      let paisesCorregidos = 0;
      
      // Aplicar correcciones a cada provincia
      for (const provincia of provincias) {
        const nombreOriginal = provincia.Nombre;
        const paisOriginal = provincia.Pais;
        const nombreCorregido = corregirEncoding(nombreOriginal);
        const paisCorregido = corregirEncoding(paisOriginal);
        const necesitaCorreccion = nombreOriginal !== nombreCorregido || paisOriginal !== paisCorregido;
        
        // Si necesita corrección, actualizar
        if (necesitaCorreccion) {
          await connection.query(
            'UPDATE `provincias` SET `Nombre` = ?, `Pais` = ? WHERE `id` = ?',
            [nombreCorregido, paisCorregido, provincia.id]
          );
          
          provinciasCorregidas++;
          if (nombreOriginal !== nombreCorregido) nombresCorregidos++;
          if (paisOriginal !== paisCorregido) paisesCorregidos++;
          
          console.log(`   ✅ ID ${provincia.id}: "${nombreOriginal}" -> "${nombreCorregido}"`);
          if (paisOriginal !== paisCorregido) {
            console.log(`      País: "${paisOriginal}" -> "${paisCorregido}"`);
          }
        }
      }
      
      console.log(`\n📊 Resumen:`);
      console.log(`   Provincias corregidas: ${provinciasCorregidas}`);
      console.log(`   Nombres corregidos: ${nombresCorregidos}`);
      console.log(`   Países corregidos: ${paisesCorregidos}\n`);
      
      // Confirmar transacción
      await connection.query('COMMIT');
      console.log('✅ Transacción confirmada\n');
      
      // Verificar que los cambios se aplicaron correctamente
      console.log('🔍 Verificando cambios...');
      
      const [provinciasVerificadas] = await connection.query('SELECT * FROM `provincias` ORDER BY `id`');
      
      let problemasRestantes = 0;
      for (const provincia of provinciasVerificadas) {
        const nombreCorregido = corregirEncoding(provincia.Nombre);
        const paisCorregido = corregirEncoding(provincia.Pais);
        if (provincia.Nombre !== nombreCorregido || provincia.Pais !== paisCorregido) {
          problemasRestantes++;
          console.log(`   ⚠️  Problema restante en ID ${provincia.id}: "${provincia.Nombre}", País: "${provincia.Pais}"`);
        }
      }
      
      if (problemasRestantes === 0) {
        console.log('   ✅ No quedan problemas de codificación');
      } else {
        console.log(`   ⚠️  ADVERTENCIA: Quedan ${problemasRestantes} problemas de codificación`);
      }
      
      // Mostrar algunas provincias corregidas como ejemplo
      console.log('\n📋 Ejemplos de provincias corregidas:');
      const [ejemplos] = await connection.query(
        "SELECT * FROM `provincias` WHERE `Nombre` LIKE '%á%' OR `Nombre` LIKE '%é%' OR `Nombre` LIKE '%í%' OR `Nombre` LIKE '%ó%' OR `Nombre` LIKE '%ú%' OR `Nombre` LIKE '%ñ%' LIMIT 10"
      );
      ejemplos.forEach(p => {
        console.log(`   - ${p.Nombre} (${p.Pais})`);
      });
      
      // Liberar conexión
      connection.release();
      
      console.log('\n✅ Corrección completada exitosamente');
      
    } catch (error) {
      // Revertir transacción en caso de error
      console.error('❌ Error durante la corrección:', error.message);
      await connection.query('ROLLBACK');
      console.log('🔄 Transacción revertida');
      connection.release();
      throw error;
    }
    
    // Desconectar
    await crm.disconnect();
    console.log('🔌 Desconectado de MySQL');
    
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar el script
corregirTodosEncodingProvincias();
