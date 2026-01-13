// Script para crear los dos nuevos comerciales
const crm = require('../config/mysql-crm');

async function crearComerciales() {
  try {
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');

    // Comercial 1: Rico Pérez, Cristina
    const comercial1 = {
      Nombre: 'Rico Pérez, Cristina',
      Email: 'cristina.rico@gmail.com',
      DNI: '34803665L',
      Password: '34803665L', // Usar DNI como contraseña inicial
      Roll: '["Comercial"]',
      Movil: '636401019',
      Direccion: 'Calle Gregorio Ordoñez, 4, P05 A',
      CodigoPostal: '30010',
      Poblacion: 'Murcia'
    };

    // Comercial 2: Alberto Torralba Pizarro
    const comercial2 = {
      Nombre: 'Alberto Torralba Pizarro',
      Email: 'ALBERTO.ATFARMA@GMAIL.COM',
      DNI: '48489860-H',
      Password: '48489860-H', // Usar DNI como contraseña inicial
      Roll: '["Comercial"]',
      Movil: '646001185',
      Direccion: 'Carril Ruiperez, 29, 1 D',
      CodigoPostal: '30007',
      Poblacion: 'Murcia'
    };

    console.log('📝 Creando comerciales...\n');

    // Verificar si ya existen por email
    const comercialesExistentes = await crm.getComerciales();
    const email1Existe = comercialesExistentes.some(c => 
      (c.Email || c.email || '').toLowerCase() === comercial1.Email.toLowerCase()
    );
    const email2Existe = comercialesExistentes.some(c => 
      (c.Email || c.email || '').toLowerCase() === comercial2.Email.toLowerCase()
    );

    // Crear comercial 1
    if (email1Existe) {
      console.log(`⚠️  El comercial "${comercial1.Nombre}" ya existe (email: ${comercial1.Email})`);
    } else {
      console.log(`📝 Creando comercial: ${comercial1.Nombre}...`);
      const result1 = await crm.createComercial(comercial1);
      console.log(`✅ Comercial creado con ID: ${result1.insertId}`);
      console.log(`   Email: ${comercial1.Email}`);
      console.log(`   DNI: ${comercial1.DNI}`);
      console.log(`   Contraseña inicial: ${comercial1.Password}\n`);
    }

    // Crear comercial 2
    if (email2Existe) {
      console.log(`⚠️  El comercial "${comercial2.Nombre}" ya existe (email: ${comercial2.Email})`);
    } else {
      console.log(`📝 Creando comercial: ${comercial2.Nombre}...`);
      const result2 = await crm.createComercial(comercial2);
      console.log(`✅ Comercial creado con ID: ${result2.insertId}`);
      console.log(`   Email: ${comercial2.Email}`);
      console.log(`   DNI: ${comercial2.DNI}`);
      console.log(`   Contraseña inicial: ${comercial2.Password}\n`);
    }

    // Listar todos los comerciales
    console.log('📋 Listado de comerciales:');
    console.log('═══════════════════════════════════════════════════════════');
    const todosComerciales = await crm.getComerciales();
    todosComerciales.forEach((c, index) => {
      console.log(`${index + 1}. ID: ${c.Id || c.id}, Nombre: ${c.Nombre || c.nombre}, Email: ${c.Email || c.email}`);
    });
    console.log('═══════════════════════════════════════════════════════════');

    await crm.disconnect();
    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

crearComerciales();

