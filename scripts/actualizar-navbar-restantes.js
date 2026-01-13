const fs = require('fs');
const path = require('path');

// Lista de archivos que necesitan ser actualizados
const archivos = [
    'views/dashboard/index.ejs',
    'views/dashboard/ajustes-webhook-n8n.ejs',
    'views/dashboard/ajustes-prestashop.ejs',
    'views/dashboard/ajustes-api-keys.ejs',
    'views/dashboard/ajustes-rentabilidad-pedidos.ejs',
    'views/dashboard/ajustes-rentabilidad-pedido-detalle.ejs',
    'views/dashboard/ajustes-rentabilidad-comerciales.ejs',
    'views/dashboard/pedido-factura.ejs',
    'views/dashboard/pedido-documento.ejs'
];

archivos.forEach(archivo => {
    const rutaCompleta = path.join(__dirname, '..', archivo);
    
    if (!fs.existsSync(rutaCompleta)) {
        console.log(`⚠️  Archivo no encontrado: ${archivo}`);
        return;
    }
    
    let contenido = fs.readFileSync(rutaCompleta, 'utf8');
    let modificado = false;
    
    // Verificar si ya tiene el navbar
    if (contenido.includes('include(\'../partials/navbar-dashboard\')')) {
        console.log(`✅ ${archivo} ya tiene el navbar`);
        return;
    }
    
    // Buscar el tag </head> y añadir el include del navbar-styles antes
    if (contenido.includes('</head>') && !contenido.includes('navbar-styles')) {
        contenido = contenido.replace('</head>', '    <%- include(\'../partials/navbar-styles\') %></head>');
        modificado = true;
    }
    
    // Buscar el tag <body> y añadir el include del navbar-dashboard después
    if (contenido.includes('<body>') && !contenido.includes('navbar-dashboard')) {
        contenido = contenido.replace('<body>', '<body>\n    <%- include(\'../partials/navbar-dashboard\') %>');
        modificado = true;
    }
    
    // Si no se encontró <body>, buscar patrones alternativos
    if (!modificado && contenido.includes('<!DOCTYPE')) {
        // Buscar después de </head>
        const matchHead = contenido.match(/<\/head>\s*<body>/);
        if (matchHead) {
            contenido = contenido.replace('</head>', '    <%- include(\'../partials/navbar-styles\') %></head>');
            contenido = contenido.replace('<body>', '<body>\n    <%- include(\'../partials/navbar-dashboard\') %>');
            modificado = true;
        }
    }
    
    if (modificado) {
        fs.writeFileSync(rutaCompleta, contenido, 'utf8');
        console.log(`✅ Actualizado: ${archivo}`);
    } else {
        console.log(`⚠️  No se pudo actualizar: ${archivo} (estructura no reconocida)`);
    }
});

console.log('\n✅ Proceso completado');

