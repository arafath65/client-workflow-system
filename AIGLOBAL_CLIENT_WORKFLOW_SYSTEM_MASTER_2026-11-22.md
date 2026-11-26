# A&I GLOBAL CLIENT WORKFLOW SYSTEM — MASTER PROJECT RECORD

**Technical handover, business-rules reference and continuation baseline**  
**Last updated:** 26 November 2026  
**Customer / product:** A&I Global — Client Workflow System  
**Application identity:** A&I Global Workflow System  
**Development environment:** Windows 11, PowerShell, Next.js, React, TypeScript, Prisma, MySQL and Electron  
**Known active project path:** `C:\Users\Pradeep\Downloads\client-workflow-system`  
**Known Git branch from the latest project context:** `main` (re-check before any Git operation)

> **Purpose.** This is the durable master record for continuing the A&I Global Client Workflow System in a new ChatGPT conversation. It is intended to retain the product's business rules, technical architecture, database structure, routes, reports, payment behavior, implementation history, customer decisions, test evidence, defects, release process and outstanding work. It must be updated after each meaningful customer change or development milestone.
>
> **Evidence discipline.** This document combines (1) the Prisma schema snapshot shared on 19 November 2026, (2) the package/build information captured in the project files, and (3) later implementation and test confirmations from the project conversations through 22 November 2026. The current Windows working tree was not directly mounted and inspected while this document was prepared. Therefore, the 19 November schema and September package/build snapshots are identified as snapshots, while later changes are identified as conversation-confirmed. Before modifying code or applying a migration, inspect the current local files and reconcile them with this record. Unknowns are intentionally marked as unknown.

---

## 1. Project Overview and Objectives

The A&I Global Client Workflow System is a desktop-oriented business application for managing client records, service files, configurable workflows, staff assignments, document-based work, payments, collections, expenses, calendar events and operational reporting.

The system is developed as a Next.js application and packaged for Windows desktop use with Electron. The application runtime is packaged with the desktop installer. The MySQL database is configured separately and must be reachable by the installed application; the available package configuration does not show a bundled MySQL server.

### 1.1 Main product objectives

- Maintain clients and their service files in one system.
- Support automatically generated file numbers and manually supplied/custom file numbers.
- Define reusable workflow templates, ordered workflow steps and child subtasks.
- Assign work to staff at template, workflow, step or subtask level where supported.
- Track file-level, workflow-level, step-level and subtask-level progress independently where the domain requires it.
- Support both standard workflow tracking and document-based workflow tracking.
- Configure master document types and available languages, with document/language pricing.
- Preserve prices agreed for an existing client file even if master prices change later.
- Record file charges, client payments, installment schedules, payment allocations and refunds.
- Keep workflow progress separate from financial/payment status.
- Track expenses and calendar events.
- Maintain audit history for important user actions.
- Produce staff work reports and a date-based Work Activity report, including downloadable PDF output.
- Run as a Windows desktop application through Electron while retaining the Next.js application and API routes.

### 1.2 Customer-facing business area

The app is branded as **A&I Global** and the desktop product name is **A&I Global Workflow System**. The company label in UI/reporting includes “A&I Global”; the package author is recorded as “A&I Global”.

### 1.3 Current boundary

The project is a single-business workflow application in the available schema and route records. No confirmed multi-tenant/organization model, branch model, or multi-company authorization model appears in the November Prisma schema snapshot. Do not introduce tenancy assumptions without a customer requirement and an approved data/security design.

---

## 2. Technology Stack and Development Environment

### 2.1 Frontend and application framework

- Next.js **16.3.5** (confirmed in captured build output and package files).
- React **19.2.8** in the captured package snapshot.
- TypeScript **5.x** in the captured package snapshot.
- Tailwind CSS **4.x** in the captured package snapshot.
- Next.js App Router (`app/` directory).
- Turbopack was used by the captured Next.js build.

### 2.2 Database and ORM

- MySQL is the database provider in the Prisma schema.
- Prisma ORM **7.10.0** in the captured package snapshot.
- `@prisma/client` **7.10.0** in the captured package snapshot.
- `@prisma/adapter-mariadb` **7.10.0-compatible package line** is present in the captured package snapshot.
- Prisma schema path: `prisma/schema.prisma` (confirmed through the project structure and Prisma migration history).
- A `prisma.config.ts`/runtime connection configuration may be used under Prisma 7; inspect the current file and `.env` rather than assuming the connection string is declared in the schema.

### 2.3 Server-side libraries and utilities

Captured package dependencies include:

- `bcryptjs` — password hashing.
- `dotenv` — environment configuration.
- `pdfkit` — server-side PDF creation.
- `tsx` — TypeScript execution utility.
- `@prisma/adapter-mariadb` and `@prisma/client` — Prisma database adapter/client.

### 2.4 Electron desktop packaging

- Electron **44.4.5** in the captured package snapshot/build log.
- `electron-builder` **26.15.3** in the captured package snapshot/build log.
- Windows NSIS installer target, x64 architecture.
- Desktop entry point: `electron/main.cjs`.
- Desktop preparation script: `scripts/prepare-desktop.cjs`.
- Build output directory: `release/`.

### 2.5 Operating environment and project paths

Known project path from build logs and the latest project continuation context:

```text
C:\Users\Pradeep\Downloads\client-workflow-system
```

The exact active path on the user's machine must be re-confirmed if the work moves to another computer. Do not assume that a copied project folder, older ZIP, or installed desktop copy contains the latest source.

### 2.6 Runtime and timezone

- A captured desktop build ran on Windows with Node.js **v24.21.0** at that time. Re-check with `node -v` before depending on this exact version.
- The report implementation uses `Asia/Colombo` as its timezone constant in the captured code/patch context.
- Finance/date filtering also uses Colombo-local date helpers in the captured UI. Preserve consistent local date interpretation across pages, APIs, reports and PDF output.

### 2.7 Package scripts recorded in `package.json`

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "desktop": "electron .",
  "desktop:prepare": "npm run build && node scripts/prepare-desktop.cjs",
  "desktop:dist": "npm run desktop:prepare && electron-builder --win"
}
```

The package snapshot also had a `postinstall` script for Prisma skills synchronization. Always inspect the live `package.json` before relying on the script list or dependency versions.

---

## 3. High-Level Application Architecture

### 3.1 Logical architecture

```text
Windows User
    |
    v
A&I Global Workflow System (Electron desktop shell)
    |
    +-- Electron main process
    |      - Starts the packaged Next.js server
    |      - Waits for the local server to become available
    |      - Opens the application window
    |
    +-- Packaged Next.js standalone runtime
           - React / Next.js UI
           - App Router pages
           - Route Handlers under app/api
           - Authentication/session handling
           - Prisma Client / adapter
                   |
                   v
             MySQL database
             - users / staff / clients
             - client files / workflows / documents
             - tasks / subtasks / history
             - charges / payments / refunds / installments
             - expenses / calendar / audit / reporting activity
```

### 3.2 Important architecture boundary

Electron is the desktop host and packages the Next.js application runtime. It does not replace the Next.js API routes or Prisma data layer. The exact database host (local MySQL, LAN MySQL or hosted MySQL) is determined by the live runtime configuration and deployment plan; it must not be guessed from the fact that the app is installed on Windows.

### 3.3 Database dependency

The installer configuration includes the Electron runtime, packaged Next.js runtime and application icon. No MySQL server installer or embedded database server is listed in the captured `extraResources`. Therefore:

- A MySQL service must exist separately.
- The app must have valid database connection configuration at runtime.
- The MySQL server must be reachable from the computer running the application.
- Database credentials must remain outside Git and out of this master document.
- A desktop install succeeding does not by itself prove database connectivity or a successful login.

### 3.4 Main application flow

```text
Login
  -> Dashboard
      -> Clients
      -> Files
          -> Client File Details
              -> Workflow(s)
                  -> Document(s), where document-based tracking applies
                      -> Workflow Steps
                          -> Subtasks
              -> Charges
              -> Payments / Installments / Refunds
      -> Workflows (template configuration)
      -> Staff
      -> Staff Work (legacy/earlier work view)
      -> Work Activity report
      -> Payments / Finance
      -> Calendar
      -> Third Parties
      -> Document Types / Languages
      -> Audit Logs
      -> Settings / Backup / Password
```

This diagram represents the feature map and the model relationships documented in the available records. It does not imply that every UI action or edge case has had end-to-end acceptance testing.

---

## 4. Product Modules and Screen Inventory

The following pages were observed in build output and/or confirmed through later project work. The current route tree should be checked before changing navigation.

| Module | Known page route | Purpose / known behavior | State in latest project context |
|---|---|---|---|
| Login | `/login` | User sign-in | Existing page/API flow |
| Dashboard | `/dashboard` | Application overview | Existing page; full current widget details should be verified |
| Clients | `/clients` | Client listing and management | Existing module |
| Client detail | `/clients/[id]` | Client details and related records/files | Existing module |
| Files | `/files` | Client-file listing, filters and pagination | Pagination improvements reported completed |
| File detail | `/files/[id]` | File details, workflows, documents and finance-related records | Existing module; current details depend on active source |
| Workflow templates | `/workflows` | Workflow template listing/configuration | Existing module |
| Workflow template detail | `/workflows/[id]` | Steps, subtasks and template editing | Existing module |
| Staff | `/staff` | Staff directory and management | Existing module |
| Staff Work | `/staff-work` | Earlier staff-work view/report area | Exists in captured build route list; distinguish from newer Work Activity report |
| Work Activity | `/reports/work-activity` | Custom date-range activity report, staff filter and PDF export | Added later; user confirmed page loaded and lint/build passed after refinements |
| Payments | `/payments` | Finance/payment dashboard | Existing page; pagination/filter improvements reported |
| Calendar | `/calendar` | Calendar events | Existing module |
| Third Parties | `/third-parties` | Third-party directory | Existing module |
| Document Types | `/settings/document-types` | Document types, language availability and pricing | Pagination/filtering improvements reported |
| Settings | `/settings` | Application settings, including password/backup functions | Existing module |
| Audit Logs | `/audit-logs` | Audit history | Pagination improvements reported |

### 4.1 Page inventory caveat

The captured route list was generated in September 2026. Pages added after that build—including `/reports/work-activity`—are not necessarily present in that historical build output. Later page and API changes supersede the older route snapshot. Run `npm run build` and inspect the active `app/` directory for the definitive current route inventory.

---

## 5. Core Business Entities and Concepts

### 5.1 User versus Staff

`User` and `Staff` are separate database models and serve different purposes:

- `User` represents the login account (`username`, `passwordHash`). It is used for authentication, expenses created by a login user and generic audit-log attribution.
- `Staff` represents the employee/person to whom work can be assigned. It has a name, contact information, position and active/inactive flag.

Never assume a `userId` is the same as a `staffId`. A login account may be different from the staff record assigned to a workflow step. Reports must keep the acting login user and assigned staff distinct where both are available.

### 5.2 Client

A client can have multiple client files. Client name and WhatsApp number are indexed in the schema snapshot. The client record has an active/inactive status flag.

### 5.3 Client File

A client file is an individual service case/work item for a client. It can have:

- A unique file number.
- A system-generated or custom file-number type.
- A title and optional description.
- A file-level lifecycle status.
- An optional third-party association.
- One or more workflows.
- Charges, payments, installments and calendar events.
- Cancellation fields and settlement metadata.

A client may therefore have more than one file over time. Do not collapse client-level identity and file-level service history into a single record.

### 5.4 Third Party

A third party is a separate master record with name, optional WhatsApp and active/inactive status. A client file can optionally refer to one third party.

### 5.5 Workflow Template, Step and Subtask

A workflow template defines a reusable service process. It contains ordered steps. Each step can have child subtasks. Template/step/subtask master records can hold default staff assignments; an actual client file uses execution records that store the current progress and actual assignment.

### 5.6 Standard versus document-based tracking

The November Prisma snapshot has `WorkflowTrackingMode`:

- `STANDARD`: one workflow instance has one set of execution steps/tasks.
- `DOCUMENT_BASED`: each selected document in the client workflow receives its own independent copy of the workflow steps and subtasks.

The document-based mode is important for translation and document-processing work where a client file may contain several documents and each document must advance independently.

### 5.7 Pricing snapshot principle

The schema comments and fields explicitly establish a price-snapshot approach:

- Master workflow/document pricing is the current default.
- At client-file creation, the applicable agreed amount is copied into the client workflow/document record.
- Changing a master price later must not silently change the price already agreed for existing client files.
- Overall workflow discount and final amount are stored separately from the master defaults.

Preserve snapshot values when updating prices or recalculating totals. Repricing existing client work must be an intentional business operation, not an accidental side effect of editing a master record.

---

## 6. Database Structure — Prisma Schema Snapshot (19 November 2026)

**Snapshot source:** the Prisma schema text shared on 19 November 2026, 819 lines, including the `WorkflowActivityLog` model. The current local schema may include changes made after that date. Use `prisma/schema.prisma` from the active working tree as the final source of truth before creating or running migrations.

### 6.1 Models and mapped MySQL tables

| Prisma model | MySQL table | Main responsibility |
|---|---|---|
| `User` | `users` | Login accounts |
| `Staff` | `staff` | Staff/person master records and assignment links |
| `Client` | `clients` | Client master records |
| `ClientFile` | `client_files` | Individual service files/cases |
| `WorkflowTemplate` | `workflow_templates` | Reusable workflow templates |
| `WorkflowStep` | `workflow_steps` | Ordered steps inside a template |
| `WorkflowSubTask` | `workflow_sub_tasks` | Reusable subtasks under a workflow step |
| `FileWorkflow` | `file_workflows` | Workflow instance attached to a client file |
| `DocumentType` | `document_types` | Reusable document-type catalog |
| `Language` | `languages` | Reusable language catalog |
| `DocumentTypeLanguage` | `document_type_languages` | Document/language price and availability mapping |
| `FileWorkflowDocument` | `file_workflow_documents` | A selected document inside a client workflow |
| `WorkflowTask` | `workflow_tasks` | Execution record for a workflow step |
| `FileWorkflowSubTask` | `file_workflow_sub_tasks` | Execution record for a subtask |
| `TaskHistory` | `task_history` | Status transition history for workflow tasks |
| `FileCharge` | `file_charges` | Additional file-level charges |
| `Expense` | `expenses` | Business expense entries |
| `Payment` | `payments` | Payment transactions against a file |
| `PaymentRefund` | `payment_refunds` | Refund transaction records against a payment |
| `PaymentInstallment` | `payment_installments` | Amounts due/paid in installment schedules |
| `PaymentAllocation` | `payment_allocations` | Allocation of payment amounts to installments |
| `CalendarEvent` | `calendar_events` | Events, deadlines and appointments |
| `ThirdParty` | `third_parties` | Third-party master records |
| `FileNumberSequence` | `file_number_sequences` | System file-number sequence counter |
| `AuditLog` | `audit_logs` | Generic user action audit events |
| `WorkflowActivityLog` | `workflow_activity_logs` | Snapshot-based step/subtask activity history for Work Activity reporting |

### 6.2 `User` — `users`

Confirmed fields in the 19 November schema snapshot:

- `id` — auto-increment primary key.
- `username` — unique login username.
- `passwordHash` — stored password hash.
- `createdAt`, `updatedAt` — timestamps.
- Relations: `expenses`, `auditLogs`.

No role, permission, email or staff foreign-key field is present in this schema snapshot. Do not claim that application-level RBAC exists based on this model.

### 6.3 `Staff` — `staff`

Fields:

- `id`, `name`, `phone?`, `email?`, `position?`, `status` (Boolean, default true), `createdAt`, `updatedAt`.
- Relations to workflow templates, template steps, template subtasks, actual workflow tasks, actual file subtasks and calendar events.
- Indexes: `name`, `status`.

The model supports a staff directory and employee assignments. It is not the authentication table.

### 6.4 `Client` — `clients`

Fields:

- `id`, `name`, `whatsapp?`, `status` (Boolean, default true), `createdAt`, `updatedAt`.
- One-to-many relation to `ClientFile`.
- Indexes: `name`, `whatsapp`, `status`.

### 6.5 `ClientFile` — `client_files`

Fields from the snapshot:

- `id`, `clientId`, `thirdPartyId?`.
- `fileNumber` — unique.
- `fileNumberType` — `SYSTEM` or `CUSTOM`; default `SYSTEM`.
- `title`, `description?`.
- `status` — `FileStatus`, default `OPEN`.
- `openedAt`, `completedAt?`.
- `cancelledAt?`, `cancellationReason?`.
- `cancellationSettlement?` — optional `FileCancellationSettlement`.
- `cancellationSettlementAmount?` — Decimal(12,2).
- `cancellationTransferTargetFileId?` — optional reference value for a transfer target; the schema snapshot does not define a Prisma relation for this field.
- `createdAt`, `updatedAt`.

Relations:

- `client` → `Client`, cascade delete.
- `thirdParty?` → `ThirdParty`, set null on delete.
- collections: `fileWorkflows`, `charges`, `payments`, `installments`, `calendarEvents`.

Indexes: `clientId`, `thirdPartyId`, `status`, `fileNumber`.

### 6.6 `WorkflowTemplate` — `workflow_templates`

Fields:

- `id`, `name`, `description?`, `defaultStaffId?`.
- `trackingMode` — `WorkflowTrackingMode`, default `STANDARD`.
- `documentTypeId?` — optional base document type for document-based workflows.
- `baseAmount` — Decimal(12,2), default 0; retained for standard workflows.
- `status` — Boolean, default true.
- `createdAt`, `updatedAt`.

Relations:

- `defaultStaff?` → `Staff`, set null on delete.
- `documentType?` → `DocumentType`, set null on delete.
- `steps`, `fileWorkflows`.

Indexes: `name`, `status`, `defaultStaffId`, `trackingMode`, `documentTypeId`.

### 6.7 `WorkflowStep` — `workflow_steps`

Fields:

- `id`, `workflowTemplateId`, `stepNumber`, `title`, `description?`, `defaultStaffId?`.
- `status` — Boolean, default true.
- `createdAt`, `updatedAt`.

Rules/relations:

- Unique (`workflowTemplateId`, `stepNumber`).
- Belongs to `WorkflowTemplate`.
- Optional `defaultStaff` → `Staff`, set null on delete.
- Has execution `tasks` and template `subTasks`.

### 6.8 `WorkflowSubTask` — `workflow_sub_tasks`

Fields:

- `id`, `workflowStepId`, `subTaskNumber`, `title`, `description?` (Text), `defaultStaffId?`.
- `status` — Boolean, default true.
- `createdAt`, `updatedAt`.

Rules/relations:

- Unique (`workflowStepId`, `subTaskNumber`).
- Belongs to a `WorkflowStep`, cascade delete.
- Optional default staff, set null on delete.
- Has actual `FileWorkflowSubTask` execution records.

### 6.9 `FileWorkflow` — `file_workflows`

Fields:

- `id`, `clientFileId`, `workflowTemplateId`, `assignedStaffId?`.
- `status` — `WorkflowStatus`, default `NOT_STARTED`.
- `baseAmount` — Decimal(12,2), default 0.
- `quantity` — integer, default 1.
- `discountAmount` — Decimal(12,2), default 0.
- `finalAmount` — Decimal(12,2), default 0.
- `startedAt?`, `completedAt?`, `createdAt`, `updatedAt`.

Relations:

- Belongs to `ClientFile` (cascade on file delete) and `WorkflowTemplate`.
- Optional responsible staff relation to `Staff`, set null on staff delete.
- Has `tasks`, `documents`, `payments`, `installments`.

Indexes: `clientFileId`, `workflowTemplateId`, `assignedStaffId`, `status`.

### 6.10 Document type and language master tables

#### `DocumentType` — `document_types`

- `id`, unique `name`, `description?`, `defaultAmount` Decimal(12,2) default 0, `status` Boolean default true, `createdAt`, `updatedAt`.
- Relations to language mappings, file documents and workflows that use this as their base document type.

#### `Language` — `languages`

- `id`, unique `name`, `status` Boolean default true, `createdAt`, `updatedAt`.
- Relations to document type mappings and file documents.

#### `DocumentTypeLanguage` — `document_type_languages`

- Composite primary key: (`documentTypeId`, `languageId`).
- `price` — Decimal(12,2).
- `createdAt`, `updatedAt`.
- Document type relation cascades on delete; language relation restricts delete.

The model provides an explicit price for each document type/language combination. The default document-type amount and the language-specific price must not be confused.

### 6.11 `FileWorkflowDocument` — `file_workflow_documents`

Fields:

- `id`, `fileWorkflowId`, `documentTypeId`.
- `languageId?`, `languageName?` — nullable for historical records created before language support.
- `documentName` — snapshot/display label.
- `baseAmount`, `discountAmount`, `finalAmount` — Decimal(12,2) price snapshots.
- `status` — `WorkflowStatus`, default `NOT_STARTED`.
- `sortOrder` — integer, default 0.
- `startedAt?`, `completedAt?`, `createdAt`, `updatedAt`.

Relations:

- Belongs to `FileWorkflow`, cascade on workflow delete.
- Belongs to `DocumentType`, restrict delete.
- Optional `Language`, set null on language delete.
- Has its own `WorkflowTask` records.

A document can therefore retain its own status, ordering, language snapshot, price snapshot and independently tracked task set.

### 6.12 `WorkflowTask` — `workflow_tasks`

Fields:

- `id`, `fileWorkflowId`, `workflowStepId`, `fileWorkflowDocumentId?`.
- `assignedStaffId?`.
- `status` — `TaskStatus`, default `PENDING`.
- `remarks?`, `startedAt?`, `completedAt?`, `createdAt`, `updatedAt`.

Relations:

- Belongs to a `FileWorkflow` (cascade delete).
- Belongs to a `WorkflowStep`.
- Optional `FileWorkflowDocument` (cascade delete when its document is deleted).
- Optional assigned staff (`SetNull` on staff deletion).
- Has `TaskHistory` and `FileWorkflowSubTask` children.

Indexes: `fileWorkflowId`, `workflowStepId`, `fileWorkflowDocumentId`, `assignedStaffId`, `status`.

### 6.13 `FileWorkflowSubTask` — `file_workflow_sub_tasks`

Fields:

- `id`, `workflowTaskId`, `workflowSubTaskId`, `assignedStaffId?`.
- `status` — `TaskStatus`, default `PENDING`.
- `remarks?`, `startedAt?`, `completedAt?`, `createdAt`, `updatedAt`.

Rules/relations:

- Unique (`workflowTaskId`, `workflowSubTaskId`).
- Belongs to `WorkflowTask`, cascade delete.
- Belongs to the template `WorkflowSubTask`, restrict delete.
- Optional actual assignee → `Staff`, set null on staff deletion.

This is the per-file execution record; `WorkflowSubTask` is the reusable template definition. Do not update a template subtask to represent one client's progress.

### 6.14 `TaskHistory` — `task_history`

Fields:

- `id`, `workflowTaskId`.
- `oldStatus?`, `newStatus` — `TaskStatus`.
- `remarks?`, `changedAt` default now.
- Belongs to `WorkflowTask`.
- Indexes on `workflowTaskId` and `changedAt`.

The November schema snapshot does not define a separate `FileWorkflowSubTaskHistory` model. The later `WorkflowActivityLog` model is a separate activity/reporting structure and should not be casually substituted for task history.

### 6.15 Financial models

#### `FileCharge` — `file_charges`

- `id`, `clientFileId`, `description`.
- `quantity` default 1.
- `unitAmount`, `totalAmount` — Decimal(12,2).
- `createdAt`, `updatedAt`.
- Belongs to `ClientFile`.

#### `Payment` — `payments`

- `id`, `clientFileId`.
- `amount` — Decimal(12,2).
- `paymentMethod` — `PaymentMethod`.
- `status` — `PaymentStatus`, default `CLEARED` in the 19 November snapshot.
- `referenceNo?`, `remarks?`.
- `paidAt` default now, `createdAt`, `updatedAt`.
- Belongs to `ClientFile`.
- Optional `fileWorkflowId` → `FileWorkflow`, set null on workflow deletion.
- Has installments, refunds and allocations.

#### `PaymentRefund` — `payment_refunds`

- `id`, `paymentId`.
- `amount` — Decimal(12,2).
- `reason` — Text, required.
- `refundedAt` default now, `createdAt` default now.
- Payment relation uses `onDelete: Restrict`.
- Indexes: `paymentId`, `refundedAt`.

#### `PaymentInstallment` — `payment_installments`

- `id`, `paymentId?`, `clientFileId`, `fileWorkflowId?`.
- `dueDate?`.
- `amount` — Decimal(12,2).
- `status` — `InstallmentStatus`, default `PENDING`.
- `remarks?`, `createdAt`, `updatedAt`.
- Optional relation to a `Payment`; required relation to `ClientFile`; optional relation to `FileWorkflow`.
- Has `PaymentAllocation` records.

#### `PaymentAllocation` — `payment_allocations`

- `id`, `paymentId`, `installmentId`.
- `amount` — Decimal(12,2).
- `createdAt`.
- Both parent relations cascade on delete.

This model records which portion of a payment is applied to which installment. A payment may need to be split across installments; payment amount and installment amount must not be duplicated into multiple paid totals.

#### `Expense` — `expenses`

- `id`, `expenseDate`, `category`, `description`.
- `amount` — Decimal(12,2).
- `paymentMethod` — `PaymentMethod`, default `CASH`.
- `referenceNo?`, `remarks?`.
- `createdByUserId`, `createdAt`, `updatedAt`.
- `createdBy` → `User`.
- Indexes on expense date, category, payment method and creator.

### 6.16 Calendar, third party and file numbering

#### `CalendarEvent` — `calendar_events`

- `id`, `title`, `description?`, `startAt`, `endAt?`, `clientFileId?`, `staffId?`.
- `status` — `CalendarEventStatus`, default `SCHEDULED`.
- `createdAt`, `updatedAt`.
- Optional `ClientFile` and `Staff` relations.

#### `ThirdParty` — `third_parties`

- `id`, `name`, `whatsapp?`, `status` Boolean default true, `createdAt`, `updatedAt`.
- Has client files.

#### `FileNumberSequence` — `file_number_sequences`

- `id` — primary key default 1 (not auto-increment).
- `nextNumber` default 1.
- `createdAt`, `updatedAt`.

The sequence row is a counter/coordination record. Do not reset it casually in a production database.

### 6.17 Audit and activity models

#### `AuditLog` — `audit_logs`

- `id`, `userId`, `module`, `action`.
- `entity?`, `entityId?`, `description`.
- `metadata?` as Text.
- `createdAt` default now.
- `user` relation → `User`, `onDelete: Restrict`.
- Indexes: `userId`, `module`, `action`, `entity`, `createdAt`.

#### `WorkflowActivityLog` — `workflow_activity_logs`

Fields in the 19 November schema snapshot:

- `id`.
- `clientFileId`, `fileWorkflowId`.
- Optional `workflowTaskId`, `fileWorkflowSubTaskId`, `fileWorkflowDocumentId`.
- `staffId?` — assigned staff attached to the step/subtask.
- `actorUserId?` — login account that recorded the event.
- `staffName?`, `actorUsername?` — snapshots.
- `activityType` — string with documented values `WORKFLOW_STEP` or `SUBTASK`.
- `action` — string with documented values `COMPLETED`, `REOPENED`, `RESET`.
- Snapshot values: `fileNumber`, `clientName`, `workflowName`, `stepNumber`, `stepTitle`, optional `subTaskNumber`, optional `subTaskTitle`.
- `remarks?`, `createdAt`.
- Indexes on date, staff/date, activity type/action/date, client file/date, task and subtask IDs.

The model intentionally stores identifying text snapshots so old reports remain understandable even when clients, files, workflows, steps, subtasks or staff are renamed or deactivated. The IDs in this model are scalar fields in the supplied schema; do not assume Prisma relations exist unless the current schema confirms them.

### 6.18 Enums confirmed in the 19 November schema snapshot

| Enum | Values |
|---|---|
| `FileCancellationSettlement` | `NO_PAYMENT`, `REFUND_PAID`, `NON_REFUNDABLE`, `TRANSFER_CREDIT` |
| `FileStatus` | `OPEN`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED` |
| `FileNumberType` | `SYSTEM`, `CUSTOM` |
| `WorkflowTrackingMode` | `STANDARD`, `DOCUMENT_BASED` |
| `WorkflowStatus` | `NOT_STARTED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED` |
| `TaskStatus` | `PENDING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED` |
| `PaymentMethod` | `CASH`, `CARD`, `BANK_TRANSFER`, `CHEQUE` |
| `PaymentStatus` | `PENDING`, `CLEARED`, `CANCELLED`, `REFUNDED`, `RETURNED`, `BOUNCED` |
| `InstallmentStatus` | `PENDING`, `PARTIALLY_PAID`, `PAID`, `CANCELLED` |
| `CalendarEventStatus` | `SCHEDULED`, `COMPLETED`, `CANCELLED` |

**Schema-version warning:** later conversation work included partial-refund behavior and explicit separation of workflow progress from payment status. The enum above is the 19 November snapshot and may not capture all later code/schema changes. Inspect the active schema and migration history before making any decision based on the exact current enum values.

---

## 7. Status and Lifecycle Rules

The system has several separate status dimensions. They must not be merged into one universal status field.

### 7.1 Client status

`Client.status` is a Boolean active/inactive flag. It is not a workflow or payment status.

### 7.2 File status

The schema snapshot defines:

- `OPEN`
- `IN_PROGRESS`
- `ON_HOLD`
- `COMPLETED`
- `CANCELLED`

The file status describes the overall service case. It should not be automatically changed merely because one payment is cleared or refunded.

### 7.3 Workflow status

The schema snapshot defines:

- `NOT_STARTED`
- `IN_PROGRESS`
- `ON_HOLD`
- `COMPLETED`
- `CANCELLED`

The workflow status describes work progress for one workflow instance or document. It is distinct from file status and financial status.

### 7.4 Task and subtask status

The schema snapshot defines:

- `PENDING`
- `ACTIVE`
- `ON_HOLD`
- `COMPLETED`
- `CANCELLED`

A workflow task is an execution instance of a template step. A file subtask is an execution instance of a template subtask. The parent-child relationship must remain visible in UI and reports.

### 7.5 Payment status

The 19 November Prisma snapshot defines:

- `PENDING`
- `CLEARED`
- `CANCELLED`
- `REFUNDED`
- `RETURNED`
- `BOUNCED`

This is the payment transaction state, not the service-work state.

### 7.6 Installment status

- `PENDING`
- `PARTIALLY_PAID`
- `PAID`
- `CANCELLED`

This describes the settlement of one installment amount. It is not the same as the parent payment's lifecycle.

### 7.7 Non-negotiable separation rule

A recent implementation request explicitly emphasized separating workflow progress from payment status. Keep these concepts independent:

- Workflow can be in progress even when payment has been fully received.
- Workflow can be completed while an unpaid balance remains, subject to customer policy.
- A payment can be refunded or returned without rewriting historical workflow progress.
- A cancelled file requires an explicit cancellation settlement decision; it must not be inferred solely from payment status.

Any customer request that changes these rules must be recorded as a deliberate business-rule change with examples and acceptance tests.

---

## 8. File Creation, Numbering and Cancellation

### 8.1 File numbering

- `fileNumber` is unique.
- `fileNumberType` distinguishes system-generated (`SYSTEM`) from manually supplied (`CUSTOM`) numbers.
- `FileNumberSequence` maintains the next number.
- Captured API routes included `/api/files/next-number`.

For any file-number generation change, preserve uniqueness under concurrent creation. Avoid generating numbers only in the browser. Confirm whether the current local implementation uses a database transaction/row lock when updating the sequence.

### 8.2 Cancellation fields

The November schema snapshot has:

- `cancelledAt`.
- `cancellationReason`.
- `cancellationSettlement`.
- `cancellationSettlementAmount`.
- `cancellationTransferTargetFileId`.

Settlement choices are:

- `NO_PAYMENT` — file has no amount to settle.
- `REFUND_PAID` — settlement indicates a refund was paid.
- `NON_REFUNDABLE` — paid amount is not refunded.
- `TRANSFER_CREDIT` — amount is transferred as credit to another file.

These labels are documented by enum values, but full accounting rules (which transaction is created, how the refund or transfer is linked, what limits apply and how reversals work) must be checked against the current cancellation controller and the customer's approved policy. Do not assume the enum alone implements complete refund or transfer accounting.

### 8.3 Restore and reopen behavior

The captured build output contained `/api/files/[id]/cancel`. A complete current restore endpoint was not confirmed in the captured route list. Check the current `app/api/files` tree before assuming there is a restore operation or endpoint.

---

## 9. Workflow Template and Execution Rules

### 9.1 Template hierarchy

```text
WorkflowTemplate
   |
   +-- WorkflowStep (stepNumber, title, description, defaultStaff)
          |
          +-- WorkflowSubTask (subTaskNumber, title, description, defaultStaff)
```

### 9.2 Client-file execution hierarchy — standard mode

```text
ClientFile
   |
   +-- FileWorkflow
          |
          +-- WorkflowTask (one execution record per template step)
                 |
                 +-- FileWorkflowSubTask (one execution record per template subtask)
```

### 9.3 Client-file execution hierarchy — document-based mode

```text
ClientFile
   |
   +-- FileWorkflow (trackingMode = DOCUMENT_BASED)
          |
          +-- FileWorkflowDocument A
          |      +-- WorkflowTask copies for document A
          |             +-- FileWorkflowSubTask children
          |
          +-- FileWorkflowDocument B
          |      +-- WorkflowTask copies for document B
          |             +-- FileWorkflowSubTask children
          |
          +-- FileWorkflowDocument C ...
```

Each document is expected to have independent progress and its own copy of the workflow steps/subtasks.

### 9.4 Assignment levels

The schema supports:

- Default staff on a workflow template.
- Default staff on a workflow step.
- Default staff on a template subtask.
- Responsible staff on a `FileWorkflow`.
- Assigned staff on an actual `WorkflowTask`.
- Assigned staff on an actual `FileWorkflowSubTask`.

Do not overwrite template defaults when changing an assignee on one client's file. The actual execution record is the correct place for a per-file assignment.

### 9.5 Completion history and timestamps

- `WorkflowTask` and `FileWorkflowSubTask` have `startedAt`, `completedAt`, `status`, remarks and timestamps.
- `TaskHistory` stores workflow-task status changes.
- `WorkflowActivityLog` separately captures activity types/actions needed by Work Activity reporting.
- A status transition to `COMPLETED` should set the completion timestamp; reopening/resetting should clear or otherwise correctly revise the active completion timestamp while preserving an event record in activity history.

The most recent code changes and task-specific transition semantics must be checked in the active controllers before modifying this behavior. Do not remove historical activity rows when clearing a current `completedAt` field.

### 9.6 Subtask nesting in reporting/UI

A recent Work Activity refinement required subtasks to appear directly underneath their parent workflow step in both the report page and the generated PDF. The display must show the actual subtask title, not only an ordinal or a generic label. Do not render the generic text “Subtask auto-completed when its workflow step was completed” as if it were a real subtask title or meaningful task activity.

---

## 10. Document Types, Languages and Document-Based Pricing

### 10.1 Master catalogs

- `DocumentType` defines the reusable document category (examples in the schema comments include Birth Certificate, Marriage Certificate, Degree Certificate and Passport).
- `Language` defines reusable languages.
- `DocumentTypeLanguage` maps each document type to an available language and its configured price.

### 10.2 Document instance

`FileWorkflowDocument` is the document selected for a particular client's workflow. It stores:

- Document type ID.
- Optional language ID and language-name snapshot.
- Document-name snapshot.
- Price snapshot fields (`baseAmount`, `discountAmount`, `finalAmount`).
- Status and sort order.
- Its own task collection.

### 10.3 Pricing behavior

The November schema comments describe:

- `DocumentType.defaultAmount` as a master/default price.
- `DocumentTypeLanguage.price` as a specific language price.
- For document-based workflows, document/language pricing is used instead of the standard workflow template base amount.
- The selected amount is copied into the file document as a snapshot.
- The overall file/workflow discount is stored at the `FileWorkflow` level in the supplied schema comments/fields.

Before changing document-based pricing, test at minimum:

1. One document with one language.
2. Multiple documents under one client file.
3. Different language prices for the same document type.
4. A master price change after a client file already exists.
5. A workflow-level discount.
6. A newly added document after a previous document was completed.

### 10.4 Historical compatibility

The nullable `languageId` and `languageName` fields are explicitly present to allow records created before language support to remain readable. Do not make these required without a migration/backfill and historical-data plan.

---

## 11. Payments, Collections and Financial Rules

### 11.1 Main financial records

The model structure separates:

- Workflow/service pricing (`WorkflowTemplate`, `FileWorkflow`, `DocumentType`, `DocumentTypeLanguage`, `FileWorkflowDocument`).
- Additional charges (`FileCharge`).
- Payment transactions (`Payment`).
- Refund transactions (`PaymentRefund`).
- Installment schedule rows (`PaymentInstallment`).
- Payment-to-installment allocation (`PaymentAllocation`).
- Expenses (`Expense`).

### 11.2 Payment methods in the schema snapshot

- `CASH`
- `CARD`
- `BANK_TRANSFER`
- `CHEQUE`

### 11.3 Payment transaction versus installment

A payment is an amount received/recorded for a client file. An installment is an amount expected to be settled against a client file or workflow. `PaymentAllocation` links the amount from a payment to an installment.

Never add both the full payment amount and the same allocation amounts into a financial total. The allocation is a distribution of the payment, not a second payment.

### 11.4 Recent partial-refund change

Later project conversations (after the 19 November schema snapshot) confirmed that partial-refund functionality was among the recent changes made to the Client Workflow System.

What is confirmed at this handover level:

- Refunds are represented by `PaymentRefund` records in the schema snapshot.
- Each refund belongs to a payment and has an amount, reason and refund timestamp.
- Partial-refund behavior was discussed as a recent implementation change.

What still needs exact source verification:

- Whether multiple partial refunds are allowed against one payment.
- The guard preventing the cumulative refund from exceeding the refundable amount.
- How payment status is recalculated after a partial versus full refund.
- Whether refund amounts are included in total paid, net collections, outstanding balance and finance chart values.
- Whether the refund updates installments/allocations or only the payment ledger.
- Whether refund records can be edited/deleted, or only reversed by a compensating transaction.
- Whether a separate `PARTIALLY_REFUNDED` state or computed refund state was added after the schema snapshot.

Do not infer these details from the presence of the `PaymentRefund` table. Inspect the latest refund API, server actions and current Prisma schema before patching financial calculations.

### 11.5 Separate workflow state from payment state

A recent user-requested change explicitly separates workflow status from payment status. This must remain a mandatory product rule. Financial state must not be used as a hidden proxy for work state, and work completion must not overwrite the payment transaction status.

### 11.6 Payments dashboard

The captured Payments page included:

- Date-range filters and named date-range presets.
- Status and search filters.
- Summary cards for Total Billed, Total Paid, Total Due and Total Clients.
- A monthly payment growth chart based on cleared payments received during the current year.
- Client summary rows ordered by outstanding due and client name.
- LKR formatting helpers in the captured UI (`formatLkr`).

The captured summary descriptions distinguished:

- Total Billed: files opened in the selected range.
- Total Paid: cleared payments received in the selected range.
- Total Due: current outstanding on selected files.
- Total Clients: clients with files in the selected range.

A September 2026 snapshot is not proof of the exact November behavior. Later finance-page pagination and filtering changes were reported complete. Re-check the live page/API for its current formulas and status options before making financial changes.

### 11.7 Payment/finance calculations — required safety checks

For any payment, refund or report modification, verify and write explicit formulas for:

- Gross billed amount.
- Discounts and waivers, if supported in current source.
- Net amount payable.
- Payments received/cleared in period.
- Refunds paid in period.
- Net cash/collection figure.
- Outstanding balance as of now.
- Installment remaining amount.
- Amount transferred as credit, if cancellation transfer is used.

The exact customer-approved accounting definitions must be followed. Do not silently change whether a report is cash-basis, billed-file-date-basis or current-outstanding-balance-basis.

---

## 12. Work Activity and Staff Work Reporting

### 12.1 Two different reporting areas

The project records include an older `/staff-work` page and `/api/reports/staff-work` endpoint, and a later `/reports/work-activity` report backed by `WorkflowActivityLog`.

Do not merge these routes or treat them as interchangeable without checking their source. The older staff-work endpoint was captured before the newer activity-log reporting feature.

### 12.2 Work Activity page and report

Known page route:

```text
/reports/work-activity
```

Known API route/source path:

```text
app/api/reports/work-activity/route.ts
```

Known page source path:

```text
app/reports/work-activity/page.tsx
```

The report work requested/implemented includes:

- Custom `from` and `to` date range.
- Staff selector supporting all staff or one selected staff member.
- A report of workflow-step and subtask activity.
- PDF export.
- A company-branded PDF header with logo at the left and company/report text beside it.
- Subtasks displayed beneath their parent main workflow step in the page and PDF.
- Actual subtask title displayed, rather than a generic “Subtask 1” label alone.
- Removal of the misleading generic auto-completion text mentioned in Section 9.6.

### 12.3 Activity record semantics

`WorkflowActivityLog` records:

- `activityType`: `WORKFLOW_STEP` or `SUBTASK`.
- `action`: `COMPLETED`, `REOPENED` or `RESET`.
- A timestamp (`createdAt`).
- The assigned staff ID/name separately from the login user ID/username that performed the action.
- Snapshot labels for file number, client name, workflow name, step number/title and optional subtask number/title.

This allows historic activity to be queried by the date the action was recorded and still rendered with readable names after master records are renamed.

### 12.4 PDF layout decisions

The PDF header refinement places a company logo in a white tile at the top-left. Text beside it identifies A&I Global and the report title, with date range and staff selection displayed in the header. The report uses PDFKit and an A4 page format in the captured patch code.

The selected logo file must be a supported raster image (PNG/JPG/JPEG) for the PDFKit code path in the stored installer script. The current actual logo path must be checked in the active `public/` directory.

### 12.5 Date input warning and page validation

A console warning was encountered for a controlled input with a `value` prop but no `onChange`. The user applied a patch changing date input props to use `defaultValue` for the report's `from` and `to` inputs. Do not revert this change blindly. Re-check the current component state model if date controls are later made interactive.

### 12.6 Latest Work Activity validation evidence

Reported outcomes from the recent project continuation:

- The user applied the Work Activity patches.
- The app returned `GET /staff-work 200` and `GET /reports/work-activity 200` in the observed local test.
- The logo, hierarchy and actual-subtask-title refinements were installed through PowerShell scripts/patches.
- The user confirmed lint and build succeeded after the subtask-detail changes.

Not yet established by the available handover evidence:

- Full validation of every report filter against a large production dataset.
- PDF visual inspection across page breaks, long names and many subtasks.
- Exact boundary-date/time tests around Colombo midnight.
- Whether all activity actions and both selected-staff/all-staff scopes have been verified with real records.

---

## 13. Audit and Data History

### 13.1 Generic audit log

`AuditLog` stores the acting `User`, module, action, optional entity and entity ID, description, optional text metadata and timestamp.

### 13.2 Workflow activity log

`WorkflowActivityLog` has a specialized purpose: date-driven reporting of step/subtask completion, reopening and resets. It stores staff and actor information separately and preserves text snapshots.

### 13.3 Do not mix audit purposes

- `AuditLog` is the general application audit trail.
- `TaskHistory` is a workflow-task status transition history structure.
- `WorkflowActivityLog` is a specialized activity/reporting record for staff work activity.

A feature requiring a business audit event should not rely solely on the current visible status field. A feature requiring a staff completion report should use the correct activity rows, not attempt to reconstruct every historic completion from a status that may later have been reset.

### 13.4 Audit coverage to preserve

At minimum, verify audit coverage for:

- Login/logout and security-relevant account activity.
- Client create/update/deactivate.
- File create/update/cancel/restore/settlement.
- Workflow-template, step and subtask changes.
- File workflow progress, step/subtask complete/reopen/reset and staff reassignment.
- Document type/language/pricing changes.
- Payment creation/status changes, refunds, installment adjustments and allocations.
- Expense changes.
- Calendar event changes.
- Settings and backup operations.

This is a coverage checklist. The schema having an `AuditLog` table does not prove that every action is currently writing an audit record.

---

## 14. Authentication, Session and Authorization

### 14.1 Login routes and session evidence

Captured API routes:

- `POST /api/auth/login`
- `POST /api/auth/logout`

The newer Work Activity route reads the `session_user` cookie, parses it as a positive integer user ID and returns `401 Unauthorized` when the cookie is missing or invalid. This is direct evidence that at least that API route is session-protected.

### 14.2 Password handling

The captured package contains `bcryptjs`. The `User` model stores `passwordHash`; plaintext passwords must never be stored. Never commit `.env`, live database credentials, session secrets or password material.

### 14.3 Authorization evidence gap

The supplied Prisma schema snapshot has no `Role`, `Permission`, `UserRole` or permission-mapping models. Therefore, this document does not assert that configurable RBAC exists. If staff-level or module-level permissions are required by the customer, first inspect the current UI and route handlers, then design the data model and enforcement consistently.

### 14.4 Security rules for continued development

- Protect each private page and every mutating/read API route server-side.
- Never rely only on hiding a button in React.
- Validate session identity in server code.
- Validate ownership/relationships before any mutation using an ID from request input.
- Use Prisma parameterized queries and safe update patterns.
- Preserve audit history for sensitive mutations.
- Do not include secrets in logs, report PDFs or client-visible error messages.

---

## 15. API Route Inventory

The following list is based on a September 2026 build output, with later Work Activity and recent implementation updates added from the project conversation. It is a useful route map, not a guarantee that every route still has the same method, request body or access control today.

### 15.1 Authentication

| Method | Path | Known purpose |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout/session clear |

### 15.2 Clients

| Path | Known purpose |
|---|---|
| `/api/clients` | Client collection/list/create operations |
| `/api/clients/[id]` | Client-specific operations |

Exact HTTP methods and current validation must be checked in the active route files.

### 15.3 Files

Captured routes:

| Path | Known purpose |
|---|---|
| `/api/files` | Client-file collection operations |
| `/api/files/next-number` | Next file-number lookup/generation support |
| `/api/files/[id]/cancel` | File cancellation |
| `/api/files/[id]/charges` | File-level charge operations |
| `/api/files/[id]/installments` | Installment operations |
| `/api/files/[id]/payments` | Payment operations |

Later payment/refund work may have introduced nested or additional routes not present in this old build log. Inspect `app/api/files/` for the current refund/payment endpoints rather than inventing route names.

### 15.4 Workflow templates and steps

Captured routes:

| Path | Known purpose |
|---|---|
| `/api/workflows` | Workflow template collection |
| `/api/workflows/[id]` | Workflow template detail/update/delete actions |
| `/api/workflows/[id]/steps` | Step collection for a template |
| `/api/workflows/[id]/steps/[stepId]` | Specific step operations |
| `/api/workflows/steps/[stepId]` | Step-specific operations |
| `/api/workflows/steps/[stepId]/subtasks` | Subtask collection for a step |
| `/api/workflows/steps/reorder` | Step ordering |
| `/api/workflows/subtasks/[subTaskId]` | Subtask-specific operations |
| `/api/workflows/subtasks/reorder` | Subtask ordering |

### 15.5 File workflow execution

Captured routes:

| Path | Known purpose |
|---|---|
| `/api/files/tasks/[taskId]` | Workflow-task detail/status operations |
| `/api/files/tasks/[taskId]/staff` | Assign/unassign staff to a workflow task |
| `/api/files/subtasks/[subTaskId]/staff` | Assign/unassign staff to a file subtask |
| `/api/files/subtasks/[subTaskId]/status` | Change file-subtask status |

The current task-status route may include additional action behavior. Inspect the actual route before applying changes to status handling.

### 15.6 Staff, third parties, documents, expenses and calendar

| Path | Known purpose |
|---|---|
| `/api/staff` | Staff collection |
| `/api/staff/[id]` | Staff-specific operations |
| `/api/third-parties` | Third-party collection |
| `/api/third-parties/[id]` | Third-party-specific operations |
| `/api/document-types` | Document-type collection |
| `/api/document-types/[id]` | Document-type-specific operations |
| `/api/expenses` | Expense collection |
| `/api/expenses/[id]` | Expense-specific operations |
| `/api/calendar` | Calendar event collection |
| `/api/calendar/[id]` | Calendar-event-specific operations |

### 15.7 Reports, audit and settings

| Path | Known purpose |
|---|---|
| `/api/reports/staff-work` | Earlier staff work report data/PDF route |
| `/api/reports/work-activity` | Newer date-range Work Activity report API |
| `/api/settings/backup` | Database/application backup support |
| `/api/settings/change-password` | Password change |
| `/api/test-db` | Database test/diagnostic route |

The current Audit Logs page `/audit-logs` exists. Its exact API path was not fully established by the September build route excerpt and should be verified from the current source.

---

## 16. UI, Pagination and Interaction Improvements Reported Later

Later project continuation updates (November 2026) reported the following modifications:

- Files page pagination improvements.
- Date fields/filters improvements on relevant pages.
- Audit Logs pagination improvements.
- Finance/Payments page pagination improvements.
- Document Types page pagination and filtering work.
- Work Activity date-range/staff filters and PDF output.
- PDF logo placement and text/header alignment.
- Work Activity subtasks nested beneath the matching parent step.
- Work Activity report now displays actual subtask titles rather than generic labels.
- Misleading generic auto-completion explanatory text removed from the report display.

The exact page/component filenames for every pagination change were not included in the latest handover context. Search the active `app/` directory for page components and shared pagination controls before creating new components or duplicating existing behavior.

---

## 17. Electron Desktop Packaging and Installer

### 17.1 Captured package identity

The later captured `package-final.json` contained:

| Setting | Value |
|---|---|
| `name` | `client-workflow-system` |
| `version` | `1.0.0` in that package snapshot |
| `main` | `electron/main.cjs` |
| `appId` | `com.aiglobal.clientworkflow` |
| `productName` | `A&I Global Workflow System` |
| `executableName` | `AIGlobalWorkflowSystem` |
| Output directory | `release` |
| Windows target | NSIS, x64 |
| Installer artifact name | `A&I Global Workflow System Setup ${version}.${ext}` |
| Author | `A&I Global` |
| Description | `Client Workflow Management System` |

The earlier 27 September build log used version `0.1.0`. A later package snapshot used version `1.0.0`; always read the current `package.json` to determine the real installer filename/version.

### 17.2 NSIS options in the package snapshot

- `oneClick: false` — interactive installer.
- `allowToChangeInstallationDirectory: true`.
- Desktop shortcut enabled.
- Start Menu shortcut enabled.
- Shortcut name: `A&I Global Workflow System`.
- `deleteAppDataOnUninstall: false` — do not automatically delete app data on uninstall.

### 17.3 Resources included by captured config

- `electron/**/*`.
- `package.json`.
- `desktop-runtime` copied to `resources/next`.
- Electron logo/icon copied to resources and used for the Windows installer.

No MySQL server is listed as an included resource.

### 17.4 Build procedure

From the project root in PowerShell:

```powershell
npm install
npx prisma generate
npm run lint
npm run build
npm run desktop:dist
```

Run only the commands needed based on changed files and dependencies, but for a customer release, a clean dependency install, Prisma generation, lint, production build and full desktop distribution build are recommended.

### 17.5 Expected output

```text
release\A&I Global Workflow System Setup <current-package-version>.exe
```

Also inspect:

```text
release\win-unpacked\AIGlobalWorkflowSystem.exe
```

Do not report a successful installer until `npm run desktop:dist` exits successfully and the generated installer is actually tested.

### 17.6 Historical packaging problems

An earlier 27 September desktop build compiled and generated the installer, but launching the unpacked executable failed because the packaged Next.js runtime could not resolve the `next` module (`MODULE_NOT_FOUND`). The log showed repeated server readiness failures against `127.0.0.1:3000`. A later package configuration introduced a `desktop-runtime` resource copied into `resources/next`; this is a later packaging approach and should be preserved unless current source review proves a safer replacement.

A separate later user-reported issue occurred in an installed executable: text fields inside tabs could not be clicked/typed, while the login page worked. The user later reported that the app at the office was working after pulling the project there. Treat the reported office success as positive evidence, but test the final installer again after all customer modifications. Do not assume an earlier installer test covers later UI changes.

### 17.7 Release smoke test

On a clean target computer or clean Windows user profile:

1. Install the generated NSIS installer.
2. Launch from Start Menu and desktop shortcut.
3. Confirm the local Next.js server starts and the window loads.
4. Confirm the database is reachable.
5. Sign in and sign out.
6. Navigate across every main module.
7. Click/type into controls inside tabs, dialogs, filters and forms.
8. Create or edit a safe test record.
9. Test payments and report PDF generation using test data.
10. Close and reopen the app; confirm persisted data remains.
11. Confirm there is no stale process/port conflict after closing the window.
12. Record installer filename, version, build date and test machine.

---

## 18. Environment Variables, Configuration and Secrets

The application has an `.env` file in the project build context. The exact current variable names and values were not captured in the handover source. Inspect `.env.example`, `prisma.config.ts`, current Prisma client setup and the runtime database connection code before changing database configuration.

Security rules:

- Never paste database passwords, auth secrets, encryption keys or production connection strings into ChatGPT or this master document.
- Never commit `.env`.
- Keep a safe `.env.example` with placeholder values only.
- Ensure the Electron packaged runtime can access the required environment configuration securely.
- Do not assume a development `.env` file is automatically copied into the desktop installer or safely provisioned on a customer PC.
- If the customer uses a remote MySQL host, enforce network restrictions, strong credentials, backups and encrypted connections as appropriate.

---

## 19. Backup, Data Reset and Database Maintenance

### 19.1 Backup capability

A captured API route exists at `/api/settings/backup`. The exact current backup format, destination, schedule and restore procedure were not fully inspected in the available handover material. Verify that a backup is restorable, not merely that a backup file is created.

### 19.2 November 2026 data reset request

The user requested clearing operational/test data while keeping master data. The agreed keep-list from the schema context was:

- `users`
- `staff`
- `third_parties`
- `workflow_templates`
- `workflow_steps`
- `workflow_sub_tasks`
- `document_types`
- `languages`
- `document_type_languages`

The operational data intended for deletion/reset was:

- `clients`
- `client_files`
- `file_workflows`
- `file_workflow_documents`
- `workflow_tasks`
- `file_workflow_sub_tasks`
- `task_history`
- `workflow_activity_logs`
- `payment_allocations`
- `payment_refunds`
- `payment_installments`
- `payments`
- `file_charges`
- `expenses`
- `calendar_events`
- `audit_logs`
- `file_number_sequences` (then re-seed with `id = 1`, `nextNumber = 1`)

This is a record of the requested reset plan, not proof that the data was successfully deleted.

### 19.3 Safe update mode error

The SQL execution encountered MySQL error **1175** because safe update mode blocked a `DELETE` without a key-column `WHERE` clause. The suggested session-level workaround was:

```sql
SET SQL_SAFE_UPDATES = 0;
```

Then rerun the reviewed cleanup SQL in the same MySQL Workbench session and restore safe update mode afterward:

```sql
SET SQL_SAFE_UPDATES = 1;
SET FOREIGN_KEY_CHECKS = 1;
```

The user had not yet confirmed in the available conversation context that the full cleanup completed successfully. Query row counts and the sequence table before assuming the database is clean.

### 19.4 Dangerous-operation safeguards

- Take a verified backup first.
- Confirm the selected database name before running deletes.
- Confirm the keep-list against the current local Prisma schema.
- Disable foreign-key checks only in a controlled session and ensure every dependent operational table is deliberately handled.
- Restore `FOREIGN_KEY_CHECKS` and `SQL_SAFE_UPDATES` even when a script fails.
- Verify that master records remain intact.
- Do not run a reset script against a production/customer database unless explicitly authorized and backed up.

---

## 20. Errors, Fixes and Development History

### 20.1 Electron package could not locate `next`

**Observed:** the 27 September packaged executable failed with `Cannot find module 'next'` from `resources/next/server.js`; the server never opened port 3000.  
**Later direction:** package preparation creates a standalone runtime and places the prepared desktop runtime in the Electron resources as `resources/next`.  
**Current action:** preserve and validate the current `desktop:prepare`/`prepare-desktop.cjs` approach. Do not revert to copying only the Electron shell and package manifest.

### 20.2 Installed tab text fields were not interactive

**Observed:** user reported text inputs inside tabs could not be focused/typed in one installed EXE, while login worked. Later the user reported the office version was working.  
**Current action:** include tab/dialog input interaction in the final installer smoke test after every release.

### 20.3 Date input controlled/uncontrolled warning

**Observed:** console warning for a date input with a controlled `value` and no `onChange`.  
**Applied fix:** use `defaultValue` for the static/current report date inputs as appropriate.  
**Current action:** keep the fix unless the component is refactored into fully controlled state with a valid `onChange` callback.

### 20.4 Work Activity subtasks displayed generically

**Observed/requested:** report showed a generic subtask auto-completion statement and did not display the actual subtask title adequately.  
**Applied refinement:** render the real subtask title and place subtasks under the matching parent workflow step in the UI and PDF.  
**Validation:** user reported lint and build succeeded after the patch.  
**Current action:** inspect PDF rendering with long subtask labels and multi-page records.

### 20.5 MySQL safe update mode blocked cleanup

**Observed:** MySQL error 1175 on a DELETE statement.  
**Suggested workaround:** set `SQL_SAFE_UPDATES` off for the cleanup session, rerun the complete reviewed script, then restore it.  
**Validation:** cleanup completion has not been confirmed in the available record.

### 20.6 TypeScript, lint and pagination work

The user reported that several lint and TypeScript errors were resolved during the November page/report work. The exact full issue list and commits are not available in this handover. Run the current lint and build rather than relying on older results.

---

## 21. Source Paths and Files to Inspect First

These paths are known from the project structure, package snapshot and later work. Confirm actual existence and current contents in the live project before editing.

### 21.1 Project root/configuration

```text
package.json
next.config.ts
prisma/schema.prisma
prisma.config.ts             # verify whether present
.env                         # local secret file; never share/commit
scripts/prepare-desktop.cjs
electron/main.cjs
electron/ai-global-logo.ico
```

### 21.2 UI route folders

```text
app/login/
app/dashboard/
app/clients/
app/files/
app/workflows/
app/staff/
app/staff-work/
app/reports/work-activity/
app/payments/
app/calendar/
app/third-parties/
app/settings/
app/settings/document-types/
app/audit-logs/
```

### 21.3 API folders

```text
app/api/auth/
app/api/clients/
app/api/files/
app/api/workflows/
app/api/staff/
app/api/third-parties/
app/api/document-types/
app/api/expenses/
app/api/calendar/
app/api/reports/
app/api/settings/
```

### 21.4 Work Activity files

```text
app/reports/work-activity/page.tsx
app/api/reports/work-activity/route.ts
```

Other related files may include shared navigation, report filter components, PDF logo assets under `public/` and the Prisma migration creating `workflow_activity_logs`. Search the working tree before assuming exact shared-component filenames.

---

## 22. Git and Release Handling

### 22.1 Repository information

- Local project: `client-workflow-system`.
- Branch noted in current project context: `main`.
- Remote is referred to as `origin` in prior Git instructions.
- Verified GitHub repository: `https://github.com/arafath65/client-workflow-system` (public repository, default branch `main`; verified 26 November 2026).
- Do not invent the remote URL or assume all latest local changes have been pushed.

### 22.2 Inspect before commit

From PowerShell in the project root:

```powershell
git status --short
git branch --show-current
git remote -v
git diff --check
git diff --stat
```

Review the actual diff before staging. Be careful not to commit `.env`, generated installer output, database dumps, local backups or customer data unless intentionally required.

### 22.3 Safe release sequence

```powershell
npm run lint
npx prisma generate
npm run build
npm run desktop:dist
```

Then test the EXE/installer. Commit and push should be separate intentional actions after reviewing the diff and customer approval. Do not run `git reset --hard`, force-push, overwrite the user's work or automatically stage every file without checking status.

### 22.4 Current release status

The user discussed GitHub release and desktop installer generation. The most recent confirmed project context did not establish a commit hash or prove that the final Work Activity refinements were pushed after the build. Verify `git status`, recent commit history and `origin` before saying the current version is on GitHub.

---

## 23. Current Development Status — 22 November 2026

### 23.1 Implemented or reported present

| Area | Recorded status | Evidence / qualification |
|---|---|---|
| Next.js/React application | Present | Project build output and page/API route history |
| Prisma + MySQL data layer | Present | Prisma schema snapshots and migrations |
| Login/logout | Present | `/api/auth/login`, `/api/auth/logout`; session cookie used by report API |
| Clients and client files | Present | Pages, models and API routes in build output |
| Workflow templates, steps, subtasks | Present | Prisma models and workflow API routes |
| Standard/document-based workflow tracking | Present in 19 Nov schema snapshot | `WorkflowTrackingMode` and file document model |
| Document types/languages/pricing | Present | Models, pages and API route records |
| Staff assignment | Present | Staff master and execution-assignee fields/routes |
| File charges/payments/installments/refunds | Schema foundation present | 19 Nov schema; later partial-refund code reported, exact current implementation needs source reconciliation |
| Finance/Payments dashboard | Present | Captured page and later pagination/filter updates reported |
| Expenses | Present | Prisma model and API route records |
| Calendar | Present | Prisma model and API route records |
| Audit Logs | Present | Prisma model/page and later pagination update reported |
| Work Activity activity-log model | Present in 19 Nov schema snapshot | `WorkflowActivityLog` and intended migration |
| Work Activity report UI/PDF | Installed and validated at build level | User reported routes loaded and lint/build succeeded after hierarchy/title patches |
| Electron Windows packaging | Present | Package configuration and previous build/install attempts |

### 23.2 Latest explicit Work Activity check

- `GET /staff-work 200` was observed.
- `GET /reports/work-activity 200` was observed.
- The user confirmed lint and build succeeded after the Work Activity subtask-title/hierarchy patch.
- Full final-EXE acceptance after all changes still needs to be performed.

### 23.3 Payment and finance qualifications

- Recent changes include partial-refund work and separation of payment status from workflow status.
- Exact final refund formulas, migration version and UI behavior were not fully contained in the November 19 schema snapshot.
- Inspect the latest local source and database migration status before changing financial logic.

### 23.4 Database cleanup qualification

- Operational-data cleanup was requested.
- The first attempt hit MySQL safe update error 1175.
- The user was given the session-level safe-update workaround.
- Successful completion is not confirmed in the current record.

### 23.5 Customer modifications

The customer has now indicated that additional modifications are requested. The actual change requests have **not yet been supplied in this handover context**. Do not invent or start implementation based on assumptions. Record every received change in Section 25, then update the affected business rules, schema, screens, APIs, reports, migration plan and tests.

---

## 24. Highest-Priority Verification Before the Next Customer Change

Before changing the system, establish the current truth from the working copy:

1. Confirm project path, current branch, `git status --short` and latest commit.
2. Inspect current `package.json`, `prisma/schema.prisma`, `prisma.config.ts`, `.env` variable names (not values), and Prisma migration folders.
3. Reconcile the active schema with the 19 November snapshot in Section 6, especially PaymentStatus, refunds, cancellation and WorkflowActivityLog.
4. Inspect the current finance/payment API routes and verify the partial-refund calculations and transaction rules.
5. Inspect the active Work Activity page/API and confirm it queries `workflow_activity_logs` with the intended Colombo date boundaries.
6. Confirm the cleanup SQL result by checking row counts and the `file_number_sequences` record; do not rerun destructive SQL without backup and database confirmation.
7. Run current lint/build before customer modifications to establish a baseline.
8. Verify the final Electron runtime packaging path and run the desktop installer smoke test after the next release build.

### Recommended PowerShell baseline commands

```powershell
Set-Location 'C:\Users\Pradeep\Downloads\client-workflow-system'

Write-Host '--- PROJECT ---'
Get-Location

Write-Host '--- GIT BRANCH / STATUS ---'
git branch --show-current
git status --short

git log -5 --oneline

Write-Host '--- NODE / NPM ---'
node -v
npm -v

Write-Host '--- PACKAGE SCRIPTS / VERSIONS ---'
Get-Content .\package.json

Write-Host '--- PRISMA MIGRATIONS ---'
Get-ChildItem .\prisma\migrations -Directory | Select-Object Name

Write-Host '--- BASELINE VALIDATION ---'
npm run lint
npx prisma generate
npm run build
```

Do not paste `.env` contents into chat. If a file needs review, upload that exact current file or provide a targeted PowerShell output that excludes secrets.

---

## 25. Customer Change Request Register

This register is the permanent log for all new customer requests. Add a new numbered entry for each change. Do not overwrite old decisions; mark them superseded and link to the new request.

### CR-000 — Initial register state

- **Date recorded:** 22 November 2026.
- **Request source:** Customer has advised that modifications are coming.
- **Actual change description:** Not yet supplied.
- **Affected modules:** Pending.
- **Business rules affected:** Pending.
- **Database/schema impact:** Pending.
- **API impact:** Pending.
- **UI/report impact:** Pending.
- **Migration/backfill impact:** Pending.
- **Acceptance criteria:** Pending.
- **Implementation status:** Not started; awaiting the customer's specific requirements.

### New change entry template

```markdown
### CR-XXX — [Short change title]

- **Date requested:** YYYY-MM-DD
- **Requested by:** Customer / named role (do not invent a person's name)
- **Original wording:**
- **Business problem / reason:**
- **Current behavior:**
- **Required behavior:**
- **Affected modules/pages:**
- **Affected API routes/services:**
- **Affected database models/tables/columns:**
- **Migration/backfill/data-retention plan:**
- **Permissions/security impact:**
- **Financial/reporting impact:**
- **Edge cases:**
- **Acceptance criteria:**
- **Implementation files changed:**
- **Backup/migration name:**
- **Validation performed:**
- **Runtime/customer test result:**
- **Git commit / release version:**
- **Status:** Proposed / Clarified / Approved / In Progress / Implemented / Tested / Released / Superseded
```

---

## 26. Development Protocol for Future Work

1. **Read this master first.** Use it to understand the business rules and history, but do not treat a historical snapshot as newer than the live source.
2. **Inspect current files before patching.** Request or read the exact current file when the source is not available in the conversation. Do not replace newer work with an older Library snapshot or stale generated patch.
3. **Clarify only real business ambiguity.** Preserve all existing agreed rules; ask one focused question only where the missing answer would change data design, money handling, permissions or user-visible behavior.
4. **Plan the change across layers.** Identify database, Prisma migration, API, UI, report/PDF, audit, validation, desktop packaging and data migration impacts.
5. **Back up first.** For schema changes, record the migration and understand rollback/data compatibility. For code patches, create timestamped backups where appropriate.
6. **Keep history.** Do not erase audit, payment, refund or workflow activity history as a shortcut to changing current status.
7. **Preserve existing data.** Price snapshots, file numbers, payment allocations, refunds, historic activity and document/language snapshots must be considered.
8. **Validate.** Run formatting/lint, Prisma validation/generation, production build, targeted API/database tests and UI acceptance steps.
9. **Test Electron separately.** A browser build passing does not prove a packaged Windows installer works.
10. **Record exact evidence.** Include commands, outputs, file paths, migration names, known limitations, user/customer test result and release commit in the next dated checkpoint.
11. **Do not push without intent.** Inspect Git changes and ask/act according to the user's explicit release instruction. Never overwrite the user's uncommitted work.
12. **Update this master after each milestone.** Add a dated checkpoint and update the current status table; keep historical checkpoints rather than deleting them.

---

## 27. Exact Instructions for Continuing in a New ChatGPT Conversation

Start the next technical conversation by uploading this master file and saying:

> “This is the authoritative handover for the A&I Global Client Workflow System. Read it fully before suggesting changes. The customer has new modifications; I will provide them next. Preserve all current business rules and verify the live source before editing. Update the master file after completing each approved change.”

Then provide the customer's exact change request. If implementation depends on the current local code, upload the relevant current files or provide the PowerShell output requested by the assistant. Do not make the assistant rely on an older schema or installer snapshot when a newer local version exists.

---

## 28. Chronological Project Checkpoints

This section is append-only. Later checkpoints supersede earlier status statements, but the earlier records remain useful for understanding why the system is structured as it is.

### 28.1 September 2026 — Application and initial desktop packaging

- A Next.js 16.3.5 application with Prisma/MySQL and Electron packaging was being built.
- The captured `desktop:dist` build compiled Next.js and generated a Windows NSIS installer.
- The first captured installed/unpacked executable failed to start its Next server because it could not find module `next` in the packaged runtime.
- Later `package-final.json` included a `desktop-runtime` resource, a preparation script and application metadata; this represents a later packaging direction.
- The September build output listed the main UI pages and API routes in Sections 4 and 15.

### 28.2 September–October 2026 — Finance and reporting foundations

- The Prisma model family included clients, files, workflow templates/steps/subtasks, payments, installments, payment allocations, refunds, expenses, calendar events and audit logs.
- Finance dashboard work used date filters, summary cards, LKR formatting and a monthly cleared-payment chart in a captured page snapshot.
- Work Activity report scripts were prepared/installed around 29 October, with a Prisma migration named `add_workflow_activity_logs`.
- The Work Activity feature was built around `WorkflowActivityLog` so activity could be reported by date and staff with snapshot names.

### 28.3 19 November 2026 — Prisma schema snapshot

- A full 819-line Prisma schema snapshot was shared.
- It included standard/document-based workflow tracking, workflow document records, language-aware document pricing, file cancellation settlement fields, refunds/installments/payment allocation, generic audit logs and `WorkflowActivityLog`.
- This is the schema baseline documented in Section 6, not a guarantee of the final schema after later changes.

### 28.4 20–22 November 2026 — Recent workflow system continuation

- Recent work included payment/refund behavior, including partial-refund changes.
- Workflow status was explicitly separated from payment status.
- Files page pagination and date fields were refined.
- Audit Logs pagination was refined.
- Finance/Payments page pagination was refined.
- Work Activity report refinements included company logo positioning, subtasks nested beneath the correct parent workflow step, display of actual subtask titles and removal of misleading generic completion text.
- A controlled date-input warning was addressed by using default-value behavior for the relevant report inputs.
- The user reported the relevant Work Activity routes returned HTTP 200 and confirmed lint/build succeeded after the subtask-detail patch.
- GitHub push/commit status for every final patch is not confirmed in the handover context.
- A request was made to clear operational test data while preserving master data. MySQL error 1175 safe-update mode blocked the first deletion attempt; final cleanup success is not confirmed.
- The customer has now said additional modifications are needed; the exact requirements remain to be recorded in Section 25.

---

## 29. Open Questions and Unknowns — Do Not Guess

The following must be confirmed from the customer or active source when relevant:

1. What exact customer modifications are being requested next?
2. What is the current active database name, MySQL host and runtime configuration? Do not disclose credentials.
3. What is the current exact `package.json` version and final installer artifact name?
4. Is the November 19 Prisma snapshot still current, or have additional payment/refund migrations been applied?
5. What precise formula is used for partial refunds and net collections?
6. Does current refund status include a new partial-refund enum value or use a calculated state?
7. What is the exact current file-cancellation refund/credit transaction implementation?
8. Are all file/task/subtask status mutations recorded to both task history/activity log and generic audit as required?
9. Is there a current restore/reopen route for cancelled files?
10. Which access-control roles/permissions, if any, are now implemented beyond the `User`/`Staff` schema snapshot?
11. Did the requested operational-data cleanup complete successfully?
12. What commit contains the latest Work Activity, payment and pagination updates?
13. Has a final Windows installer built from those latest changes been installed and tested end-to-end?
14. The GitHub repository is verified as `https://github.com/arafath65/client-workflow-system`, public, default branch `main` (checked 26 November 2026).
15. The selected hosting direction is a Contabo VPS using Docker Compose. MySQL 8 is planned as a private Docker service on the same VPS; it has not yet been installed or deployed. Confirm the final database, backup and application connection settings during implementation.
16. What DNS records and certificate names will be used for the production application domain/subdomain? The domain must be confirmed before public Caddy routing is configured.

---

## 30. Master Document Maintenance Rules

- The **Last updated** date at the top must be changed whenever this file changes materially.
- Every new customer request gets a `CR-XXX` entry in Section 25.
- Every completed milestone gets a dated entry in Section 28.
- The current status table in Section 23 must reflect the newest evidence.
- Historical information must not be silently deleted; mark old statements superseded and add a newer checkpoint.
- Facts from the source must be labelled as source-confirmed, user-reported, planned, or unverified where those distinctions matter.
- Do not store passwords, API keys, database URLs containing credentials, private customer identity documents or production customer records in this file.
- When a code path, schema or API changes, update both the relevant technical section and the chronological checkpoint.
- At the end of each significant change, record: files changed, migration, business rule, tests run, test result, remaining risk and Git/release status.

---

**End of current master baseline — updated 26 November 2026.**  
**Next action:** continue from Section 31.10: verify a second SSH login after UFW activation, then build the remaining Docker Compose hosting infrastructure. Customer change requests remain tracked separately in Section 25.

---

## 31. Contabo VPS Deployment and Hosting Checkpoint (26 November 2026)

This section records the infrastructure work performed for hosting the A&I Global Client Workflow System and future Innovex applications. It is a deployment checkpoint, not a claim that the application has already been deployed.

### 31.1 Hosting goal and chosen architecture

- Provider/plan: Contabo VPS 4.
- Operating system: Ubuntu 24.04.5 LTS (Noble).
- Intended deployment approach: Docker Engine + Docker Compose.
- The VPS is intended to host the Client Workflow System and potentially other separate Innovex web/API workloads in the future.
- Planned reverse proxy: Caddy, terminating public HTTP/HTTPS traffic on ports 80 and 443.
- Planned database: MySQL 8 in a Docker container on a private Docker network; do not publish MySQL port 3306 to the public internet.
- Planned application services: separate containers/Compose deployments for the workflow application, Gym API and future Next.js applications, according to their approved deployment scope.
- Planned administration: Cockpit for Ubuntu administration, Portainer as an optional Docker GUI, and phpMyAdmin for database administration if later installed. Administrative interfaces must remain private and be reached through SSH tunnels.
- Docker Compose CLI is the reliable primary deployment/control path. Portainer is optional until its local environment connection issue is resolved.

### 31.2 VPS capacity and base operating system

Values confirmed during the 26 November 2026 setup session:

| Item | Confirmed state |
|---|---|
| VPS plan | Contabo VPS 4 |
| OS | Ubuntu 24.04.5 LTS |
| Architecture | x86_64 / amd64 |
| CPU | 4 vCPU |
| RAM | Approximately 7.8 GiB |
| Disk | 100 GB plan; root filesystem approximately 96 GB usable |
| Kernel after reboot | 6.8.0-151-generic |
| Timezone | Asia/Colombo (+05:30) |
| NTP | Active |
| Swap | 4 GB /swapfile, active and persistent in /etc/fstab |
| Swappiness | 10 |
| Network stack | Netplan with systemd-networkd managing eth0 |
| Addressing | Public IPv4 and IPv6 are configured; exact addresses are intentionally not stored in this public repository |

The VPS was rebooted after kernel/package updates. The running kernel was verified as 6.8.0-151-generic; swap remained active after reboot; apt-get check passed.

### 31.3 Base package recovery and operating-system health

The fresh server initially had an interrupted dpkg state. Investigation found malformed update fragments under /var/lib/dpkg/updates/; the numbered fragments were zero-filled/corrupt. The main dpkg status database and its backups were inspected and found valid.

Recovery actions completed:

- A timestamped archive of the dpkg/apt state was saved under /root/dpkg-recovery-20261126_111425/.
- Corrupt numbered update fragments were preserved in a quarantine folder rather than discarded.
- dpkg --configure -a subsequently completed.
- dpkg --audit returned no findings and apt-get check passed.
- Seven damaged/empty BIND 9 library files were separately backed up under /root/bind9-recovery-20261126_112804/.
- Official Ubuntu bind9-libs package version 1:9.18.39-0ubuntu0.24.04.9 was installed, and matching bind9-host / bind9-dnsutils packages were upgraded.
- dpkg --verify bind9-libs, ldconfig, dpkg --audit and apt-get check completed without the earlier errors.
- apt upgrade reported no pending package upgrades before reboot.

Do not delete the recovery archives or quarantined fragments as part of routine cleanup. There is no confirmed evidence in this setup record of ext4/journal I/O errors or a package database status-file corruption.

### 31.4 Administrative account and SSH security

The administrative Linux account used for normal server work is ubuntu; it has sudo access. The account password was set so the user can authenticate to Cockpit/PAM while SSH password authentication remains disabled.

SSH configuration was hardened using /etc/ssh/sshd_config.d/00-innovex-security.conf:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
KbdInteractiveAuthentication no
```

- SSH remains on TCP port 22.
- Windows ED25519 key authentication was installed for the ubuntu account.
- Private key material remains on the user's Windows computer and must never be uploaded to GitHub or copied into this document.
- sshd -t passed.
- Effective SSH settings were checked after reboot and still showed root login disabled, password authentication disabled and public-key authentication enabled.
- A fresh second SSH connection after enabling UFW has not yet been tested. This is the exact next action when resuming.

Windows PowerShell SSH commands must be run in Windows PowerShell, not inside the remote Ubuntu shell. Keep an existing SSH session open when changing firewall or SSH settings until a second session is confirmed.

### 31.5 Network configuration and Cockpit

Netplan reports eth0 with the VPS public IPv4/IPv6 configuration, DNS and default gateways. Network ownership was checked:

- systemd-networkd is active and reports eth0 as routable (configured).
- NetworkManager is also active, but nmcli device status reports both eth0 and lo as unmanaged.
- Do not disable either service or edit the cloud network configuration through Cockpit without a separate review. systemd-networkd currently owns the VPS NIC.

Cockpit installation:

- Cockpit version: 362-1`bpo24.04.1 from Ubuntu Noble backports.
- cockpit.socket is enabled and active.
- Cockpit's web dashboard was opened successfully by the user.
- The intended secure access pattern is an SSH tunnel from Windows to the server's loopback port 9090. Do not expose TCP 9090 publicly.
- Cockpit's Networking page should not be used to change the active cloud NIC configuration until its NetworkManager/systemd-networkd behavior is understood.

### 31.6 Docker Engine and Compose installation

Docker was installed from Docker's official Ubuntu APT repository.

Repository configuration:

- Signing key: /etc/apt/keyrings/docker.asc.
- Repository definition: /etc/apt/sources.list.d/docker.sources.
- Ubuntu suite: noble.
- Component: stable.
- Architecture: amd64.
- Docker's repository index was fetched successfully by apt update, with no GPG/signature error.

Packages installed from the official repository:

| Package | Installed version / status |
|---|---|
| docker-ce | 5:29.10.1-1`ubuntu.24.04`noble |
| docker-ce-cli | 5:29.10.1-1`ubuntu.24.04`noble |
| containerd.io | 2.4.2-4`ubuntu.24.04`noble |
| docker-buildx-plugin | 0.39.1-1`ubuntu.24.04`noble |
| docker-compose-plugin | 5.8.0-1`ubuntu.24.04`noble |
| docker-ce-rootless-extras | Installed as a dependency |
| pigz | Installed as a dependency |

Confirmed runtime state:

- docker.service is enabled and active (running).
- Docker daemon completed initialization and listens on /run/docker.sock.
- sudo docker run --rm hello-world successfully pulled and ran the official test image, displayed Hello from Docker!, then removed the test container.
- Docker startup logged cleanup messages saying the initial IPv4/IPv6 docker-bridges nftables tables did not exist. Docker completed startup normally. An optional fsverity capability warning was also logged. No firewall workaround was applied based on those messages alone.
- Use sudo docker ... / sudo docker compose ... for administration. The ubuntu account has not been added to the docker group; membership in that group grants root-equivalent control.

### 31.7 Initial Innovex directory and Portainer deployment

The following directory was created and is owned by ubuntu with mode 0750:

```text
/opt/innovex/infrastructure/portainer/
```

Compose file:

```text
/opt/innovex/infrastructure/portainer/compose.yaml
```

The current Compose configuration is:

```yaml
services:
  portainer:
    image: portainer/portainer-ce:lts
    container_name: portainer
    restart: unless-stopped
    ports:
      - "127.0.0.1:9443:9443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data

volumes:
  portainer_data:
    name: portainer_data
```

Confirmed deployment state:

- Portainer Community Edition LTS image was pulled; startup logs identify version 2.45.4.
- Container name: portainer.
- Container is running.
- Docker network: portainer_default.
- Persistent volume: portainer_data, mounted at /data.
- Docker socket mount: /var/run/docker.sock to /var/run/docker.sock.
- Host HTTPS publication: 127.0.0.1:9443 only.
- Container ports 8000 and 9000 appear in docker ps as exposed container ports but are not published on the VPS host.
- Portainer first-time administrator account was created by the user. The administrator password and one-time setup token are intentionally not stored here.
- Edge Compute was left disabled because no remote edge agents are being managed.
- Portainer's browser interface is intended to be accessed through an SSH tunnel to 127.0.0.1:9443, using a Windows-local forwarding port such as 19443.

### 31.8 Portainer local environment connection issue — unresolved

The Portainer environment wizard initially showed that the local Docker environment was connected. After selecting Get Started, the page changed to:

> We could not connect your local environment to Portainer.

Read-only diagnostics performed:

- Host Docker socket exists with mode srw-rw----, owner root:docker.
- docker inspect portainer confirmed both /var/run/docker.sock and the persistent /data volume are mounted.
- A direct Docker API ping on the host using the Unix socket returned OK:

```bash
sudo curl --silent --show-error --unix-socket /var/run/docker.sock http://localhost/_ping
```

- Attempting docker exec portainer ls ... failed because the minimal Portainer image does not include the ls executable; this is not evidence that the socket mount is missing.
- The remaining Portainer endpoint error has not yet been diagnosed. Do not delete the portainer_data volume or recreate Portainer blindly. Docker Compose CLI remains available and is the primary deployment route until this is resolved.

The temporary Portainer setup token appeared in an earlier terminal log and was not retained in this document. Never record setup tokens, admin passwords or credentials in the public repository.

### 31.9 UFW firewall configuration

UFW was inactive before hardening. IPv6 support was confirmed as enabled in /etc/default/ufw:

```text
IPV6=yes
```

Default policies confirmed:

```text
DEFAULT_INPUT_POLICY="DROP"
DEFAULT_OUTPUT_POLICY="ACCEPT"
DEFAULT_FORWARD_POLICY="DROP"
```

Rules added and firewall enabled:

| Port | Protocol | Purpose | Public rule |
|---|---|---|---|
| 22 | TCP | SSH | Allowed |
| 80 | TCP | HTTP / future reverse proxy | Allowed |
| 443 | TCP | HTTPS / future reverse proxy | Allowed |

sudo ufw status verbose confirmed Status: active, incoming denied by default, outgoing allowed, routed denied, and the three rules applied to both IPv4 and IPv6.

No public allow rules were added for Cockpit 9090, Portainer 9443, or MySQL 3306.

**Docker firewall caveat:** Docker-published ports can be handled through Docker-managed iptables/nftables paths and may bypass ordinary UFW filtering. Therefore, keep admin web interfaces bound to host loopback, keep MySQL unpublished, and review Docker's DOCKER-USER/forwarding behavior before publishing application containers. The intended public entry point is Caddy on ports 80/443 only.

### 31.10 Exact continuation point and outstanding infrastructure tasks

**Last confirmed state: 26 November 2026.** UFW is enabled and shows the intended dual-stack rules. The user paused before testing a new SSH session.

Resume in this order:

1. **Verify SSH access from Windows PowerShell in a new window** while keeping the current SSH session open:

   ```powershell
   ssh -i "$env:USERPROFILE\\.ssh\\innovex_vps_ed25519" ubuntu@<VPS_PUBLIC_IP>
   ```

   After login, run sudo whoami; expected output is root. Do not close the old session until this succeeds. Do not run the Windows $env:USERPROFILE command inside Ubuntu.

2. Recheck sudo ufw status verbose and preserve SSH port 22 access for both address families.

3. Create the remaining agreed directory layout, with application source/configuration under /opt/innovex/ and persistent database, backups and storage under /srv/innovex/. The /srv/innovex/ hierarchy has not yet been created.

4. Complete Docker firewall design deliberately; keep admin interfaces on loopback and prevent direct public MySQL access.

5. Install and configure Caddy as the public reverse proxy on ports 80/443. Confirm the required DNS record(s) and domain before requesting HTTPS certificates.

6. Deploy MySQL 8 using a private Docker network and persistent storage. Do not publish 3306 to the public internet. Decide backup/restore procedure before production data is loaded.

7. Deploy the Client Workflow System as a separate service/Compose stack, using production environment variables kept outside Git. Reconcile the live project source, Prisma migrations, Node runtime, and database requirements before the first deployment.

8. Add phpMyAdmin only if required, with private SSH-tunnel access. Do not expose it publicly.

9. Troubleshoot Portainer's local environment connection only if the user still wants the GUI; preserve the existing portainer_data volume.

10. Perform end-to-end checks: DNS, HTTPS, reverse proxy routing, login, database connectivity, persistence after container recreation, backups/restores, and a reboot/reconnect check.

### 31.11 Security and documentation rules for this VPS

- This GitHub repository is public. Do not place the server's exact public IP addresses, private SSH key, SSH key material, passwords, one-time setup tokens, database credentials, .env values, or backup encryption keys in this document.
- Retrieve the VPS public addresses from the Contabo control panel or approved private notes when required.
- Keep Cockpit and Portainer reachable through SSH tunnels only.
- Keep database ports private to Docker networks.
- Never add a broad public Docker-published port without first reviewing Docker/UFW interaction.
- Preserve the dpkg and BIND recovery archives until a separate retention decision is made.
- The current infrastructure is a prepared base only: Caddy, MySQL, phpMyAdmin and the workflow application have not yet been deployed.
