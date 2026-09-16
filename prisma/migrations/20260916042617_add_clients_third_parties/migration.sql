/*
  Warnings:

  - You are about to drop the column `address` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `mobile` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `nic` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `clients` table. All the data in the column will be lost.
  - Added the required column `name` to the `clients` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `client_files` DROP FOREIGN KEY `client_files_clientId_fkey`;

-- DropIndex
DROP INDEX `clients_fullName_idx` ON `clients`;

-- DropIndex
DROP INDEX `clients_mobile_idx` ON `clients`;

-- DropIndex
DROP INDEX `clients_nic_idx` ON `clients`;

-- AlterTable
ALTER TABLE `client_files` ADD COLUMN `thirdPartyId` INTEGER NULL;

-- AlterTable
ALTER TABLE `clients` DROP COLUMN `address`,
    DROP COLUMN `email`,
    DROP COLUMN `fullName`,
    DROP COLUMN `mobile`,
    DROP COLUMN `nic`,
    DROP COLUMN `notes`,
    DROP COLUMN `status`,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `whatsapp` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `third_parties` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `whatsapp` VARCHAR(191) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `third_parties_name_idx`(`name`),
    INDEX `third_parties_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `client_files_thirdPartyId_idx` ON `client_files`(`thirdPartyId`);

-- CreateIndex
CREATE INDEX `clients_name_idx` ON `clients`(`name`);

-- CreateIndex
CREATE INDEX `clients_whatsapp_idx` ON `clients`(`whatsapp`);

-- AddForeignKey
ALTER TABLE `client_files` ADD CONSTRAINT `client_files_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_files` ADD CONSTRAINT `client_files_thirdPartyId_fkey` FOREIGN KEY (`thirdPartyId`) REFERENCES `third_parties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
