-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PASSENGER', 'DRIVER', 'RENTAL_OWNER', 'FLEET_OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('CAR', 'BIKE', 'SCOOTER', 'BUS', 'MINI_BUS', 'TEMPO_TRAVELLER');

-- CreateEnum
CREATE TYPE "RideType" AS ENUM ('CARPOOL', 'GROUP_TOUR');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('PUBLISHED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('INSTANT', 'APPROVAL');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RentalMode" AS ENUM ('SELF_DRIVE', 'WITH_DRIVER');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ACTIVE', 'RETURNED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('OPEN_FOR_QUOTES', 'QUOTE_ACCEPTED', 'ALLOCATED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleRow" (
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "UserRoleRow_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "licenceNumberEnc" TEXT NOT NULL,
    "licenceDocKey" TEXT,
    "licenceExpiresAt" TIMESTAMP(3) NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "category" "VehicleCategory" NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "registrationEnc" TEXT NOT NULL,
    "seatCapacity" INTEGER NOT NULL,
    "rcDocKey" TEXT,
    "insuranceDocKey" TEXT,
    "insuranceExpiresAt" TIMESTAMP(3),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ride" (
    "id" UUID NOT NULL,
    "type" "RideType" NOT NULL DEFAULT 'CARPOOL',
    "title" TEXT,
    "driverUserId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "originName" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "destName" TEXT NOT NULL,
    "destLat" DOUBLE PRECISION NOT NULL,
    "destLng" DOUBLE PRECISION NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "routeProvider" TEXT NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "availableSeats" INTEGER NOT NULL,
    "pricePerSeatPaise" BIGINT NOT NULL,
    "bookingMode" "BookingMode" NOT NULL DEFAULT 'APPROVAL',
    "status" "RideStatus" NOT NULL DEFAULT 'PUBLISHED',
    "checklist" JSONB,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideBooking" (
    "id" UUID NOT NULL,
    "rideId" UUID NOT NULL,
    "passengerUserId" UUID NOT NULL,
    "seatsRequested" INTEGER NOT NULL,
    "pricePerSeatSnapshot" BIGINT NOT NULL,
    "totalPaise" BIGINT NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "participants" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RideBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalListing" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "city" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "rentalMode" "RentalMode" NOT NULL,
    "pricePerDayPaise" BIGINT NOT NULL,
    "securityDepositPaise" BIGINT NOT NULL,
    "includedKmPerDay" INTEGER NOT NULL,
    "extraKmChargePaise" BIGINT NOT NULL,
    "helmetIncluded" BOOLEAN NOT NULL DEFAULT false,
    "cancellationPolicy" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RentalListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalBooking" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "renterUserId" UUID NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "plannedDistanceMeters" INTEGER NOT NULL,
    "pricePerDaySnapshot" BIGINT NOT NULL,
    "depositSnapshot" BIGINT NOT NULL,
    "totalPaise" BIGINT NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "pickupChecklist" JSONB,
    "returnChecklist" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRequest" (
    "id" UUID NOT NULL,
    "organizerUserId" UUID NOT NULL,
    "originName" TEXT NOT NULL,
    "destName" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "returnAt" TIMESTAMP(3) NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "passengerCount" INTEGER NOT NULL,
    "luggageNotes" TEXT,
    "vehiclePreference" TEXT NOT NULL,
    "budgetTotalPaise" BIGINT,
    "status" "GroupStatus" NOT NULL DEFAULT 'OPEN_FOR_QUOTES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupQuote" (
    "id" UUID NOT NULL,
    "groupRequestId" UUID NOT NULL,
    "operatorUserId" UUID NOT NULL,
    "totalPricePaise" BIGINT NOT NULL,
    "vehiclePlan" TEXT NOT NULL,
    "inclusions" TEXT NOT NULL DEFAULT '',
    "cancellationTerms" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAllocation" (
    "id" UUID NOT NULL,
    "groupQuoteId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "assignedPassengers" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GroupAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverAssignment" (
    "id" UUID NOT NULL,
    "groupAllocationId" UUID NOT NULL,
    "driverUserId" UUID NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DriverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupParticipant" (
    "id" UUID NOT NULL,
    "groupRequestId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phoneEnc" TEXT,
    "notes" TEXT,

    CONSTRAINT "GroupParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bookingType" TEXT NOT NULL,
    "bookingId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "rideBookingId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "revieweeId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_userId_key" ON "DriverProfile"("userId");

-- CreateIndex
CREATE INDEX "Vehicle_ownerUserId_idx" ON "Vehicle"("ownerUserId");

-- CreateIndex
CREATE INDEX "Ride_departureAt_status_idx" ON "Ride"("departureAt", "status");

-- CreateIndex
CREATE INDEX "Ride_driverUserId_idx" ON "Ride"("driverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RideBooking_idempotencyKey_key" ON "RideBooking"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RideBooking_passengerUserId_idx" ON "RideBooking"("passengerUserId");

-- CreateIndex
CREATE INDEX "RideBooking_rideId_idx" ON "RideBooking"("rideId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalListing_vehicleId_key" ON "RentalListing"("vehicleId");

-- CreateIndex
CREATE INDEX "RentalListing_city_idx" ON "RentalListing"("city");

-- CreateIndex
CREATE INDEX "RentalBooking_vehicleId_idx" ON "RentalBooking"("vehicleId");

-- CreateIndex
CREATE INDEX "RentalBooking_renterUserId_idx" ON "RentalBooking"("renterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupQuote_groupRequestId_operatorUserId_key" ON "GroupQuote"("groupRequestId", "operatorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverAssignment_groupAllocationId_key" ON "DriverAssignment"("groupAllocationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_bookingType_bookingId_idx" ON "Payment"("bookingType", "bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_rideBookingId_key" ON "Review"("rideBookingId");

-- CreateIndex
CREATE INDEX "Review_revieweeId_idx" ON "Review"("revieweeId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "UserRoleRow" ADD CONSTRAINT "UserRoleRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_driverUserId_fkey" FOREIGN KEY ("driverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideBooking" ADD CONSTRAINT "RideBooking_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideBooking" ADD CONSTRAINT "RideBooking_passengerUserId_fkey" FOREIGN KEY ("passengerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBooking" ADD CONSTRAINT "RentalBooking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "RentalListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBooking" ADD CONSTRAINT "RentalBooking_renterUserId_fkey" FOREIGN KEY ("renterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRequest" ADD CONSTRAINT "GroupRequest_organizerUserId_fkey" FOREIGN KEY ("organizerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupQuote" ADD CONSTRAINT "GroupQuote_groupRequestId_fkey" FOREIGN KEY ("groupRequestId") REFERENCES "GroupRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupQuote" ADD CONSTRAINT "GroupQuote_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAllocation" ADD CONSTRAINT "GroupAllocation_groupQuoteId_fkey" FOREIGN KEY ("groupQuoteId") REFERENCES "GroupQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAllocation" ADD CONSTRAINT "GroupAllocation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_groupAllocationId_fkey" FOREIGN KEY ("groupAllocationId") REFERENCES "GroupAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_driverUserId_fkey" FOREIGN KEY ("driverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupParticipant" ADD CONSTRAINT "GroupParticipant_groupRequestId_fkey" FOREIGN KEY ("groupRequestId") REFERENCES "GroupRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

