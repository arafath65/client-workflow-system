-- CreateTable
CREATE TABLE `workflow_sub_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workflowStepId` INTEGER NOT NULL,
    `subTaskNumber` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `workflow_sub_tasks_workflowStepId_idx`(`workflowStepId`),
    INDEX `workflow_sub_tasks_status_idx`(`status`),
    UNIQUE INDEX `workflow_sub_tasks_workflowStepId_subTaskNumber_key`(`workflowStepId`, `subTaskNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_charges` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientFileId` INTEGER NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitAmount` DECIMAL(12, 2) NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `file_charges_clientFileId_idx`(`clientFileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientFileId` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `paymentMethod` ENUM('CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE') NOT NULL,
    `status` ENUM('PENDING', 'CLEARED', 'CANCELLED', 'RETURNED', 'BOUNCED') NOT NULL DEFAULT 'CLEARED',
    `referenceNo` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payments_clientFileId_idx`(`clientFileId`),
    INDEX `payments_paymentMethod_idx`(`paymentMethod`),
    INDEX `payments_status_idx`(`status`),
    INDEX `payments_paidAt_idx`(`paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_installments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentId` INTEGER NULL,
    `clientFileId` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_installments_paymentId_idx`(`paymentId`),
    INDEX `payment_installments_clientFileId_idx`(`clientFileId`),
    INDEX `payment_installments_dueDate_idx`(`dueDate`),
    INDEX `payment_installments_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `calendar_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NULL,
    `clientFileId` INTEGER NULL,
    `staffId` INTEGER NULL,
    `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `calendar_events_startAt_idx`(`startAt`),
    INDEX `calendar_events_clientFileId_idx`(`clientFileId`),
    INDEX `calendar_events_staffId_idx`(`staffId`),
    INDEX `calendar_events_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `workflow_sub_tasks` ADD CONSTRAINT `workflow_sub_tasks_workflowStepId_fkey` FOREIGN KEY (`workflowStepId`) REFERENCES `workflow_steps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_charges` ADD CONSTRAINT `file_charges_clientFileId_fkey` FOREIGN KEY (`clientFileId`) REFERENCES `client_files`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_clientFileId_fkey` FOREIGN KEY (`clientFileId`) REFERENCES `client_files`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_installments` ADD CONSTRAINT `payment_installments_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_installments` ADD CONSTRAINT `payment_installments_clientFileId_fkey` FOREIGN KEY (`clientFileId`) REFERENCES `client_files`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_clientFileId_fkey` FOREIGN KEY (`clientFileId`) REFERENCES `client_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
