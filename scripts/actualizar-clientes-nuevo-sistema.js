/**
 * Script para actualizar clientes con datos encontrados (nuevo sistema)
 * Recibe los datos encontrados y los aplica a la base de datos
 * Usa el sistema de tracking por ID para no repetir búsquedas
 */

const { actualizarClientesConDatos } = require('./procesar-clientes-completo-mejorado');

// Datos encontrados (se añadirán progresivamente)
const datosEncontrados = {
  'Valverde Ibáñez, Ursula': {
    Movil: '968235093',
    DNI_CIF: '22380608K'
  },
  'Soto Fernández, Matilde Pilar': {
    Movil: '968234159',
    DNI_CIF: 'E05557327'
  },
  'Sidrach de Cardona García, Encarnación y López Alanis Sidrach de Cardona, Encarnación y María': {
    Movil: '968234613',
    DNI_CIF: 'E30470439'
  },
  'Valverde Valverde, Cristina Nieves': {
    Movil: '968216260',
    Email: 'farmaciacolon@hotmail.com'
  },
  'Tortosa Padilla, Mª Carmen': {
    Movil: '968212715'
  },
  'Tomas Lorente, Francisco': {
    Movil: '968232368'
  },
  'Tomas Conesa, Elisa': {
    Movil: '968261959',
    Email: 'elisavisedotomas@gmail.com'
  },
  'Toledo Romero, Cesar': {
    Movil: '968295301'
  },
  'Serrano Gil, María Asunción y María Milagros': {
    Movil: '968210048'
  },
  'Serna Fuentes, Juan': {
    Movil: '968254550'
  },
  'Sarria González, Micaela Ana': {
    Movil: '968294096'
  },
  'Vegara Pérez, Rosa Pilar': {
    Movil: '968831917'
  },
  'Fernández Pérez, Fco': {
    Movil: '968292956'
  },
  'Fernández Pérez, Carlos': {
    Movil: '968233327',
    Email: 'botica@farmaciacarlosfp.com',
    DNI_CIF: 'E73957011',
    Web: 'http://www.carlosfernandezfarmacia.es'
  },
  'Fernández Lloret, María Rosa': {
    Movil: '968212021',
    DNI_CIF: 'E73803587'
  },
  'Escolano Navarro, María Dolores': {
    Movil: '968251346'
  },
  'Cuesta García de Leonardo, María Rocío': {
    Movil: '968253573'
  },
  'Clavel Rojo, Araceli': {
    Movil: '968212279'
  },
  'Campillo García, Mª Ascensión': {
    Movil: '968251586'
  },
  'Bernabé Ortuño, Francisco, Bernabé Ruiz, Nuria y Francisco Javier': {
    Movil: '968291678'
  },
  'Belmonte Baño, Antonio': {
    Movil: '968219940'
  },
  'Atenza Fernández, Jose Antonio': {
    Movil: '968257209'
  },
  'Armero Martí, Trinidad': {
    Movil: '968241930'
  },
  'Alemán Alemán, María Jose': {
    Movil: '968259102'
  },
  'Alcázar Moreno, María Dolores y García Alcázar, Esther': {
    Movil: '968239428'
  },
  'Torres Pérez, Mercedes y Muñoz Muñoz, Esperanza': {
    Movil: '968661911'
  },
  'Rodenas Fernández, Ana': {
    Movil: '968660390',
    DNI_CIF: 'E73779712'
  },
  'Valero Canales, Rosa María': {
    Movil: '968465031',
    Email: 'info@farmaciavirgendelashuertas.com',
    DNI_CIF: '23214632L'
  },
  'Guillén Whelan, Manuel': {
    Movil: '968780165',
    Email: 'farmaciaguillen@gmail.com',
    DNI_CIF: '77511577R'
  },
  'Soriano Sánchez, Diego Jesús': {
    Movil: '968782508',
    DNI_CIF: 'E73842288'
  },
  'Mazuelas García, Manuel': {
    Movil: '968782315',
    DNI_CIF: 'E73699761'
  },
  'Brujas-Murcia Bosch Hervas, Juan Miguel': {
    Movil: '968810616',
    Email: 'farmacia@farmaciallanodebrujas.es',
    Web: 'http://www.farmaciallanodebrujas.es'
  },
  'Molina Laborda, Santiago': {
    Movil: '968840119',
    Email: 's.molina1@santiagomolina.com',
    Web: 'http://www.farmaciamolinalabordafmas.com'
  },
  'Lucas Elio, María Cruz y Mónica': {
    Movil: '968761226',
    Email: 'farmacialucaselio@gmail.com'
  },
  'Pérez García, María Engracia': {
    Movil: '968504790',
    Web: 'http://www.farmaciamariaengracia.com'
  },
  'Diez García, Mariano Ramón': {
    Movil: '968511827',
    DNI_CIF: '22913530X'
  },
  'Hernández Mijares, Mariano': {
    Movil: '968501128',
    Email: 'info@farmaciaglobal.es',
    Web: 'http://www.farmaciaglobal.es'
  },
  'Bayona Marín, Emilia y García Miras, Eva María': {
    Movil: '968411037',
    Email: 'info@farmaciabayona.com',
    DNI_CIF: 'E73250359'
  },
  'Maurandi Guillen, María Dolores y Bernal Maurandi, María Dolores': {
    Movil: '968299268',
    Email: 'farmaurandi331@hotmail.com',
    DNI_CIF: 'E73928194'
  },
  'Ladrón de Guevara Ruiz, Pilar': {
    Movil: '968421811',
    DNI_CIF: 'E73751125'
  },
  'Céspedes Rivas, María Jose y Zarauz Céspedes, José María': {
    Movil: '968413204',
    DNI_CIF: 'E73722183'
  },
  'Gil Barnés, Blanca': {
    Movil: '968447326',
    Email: 'farmaciagilbarnes@gmail.com'
  },
  'Ayuso Hernandez, Enrique': {
    Movil: '968298778',
    Email: 'farmaenriqueayuso@gmail.com'
  },
  'Peñalver Sanchez, Sara': {
    Movil: '968239135',
    Email: 'farmacia.sarapenalver@gmail.com'
  },
  'Pedreño Ruiz, Mª Angeles': {
    Movil: '968252945',
    Email: 'fcia.mapedreno@gmail.com'
  },
  'Garrido García, Maravillas': {
    Movil: '968807111',
    Email: 'farmaciagarrido@hotmail.com'
  },
  'Hernandez Rex, Pedro y Hernandez Ortuno, Ines Fuensanta': {
    Movil: '968650065',
    DNI_CIF: 'E73945099'
  },
  'Cremades Prieto, Francisco Vicente': {
    Movil: '968610899',
    Email: 'franciscocremades@redfarma.org'
  },
  'Buendia Diaz, Esperanza': {
    Movil: '968510197',
    Email: 'farmaciabuendia@gmail.com'
  },
  'Munuera Gonzalez, Juana y Martinez Monteagudo, Enrique Jose': {
    Movil: '968180893'
  },
  'Martinez Monje, Esther y Maria Elena': {
    Movil: '968611834'
  },
  'Sanchez Puche, David': {
    Movil: '968295925'
  },
  'Celdran Poyato, Maria Carmen y Farinos Celdran, Ignacio': {
    Movil: '968508238'
  },
  'Lopez Gil, Jose': {
    Movil: '968410718',
    Email: 'farmaciapuertadelorca@neovision.es'
  },
  'Aranaga Larrinaga, Marina y Perez Plaza, Maria Dolores': {
    Movil: '968254143'
  },
  'Lopez Atenza, Victoriano Jesus': {
    Movil: '968670553'
  },
  'Fernandez Perez, Francisco Javier': {
    Movil: '968292956'
  },
  'Villalobos Muñoz, Maria': {
    Movil: '968909888',
    Web: 'http://www.farmaciavillalobosfmas.com'
  },
  'Soler Segarra, Manuel, Soler Tenorio, Jose Ramon': {
    Movil: '968801859'
  },
  'Anunci Gelabert, Jose Luis y Anunci Diaz, Jose Luis': {
    Movil: '968505535'
  },
  'Tomas Barberan, Luis Benjamin': {
    Movil: '968907890'
  },
  'Galindo Garcia, Maria Jose y Sabater Galindo, Marta': {
    Movil: '968627694',
    Email: 'farmacia@parquefarma.com',
    DNI_CIF: 'E73739047',
    Web: 'http://www.parquefarma.com'
  },
  'Hernandez-gil Monfort, Luis Carlos': {
    DNI_CIF: '22439139V'
  },
  'Soto Fernandez, Matilde Pilar y Soria Soto, Pilar': {
    Movil: '968234159',
    DNI_CIF: 'E05557327'
  },
  'Ruano Garcia, Francisco': {
    Movil: '968216038'
  },
  'Carazo Fernandez, Antonio y Carazo Gil, Maria de los Desamparados': {
    Movil: '968301880'
  },
  'Soria Fernandez-Mayoralas, Manuel': {
    Movil: '968693573',
    DNI_CIF: 'E73394058'
  },
  'Garcia Prieto, Maria Dolores': {
    Movil: '968213048'
  },
  'Mendoza Oton, Jose': {
    Movil: '968556368'
  },
  'Ahmad Al-Raui, Jamil': {
    Movil: '968801439'
  },
  'Hernandez Egea, Enrique': {
    Movil: '968269538'
  },
  'Sanchez Hernandez, Maria Isabel': {
    Movil: '968630161'
  },
  'Yelo Yelo, Isabel': {
    Movil: '968450686',
    DNI_CIF: '74341984G'
  },
  'Ruiz Martinez, Jose Javier': {
    Movil: '968770037'
  },
  'Gallego Ibañez, Jose Maria': {
    Movil: '968410213'
  },
  'Ramos Bleda, Irene': {
    Movil: '968760363',
    Email: 'fabledacieza@gmail.com'
  },
  'Rubio Fernandez, Maria': {
    Movil: '968802950',
    Web: 'http://www.farmaciamariarubio.es'
  },
  'Peñalver Castellon, Maria Isabel': {
    Movil: '968820080'
  }
};

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando actualización de clientes con datos encontrados...\n');
    
    const actualizados = await actualizarClientesConDatos(datosEncontrados);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RESUMEN');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ Clientes actualizados: ${actualizados}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { datosEncontrados };
