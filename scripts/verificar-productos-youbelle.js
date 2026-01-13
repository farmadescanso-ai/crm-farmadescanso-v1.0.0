const crm = require('../config/mysql-crm');

(async () => {
  try {
    const arts = await crm.getArticulos();
    const youbelle = arts.filter(a => {
      const nombre = (a.Nombre || a.nombre || '').toLowerCase();
      return nombre.includes('youbelle') || nombre.includes('talco') || nombre.includes('gel');
    });
    
    console.log(`Productos Youbelle encontrados: ${youbelle.length}\n`);
    youbelle.slice(0, 15).forEach(a => {
      console.log(`- ${a.Nombre || a.nombre} (SKU: ${a.SKU || 'N/A'})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();

