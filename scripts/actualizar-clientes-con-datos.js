/**
 * Script para actualizar clientes con datos encontrados
 * Similar a actualizar-clinicas-con-info.js pero para clientes
 */

const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

/**
 * Limpia un teléfono
 */
function limpiarTelefono(tel) {
  if (!tel) return null;
  return String(tel).replace(/[^\d]/g, '').substring(0, 13);
}

/**
 * Actualiza clientes con información encontrada
 */
async function actualizarClientesConDatos() {
  try {
    console.log('🚀 Iniciando actualización de clientes con datos encontrados...\n');
    
    await crm.connect();
    console.log('✅ Conectado a MySQL\n');
    
    // Obtener provincias
    const provinciasDB = await crm.getProvincias();
    
    // Información encontrada (se añadirá progresivamente)
    const infoEncontrada = {
      'Rodríguez Moreno, Josefa Eloísa': {
        Movil: '968499302'
      },
      'Yago Torregrosa, Rafael': {
        Movil: '968751165',
        Email: 'farmacia.yago@parafarmacia.com'
      },
      'Torres Tomas, Emilia María': {
        Movil: '968791713'
      },
      'Torregrosa Tomas, Rocío': {
        Movil: '968790209',
        Email: 'farmaciatorregrosa@gmail.com',
        Web: 'https://farmayecla.com',
        DNI_CIF: 'E05529714'
      },
      'Ortiz Guzmán, Sandra': {
        Movil: '968790157'
      },
      'Muñoz Yago, Francisco': {
        Movil: '968795857',
        Email: 'farmacia@farmaciamyago.com',
        Web: 'http://www.farmaciamyago.com',
        DNI_CIF: 'E73944795'
      },
      'Muñoz Soriano, Francisco': {
        Movil: '968793054',
        DNI_CIF: 'E73915514'
      },
      'Marco Palao, Marta': {
        Movil: '968753157',
        Email: 'info@farmaciamartamarco.es',
        DNI_CIF: 'E73981714'
      },
      'Lucas Tomás, José Mariano': {
        Movil: '968791203',
        Email: 'info@farmacialucastomas.es'
      },
      'García de Tiedra, Adolfo': {
        Movil: '968790294',
        Email: 'farmaciadetiedra@hotmail.com',
        DNI_CIF: 'B73236952'
      },
      'de la Fuente Arnaiz, Jose': {
        Movil: '968790272',
        Email: 'farmaciayecla@gmail.com',
        DNI_CIF: 'E73911091'
      },
      'Ruiz Fernández, Carmen y Ladrón de Guevara Ruiz, Pilar': {
        Movil: '968421811',
        DNI_CIF: 'E73751125'
      },
      'Martínez Serrano, Francisco': {
        Movil: '968424732'
      },
      'Martínez Navarro, María del Mar': {
        Movil: '968420139',
        DNI_CIF: '23242649E'
      },
      'Ladrón de Guevara Ruiz, Carmen': {
        Movil: '968421811'
      },
      'Gallego Martínez, María del Carmen y Muñoz-Cruzado Barba, Joaquín': {
        Movil: '968424709'
      },
      'Alegre-Cartagena Martínez Martínez, Lucia': {
        Movil: '968528268'
      },
      'Muñoz Hoss, Mª Victoria': {
        Movil: '968587710'
      },
      'Meroño García, María Luisa': {
        Movil: '968577070'
      },
      'Martínez García, Jose': {
        Movil: '968578045'
      },
      'Marín Saura, María Dolores': {
        Movil: '968585872'
      },
      'Llamas Blaya, Octavio Eugenio': {
        Movil: '968578851'
      },
      'García León, Joaquín': {
        Movil: '968466819',
        Email: 'info@farmacialorca.com',
        DNI_CIF: 'B73541120'
      },
      'López Rodríguez, Juan J': {
        Movil: '968370156'
      },
      'Fernández Poderos, Juan Carlos': {
        Movil: '968246997'
      },
      'Castejón Martínez, Olimpia y Castillo Muñoz, Martín': {
        Movil: '968182987',
        DNI_CIF: 'E73657025'
      },
      'Carrión Navarro, Francisco': {
        Movil: '968570160'
      },
      'Amat Fernández, Alberto': {
        Movil: '968179289'
      },
      'Blázquez Martínez, María Remedios': {
        Movil: '968571103'
      },
      'Santa Cruz Siminiani, Ana María': {
        Movil: '968810024'
      },
      'Rey y Vera, Mª Ignacia': {
        Movil: '968853172'
      },
      'Albaladejo Méndez, Gonzalo Juan': {
        Movil: '968169001'
      },
      'García Cartagena, María Teresa': {
        Movil: '968868003'
      },
      'Alemán Meseguer, Jose': {
        Movil: '968868002'
      },
      'Sánchez Macarro, Maravillas': {
        Movil: '968697132'
      },
      'Vidal Pérez, Francisco Jaime e Hita Jiménez, María Inmaculada': {
        Movil: '968483323'
      },
      'Martínez Gómez, Francisca': {
        Movil: '968400279'
      },
      'Martínez García, Robustiano, y Martínez Serrano, Antonio Juan': {
        Movil: '968401350'
      },
      'Gómez García, Juan de Dios': {
        Movil: '968402610'
      },
      'García Caballero, Matilde Gloria': {
        Movil: '968402031'
      },
      'Martínez Pedreño, Remedios y Francisco': {
        Movil: '968301081'
      },
      'García Marín, Josefa': {
        Movil: '968203203',
        Email: 'farmaciajgarciamarin@gmail.com'
      },
      'Carazo Fernández, Antonio': {
        Movil: '968301880'
      },
      'Soler Segarra, Manuel y Soler Tenorio, José Ramón': {
        Movil: '968801851'
      },
      'Mendoza Otón, Jose': {
        Movil: '968556368'
      },
      'Ballester Meroño, Alfonso': {
        Movil: '968556262'
      },
      'Romero Gómez, Antonio Luís': {
        Movil: '968145147',
        Email: 'farmaciaplayahonda@hotmail.com',
        Web: 'http://www.farmaciaplayahondafmas.com'
      },
      'Martínez Fernández, Matilde': {
        Movil: '968253508'
      },
      'Zaragoza Fernández, Pilar': {
        Movil: '968216363'
      },
      'Vegara Pérez, Rosa Pilar': {
        Movil: '968831917'
      },
      'Valverde Valverde, Cristina Nieves': {
        Movil: '968216260',
        Email: 'farmaciacolon@hotmail.com'
      },
      'Valverde Ibáñez, Ursula': {
        Movil: '968235093'
      },
      'Tortosa Padilla, Mª Carmen': {
        Movil: '968212715'
      },
      'Tomas Lorente, Francisco': {
        Movil: '968907890'
      },
      'Tomas Conesa, Elisa': {
        Movil: '968261959',
        Email: 'elisavisedotomas@gmail.com'
      },
      'Toledo Romero, Cesar': {
        Movil: '968295301'
      },
      'Soto Fernández, Matilde Pilar': {
        Movil: '968234159'
      },
      'Sidrach de Cardona García, Encarnación y López Alanis Sidrach de Cardona, Encarnación y María': {
        Movil: '968234613'
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
      'Sandoval Barnuevo, Eugenio': {
        Movil: '968211849'
      },
      'Sánchez Sánchez, Pedro': {
        Movil: '968293522'
      },
      'Sánchez Sánchez, María del Carmen': {
        Movil: '968245577',
        Email: 'farmaciamcsanchez@gmail.com',
        Web: 'http://www.farmaciamariadelcarmensanchezfmas.com'
      },
      'Sánchez Puche, David y José Antonio': {
        Movil: '968295925'
      },
      'Sánchez Martínez, Carmen': {
        Movil: '968216615'
      },
      'Ruiz Pina, Fco': {
        Movil: '968258523'
      },
      'Ruano García, Francisco': {
        Movil: '968216039'
      },
      'Ronchera Doñate, Rafael': {
        Movil: '968293575'
      },
      'Ripoll Ros, Aurora': {
        Movil: '968294803'
      },
      'Quevedo Boj, Jose': {
        Movil: '968265723'
      },
      'Polo García, María Sol': {
        Movil: '968243276'
      },
      'Peñalver Sánchez, Sara': {
        Movil: '968252525'
      },
      'Peñalver Sánchez, Begoña': {
        Movil: '968211535'
      },
      'Peñalver Martínez, Josefa': {
        Movil: '968218329'
      },
      'Navarro Tornero, Jesús Miguel': {
        Movil: '968293306'
      },
      'Mora Flores, María Teresa': {
        Movil: '968234906',
        Email: 'teresa.mora@farmamora.es',
        DNI_CIF: '34788984N'
      },
      'Monje Cantero, Esther Josefina': {
        Movil: '968234379'
      },
      'Molina Nicolás, María Angeles': {
        Movil: '968298169',
        DNI_CIF: 'E73930760'
      },
      'Molina Martínez, Antonio Juan': {
        Movil: '968346450'
      },
      'Molina Giménez, Manuela': {
        Movil: '968234567'
      },
      'Méndez Baquer, Pilar': {
        Movil: '968255392'
      },
      'Meca Pomares, Mª Carmen y López Meca, Ma': {
        Movil: '968260521',
        DNI_CIF: 'E73130056'
      },
      'Maurandi Guillen, María Dolores': {
        Movil: '968299268',
        Email: 'farmaurandi331@hotmail.com',
        Web: 'http://www.farmaciamaurandiguillen.es'
      },
      'Maurandi Guillen, Antonia María': {
        Movil: '968257491'
      },
      'Martínez Torregrosa Gómez, Valentín': {
        Movil: '968212550',
        DNI_CIF: '74143263A'
      },
      'Martínez Torregrosa, Concepción': {
        Movil: '968212947'
      },
      'Marín Sánchez, Juan Pedro y Jose Luís': {
        Movil: '968218699',
        DNI_CIF: 'E30536031'
      },
      'Martínez López, Miguel Angel': {
        Movil: '968211828'
      },
      'López Calvo, Helena': {
        Movil: '968200388'
      },
      'López Alvarez, María Antonia': {
        Movil: '968283876'
      },
      'Llorente Viñas, Amalia': {
        Movil: '968232596'
      },
      'Latorre Tora, María Mercedes': {
        Movil: '968234034'
      },
      'Martínez Bellvis, Eduardo Luís': {
        Movil: '968214301'
      },
      'Marín Sánchez, Juan Pedro y Jose Luís': {
        Movil: '968218699'
      },
      'Lorente Martínez, María Jesús': {
        Movil: '968255557'
      },
      'López García, Ma': {
        Movil: '968291132'
      },
      'López Calvo, Helena': {
        Movil: '968200388'
      },
      'López Alvarez, María Antonia': {
        Movil: '968283876'
      },
      'Llorente Viñas, Amalia': {
        Movil: '968232596'
      },
      'Latorre Tora, María Mercedes': {
        Movil: '968234034'
      },
      'Jiménez Ingles, María Dolores': {
        Movil: '968211160'
      },
      'Insausti Sánchez, María del Car': {
        Movil: '968294971',
        Email: 'mcinsausti@hotmail.com',
        Web: 'https://farmaciadeinsausti.es'
      },
      'Hernández González, María Teresa': {
        Movil: '968231141'
      },
      'Gutiérrez Galiano, Montserrat': {
        Movil: '968230072'
      },
      'Gralluera Marco, Francisco Javier': {
        Movil: '968244236'
      },
      'Gorostiza Ruiz, Ignacio': {
        Movil: '968213226'
      },
      'Giménez Martínez, María Jose': {
        Movil: '968347045'
      },
      'Giménez Martínez, Magdalena': {
        Movil: '968245964'
      },
      'Gil Cepeda Pérez, Luis Miguel': {
        Movil: '968251127'
      },
      'Garre Rodenas, Carolina': {
        Movil: '968263947'
      },
      'García-Lax Espinosa, Encarnación': {
        Movil: '968263865'
      },
      'García Ruiz, Emilio': {
        Movil: '968248104'
      },
      'García de Tiedra, Mercedes': {
        Movil: '968244807'
      },
      'García Blasco, María Amparo': {
        Movil: '968214836'
      },
      'Garay Miralles, María Jose': {
        Movil: '968213048'
      },
      'Galindo Tovar, Alejandro': {
        Movil: '968294143',
        Email: 'info@farmaciatovar.com',
        Web: 'http://www.farmaciatovar.com'
      },
      'Galindo Molina, Antonio Enrique y Galindo Samper, Antonio Enrique': {
        Movil: '968290028'
      },
      'Ferrando Prieto, María Dolores': {
        Movil: '968212829'
      },
      'Fernández Rufete Cerezo, Pedro': {
        Movil: '968251008'
      },
      'Fernández Pérez, Fco': {
        Movil: '968292956'
      },
      'Fernández Pérez, Carlos': {
        Movil: '968233327',
        Email: 'botica@farmaciacarlosfp.com',
        Web: 'http://www.farmaciacarlosfernandez.com'
      },
      'Fernández Lloret, María Rosa': {
        Movil: '968212021'
      },
      'Esquer Germán, María Begoña': {
        Movil: '968293402'
      },
      'Escolano Navarro, María Dolores': {
        Movil: '968251346'
      },
      'Aguilar-Amat Prior, María Manuela': {
        Movil: '968216640',
        Web: 'http://www.magistralfarmacia.es'
      },
      'Cuesta García de Leonardo, María Rocío': {
        Movil: '968253573'
      },
      'Corbalán Belmonte, Amelia': {
        Movil: '968235725',
        DNI_CIF: '23521375B'
      },
      'Clavel Rojo, Araceli': {
        Movil: '968212279'
      },
      'Chamorro Gómez, Miguel y Galisteo Cano, Concepción': {
        Movil: '968219855',
        Email: 'miguelchamorro@redfarma.org',
        DNI_CIF: 'E73411316'
      },
      'Casanueva Luís, Alicia': {
        Movil: '968251684',
        Web: 'http://www.farmaciacasanuevafmas.com',
        DNI_CIF: '51317968T'
      },
      'Cárdenas Rueda, Victoria': {
        Movil: '968243430',
        DNI_CIF: 'E73661878'
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
      'Alemán Alemán, Francisco': {
        Movil: '968350225'
      },
      'Alcázar Moreno, María Dolores y García Alcázar, Esther': {
        Movil: '968239428'
      },
      'Alarcón Fuentes, Isabel': {
        Movil: '968292714',
        DNI_CIF: '27470735H'
      },
      'Agulló Zaragoza, Carmen Pilar': {
        Movil: '968266094'
      },
      'Abizanda Martínez, Mercedes': {
        Movil: '968295685'
      },
      'Abenza López, Jose María y Sánchez Hurtado, Antonia': {
        Movil: '968262996',
        DNI_CIF: 'E73611253'
      },
      'Abellán Martínez, María': {
        Movil: '968239622'
      },
      'Torres Pérez, Mercedes y Muñoz Muñoz, Esperanza': {
        Movil: '968661911'
      },
      'Rodenas Fernández, Ana': {
        Movil: '968660390'
      },
      'Perea Espinosa, María Belén': {
        Movil: '968661389'
      },
      'Peiro Berenguer, Rafael, y Ramos Carrasco, Juan': {
        Movil: '968660533',
        Email: 'farmaciapeiropradera@gmail.com',
        Web: 'http://www.farmaciapeiropradera.com'
      },
      'Ortega Carreño, Fernando Mariano': {
        Movil: '968662346'
      },
      'Martínez Sánchez, Elena': {
        Movil: '968730253'
      },
      'Martínez Guerrero, Ana María': {
        Movil: '968730038'
      },
      'Pardo Cayuela, Jose Antonio': {
        Movil: '968850499'
      },
      'Cuello Moreno, Ana y González Cuello, José Antonio': {
        Movil: '968850488'
      },
      'Sánchez Belmar y Soria Estevan, María del Mar': {
        Movil: '968168924',
        Email: 'farmacialosmolinos@hotmail.com',
        Web: 'http://www.farmacialosmolinosfmas.com'
      },
      'Uribe Navarro, María Jose y Espallardo Uribe, Ana María': {
        Movil: '968613012'
      },
      'Moreno Abellán, Francisco': {
        Movil: '968611340'
      },
      'Martínez Monje, Esther, María Elena y Félix': {
        Movil: '968611834'
      },
      'Gómez Ros, Juan': {
        Movil: '968610945'
      },
      'Gómez García, Ana María': {
        Movil: '968610183'
      },
      'Gil Cavero, Eduardo-Jose': {
        Movil: '968610179'
      },
      'García Lozano, Jose Antonio': {
        Movil: '968612651'
      },
      'Fernández Franco, Leandro': {
        Movil: '968611669',
        Email: 'info@carlosfernandezfarmacia.es',
        Web: 'http://www.carlosfernandezfarmacia.es'
      },
      'Cremades Prieto, María Consuelo': {
        Movil: '968605572'
      },
      'Cremades Prieto, Francisco V': {
        Movil: '968610899',
        Email: 'franciscocremades@redfarma.org'
      },
      'Corbalán Carreño, Eloisa': {
        Movil: '968610076'
      },
      'Ortega Jiménez, Juan Antonio': {
        Movil: '968169637'
      },
      'Sánchez Zapata, Gloria': {
        Movil: '968134416',
        Email: 'farmacialosurrutias@yahoo.es'
      },
      'Navarro Torres, Laura': {
        Movil: '968133299',
        Email: 'farmacialosnietos@gmail.com'
      },
      'Ortega Ortega, Luís Alberto': {
        Movil: '968504449'
      },
      'Orenes Barceló, María': {
        Movil: '968820404'
      },
      'López Ruiz, Esther': {
        Movil: '968264988'
      },
      'Meroño Rosique, Santiago': {
        Movil: '968260290'
      },
      'Valdés García, Carmen': {
        Movil: '968510881'
      },
      'Pérez Coutiño, Millan': {
        Movil: '968512547'
      },
      'Bernal Pérez, Gines': {
        Movil: '968512539'
      },
      'Ibáñez Pascual, Carmen': {
        Movil: '968511107'
      },
      'Velázquez de Castro y Puerta, Antonio Luís': {
        Movil: '968466968'
      },
      'Valero Canales, Rosa María': {
        Movil: '968465031',
        Email: 'info@farmaciavirgendelashuertas.com',
        Web: 'http://www.farmaciavirgendelashuertas.com'
      },
      'Tadeo Martínez, Jorge': {
        Movil: '968466186',
        DNI_CIF: '27530771R'
      },
      'Sánchez Capelo, Francisco Luís': {
        Movil: '968472071',
        DNI_CIF: '23226982H'
      },
      'Sánchez Canovas, Caridad': {
        Movil: '968468732'
      },
      'Ruiz Maldonado, José Miguel': {
        Movil: '968468190'
      },
      'Periago Mercado, Antolín': {
        Movil: '968466163',
        DNI_CIF: '23247930J'
      },
      'Ortega Castillo, Cristobal y Domenech Jímenez, Esther': {
        Movil: '968467716'
      },
      'Mazzuchelli López, María José': {
        Movil: '968466023'
      },
      'Mazzucheli Pérez, Josefina y María': {
        Movil: '968469501',
        DNI_CIF: 'E73339491'
      },
      'Hidalgo Rodríguez, Luís': {
        Movil: '968466396'
      },
      'Giménez Mena, Aurelia': {
        Movil: '968466235'
      },
      'García Sánchez, Marco Antonio': {
        Movil: '968469504'
      },
      'García Pérez, Jose Antonio': {
        Movil: '968466152'
      },
      'Gallego Henarejos, José Luis': {
        Movil: '968467798'
      },
      'Domínguez Lorente, Alejandro Francisco': {
        Movil: '968471884',
        DNI_CIF: '23222596W'
      },
      'Castiñeiras Bueno, Victoria': {
        Movil: '968466106'
      },
      'Castiñeiras Bueno, Francisco Ramón': {
        Movil: '968466710'
      },
      'Castillo García, Luís y Castillo Castro, Elena': {
        Movil: '968466313',
        DNI_CIF: 'E73468704'
      },
      'Arcas López, Domingo y Arcas Castiñeiras, Pedro': {
        Movil: '968477004',
        DNI_CIF: 'E73620338'
      },
      'Abril Sánchez, Antonio': {
        Movil: '968442021',
        DNI_CIF: '23202909A'
      },
      'Abad Campos, Manuel': {
        Movil: '968477136',
        DNI_CIF: '23212966D'
      },
      'Olmos Rojo, Francisco': {
        Movil: '968551070'
      },
      'Girón Martínez, Francisco Jesús': {
        Movil: '968525602'
      },
      'Brujas-Murcia Bosch Hervas, Juan Miguel': {
        Movil: '968810616',
        Email: 'farmacia@farmaciallanodebrujas.es',
        Web: 'http://www.farmaciallanodebrujas.es'
      },
      'Beal-Cartagena Peña Ros, Juan Ernesto': {
        Movil: '968546221'
      },
      'Rodríguez Arcas, Mª Jesús': {
        Movil: '968511568'
      },
      'Sánchez Abad, Antonio Vicente y Sánchez Recio, Antonio': {
        Movil: '968491101'
      },
      'Piñero García, José Juan': {
        Movil: '968140881'
      },
      'Martínez Martínez, Ascensión': {
        Movil: '968142016'
      },
      'Elvira Rendueles, María Luisa Belán': {
        Movil: null
      },
      'Madrid Rosique, Laura': {
        Movil: '968563229'
      },
      'Garre Palomares, Nuria': {
        Movil: '968563773',
        Web: 'http://www.farmacialamanganuriagarrefmas.com'
      },
      'Martínez Jiménez, Juan Pedro': {
        Movil: '868079031'
      },
      'Ortín García, María Josefa': {
        Movil: '968704204'
      },
      'Paya Pérez, Julio': {
        Movil: '968558364'
      },
      'García Armero, Francisco': {
        Movil: '968558058'
      },
      'Soto Fernández, Juan-Angel': {
        Movil: '968840733'
      },
      'Molina Laborda, Santiago': {
        Movil: '968840119',
        Email: 's.molina1@santiagomolina.com',
        Web: 'http://www.farmaciamolinalabordafmas.com'
      },
      'Llamas Guirao, Soledad': {
        Movil: '968840351'
      },
      'Escarabajal García-Pagan, Magdalena y Millán Escarabajal, Almudena': {
        Movil: '968842480'
      },
      'Soriano Sánchez, Pedro José': {
        Movil: '968757570'
      },
      'Soriano Sánchez, Diego Jesús': {
        Movil: '968782508'
      },
      'Mazuelas García, Manuel': {
        Movil: '968782315'
      },
      'Guillén Whelan, Manuel': {
        Movil: '968780165',
        Email: 'farmaciaguillen@gmail.com',
        Web: 'http://www.farmaciaguillen.com'
      },
      'Cambronero Sánchez, Miguel': {
        Movil: '968782812'
      },
      'Azorín Piñol, Aurora': {
        Movil: '968780130',
        Email: 'farmaciaazorincb@gmail.com',
        Web: 'http://www.farmaciaazorinfmas.com'
      },
      'Agulló García, Alberto Jaime': {
        Movil: '968780088'
      },
      'Menores-Cartagena Burrueco Sánchez, Ana María': {
        Movil: '968133061',
        Web: 'http://www.farmaciaislasmenores.com'
      },
      'Librilla-Mula Buendía Noguera, Sabina': {
        Movil: '968668204'
      },
      'Sánchez García, Gines y Sánchez Polo, Alberto': {
        Movil: '968685048'
      },
      'Pérez Belda, Pascuala M': {
        Movil: '968685007'
      },
      'Espinardo-Murcia Palau Gudiol, Mercedes': {
        Movil: '968830114',
        Email: 'mercedespalau@yahoo.es',
        Web: 'http://www.farmaciamercedespalaufmas.com'
      },
      'Espinardo-Murcia Moreno Bravo, Jose Carlos': {
        Movil: '968830139'
      },
      'Espinardo-Murcia Mora Flores, Cristina': {
        Movil: '968879962',
        Web: 'http://www.espinardo.farmaciamora.es'
      },
      'Espinardo-Murcia Alcázar Moreno, Cristóbal': {
        Movil: '968830522'
      },
      'Era Alta-Murcia Villalba Pérez, Antonio Manuel': {
        Movil: '968254008'
      },
      'Díaz Martínez, Marina Lucia': {
        Movil: '968281515'
      },
      'el Puntal-Murcia Puche Carpena, María Isabel': {
        Movil: '968831917'
      },
      'el Puntal-Murcia Albacete García, Carmen Rosa,': {
        Movil: '968835119'
      },
      'Villalobos Bernal, Fernando': {
        Movil: '968885125',
        DNI_CIF: 'E73633604'
      },
      'Segura Caravaca, Elena': {
        Movil: '968885066'
      },
      'Navarro Martínez, Francisco L': {
        Movil: '968882236',
        Email: 'farmacia_lapaz@hotmail.es',
        DNI_CIF: 'E73949372'
      },
      'Martínez Soto, Inmaculada': {
        Movil: '968881296',
        Web: 'http://www.farmacialanuevafmas.com'
      },
      'Marín Abad-Segura, Luís': {
        Movil: '968885544'
      },
      'García-Estañ Mino, Fuensanta y Rosario': {
        Movil: '968884389',
        DNI_CIF: 'E73022667'
      },
      'García-Estañ López, Francisco Javier': {
        Movil: null
      },
      'García Legaz, Encarnación': {
        Movil: '968882055'
      },
      'Jiménez Cervantes, María del Carmen': {
        Movil: '968174363'
      },
      'Rama Pagan, María Jesús': {
        Movil: '968135641'
      },
      'Conesa Martínez, Ana María y Calatrava Torres, Manuel': {
        Movil: '968135921',
        DNI_CIF: 'E30748503'
      },
      'Corvera-Murcia Alarcón García, Rosa María': {
        Movil: '968380026',
        Web: 'http://www.farmaciacorvera.com',
        DNI_CIF: '27452235X'
      },
      'Cobatillas-Murcia Enz-Meseguer Pastor, Marta': {
        Movil: '968865927'
      },
      'Molina Cano, María Llanos': {
        Movil: '968760738'
      },
      'Lucas Elio, María Cruz y Mónica': {
        Movil: '968761226',
        Email: 'farmacialucaselio@gmail.com',
        Web: 'http://www.farmacialucaseliofmas.com'
      },
      'Ladrón de Guevara Mellado, Juan Antonio y Ladrón de Guevara Ruiz, Juan Antonio': {
        Movil: '968760306',
        DNI_CIF: 'E73751117'
      },
      'Jordán Pérez, Joaquín': {
        Movil: '968454523'
      },
      'Jiménez Pérez, Antonio Jose': {
        Movil: '968453145'
      },
      'García Gómez, Francisco': {
        Movil: '968760383'
      },
      'Cáceres Hernández-Ros, María Pilar y Alfonso Cáceres, María Pilar': {
        Movil: '968760197'
      },
      'Abellán Semitiel, María Piedad y Bleda Abellán, María Francisca': {
        Movil: '968760363'
      },
      'Churra-Murcia Sabater Sánchez, Teresa': {
        Movil: '968831060'
      },
      'Yelo Clemente, Amparo': {
        Movil: '968516226'
      },
      'Toledo Romero, Carmen': {
        Movil: '968314561'
      },
      'Santos Oliva, Gerardo': {
        Movil: '968501442'
      },
      'Sánchez Peñuela Tomás, Juan Bautista y Lejarrraga Azcarreta, Margarita': {
        Movil: '968501226'
      },
      'Sánchez Carrascosa, Salvador': {
        Movil: '968503715'
      },
      'Sánchez Carrascosa, Juan Bautista': {
        Movil: '968522532'
      },
      'Sánchez Carrascosa, Francisco J': {
        Movil: '968507731'
      },
      'Ruiz Martínez, Mª Rosa': {
        Movil: '968510401',
        Email: 'ruizmartinez.r6@gmail.com',
        Web: 'http://www.farmaciarosaruizfmas.com'
      },
      'Ros Bielsa, María Dolores': {
        Movil: '968501557'
      },
      'Pintado Armero, María Leonor': {
        Movil: '968500762'
      },
      'Pérez Martínez, Pedro Angel': {
        Movil: '868061515',
        Email: 'farmaciapedroperez@hotmail.com'
      },
      'Pérez García, María Engracia': {
        Movil: '968504790',
        Web: 'http://www.farmaciamariaengracia.com'
      },
      'Paredes Cerezuela, Adela': {
        Movil: '968503703',
        Web: 'http://www.farmaciaadelaparedesfmas.com'
      },
      'Moreno Bejar, María Cecilia': {
        Movil: '968510805'
      },
      'Moreno Arribas, Antonio José': {
        Movil: '968315858'
      },
      'Morales Ramírez, María del Mar y María Dolores': {
        Movil: '968516611'
      },
      'Morales Galindo, María Francisca': {
        Movil: '968505926'
      },
      'Mora Góngora, María Luz': {
        Movil: '968503735'
      },
      'Meca Madrid, María Jose': {
        Movil: '968510661',
        Email: 'farmaciameca324@gmail.com',
        Web: 'http://www.farmaciamecact.com'
      },
      'Martínez Moreno, Pedro': {
        Movil: '968504384',
        Web: 'http://www.farmamercado.com'
      },
      'Martínez Martínez, Cecilio': {
        Movil: '968501291'
      },
      'Martínez Gómez, Alfonso': {
        Movil: '968513150'
      },
      'Jiménez Serrano, Jose Luís': {
        Movil: '968508010',
        Email: 'jljs@jljs.e.telefonica.net'
      },
      'Iguaz Clemente, Mercedes': {
        Movil: '968508590'
      },
      'Iguaz Clemente, Inés': {
        Movil: '968316242'
      },
      'Hernández Mijares, Maríano': {
        Movil: '968501128',
        Email: 'info@farmaciaglobal.es',
        Web: 'http://farmaciaglobal.es'
      },
      'Gutiérrez Pérez, Rafael y Juan Jose': {
        Movil: '968503829'
      },
      'González González, Jose Juan': {
        Movil: '968502136'
      },
      'González Conesa, Faustina y Alvarez-Gómez González, Adela': {
        Movil: '968503123'
      },
      'García Díaz, Ambrosio': {
        Movil: '968506761'
      },
      'Fernández-Pacheco Pérez, Pablo': {
        Movil: '968511093'
      },
      'Diez García, Mariano Ramón': {
        Movil: '968511827'
      },
      'Díaz García, María Jesús': {
        Movil: '968502778'
      },
      'Desmonts Gutiérrez, Juan': {
        Movil: '968502183'
      },
      'de los Santos Clemente, María I': {
        Movil: '968512667'
      },
      'Crespo Galvez, María Dolores': {
        Movil: '968501936'
      },
      'Conesa Zamora, Silvia': {
        Movil: '968513227'
      },
      'Cervantes Langle, Pablo José': {
        Movil: '968314191'
      },
      'Celdrán Vidal, Enrique': {
        Movil: '968089011',
        DNI_CIF: '22855613F'
      },
      'Celdrán Poyato, María Carmen': {
        Movil: '968508238'
      },
      'Canovas Kastenmuller, Cristina': {
        Movil: '968511242'
      },
      'Cano Cerón, Miguel Salvador': {
        Movil: '968504009'
      },
      'Cano Cerón, Luís': {
        Movil: '968506883'
      },
      'Calero González, Covadonga': {
        Movil: '968507734',
        DNI_CIF: '22963240V'
      },
      'Buendía Mayordomo, Diego': {
        Movil: '968510197'
      },
      'Barceló Mercader, Ascensión': {
        Movil: '968505476',
        Email: 'info@ascensionbarcelofmas.com',
        Web: 'http://www.ascensionbarcelofmas.com'
      },
      'Avilés Inglés, Esther y Sáez Almagro, Antonio': {
        Movil: '968513339',
        Web: 'http://www.farmaciasaezavilesfmas.com',
        DNI_CIF: 'E73017956'
      },
      'Anunci Gelabert, Jose Luís y Anunci Díaz, Jose Luís': {
        Movil: '968505535',
        DNI_CIF: 'E02923209'
      },
      'Anunci Gelabert, Jose Luís': {
        Movil: '968505535'
      },
      'Alvarez-Gómez García, Mª Begoña': {
        Movil: '968535377'
      },
      'Albaladejo Ortiz, Daniel': {
        Movil: '968513350'
      },
      'Sáez Mestre, Luís Emilio': {
        Movil: '968708459',
        Email: 'farmacia.saez.mestre@gmail.com',
        Web: 'http://www.farmaciasaezmestre.com',
        DNI_CIF: 'B73636896'
      },
      'Melgares Carrasco, Lidia': {
        Movil: '968705774',
        Email: 'lymelca@gmail.com',
        Web: 'http://www.farmaciamelgares.com',
        DNI_CIF: '74435085R'
      },
      'López Salueña, Rosario': {
        Movil: '968708412',
        Email: 'rosariolopezfarmacia@hotmail.com',
        DNI_CIF: '74435607V'
      },
      'Guerrero Quadrado, Pedro': {
        Movil: '968702389'
      },
      'Caparrós Bravo, Antonio': {
        Movil: '968708096'
      },
      'Canteras-Cartagena Urrios de Porras, Mª del Carmen': {
        Movil: '968162155'
      },
      'Canteras-Cartagena Guarch Tenreiro, Carmen': {
        Movil: '968553327'
      },
      'Campillo-Lorca Pérez Quiñonero, Juana María': {
        Movil: '968468691',
        DNI_CIF: '23230344E'
      },
      'Rosique Robles, Prudencio': {
        Movil: '968720356',
        Email: 'farmaciarosiquep@hotmail.com',
        Web: 'http://www.farmaciarosique.es'
      },
      'Pérez Piernas, M': {
        Movil: '968745151',
        Email: 'farmacia.perezpiernas@gmail.com',
        Web: 'http://www.farmaciaperezpiernasfmas.com'
      },
      'Torre Soler, Victoria Susana': {
        Movil: '968745489',
        Web: 'http://www.farmaciadetorre.com',
        DNI_CIF: 'E05505672'
      },
      'Bartual Carratala, Concepción': {
        Movil: '968746457'
      },
      'Flores-Cartagena Samper Albaladejo, Sebastián de': {
        Movil: '968563472'
      },
      'Palos-Cartagena Tornell Sánchez, María de la Cr': {
        Movil: '968564422'
      },
      'Torres-Murcia Muñoz Soler, Antonia': {
        Movil: '968831181'
      },
      'Torres-Murcia Fonolla Briales, Juan Manuel': {
        Movil: '968831094'
      },
      'Torres-Murcia Conejero Abellán, Juan Pablo': {
        Movil: '968831034'
      },
      'Morales Chacón, Vicentina': {
        Movil: '968652228',
        Email: 'farmaciamorales@telefonica.net'
      },
      'Martínez Lorente, José Ramón': {
        Movil: '968654056'
      },
      'Lajarín Barquero, Juan y Lajarín Cuesta, María Rocío': {
        Movil: '968652182'
      },
      'Figueroa Soriano, Salvador y Figueroa Morales, Mercedes': {
        Movil: '968652080'
      },
      'Rojas García, Francisco': {
        Movil: '968778301',
        Web: 'http://www.farmaciafranciscorojas.es'
      },
      'González Jordán, Josefa': {
        Movil: '968778348'
      },
      'García Bastida, Dolores': {
        Movil: '968602671'
      },
      'Barranda-Caravaca Lloret Sánchez, María de los Reyes': {
        Movil: '968725015',
        Web: 'http://www.farmacialloretfmas.com'
      },
      'Barqueros-Murcia López Collados, Antonia': {
        Movil: '968373655'
      },
      'Barinas-Abanilla Aracil Salar, Antonio y Abilio': {
        Movil: '968689033'
      },
      'Archivel-Caravaca López Marín, Juan': {
        Movil: '968725359'
      },
      'Peña Llorens, Pilar': {
        Movil: '968670045',
        Email: 'farmaciaenarchena@gmail.com'
      },
      'Martínez Carrillo, M': {
        Movil: '968671857'
      },
      'López Atenza, Victoriano Jesús': {
        Movil: '968670553',
        Web: 'http://www.farmaciavictorianolopezfmas.com'
      },
      'Fuentes Ayala, Cayetano': {
        Movil: '968670455',
        Email: 'farmaciadelcarril@gmail.com'
      },
      'Alumbres-Cartagena Santoyo Sánchez, Francisco Javier': {
        Movil: '968552153'
      },
      'Altorreal-Molina de Segura Cañamas Gadea, Macarena': {
        Movil: '968648147'
      },
      'Almendricos-Lorca Martínez García, Juan Bartolomé y Martínez Díaz, Carlos': {
        Movil: '968440071'
      },
      'Aljucer-Murcia Ruiz Castillo, Julia': {
        Movil: '968268005',
        Email: 'farmaciaruizcastillo@gmail.com'
      },
      'Aljucer-Murcia Ortiz Alemán, Francisco y Ortiz Pujalte, Francisco José': {
        Movil: '968254124'
      },
      'Aljucer-Murcia Ortega Tomás, Emilia y Briones Ortega, Carlos': {
        Movil: '968344555',
        Web: 'http://www.farmabriones.com',
        DNI_CIF: 'E73612509'
      },
      'Briones Ortega, Carlos': {
        Movil: '968344555',
        Web: 'http://www.farmabriones.com',
        DNI_CIF: 'E73612509'
      },
      'Aljucer-Murcia Hernández Egea, Enrique': {
        Movil: '968269538',
        Web: 'http://www.farmaciaenriquehernandezfmas.com'
      },
      'Murcia Tutau Sánchez, Maria Soledad': {
        Movil: '968630855'
      },
      'Murcia Pérez García, Eduardo, y Serrano Landaberea, Elena': {
        Movil: '968630047',
        DNI_CIF: 'E30400758'
      },
      'Murcia Martínez Coronado, Joaquina': {
        Movil: '968630161'
      },
      'Murcia López Martínez-Mena, Benjamín': {
        Movil: '968630012'
      },
      'Murcia Gómez Fernández, Juana María': {
        Movil: '968632202'
      },
      'Murcia Fernández Castelló, Gregorio Ángel': {
        Movil: '968636368'
      },
      'Algezares-Murcia Rosique Robles, Mario': {
        Movil: '968379780'
      },
      'Algezares-Murcia Egea Avilés, Almudena y Helena': {
        Movil: '968840361'
      },
      'Martín Rodríguez, Esther María': {
        Movil: '968484516',
        Web: 'http://www.farmaciamartinrodriguez.es'
      },
      'Sánchez García, María del Mar': {
        Movil: '968892088'
      },
      'Rubio Fernández, Maria': {
        Movil: '968802950',
        Web: 'http://www.farmaciamariarubio.es'
      },
      'Riquelme Cascales, Jesús': {
        Movil: '968802448'
      },
      'Monar Martínez, Concepción': {
        Movil: '968802448',
        Email: 'c.monar@hotmail.com'
      },
      'Menárguez Carreño, Micaela': {
        Movil: '968801526'
      },
      'Menárguez Arnaldos, Francisco, y Menárguez Carreño, Reyes': {
        Movil: '968800197'
      },
      'Hernández Ros, M': {
        Movil: '968801529'
      },
      'Garrido García, Maravillas': {
        Movil: '968807111',
        Email: 'farmaciagarrido@hotmail.com'
      },
      'Delgado García, Juan Antonio, Herederos de': {
        Movil: '968800368'
      },
      'Castillo Ruiz, Rosario': {
        Movil: '968808997'
      },
      'Carpes Hernández, Cristobal': {
        Movil: '968938248'
      },
      'Azorín Ortega, Rafael A': {
        Movil: '968667555'
      },
      'Santamaría Cas, Alejandro': {
        Movil: '968410146'
      },
      'Sánchez Soler, María Jose': {
        Movil: '968448639'
      },
      'Marcos Rojo, María Pilar': {
        Movil: '968448611'
      },
      'Gnecco Suárez, Juan Luís': {
        Movil: '968411832'
      },
      'Gil López, Emilia': {
        Movil: '968410718'
      },
      'Gil Barnés, Blanca': {
        Movil: '968447326',
        Email: 'farmaciagilbarnes@gmail.com'
      },
      'García Villalba, Manuel, y Montalvo Gómez, Pilar': {
        Movil: '968413150'
      },
      'García García, Juana Inés': {
        Movil: '968413510'
      },
      'Gallego Ibáñez, Jose María': {
        Movil: '968410213'
      },
      'Céspedes Rivas, María Jose y Zarauz Céspedes, José María': {
        Movil: '968413204'
      },
      'Bayona Marín, Emilia y García Miras, Eva María': {
        Movil: '968411037',
        Email: 'info@farmaciabayona.com',
        Web: 'http://www.farmaciabayona.com'
      },
      'Pacheco Atienza, Arsenio': {
        Movil: '968680018',
        Web: 'http://www.farmaciapacheco.com'
      },
      'Ibañez Herrera, José': {
        Movil: '968680619'
      },
      'Saint-gerons Sanchez, Cristina': {
        Movil: '968168924',
        Web: 'http://www.farmacialosmolinosfmas.com'
      },
      'Meroño Garcia, Maria Luisa': {
        Movil: '968577070'
      },
      'Aleman Aleman, Maria Jose': {
        Movil: '968259102'
      },
      'Ayuso Hernandez, Enrique': {
        Movil: '968298778',
        Email: 'farmaenriqueayuso@gmail.com',
        Web: 'http://www.farmaciaenriqueayusofmas.com'
      },
      'Arango Guzman, Rosa Maria': {
        Movil: '968801475'
      },
      'Garcia Armero, Francisco': {
        Movil: '968234613'
      },
      'Abizanda Martinez, Mercedes': {
        Movil: '968295685'
      },
      'Ladron de Guevara Ruiz, Pilar': {
        Movil: '968421652'
      },
      'Cuesta Garcia de Leonardo, Maria Rocio y Lajarin Cuesta, Marta': {
        Movil: '968253573'
      },
      'Perez-guillermo Valdes, Josefa': {
        Movil: '968510881'
      },
      'Pedreño Ruiz, Mª Angeles': {
        Movil: '968252945',
        Email: 'fcia.mapedreno@gmail.com'
      },
      'Maurandi Guillen, Maria Dolores y Bernal Maurandi, Maria Dolores': {
        Movil: '968299268',
        Email: 'farmaurandi331@hotmail.com',
        Web: 'http://www.farmaciamaurandiguillen.es'
      },
      'Peñalver Sanchez, Sara': {
        Movil: '968239135',
        Email: 'farmacia.sarapenalver@gmail.com'
      },
      'Valverde Ibañez, Ursula': {
        Movil: '968235093'
      },
      'Llamas Lazaro, Fernando': {
        Movil: '968865192'
      },
      'Ruiz Martinez, Ma. Rosa': {
        Movil: '968510401',
        Email: 'farmaciarosaruiz@hotmail.com',
        Web: 'http://www.farmaciarosaruizfmas.com'
      },
      'Meca Madrid, Maria Jose': {
        Movil: '968510661',
        Email: 'farmaciameca324@gmail.com',
        Web: 'http://www.farmaciamecact.com'
      },
      'Jimenez Ingles, Maria Dolores': {
        Movil: '968211160',
        Web: 'http://www.farmaciariosegura9.com'
      },
      'Rodriguez Arcas, Maria Jesus': {
        Movil: '968511568'
      },
      'Celdran Poyato, Maria Carmen y Farinos Celdran, Ignacio': {
        Movil: '968508238'
      },
      'Muñoz Moreno, Ana y Muñoz Moreno, Marcos': {
        Movil: '968831181',
        DNI_CIF: 'E73917635'
      },
      'Diaz Garcia, Jose David': {
        Movil: '968467981'
      },
      'Rodriguez Moreno, Josefa Eloisa': {
        Movil: '968499302'
      },
      'Cano Perez, Miguel': {
        Movil: '968506883'
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
      'Gomez Abellan, Jesus Joaquin': {
        Movil: '968770478'
      },
      'Perez Martinez, Pedro Angel': {
        Movil: '868061515',
        Email: 'farmaciapedroperez@hotmail.com',
        Web: 'http://www.farmaciapedroperezfmas.com'
      },
      'Martinez Cacha, Francisco y Martinez Bertrand, Eduardo': {
        Movil: '968467734'
      },
      'Saquero Martinez, Elena': {
        Movil: '968310000'
      },
      'Lopez Gil, Jose': {
        Movil: '968410718',
        Email: 'farmaciapuertadelorca@neovision.es',
        Web: 'http://www.farmaciapuertadelorca.com'
      },
      'Aranaga Larrinaga, Marina y Perez Plaza, Maria Dolores': {
        Movil: '968254143'
      },
      'Cremades Prieto, Francisco Vicente': {
        Movil: '968610899'
      },
      'Campillo García, Fulgencio': {
        Movil: '968641743',
        DNI_CIF: 'E73949364'
      },
      'Crespo Castillo, Andrés Jerónimo': {
        Movil: '968422003'
      },
      'Cerezo Musso, María Isabel': {
        Movil: '968423385'
      },
      'Ramos Cerezo, Julia María': {
        Movil: '968577106'
      },
      'Ramón Meroño, Marina': {
        Movil: '968577768',
        Email: 'farmarinatp@gmail.com'
      },
      'Muñoz Hoss, Mª Victoria': {
        Movil: '968577475',
        Email: 'farmariavictoria@gmail.com'
      },
      'Pérez Ferrer, Belén': {
        Movil: '968180061',
        DNI_CIF: 'E05555602'
      },
      'Samper Saura, Rocío del Mar': {
        Movil: '968185756'
      },
      'Conesa Garrigos, Pilar': {
        Movil: '968183798'
      },
      'Mustieles Marín, Juan Antonio': {
        Movil: '968185622'
      },
      'Sanz Guareño, Ana María': {
        Movil: ''
      },
      'Sánchez Jurado, Miguel Angel': {
        Movil: '968190621',
        Email: 'farmaciasanchezjurado@gmail.com',
        Web: 'http://www.farmaciasanchezjuradofmas.com'
      },
      'Rivera Rocamora, Pedro A': {
        Movil: '968571491'
      },
      'Fernández Ibáñez, Matilde': {
        Movil: '968191138'
      },
      'Vidal Pérez, Francisco Jaime e Hita Jiménez, María Inmaculada': {
        Movil: '968483323',
        DNI_CIF: 'E73374043',
        Web: 'http://www.farmaciavidalfmas.com'
      },
      'Martínez Gómez, Francisca': {
        Movil: '968400279'
      },
      'Martínez García, Robustiano, y Martínez Serrano, Antonio Juan': {
        Movil: '968401350',
        DNI_CIF: 'E73116675'
      },
      'Gómez García, Juan de Dios': {
        Movil: '968402610'
      },
      'García Caballero, Matilde Gloria': {
        Movil: '968402031'
      },
      'Martínez Pedreño, Remedios y Francisco': {
        Movil: '968301081'
      },
      'García Marín, Josefa': {
        Movil: '968203203'
      },
      'Carazo Fernández, Antonio': {
        Movil: '968311880'
      },
      'Soler Segarra, Manuel y Soler Tenorio, José Ramón': {
        Movil: '968801851',
        DNI_CIF: 'E73487266'
      },
      'Mendoza Otón, Jose': {
        Movil: '968556368'
      },
      'Ballester Meroño, Alfonso': {
        Movil: '968556262'
      },
      'Romero Gómez, Antonio Luís': {
        Movil: '968145147'
      },
      'Martínez Fernández, Matilde': {
        Movil: '968253508'
      },
      'Sánchez Sánchez, Pedro': {
        Movil: '968293522',
        Web: 'http://www.farmaciasinreceta.es'
      },
      'Alarcón Fuentes, Isabel': {
        Movil: '968292714',
        DNI_CIF: '27470735H'
      },
      'Abenza López, Jose María y Sánchez Hurtado, Antonia': {
        Movil: '968262996',
        DNI_CIF: 'E73611253'
      },
      'Armero Martí, Trinidad': {
        Movil: '968241930'
      },
      'Belmonte Baño, Antonio': {
        Movil: '968219940'
      },
      'Conesa Martínez, Ana María y Calatrava Torres, Manuel': {
        Movil: '968135921',
        DNI_CIF: 'E30748503'
      },
      'Corvera-Murcia Alarcón García, Rosa María': {
        Movil: '968380026',
        DNI_CIF: '27452235X'
      },
      'Ladrón de Guevara Mellado, Juan Antonio y Ladrón de Guevara Ruiz, Juan Antonio': {
        Movil: '',
        DNI_CIF: 'E73751117'
      },
      'García Legaz, Encarnación': {
        Movil: '968882055'
      },
      'Jiménez Cervantes, María del Carmen': {
        Movil: '968174363'
      },
      'Rama Pagan, María Jesús': {
        Movil: '968135641'
      },
      'Enz-Meseguer Pastor, Marta': {
        Movil: '968865927'
      },
      'Lucas Elio, María Cruz y Mónica': {
        Movil: '968761226',
        Email: 'farmacialucaselio@gmail.com'
      },
      'Avilés Inglés, Esther y Sáez Almagro, Antonio': {
        Movil: '968513339',
        DNI_CIF: 'E73017956',
        Web: 'http://www.farmaciasaezavilesfmas.com'
      },
      'Buendía Mayordomo, Diego': {
        Movil: '968510197',
        Web: 'http://www.farmaciabuendiafmas.com'
      },
      'Torre Soler, Victoria Susana': {
        Movil: '968745489',
        DNI_CIF: 'E05505672'
      },
      'Celdrán Poyato, María Carmen y Farinós Celdrán, Ignacio': {
        Movil: '968508238'
      },
      'Anunci Gelabert, Jose Luís y Anunci Díaz, Jose Luís': {
        Movil: '968505535',
        DNI_CIF: 'E02923209'
      },
      'Mora Flores, Maria Teresa': {
        Movil: '968234906',
        Email: 'teresa.mora@farmamora.es',
        Web: 'http://www.farmamora.es',
        DNI_CIF: '34788984N'
      },
      'Visedo Tomas, Elisa': {
        Movil: '968261959',
        Email: 'elisavisedotomas@gmail.com',
        DNI_CIF: '48700330S'
      },
      'Garcia Garcia, Yolanda': {
        Movil: '968649111',
        Web: 'http://www.farmaciariberademolina.es',
        DNI_CIF: '22473153Z'
      },
      'Marin Sanchez, Juan Pedro y Jose Luis': {
        Movil: '968218699',
        Web: 'http://www.farmacia24horasfmas.com',
        DNI_CIF: 'E30536031'
      },
      'Salinas Hernandez, Maria del Carmen y Alejandro': {
        Movil: '',
        DNI_CIF: 'E73755837'
      },
      'Molina Martinez, Cristobal': {
        Movil: '968740452',
        DNI_CIF: '24210748M'
      },
      'Ladron de Guevara Ruiz, Juan Antonio': {
        Movil: '968760306',
        DNI_CIF: 'E73751117'
      },
      'Carazo Fernandez, Antonio y Carazo Gil, Maria de los Desamparados': {
        Movil: '968301880'
      },
      'Hernandez-gil Monfort, Luis Carlos': {
        Movil: '968698466'
      },
      'Belmonte Guillen, Marina': {
        Movil: ''
      },
      'Caparros Lopez, Amparo': {
        Movil: '968708096'
      },
      'Mendoza Oton, Jose': {
        Movil: '968556368'
      },
      'Hernandez Egea, Enrique': {
        Movil: '968269538'
      },
      'Suarez Hurle, Norma': {
        Movil: '968502243'
      },
      'Varona Gomez, Carmen Maria': {
        Movil: '968865266'
      },
      'Lopez Puerta, Elena Juana y Castaño Bahlsen, Dulce Nombre de Maria': {
        Movil: '968560408'
      },
      'Soria Fernandez-Mayoralas, Manuel': {
        Movil: '968693573'
      },
      'Garcia Prieto, Maria Dolores': {
        Movil: '968213048'
      },
      'La Iglesia Lozano, Maria del Mar': {
        Movil: ''
      },
      'Villar Bueno, Joaquin': {
        Movil: '',
        DNI_CIF: '25969206K'
      },
      'Castillo Castro, Elena': {
        Movil: '968466313',
        DNI_CIF: 'E73468704'
      },
      'Guillen Whelan, Manuel': {
        Movil: '968780165',
        Email: 'farmaciaguillen@gmail.com',
        DNI_CIF: '77511577R'
      },
      'Azorin Piñol, Aurora y Gomez Azorin, Beatriz': {
        Movil: '968780130',
        DNI_CIF: 'E73981706'
      },
      'Ayala Gonzalez, Francisco': {
        Movil: '968694455',
        Web: 'http://www.boticayala.com',
        DNI_CIF: '76964572V'
      },
      'Castiñeiras Bueno, Victoria': {
        Movil: '968466106'
      },
      'Garcia Perez, Jose Antonio': {
        Movil: '968466152'
      },
      'Mazzuchelli Perez, Amalia': {
        Movil: '968466968'
      },
      'Agulló García, Alberto Jaime': {
        Movil: '968780088'
      },
      'Soriano Ortega, Jorge': {
        Movil: '968780005',
        Email: 'farmaciasoriano1@hotmail.com'
      },
      'Perez Belda, Pascuala Maria y Mendoza Perez, Maria Isabel': {
        Movil: '968685007'
      },
      'Sanchez de Alcazar Alonso, Maria del Mar': {
        Movil: '968597003'
      },
      'Andujar Rivas, Teresa': {
        Movil: '968742834'
      },
      'Escobedo Cano, Maria Dolores': {
        Movil: '968740038',
        Web: 'http://www.farmaciadelolaescobedofmas.com'
      },
      'Castillo Guerrero, Jose Luis': {
        Movil: '968740519'
      },
      'Rosique Tabuenca, Aranzazu': {
        Movil: '968720357',
        Web: 'http://www.farmaciarosique.es'
      },
      'Bartual Carratala, Concepcion': {
        Movil: '968746457'
      },
      'Riquelme Cascales, Jesus': {
        Movil: '968801042'
      },
      'Saez Mestre, Luis Emilio': {
        Movil: '968708459',
        DNI_CIF: '52810589J'
      },
      'Lopez-battu Serra, Joaquin y Purificacion': {
        Movil: '968708317'
      },
      'Lopez Salueña, Maria del Rosario': {
        Movil: '968708412',
        Email: 'rosariolopezfarmacia@hotmail.com',
        DNI_CIF: '74435607V'
      },
      'Aniorte Rueda, Eloisa': {
        Movil: '683618319'
      },
      'Jordan Bueso, Joaquin': {
        Movil: '968454523',
        Email: 'info@tubotica365.com',
        Web: 'http://www.tubotica365.com'
      },
      'Alonso Caceres, Maria del Pilar': {
        Movil: '968760197'
      },
      'Penalva Belmonte, Angel Francisco': {
        Movil: ''
      },
      'Carricondo Carricondo, Maria Carmen': {
        Movil: '968560005'
      },
      'Rama Pagan, Maria Jesus': {
        Movil: '968135641'
      },
      'Sanchez Hernandez, Maria Isabel': {
        Movil: '968630161'
      },
      'Lopez Martinez-Mena, Benjamin': {
        Movil: '968630012',
        DNI_CIF: '22443351C'
      },
      'Serrano Landaberea, Elena Maria': {
        Movil: '968630047',
        DNI_CIF: 'E30400758'
      },
      'Gomez Vargas, Clara': {
        Movil: '968774533'
      },
      'Yelo Yelo, Isabel': {
        Movil: '968450686',
        Web: 'http://www.farmaciaisabelyelofmas.com'
      },
      'Ruiz Martinez, Jose Javier': {
        Movil: '968770037'
      },
      'Pacheco Atienza, Arsenio y Pacheco Lopez, Arsenio': {
        Movil: '968680018',
        Web: 'http://www.farmaciapacheco.com'
      },
      'Garcia Miras, Eva Maria': {
        Movil: '968411037',
        DNI_CIF: 'E73250359'
      },
      'Garcia Villalba, Manuel y Montalvo Gomez, Maria Pilar': {
        Movil: '968413150'
      },
      'Gallego Ibañez, Jose Maria': {
        Movil: '968410213'
      },
      'Ramos Bleda, Irene': {
        Movil: '617782964'
      },
      'Menarguez Carreño, Reyes': {
        Movil: '968800197',
        DNI_CIF: 'E30538599'
      },
      'Rubio Fernandez, Maria': {
        Movil: '968802950',
        Web: 'http://www.farmaciamariarubio.es'
      },
      'Peñalver Castellon, Maria Isabel': {
        Movil: '968820080'
      },
      'Perez Andujar, Rocio y Perez Andujar, Eva': {
        Movil: '',
        Web: 'http://www.farmaciaperezandujarfmas.com',
        DNI_CIF: 'E02872919'
      },
      'Garcia-estañ Mino, Fuensanta y Rosario': {
        Movil: '968884389',
        Web: 'http://www.farmaciagarciaestanfmas.com'
      },
      'Martinez Barquero, Maria Teresa': {
        Movil: '968253508'
      },
      'Torregrosa Cerdan, Maria Luisa': {
        Movil: '968800934'
      },
      'Alcazar Moreno, Cristobal y Alcazar Marquez, Antonio': {
        Movil: '968830522'
      },
      'Mora Flores, Cristina': {
        Movil: '968879962',
        Web: 'http://www.espinardo.farmaciamora.es'
      },
      'Marina Chicote, Javier': {
        Movil: '968821052'
      },
      'Zaragoza Noguera, Rogelio': {
        Movil: '968821679'
      },
      'Morales Arnau, Juana Maria y Almansa Morales, Cristina Almudena': {
        Movil: '968810018'
      },
      'Egea Aviles, Almudena y Helena': {
        Movil: '968840361'
      },
      'Escarabajal Garcia-Pagan, Magdalena y Millan Escarabajal, Almudena': {
        Movil: '968842480'
      },
      'Esquer German, Maria Begona': {
        Movil: '968293402'
      },
      'De Aguilar-Amat Prior, Juan': {
        Movil: '',
        Web: 'http://www.farmaprior.es',
        DNI_CIF: '48390696F'
      },
      'Agullo Zaragoza, Carmen Pilar': {
        Movil: '968266094'
      },
      'Fernandez Perez, Carlos': {
        Movil: '968233327',
        Web: 'http://www.carlosfernandezfarmacia.es',
        DNI_CIF: 'E73957011'
      },
      'Aleman Aleman, Francisco': {
        Movil: '968350225'
      },
      'Paya Peñalver, Paula': {
        Movil: ''
      },
      'Martinez Moreno, Pedro': {
        Movil: '968504384'
      },
      'Serna Fuentes, Juan': {
        Movil: '968254550'
      },
      'Garcia Blasco, Maria Amparo': {
        Movil: '968214836'
      },
      'Martinez Bellvis, Eduardo Luis': {
        Movil: '968214301'
      },
      'Garcia-lax Espinosa, Encarnacion': {
        Movil: '968263865'
      },
      'Sanchez Bernal, Bartolome': {
        Movil: '968222598',
        DNI_CIF: 'E30545883'
      },
      'Abad Aragon, Maria Soledad': {
        Movil: '968212715',
        DNI_CIF: '23291078J'
      },
      'Garcia Simon, Francisco Javier': {
        Movil: '968248104'
      },
      'Lopez Cremades, Jose Joaquin': {
        Movil: '',
        Web: 'http://www.farmacarmelitana.es',
        DNI_CIF: '52802379Z'
      },
      'Molina Gimenez, Manuela': {
        Movil: '968205152'
      },
      'De Aguilar-Amat Prior, Maria Manuela': {
        Movil: '968216640'
      },
      'Sanchez Martinez, Diego Pablo': {
        Movil: ''
      },
      'Sandoval Barnuevo, Eugenio': {
        Movil: '968211849'
      },
      'Galisteo Cano, Concepcion': {
        Movil: '968219855'
      }
    };
    
    // Obtener todos los clientes
    const clientes = await crm.query('SELECT * FROM clientes');
    console.log(`📊 Total de clientes: ${clientes.length}\n`);
    
    let actualizados = 0;
    const estadisticas = {
      conDireccion: 0,
      conTelefono: 0,
      conEmail: 0,
      conCodigoPostal: 0,
      conPoblacion: 0,
      conWeb: 0
    };
    
    for (const cliente of clientes) {
      const nombre = (cliente.Nombre_Razon_Social || cliente.Nombre || '').trim();
      const info = infoEncontrada[nombre];
      
      if (!info) continue;
      
      const actualizaciones = {};
      
      if (info.Direccion && !cliente.Direccion) {
        actualizaciones.Direccion = info.Direccion;
      }
      
      if (info.Movil && !cliente.Movil) {
        actualizaciones.Movil = limpiarTelefono(info.Movil);
      }
      
      if (info.Email && !cliente.Email) {
        actualizaciones.Email = info.Email;
      }
      
      if (info.CodigoPostal && !cliente.CodigoPostal) {
        actualizaciones.CodigoPostal = info.CodigoPostal;
      }
      
      if (info.Poblacion && !cliente.Poblacion) {
        actualizaciones.Poblacion = info.Poblacion;
      }
      
      if (info.Web && !cliente.Web) {
        actualizaciones.Web = info.Web;
      }
      
      if (info.DNI_CIF && (!cliente.DNI_CIF || cliente.DNI_CIF.trim() === '')) {
        actualizaciones.DNI_CIF = info.DNI_CIF;
      }
      
      // Asociar provincia por código postal si es necesario
      if (actualizaciones.CodigoPostal || cliente.CodigoPostal) {
        const cp = actualizaciones.CodigoPostal || cliente.CodigoPostal;
        const provinciaId = obtenerProvinciaPorCodigoPostal(cp, provinciasDB);
        if (provinciaId && !cliente.Id_Provincia) {
          actualizaciones.Id_Provincia = provinciaId;
        }
      }
      
      if (Object.keys(actualizaciones).length > 0) {
        await crm.updateCliente(cliente.id || cliente.Id, actualizaciones);
        console.log(`✅ Actualizado: ${nombre}`);
        actualizados++;
      }
    }
    
    console.log(`\n✅ Actualización completada: ${actualizados} clientes actualizados\n`);
    
    // Estadísticas
    const clientesActualizados = await crm.query('SELECT * FROM clientes');
    clientesActualizados.forEach(c => {
      if (c.Direccion) estadisticas.conDireccion++;
      if (c.Movil || c.Telefono) estadisticas.conTelefono++;
      if (c.Email) estadisticas.conEmail++;
      if (c.CodigoPostal) estadisticas.conCodigoPostal++;
      if (c.Poblacion) estadisticas.conPoblacion++;
      if (c.Web) estadisticas.conWeb++;
    });
    
    console.log('📈 Estadísticas:');
    console.log(`   Con dirección: ${estadisticas.conDireccion} (${((estadisticas.conDireccion / clientesActualizados.length) * 100).toFixed(1)}%)`);
    console.log(`   Con teléfono: ${estadisticas.conTelefono} (${((estadisticas.conTelefono / clientesActualizados.length) * 100).toFixed(1)}%)`);
    console.log(`   Con email: ${estadisticas.conEmail} (${((estadisticas.conEmail / clientesActualizados.length) * 100).toFixed(1)}%)`);
    console.log(`   Con código postal: ${estadisticas.conCodigoPostal} (${((estadisticas.conCodigoPostal / clientesActualizados.length) * 100).toFixed(1)}%)`);
    console.log(`   Con población: ${estadisticas.conPoblacion} (${((estadisticas.conPoblacion / clientesActualizados.length) * 100).toFixed(1)}%)`);
    console.log(`   Con web/URL: ${estadisticas.conWeb} (${((estadisticas.conWeb / clientesActualizados.length) * 100).toFixed(1)}%)\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  actualizarClientesConDatos();
}

module.exports = { actualizarClientesConDatos };
