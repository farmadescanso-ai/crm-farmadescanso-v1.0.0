/**
 * Script para verificar y corregir la coherencia entre Población, Provincia y Código Postal
 * 
 * Verifica:
 * 1. Si tiene CP, verifica que la Provincia sea correcta
 * 2. Si tiene Población, verifica que Provincia y CP sean correctos
 * 3. Si tiene Provincia, verifica que CP sea correcto (si es posible)
 * 4. Detecta inconsistencias y las corrige
 * 
 * Uso: node scripts/verificar-corregir-poblacion-provincia-cp.js [--dry-run]
 */

const crm = require('../config/mysql-crm');
const { obtenerProvinciaPorCodigoPostal } = require('./asociar-provincia-por-codigo-postal');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--simular');

// Mapeo de direcciones/barrios a códigos postales específicos
const MAPEO_DIRECCION_CP = {
  // Murcia - Barrios y zonas
  'murcia': {
    'centro': '30001',
    'san andres': '30001',
    'san antonio': '30002',
    'san miguel': '30003',
    'san juan': '30004',
    'san pedro': '30005',
    'santa catalina': '30006',
    'santa eulalia': '30007',
    'santiago el mayor': '30008',
    'santo domingo': '30009',
    'vistalegre': '30010',
    'vistabella': '30011',
    'el carmen': '30001',
    'la merced': '30001',
    'plaza de las flores': '30001',
    'gran via': '30001',
    'traperia': '30001',
    'plateria': '30001',
    'santa clara': '30001',
    'barrio del carmen': '30001',
    'barrio de san antonio': '30002',
    'barrio de san miguel': '30003',
    'barrio de san juan': '30004',
    'barrio de san pedro': '30005',
    'barrio de santa catalina': '30006',
    'barrio de santa eulalia': '30007',
    'barrio de santiago': '30008',
    'barrio de santo domingo': '30009',
    'barrio de vistalegre': '30010',
    'barrio de vistabella': '30011',
    'espinardo': '30012',
    'barrio de espinardo': '30012',
    'el palmar': '30013',
    'barrio del palmar': '30013',
    'sangonera': '30014',
    'barrio de sangonera': '30014',
    'algezares': '30015',
    'barrio de algezares': '30015',
    'beniajan': '30016',
    'barrio de beniajan': '30016',
    'torreagüera': '30017',
    'barrio de torreagüera': '30017',
    'sucina': '30018',
    'barrio de sucina': '30018',
    'nonduermas': '30019',
    'barrio de nonduermas': '30019',
    'puente tocinos': '30020',
    'barrio de puente tocinos': '30020',
    'santa cruz': '30001',
    'barrio de santa cruz': '30001',
    'santiago y zaraiche': '30001',
    'barrio de santiago y zaraiche': '30001',
    'sangonera la verde': '30014',
    'sangonera la seca': '30014',
    'puebla de soto': '30020',
    'barrio de puebla de soto': '30020'
  }
};

// Mapeo de poblaciones a provincia y código postal
const MAPEO_POBLACION_PROVINCIA_CP = {
  'Yecla': { provincia: 'Murcia', codigoPostal: '30510', provinciaId: 30 },
  'Murcia': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Cartagena': { provincia: 'Murcia', codigoPostal: '30201', provinciaId: 30 },
  'Lorca': { provincia: 'Murcia', codigoPostal: '30800', provinciaId: 30 },
  'Molina de Segura': { provincia: 'Murcia', codigoPostal: '30500', provinciaId: 30 },
  'Alcantarilla': { provincia: 'Murcia', codigoPostal: '30820', provinciaId: 30 },
  'Cieza': { provincia: 'Murcia', codigoPostal: '30530', provinciaId: 30 },
  'Jumilla': { provincia: 'Murcia', codigoPostal: '30520', provinciaId: 30 },
  'Torre-Pacheco': { provincia: 'Murcia', codigoPostal: '30700', provinciaId: 30 },
  'Torre Pacheco': { provincia: 'Murcia', codigoPostal: '30700', provinciaId: 30 },
  'San Javier': { provincia: 'Murcia', codigoPostal: '30730', provinciaId: 30 },
  'Águilas': { provincia: 'Murcia', codigoPostal: '30880', provinciaId: 30 },
  'Mazarrón': { provincia: 'Murcia', codigoPostal: '30870', provinciaId: 30 },
  'Totana': { provincia: 'Murcia', codigoPostal: '30850', provinciaId: 30 },
  'Mula': { provincia: 'Murcia', codigoPostal: '30170', provinciaId: 30 },
  'Archena': { provincia: 'Murcia', codigoPostal: '30600', provinciaId: 30 },
  'Bullas': { provincia: 'Murcia', codigoPostal: '30180', provinciaId: 30 },
  'Calasparra': { provincia: 'Murcia', codigoPostal: '30420', provinciaId: 30 },
  'Puerto Lumbreras': { provincia: 'Murcia', codigoPostal: '30890', provinciaId: 30 },
  'Alhama de Murcia': { provincia: 'Murcia', codigoPostal: '30840', provinciaId: 30 },
  'Alhama de': { provincia: 'Murcia', codigoPostal: '30840', provinciaId: 30 },
  'San Pedro del Pinatar': { provincia: 'Murcia', codigoPostal: '30740', provinciaId: 30 },
  'Caravaca': { provincia: 'Murcia', codigoPostal: '30400', provinciaId: 30 },
  'Caravaca de la Cruz': { provincia: 'Murcia', codigoPostal: '30400', provinciaId: 30 },
  'Moratalla': { provincia: 'Murcia', codigoPostal: '30440', provinciaId: 30 },
  'El Palmar': { provincia: 'Murcia', codigoPostal: '30013', provinciaId: 30 },
  'Palmar, el': { provincia: 'Murcia', codigoPostal: '30013', provinciaId: 30 },
  'Abarán': { provincia: 'Murcia', codigoPostal: '30550', provinciaId: 30 },
  'Abaran': { provincia: 'Murcia', codigoPostal: '30550', provinciaId: 30 },
  'Blanca': { provincia: 'Murcia', codigoPostal: '30540', provinciaId: 30 },
  'Cehegín': { provincia: 'Murcia', codigoPostal: '30430', provinciaId: 30 },
  'Cehegin': { provincia: 'Murcia', codigoPostal: '30430', provinciaId: 30 },
  'Fortuna': { provincia: 'Murcia', codigoPostal: '30620', provinciaId: 30 },
  'La Unión': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'Union, la': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'Abanilla': { provincia: 'Murcia', codigoPostal: '30640', provinciaId: 30 },
  'La Alberca': { provincia: 'Murcia', codigoPostal: '30151', provinciaId: 30 },
  'Alberca, la': { provincia: 'Murcia', codigoPostal: '30151', provinciaId: 30 },
  'Beniaján': { provincia: 'Murcia', codigoPostal: '30016', provinciaId: 30 },
  'Beniajan': { provincia: 'Murcia', codigoPostal: '30016', provinciaId: 30 },
  'Cabezo de Torres': { provincia: 'Murcia', codigoPostal: '30110', provinciaId: 30 },
  'Cabezo de': { provincia: 'Murcia', codigoPostal: '30110', provinciaId: 30 },
  'Albudeite': { provincia: 'Murcia', codigoPostal: '30190', provinciaId: 30 },
  'Aledo': { provincia: 'Murcia', codigoPostal: '30859', provinciaId: 30 },
  'El Algar': { provincia: 'Murcia', codigoPostal: '30366', provinciaId: 30 },
  'Algar, el': { provincia: 'Murcia', codigoPostal: '30366', provinciaId: 30 },
  'Alguazas': { provincia: 'Murcia', codigoPostal: '30560', provinciaId: 30 },
  'Alquerías': { provincia: 'Murcia', codigoPostal: '30560', provinciaId: 30 },
  'Alquerias': { provincia: 'Murcia', codigoPostal: '30560', provinciaId: 30 },
  'Balsapintada': { provincia: 'Murcia', codigoPostal: '30591', provinciaId: 30 },
  'Beniel': { provincia: 'Murcia', codigoPostal: '30130', provinciaId: 30 },
  'Cabo de Palos': { provincia: 'Murcia', codigoPostal: '30370', provinciaId: 30 },
  'Cabo de': { provincia: 'Murcia', codigoPostal: '30370', provinciaId: 30 },
  'Campos del Río': { provincia: 'Murcia', codigoPostal: '30191', provinciaId: 30 },
  'Campos del Rio': { provincia: 'Murcia', codigoPostal: '30191', provinciaId: 30 },
  'Ceutí': { provincia: 'Murcia', codigoPostal: '30562', provinciaId: 30 },
  'El Albujón': { provincia: 'Murcia', codigoPostal: '30365', provinciaId: 30 },
  'Albujon, el': { provincia: 'Murcia', codigoPostal: '30365', provinciaId: 30 },
  'El Esparragal': { provincia: 'Murcia', codigoPostal: '30151', provinciaId: 30 },
  'Esparragal, el': { provincia: 'Murcia', codigoPostal: '30151', provinciaId: 30 },
  'Fuente Álamo': { provincia: 'Murcia', codigoPostal: '30320', provinciaId: 30 },
  'Fuente Alamo': { provincia: 'Murcia', codigoPostal: '30320', provinciaId: 30 },
  'Fuente': { provincia: 'Murcia', codigoPostal: '30320', provinciaId: 30 },
  'Los Garres': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Garres, los': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Guadalupe': { provincia: 'Murcia', codigoPostal: '30107', provinciaId: 30 },
  'Islas Menores': { provincia: 'Murcia', codigoPostal: '30370', provinciaId: 30 },
  'Islas': { provincia: 'Murcia', codigoPostal: '30370', provinciaId: 30 },
  'Javalí Nuevo': { provincia: 'Murcia', codigoPostal: '30195', provinciaId: 30 },
  'Javali Nuevo': { provincia: 'Murcia', codigoPostal: '30195', provinciaId: 30 },
  'Javalí Viejo': { provincia: 'Murcia', codigoPostal: '30195', provinciaId: 30 },
  'Javali Viejo': { provincia: 'Murcia', codigoPostal: '30195', provinciaId: 30 },
  'Librilla': { provincia: 'Murcia', codigoPostal: '30892', provinciaId: 30 },
  'Llano de Brujas': { provincia: 'Murcia', codigoPostal: '30161', provinciaId: 30 },
  'Llano de': { provincia: 'Murcia', codigoPostal: '30161', provinciaId: 30 },
  'Lo Pagán': { provincia: 'Murcia', codigoPostal: '30740', provinciaId: 30 },
  'Lo Pagan': { provincia: 'Murcia', codigoPostal: '30740', provinciaId: 30 },
  'Lorquí': { provincia: 'Murcia', codigoPostal: '30564', provinciaId: 30 },
  'Lorqui': { provincia: 'Murcia', codigoPostal: '30564', provinciaId: 30 },
  'Los Ramos': { provincia: 'Murcia', codigoPostal: '30139', provinciaId: 30 },
  'Ramos, los': { provincia: 'Murcia', codigoPostal: '30139', provinciaId: 30 },
  'La Ñora': { provincia: 'Murcia', codigoPostal: '30150', provinciaId: 30 },
  'Ñora, la': { provincia: 'Murcia', codigoPostal: '30150', provinciaId: 30 },
  'Patiño': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Pliego': { provincia: 'Murcia', codigoPostal: '30176', provinciaId: 30 },
  'El Raal': { provincia: 'Murcia', codigoPostal: '30139', provinciaId: 30 },
  'Raal, el': { provincia: 'Murcia', codigoPostal: '30139', provinciaId: 30 },
  'Ribera de Molina': { provincia: 'Murcia', codigoPostal: '30506', provinciaId: 30 },
  'Ricote': { provincia: 'Murcia', codigoPostal: '30610', provinciaId: 30 },
  'Rincón de Seca': { provincia: 'Murcia', codigoPostal: '30150', provinciaId: 30 },
  'Rincon de Seca': { provincia: 'Murcia', codigoPostal: '30150', provinciaId: 30 },
  'San Ginés': { provincia: 'Murcia', codigoPostal: '30150', provinciaId: 30 },
  'San Gines': { provincia: 'Murcia', codigoPostal: '30150', provinciaId: 30 },
  'San José de la Vega': { provincia: 'Murcia', codigoPostal: '30150', provinciaId: 30 },
  'San Jose de la Vega': { provincia: 'Murcia', codigoPostal: '30150', provinciaId: 30 },
  'Santo Ángel': { provincia: 'Murcia', codigoPostal: '30120', provinciaId: 30 },
  'Santo Angel': { provincia: 'Murcia', codigoPostal: '30120', provinciaId: 30 },
  'Santomera': { provincia: 'Murcia', codigoPostal: '30140', provinciaId: 30 },
  'Villanueva del Río Segura': { provincia: 'Murcia', codigoPostal: '30613', provinciaId: 30 },
  'Villanueva': { provincia: 'Murcia', codigoPostal: '30613', provinciaId: 30 },
  'Zeneta': { provincia: 'Murcia', codigoPostal: '30139', provinciaId: 30 },
  'Jaén': { provincia: 'Jaén', codigoPostal: '23001', provinciaId: 23 },
  'Linares': { provincia: 'Jaén', codigoPostal: '23700', provinciaId: 23 },
  'Úbeda': { provincia: 'Jaén', codigoPostal: '23400', provinciaId: 23 },
  'Andújar': { provincia: 'Jaén', codigoPostal: '23740', provinciaId: 23 },
  'Martos': { provincia: 'Jaén', codigoPostal: '23600', provinciaId: 23 },
  'Baeza': { provincia: 'Jaén', codigoPostal: '23440', provinciaId: 23 },
  'Alcalá la Real': { provincia: 'Jaén', codigoPostal: '23680', provinciaId: 23 },
  'Villacarrillo': { provincia: 'Jaén', codigoPostal: '23300', provinciaId: 23 },
  'Madrid': { provincia: 'Madrid', codigoPostal: '28001', provinciaId: 28 },
  'Móstoles': { provincia: 'Madrid', codigoPostal: '28930', provinciaId: 28 },
  'Alcalá de Henares': { provincia: 'Madrid', codigoPostal: '28801', provinciaId: 28 },
  'Getafe': { provincia: 'Madrid', codigoPostal: '28901', provinciaId: 28 },
  'Leganés': { provincia: 'Madrid', codigoPostal: '28910', provinciaId: 28 },
  'Barcelona': { provincia: 'Barcelona', codigoPostal: '08001', provinciaId: 8 },
  'Badalona': { provincia: 'Barcelona', codigoPostal: '08910', provinciaId: 8 },
  'Sabadell': { provincia: 'Barcelona', codigoPostal: '08201', provinciaId: 8 },
  'Terrassa': { provincia: 'Barcelona', codigoPostal: '08221', provinciaId: 8 },
  'Valencia': { provincia: 'Valencia', codigoPostal: '46001', provinciaId: 46 },
  'Alicante': { provincia: 'Alicante', codigoPostal: '03001', provinciaId: 3 },
  'Elche': { provincia: 'Alicante', codigoPostal: '03201', provinciaId: 3 },
  'Torrevieja': { provincia: 'Alicante', codigoPostal: '03181', provinciaId: 3 },
  'Orihuela': { provincia: 'Alicante', codigoPostal: '03300', provinciaId: 3 },
  'Benidorm': { provincia: 'Alicante', codigoPostal: '03500', provinciaId: 3 },
  'Alcoy': { provincia: 'Alicante', codigoPostal: '03800', provinciaId: 3 },
  'Castellón de la Plana': { provincia: 'Castellón', codigoPostal: '12001', provinciaId: 12 },
  'Sevilla': { provincia: 'Sevilla', codigoPostal: '41001', provinciaId: 41 },
  'Córdoba': { provincia: 'Córdoba', codigoPostal: '14001', provinciaId: 14 },
  'Málaga': { provincia: 'Málaga', codigoPostal: '29001', provinciaId: 29 },
  'Granada': { provincia: 'Granada', codigoPostal: '18001', provinciaId: 18 },
  'Zaragoza': { provincia: 'Zaragoza', codigoPostal: '50001', provinciaId: 50 },
  'Bilbao': { provincia: 'Vizcaya', codigoPostal: '48001', provinciaId: 48 },
  'Vitoria': { provincia: 'Álava', codigoPostal: '01001', provinciaId: 1 },
  'San Sebastián': { provincia: 'Guipúzcoa', codigoPostal: '20001', provinciaId: 20 },
  'Oviedo': { provincia: 'Asturias', codigoPostal: '33001', provinciaId: 33 },
  'Santander': { provincia: 'Cantabria', codigoPostal: '39001', provinciaId: 39 },
  'Valladolid': { provincia: 'Valladolid', codigoPostal: '47001', provinciaId: 47 },
  'Salamanca': { provincia: 'Salamanca', codigoPostal: '37001', provinciaId: 37 },
  'León': { provincia: 'León', codigoPostal: '24001', provinciaId: 24 },
  'Palencia': { provincia: 'Palencia', codigoPostal: '34001', provinciaId: 34 },
  'Burgos': { provincia: 'Burgos', codigoPostal: '09001', provinciaId: 9 },
  'Soria': { provincia: 'Soria', codigoPostal: '42001', provinciaId: 42 },
  'Logroño': { provincia: 'La Rioja', codigoPostal: '26001', provinciaId: 26 },
  'Pamplona': { provincia: 'Navarra', codigoPostal: '31001', provinciaId: 31 },
  'Vigo': { provincia: 'Pontevedra', codigoPostal: '36201', provinciaId: 36 },
  'A Coruña': { provincia: 'La Coruña', codigoPostal: '15001', provinciaId: 15 },
  'Santiago de Compostela': { provincia: 'La Coruña', codigoPostal: '15705', provinciaId: 15 },
  'Ourense': { provincia: 'Ourense', codigoPostal: '32001', provinciaId: 32 },
  'Lugo': { provincia: 'Lugo', codigoPostal: '27001', provinciaId: 27 },
  'Badajoz': { provincia: 'Badajoz', codigoPostal: '06001', provinciaId: 6 },
  'Cáceres': { provincia: 'Cáceres', codigoPostal: '10001', provinciaId: 10 },
  'Toledo': { provincia: 'Toledo', codigoPostal: '45001', provinciaId: 45 },
  'Ciudad Real': { provincia: 'Ciudad Real', codigoPostal: '13001', provinciaId: 13 },
  'Albacete': { provincia: 'Albacete', codigoPostal: '02001', provinciaId: 2 },
  'Cuenca': { provincia: 'Cuenca', codigoPostal: '16001', provinciaId: 16 },
  'Guadalajara': { provincia: 'Guadalajara', codigoPostal: '19001', provinciaId: 19 },
  'Ávila': { provincia: 'Ávila', codigoPostal: '05001', provinciaId: 5 },
  'Segovia': { provincia: 'Segovia', codigoPostal: '40001', provinciaId: 40 },
  'Huesca': { provincia: 'Huesca', codigoPostal: '22001', provinciaId: 22 },
  'Teruel': { provincia: 'Teruel', codigoPostal: '44001', provinciaId: 44 },
  'Tarragona': { provincia: 'Tarragona', codigoPostal: '43001', provinciaId: 43 },
  'Lérida': { provincia: 'Lérida', codigoPostal: '25001', provinciaId: 25 },
  'Girona': { provincia: 'Girona', codigoPostal: '17001', provinciaId: 17 },
  'Huelva': { provincia: 'Huelva', codigoPostal: '21001', provinciaId: 21 },
  'Cádiz': { provincia: 'Cádiz', codigoPostal: '11001', provinciaId: 11 },
  'Almería': { provincia: 'Almería', codigoPostal: '04001', provinciaId: 4 },
  'Palma de Mallorca': { provincia: 'Baleares', codigoPostal: '07001', provinciaId: 7 },
  'Las Palmas de Gran Canaria': { provincia: 'Las Palmas', codigoPostal: '35001', provinciaId: 35 },
  'Santa Cruz de Tenerife': { provincia: 'Santa Cruz de Tenerife', codigoPostal: '38001', provinciaId: 38 },
  'Ceuta': { provincia: 'Ceuta', codigoPostal: '51001', provinciaId: 51 },
  'Melilla': { provincia: 'Melilla', codigoPostal: '52001', provinciaId: 52 },
  
  // Poblaciones adicionales de Murcia (después de limpiar guiones)
  'Nonduermas': { provincia: 'Murcia', codigoPostal: '30019', provinciaId: 30 },
  'Pozo Estrecho': { provincia: 'Murcia', codigoPostal: '30369', provinciaId: 30 },
  'Playa Honda': { provincia: 'Murcia', codigoPostal: '30369', provinciaId: 30 },
  'Santiago de la Ribera': { provincia: 'Murcia', codigoPostal: '30740', provinciaId: 30 },
  'Sangonera la Verde': { provincia: 'Murcia', codigoPostal: '30014', provinciaId: 30 },
  'Sangonera la Seca': { provincia: 'Murcia', codigoPostal: '30014', provinciaId: 30 },
  'Puente Tocinos': { provincia: 'Murcia', codigoPostal: '30020', provinciaId: 30 },
  'Puebla de Soto': { provincia: 'Murcia', codigoPostal: '30020', provinciaId: 30 },
  'Sucina': { provincia: 'Murcia', codigoPostal: '30018', provinciaId: 30 },
  'Sutullena': { provincia: 'Murcia', codigoPostal: '30800', provinciaId: 30 },
  'Santiago y Zaraiche': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Santa Cruz': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 }, // Barrio de Murcia, no Santa Cruz de Tenerife
  'Santa Ana': { provincia: 'Murcia', codigoPostal: '30201', provinciaId: 30 },
  'El Palmar': { provincia: 'Murcia', codigoPostal: '30013', provinciaId: 30 },
  'El Mirador': { provincia: 'Murcia', codigoPostal: '30730', provinciaId: 30 },
  'El Algar': { provincia: 'Murcia', codigoPostal: '30366', provinciaId: 30 },
  'La Manga': { provincia: 'Murcia', codigoPostal: '30385', provinciaId: 30 },
  'La Palma': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'La Paca': { provincia: 'Murcia', codigoPostal: '30800', provinciaId: 30 },
  'La Arboleja': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'La Almudena': { provincia: 'Murcia', codigoPostal: '30400', provinciaId: 30 },
  'La Aljorra': { provincia: 'Murcia', codigoPostal: '30350', provinciaId: 30 },
  'La Alberca': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Los Urrutias': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'Los Nietos': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'Los Mateos': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'Los Garres': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Los Dolores': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Los Barreros': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'Lo Campano': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'Miranda': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'Molinos Marfagones': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'Monteagudo': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Espinardo': { provincia: 'Murcia', codigoPostal: '30012', provinciaId: 30 },
  'Era Alta': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'El Ranero': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'El Puntal': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Corvera': { provincia: 'Murcia', codigoPostal: '30350', provinciaId: 30 },
  'Cobatillas': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Churra': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Canteras': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'Campillo': { provincia: 'Murcia', codigoPostal: '30800', provinciaId: 30 },
  'Barranda': { provincia: 'Murcia', codigoPostal: '30400', provinciaId: 30 },
  'Barqueros': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Barinas': { provincia: 'Murcia', codigoPostal: '30640', provinciaId: 30 },
  'Archivel': { provincia: 'Murcia', codigoPostal: '30400', provinciaId: 30 },
  'Alumbres': { provincia: 'Murcia', codigoPostal: '30360', provinciaId: 30 },
  'Altorreal': { provincia: 'Murcia', codigoPostal: '30500', provinciaId: 30 },
  'Almendricos': { provincia: 'Murcia', codigoPostal: '30800', provinciaId: 30 },
  'Aljucer': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  'Algezares': { provincia: 'Murcia', codigoPostal: '30015', provinciaId: 30 },
  'Zarcilla de Ramos': { provincia: 'Murcia', codigoPostal: '30800', provinciaId: 30 },
  'Torrealta': { provincia: 'Murcia', codigoPostal: '30500', provinciaId: 30 },
  'Yéchar': { provincia: 'Murcia', codigoPostal: '30190', provinciaId: 30 },
  'Dolores': { provincia: 'Murcia', codigoPostal: '30700', provinciaId: 30 },
  'Lobosillo': { provincia: 'Murcia', codigoPostal: '30001', provinciaId: 30 },
  
  // Otras ciudades importantes
  'San Sebastián de los Reyes': { provincia: 'Madrid', codigoPostal: '28700', provinciaId: 28 },
  'Castelló': { provincia: 'Castellón', codigoPostal: '12001', provinciaId: 12 },
  'Castellón': { provincia: 'Castellón', codigoPostal: '12001', provinciaId: 12 },
  'Rivas': { provincia: 'Madrid', codigoPostal: '28521', provinciaId: 28 },
  'Rivas-Vaciamadrid': { provincia: 'Madrid', codigoPostal: '28521', provinciaId: 28 },
  'Vélez': { provincia: 'Málaga', codigoPostal: '29700', provinciaId: 29 },
  'Vélez-Málaga': { provincia: 'Málaga', codigoPostal: '29700', provinciaId: 29 },
  'Riba': { provincia: 'Valencia', codigoPostal: '46190', provinciaId: 46 },
  'Riba-roja de Túria': { provincia: 'Valencia', codigoPostal: '46190', provinciaId: 46 },
  'Vitoria': { provincia: 'Álava', codigoPostal: '01001', provinciaId: 1 },
  'Vitoria-Gasteiz': { provincia: 'Álava', codigoPostal: '01001', provinciaId: 1 },
  'Torre': { provincia: 'Murcia', codigoPostal: '30700', provinciaId: 30 },
  'Torre Pacheco': { provincia: 'Murcia', codigoPostal: '30700', provinciaId: 30 }
};

/**
 * Busca información de población en el mapeo
 */
function buscarPoblacionEnMapeo(poblacion) {
  if (!poblacion) return null;
  
  const normalizada = normalizarPoblacion(poblacion);
  
  // Buscar coincidencia exacta normalizada
  for (const [key, value] of Object.entries(MAPEO_POBLACION_PROVINCIA_CP)) {
    if (normalizarPoblacion(key) === normalizada) {
      return value;
    }
  }
  
  // Buscar coincidencia parcial (contiene)
  for (const [key, value] of Object.entries(MAPEO_POBLACION_PROVINCIA_CP)) {
    const keyNormalizada = normalizarPoblacion(key);
    if (normalizada.includes(keyNormalizada) || keyNormalizada.includes(normalizada)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Normaliza el nombre de una población
 */
function normalizarPoblacion(poblacion) {
  if (!poblacion) return null;
  return String(poblacion)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[áàäâ]/gi, 'a')
    .replace(/[éèëê]/gi, 'e')
    .replace(/[íìïî]/gi, 'i')
    .replace(/[óòöô]/gi, 'o')
    .replace(/[úùüû]/gi, 'u')
    .replace(/[ñ]/gi, 'n')
    .toLowerCase();
}

/**
 * Normaliza una dirección
 */
function normalizarDireccion(direccion) {
  if (!direccion) return null;
  return String(direccion)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[áàäâ]/gi, 'a')
    .replace(/[éèëê]/gi, 'e')
    .replace(/[íìïî]/gi, 'i')
    .replace(/[óòöô]/gi, 'o')
    .replace(/[úùüû]/gi, 'u')
    .replace(/[ñ]/gi, 'n')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .toLowerCase();
}

/**
 * Busca código postal por dirección y población
 */
function buscarCPPorDireccion(direccion, poblacion) {
  if (!direccion || !poblacion) return null;
  
  const dirNormalizada = normalizarDireccion(direccion);
  const pobNormalizada = normalizarPoblacion(poblacion);
  
  // Buscar en el mapeo de direcciones
  if (MAPEO_DIRECCION_CP && MAPEO_DIRECCION_CP[pobNormalizada]) {
    const mapeoCiudad = MAPEO_DIRECCION_CP[pobNormalizada];
    
    // Buscar coincidencias exactas primero
    for (const [barrio, cp] of Object.entries(mapeoCiudad)) {
      if (dirNormalizada.includes(barrio) || barrio.includes(dirNormalizada)) {
        return cp;
      }
    }
    
    // Buscar coincidencias parciales (palabras clave)
    const palabrasDir = dirNormalizada.split(/\s+/);
    for (const palabra of palabrasDir) {
      if (palabra.length > 3 && mapeoCiudad[palabra]) {
        return mapeoCiudad[palabra];
      }
    }
  }
  
  return null;
}

/**
 * Verifica y corrige un cliente
 */
async function verificarYCorregirCliente(cliente, provinciasDB) {
  const updates = {};
  const razones = [];
  const inconsistencias = [];
  
  const poblacion = cliente.Poblacion || cliente.poblacion || null;
  const direccion = cliente.Direccion || cliente.direccion || null;
  const codigoPostal = cliente.CodigoPostal || cliente.codigoPostal || null;
  const idProvincia = cliente.Id_Provincia || cliente.id_Provincia || null;
  
  // VERIFICACIÓN 1: Si tiene CP, verificar que la Provincia sea correcta
  if (codigoPostal) {
    const provinciaCorrectaPorCP = obtenerProvinciaPorCodigoPostal(codigoPostal);
    if (provinciaCorrectaPorCP) {
      if (!idProvincia || idProvincia != provinciaCorrectaPorCP) {
        updates.Id_Provincia = provinciaCorrectaPorCP;
        razones.push(`CP ${codigoPostal} requiere Provincia ID ${provinciaCorrectaPorCP} (actual: ${idProvincia || 'sin provincia'})`);
        inconsistencias.push('Provincia incorrecta según CP');
      }
    }
  }
  
  // VERIFICACIÓN 2: Si tiene Población, verificar Provincia y CP
  if (poblacion) {
    const datosPoblacion = buscarPoblacionEnMapeo(poblacion);
    
    if (datosPoblacion) {
      // Verificar Provincia
      if (!idProvincia || idProvincia != datosPoblacion.provinciaId) {
        updates.Id_Provincia = datosPoblacion.provinciaId;
        razones.push(`Población "${poblacion}" requiere Provincia ${datosPoblacion.provincia} (ID: ${datosPoblacion.provinciaId})`);
        inconsistencias.push('Provincia incorrecta según Población');
      }
      
      // Verificar CP - primero intentar por dirección si está disponible
      let cpCorrecto = null;
      if (direccion) {
        cpCorrecto = buscarCPPorDireccion(direccion, poblacion);
      }
      
      // Si no se encontró por dirección, usar el genérico de la población
      if (!cpCorrecto) {
        cpCorrecto = datosPoblacion.codigoPostal;
      }
      
      if (cpCorrecto) {
        // Si no tiene CP, asignarlo
        if (!codigoPostal) {
          updates.CodigoPostal = cpCorrecto;
          razones.push(`Población "${poblacion}" requiere CP ${cpCorrecto} (sin CP actual)`);
        }
        // Si tiene CP genérico y podemos mejorarlo con uno específico
        else if (codigoPostal === datosPoblacion.codigoPostal && direccion) {
          const cpEspecifico = buscarCPPorDireccion(direccion, poblacion);
          if (cpEspecifico && cpEspecifico !== codigoPostal) {
            updates.CodigoPostal = cpEspecifico;
            razones.push(`CP mejorado: ${codigoPostal} (genérico) -> ${cpEspecifico} (específico) basado en dirección`);
          }
        }
        // Si el CP no coincide con el esperado para la población
        else if (codigoPostal !== cpCorrecto && !direccion) {
          // Solo corregir si no hay dirección (para no sobreescribir CPs específicos)
          updates.CodigoPostal = cpCorrecto;
          razones.push(`CP corregido: ${codigoPostal} -> ${cpCorrecto} según Población "${poblacion}"`);
          inconsistencias.push('CP incorrecto según Población');
        }
      }
    }
  }
  
  // VERIFICACIÓN 3: Si tiene Provincia pero no Población ni CP, intentar obtener CP
  if (idProvincia && !codigoPostal && !poblacion) {
    const provincia = provinciasDB.find(p => (p.id || p.Id) == idProvincia);
    if (provincia) {
      const nombreProvincia = provincia.Nombre || provincia.nombre;
      // Buscar una población de esa provincia en el mapeo
      for (const [pob, datos] of Object.entries(MAPEO_POBLACION_PROVINCIA_CP)) {
        if (datos.provinciaId == idProvincia) {
          if (datos.codigoPostal) {
            updates.CodigoPostal = datos.codigoPostal;
            razones.push(`Provincia ${nombreProvincia} -> CP ${datos.codigoPostal} (ejemplo)`);
            break;
          }
        }
      }
    }
  }
  
  // VERIFICACIÓN 4: Si tiene CP y Población, verificar coherencia
  if (codigoPostal && poblacion) {
    const datosPoblacion = buscarPoblacionEnMapeo(poblacion);
    const provinciaPorCP = obtenerProvinciaPorCodigoPostal(codigoPostal);
    
    if (datosPoblacion && provinciaPorCP) {
      // Si el CP indica una provincia diferente a la de la población en el mapeo
      if (provinciaPorCP != datosPoblacion.provinciaId) {
        // Priorizar el CP sobre el mapeo de población (el CP es más confiable)
        // Solo si el CP es válido y la población no está claramente identificada
        // En este caso, confiar en el CP
        updates.Id_Provincia = provinciaPorCP;
        razones.push(`Provincia corregida según CP ${codigoPostal}: ${datosPoblacion.provinciaId} -> ${provinciaPorCP} (el CP tiene prioridad)`);
        inconsistencias.push(`CP ${codigoPostal} indica Provincia ${provinciaPorCP}, pero Población "${poblacion}" sugiere ${datosPoblacion.provinciaId}`);
      }
    } else if (provinciaPorCP && !datosPoblacion) {
      // Si tenemos CP pero no encontramos la población en el mapeo, usar el CP
      if (!idProvincia || idProvincia != provinciaPorCP) {
        updates.Id_Provincia = provinciaPorCP;
        razones.push(`Provincia asignada según CP ${codigoPostal}: ${provinciaPorCP}`);
      }
    }
  }
  
  return { updates, razones, inconsistencias };
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando verificación y corrección de Población, Provincia y Código Postal...\n');
    
    if (DRY_RUN) {
      console.log('⚠️  MODO SIMULACIÓN (--dry-run): No se realizarán cambios en la BD\n');
    }
    
    // Conectar a la BD
    await crm.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    // Obtener todas las provincias
    const provinciasDB = await crm.getProvincias();
    console.log(`📊 Cargadas ${provinciasDB.length} provincias de la BD\n`);
    
    // Obtener todos los clientes
    const clientes = await crm.getClientes();
    console.log(`📊 Total de clientes: ${clientes.length}\n`);
    
    // Estadísticas
    let clientesProcesados = 0;
    let clientesActualizados = 0;
    let totalUpdates = 0;
    let totalInconsistencias = 0;
    
    console.log('🔍 Verificando y corrigiendo clientes...\n');
    
    // Procesar cada cliente
    for (const cliente of clientes) {
      const clienteId = cliente.Id || cliente.id;
      const { updates, razones, inconsistencias } = await verificarYCorregirCliente(cliente, provinciasDB);
      
      if (Object.keys(updates).length > 0 || inconsistencias.length > 0) {
        if (Object.keys(updates).length > 0) {
          clientesActualizados++;
          totalUpdates += Object.keys(updates).length;
        }
        
        if (inconsistencias.length > 0) {
          totalInconsistencias += inconsistencias.length;
        }
        
        console.log(`\n📝 Cliente ID ${clienteId}: ${cliente.Nombre_Razon_Social || cliente.Nombre || 'Sin nombre'}`);
        console.log(`   Población: "${cliente.Poblacion || 'N/A'}"`);
        console.log(`   Provincia ID: ${cliente.Id_Provincia || 'N/A'}`);
        console.log(`   CP: ${cliente.CodigoPostal || 'N/A'}`);
        
        if (razones.length > 0) {
          console.log(`   ✅ Correcciones: ${razones.join('; ')}`);
          console.log(`   Actualizaciones:`, updates);
        }
        
        if (inconsistencias.length > 0) {
          console.log(`   ⚠️  Inconsistencias detectadas: ${inconsistencias.join('; ')}`);
        }
        
        if (!DRY_RUN && Object.keys(updates).length > 0) {
          // Construir SQL UPDATE
          const setClauses = Object.keys(updates).map(key => `\`${key}\` = ?`).join(', ');
          const values = Object.values(updates);
          values.push(clienteId);
          
          const sql = `UPDATE clientes SET ${setClauses} WHERE Id = ?`;
          await crm.query(sql, values);
          console.log(`   ✅ Actualizado en BD`);
        } else if (DRY_RUN && Object.keys(updates).length > 0) {
          console.log(`   ⚠️  [SIMULACIÓN] No se actualizó`);
        }
      }
      
      clientesProcesados++;
      
      // Mostrar progreso cada 100 clientes
      if (clientesProcesados % 100 === 0) {
        console.log(`\n📊 Progreso: ${clientesProcesados}/${clientes.length} clientes procesados`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(60));
    console.log(`Total de clientes procesados: ${clientesProcesados}`);
    console.log(`Clientes actualizados: ${clientesActualizados}`);
    console.log(`Total de campos actualizados: ${totalUpdates}`);
    console.log(`Total de inconsistencias detectadas: ${totalInconsistencias}`);
    console.log('='.repeat(60));
    
    if (DRY_RUN) {
      console.log('\n⚠️  MODO SIMULACIÓN: No se realizaron cambios reales');
      console.log('   Ejecuta sin --dry-run para aplicar los cambios\n');
    } else {
      console.log('\n✅ Proceso completado exitosamente\n');
    }
    
    await crm.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await crm.disconnect();
    process.exit(1);
  }
}

// Ejecutar
main();
