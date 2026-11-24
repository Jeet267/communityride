# RideMate — Carpool, Rentals & 50-Seat Group Trips (≤ 500 km)

Full-stack demo of a mobility platform with five roles: passenger, driver, rental owner, fleet operator and admin.

- **Server:** Node.js · Express · TypeScript · Prisma · PostgreSQL
- **Client:** Next.js 14 with a Gushwork-style UI

> **Demo build: runs WITHOUT Docker.**
> Docker Compose is added in the remaining 4-day plan (see the bottom of this file).

---

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 18.18+ (20 LTS recommended) | `node -v` |
| npm | 9+ | `npm -v` |
| PostgreSQL | 14+ (16 recommended) | `psql --version` |

### PostgreSQL install (Docker ke bina)

- **macOS:**
  ```
  brew install postgresql@16
  brew services start postgresql@16
  ```
- **Ubuntu/Debian:**
  ```
  sudo apt install postgresql
  sudo service postgresql start
  ```
- **Windows:** use the EDB installer from postgresql.org. Remember the password you set for `postgres`, and use "SQL Shell (psql)" for the next step.

### Create DB user + databases (one time)

```bash
# mac:    psql postgres
# ubuntu: sudo -u postgres psql
# windows: SQL Shell (psql), login as postgres
CREATE USER ridemate WITH PASSWORD 'ridemate' CREATEDB;
CREATE DATABASE ridemate OWNER ridemate;
CREATE DATABASE ridemate_test OWNER ridemate;
\q
```

`btree_gist` is created by the migration itself. It ships with Postgres contrib, so it's already present in standard installs.

---

## 2. Run it (step by step)

```bash
# 0) unzip and go to root
cd communityride

# 1) install both workspaces (server + client) in one go
npm install

# 2) server env
cd server
cp .env.example .env
# generate a real encryption key and paste it into ENCRYPTION_KEY in .env:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# also change JWT_ACCESS_SECRET to any 32+ char string

# 3) create tables (+ CHECK and exclusion constraints) and seed demo data
npx prisma migrate deploy
npm run db:seed

# 4) start API → http://localhost:4000  (Swagger: http://localhost:4000/api/docs)
npm run dev
```

In a second terminal:

```bash
cd communityride/client
cp .env.local.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
npm run dev                          # → http://localhost:3000
```

Run the tests from `server/`. They use `ridemate_test` and reset it automatically:

```bash
npm test          # 14 tests: concurrency, 500 km, auth, rental overlap, group capacity
```

**Offline demo?** Set `ROUTING_PROVIDER=mock` in `server/.env`. It estimates road distance as straight-line × 1.3, so Gurugram → Mumbai is still rejected. The default is `osrm`, which calls the public OSRM server for real road distance and needs internet.

### Troubleshooting

| Problem | Fix |
|---|---|
| `P1001 Can't reach database` | Postgres is not running. Start it with `brew services start postgresql@16` or `sudo service postgresql start`. |
| `password authentication failed` | Re-run the `CREATE USER` step, or fix `DATABASE_URL` in `.env`. |
| `extension "btree_gist" is not available` | Ubuntu: `sudo apt install postgresql-contrib`. |
| `ENCRYPTION_KEY` error at startup | It must be exactly 64 hex characters. Generate it with the command above. |
| Ride publish says `DISTANCE_UNAVAILABLE` (503) | There's no internet for OSRM. Use `ROUTING_PROVIDER=mock`. |
| CORS error in browser | `CLIENT_ORIGIN` in `server/.env` must be `http://localhost:3000`. |
| Fresh start needed | Run `npx prisma migrate reset` (this drops all data and re-seeds). |

---

## 3. Demo accounts

OTP is **123456** for every account. This works only for `+91900000xxxx` numbers when `DEMO_OTP` is set. The login page has one-click buttons for each account.

| Phone | Name | Roles | Use it to show |
|---|---|---|---|
| +919000000001 | RideMate Admin | Admin | Verify drivers and vehicles, view private documents |
| +919000000002 | Ravi Sharma | Driver | Publish a ride, accept requests, checklist, start and complete a trip |
| +919000000003 | Priya Verma | Passenger | Search, book seats, pay, cancel, review |
| +919000000004 | Arjun Mehta | Rental owner | Listings, accept, pickup and return with odometer |
| +919000000005 | Shree Travels | Fleet operator | Quote on a group request, allocate bus + tempo, assign drivers |
| +919000000006 | Neha Gupta | Group organizer | 50-passenger request, accept quote, confirm, pay advance, manifest |
| +919000000010 … 12 | Fleet drivers | Driver | Drivers available for group assignments |

---

## 4. Project structure (where every file lives)

```text
communityride/
├── package.json                 # npm workspaces: server + client
├── README.md
├── docs/                        # PRD, architecture, DB, API, plan (+ DEMO_SCRIPT, NEXT_4_DAYS)
│
├── server/                      # Express + TypeScript API
│   ├── .env.example
│   ├── package.json  tsconfig.json  vitest.config.ts
│   ├── prisma/
│   │   ├── schema.prisma        # 18 models: User…Payment, Review, Notification, AuditLog
│   │   ├── seed.ts              # demo users, fleet, rides, rentals, 50-pax group
│   │   └── migrations/
│   │       ├── 20261121000000_init/         # tables, enums, FKs, indexes
│   │       └── 20261121000100_constraints/  # CHECKs + 3 exclusion constraints (btree_gist)
│   ├── src/
│   │   ├── server.ts            # boots HTTP server
│   │   ├── app.ts               # helmet, cors, json limit, requestId, routes, swagger, errors
│   │   ├── routes.ts            # mounts every module router under /api/v1
│   │   ├── config/              # env.ts (Zod-validated env), prisma.ts
│   │   ├── middleware/          # requestId, validate (Zod), auth (JWT + roles), errorHandler
│   │   ├── utils/               # AppError, asyncHandler, response, logger, crypto (AES-GCM), jwt, notify
│   │   ├── docs/openapi.ts      # Swagger generated from the Zod schemas
│   │   └── modules/             # one folder per domain: *.schema.ts, *.service.ts, *.routes.ts
│   │       ├── auth/            # OTP, access + rotating refresh tokens, reuse detection
│   │       ├── users/           # profile, roles
│   │       ├── drivers/         # onboarding, documents, verification gate
│   │       ├── vehicles/        # register, encrypted registration number
│   │       ├── uploads/         # private multer storage (admin-only read)
│   │       ├── admin/           # verifications, approve/reject, audit log
│   │       ├── routing/         # RouteDistanceService: OSRM + mock adapters, 500 km rule
│   │       ├── rides/           # publish/search/cancel, group tours
│   │       ├── bookings/        # atomic seat booking, approve/reject, cancel
│   │       ├── trips/           # checklist, start, complete
│   │       ├── payments/        # mock gateway, idempotency, FULL/ADVANCE/BALANCE
│   │       ├── reviews/         # one review per completed booking
│   │       ├── rentals/         # listings, overlap-safe reservations, pickup/return
│   │       ├── groups/          # state machine, quotes, confirm, manifest
│   │       ├── fleet/           # allocations + driver assignments
│   │       └── notifications/   # in-app notifications written in the same transaction
│   └── tests/                   # Vitest + Supertest against real Postgres
│       ├── setup.ts  helpers.ts
│       ├── booking-concurrency.test.ts   # 2 users, 1 seat → exactly one wins
│       ├── distance.test.ts              # 500 km OK, 501 km → 422
│       ├── auth.test.ts                  # OTP, refresh rotation, reuse ends all sessions
│       ├── rental-overlap.test.ts        # overlapping dates → 409
│       └── group-capacity.test.ts        # 50 pax / 48 seats → confirm blocked
│
└── client/                      # Next.js 14 (App Router) + Tailwind + TanStack Query
    ├── .env.local.example
    ├── tailwind.config.ts       # Gushwork tokens: canvas, line, ink, muted, route blue
    └── src/
        ├── app/
        │   ├── layout.tsx  providers.tsx  globals.css  page.tsx (landing)  not-found.tsx
        │   ├── login/                     # OTP login + demo account buttons
        │   ├── rides/  rides/[id]/  rides/new/
        │   ├── bookings/                  # pay, cancel, review
        │   ├── driver/  driver/onboarding/
        │   ├── vehicles/
        │   ├── rentals/  rentals/[id]/  rentals/new/  rentals/manage/
        │   ├── groups/  groups/new/  groups/[id]/
        │   ├── fleet/  fleet/groups/[id]/
        │   ├── tours/
        │   └── admin/
        ├── components/
        │   ├── ui.tsx                     # Button, Card, Field, Badge, Tabs, Spinner…
        │   ├── layout/                    # AnnouncementBar, Navbar, Footer, RequireAuth, NotificationBell
        │   ├── landing/                   # RouteDemo, GroupSection, Services, StickyCta, Avatars
        │   ├── rides/                     # PlaceInput, RideCard
        │   └── groups/                    # CapacityMeter, AllocationBoard
        └── lib/                           # api (single-flight refresh), auth, format, cities, groups, rentals, upload
```

---

## 5. Engineering highlights (interview talking points)

- **No overselling.** The seat booking is one conditional `UPDATE … SET availableSeats = availableSeats - n WHERE availableSeats >= n` inside a transaction. A test fires concurrent requests for the last seat, and exactly one succeeds.
- **No rental double-booking, enforced by the database.** A Postgres exclusion constraint (`btree_gist`, `tsrange '[)'`) covers active rental bookings. The same mechanism stops a bus or driver being assigned to two overlapping group trips.
- **50 people never "confirmed" on 48 seats.** The group state machine runs `OPEN_FOR_QUOTES → QUOTE_ACCEPTED → ALLOCATED → CONFIRMED` (or `CANCELLED`). It takes a `SELECT … FOR UPDATE` row lock and re-checks seats and verified drivers when confirming. The UI always shows partial capacity, e.g. "47 of 50 seated · 3 more seats needed".
- **500 km rule on the server.** Road distance comes from the OSRM adapter, and the browser's distance is never trusted. Exactly 500,000 m is accepted, and a DB CHECK adds a second guard. If the provider fails, the API fails closed with 503.
- **Auth:**
  - 15-minute JWT access token.
  - Rotating refresh tokens, stored as SHA-256 hashes. Reusing an old token ends every session for that user.
  - OTP attempts are capped, and OTP requests are rate-limited per phone and per IP.
- **Payments:** amounts are integer paise, and `Idempotency-Key` makes retries safe. Group trips are paid 30% advance, then the balance.
- **PII:** registration numbers and contacts are encrypted with AES-256-GCM. Documents are stored privately and readable only through an admin route.
- **Errors:** one error envelope everywhere: `{ success, error: { code, message, fieldErrors }, meta: { requestId } }`.

---

## 6. What is NOT in the 3-day demo (honest scope)

| Not in the demo | What the demo uses instead |
|---|---|
| Docker | Postgres runs locally |
| Redis / BullMQ | OTPs live in memory; notifications are written in the same transaction (outbox style) |
| Real payment gateway | A mock payment provider |
| Shared-cab matching | Not built yet |
| AI / RAG assistant | Not built yet |
| S3 document storage | Documents are stored on local disk |

All of these are planned in `docs/NEXT_4_DAYS.md`.

- Demo walkthrough: `docs/DEMO_SCRIPT.md`
- Remaining 4 days (Docker Compose and the rest): `docs/NEXT_4_DAYS.md`
