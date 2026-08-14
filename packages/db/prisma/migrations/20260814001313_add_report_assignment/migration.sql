-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "assigned_to_admin_id" UUID;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_assigned_to_admin_id_fkey" FOREIGN KEY ("assigned_to_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
