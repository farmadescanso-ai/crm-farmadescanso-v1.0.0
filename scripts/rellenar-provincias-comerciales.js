/**
 * Script para rellenar las provincias de todos los comerciales
 * basándose en su código postal
 */

const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

async function rellenarProvincias() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await crm.connect();
    
    console.log('📋 Obteniendo todos los comerciales...');
    const comerciales = await crm.getComerciales();
    console.log(`✅ Se encontraron ${comerciales.length} comerciales\n`);
    
    // Obtener provincias para la función
    const provincias = await crm.getProvincias('ES').catch(() => []);
    console.log(`✅ Se obtuvieron ${provincias.length} provincias\n`);
    
    let actualizados = 0;
    let sinCodigoPostal = 0;
    let sinProvinciaEncontrada = 0;
    let yaTienenProvincia = 0;
    
    for (const comercial of comerciales) {
      const comercialId = comercial.id || comercial.Id;
      const codigoPostal = comercial.CodigoPostal || comercial.codigoPostal || '';
      const provinciaActual = comercial.Id_Provincia || comercial.id_Provincia || null;
      
      if (!codigoPostal || codigoPostal.trim() === '') {
        console.log(`⚠️ Comercial #${comercialId} (${comercial.Nombre || comercial.nombre}): Sin código postal`);
        sinCodigoPostal++;
        continue;
      }
      
      // Si ya tiene provincia asignada, verificar si es correcta
      if (provinciaActual) {
        const provinciaCorrecta = obtenerProvinciaPorCodigoPostal(codigoPostal, provincias);
        if (provinciaCorrecta && parseInt(provinciaActual) === parseInt(provinciaCorrecta)) {
          console.log(`✓ Comercial #${comercialId} (${comercial.Nombre || comercial.nombre}): Ya tiene la provincia correcta (${provinciaActual})`);
          yaTienenProvincia++;
          continue;
        } else if (provinciaCorrecta) {
          console.log(`🔧 Comercial #${comercialId} (${comercial.Nombre || comercial.nombre}): Corrigiendo provincia ${provinciaActual} → ${provinciaCorrecta}`);
        }
      }
      
      // Obtener provincia por código postal
      const provinciaId = obtenerProvinciaPorCodigoPostal(codigoPostal, provincias);
      
      if (provinciaId) {
        // Buscar nombre de la provincia para el log
        const provincia = provincias.find(p => p.id === provinciaId);
        const nombreProvincia = provincia ? (provincia.Nombre || '') : '';
        
        console.log(`🔧 Comercial #${comercialId} (${comercial.Nombre || comercial.nombre}): CP ${codigoPostal} → Provincia ${provinciaId} (${nombreProvincia})`);
        
        // Actualizar comercial
        await crm.updateComercial(comercialId, { Id_Provincia: provinciaId });
        actualizados++;
      } else {
        console.log(`⚠️ Comercial #${comercialId} (${comercial.Nombre || comercial.nombre}): No se pudo determinar provincia para CP ${codigoPostal}`);
        sinProvinciaEncontrada++;
      }
    }
    
    console.log('\n✅ Proceso completado:');
    console.log(`   - Comerciales actualizados: ${actualizados}`);
    console.log(`   - Ya tenían provincia correcta: ${yaTienenProvincia}`);
    console.log(`   - Sin código postal: ${sinCodigoPostal}`);
    console.log(`   - Sin provincia encontrada: ${sinProvinciaEncontrada}`);
    console.log(`   - Total procesados: ${comerciales.length}`);
    
    await crm.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

rellenarProvincias();
