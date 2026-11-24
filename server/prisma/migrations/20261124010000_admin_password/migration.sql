-- Admins sign in with email + password (everyone else uses OTP).
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
