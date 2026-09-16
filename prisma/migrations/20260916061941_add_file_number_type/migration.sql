-- AlterTable
ALTER TABLE `client_files` ADD COLUMN `fileNumberType` ENUM('SYSTEM', 'CUSTOM') NOT NULL DEFAULT 'SYSTEM';
