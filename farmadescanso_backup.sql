-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: farmadescanso_sql-crm-farmadescanso:3306
-- Tiempo de generación: 13-12-2025 a las 08:27:53
-- Versión del servidor: 9.5.0
-- Versión de PHP: 8.2.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `crm_farmadescanso`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Articulos`
--

CREATE TABLE `Articulos` (
  `id` int NOT NULL,
  `SKU` varchar(12) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Presentacion` varchar(20) NOT NULL,
  `Unidades_Caja` int NOT NULL,
  `PVL` decimal(10,2) NOT NULL,
  `IVA` decimal(4,2) NOT NULL DEFAULT '21.00',
  `Imagen` varchar(255) NOT NULL,
  `Id_Marca` int DEFAULT NULL,
  `EAN13` bigint NOT NULL,
  `Activo` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `Articulos`
--

INSERT INTO `Articulos` (`id`, `SKU`, `Nombre`, `Presentacion`, `Unidades_Caja`, `PVL`, `IVA`, `Imagen`, `Id_Marca`, `EAN13`, `Activo`) VALUES
(1, '216959', 'Aceite De Ducha Atopic 500 Ml', '500 ml.', 12, 8.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/676598a6a31fbecab10c5c51/images/676598a6a31fbecab10c5c52full.jpg', 1, 5600885285148, 1),
(2, '216961', 'Crema Hidratante Atopic 500 Ml', '500 ml.', 12, 8.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/674c2b187ab89aaf780b6baa/images/6765944ef93dd13c5001a0b4full.jpg', 1, 5600885285131, 1),
(3, '216962', 'Pack AtóPico Youbelle (Aceite + Hidratante)', '500 ml. + 500 ml.', 12, 14.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/674c2b187ab89aaf780b6bb0/images/676596dcfa6e56cc930edd14full.jpg', 1, 5600885285254, 1),
(4, '216958', 'Talco Liquido 250 Ml', '250 ml.', 18, 9.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/6799d83d14c25f786d01beaa/images/6799d81b0a7d8f87a30de502full.jpg', 1, 5600885285247, 1),
(5, '219395', 'Crema Exfoliante Cuerpo Manos y Pies', '200 ml', 12, 7.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/674c2b187ab89aaf780b6b95/images/6799d602445e090cf806b820full.jpg', 1, 5600885285186, 1),
(6, '219396', 'Leche Hidratante Corporal 500 Ml.', '500 ml..', 12, 8.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/674c2b187ab89aaf780b6bad/images/6799e90b3b98cfac3a02f0e5full.jpg', 1, 5600885285179, 1),
(7, '219397', 'Gel Refrescante 500 Ml', '500 ml.', 12, 8.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/674c2b187ab89aaf780b6ba4/images/6799e6e426110debf608de2dfull.jpg', 1, 5600885285162, 1),
(8, '219398', 'Gel Aloe Vera Con Extracto De Manzanilla 500 Ml', '500 ml.', 12, 4.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/674c2b187ab89aaf780b6b98/images/676595921c93c7b9aa0e3cadfull.jpg', 1, 5600885285155, 1),
(9, '219399', 'Crema Hidratante 1L', '1l.', 8, 10.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/674c2b187ab89aaf780b6ba7/images/6765935a45bf4db04708bf6bfull.jpg', 1, 5600885285124, 1),
(10, '219400', 'Gel ÍNtimo Hidratante 250 Ml', '250 ml.', 12, 6.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/674c2b187ab89aaf780b6ba1/images/674c39451dffa7b3ec05db9efull.jpg', 1, 5600885284981, 1),
(11, '219401', 'Gel ÍNtimo Calmante 250 Ml', '250 ml.', 12, 6.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/674c2b187ab89aaf780b6b9e/images/67659647d8f52591e50408adfull.jpg', 1, 5600885285209, 1),
(12, '219403', 'Jabón Liquido Perfumado Bac Lavanda 500 Ml', '500 ml.', 12, 3.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/674c2b187ab89aaf780b6bb3/images/678f7f4b0c9a6aa40c08ac89full.jpg', 1, 5600885285216, 1),
(13, '219404', 'Gel De Baño 3 En 1 1L', '1l.', 15, 5.00, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/674c2b187ab89aaf780b6b9b/images/677fbf1c9be5f9e39f0f909efull.jpg', 1, 5600885285223, 1),
(14, '220375', 'Ialozon Clean Spray 100 Ml', '100 ml.', 48, 10.41, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/690cede603e6f0044800d556/images/690cede603e6f0044800d557full.jpg', 2, 8050616170156, 1),
(15, '220381', 'Ialozon Enjuague Bucal Azul 300 Ml', '300 ml.', 20, 7.46, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/690ce8354102d031530c9097/images/690ce8354102d031530c9098full.jpg', 2, 8050616170323, 1),
(16, '220380', 'Ialozon Enjuague Bucal Rosa 300 Ml', '300 ml.', 20, 7.46, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/690cea321f3ab7aeaf0d8889/images/690cea321f3ab7aeaf0d888afull.jpg', 2, 8050616170026, 1),
(17, '220378', 'Ialozon Enjuague Bucal Superhidradante 300 Ml', '300 ml.', 20, 9.14, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/690cec8c86844852620ee580/images/690cec8c86844852620ee581full.jpg', 2, 8050616170132, 1),
(18, '220379', 'Ialozon Gel Oral 15 Ml', '15 ml.', 24, 10.99, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/690cf16c9028172611048ed6/images/690cf16c9028172611048ed7full.jpg', 2, 8050616170149, 1),
(19, '220382', 'Ialozon Pasta Dentrifical Azul 100 Ml', '100 ml.', 24, 3.99, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/690ceeea263416dd580b62db/images/690ceeea263416dd580b62dcfull.jpg', 2, 8050616170354, 1),
(20, '220377', 'Ialozon Pasta Dentrifical Rosa 100 Ml', '100 ml.', 24, 4.34, 21.00, 'https://storage.googleapis.com/public-permanent.holded.com/6735bf538272c1d5e5026edf/products/690cf020237887b4fe087ad7/images/690cf020237887b4fe087ad8full.jpg', 2, 8050616170361, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Centros_Prescriptores`
--

CREATE TABLE `Centros_Prescriptores` (
  `id` int NOT NULL,
  `Id_Ruta` int DEFAULT NULL,
  `Nombre_Centro` varchar(255) NOT NULL,
  `Direccion` varchar(255) NOT NULL,
  `Poblacion` varchar(255) NOT NULL,
  `Cod_Postal` varchar(255) NOT NULL,
  `Municipio` varchar(255) NOT NULL,
  `Telefono` varchar(255) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `Coordinador` varchar(255) DEFAULT NULL,
  `Telf_Coordinador` varchar(255) DEFAULT NULL,
  `Email_Coordinador` varchar(255) DEFAULT NULL,
  `Area_Salud` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Centros Atención Primaria, Hospitales, Clínicas Dentales, etc.';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Clientes`
--

CREATE TABLE `Clientes` (
  `id` int NOT NULL,
  `Id_Cial` int NOT NULL,
  `DNI_CIF` varchar(15) NOT NULL,
  `Nombre_Razon_Social` varchar(255) NOT NULL,
  `Nombre_Cial` varchar(255) DEFAULT NULL,
  `NumeroFarmacia` varchar(255) DEFAULT NULL,
  `Direccion` varchar(255) DEFAULT NULL,
  `Poblacion` varchar(255) DEFAULT NULL,
  `CodigoPostal` varchar(8) DEFAULT NULL,
  `Movil` varchar(13) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `TipoCliente` varchar(255) DEFAULT NULL,
  `Id_TipoCliente` int DEFAULT NULL,
  `CodPais` varchar(3) DEFAULT NULL,
  `Pais` varchar(255) DEFAULT NULL,
  `Idioma` varchar(15) DEFAULT NULL,
  `Id_Idioma` int DEFAULT NULL,
  `Moneda` varchar(4) DEFAULT NULL,
  `Id_Moneda` int DEFAULT NULL,
  `NomContacto` varchar(255) DEFAULT NULL,
  `Tarifa` varchar(255) DEFAULT NULL,
  `Id_FormaPago` int DEFAULT NULL,
  `Dto` decimal(5,2) DEFAULT '0.00',
  `CuentaContable` int DEFAULT NULL,
  `RE` decimal(5,2) DEFAULT NULL,
  `Banco` varchar(255) DEFAULT NULL,
  `Swift` varchar(255) DEFAULT NULL,
  `IBAN` varchar(34) DEFAULT NULL,
  `Modelo_347` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Clientes_Cooperativas`
--

CREATE TABLE `Clientes_Cooperativas` (
  `id` int NOT NULL,
  `Id_Cooperativa` int NOT NULL,
  `Id_Cliente` int NOT NULL,
  `NumAsociado` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Comerciales`
--

CREATE TABLE `Comerciales` (
  `id` int NOT NULL,
  `Nombre` varchar(255) NOT NULL,
  `Email` varchar(255) NOT NULL,
  `DNI` varchar(9) NOT NULL,
  `Password` varchar(255) NOT NULL,
  `Roles` json DEFAULT NULL,
  `Movil` varchar(12) NOT NULL,
  `Direccion` varchar(255) DEFAULT NULL,
  `CodigoPostal` varchar(7) DEFAULT NULL,
  `Poblacion` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `Comerciales`
--

INSERT INTO `Comerciales` (`id`, `Nombre`, `Email`, `DNI`, `Password`, `Roles`, `Movil`, `Direccion`, `CodigoPostal`, `Poblacion`) VALUES
(1, 'Paco Lara', 'paco@fralabu.com', '27451524N', '27451524N', '[\"Administrador\"]', '+34610721369', 'Calle Huerta, 15 Bajo', '30193', 'Yéchar'),
(2, 'Cristina Rico', 'cristinaricoperez@gmail.com', '34803665L', '34803665L', '[\"Comercial\"]', '+34636401019', 'Calle Gregorio Ordoñez, 4, 5º A', '30012', 'Murcia'),
(3, 'Jesús Francisco Ros', 'rosmedi@yahoo.es', '34813204J', '34813204J', '[\"Comercial\"]', '+34606423842', 'Avd. Ciudad Almería, 16, 4º B', '30002', 'Murcia'),
(4, 'Óscar Lirola Mesa', 'oscarlirola@gmail.com', '52236406W', '52236406W', '[\"Comercial\"]', '+34627058555', 'C/ Villegas nº 1, 2º D', '41004', 'Sevilla');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Cooperativas`
--

CREATE TABLE `Cooperativas` (
  `id` int NOT NULL,
  `Nombre` varchar(255) NOT NULL,
  `Email` varchar(255) NOT NULL,
  `Telefono` varchar(15) DEFAULT NULL,
  `Contacto` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `Cooperativas`
--

INSERT INTO `Cooperativas` (`id`, `Nombre`, `Email`, `Telefono`, `Contacto`) VALUES
(1, 'HEFAME', 'lopd@hefame.es', '+34968277500', 'Departamento Comercial'),
(2, 'COFARES', 'comercial@cofares.es', '+34917408700', 'Departamento Comercial'),
(3, 'Alliance Healthcare España', 'info@alliance-healthcare.es', '+34900533721', 'Departamento Comercial'),
(4, 'Bidafarma', 'portalweb@bidafarma.es', '+34952248900', 'Departamento Comercial'),
(5, 'Fedefarma', 'info@fedefarma.com', '+34937060371', 'Departamento Comercial'),
(6, 'Novaltia', 'rgpd@novaltia.es', '+34976459400', 'Departamento Comercial');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Especialidades`
--

CREATE TABLE `Especialidades` (
  `id` int NOT NULL,
  `Especialidad` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Formas_Pago`
--

CREATE TABLE `Formas_Pago` (
  `id` int NOT NULL,
  `FormaPago` varchar(255) NOT NULL,
  `Dias` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Idiomas`
--

CREATE TABLE `Idiomas` (
  `id` int NOT NULL,
  `Codigo` varchar(15) NOT NULL,
  `Nombre` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `Idiomas`
--

INSERT INTO `Idiomas` (`id`, `Codigo`, `Nombre`) VALUES
(1, 'es', 'Español'),
(2, 'ca', 'Catalán'),
(3, 'eu', 'Euskera'),
(4, 'gl', 'Gallego'),
(5, 'en', 'Inglés'),
(6, 'fr', 'Francés'),
(7, 'de', 'Alemán'),
(8, 'it', 'Italiano'),
(9, 'pt', 'Portugués'),
(10, 'nl', 'Neerlandés'),
(11, 'sv', 'Sueco'),
(12, 'no', 'Noruego'),
(13, 'da', 'Danés'),
(14, 'fi', 'Finlandés'),
(15, 'pl', 'Polaco'),
(16, 'cs', 'Checo'),
(17, 'ro', 'Rumano'),
(18, 'el', 'Griego'),
(19, 'hu', 'Húngaro'),
(20, 'bg', 'Búlgaro'),
(21, 'ru', 'Ruso'),
(22, 'zh', 'Chino'),
(23, 'ja', 'Japonés');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Marcas`
--

CREATE TABLE `Marcas` (
  `id` int NOT NULL,
  `Nombre` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `Marcas`
--

INSERT INTO `Marcas` (`id`, `Nombre`) VALUES
(2, 'Ialozon'),
(1, 'Youbelle');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Monedas`
--

CREATE TABLE `Monedas` (
  `id` int NOT NULL,
  `Codigo` varchar(4) NOT NULL,
  `Nombre` varchar(255) NOT NULL,
  `Simbolo` varchar(5) DEFAULT NULL,
  `CodigoNumerico` int DEFAULT NULL,
  `Bandera` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `Monedas`
--

INSERT INTO `Monedas` (`id`, `Codigo`, `Nombre`, `Simbolo`, `CodigoNumerico`, `Bandera`) VALUES
(1, 'EUR', 'Euro', '€', 978, '🇪🇺'),
(2, 'USD', 'Dólar estadounidense', '$', 840, '🇺🇸'),
(3, 'GBP', 'Libra esterlina', NULL, NULL, NULL),
(4, 'CHF', 'Franco suizo', NULL, NULL, NULL),
(5, 'JPY', 'Yen japonés', NULL, NULL, NULL),
(6, 'CAD', 'Dólar canadiense', NULL, NULL, NULL),
(7, 'AUD', 'Dólar australiano', NULL, NULL, NULL),
(8, 'MXN', 'Peso mexicano', NULL, NULL, NULL),
(9, 'ARS', 'Peso argentino', NULL, NULL, NULL),
(10, 'CLP', 'Peso chileno', NULL, NULL, NULL),
(11, 'COP', 'Peso colombiano', NULL, NULL, NULL),
(12, 'BRL', 'Real brasileño', NULL, NULL, NULL),
(13, 'PEN', 'Sol peruano', NULL, NULL, NULL),
(14, 'UYU', 'Peso uruguayo', NULL, NULL, NULL),
(15, 'CNY', 'Yuan chino', NULL, NULL, NULL),
(16, 'HKD', 'Dólar de Hong Kong', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Pedidos`
--

CREATE TABLE `Pedidos` (
  `id` int NOT NULL,
  `Id_Cial` int NOT NULL,
  `Id_Cliente` int NOT NULL,
  `Id_FormaPago` int NOT NULL,
  `Id_TipoPedido` int NOT NULL,
  `Serie` varchar(255) NOT NULL COMMENT 'Serie de pedidos, web, Transfer, directos, etc.',
  `NumPedido` varchar(255) NOT NULL,
  `FechaPedido` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `FechaEntrega` date DEFAULT NULL,
  `EstadoPedido` varchar(255) NOT NULL,
  `TotalDescuento` decimal(10,2) DEFAULT NULL,
  `BaseImponible` decimal(10,2) NOT NULL DEFAULT '0.00',
  `TotalIva` decimal(10,2) DEFAULT NULL,
  `TotalPedido` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Pedidos_Articulos`
--

CREATE TABLE `Pedidos_Articulos` (
  `id` int NOT NULL,
  `Id_NumPedido` int NOT NULL,
  `Id_Articulo` int NOT NULL,
  `NumPedido` varchar(255) NOT NULL,
  `Articulo` varchar(255) NOT NULL,
  `Cantidad` int NOT NULL,
  `PVP` decimal(10,2) NOT NULL,
  `DtoLinea` decimal(5,2) DEFAULT NULL,
  `Subtotal` decimal(10,2) DEFAULT NULL,
  `DtoTotal` decimal(5,2) DEFAULT NULL,
  `IVA` decimal(5,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Prescriptores`
--

CREATE TABLE `Prescriptores` (
  `id` int NOT NULL,
  `Id_Centro` int DEFAULT NULL,
  `Id_Especialidad` int DEFAULT NULL,
  `Nombre` varchar(255) DEFAULT NULL,
  `Apodo` varchar(255) DEFAULT NULL,
  `Telefono` varchar(255) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `Visitado` date DEFAULT NULL,
  `Notas` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Última Visita';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Rutas`
--

CREATE TABLE `Rutas` (
  `id` int NOT NULL,
  `Nombre` varchar(255) NOT NULL,
  `Dias_Visita` varchar(255) NOT NULL,
  `Hora_Visita` time NOT NULL,
  `Notas` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Días Visita LMXJV';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Tipos_Clientes`
--

CREATE TABLE `Tipos_Clientes` (
  `id` int NOT NULL,
  `Tipo` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Tipos_Pedidos`
--

CREATE TABLE `Tipos_Pedidos` (
  `id` int NOT NULL,
  `Tipo` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Visitas`
--

CREATE TABLE `Visitas` (
  `id` int NOT NULL,
  `Id_Cliente` int DEFAULT NULL,
  `Id_Centro_Pre` int DEFAULT NULL,
  `Id_Prescritor` int DEFAULT NULL,
  `Id_Ruta` int DEFAULT NULL,
  `Tipo_Visita` varchar(255) NOT NULL,
  `Fecha` date NOT NULL,
  `Hora` time NOT NULL,
  `Notas` varchar(255) DEFAULT NULL,
  `Estado_Visita` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `Articulos`
--
ALTER TABLE `Articulos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `SKU` (`SKU`),
  ADD UNIQUE KEY `EAN13` (`EAN13`),
  ADD KEY `idx_articulos_activo` (`Activo`),
  ADD KEY `fk_articulos_marca` (`Id_Marca`);

--
-- Indices de la tabla `Centros_Prescriptores`
--
ALTER TABLE `Centros_Prescriptores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_centros_ruta` (`Id_Ruta`);

--
-- Indices de la tabla `Clientes`
--
ALTER TABLE `Clientes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `NumeroFarmacia` (`NumeroFarmacia`),
  ADD UNIQUE KEY `CuentaContable` (`CuentaContable`),
  ADD KEY `idx_clientes_id_cial` (`Id_Cial`),
  ADD KEY `idx_clientes_dni_cif` (`DNI_CIF`),
  ADD KEY `idx_clientes_email` (`Email`),
  ADD KEY `fk_clientes_formapago` (`Id_FormaPago`),
  ADD KEY `fk_clientes_tipocliente` (`Id_TipoCliente`),
  ADD KEY `fk_clientes_idioma` (`Id_Idioma`),
  ADD KEY `fk_clientes_moneda` (`Id_Moneda`);

--
-- Indices de la tabla `Clientes_Cooperativas`
--
ALTER TABLE `Clientes_Cooperativas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_cli_coop_cooperativa` (`Id_Cooperativa`),
  ADD KEY `idx_cli_coop_cliente` (`Id_Cliente`);

--
-- Indices de la tabla `Comerciales`
--
ALTER TABLE `Comerciales`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Email` (`Email`),
  ADD UNIQUE KEY `uk_comerciales_dni` (`DNI`);

--
-- Indices de la tabla `Cooperativas`
--
ALTER TABLE `Cooperativas`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `Especialidades`
--
ALTER TABLE `Especialidades`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `Formas_Pago`
--
ALTER TABLE `Formas_Pago`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `Idiomas`
--
ALTER TABLE `Idiomas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_idiomas_codigo` (`Codigo`);

--
-- Indices de la tabla `Marcas`
--
ALTER TABLE `Marcas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_marcas_nombre` (`Nombre`);

--
-- Indices de la tabla `Monedas`
--
ALTER TABLE `Monedas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_monedas_codigo` (`Codigo`);

--
-- Indices de la tabla `Pedidos`
--
ALTER TABLE `Pedidos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pedidos_id_cial` (`Id_Cial`),
  ADD KEY `idx_pedidos_id_cliente` (`Id_Cliente`),
  ADD KEY `idx_pedidos_formapago` (`Id_FormaPago`),
  ADD KEY `idx_pedidos_tipopedido` (`Id_TipoPedido`),
  ADD KEY `idx_pedidos_numpedido` (`NumPedido`);

--
-- Indices de la tabla `Pedidos_Articulos`
--
ALTER TABLE `Pedidos_Articulos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pedart_pedido` (`Id_NumPedido`),
  ADD KEY `idx_pedart_articulo` (`Id_Articulo`);

--
-- Indices de la tabla `Prescriptores`
--
ALTER TABLE `Prescriptores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_prescriptores_centro` (`Id_Centro`),
  ADD KEY `idx_prescriptores_especialidad` (`Id_Especialidad`);

--
-- Indices de la tabla `Rutas`
--
ALTER TABLE `Rutas`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `Tipos_Clientes`
--
ALTER TABLE `Tipos_Clientes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_tipos_clientes_tipo` (`Tipo`);

--
-- Indices de la tabla `Tipos_Pedidos`
--
ALTER TABLE `Tipos_Pedidos`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `Visitas`
--
ALTER TABLE `Visitas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_visitas_cliente` (`Id_Cliente`),
  ADD KEY `idx_visitas_centro` (`Id_Centro_Pre`),
  ADD KEY `idx_visitas_prescritor` (`Id_Prescritor`),
  ADD KEY `idx_visitas_ruta` (`Id_Ruta`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `Articulos`
--
ALTER TABLE `Articulos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT de la tabla `Centros_Prescriptores`
--
ALTER TABLE `Centros_Prescriptores`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Clientes`
--
ALTER TABLE `Clientes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Clientes_Cooperativas`
--
ALTER TABLE `Clientes_Cooperativas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Comerciales`
--
ALTER TABLE `Comerciales`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `Cooperativas`
--
ALTER TABLE `Cooperativas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `Especialidades`
--
ALTER TABLE `Especialidades`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Formas_Pago`
--
ALTER TABLE `Formas_Pago`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Idiomas`
--
ALTER TABLE `Idiomas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT de la tabla `Marcas`
--
ALTER TABLE `Marcas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `Monedas`
--
ALTER TABLE `Monedas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT de la tabla `Pedidos`
--
ALTER TABLE `Pedidos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Pedidos_Articulos`
--
ALTER TABLE `Pedidos_Articulos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Prescriptores`
--
ALTER TABLE `Prescriptores`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Rutas`
--
ALTER TABLE `Rutas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Tipos_Clientes`
--
ALTER TABLE `Tipos_Clientes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Tipos_Pedidos`
--
ALTER TABLE `Tipos_Pedidos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Visitas`
--
ALTER TABLE `Visitas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `Articulos`
--
ALTER TABLE `Articulos`
  ADD CONSTRAINT `fk_articulos_marca` FOREIGN KEY (`Id_Marca`) REFERENCES `Marcas` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

--
-- Filtros para la tabla `Centros_Prescriptores`
--
ALTER TABLE `Centros_Prescriptores`
  ADD CONSTRAINT `fk_centros_ruta` FOREIGN KEY (`Id_Ruta`) REFERENCES `Rutas` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `Clientes`
--
ALTER TABLE `Clientes`
  ADD CONSTRAINT `fk_clientes_cial` FOREIGN KEY (`Id_Cial`) REFERENCES `Comerciales` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_clientes_formapago` FOREIGN KEY (`Id_FormaPago`) REFERENCES `Formas_Pago` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_clientes_idioma` FOREIGN KEY (`Id_Idioma`) REFERENCES `Idiomas` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_clientes_moneda` FOREIGN KEY (`Id_Moneda`) REFERENCES `Monedas` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_clientes_tipocliente` FOREIGN KEY (`Id_TipoCliente`) REFERENCES `Tipos_Clientes` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

--
-- Filtros para la tabla `Clientes_Cooperativas`
--
ALTER TABLE `Clientes_Cooperativas`
  ADD CONSTRAINT `fk_cli_coop_cliente` FOREIGN KEY (`Id_Cliente`) REFERENCES `Clientes` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_cli_coop_cooperativa` FOREIGN KEY (`Id_Cooperativa`) REFERENCES `Cooperativas` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `Pedidos`
--
ALTER TABLE `Pedidos`
  ADD CONSTRAINT `fk_pedidos_cial` FOREIGN KEY (`Id_Cial`) REFERENCES `Comerciales` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_pedidos_cliente` FOREIGN KEY (`Id_Cliente`) REFERENCES `Clientes` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_pedidos_formapago` FOREIGN KEY (`Id_FormaPago`) REFERENCES `Formas_Pago` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_pedidos_tipopedido` FOREIGN KEY (`Id_TipoPedido`) REFERENCES `Tipos_Pedidos` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `Pedidos_Articulos`
--
ALTER TABLE `Pedidos_Articulos`
  ADD CONSTRAINT `fk_pedart_articulo` FOREIGN KEY (`Id_Articulo`) REFERENCES `Articulos` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_pedart_pedido` FOREIGN KEY (`Id_NumPedido`) REFERENCES `Pedidos` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `Prescriptores`
--
ALTER TABLE `Prescriptores`
  ADD CONSTRAINT `fk_prescriptores_centro` FOREIGN KEY (`Id_Centro`) REFERENCES `Centros_Prescriptores` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_prescriptores_especialidad` FOREIGN KEY (`Id_Especialidad`) REFERENCES `Especialidades` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

--
-- Filtros para la tabla `Visitas`
--
ALTER TABLE `Visitas`
  ADD CONSTRAINT `fk_visitas_centro` FOREIGN KEY (`Id_Centro_Pre`) REFERENCES `Centros_Prescriptores` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_visitas_cliente` FOREIGN KEY (`Id_Cliente`) REFERENCES `Clientes` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_visitas_prescritor` FOREIGN KEY (`Id_Prescritor`) REFERENCES `Prescriptores` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_visitas_ruta` FOREIGN KEY (`Id_Ruta`) REFERENCES `Rutas` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
