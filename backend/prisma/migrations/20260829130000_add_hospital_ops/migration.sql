-- CreateEnum
CREATE TYPE "PatientShiftStatus" AS ENUM ('scheduled', 'completed', 'missed');

-- CreateEnum
CREATE TYPE "SurgeryStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "patient_staff_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "first_name" VARCHAR(255) NOT NULL,
    "last_name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(100) NOT NULL,
    "department" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_shifts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "department" VARCHAR(255),
    "status" "PatientShiftStatus" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_staff_check_ins" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "shift_id" UUID,
    "check_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "check_out_at" TIMESTAMP(3),

    CONSTRAINT "patient_staff_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_surgeries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "surgeon_id" UUID NOT NULL,
    "procedure" VARCHAR(255) NOT NULL,
    "operating_room" VARCHAR(100),
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "status" "SurgeryStatus" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_surgeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_staff_members_tenant_id_idx" ON "patient_staff_members"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_shifts_tenant_id_idx" ON "patient_shifts"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_staff_check_ins_tenant_id_idx" ON "patient_staff_check_ins"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_surgeries_tenant_id_idx" ON "patient_surgeries"("tenant_id");

-- AddForeignKey
ALTER TABLE "patient_shifts" ADD CONSTRAINT "patient_shifts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "patient_staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_staff_check_ins" ADD CONSTRAINT "patient_staff_check_ins_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "patient_staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_staff_check_ins" ADD CONSTRAINT "patient_staff_check_ins_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "patient_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_surgeries" ADD CONSTRAINT "patient_surgeries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_surgeries" ADD CONSTRAINT "patient_surgeries_surgeon_id_fkey" FOREIGN KEY ("surgeon_id") REFERENCES "patient_staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
