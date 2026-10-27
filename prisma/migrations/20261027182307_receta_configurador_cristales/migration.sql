-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "code" TEXT,
ADD COLUMN     "lens_config" JSONB;

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "professional_id" TEXT,
    "issued_at" DATE NOT NULL,
    "od_sph" DOUBLE PRECISION NOT NULL,
    "od_cyl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "od_axis" INTEGER,
    "od_add" DOUBLE PRECISION,
    "oi_sph" DOUBLE PRECISION NOT NULL,
    "oi_cyl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "oi_axis" INTEGER,
    "oi_add" DOUBLE PRECISION,
    "dp_od" DOUBLE PRECISION,
    "dp_oi" DOUBLE PRECISION,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lens_materials" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "refractive_index" TEXT NOT NULL,
    "description" TEXT,
    "thinness" INTEGER NOT NULL DEFAULT 1,
    "recommend_from_power" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_power" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lens_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lens_designs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requires_add" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lens_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lens_treatments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lens_treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lens_prices" (
    "material_id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "lens_prices_pkey" PRIMARY KEY ("material_id","design_id")
);

-- CreateIndex
CREATE INDEX "prescriptions_patient_id_issued_at_idx" ON "prescriptions"("patient_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "lens_materials_org_id_code_key" ON "lens_materials"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "lens_designs_org_id_code_key" ON "lens_designs"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "lens_treatments_org_id_code_key" ON "lens_treatments"("org_id", "code");

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lens_materials" ADD CONSTRAINT "lens_materials_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lens_designs" ADD CONSTRAINT "lens_designs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lens_treatments" ADD CONSTRAINT "lens_treatments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lens_prices" ADD CONSTRAINT "lens_prices_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "lens_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lens_prices" ADD CONSTRAINT "lens_prices_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "lens_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
