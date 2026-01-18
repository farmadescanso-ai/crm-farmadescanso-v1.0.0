/**
 * Test rápido: renderizar la vista de detalle de cliente con datos mínimos.
 * Útil para detectar errores EJS (p.ej. variables no definidas) sin levantar el servidor.
 *
 * Uso:
 *   node scripts/render-test-cliente-detalle.js
 */

const path = require('path');
const ejs = require('ejs');

async function main() {
  const viewPath = path.join(__dirname, '..', 'views', 'dashboard', 'cliente-detalle.ejs');

  const data = {
    title: 'Test Cliente Detalle',
    // Importante: user sin "nombre" (caso que antes rompía el navbar)
    user: {},
    cliente: {
      id: 762,
      OK_KO: 'OK',
      Nombre_Razon_Social: 'Fernando Manuel Pedrajas Pastor',
      Telefono: '965457452',
      Email: 'armindainversiones@hotmail.com'
    },
    error: null,
    query: {}
  };

  ejs.renderFile(viewPath, data, (err, html) => {
    if (err) {
      console.error('❌ Error renderizando EJS:', err.message);
      console.error(err.stack);
      process.exitCode = 1;
      return;
    }
    console.log('✅ Render OK. Longitud HTML:', html.length);
  });
}

main().catch((e) => {
  console.error('❌ Error inesperado:', e);
  process.exitCode = 1;
});

