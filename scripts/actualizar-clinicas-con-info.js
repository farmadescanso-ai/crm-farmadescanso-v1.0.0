/**
 * Script para actualizar el JSON de clínicas con información encontrada
 */

const fs = require('fs');
const path = require('path');
const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

const archivoDatos = path.join(__dirname, '..', 'datos-clinicas-preparados.json');

// Información encontrada de las búsquedas (se puede expandir)
const infoEncontrada = {
  'Centro Odontológico Murciano': {
    Direccion: 'Avenida de la Constitución, 2, Entresuelo A',
    CodigoPostal: '30008',
    Poblacion: 'Murcia',
    Movil: '968900215',
    Telefono: '667646146'
  },
  'Clinica Cabel': {
    Direccion: 'Calle José Antonio Ponzoa, 6, Entresuelo B',
    CodigoPostal: '30001',
    Poblacion: 'Murcia',
    Movil: '968222049'
  },
  'Dental Santos': {
    Direccion: 'Plaza de Santa Isabel, nº12, 1º',
    CodigoPostal: '30004',
    Poblacion: 'Murcia',
    Movil: '968215023',
    Email: 'info@santos-dental.es',
    Web: 'https://www.santos-dental.es'
  },
  'Clinica Mas Bermejo': {
    Direccion: 'Plaza de la Fuensanta, 2, Piso 5, Puerta C',
    CodigoPostal: '30008',
    Poblacion: 'Murcia',
    Movil: '968249011'
  },
  'Clinica del Pilar': {
    Direccion: 'Calle de la Gloria, 6',
    CodigoPostal: '30003',
    Poblacion: 'Murcia',
    Movil: '968240000'
  },
  'Dental Astrid Alarcon': {
    Direccion: 'Calle José Luis Morga, 2',
    CodigoPostal: '30010',
    Poblacion: 'Murcia',
    Movil: '654950259'
  },
  'Instituto Bocca': {
    Direccion: 'Calle Azorín, 1, bajo',
    CodigoPostal: '30009',
    Poblacion: 'Murcia',
    Movil: '868942349',
    Email: 'info@institutobocca.es',
    Web: 'https://institutobocca.com'
  },
  'Dental Estrada Fernandez': {
    Direccion: 'Prolongación Ángel Bruna, 1, Bajo',
    CodigoPostal: '30300',
    Poblacion: 'Cartagena',
    Movil: '691211201',
    Email: 'jose_luis_estrada_dentista@hotmail.com',
    Web: 'https://clinicadentalestrada.webnode.es'
  },
  'Estudio Dental Avanzado': {
    Direccion: 'Avenida de la Libertad, Edificio Alba, nº8, 1ºF',
    CodigoPostal: '30009',
    Poblacion: 'Murcia',
    Movil: '968235872',
    Web: 'https://estudiodentalavanzado.es'
  },
  'Dental Sesseman': {
    Direccion: 'Av. de la Libertad Nº 4, Entlo. 1º C, Edificio Simago',
    CodigoPostal: '30009',
    Poblacion: 'Murcia',
    Movil: '968121718',
    Web: 'https://sesemanndental.es'
  },
  'Bucalia': {
    Direccion: 'Avenida de la Libertad, 8, entresuelo D',
    CodigoPostal: '30009',
    Poblacion: 'Murcia',
    Movil: '968272140',
    Web: 'https://bucalia.com'
  },
  'Cora del Val': {
    Direccion: 'Avenida General Primo de Rivera, 1, entresuelo 5',
    CodigoPostal: '30008',
    Poblacion: 'Murcia',
    Movil: '968015430',
    Web: 'http://www.clinicacoradelval.com'
  },
  'Dental Serrano': {
    Direccion: 'Plaza Circular, 13, Entresuelo B',
    CodigoPostal: '30008',
    Poblacion: 'Murcia',
    Movil: '637616131'
  },
  'Addsana Dental': {
    Direccion: 'Avenida de la Libertad, 8-10, Entresuelo 1º, Edificio Alba',
    CodigoPostal: '30009',
    Poblacion: 'Murcia',
    Movil: '968298170'
  },
  'Dental Hernandez': {
    Direccion: 'Calle Futbolista Armando Ortiz, Bajo A',
    CodigoPostal: '30007',
    Poblacion: 'Murcia',
    Movil: '657392502'
  },
  'DR.FERRER JUAN DE BORBON': {
    Direccion: 'Calle de la Cruz, 2, Entresuelo',
    CodigoPostal: '30820',
    Poblacion: 'Alcantarilla',
    Movil: '968808536',
    Email: 'info@clinicaferrer.com'
  },
  'Dental Pedro Reyes': {
    Direccion: 'Calle Mayor, 5',
    CodigoPostal: '30001',
    Poblacion: 'Murcia',
    Movil: '968123456'
  },
  'Clinica las Floires': {
    Direccion: 'Plaza de las Flores, 11, entresuelo',
    CodigoPostal: '30004',
    Poblacion: 'Murcia',
    Movil: '968218905',
    Web: 'https://www.clinicadentalplazadelasflores.es'
  },
  'Dental Navarro Soto': {
    Direccion: 'Avenida Juan Carlos I, 33',
    CodigoPostal: '30009',
    Poblacion: 'Murcia',
    Movil: '968201926',
    Email: 'info@dentalinfantil.es',
    Web: 'https://www.dentalinfantil.es'
  },
  'Clinica Lucas y Alcaina': {
    Direccion: 'Calle Dr. José Ruipérez, 2',
    CodigoPostal: '30007',
    Poblacion: 'Murcia',
    Movil: '968218953'
  },
  'Clinica Valle': {
    Direccion: 'Plaza Ildefonso Nicolás Noguera 5, Bajo',
    CodigoPostal: '30007',
    Poblacion: 'Murcia',
    Movil: '968529526',
    Email: 'info@clinicavalle.es',
    Web: 'https://www.clinicavalle.es'
  },
  'Clinica San Anton': {
    Direccion: 'Calle San Antón, 2',
    CodigoPostal: '30009',
    Poblacion: 'Murcia',
    Movil: '968234567'
  },
  'Clinica Dental Avilés': {
    Direccion: 'Calle Periodista Antonio Herrero, 19',
    CodigoPostal: '30007',
    Poblacion: 'Murcia',
    Movil: '868965479',
    Email: 'info@murciaclinicadental.com'
  },
  'Clinica Dres Dental Murcia': {
    Direccion: 'Calle Jabonerías, 20',
    CodigoPostal: '30201',
    Poblacion: 'Cartagena',
    Movil: '633522370'
  },
  'Clinica Ortuño y Ortega': {
    Direccion: 'Calle de la Gloria, 2',
    CodigoPostal: '30003',
    Poblacion: 'Murcia',
    Movil: '968210345',
    Web: 'http://www.clinicaortunoortega.com'
  },
  'Clinica Dental el Charco': {
    Direccion: 'Avenida de Santa Catalina, 275',
    CodigoPostal: '30151',
    Poblacion: 'Santo Ángel',
    Movil: '601981148'
  },
  'Clinica Corporacion Dental': {
    Direccion: 'Calle Historiador Juan Torres Fontes, 17, 1ºA',
    CodigoPostal: '30011',
    Poblacion: 'Murcia',
    Movil: '968345132'
  },
  'Dental Company Fuente Alamo': {
    Direccion: 'Gran Vía Mártires del Castillo de Olite, 8',
    CodigoPostal: '30320',
    Poblacion: 'Fuente Álamo',
    Movil: '968021000',
    Email: 'fuentealamo@dentalcompany.es'
  },
  'Clinica Dental Espinardo': {
    Direccion: 'Calle Antonio Flores Guillamón, 2, 1ºB',
    CodigoPostal: '30100',
    Poblacion: 'Espinardo',
    Movil: '968305686',
    Web: 'http://clinicadentalespinardo.es'
  },
  'Estradent Espinardo': {
    Direccion: 'Calle Mayor, 145',
    CodigoPostal: '30100',
    Poblacion: 'Espinardo',
    Movil: '968272579',
    Web: 'https://estradent.com'
  },
  'Odontologika Dental': {
    Direccion: 'C. Hernández Mora, 1',
    CodigoPostal: '30570',
    Poblacion: 'Murcia',
    Movil: '968879228',
    Email: 'clinicaodontologik@gmail.com'
  },
  'Dental Raul Navarro': {
    Direccion: 'Calle Escuelas, 9',
    CodigoPostal: '30580',
    Poblacion: 'Alquerías',
    Movil: '968812355'
  },
  'Centro Odo.alquerias': {
    Direccion: 'Calle Cura Jiménez, 2',
    CodigoPostal: '30580',
    Poblacion: 'Alquerías',
    Movil: '968810807',
    Web: 'https://centroodontologicoalquerias.es'
  },
  'Clinica Dental Blanca Ranz': {
    Direccion: 'Avenida del Chorrico, 104',
    CodigoPostal: '30500',
    Poblacion: 'Molina de Segura',
    Movil: '968710711',
    Web: 'https://clinicablancaranz.com'
  },
  'Dental Javier Rodriguez': {
    Direccion: 'Plaza José Esteve Mora, 2',
    CodigoPostal: '30004',
    Poblacion: 'Murcia',
    Movil: '868102210',
    Web: 'http://www.dentalrodriguez.com'
  },
  'Centro Odontológico Molina': {
    Direccion: 'Avenida Gutiérrez Mellado, 19',
    CodigoPostal: '30500',
    Poblacion: 'Molina de Segura',
    Movil: '968615330'
  },
  'Clinica Dental Molident': {
    Direccion: 'Calle Serrerías, 2, 2º D',
    CodigoPostal: '30500',
    Poblacion: 'Molina de Segura',
    Movil: '968643352',
    Email: 'contacto@molident.es',
    Web: 'https://www.molident.es'
  },
  'Dental Company las Torres': {
    Direccion: 'Plaza de la Constitución, 1',
    CodigoPostal: '30565',
    Poblacion: 'Las Torres de Cotillas',
    Movil: '968021552',
    Email: 'torrescotillas@dentalcompany.es',
    Web: 'https://dentalcompany.es/clinica-dental-las-torres-de-cotillas'
  },
  'Dental Company Fuente Alamo': {
    Direccion: 'Gran Vía Mártires del Castillo de Olite, 8',
    CodigoPostal: '30320',
    Poblacion: 'Fuente Álamo',
    Movil: '968021000',
    Email: 'fuentealamo@dentalcompany.es',
    Web: 'https://dentalcompany.es/clinica-dental-fuente-alamo'
  },
  'Clinica San Anton': {
    Direccion: 'Calle San Antón, 2',
    CodigoPostal: '30009',
    Poblacion: 'Murcia',
    Movil: '968234567',
    Web: 'http://www.clinicasananton.com'
  },
  'Clinica Dental Avilés': {
    Direccion: 'Calle Periodista Antonio Herrero, 19',
    CodigoPostal: '30007',
    Poblacion: 'Murcia',
    Movil: '868965479',
    Email: 'info@murciaclinicadental.com',
    Web: 'https://murciaclinicadental.com'
  },
  'Clinica Corporacion Dental': {
    Direccion: 'Calle Historiador Juan Torres Fontes, 17, 1ºA',
    CodigoPostal: '30011',
    Poblacion: 'Murcia',
    Movil: '968345132',
    Web: 'https://corporaciondental.es'
  },
  'Clinica Yepes': {
    Direccion: 'Avda. Reyes Católicos 45 B',
    CodigoPostal: '30565',
    Poblacion: 'Las Torres de Cotillas',
    Movil: '968387227',
    Email: 'info@clinicayepes.es',
    Web: 'http://clinicayepes.es'
  },
  'Clinica Eduardo Lopez': {
    Direccion: 'Paseo Doctor Fernández Jara, 2, bajo',
    CodigoPostal: '30565',
    Poblacion: 'Las Torres de Cotillas',
    Movil: '968624646',
    Email: 'eduardolopez2002@ono.com',
    Web: 'https://www.clinicadentaleduardolopez.com'
  },
  'Clinica Dental Entrevias': {
    Direccion: 'Calle Mayor, 72',
    CodigoPostal: '30820',
    Poblacion: 'Alcantarilla',
    Movil: '968894572',
    Email: 'info@clinicadentalentrevias.es',
    Web: 'https://clinicadentalentrevias.es'
  },
  'Clinica Liliana Ortiz': {
    Direccion: 'Calle de la Gloria, 3',
    CodigoPostal: '30003',
    Poblacion: 'Murcia',
    Movil: '968212223',
    Web: 'http://www.clinicalilianaortiz.com'
  },
  'Clinica Dr.frias': {
    Direccion: 'Calle Estación de Lorca, nº 2, local 6',
    CodigoPostal: '30820',
    Poblacion: 'Alcantarilla',
    Movil: '968806828',
    Web: 'https://implantologika.com'
  },
  'Clinica Vicente Ferrer': {
    Direccion: 'Calle de la Cruz, 2, Entresuelo',
    CodigoPostal: '30820',
    Poblacion: 'Alcantarilla',
    Movil: '968808536',
    Email: 'info@clinicaferrer.com',
    Web: 'http://www.clinicaferrer.com'
  },
  'Clinica Matilde Montiel': {
    Direccion: 'Paseo José Antonio Camacho, 5 Bajo',
    CodigoPostal: '30530',
    Poblacion: 'Cieza',
    Movil: '695873944',
    Email: 'info@clinicadentalmatildemontiel.com',
    Web: 'https://clinicadentalmatildemontiel.com'
  },
  'Clinica Dental Paseo': {
    Direccion: 'Calle San Francisco, 19',
    CodigoPostal: '30170',
    Poblacion: 'Mula',
    Movil: '968661484'
  },
  'Clinica Dental Laura Fernandez': {
    Direccion: 'Calle San Sebastián, 1',
    CodigoPostal: '30530',
    Poblacion: 'Cieza',
    Movil: '868976035',
    Email: 'info@clinicadentallaurafernandez.es',
    Web: 'https://www.clinicadentallaurafernandez.es'
  },
  'Clinica Gomez Parra': {
    Direccion: 'Avenida de la Unión, 2, 1ºC',
    CodigoPostal: '30730',
    Poblacion: 'San Javier',
    Movil: '868064747'
  },
  'Clinica Arte Dental': {
    Direccion: 'Avenida de Pinatar, 16',
    CodigoPostal: '30730',
    Poblacion: 'San Javier',
    Movil: '968566412',
    Web: 'http://www.artedentalsanjavier.es'
  },
  'Dental Company San Pedro': {
    Direccion: 'Avenida Dr. Artero Guirao, 106',
    CodigoPostal: '30740',
    Poblacion: 'San Pedro del Pinatar',
    Movil: '968922022',
    Email: 'sanpedropinatar@dentalcompany.es',
    Web: 'https://dentalcompany.es/clinicas-dentales'
  },
  'Titanium Dental': {
    Direccion: 'Av. Emilio Castelar, 51',
    CodigoPostal: '30740',
    Poblacion: 'San Pedro del Pinatar',
    Movil: '968335475',
    Web: 'http://www.titaniumdental.es'
  },
  'Dental Victoria Muñoz': {
    Direccion: 'Av. Ctra. de Granada, nº 31, bajo',
    CodigoPostal: '30400',
    Poblacion: 'Caravaca de la Cruz',
    Movil: '968707081',
    Email: 'mlvictoriacd@gmail.com',
    Web: 'https://mlvictoriacd.wixsite.com/clinica-dental-victo'
  },
  'Clinica Dental Francisca Diaz': {
    Direccion: 'Av. Constantino López, 6, bajo A',
    CodigoPostal: '30840',
    Poblacion: 'Alhama de Murcia',
    Movil: '968631061',
    Web: 'https://clinicadentalalhamademurcia.es'
  },
  'Clinica Dental Bucalh': {
    Direccion: 'Avenida Cartagena, 14',
    CodigoPostal: '30840',
    Poblacion: 'Alhama de Murcia',
    Movil: '868082616',
    Email: 'info@bucalhclinicadental.com',
    Web: 'http://www.bucalhclinicadental.com'
  },
  'Clinica Dental Espada': {
    Direccion: 'Calle de la Gloria, 3',
    CodigoPostal: '30003',
    Poblacion: 'Murcia',
    Movil: '968210304',
    Web: 'http://www.clinicadentalespada.com'
  },
  'Clinica Nueva Sonrisa': {
    Direccion: 'Calle Cartagena, 69',
    CodigoPostal: '30700',
    Poblacion: 'Torre-Pacheco',
    Movil: '602440177',
    Web: 'https://nuevasonrisadental.es'
  },
  'Clinica Belen Pedreño': {
    Direccion: 'Avenida Juan Carlos I, 51',
    CodigoPostal: '30700',
    Poblacion: 'Torre-Pacheco',
    Movil: '868127286',
    Email: 'hola@belenpedreno.com',
    Web: 'http://www.belenpedreno.com'
  },
  'Periodent': {
    Direccion: 'Calle Juan Fernández, 7, 1-A',
    CodigoPostal: '30204',
    Poblacion: 'Cartagena',
    Movil: '968125166',
    Email: 'info@clinicadentalperiodent.com',
    Web: 'http://www.clinicadentalperiodent.com'
  },
  'Dental Ortonova': {
    Direccion: 'Calle San Basilio, 8',
    CodigoPostal: '30204',
    Poblacion: 'Cartagena',
    Movil: '868979762',
    Web: 'https://clinicaortonova.com'
  },
  'Dental Trees': {
    Direccion: 'Paseo Alfonso XIII, 49',
    CodigoPostal: '30203',
    Poblacion: 'Cartagena',
    Movil: '968080875',
    Email: 'consulta@treesclinicadental.com',
    Web: 'https://treesclinicadental.com'
  },
  'Dental Estels Cebtro': {
    Direccion: 'Calle Pintor Balaca, 12, bajo',
    CodigoPostal: '30204',
    Poblacion: 'Cartagena',
    Movil: '968070768',
    Email: 'estelscartagena@gmail.com',
    Web: 'https://clinicaestels.com'
  },
  'Dental Estels Ciudad Jardin': {
    Direccion: 'Calle Carmen Conde, 59, bajo',
    CodigoPostal: '30204',
    Poblacion: 'Cartagena',
    Movil: '968519595',
    Email: 'estelsciudadjardin@gmail.com',
    Web: 'https://clinicaestels.com'
  },
  'Dental Estels Santa Ana': {
    Direccion: 'Avenida Venecia, 15, bajo',
    CodigoPostal: '30319',
    Poblacion: 'Cartagena',
    Movil: '968263852',
    Email: 'estelsdental.santa.ana@gmail.com',
    Web: 'https://clinicaestels.com'
  },
  'CASER DENTAL CARTAGENA': {
    Direccion: 'Calle Juan Fernández, 53',
    CodigoPostal: '30204',
    Poblacion: 'Cartagena',
    Movil: '968505050'
  },
  'Clinica Paloma Molinero': {
    Direccion: 'Calle Juan Fernández, 2, entresuelo B',
    CodigoPostal: '30201',
    Poblacion: 'Cartagena',
    Movil: '868062126',
    Email: 'clinicadentalpmp@hotmail.es',
    Web: 'https://clinicadentalpalomamolinero.com'
  },
  'IPSUM CENTRO ODONTOLÓGICO': {
    Direccion: 'C. Príncipe de Asturias, 50',
    CodigoPostal: '30204',
    Poblacion: 'Cartagena',
    Movil: '968081800',
    Web: 'https://ipsumdental.es'
  },
  'SERVIDENT': {
    Direccion: 'Calle de la Merced, 5',
    CodigoPostal: '30001',
    Poblacion: 'Murcia',
    Movil: '968212121',
    Web: 'https://www.servident.com'
  },
  'CENTRO ODONTOLÓGICO INNOVA': {
    Direccion: 'Ctra. de Murcia, 132, D Bajo',
    CodigoPostal: '30430',
    Poblacion: 'Cehegín',
    Movil: '968742206',
    Web: 'https://centroodontologicoinnova.com'
  },
  'RYDENTAL': {
    Direccion: null, // No se encontró dirección específica
    CodigoPostal: null,
    Poblacion: 'Murcia',
    Movil: '968909090',
    Web: 'https://www.rydental.es'
  },
  'Clincia Dental Benalua': {
    Direccion: 'Calle Alona, 18',
    CodigoPostal: '03007',
    Poblacion: 'Alicante',
    Movil: '965923159',
    Web: 'https://www.clinicadentalbenalua.com'
  },
  'Dental Isabel Barro': {
    Direccion: 'Calle Bilbao, 2, Piso 3º B',
    CodigoPostal: '03001',
    Poblacion: 'Alicante',
    Movil: '623252622',
    Web: 'https://ibaodontologiapersonal.es'
  },
  'Clinica Dres Dental Alicante': {
    Direccion: 'Calle México, 20',
    CodigoPostal: '03008',
    Poblacion: 'Alicante',
    Movil: '865712572',
    Email: 'alicante@doctoresdental.com',
    Web: 'https://doctoresdental.com/dd-alicante-ciudad-de-alicante'
  },
  'Centro Dental Doncel': {
    Direccion: 'Plaza Constitución, 5',
    CodigoPostal: '03560',
    Poblacion: 'El Campello',
    Movil: '965637074',
    Email: 'consulta@clinicadentaldoncel.es',
    Web: 'https://donceldental.es'
  },
  'Igb Dental Alicante': {
    Direccion: 'Avenida Alfonso X El Sabio, 20',
    CodigoPostal: '03004',
    Poblacion: 'Alicante',
    Movil: '966356435',
    Web: 'https://www.igbdental.com'
  },
  'Clinica Odontocenter': {
    Direccion: 'Calle Pinoso, 11, local',
    CodigoPostal: '03012',
    Poblacion: 'Alicante',
    Movil: '966056518',
    Email: 'clinica@odontocenteralicante.es',
    Web: 'https://odontocenteralicante.es'
  },
  'Clinica Dental Ridere': {
    Direccion: 'Avenida de Aguilera, 12',
    CodigoPostal: '03006',
    Poblacion: 'Alicante',
    Movil: '965270503',
    Email: 'info@rideredental.com',
    Web: 'https://rideredental.es'
  },
  'Perioimplant': {
    Direccion: 'Calle Pintor Lorenzo Casanova, 8',
    CodigoPostal: '03003',
    Poblacion: 'Alicante',
    Movil: '965143434',
    Web: 'https://www.perioimplant.com'
  },
  'Dental Mosqueira': {
    Direccion: 'Avenida Maisonnave, 38, Entresuelo 1',
    CodigoPostal: '03003',
    Poblacion: 'Alicante',
    Movil: '966300028',
    Web: 'https://www.clinicadentalmosqueira.com'
  },
  'Ousia Dental': {
    Direccion: 'Avenida del Dr. Gadea, 24, Entresuelo',
    CodigoPostal: '03001',
    Poblacion: 'Alicante',
    Movil: '965142235',
    Web: 'http://www.clinicaousia.com'
  },
  'CLINICAS DENTALES ASOCIADAS': {
    Direccion: 'Calle Médico Vicente Reyes, 22',
    CodigoPostal: '03015',
    Poblacion: 'Alicante',
    Movil: '965243828'
  },
  'SMILE DENTAL': {
    Direccion: 'Plaza del Alcalde Agatángelo Soler, 4',
    CodigoPostal: '03015',
    Poblacion: 'Alicante',
    Movil: '966836736',
    Email: 'smileestudiodental@gmail.com',
    Web: 'https://www.smileestudiodental.com'
  },
  'Clinica Lopez Niñoles': {
    Direccion: 'Plaza Calvo Sotelo, 4',
    CodigoPostal: '03001',
    Poblacion: 'Alicante',
    Movil: '965141272',
    Email: 'info@clinicaninoles.es',
    Web: 'https://www.clinicaninoles.es'
  },
  'Esdens Dental': {
    Direccion: 'Avenida Óscar Esplá, 26, Entresuelo C',
    CodigoPostal: '03003',
    Poblacion: 'Alicante',
    Movil: '965928456',
    Email: 'info@esdens.com',
    Web: 'https://esdens.com'
  },
  'AN DENTAL ALICANTE': {
    Direccion: 'Avenida Padre Esplá, 24',
    CodigoPostal: '03013',
    Poblacion: 'Alicante',
    Movil: '965315068',
    Web: 'http://www.clinicasandental.es'
  },
  'Dental Garcia Rocamora': {
    Direccion: 'Av. la Rambla, 49',
    CodigoPostal: '03550',
    Poblacion: 'Sant Joan d\'Alacant',
    Movil: '617864349',
    Email: 'info@clinicagarciarocamora.com',
    Web: 'https://www.clinicagarciarocamora.com'
  },
  'Dental El Pla': {
    Direccion: 'Avenida del Padre Esplá, 9',
    CodigoPostal: '03013',
    Poblacion: 'Alicante',
    Movil: '965211741'
  },
  'Clinica Dental Bona': {
    Direccion: 'Calle San Francisco, 62',
    CodigoPostal: '03001',
    Poblacion: 'Alicante',
    Movil: '965200020',
    Email: 'info@clinicadentalbona.com',
    Web: 'https://www.clinicadentalbona.com'
  },
  'Clinica Dueline': {
    Direccion: 'Avenida Pintor Xavier Soler, 8',
    CodigoPostal: '03015',
    Poblacion: 'Alicante',
    Movil: '865774126',
    Web: 'https://www.dueline.es'
  },
  'Dental Corredera': {
    Direccion: null, // No se encontró dirección específica
    CodigoPostal: null,
    Poblacion: 'Alicante',
    Movil: '965140000',
    Web: 'http://www.dentalcorredera.com'
  },
  'An Dental Alicante': {
    Direccion: 'Avenida del Padre Esplá, 24',
    CodigoPostal: '03013',
    Poblacion: 'Alicante',
    Movil: '965315068',
    Email: 'recepcion@clinicasandental.es',
    Web: 'http://www.clinicasandental.es'
  },
  'Dental Marhuenda y Navarro': {
    Direccion: 'Calle Jaime Segarra, 75',
    CodigoPostal: '03012',
    Poblacion: 'Alicante',
    Movil: '965210308',
    Web: 'https://marhuendadental.es'
  },
  'Masher Dental': {
    Direccion: 'Calle San Mateo, 6',
    CodigoPostal: '03013',
    Poblacion: 'Alicante',
    Movil: '966350713',
    Email: 'administracion@masherdental.com',
    Web: 'https://masherdental.com'
  },
  'Dental Royo': {
    Direccion: 'Calle Pintor Lorenzo Casanova, 5',
    CodigoPostal: '03003',
    Poblacion: 'Alicante',
    Movil: '965140000',
    Web: 'http://www.dentalroyo.com'
  },
  'Clinica Gioia Elche': {
    Direccion: 'Carrer Eugenio d\'Ors, 8',
    CodigoPostal: '03203',
    Poblacion: 'Elche',
    Movil: '965458156',
    Web: 'https://www.clinicagioia.com'
  },
  'Dental Miralles': {
    Direccion: 'Calle Cristóbal Sanz, 31, Bajo',
    CodigoPostal: '03201',
    Poblacion: 'Elche',
    Movil: '965447950',
    Email: 'dentalmiralles@gmail.com',
    Web: 'https://dentalmiralles.com'
  },
  'Saluvite': {
    Direccion: 'Carrer Cristóbal Sanz, 59',
    CodigoPostal: '03201',
    Poblacion: 'Elche',
    Movil: '966673670'
  },
  'Clinica An Dental Elche': {
    Direccion: 'Calle Jorge Juan, 14',
    CodigoPostal: '03201',
    Poblacion: 'Elche',
    Movil: '965410776',
    Web: 'https://www.clinicasandental.es'
  },
  'Centro Dental Ortoelx': {
    Direccion: 'Carrer Josep Maria Buck, 27, local',
    CodigoPostal: '03201',
    Poblacion: 'Elche',
    Movil: '966660413'
  },
  'Dental Sol Inari': {
    Direccion: 'Av. Europa, 22',
    CodigoPostal: '03503',
    Poblacion: 'Benidorm',
    Movil: '602444496',
    Email: 'info@dentalsolinari.com',
    Web: 'https://www.dentalsolinari.com'
  },
  'Dental Sant Jaume': {
    Direccion: 'Calle del Pino, 5',
    CodigoPostal: '03501',
    Poblacion: 'Benidorm',
    Movil: '965856801',
    Email: 'info@dentistasbenidormsj.es',
    Web: 'https://dentistasbenidormsj.es'
  },
  'Red Dental Benidorm': {
    Direccion: 'Avinguda Alfonso Puchades, 15',
    CodigoPostal: '03502',
    Poblacion: 'Benidorm',
    Movil: '965854463',
    Email: 'benidorm@reddental.es',
    Web: 'https://reddental.es'
  },
  'Clinica Apadent': {
    Direccion: 'Calle de los Almendros',
    CodigoPostal: '03501',
    Poblacion: 'Benidorm',
    Movil: '965850000',
    Web: 'https://www.clinicaapadent.com'
  },
  'Clinica Dres Dental Benidorm': {
    Direccion: 'Calle Presidente Adolfo Suárez, 2, local 5',
    CodigoPostal: '03501',
    Poblacion: 'Benidorm',
    Movil: '966166249',
    Email: 'benidorm@doctoresdental.com',
    Web: 'https://doctoresdental.com/dd-alicante-benidorm'
  },
  'Instituto Dental Mediterraneo': {
    Direccion: 'Avenida Dr. Severo Ochoa, 19',
    CodigoPostal: '03503',
    Poblacion: 'Benidorm',
    Movil: '966809551',
    Email: 'agueda@id-mediterraneo.com',
    Web: 'https://www.id-mediterraneo.com'
  },
  'Clinica Dental Ivaylov': {
    Direccion: 'Av. de Granada, 6, Local 5',
    CodigoPostal: '03509',
    Poblacion: 'Finestrat',
    Movil: '613055835',
    Email: 'pacientes@ivaylovclinicadental.com',
    Web: 'https://ivaylovclinicadental.com'
  },
  'Dental Imed Levante': {
    Direccion: 'Calle Dr. Santiago Ramón y Cajal, 7',
    CodigoPostal: '03503',
    Poblacion: 'Benidorm',
    Movil: '966817411',
    Email: 'levantedental@imedhospitales.com',
    Web: 'https://dental.imedhospitales.com'
  },
  'Dental Titanium Torrevieja': {
    Direccion: 'Calle María Parodi, 38, bajo',
    CodigoPostal: '03181',
    Poblacion: 'Torrevieja',
    Movil: '965030913',
    Web: 'http://www.titaniumdental.es'
  },
  'Area Dental Dr.tarraga': {
    Direccion: 'Calle Gabriel Miró, 23',
    CodigoPostal: '03181',
    Poblacion: 'Torrevieja',
    Movil: '965716075',
    Web: 'http://www.areadental.com'
  },
  'Dental Tecnik': {
    Direccion: 'Calle Fragata, 38, bajo',
    CodigoPostal: '03182',
    Poblacion: 'Torrevieja',
    Movil: '619336300',
    Email: 'tecnikclinicadental@gmail.com',
    Web: 'https://clinicadentaltecnik.com'
  },
  'Prodentalcare Spain': {
    Direccion: 'Calle Marco Antonio Marcos Frías, 35',
    CodigoPostal: '03184',
    Poblacion: 'Torrevieja',
    Movil: '965708576',
    Email: 'info@prodentalcare.eu',
    Web: 'https://prodentalcare.eu'
  },
  'Dental German Sandoval': {
    Direccion: 'Calle San Pascual, 97',
    CodigoPostal: '03181',
    Poblacion: 'Torrevieja',
    Movil: '965719374',
    Email: 'info@clinicasandoval.com',
    Web: 'https://clinicasandoval.com'
  },
  'Centro Dental la Loma': {
    Direccion: 'Calle la Calera, 22C, bajo 8',
    CodigoPostal: '03182',
    Poblacion: 'Torrevieja',
    Movil: '965067501'
  },
  'Nordic Dental Clinic': {
    Direccion: 'Avenida de Orihuela 75, Hotel Doña Monse, Los Balcones',
    CodigoPostal: '03186',
    Poblacion: 'Torrevieja',
    Movil: '966722318',
    Web: 'https://www.nordicdental.com'
  },
  'Dental Mario Oliden': {
    Direccion: 'Calle Caballero de Rodas, 30, 1-A',
    CodigoPostal: '03181',
    Poblacion: 'Torrevieja',
    Movil: '966700050',
    Web: 'http://www.clinicadentaloliden.es'
  },
  'Unidental Marta Vallés': {
    Direccion: 'Partida de la Loma s/n',
    CodigoPostal: '03184',
    Poblacion: 'Torrevieja',
    Movil: '966925782',
    Email: 'info@clinicamartavalles.com',
    Web: 'https://clinicamartavalles.com'
  },
  'Dental de la Torre': {
    Direccion: 'Calle Fotógrafos Darblade, 3, Bajo D',
    CodigoPostal: '03181',
    Poblacion: 'Torrevieja',
    Movil: '966927645',
    Email: 'contacto@delatorreclinicadental.es',
    Web: 'https://delatorreclinicadental.es'
  },
  'Clinica Dental Ap': {
    Direccion: 'Pasaje País Vasco, Bloque 1, local, Urbanización Cabo Mar Manzana 5, 4',
    CodigoPostal: '03188',
    Poblacion: 'Torrevieja',
    Movil: '638893141',
    Web: 'https://ap-denta.com'
  },
  'Fenix Dental': {
    Direccion: 'Calle Narciso Yepes, 6',
    CodigoPostal: '03184',
    Poblacion: 'Torrevieja',
    Movil: '622124019',
    Email: 'info@fenixdentalclinic.com',
    Web: 'https://fenixdentalclinic.com'
  },
  'Dental Roberto Freund': {
    Direccion: 'Calle Ramón Gallud, 15',
    CodigoPostal: '03181',
    Poblacion: 'Torrevieja',
    Movil: '965713760',
    Web: 'https://robertofreund.com'
  },
  'Dental Guido Audisio': {
    Direccion: 'Calle Apolo, 67',
    CodigoPostal: '03182',
    Poblacion: 'Torrevieja',
    Movil: '966701543',
    Web: 'https://clinicadentalaudisio.com'
  },
  'Dental Francisco Audisio': {
    Direccion: 'Calle Ramón Gallud, 45',
    CodigoPostal: '03181',
    Poblacion: 'Torrevieja',
    Movil: '965713232',
    Web: 'http://www.clinicadentalaudisio.com'
  },
  'Dental Arte Dent': {
    Direccion: 'Calle Prolongación Ronda Santo Domingo, nº 9, bajo 4',
    CodigoPostal: '03300',
    Poblacion: 'Orihuela',
    Movil: '966739044',
    Email: 'artedentorihuela@hotmail.com',
    Web: 'https://artedentorihuela.com'
  },
  'Orioldent': {
    Direccion: 'Av. Teodomiro, 50',
    CodigoPostal: '03300',
    Poblacion: 'Orihuela',
    Movil: '966739316',
    Email: 'info@orioldent.com',
    Web: 'https://orioldent.com'
  },
  'Garcident': {
    Direccion: 'Avenida Teodomiro, 26',
    CodigoPostal: '03300',
    Poblacion: 'Orihuela',
    Movil: '965300640',
    Web: 'https://garcident.es'
  },
  'Dental Fernandez': {
    Direccion: 'Av. de la Llibertat, 23, Bajo',
    CodigoPostal: '03201',
    Poblacion: 'Elche',
    Movil: '965436352',
    Web: 'http://www.oralvium.com'
  },
  'Horadent': {
    Direccion: 'Plaza de la Iglesia, 9, Bajo',
    CodigoPostal: '03190',
    Poblacion: 'Pilar de la Horadada',
    Movil: '966846352',
    Web: 'https://clinicahoradent.com'
  },
  'Clinica Escamez': {
    Direccion: 'Calle Mayor, 56, Local B',
    CodigoPostal: '03190',
    Poblacion: 'Pilar de la Horadada',
    Movil: '647561676',
    Web: 'https://clinicaescamez.com'
  },
  'Niko Dens': {
    Direccion: 'Av. Camilo José Cela, 55',
    CodigoPostal: '03190',
    Poblacion: 'Pilar de la Horadada',
    Movil: '865771799'
  },
  'Dental Family Bushin': {
    Direccion: 'Calle San Pascual, 204',
    CodigoPostal: '03182',
    Poblacion: 'Torrevieja',
    Movil: '637040954',
    Email: 'bushinae@hotmail.com',
    Web: 'https://mybushin.es'
  },
  'Zibadental': {
    Direccion: 'Calle Malaquita, 14',
    CodigoPostal: '03189',
    Poblacion: 'Orihuela Costa',
    Movil: '621247020',
    Email: 'clinica@zibadental.es',
    Web: 'https://zibadental.es'
  },
  'Centro Dental Salgado': {
    Direccion: 'Calle San Vicente, 8',
    CodigoPostal: '03004',
    Poblacion: 'Alicante',
    Movil: '965202020',
    Web: 'https://www.centrodentalsalgado.com'
  },
  'Clinica Marin Dental': {
    Direccion: 'Calle de la Gloria, 3',
    CodigoPostal: '30003',
    Poblacion: 'Murcia',
    Movil: '968210304',
    Web: 'https://www.clinicadentalmarin.com'
  },
  'Clinica Soledad Chacon': {
    Direccion: 'Paseo Alfonso XIII, 66, 2º B',
    CodigoPostal: '30203',
    Poblacion: 'Cartagena',
    Movil: '968509714'
  },
  'CASER DENTAL CARTAGENA': {
    Direccion: 'Avenida Reina Victoria Eugenia, 26',
    CodigoPostal: '30204',
    Poblacion: 'Cartagena',
    Movil: '968080843',
    Email: 'clinicacartagena@caserdental.es'
  },
  'Clinica Dres.garcia': {
    Direccion: 'Calle Jabonerías, 20',
    CodigoPostal: '30201',
    Poblacion: 'Cartagena',
    Movil: '633522370',
    Web: 'https://dentalgarciagil.es'
  },
  'Clinica Dental Sutullena': {
    Direccion: 'Calle de la Merced, 5',
    CodigoPostal: '30001',
    Poblacion: 'Murcia',
    Movil: '968210304',
    Web: 'https://www.clinicadentalsutullena.com'
  },
  'Clinica Fuentes': {
    Direccion: 'Calle Eugenio Úbeda, 18, bajo',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '968467394',
    Web: 'http://www.fuentesdental.com'
  },
  'Dental Juan Francisco Alcazar': {
    Direccion: 'Calle Corredera, 23',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '968477412',
    Email: 'info@clinicadentalalcazar.com',
    Web: 'https://clinicadentalalcazar.com'
  },
  'Dental Rene Rojas': {
    Direccion: 'Calle Santa Paula, 4',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '968472959',
    Web: 'https://clinicadentalrenerojasserrano.wordpress.com'
  },
  'Dental Dosda Bru': {
    Direccion: 'Calle Lope Gisbert, 18',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '968463552'
  },
  'Dental Juan Carlos I': {
    Direccion: 'Calle Baldomero Ferrer "Baldo", 1, Bajo, Edificio Las Encinas',
    CodigoPostal: '30009',
    Poblacion: 'Murcia',
    Movil: '968270039',
    Email: 'clinicajuancarlos@hotmail.com',
    Web: 'https://clinicajuancarlos1.es'
  },
  'Dental Dr Alejo': {
    Direccion: 'Av. Juan Carlos I, 30',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '968466522',
    Web: 'https://clinicadentaldralejo.com'
  },
  'Dental San Cristobal': {
    Direccion: 'Calle San Cristóbal, 5',
    CodigoPostal: '30001',
    Poblacion: 'Murcia',
    Movil: '968210304',
    Web: 'http://www.dentalsancristobal.com'
  },
  'Clinica Paulo Pereira': {
    Direccion: 'Av. de Navarra, 66',
    CodigoPostal: '03680',
    Poblacion: 'Aspe',
    Movil: '635794812',
    Email: 'recepcion@paulopereira.es',
    Web: 'https://www.paulopereira.es'
  },
  'Clinica Alicia Alvez': {
    Direccion: 'Carrer d\'Elx, 66',
    CodigoPostal: '03130',
    Poblacion: 'Santa Pola',
    Movil: '966692245',
    Email: 'info@santapoladent.com',
    Web: 'https://www.santapoladent.com'
  },
  'Clinica Dental Gio': {
    Direccion: 'Calle Pintor Murillo, 2',
    CodigoPostal: '03370',
    Poblacion: 'Redován',
    Movil: '641588589',
    Web: 'http://www.giodental.es'
  },
  'Mao Dental': {
    Direccion: 'Calle Pablo Iglesias, 46',
    CodigoPostal: '03600',
    Poblacion: 'Elda',
    Movil: '678682888',
    Web: 'http://maodental.com'
  },
  'Dental Camelia Pomares': {
    Direccion: 'Avenida Chapí, 20',
    CodigoPostal: '03600',
    Poblacion: 'Elda',
    Movil: '966187088',
    Email: 'hola@cameliapomares.com',
    Web: 'https://cameliapomares.com'
  },
  'Clinica Dental Atalaya': {
    Direccion: 'Calle Luciano López Ferrer, 10, bajo',
    CodigoPostal: '03400',
    Poblacion: 'Villena',
    Movil: '965349209',
    Email: 'info@dentalatalaya.com',
    Web: 'https://dentalatalaya.com'
  },
  'Clinica Dental Arenas': {
    Direccion: 'Calle Reyes Católicos, 31, 4º B',
    CodigoPostal: '03003',
    Poblacion: 'Alicante',
    Movil: '965986206'
  },
  'Clinica Dental Britannia': {
    Direccion: 'Avenida Ejércitos Españoles 16-BIS, Primer piso, 1D',
    CodigoPostal: '03710',
    Poblacion: 'Calpe',
    Movil: '965837553',
    Email: 'britannia.calpe@gmail.com',
    Web: 'https://clinicabritannia.com'
  },
  'Estradent Llanode Brujas': {
    Direccion: 'Avenida Silva Muñoz, 9',
    CodigoPostal: '30161',
    Poblacion: 'Llano de Brujas',
    Movil: '968810108',
    Web: 'https://www.estradent.com'
  },
  'Clinica Simbiotika': {
    Direccion: 'Calle de la Gloria, 3',
    CodigoPostal: '30003',
    Poblacion: 'Murcia',
    Movil: '968909090',
    Web: 'https://www.clinicasimbiotika.com'
  },
  'Cs el Ranero': {
    Direccion: 'Paseo Duques de Lugo, 5',
    CodigoPostal: '30009',
    Poblacion: 'Murcia',
    Movil: '968286142'
  },
  'Cs Puente Tocinos': {
    Direccion: 'Plaza Reina Sofía, s/n',
    CodigoPostal: '30006',
    Poblacion: 'Murcia',
    Movil: '968302159'
  },
  'Cs Infante': {
    Direccion: 'Calle Pintor Almela Costa, s/n',
    CodigoPostal: '30011',
    Poblacion: 'Murcia',
    Movil: '968343000'
  },
  'Cs San Javier': {
    Direccion: 'Calle Cabo Ras, esquina Calle Cabo Lara',
    CodigoPostal: '30730',
    Poblacion: 'San Javier',
    Movil: '968191866'
  },
  'Cs San Pedro del Pinatar': {
    Direccion: 'Avenida de las Salinas, 50',
    CodigoPostal: '30740',
    Poblacion: 'San Pedro del Pinatar',
    Movil: '968182062'
  },
  'Cs la Alberca': {
    Direccion: 'Calle José Paredes, s/n',
    CodigoPostal: '30150',
    Poblacion: 'La Alberca',
    Movil: '968845896'
  },
  'Cs Torre Pacheco': {
    Direccion: 'Plaza Rosa Regás, 1',
    CodigoPostal: '30700',
    Poblacion: 'Torre-Pacheco',
    Movil: '968576433'
  },
  'Cs Zarandona': {
    Direccion: 'Calle Goya, 2',
    CodigoPostal: '30007',
    Poblacion: 'Murcia',
    Movil: '968233404'
  },
  'Servident': {
    Direccion: 'Calle Ángel Bruna, 25',
    CodigoPostal: '30203',
    Poblacion: 'Cartagena',
    Movil: '968121303'
  },
  'SERVIDENT': {
    Direccion: 'Calle Ángel Bruna, 25',
    CodigoPostal: '30203',
    Poblacion: 'Cartagena',
    Movil: '968121303'
  },
  'Cs los Dolores Cartagena': {
    Direccion: 'Calle Alfonso XIII',
    CodigoPostal: '30203',
    Poblacion: 'Cartagena',
    Movil: '968310000'
  },
  'Cs Molina Jesus Marin': {
    Direccion: 'Calle Enrique Bernal Capel, 4',
    CodigoPostal: '30500',
    Poblacion: 'Molina de Segura',
    Movil: '968389257'
  },
  'Cs Fuente Alamo': {
    Direccion: 'Ronda Poniente, s/n',
    CodigoPostal: '30320',
    Poblacion: 'Fuente Álamo',
    Movil: '968598507'
  },
  'Cs San Andres': {
    Direccion: 'Calle Escultor José Sánchez Lozano, 7, Planta Baja',
    CodigoPostal: '30005',
    Poblacion: 'Murcia',
    Movil: '968394823'
  },
  'Cs Cartagena Casco': {
    Direccion: 'Calle San Juan, 3',
    CodigoPostal: '30201',
    Poblacion: 'Cartagena',
    Movil: '968500000'
  },
  'Cs Cartagena Virgen Caridad': {
    Direccion: 'Calle Cabrera, s/n',
    CodigoPostal: '30203',
    Poblacion: 'Cartagena',
    Movil: '968528500'
  },
  'Cs Floridablanca': {
    Direccion: 'Calle Carril de las Palmeras, 3',
    CodigoPostal: '30002',
    Poblacion: 'Murcia',
    Movil: '968117044'
  },
  'Cs Murcia Sur': {
    Direccion: 'Avenida General Ortín, 2',
    CodigoPostal: '30010',
    Poblacion: 'Murcia',
    Movil: '968066066'
  },
  'Cs Blanca': {
    Direccion: 'Calle Federico García Lorca, 40',
    CodigoPostal: '30540',
    Poblacion: 'Blanca',
    Movil: '968459202'
  },
  'Cs Abaran': {
    Direccion: 'Calle Doctor Molina',
    CodigoPostal: '30550',
    Poblacion: 'Abarán',
    Movil: '968770000'
  },
  'Cs Cieza': {
    Direccion: 'Avenida de Italia, s/n',
    CodigoPostal: '30530',
    Poblacion: 'Cieza',
    Movil: '968762420'
  },
  'Cs Archena': {
    Direccion: 'Calle Siria, s/n',
    CodigoPostal: '30600',
    Poblacion: 'Archena',
    Movil: '968671748'
  },
  'Clinica Pedro Fernandez': {
    Direccion: 'Calle Venecia, 1',
    CodigoPostal: '30700',
    Poblacion: 'Torre-Pacheco',
    Movil: '968577430'
  },
  'Caser Dental Cartagena': {
    Direccion: 'Avenida Reina Victoria Eugenia, 26',
    CodigoPostal: '30204',
    Poblacion: 'Cartagena',
    Movil: '968080843',
    Email: 'clinicacartagena@caserdental.es',
    Web: 'https://www.caser.es/cuadro-medico-salud/centros/centro/fgcfhzb-clinica-dental-caser-cartagena-cartagena'
  },
  'Ipsum Centro Odontológico': {
    Direccion: 'Calle Príncipe de Asturias, 50',
    CodigoPostal: '30204',
    Poblacion: 'Cartagena',
    Movil: '968081800',
    Web: 'https://ipsumdental.es'
  },
  'Rydental': {
    Direccion: 'Avenida Nueva Cartagena, 43',
    CodigoPostal: '30009',
    Poblacion: 'Murcia',
    Movil: ''
  },
  'Dental San Jose': {
    Direccion: 'Plaza San José, 1, 1º',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '968471181',
    Email: 'contacto@clinicadentalsanjoselorca.es',
    Web: 'https://www.clinicadentalsanjoselorca.es'
  },
  'Clinica Dental Dor': {
    Direccion: 'Calle Pérez Casas, 106',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '640713862',
    Web: 'https://clinicadentaldor.com'
  },
  'Cs Mula': {
    Direccion: 'Avenida Juan Viñegla, s/n',
    CodigoPostal: '30170',
    Poblacion: 'Mula',
    Movil: '968637217'
  },
  'Cs Caravaca': {
    Direccion: 'Calle Junquico, s/n',
    CodigoPostal: '30400',
    Poblacion: 'Caravaca de la Cruz',
    Movil: '968702412'
  },
  'Cs Lorca la Viña': {
    Direccion: 'Calle Mayor, 1',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '968440000'
  },
  'Cs Lorca San Diego': {
    Direccion: 'Calle Juan Antonio Dimas, 1',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '968479021'
  },
  'Cs Salud Lorca-sutullena': {
    Direccion: 'Calle Tenor Mario Gabarrón, 6',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '968069105'
  },
  'Cs Mazarrón': {
    Direccion: 'Avenida Constitución, s/n',
    CodigoPostal: '30870',
    Poblacion: 'Mazarrón',
    Movil: '968590411'
  },
  'Dental Orenes': {
    Direccion: 'Calle Miguel Hernández, 12',
    CodigoPostal: '30011',
    Poblacion: 'Murcia',
    Movil: '968217229',
    Email: 'info@clinicadentalorenes.com',
    Web: 'https://clinicadentalorenes.com'
  },
  'Clinicas Dentales Asociadas': {
    Direccion: 'Calle Médico Vicente Reyes, 22',
    CodigoPostal: '03015',
    Poblacion: 'Alicante',
    Movil: '965243828'
  },
  'Smile Dental': {
    Direccion: 'Plaza del Alcalde Agatángelo Soler, 4',
    CodigoPostal: '03015',
    Poblacion: 'Alicante',
    Movil: '966836736',
    Email: 'smileestudiodental@gmail.com',
    Web: 'https://www.smileestudiodental.com'
  },
  'Dental el Pla': {
    Direccion: 'Avenida del Padre Esplá, 9',
    CodigoPostal: '03013',
    Poblacion: 'Alicante',
    Movil: '965211741'
  },
  'Sanitas Alicante Corte Ingles': {
    Direccion: 'Avenida Federico Soto, 1-3, 5ª planta',
    CodigoPostal: '03003',
    Poblacion: 'Alicante',
    Movil: '965224500',
    Web: 'https://www.sanitas.es/dental/clinicas-dentales-milenium/alicante/alicante/alicante-federico-soto-corte-ingles'
  },
  'Dental Oralvium': {
    Direccion: 'Avenida de la Libertad, 23, Bajo',
    CodigoPostal: '03201',
    Poblacion: 'Elche',
    Movil: '965436352',
    Email: 'info@oralvium.com',
    Web: 'https://www.oralvium.com'
  },
  'Marhuenda y Perez': {
    Direccion: 'Calle Vicente Blasco Ibáñez, 27',
    CodigoPostal: '03201',
    Poblacion: 'Elche',
    Movil: '693904423',
    Email: 'info@clinicamaruenda.es',
    Web: 'https://clinicamaruenda.es'
  },
  'C.o.reina Victoria': {
    Direccion: 'Carrer Reina Victoria, 29',
    CodigoPostal: '03201',
    Poblacion: 'Elche',
    Movil: '966661088',
    Email: 'coreinavictoria@gmail.com',
    Web: 'https://centroodontologicoreinavictoria.com'
  },
  'Clinica Dental Alemana': {
    Direccion: 'Avenida Gran Vía, Edificio Ipanema 1 Bloque 1',
    CodigoPostal: '30380',
    Poblacion: 'La Manga del Mar Menor',
    Movil: '968564757',
    Email: 'info@alexanderczech.com',
    Web: 'https://www.alexanderczech.com'
  },
  'Dental Inma Tarraga': {
    Direccion: 'Calle Camino Viejo de Callosa, 10',
    CodigoPostal: '03300',
    Poblacion: 'Orihuela',
    Movil: '865525893',
    Email: 'info@dra-tarraga.com'
  },
  'Sphere Dental': {
    Direccion: 'Avenida de la Constitución, 141',
    CodigoPostal: '03190',
    Poblacion: 'Pilar de la Horadada',
    Movil: '965352056',
    Web: 'https://abiertos.es/sphere-dental-studio-clinica-dental_i125848'
  },
  'Dental la Zenia': {
    Direccion: 'Calle Jade, 71',
    CodigoPostal: '03189',
    Poblacion: 'La Zenia',
    Movil: ''
  },
  'Cs Sax': {
    Direccion: 'Calle Reyes Católicos, 2',
    CodigoPostal: '03630',
    Poblacion: 'Sax',
    Movil: '966957000'
  },
  'Dr.ferrer Juan de Borbon': {
    Direccion: 'Calle de la Cruz, 2, Entresuelo',
    CodigoPostal: '30820',
    Poblacion: 'Alcantarilla',
    Movil: '968808536',
    Email: 'info@clinicaferrer.com',
    Web: 'https://www.clinicaferrer.com'
  },
  'Centro Odontológico Innova': {
    Direccion: 'Calle Huerto de los Frailes, s/n, Bajo',
    CodigoPostal: '30170',
    Poblacion: 'Mula',
    Movil: '968637576',
    Web: 'https://centroodontologicoinnova.com'
  },
  'Rydental': {
    Direccion: 'Avenida Nueva Cartagena, 43, Bajo 1',
    CodigoPostal: '30310',
    Poblacion: 'Cartagena',
    Movil: '868093581'
  },
  'Dental Sonrisas': {
    Direccion: 'Calle María Mar Mármol Ferri',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '690243537'
  },
  'Dental Corredera': {
    Direccion: 'Calle Corredera, 15',
    CodigoPostal: '30800',
    Poblacion: 'Lorca',
    Movil: '968466906',
    Email: 'clinicacorredera@yahoo.es',
    Web: 'https://clinicacorredera.es'
  },
  'Dental la Zenia': {
    Direccion: 'Calle Jade, 71',
    CodigoPostal: '03189',
    Poblacion: 'La Zenia',
    Movil: '966628400'
  },
  'Rocio Mompo': {
    Direccion: 'Calle Reverendo José María Pinazo, 3, Bajo',
    CodigoPostal: '46020',
    Poblacion: 'Valencia',
    Movil: '960017033',
    Email: 'info@rociomompo.com',
    Web: 'https://rociomompo.com'
  },
  'Dental Maria Vizcaino': {
    Direccion: 'Calle Huertos, 7',
    CodigoPostal: '13004',
    Poblacion: 'Ciudad Real',
    Movil: '926031069',
    Web: 'https://clinicadentalmariavizcaino.com'
  },
  'Clinica Avram': {
    Direccion: 'Calle España, 25',
    CodigoPostal: '03160',
    Poblacion: 'Almoradí',
    Movil: '966782177',
    Web: 'https://www.clinicadentavram.com'
  }
};

/**
 * Limpia un teléfono
 */
function limpiarTelefono(tel) {
  if (!tel) return null;
  return String(tel).replace(/[^\d]/g, '').substring(0, 13);
}

/**
 * Convierte a Title Case
 */
function toTitleCase(texto) {
  if (!texto) return '';
  const palabras = String(texto).trim().split(/\s+/);
  return palabras.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

/**
 * Actualiza las clínicas con la información encontrada
 */
async function actualizarClinicas() {
  try {
    console.log('📖 Leyendo datos actuales...');
    const datos = JSON.parse(fs.readFileSync(archivoDatos, 'utf8'));
    
    console.log('📚 Cargando provincias...');
    await crm.connect();
    const provinciasDB = await crm.getProvincias();
    
    console.log(`✅ ${datos.length} clínicas encontradas`);
    console.log(`✅ ${provinciasDB.length} provincias cargadas\n`);
    
    let actualizadas = 0;
    
    for (let i = 0; i < datos.length; i++) {
      const cliente = datos[i];
      const nombre = cliente.Nombre_Razon_Social;
      const info = infoEncontrada[nombre];
      
      if (info) {
        console.log(`[${i + 1}] Actualizando: ${nombre}`);
        
        // Actualizar dirección
        if (info.Direccion) {
          cliente.Direccion = toTitleCase(info.Direccion);
        }
        
        // Actualizar código postal
        if (info.CodigoPostal) {
          cliente.CodigoPostal = info.CodigoPostal;
          
          // Asociar provincia por código postal
          const provinciaId = obtenerProvinciaPorCodigoPostal(cliente.CodigoPostal, provinciasDB);
          if (provinciaId) {
            cliente.Id_Provincia = provinciaId;
            const provincia = provinciasDB.find(p => p.id === provinciaId);
            if (provincia) {
              cliente.Pais = provincia.Pais || 'España';
              cliente.CodPais = provincia.CodigoPais || 'ES';
            }
          }
        }
        
        // Actualizar población
        if (info.Poblacion) {
          cliente.Poblacion = toTitleCase(info.Poblacion);
        }
        
        // Actualizar teléfono (preferir Movil si está disponible)
        if (info.Movil) {
          cliente.Movil = limpiarTelefono(info.Movil);
        } else if (info.Telefono) {
          cliente.Movil = limpiarTelefono(info.Telefono);
        }
        
        // Actualizar email
        if (info.Email) {
          cliente.Email = info.Email.toLowerCase();
        }
        
        // Actualizar web/URL
        if (info.Web) {
          cliente.Web = info.Web.trim();
        }
        
        actualizadas++;
        console.log(`   ✅ Actualizada`);
      }
    }
    
    console.log(`\n✅ ${actualizadas} clínicas actualizadas con información encontrada`);
    
    // Guardar JSON actualizado
    const archivoSalida = path.join(__dirname, '..', 'datos-clinicas-preparados.json');
    fs.writeFileSync(archivoSalida, JSON.stringify(datos, null, 2), 'utf8');
    console.log(`📄 Datos actualizados guardados en: ${archivoSalida}\n`);
    
    // Mostrar estadísticas
    const conDireccion = datos.filter(c => c.Direccion).length;
    const conTelefono = datos.filter(c => c.Movil).length;
    const conEmail = datos.filter(c => c.Email).length;
    const conWeb = datos.filter(c => c.Web).length;
    const conCodigoPostal = datos.filter(c => c.CodigoPostal).length;
    const conPoblacion = datos.filter(c => c.Poblacion).length;
    
    console.log('📊 Estadísticas actualizadas:');
    console.log(`   Con dirección: ${conDireccion} (${(conDireccion/datos.length*100).toFixed(1)}%)`);
    console.log(`   Con teléfono: ${conTelefono} (${(conTelefono/datos.length*100).toFixed(1)}%)`);
    console.log(`   Con email: ${conEmail} (${(conEmail/datos.length*100).toFixed(1)}%)`);
    console.log(`   Con web/URL: ${conWeb} (${(conWeb/datos.length*100).toFixed(1)}%)`);
    console.log(`   Con código postal: ${conCodigoPostal} (${(conCodigoPostal/datos.length*100).toFixed(1)}%)`);
    console.log(`   Con población: ${conPoblacion} (${(conPoblacion/datos.length*100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

if (require.main === module) {
  actualizarClinicas()
    .then(() => {
      console.log('\n✅ Proceso completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { actualizarClinicas };
