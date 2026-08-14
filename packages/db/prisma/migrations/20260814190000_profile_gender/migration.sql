CREATE TYPE "Gender" AS ENUM ('male', 'female', 'transgender', 'other');

ALTER TABLE "profiles" ADD COLUMN "gender" "Gender";
