-- Actualizar TODOS los nombres de países con caracteres especiales UTF-8 correctos
-- Basado en: https://www.sanidad.gob.es/ciudadanos/saludAmbLaboral/docs/codigoIsoPai.pdf

USE farmadescanso;

-- Asegurar que la tabla y columna usan UTF-8
ALTER TABLE `paises` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `paises` MODIFY COLUMN `Nombre_pais` VARCHAR(500) NOT NULL;

-- Actualizar todos los países con nombres completos y caracteres especiales correctos
UPDATE `paises` SET `Nombre_pais` = 'AFGANISTÁN' WHERE `Id_pais` = 'AF';
UPDATE `paises` SET `Nombre_pais` = 'ALEMANIA (Incluida la Isla de Helgoland)' WHERE `Id_pais` = 'DE';
UPDATE `paises` SET `Nombre_pais` = 'ANGOLA (incluido Cabinda)' WHERE `Id_pais` = 'AO';
UPDATE `paises` SET `Nombre_pais` = 'ANTÁRTIDA' WHERE `Id_pais` = 'AQ';
UPDATE `paises` SET `Nombre_pais` = 'ARABIA SAUDÍ' WHERE `Id_pais` = 'SA';
UPDATE `paises` SET `Nombre_pais` = 'AZERBAIYÁN' WHERE `Id_pais` = 'AZ';
UPDATE `paises` SET `Nombre_pais` = 'BÉLGICA' WHERE `Id_pais` = 'BE';
UPDATE `paises` SET `Nombre_pais` = 'BIELORRUSIA (BELARÚS)' WHERE `Id_pais` = 'BY';
UPDATE `paises` SET `Nombre_pais` = 'BRUNÉI (BRUNÉI DARUSSALAM)' WHERE `Id_pais` = 'BN';
UPDATE `paises` SET `Nombre_pais` = 'BUTÁN' WHERE `Id_pais` = 'BT';
UPDATE `paises` SET `Nombre_pais` = 'CABO VERDE, REPÚBLICA DE' WHERE `Id_pais` = 'CV';
UPDATE `paises` SET `Nombre_pais` = 'CAIMÁN, ISLAS' WHERE `Id_pais` = 'KY';
UPDATE `paises` SET `Nombre_pais` = 'CAMERÚN' WHERE `Id_pais` = 'CM';
UPDATE `paises` SET `Nombre_pais` = 'CANADÁ' WHERE `Id_pais` = 'CA';
UPDATE `paises` SET `Nombre_pais` = 'CHECA, REPÚBLICA' WHERE `Id_pais` = 'CZ';
UPDATE `paises` SET `Nombre_pais` = 'CONGO, REPÚBLICA DEMOCRÁTICA DEL (Zaire)' WHERE `Id_pais` = 'CD';
UPDATE `paises` SET `Nombre_pais` = 'DOMINICANA, REPÚBLICA' WHERE `Id_pais` = 'DO';
UPDATE `paises` SET `Nombre_pais` = 'ECUADOR (incluidas las Islas Galápagos)' WHERE `Id_pais` = 'EC';
UPDATE `paises` SET `Nombre_pais` = 'EMIRATOS ÁRABES UNIDOS' WHERE `Id_pais` = 'AE';
UPDATE `paises` SET `Nombre_pais` = 'ESPAÑA' WHERE `Id_pais` = 'ES';
UPDATE `paises` SET `Nombre_pais` = 'ESTADOS UNIDOS DE AMÉRICA' WHERE `Id_pais` = 'US';
UPDATE `paises` SET `Nombre_pais` = 'ETIOPÍA' WHERE `Id_pais` = 'ET';
UPDATE `paises` SET `Nombre_pais` = 'FEROE, ISLAS' WHERE `Id_pais` = 'FO';
UPDATE `paises` SET `Nombre_pais` = 'FRANCIA (Incluidos los departamentos franceses de ultramar)' WHERE `Id_pais` = 'FR';
UPDATE `paises` SET `Nombre_pais` = 'GABÓN' WHERE `Id_pais` = 'GA';
UPDATE `paises` SET `Nombre_pais` = 'GRANADA (incluidas las Islas Granadinas del Sur)' WHERE `Id_pais` = 'GD';
UPDATE `paises` SET `Nombre_pais` = 'GUINEA ECUATORIAL' WHERE `Id_pais` = 'GQ';
UPDATE `paises` SET `Nombre_pais` = 'HAITÍ' WHERE `Id_pais` = 'HT';
UPDATE `paises` SET `Nombre_pais` = 'HUNGRÍA' WHERE `Id_pais` = 'HU';
UPDATE `paises` SET `Nombre_pais` = 'ISLA DE MÁN' WHERE `Id_pais` = 'IM';
UPDATE `paises` SET `Nombre_pais` = 'ITALIA (Incluido Livigno)' WHERE `Id_pais` = 'IT';
UPDATE `paises` SET `Nombre_pais` = 'JAPÓN' WHERE `Id_pais` = 'JP';
UPDATE `paises` SET `Nombre_pais` = 'KAZAJSTÁN' WHERE `Id_pais` = 'KZ';
UPDATE `paises` SET `Nombre_pais` = 'KIRGUISTÁN' WHERE `Id_pais` = 'KG';
UPDATE `paises` SET `Nombre_pais` = 'LÍBANO' WHERE `Id_pais` = 'LB';
UPDATE `paises` SET `Nombre_pais` = 'MALÍ' WHERE `Id_pais` = 'ML';
UPDATE `paises` SET `Nombre_pais` = 'MARRUECOS' WHERE `Id_pais` = 'MA';
UPDATE `paises` SET `Nombre_pais` = 'MÉXICO' WHERE `Id_pais` = 'MX';
UPDATE `paises` SET `Nombre_pais` = 'MÓNACO' WHERE `Id_pais` = 'MC';
UPDATE `paises` SET `Nombre_pais` = 'NÍGER' WHERE `Id_pais` = 'NE';
UPDATE `paises` SET `Nombre_pais` = 'OCÉANO ÍNDICO, TERRITORIO BRITÁNICO DEL' WHERE `Id_pais` = 'IO';
UPDATE `paises` SET `Nombre_pais` = 'OMÁN' WHERE `Id_pais` = 'OM';
UPDATE `paises` SET `Nombre_pais` = 'PAÍSES BAJOS' WHERE `Id_pais` = 'NL';
UPDATE `paises` SET `Nombre_pais` = 'PAKISTÁN' WHERE `Id_pais` = 'PK';
UPDATE `paises` SET `Nombre_pais` = 'PANAMÁ (incluida la antigua Zona del Canal)' WHERE `Id_pais` = 'PA';
UPDATE `paises` SET `Nombre_pais` = 'PAPUA NUEVA GUINEA' WHERE `Id_pais` = 'PG';
UPDATE `paises` SET `Nombre_pais` = 'PERÚ' WHERE `Id_pais` = 'PE';
UPDATE `paises` SET `Nombre_pais` = 'POLINESIA FRANCESA' WHERE `Id_pais` = 'PF';
UPDATE `paises` SET `Nombre_pais` = 'PORTUGAL (Incluidos los Archipiélagos de las Azores y de Madeira)' WHERE `Id_pais` = 'PT';
UPDATE `paises` SET `Nombre_pais` = 'REINO UNIDO (Gran Bretaña e Irlanda del Norte)' WHERE `Id_pais` = 'GB';
UPDATE `paises` SET `Nombre_pais` = 'RUMANÍA' WHERE `Id_pais` = 'RO';
UPDATE `paises` SET `Nombre_pais` = 'RUSIA (FEDERACIÓN DE)' WHERE `Id_pais` = 'RU';
UPDATE `paises` SET `Nombre_pais` = 'SALOMÓN, ISLAS' WHERE `Id_pais` = 'SB';
UPDATE `paises` SET `Nombre_pais` = 'SAN PEDRO Y MIQUELÓN' WHERE `Id_pais` = 'PM';
UPDATE `paises` SET `Nombre_pais` = 'SANTA LUCÍA' WHERE `Id_pais` = 'LC';
UPDATE `paises` SET `Nombre_pais` = 'SANTO TOMÉ Y PRÍNCIPE' WHERE `Id_pais` = 'ST';
UPDATE `paises` SET `Nombre_pais` = 'SIRIA (REPÚBLICA ÁRABE)' WHERE `Id_pais` = 'SY';
UPDATE `paises` SET `Nombre_pais` = 'TAILANDIA' WHERE `Id_pais` = 'TH';
UPDATE `paises` SET `Nombre_pais` = 'TAIWÁN' WHERE `Id_pais` = 'TW';
UPDATE `paises` SET `Nombre_pais` = 'TANZANIA (REPÚBLICA UNIDA DE)' WHERE `Id_pais` = 'TZ';
UPDATE `paises` SET `Nombre_pais` = 'TAYIKISTÁN' WHERE `Id_pais` = 'TJ';
UPDATE `paises` SET `Nombre_pais` = 'TÚNEZ' WHERE `Id_pais` = 'TN';
UPDATE `paises` SET `Nombre_pais` = 'TURKMENISTÁN' WHERE `Id_pais` = 'TM';
UPDATE `paises` SET `Nombre_pais` = 'TURQUÍA' WHERE `Id_pais` = 'TR';
UPDATE `paises` SET `Nombre_pais` = 'UZBEKISTÁN' WHERE `Id_pais` = 'UZ';
UPDATE `paises` SET `Nombre_pais` = 'VENEZUELA' WHERE `Id_pais` = 'VE';
UPDATE `paises` SET `Nombre_pais` = 'VÍRGENES BRITÁNICAS, ISLAS' WHERE `Id_pais` = 'VG';
UPDATE `paises` SET `Nombre_pais` = 'VÍRGENES DE LOS EE.UU, ISLAS' WHERE `Id_pais` = 'VI';
UPDATE `paises` SET `Nombre_pais` = 'YEMEN (Yemen del Norte y Yemen del Sur)' WHERE `Id_pais` = 'YE';
UPDATE `paises` SET `Nombre_pais` = 'OTROS PAÍSES O TERRITORIOS NO RELACIONADOS' WHERE `Id_pais` = 'QU';

-- Verificar países con caracteres especiales
SELECT COUNT(*) as total_con_tildes FROM paises WHERE Nombre_pais REGEXP '[ÁÉÍÓÚáéíóúÑñ]';

