-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('ARMAZON', 'CRISTAL', 'LENTE_CONTACTO', 'LIQUIDO', 'ACCESORIO', 'LENTE_SOL', 'SERVICIO');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('ABIERTA', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'OTRO');

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "sale_seq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "type" "ProductType" NOT NULL,
    "price" INTEGER NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "patient_id" TEXT,
    "seller_id" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "delivery_date" DATE,
    "notes" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "product_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "cash_session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "opened_by_id" TEXT NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opening_amount" INTEGER NOT NULL,
    "closed_by_id" TEXT,
    "closed_at" TIMESTAMPTZ(3),
    "counted_cash" INTEGER,
    "expected_cash" INTEGER,
    "notes" TEXT,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_org_id_type_idx" ON "products"("org_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "products_org_id_sku_key" ON "products"("org_id", "sku");

-- CreateIndex
CREATE INDEX "sales_org_id_created_at_idx" ON "sales"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_patient_id_idx" ON "sales"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_branch_id_number_key" ON "sales"("branch_id", "number");

-- CreateIndex
CREATE INDEX "payments_cash_session_id_idx" ON "payments"("cash_session_id");

-- CreateIndex
CREATE INDEX "cash_sessions_branch_id_opened_at_idx" ON "cash_sessions"("branch_id", "opened_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Solo una caja abierta por sucursal
CREATE UNIQUE INDEX "cash_sessions_one_open_per_branch" ON "cash_sessions" ("branch_id") WHERE "closed_at" IS NULL;

ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_qty_positive" CHECK ("quantity" > 0);
ALTER TABLE "sales" ADD CONSTRAINT "sales_amounts_valid" CHECK ("total" >= 0 AND "paid" >= 0 AND "discount" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_price_valid" CHECK ("price" >= 0);
