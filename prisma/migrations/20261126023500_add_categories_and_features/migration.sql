-- AlterTable
ALTER TABLE "amenities" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "subject" VARCHAR(150),
ALTER COLUMN "propertyId" DROP NOT NULL,
ALTER COLUMN "ownerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isLatest" BOOLEAN NOT NULL DEFAULT false;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' 
    AND column_name = 'propertyType' 
    AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE "properties" ALTER COLUMN "propertyType" TYPE VARCHAR(50) USING "propertyType"::text;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "property_categories" (
    "id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "property_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "property_categories_type_key" ON "property_categories"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "properties_propertyType_idx" ON "properties"("propertyType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "properties_status_city_propertyType_idx" ON "properties"("status", "city", "propertyType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "properties_status_isFeatured_idx" ON "properties"("status", "isFeatured");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "properties_status_isLatest_idx" ON "properties"("status", "isLatest");

