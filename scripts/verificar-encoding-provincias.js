const crm = require('../config/mysql-crm');

(async () => {
  await crm.connect();
  
  // Buscar provincias con problemas de codificación
  const provincias = await crm.query(
    "SELECT id, Nombre, Pais FROM provincias WHERE Nombre LIKE '%├%' OR Pais LIKE '%├%'"
  );
  
  console.log('Provincias con problemas restantes:', provincias.length);
  
  if (provincias.length > 0) {
    provincias.forEach(p => {
      console.log(`  - ID ${p.id}: ${p.Nombre} (${p.Pais})`);
    });
  } else {
    console.log('✅ Todas las provincias están correctamente codificadas\n');
    
    // Mostrar ejemplos de provincias con caracteres especiales correctos
    const ejemplos = await crm.query(
      "SELECT Nombre, Pais FROM provincias WHERE Nombre LIKE '%á%' OR Nombre LIKE '%é%' OR Nombre LIKE '%í%' OR Nombre LIKE '%ó%' OR Nombre LIKE '%ú%' OR Nombre LIKE '%ñ%' LIMIT 15"
    );
    
    console.log('Ejemplos de provincias con caracteres especiales correctos:');
    ejemplos.forEach(p => {
      console.log(`  - ${p.Nombre} (${p.Pais})`);
    });
  }
  
  await crm.disconnect();
})();
