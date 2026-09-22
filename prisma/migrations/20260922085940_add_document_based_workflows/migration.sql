-- AlterTable
ALTER TABLE `workflow_tasks` ADD COLUMN `fileWorkflowDocumentId` INTEGER NULL;

-- AlterTable
ALTER TABLE `workflow_templates` ADD COLUMN `trackingMode` ENUM('STANDARD', 'DOCUMENT_BASED') NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE `document_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `defaultAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `document_types_name_key`(`name`),
    INDEX `document_types_name_idx`(`name`),
    INDEX `document_types_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_workflow_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileWorkflowId` INTEGER NOT NULL,
    `documentTypeId` INTEGER NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `baseAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `finalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'NOT_STARTED',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `file_workflow_documents_fileWorkflowId_idx`(`fileWorkflowId`),
    INDEX `file_workflow_documents_documentTypeId_idx`(`documentTypeId`),
    INDEX `file_workflow_documents_status_idx`(`status`),
    INDEX `file_workflow_documents_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `workflow_tasks_fileWorkflowDocumentId_idx` ON `workflow_tasks`(`fileWorkflowDocumentId`);

-- CreateIndex
CREATE INDEX `workflow_templates_trackingMode_idx` ON `workflow_templates`(`trackingMode`);

-- AddForeignKey
ALTER TABLE `file_workflow_documents` ADD CONSTRAINT `file_workflow_documents_fileWorkflowId_fkey` FOREIGN KEY (`fileWorkflowId`) REFERENCES `file_workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_workflow_documents` ADD CONSTRAINT `file_workflow_documents_documentTypeId_fkey` FOREIGN KEY (`documentTypeId`) REFERENCES `document_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_tasks` ADD CONSTRAINT `workflow_tasks_fileWorkflowDocumentId_fkey` FOREIGN KEY (`fileWorkflowDocumentId`) REFERENCES `file_workflow_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
