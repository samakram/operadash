-- CreateTable
CREATE TABLE "pipeline_stage_labels" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "module" "ModuleName" NOT NULL,
    "stage" "LeadStage" NOT NULL,
    "label" VARCHAR(100) NOT NULL,

    CONSTRAINT "pipeline_stage_labels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stage_labels_tenant_id_module_stage_key" ON "pipeline_stage_labels"("tenant_id", "module", "stage");
