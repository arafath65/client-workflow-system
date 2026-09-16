-- AlterTable
ALTER TABLE `workflow_templates` ADD COLUMN `defaultStaffId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `workflow_templates_defaultStaffId_idx` ON `workflow_templates`(`defaultStaffId`);

-- AddForeignKey
ALTER TABLE `workflow_templates` ADD CONSTRAINT `workflow_templates_defaultStaffId_fkey` FOREIGN KEY (`defaultStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
