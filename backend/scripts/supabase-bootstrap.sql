-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'tenant_admin', 'staff');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('free', 'starter', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('new', 'contacted', 'qualified', 'won', 'lost');

-- CreateEnum
CREATE TYPE "ModuleName" AS ENUM ('hotel', 'student', 'patient', 'restaurant');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('single', 'double', 'suite', 'deluxe');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('vacant', 'occupied', 'cleaning', 'maintenance');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'partial', 'refunded');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('cleaning', 'maintenance', 'check_in', 'check_out');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('open', 'in_progress', 'completed', 'closed');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('unpaid', 'paid', 'partial');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('active', 'inactive', 'graduated', 'suspended');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'completed', 'dropped', 'suspended');

-- CreateEnum
CREATE TYPE "TuitionStatus" AS ENUM ('pending', 'partial', 'paid', 'overdue');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('all_students', 'class_specific', 'instructor_only');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('scheduled', 'checked_in', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "PrescriptionFrequency" AS ENUM ('once_daily', 'twice_daily', 'three_times_daily', 'as_needed');

-- CreateEnum
CREATE TYPE "LabStatus" AS ENUM ('normal', 'abnormal', 'critical');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('pending', 'submitted', 'approved', 'denied');

-- CreateEnum
CREATE TYPE "MenuCategory" AS ENUM ('appetizers', 'mains', 'desserts', 'drinks', 'specials');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'cooking', 'ready', 'served', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('pending', 'cooking', 'ready', 'served');

-- CreateEnum
CREATE TYPE "ShiftRole" AS ENUM ('waiter', 'chef', 'cashier', 'manager');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('scheduled', 'checked_in', 'active', 'completed');

-- CreateEnum
CREATE TYPE "InventoryUnit" AS ENUM ('kg', 'liters', 'pieces', 'units');

-- CreateEnum
CREATE TYPE "InventoryReason" AS ENUM ('purchase', 'usage', 'waste', 'adjustment');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('vacant', 'occupied', 'reserved', 'cleaning');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('confirmed', 'seated', 'completed', 'cancelled', 'no_show');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "tenant_id" UUID,
    "role" "Role" NOT NULL,
    "first_name" VARCHAR(255),
    "last_name" VARCHAR(255),
    "avatar_url" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "subdomain" VARCHAR(255) NOT NULL,
    "domain" VARCHAR(255),
    "plan" "PlanTier" NOT NULL DEFAULT 'starter',
    "enabled_modules" "ModuleName"[] DEFAULT ARRAY[]::"ModuleName"[],
    "logo_url" VARCHAR(255),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripe_customer_id" VARCHAR(255),
    "monthly_revenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "name" "ModuleName" NOT NULL,
    "version" VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    "description" TEXT,
    "enabled_for_tenants" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "entity_type" VARCHAR(255) NOT NULL,
    "entity_id" UUID,
    "changes" JSONB,
    "ip_address" VARCHAR(50),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "module_name" "ModuleName" NOT NULL,
    "feature_name" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "module" "ModuleName" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(20),
    "estimated_value" DECIMAL(10,2),
    "stage" "LeadStage" NOT NULL DEFAULT 'new',
    "source" VARCHAR(255),
    "notes" TEXT,
    "assigned_to_user_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_guests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "first_name" VARCHAR(255) NOT NULL,
    "last_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "address" TEXT,
    "city" VARCHAR(255),
    "country" VARCHAR(255),
    "check_in_date" DATE,
    "check_out_date" DATE,
    "notes" TEXT,
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_rooms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "room_number" VARCHAR(50) NOT NULL,
    "room_type" "RoomType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price_per_night" DECIMAL(10,2) NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'vacant',
    "occupied_by_guest_id" UUID,
    "floor_number" INTEGER,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_reservations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "number_of_nights" INTEGER,
    "total_price" DECIMAL(10,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_method" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_staff_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_user_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "task_type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "assigned_date" DATE NOT NULL,
    "completed_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_maintenance_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "issue_description" TEXT NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'medium',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'open',
    "assigned_to" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "payment_method" VARCHAR(100),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'unpaid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_students" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "first_name" VARCHAR(255) NOT NULL,
    "last_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "date_of_birth" DATE,
    "gender" VARCHAR(50),
    "address" TEXT,
    "parent_name" VARCHAR(255),
    "parent_email" VARCHAR(255),
    "parent_phone" VARCHAR(20),
    "enrollment_date" DATE NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_instructors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "first_name" VARCHAR(255) NOT NULL,
    "last_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "specialization" VARCHAR(255),
    "bio" TEXT,
    "hire_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_classes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_name" VARCHAR(255) NOT NULL,
    "course_code" VARCHAR(50),
    "instructor_id" UUID NOT NULL,
    "description" TEXT,
    "schedule" JSONB,
    "capacity" INTEGER NOT NULL,
    "enrolled_count" INTEGER NOT NULL DEFAULT 0,
    "price_per_course" DECIMAL(10,2),
    "start_date" DATE,
    "end_date" DATE,
    "status" "ClassStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_enrollments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "enrollment_date" DATE NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',
    "progress_percentage" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_attendance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "present" BOOLEAN NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_grades" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "assignment_name" VARCHAR(255),
    "score" DECIMAL(5,2) NOT NULL,
    "max_score" DECIMAL(5,2) NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 100,
    "submitted_date" DATE,
    "comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_tuition_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "amount_due" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "due_date" DATE NOT NULL,
    "paid_date" DATE,
    "payment_method" VARCHAR(100),
    "status" "TuitionStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_tuition_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "audience_type" "AnnouncementAudience" NOT NULL,
    "target_class_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_patients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "first_name" VARCHAR(255) NOT NULL,
    "last_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "date_of_birth" DATE NOT NULL,
    "gender" VARCHAR(50),
    "address" TEXT,
    "city" VARCHAR(255),
    "country" VARCHAR(255),
    "emergency_contact_name" VARCHAR(255),
    "emergency_contact_phone" VARCHAR(20),
    "medical_history_summary" TEXT,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chronic_conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blood_type" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_providers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "first_name" VARCHAR(255) NOT NULL,
    "last_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "specialization" VARCHAR(255),
    "license_number" VARCHAR(100),
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_appointments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "appointment_datetime" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "reason_for_visit" VARCHAR(255),
    "status" "AppointmentStatus" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_medical_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "visit_date" DATE NOT NULL,
    "chief_complaint" TEXT,
    "examination_findings" TEXT,
    "diagnosis" TEXT,
    "treatment_plan" TEXT,
    "provider_id" UUID NOT NULL,
    "follow_up_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_prescriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "medication_name" VARCHAR(255) NOT NULL,
    "dosage" VARCHAR(100) NOT NULL,
    "frequency" "PrescriptionFrequency" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "refills_remaining" INTEGER NOT NULL DEFAULT 0,
    "special_instructions" TEXT,
    "prescribing_provider_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_vital_signs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "visit_date" DATE NOT NULL,
    "blood_pressure" VARCHAR(20),
    "heart_rate" INTEGER,
    "temperature" DECIMAL(4,1),
    "weight" DECIMAL(6,2),
    "height" DECIMAL(5,2),
    "bmi" DECIMAL(5,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_lab_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "test_name" VARCHAR(255) NOT NULL,
    "test_date" DATE NOT NULL,
    "result_value" VARCHAR(255),
    "reference_range" VARCHAR(255),
    "unit" VARCHAR(100),
    "status" "LabStatus" NOT NULL DEFAULT 'normal',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_insurance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "provider_name" VARCHAR(255),
    "policy_number" VARCHAR(255),
    "group_number" VARCHAR(255),
    "effective_date" DATE,
    "expiration_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_insurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_billing" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "appointment_id" UUID,
    "amount_charged" DECIMAL(10,2) NOT NULL,
    "insurance_claim_status" "ClaimStatus" NOT NULL DEFAULT 'pending',
    "patient_responsibility" DECIMAL(10,2),
    "paid_date" DATE,
    "payment_method" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_billing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_menu_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "category" "MenuCategory" NOT NULL,
    "image_url" VARCHAR(255),
    "available" BOOLEAN NOT NULL DEFAULT true,
    "prep_time_minutes" INTEGER,
    "calories" INTEGER,
    "dietary_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    "table_id" UUID,
    "customer_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "items_count" INTEGER,
    "subtotal" DECIMAL(10,2),
    "tax" DECIMAL(10,2),
    "total_amount" DECIMAL(10,2),
    "order_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "served_time" TIMESTAMP(3),
    "completed_time" TIMESTAMP(3),
    "payment_method" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_order_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "special_requests" TEXT,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "total_spent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "last_visit" TIMESTAMP(3),
    "preferences" TEXT,
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_staff_shifts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_user_id" UUID NOT NULL,
    "shift_date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "role" "ShiftRole" NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'scheduled',
    "checked_in_at" TIMESTAMP(3),
    "checked_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_inventory" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" "InventoryUnit" NOT NULL,
    "reorder_level" DECIMAL(10,2),
    "cost_per_unit" DECIMAL(10,2),
    "supplier_id" UUID,
    "last_restocked" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_inventory_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "change_quantity" DECIMAL(10,2) NOT NULL,
    "reason" "InventoryReason" NOT NULL,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_tables" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "table_number" VARCHAR(50) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "TableStatus" NOT NULL DEFAULT 'vacant',
    "current_order_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_reservations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "reservation_date" DATE NOT NULL,
    "reservation_time" TIME NOT NULL,
    "party_size" INTEGER NOT NULL,
    "table_id" UUID,
    "status" "ReservationStatus" NOT NULL DEFAULT 'confirmed',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "modules_name_key" ON "modules"("name");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_tenant_id_module_name_feature_name_key" ON "feature_flags"("tenant_id", "module_name", "feature_name");

-- CreateIndex
CREATE INDEX "leads_tenant_id_module_idx" ON "leads"("tenant_id", "module");

-- CreateIndex
CREATE INDEX "hotel_guests_tenant_id_idx" ON "hotel_guests"("tenant_id");

-- CreateIndex
CREATE INDEX "hotel_rooms_tenant_id_idx" ON "hotel_rooms"("tenant_id");

-- CreateIndex
CREATE INDEX "hotel_reservations_tenant_id_idx" ON "hotel_reservations"("tenant_id");

-- CreateIndex
CREATE INDEX "hotel_staff_assignments_tenant_id_idx" ON "hotel_staff_assignments"("tenant_id");

-- CreateIndex
CREATE INDEX "hotel_maintenance_requests_tenant_id_idx" ON "hotel_maintenance_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "hotel_invoices_tenant_id_idx" ON "hotel_invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "student_students_tenant_id_idx" ON "student_students"("tenant_id");

-- CreateIndex
CREATE INDEX "student_instructors_tenant_id_idx" ON "student_instructors"("tenant_id");

-- CreateIndex
CREATE INDEX "student_classes_tenant_id_idx" ON "student_classes"("tenant_id");

-- CreateIndex
CREATE INDEX "student_enrollments_tenant_id_idx" ON "student_enrollments"("tenant_id");

-- CreateIndex
CREATE INDEX "student_attendance_tenant_id_idx" ON "student_attendance"("tenant_id");

-- CreateIndex
CREATE INDEX "student_grades_tenant_id_idx" ON "student_grades"("tenant_id");

-- CreateIndex
CREATE INDEX "student_tuition_records_tenant_id_idx" ON "student_tuition_records"("tenant_id");

-- CreateIndex
CREATE INDEX "student_announcements_tenant_id_idx" ON "student_announcements"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_patients_tenant_id_idx" ON "patient_patients"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_providers_tenant_id_idx" ON "patient_providers"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_appointments_tenant_id_idx" ON "patient_appointments"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_medical_records_tenant_id_idx" ON "patient_medical_records"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_prescriptions_tenant_id_idx" ON "patient_prescriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_vital_signs_tenant_id_idx" ON "patient_vital_signs"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_lab_results_tenant_id_idx" ON "patient_lab_results"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_insurance_tenant_id_idx" ON "patient_insurance"("tenant_id");

-- CreateIndex
CREATE INDEX "patient_billing_tenant_id_idx" ON "patient_billing"("tenant_id");

-- CreateIndex
CREATE INDEX "restaurant_menu_items_tenant_id_idx" ON "restaurant_menu_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_orders_order_number_key" ON "restaurant_orders"("order_number");

-- CreateIndex
CREATE INDEX "restaurant_orders_tenant_id_idx" ON "restaurant_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "restaurant_order_items_tenant_id_idx" ON "restaurant_order_items"("tenant_id");

-- CreateIndex
CREATE INDEX "restaurant_customers_tenant_id_idx" ON "restaurant_customers"("tenant_id");

-- CreateIndex
CREATE INDEX "restaurant_staff_shifts_tenant_id_idx" ON "restaurant_staff_shifts"("tenant_id");

-- CreateIndex
CREATE INDEX "restaurant_inventory_tenant_id_idx" ON "restaurant_inventory"("tenant_id");

-- CreateIndex
CREATE INDEX "restaurant_inventory_logs_tenant_id_idx" ON "restaurant_inventory_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "restaurant_tables_tenant_id_idx" ON "restaurant_tables"("tenant_id");

-- CreateIndex
CREATE INDEX "restaurant_reservations_tenant_id_idx" ON "restaurant_reservations"("tenant_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rooms" ADD CONSTRAINT "hotel_rooms_occupied_by_guest_id_fkey" FOREIGN KEY ("occupied_by_guest_id") REFERENCES "hotel_guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "hotel_guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_staff_assignments" ADD CONSTRAINT "hotel_staff_assignments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_maintenance_requests" ADD CONSTRAINT "hotel_maintenance_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_invoices" ADD CONSTRAINT "hotel_invoices_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "hotel_guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_invoices" ADD CONSTRAINT "hotel_invoices_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "hotel_reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_classes" ADD CONSTRAINT "student_classes_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "student_instructors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "student_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "student_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_grades" ADD CONSTRAINT "student_grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_grades" ADD CONSTRAINT "student_grades_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "student_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tuition_records" ADD CONSTRAINT "student_tuition_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tuition_records" ADD CONSTRAINT "student_tuition_records_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "student_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_announcements" ADD CONSTRAINT "student_announcements_target_class_id_fkey" FOREIGN KEY ("target_class_id") REFERENCES "student_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_appointments" ADD CONSTRAINT "patient_appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_appointments" ADD CONSTRAINT "patient_appointments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "patient_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_medical_records" ADD CONSTRAINT "patient_medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_medical_records" ADD CONSTRAINT "patient_medical_records_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "patient_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_prescriptions" ADD CONSTRAINT "patient_prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_prescriptions" ADD CONSTRAINT "patient_prescriptions_prescribing_provider_id_fkey" FOREIGN KEY ("prescribing_provider_id") REFERENCES "patient_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_vital_signs" ADD CONSTRAINT "patient_vital_signs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_lab_results" ADD CONSTRAINT "patient_lab_results_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurance" ADD CONSTRAINT "patient_insurance_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_billing" ADD CONSTRAINT "patient_billing_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_billing" ADD CONSTRAINT "patient_billing_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "patient_appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "restaurant_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "restaurant_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_order_items" ADD CONSTRAINT "restaurant_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "restaurant_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_order_items" ADD CONSTRAINT "restaurant_order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "restaurant_menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_inventory_logs" ADD CONSTRAINT "restaurant_inventory_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "restaurant_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_reservations" ADD CONSTRAINT "restaurant_reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "restaurant_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_reservations" ADD CONSTRAINT "restaurant_reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "restaurant_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Prisma's own migration-tracking table, so a later `prisma migrate deploy`
-- (e.g. from Railway) knows this migration was already applied here and
-- doesn't try to recreate these tables.
CREATE TABLE "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
