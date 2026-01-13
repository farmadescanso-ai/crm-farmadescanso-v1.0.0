const fs = require('fs');
const path = require('path');

// Lista de archivos que necesitan ser actualizados
const archivos = [
    'views/dashboard/ajustes-prestashop.ejs',
    'views/dashboard/ajustes-api-keys.ejs',
    'views/dashboard/ajustes-rentabilidad-pedidos.ejs',
    'views/dashboard/ajustes-rentabilidad-pedido-detalle.ejs',
    'views/dashboard/ajustes-rentabilidad-comerciales.ejs'
];

const headerTemplate = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %></title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="/css/colors.css" rel="stylesheet">
    <link href="/css/dashboard.css" rel="stylesheet">
    <%- include('../partials/navbar-styles') %>
</head>
<body>
    <%- include('../partials/navbar-dashboard') %>

    <!-- Main Content -->
    <div class="container-fluid main-content-wrapper">
        <div class="row">
            <!-- Main Content Area -->`;

archivos.forEach(archivo => {
    const rutaCompleta = path.join(__dirname, '..', archivo);
    
    if (!fs.existsSync(rutaCompleta)) {
        console.log(`⚠️  Archivo no encontrado: ${archivo}`);
        return;
    }
    
    let contenido = fs.readFileSync(rutaCompleta, 'utf8');
    
    // Verificar si ya tiene el navbar
    if (contenido.includes('include(\'../partials/navbar-dashboard\')')) {
        console.log(`✅ ${archivo} ya tiene el navbar`);
        return;
    }
    
    // Buscar el patrón que indica el inicio del contenido
    // Buscar desde <!DOCTYPE hasta <!-- Main Content Area -->
    const match = contenido.match(/<!DOCTYPE html>[\s\S]*?<!-- Main Content Area -->/);
    if (match) {
        // Reemplazar todo el header hasta <!-- Main Content Area -->
        contenido = contenido.replace(/<!DOCTYPE html>[\s\S]*?<!-- Main Content Area -->/, headerTemplate + '\n            <!-- Main Content Area -->');
        fs.writeFileSync(rutaCompleta, contenido, 'utf8');
        console.log(`✅ Actualizado: ${archivo}`);
    } else {
        // Intentar otro patrón: buscar desde <!DOCTYPE hasta <div class="col-md-9
        const match2 = contenido.match(/<!DOCTYPE html>[\s\S]*?<div class="col-md-9 col-lg-10 main-content">/);
        if (match2) {
            contenido = contenido.replace(/<!DOCTYPE html>[\s\S]*?<div class="col-md-9 col-lg-10 main-content">/, headerTemplate + '\n            <div class="col-md-9 col-lg-10 main-content">');
            fs.writeFileSync(rutaCompleta, contenido, 'utf8');
            console.log(`✅ Actualizado: ${archivo}`);
        } else {
            console.log(`⚠️  No se pudo actualizar: ${archivo} (estructura no reconocida)`);
        }
    }
});

console.log('\n✅ Proceso completado');

