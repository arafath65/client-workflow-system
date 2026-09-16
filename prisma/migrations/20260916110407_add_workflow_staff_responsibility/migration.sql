-- DropForeignKey
ALTER TABLE `file_workflows` DROP FOREIGN KEY `file_workflows_clientFileId_fkey`;

-- DropForeignKey
ALTER TABLE `workflow_tasks` DROP FOREIGN KEY `workflow_tasks_fileWorkflowId_fkey`;

-- AlterTable
ALTER TABLE `file_workflows` ADD COLUMN `assignedStaffId` INTEGER NULL;

-- AlterTable
ALTER TABLE `workflow_sub_tasks` ADD COLUMN `defaultStaffId` INTEGER NULL;

-- CreateTable
CREATE TABLE `file_workflow_sub_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workflowTaskId` INTEGER NOT NULL,
    `workflowSubTaskId` INTEGER NOT NULL,
    `assignedStaffId` INTEGER NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `remarks` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `file_workflow_sub_tasks_workflowTaskId_idx`(`workflowTaskId`),
    INDEX `file_workflow_sub_tasks_workflowSubTaskId_idx`(`workflowSubTaskId`),
    INDEX `file_workflow_sub_tasks_assignedStaffId_idx`(`assignedStaffId`),
    INDEX `file_workflow_sub_tasks_status_idx`(`status`),
    UNIQUE INDEX `file_workflow_sub_tasks_workflowTaskId_workflowSubTaskId_key`(`workflowTaskId`, `workflowSubTaskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `file_workflows_assignedStaffId_idx` ON `file_workflows`(`assignedStaffId`);

-- CreateIndex
CREATE INDEX `workflow_steps_status_idx` ON `workflow_steps`(`status`);

-- CreateIndex
CREATE INDEX `workflow_sub_tasks_defaultStaffId_idx` ON `workflow_sub_tasks`(`defaultStaffId`);

-- AddForeignKey
ALTER TABLE `workflow_sub_tasks` ADD CONSTRAINT `workflow_sub_tasks_defaultStaffId_fkey` FOREIGN KEY (`defaultStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_workflows` ADD CONSTRAINT `file_workflows_clientFileId_fkey` FOREIGN KEY (`clientFileId`) REFERENCES `client_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_workflows` ADD CONSTRAINT `file_workflows_assignedStaffId_fkey` FOREIGN KEY (`assignedStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_tasks` ADD CONSTRAINT `workflow_tasks_fileWorkflowId_fkey` FOREIGN KEY (`fileWorkflowId`) REFERENCES `file_workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_workflow_sub_tasks` ADD CONSTRAINT `file_workflow_sub_tasks_workflowTaskId_fkey` FOREIGN KEY (`workflowTaskId`) REFERENCES `workflow_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_workflow_sub_tasks` ADD CONSTRAINT `file_workflow_sub_tasks_workflowSubTaskId_fkey` FOREIGN KEY (`workflowSubTaskId`) REFERENCES `workflow_sub_tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_workflow_sub_tasks` ADD CONSTRAINT `file_workflow_sub_tasks_assignedStaffId_fkey` FOREIGN KEY (`assignedStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
