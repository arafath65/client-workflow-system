-- CreateTable
CREATE TABLE `payment_refunds` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentId` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `reason` TEXT NOT NULL,
    `refundedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_refunds_paymentId_idx`(`paymentId`),
    INDEX `payment_refunds_refundedAt_idx`(`refundedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_refunds` ADD CONSTRAINT `payment_refunds_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
