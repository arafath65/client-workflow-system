-- AlterTable
ALTER TABLE `file_workflows` ADD COLUMN `baseAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `finalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `payment_installments` ADD COLUMN `fileWorkflowId` INTEGER NULL;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `fileWorkflowId` INTEGER NULL;

-- CreateTable
CREATE TABLE `payment_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentId` INTEGER NOT NULL,
    `installmentId` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_allocations_paymentId_idx`(`paymentId`),
    INDEX `payment_allocations_installmentId_idx`(`installmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `payment_installments_fileWorkflowId_idx` ON `payment_installments`(`fileWorkflowId`);

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_installmentId_fkey` FOREIGN KEY (`installmentId`) REFERENCES `payment_installments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_fileWorkflowId_fkey` FOREIGN KEY (`fileWorkflowId`) REFERENCES `file_workflows`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_installments` ADD CONSTRAINT `payment_installments_fileWorkflowId_fkey` FOREIGN KEY (`fileWorkflowId`) REFERENCES `file_workflows`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
