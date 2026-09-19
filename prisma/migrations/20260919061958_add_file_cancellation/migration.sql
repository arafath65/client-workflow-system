-- AlterTable
ALTER TABLE `client_files` ADD COLUMN `cancellationReason` VARCHAR(191) NULL,
    ADD COLUMN `cancellationSettlement` ENUM('NO_PAYMENT', 'REFUND_PAID', 'NON_REFUNDABLE', 'TRANSFER_CREDIT') NULL,
    ADD COLUMN `cancellationSettlementAmount` DECIMAL(12, 2) NULL,
    ADD COLUMN `cancellationTransferTargetFileId` INTEGER NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL;
