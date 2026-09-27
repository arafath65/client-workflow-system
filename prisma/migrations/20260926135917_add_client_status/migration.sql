-- AlterTable
ALTER TABLE `clients` ADD COLUMN `status` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX `clients_status_idx` ON `clients`(`status`);
