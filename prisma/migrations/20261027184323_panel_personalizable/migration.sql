-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dashboard_widgets" TEXT[] DEFAULT ARRAY[]::TEXT[];
