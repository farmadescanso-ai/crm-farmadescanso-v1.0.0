// Script para actualizar todas las vistas del dashboard con el navbar unificado
const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '../views/dashboard');
const partialsDir = path.join(__dirname, '../views/partials');

// Patrón para encontrar el navbar completo
const navbarPattern = /<nav class="navbar[\s\S]*?<\/nav>/g;

// Patrón para encontrar "Mi Perfil" en el sidebar
const sidebarPerfilPattern = /<li[^>]*>[\s\S]*?<a[^>]*href="[^"]*perfil[^"]*"[^>]*>[\s\S]*?Mi Perfil[\s\S]*?<\/a>[\s\S]*?<\/li>/gi;

function actualizarVista(archivo) {
    try {
        let contenido = fs.readFileSync(archivo, 'utf8');
        let modificado = false;

        // 1. Reemplazar navbar si existe (pero mantener estilos personalizados si los hay)
        if (contenido.includes('<nav class="navbar')) {
            // Buscar si tiene estilos personalizados antes del navbar
            const estilosMatch = contenido.match(/<style>[\s\S]*?<\/style>/);
            const tieneEstilos = estilosMatch && estilosMatch[0].includes('navbar') === false;
            
            // Reemplazar el navbar
            contenido = contenido.replace(/<nav class="navbar[\s\S]*?<\/nav>/s, '<%- include(\'../partials/navbar-dashboard\') %>');
            
            // Agregar estilos del navbar si no están
            if (!contenido.includes('navbar-styles')) {
                const headEnd = contenido.indexOf('</head>');
                if (headEnd !== -1) {
                    contenido = contenido.slice(0, headEnd) + 
                        '\n    <%- include(\'../partials/navbar-styles\') %>' + 
                        contenido.slice(headEnd);
                }
            }
            
            modificado = true;
        }

        // 2. Eliminar "Mi Perfil" del sidebar
        if (sidebarPerfilPattern.test(contenido)) {
            contenido = contenido.replace(sidebarPerfilPattern, '');
            modificado = true;
        }

        // También buscar patrones más simples
        const patronesSimples = [
            /<li[^>]*>[\s\S]*?href="[^"]*\/dashboard\/perfil[^"]*"[\s\S]*?Mi Perfil[\s\S]*?<\/li>/gi,
            /<a[^>]*href="[^"]*\/dashboard\/perfil[^"]*"[^>]*>[\s\S]*?Mi Perfil[\s\S]*?<\/a>/gi
        ];

        patronesSimples.forEach(patron => {
            if (patron.test(contenido)) {
                contenido = contenido.replace(patron, '');
                modificado = true;
            }
        });

        if (modificado) {
            fs.writeFileSync(archivo, contenido, 'utf8');
            console.log(`✅ Actualizado: ${path.basename(archivo)}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ Error procesando ${archivo}:`, error.message);
        return false;
    }
}

// Función principal
function main() {
    console.log('🔄 Actualizando vistas del dashboard...\n');
    
    const archivos = fs.readdirSync(viewsDir)
        .filter(archivo => archivo.endsWith('.ejs'))
        .map(archivo => path.join(viewsDir, archivo));

    let actualizados = 0;
    archivos.forEach(archivo => {
        if (actualizarVista(archivo)) {
            actualizados++;
        }
    });

    console.log(`\n✅ Proceso completado: ${actualizados} archivos actualizados de ${archivos.length} totales`);
}

main();

