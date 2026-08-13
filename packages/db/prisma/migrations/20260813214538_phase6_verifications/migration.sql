-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('liveness', 'phone', 'email', 'document');

-- CreateEnum
CREATE TYPE "VerificationProvider" AS ENUM ('didit', 'twilio');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'passed', 'failed', 'expired');

-- CreateTable
CREATE TABLE "verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "VerificationType" NOT NULL,
    "provider" "VerificationProvider" NOT NULL,
    "provider_reference" VARCHAR(255),
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "verified_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verifications_user_id_type_status_idx" ON "verifications"("user_id", "type", "status");

-- CreateIndex
CREATE INDEX "verifications_provider_reference_idx" ON "verifications"("provider_reference");

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
