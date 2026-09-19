-- AlterTable
ALTER TABLE "leads" ADD COLUMN "converted_record_id" UUID;

-- AlterTable
ALTER TABLE "student_tuition_records" ADD COLUMN "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reminder_sent_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2),
    "plan" "PlanTier",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_permissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "module_name" "ModuleName" NOT NULL,
    "feature_name" VARCHAR(255) NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_events_tenant_id_idx" ON "billing_events"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_permissions_user_id_module_name_feature_name_key" ON "staff_permissions"("user_id", "module_name", "feature_name");
