-- AlterTable
ALTER TABLE `file_workflow_documents` ADD COLUMN `languageId` INTEGER NULL,
    ADD COLUMN `languageName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `workflow_templates` ADD COLUMN `documentTypeId` INTEGER NULL;

-- CreateTable
CREATE TABLE `languages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `languages_name_key`(`name`),
    INDEX `languages_name_idx`(`name`),
    INDEX `languages_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_type_languages` (
    `documentTypeId` INTEGER NOT NULL,
    `languageId` INTEGER NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_type_languages_languageId_idx`(`languageId`),
    PRIMARY KEY (`documentTypeId`, `languageId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `file_workflow_documents_languageId_idx` ON `file_workflow_documents`(`languageId`);

-- CreateIndex
CREATE INDEX `workflow_templates_documentTypeId_idx` ON `workflow_templates`(`documentTypeId`);

-- AddForeignKey
ALTER TABLE `workflow_templates` ADD CONSTRAINT `workflow_templates_documentTypeId_fkey` FOREIGN KEY (`documentTypeId`) REFERENCES `document_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_type_languages` ADD CONSTRAINT `document_type_languages_documentTypeId_fkey` FOREIGN KEY (`documentTypeId`) REFERENCES `document_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_type_languages` ADD CONSTRAINT `document_type_languages_languageId_fkey` FOREIGN KEY (`languageId`) REFERENCES `languages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_workflow_documents` ADD CONSTRAINT `file_workflow_documents_languageId_fkey` FOREIGN KEY (`languageId`) REFERENCES `languages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
