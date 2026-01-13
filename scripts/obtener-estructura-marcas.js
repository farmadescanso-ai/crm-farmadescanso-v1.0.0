const crm = require('../config/mysql-crm');

async function obtenerEstructuraMarcas() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await crm.connect();
    console.log('✅ Conectado a la base de datos');
    
    let estructura = null;
    let marcas = null;
    let consultaUsada = '';
    
    // Intentar obtener estructura de la tabla
    console.log('🔍 Obteniendo estructura de la tabla...');
    try {
      estructura = await crm.query('DESCRIBE `Marcas`');
      consultaUsada = 'DESCRIBE `Marcas`';
      console.log('✅ Estructura obtenida con `Marcas`');
    } catch (e1) {
      try {
        estructura = await crm.query('DESCRIBE `marcas`');
        consultaUsada = 'DESCRIBE `marcas`';
        console.log('✅ Estructura obtenida con `marcas`');
      } catch (e2) {
        estructura = await crm.query('DESCRIBE marcas');
        consultaUsada = 'DESCRIBE marcas';
        console.log('✅ Estructura obtenida sin backticks');
      }
    }
    
    // Intentar obtener datos de la tabla
    console.log('🔍 Obteniendo datos de la tabla...');
    try {
      marcas = await crm.query('SELECT * FROM `Marcas` ORDER BY Nombre ASC');
      consultaUsada = 'SELECT * FROM `Marcas`';
      console.log('✅ Datos obtenidos con `Marcas`');
    } catch (e1) {
      try {
        marcas = await crm.query('SELECT * FROM `marcas` ORDER BY Nombre ASC');
        consultaUsada = 'SELECT * FROM `marcas`';
        console.log('✅ Datos obtenidos con `marcas`');
      } catch (e2) {
        marcas = await crm.query('SELECT * FROM marcas ORDER BY Nombre ASC');
        consultaUsada = 'SELECT * FROM marcas';
        console.log('✅ Datos obtenidos sin backticks');
      }
    }
    
    // Generar documento Markdown
    const fs = require('fs');
    const path = require('path');
    
    let contenido = `# Estructura y Datos de la Tabla Marcas\n\n`;
    contenido += `**Fecha de consulta:** ${new Date().toLocaleString('es-ES')}\n\n`;
    contenido += `**Consulta usada:** \`${consultaUsada}\`\n\n`;
    
    // Estructura de la tabla
    contenido += `## Estructura de la Tabla\n\n`;
    if (estructura && Array.isArray(estructura) && estructura.length > 0) {
      contenido += `| Campo | Tipo | Null | Key | Default | Extra |\n`;
      contenido += `|-------|------|------|-----|---------|-------|\n`;
      estructura.forEach(col => {
        contenido += `| ${col.Field || col.field || '-'} | ${col.Type || col.type || '-'} | ${col.Null || col.null || '-'} | ${col.Key || col.key || '-'} | ${col.Default !== null ? col.Default : 'NULL'} | ${col.Extra || col.extra || '-'} |\n`;
      });
    } else {
      contenido += `⚠️ No se pudo obtener la estructura de la tabla.\n`;
    }
    
    contenido += `\n## Datos Actuales\n\n`;
    if (marcas && Array.isArray(marcas) && marcas.length > 0) {
      contenido += `**Total de marcas:** ${marcas.length}\n\n`;
      
      // Obtener todas las columnas únicas de todos los registros
      const todasLasColumnas = new Set();
      marcas.forEach(marca => {
        Object.keys(marca).forEach(key => todasLasColumnas.add(key));
      });
      
      const columnas = Array.from(todasLasColumnas);
      
      // Crear tabla con los datos
      contenido += `| ${columnas.join(' | ')} |\n`;
      contenido += `|${columnas.map(() => '---').join('|')}|\n`;
      
      marcas.forEach(marca => {
        const fila = columnas.map(col => {
          const valor = marca[col];
          if (valor === null || valor === undefined) return '-';
          if (typeof valor === 'object') return JSON.stringify(valor);
          return String(valor);
        });
        contenido += `| ${fila.join(' | ')} |\n`;
      });
      
      // Detalles adicionales
      contenido += `\n## Detalles por Marca\n\n`;
      marcas.forEach((marca, index) => {
        contenido += `### Marca ${index + 1}\n\n`;
        Object.keys(marca).forEach(key => {
          const valor = marca[key];
          contenido += `- **${key}:** ${valor !== null && valor !== undefined ? (typeof valor === 'object' ? JSON.stringify(valor) : String(valor)) : 'NULL'}\n`;
        });
        contenido += `\n`;
      });
    } else {
      contenido += `⚠️ No se encontraron marcas en la tabla o la tabla está vacía.\n\n`;
      contenido += `**Resultado de la consulta:**\n`;
      contenido += `\`\`\`json\n${JSON.stringify(marcas, null, 2)}\n\`\`\`\n`;
    }
    
    // Información adicional
    contenido += `\n## Información Adicional\n\n`;
    contenido += `- **Tipo de resultado:** ${Array.isArray(marcas) ? 'Array' : typeof marcas}\n`;
    contenido += `- **Cantidad de registros:** ${Array.isArray(marcas) ? marcas.length : 'N/A'}\n`;
    
    // Guardar archivo
    const rutaArchivo = path.join(__dirname, '..', 'documentacion', 'estructura-tabla-marcas.md');
    fs.writeFileSync(rutaArchivo, contenido, 'utf8');
    
    console.log(`\n✅ Documento generado exitosamente:`);
    console.log(`📄 ${rutaArchivo}`);
    console.log(`\n📊 Resumen:`);
    console.log(`   - Estructura: ${estructura && Array.isArray(estructura) ? estructura.length + ' columnas' : 'No disponible'}`);
    console.log(`   - Marcas encontradas: ${Array.isArray(marcas) ? marcas.length : 0}`);
    
    if (Array.isArray(marcas) && marcas.length > 0) {
      console.log(`\n📋 Marcas encontradas:`);
      marcas.forEach((marca, index) => {
        const nombre = marca.Nombre || marca.nombre || marca.NOMBRE || 'Sin nombre';
        const id = marca.id || marca.Id || marca.ID || 'Sin ID';
        console.log(`   ${index + 1}. ID: ${id}, Nombre: ${nombre}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

obtenerEstructuraMarcas();
