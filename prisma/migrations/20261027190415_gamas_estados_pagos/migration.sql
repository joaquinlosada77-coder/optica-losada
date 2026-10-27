-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('PENDIENTE', 'LABORATORIO', 'MONTAJE', 'DISPONIBLE', 'ENTREGADO');

-- CreateEnum
CREATE TYPE "LensFamily" AS ENUM ('MONOFOCAL', 'BIFOCAL', 'PROGRESIVO', 'OCUPACIONAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'CHEQUE';
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDITO_INSTITUCION';
ALTER TYPE "PaymentMethod" ADD VALUE 'CONVENIO';
ALTER TYPE "PaymentMethod" ADD VALUE 'GARANTIA';

-- AlterTable
ALTER TABLE "lens_designs" ADD COLUMN     "family" "LensFamily" NOT NULL DEFAULT 'MONOFOCAL';

-- AlterTable
ALTER TABLE "lens_treatments" ADD COLUMN     "exclusive_group" TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "delivered_at" TIMESTAMPTZ(3),
ADD COLUMN     "work_status" "WorkStatus" NOT NULL DEFAULT 'ENTREGADO';
