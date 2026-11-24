-- Accounts can now register with email (phone optional), but every account needs at least one.
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT user_has_contact CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);
