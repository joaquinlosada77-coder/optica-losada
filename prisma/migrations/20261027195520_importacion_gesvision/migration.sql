-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "external_code" TEXT;

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "avcc_od" TEXT,
ADD COLUMN     "avcc_oi" TEXT,
ADD COLUMN     "dp_total" DOUBLE PRECISION,
ADD COLUMN     "external_ref" TEXT,
ADD COLUMN     "professional_name" TEXT,
ADD COLUMN     "reason" TEXT,
ALTER COLUMN "od_sph" DROP NOT NULL,
ALTER COLUMN "oi_sph" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "patients_org_id_external_code_idx" ON "patients"("org_id", "external_code");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_org_id_external_ref_key" ON "prescriptions"("org_id", "external_ref");

