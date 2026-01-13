// Script para actualizar las vistas de comisiones con el navbar unificado
const fs = require('fs');
const path = require('path');

const comisionesDir = path.join(__dirname, '../views/dashboard/comisiones');
const archivos = fs.readdirSync(comisionesDir).filter(f => f.endsWith('.ejs'));

archivos.forEach(archivo => {
    const rutaCompleta = path.join(comisionesDir, archivo);
    let contenido = fs.readFileSync(rutaCompleta, 'utf8');
    let modificado = false;

    // Reemplazar navbar
    if (contenido.includes('<nav class="navbar')) {
        contenido = contenido.replace(/<nav class="navbar[\s\S]*?<\/nav>/s, '<%- include(\'../../partials/navbar-dashboard\') %>');
        
        // Agregar estilos si no están
        if (!contenido.includes('navbar-styles')) {
            contenido = contenido.replace('</head>', '    <%- include(\'../../partials/navbar-styles\') %>\n</head>');
        }
        
        modificado = true;
    }

    // Eliminar "Mi Perfil" del dropdown del navbar
    contenido = contenido.replace(/<li><a class="dropdown-item" href="[^"]*\/dashboard\/perfil[^"]*">[\s\S]*?Mi Perfil[\s\S]*?<\/a><\/li>/gi, '');
    contenido = contenido.replace(/<li[^>]*>[\s\S]*?href="[^"]*\/dashboard\/perfil[^"]*"[^>]*>[\s\S]*?Mi Perfil[\s\S]*?<\/a>[\s\S]*?<\/li>/gi, '');
    
    if (modificado || contenido.includes('Mi Perfil')) {
        fs.writeFileSync(rutaCompleta, contenido, 'utf8');
        console.log(`✅ Actualizado: ${archivo}`);
    }
});

console.log(`\n✅ Proceso completado: ${archivos.length} archivos procesados`);

