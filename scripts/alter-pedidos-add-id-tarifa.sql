-- Añadir la tarifa aplicada al pedido para "congelar" precios/comisiones
-- Ejecutar en MySQL / phpMyAdmin (producción) una sola vez.
-- Si la tabla se llama `Pedidos` (mayúsculas), ajusta el nombre.

ALTER TABLE `pedidos`
  ADD COLUMN `Id_Tarifa` INT NOT NULL DEFAULT 0 AFTER `Id_TipoPedido`;

-- Opcional (recomendado): índice para filtrar/reporting por tarifa
CREATE INDEX `idx_pedidos_id_tarifa` ON `pedidos` (`Id_Tarifa`);

