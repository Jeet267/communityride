-- Luggage allowed per seat on a shared ride.
CREATE TYPE "Luggage" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');
ALTER TABLE "Ride" ADD COLUMN "luggage" "Luggage" NOT NULL DEFAULT 'MEDIUM';
