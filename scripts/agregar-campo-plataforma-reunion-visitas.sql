-- Script para agregar campo de plataforma de reunión a la tabla visitas
ALTER TABLE `visitas` 
ADD COLUMN IF NOT EXISTS `plataforma_reunion` VARCHAR(50) NULL COMMENT 'Plataforma de reunión: teams, meet, o manual';

