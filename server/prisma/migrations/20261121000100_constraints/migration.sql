-- Hand-written constraints (Prisma schema cannot express these). The database is the last line of defence.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Ride" ADD CONSTRAINT ride_distance_chk CHECK ("distanceMeters" > 0 AND "distanceMeters" <= 500000);
ALTER TABLE "Ride" ADD CONSTRAINT ride_seats_chk CHECK ("availableSeats" >= 0 AND "availableSeats" <= "totalSeats");
ALTER TABLE "Ride" ADD CONSTRAINT ride_price_chk CHECK ("pricePerSeatPaise" >= 0);
ALTER TABLE "GroupRequest" ADD CONSTRAINT group_distance_chk CHECK ("distanceMeters" > 0 AND "distanceMeters" <= 500000);
ALTER TABLE "GroupRequest" ADD CONSTRAINT group_pax_chk CHECK ("passengerCount" BETWEEN 1 AND 500);
ALTER TABLE "Vehicle" ADD CONSTRAINT vehicle_seats_chk CHECK ("seatCapacity" BETWEEN 1 AND 80);
ALTER TABLE "RentalBooking" ADD CONSTRAINT rental_distance_chk CHECK ("plannedDistanceMeters" BETWEEN 0 AND 500000);
ALTER TABLE "Review" ADD CONSTRAINT review_rating_chk CHECK (rating BETWEEN 1 AND 5);

-- Same vehicle, overlapping time, active booking => rejected by the database itself.
-- '[)' = start inclusive, end exclusive, so back-to-back bookings are allowed.
ALTER TABLE "RentalBooking" ADD CONSTRAINT rental_no_overlap
  EXCLUDE USING gist ("vehicleId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&)
  WHERE (status IN ('PENDING', 'CONFIRMED', 'ACTIVE'));

-- One bus / tempo cannot be on two overlapping group trips.
ALTER TABLE "GroupAllocation" ADD CONSTRAINT alloc_vehicle_no_overlap
  EXCLUDE USING gist ("vehicleId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&)
  WHERE (active);

-- One driver cannot be on two overlapping group trips.
ALTER TABLE "DriverAssignment" ADD CONSTRAINT driver_no_overlap
  EXCLUDE USING gist ("driverUserId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&)
  WHERE (active);
