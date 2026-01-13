/**
 * Script para corregir todos los nombres de países en la tabla paises
 * Asegura que todos los nombres estén en UTF-8 correcto
 */

const crm = require('../config/mysql-crm');
const { normalizeUTF8 } = require('../utils/normalize-utf8');

async function corregirPaises() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await crm.connect();
    
    console.log('📋 Obteniendo todos los países...');
    const paises = await crm.getPaises();
    console.log(`✅ Se encontraron ${paises.length} países`);
    
    let corregidos = 0;
    let sinCambios = 0;
    
    for (const pais of paises) {
      const nombreOriginal = pais.Nombre_pais || '';
      // Normalizar solo la codificación UTF-8, sin cambiar mayúsculas/minúsculas
      let nombreNormalizado = normalizeUTF8(nombreOriginal);
      
      // Si la normalización cambió mayúsculas incorrectamente, restaurar las mayúsculas originales
      // pero mantener las correcciones de codificación UTF-8
      if (nombreOriginal !== nombreNormalizado) {
        // Verificar si solo cambió la codificación o también las mayúsculas
        const soloCodificacion = nombreOriginal.replace(/[Ã├]/g, '') === nombreNormalizado.replace(/[Ã├]/g, '');
        
        if (!soloCodificacion) {
          // Si cambió más que solo la codificación, revisar si debemos mantener las mayúsculas originales
          // Para nombres de países, generalmente queremos mantener las mayúsculas originales
          // Solo corregir la codificación UTF-8
          nombreNormalizado = nombreOriginal
            .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í').replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú')
            .replace(/Ã±/g, 'ñ').replace(/Ã¼/g, 'ü')
            .replace(/Ã/g, 'Á').replace(/Ã‰/g, 'É').replace(/Ã/g, 'Í').replace(/Ã"/g, 'Ó').replace(/Ãš/g, 'Ú')
            .replace(/Ã\\'/g, 'Ñ').replace(/Ãœ/g, 'Ü')
            .replace(/├ü/g, 'á').replace(/├®/g, 'é').replace(/├¡/g, 'í').replace(/├│/g, 'ó').replace(/├║/g, 'ú')
            .replace(/├ë/g, 'É').replace(/├ì/g, 'Í').replace(/├ô/g, 'Ó').replace(/├Ü/g, 'Ú')
            .replace(/├æ/g, 'ñ').replace(/├╝/g, 'ü');
        }
        
        if (nombreOriginal !== nombreNormalizado) {
          console.log(`🔧 Corrigiendo: "${nombreOriginal}" → "${nombreNormalizado}"`);
          await crm.query(
            'UPDATE paises SET Nombre_pais = ? WHERE id = ?',
            [nombreNormalizado, pais.id]
          );
          corregidos++;
        } else {
          sinCambios++;
        }
      } else {
        sinCambios++;
      }
    }
    
    console.log('\n✅ Corrección completada:');
    console.log(`   - Países corregidos: ${corregidos}`);
    console.log(`   - Países sin cambios: ${sinCambios}`);
    console.log(`   - Total: ${paises.length}`);
    
    await crm.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

corregirPaises();
