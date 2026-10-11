# PULSE GYM — Online Session Booking & Door Check-In System

> **Take-Home Challenge Implementation**  
> A high-concurrency gym session booking system that eliminates overbooking and doorstep arguments through atomic seat reservations, automated FIFO waitlist promotions, and cryptographically unguessable check-in passes.

---

## 1. Design Note (Stack & Data Model)

```text
Stack: Python 3.13 backend (HTTP server with SQLite WAL mode), bcrypt password hashing, HS256 JWT auth, and Vanilla ES6 SPA frontend.
Data Model: Relational SQLite schema with 4 core tables:
- users: Stores credentials, password hashes, and role-based permissions ('member' vs 'admin').
- sessions: 1-hour slots with UNIQUE(date, start_hour) constraint preventing overlapping bookings.
- bookings: Confirmed reservations with unique 6-character unguessable check-in codes.
- waitlist: FIFO standby queue with status ('waiting', 'promoted', 'cancelled') for oversubscribed sessions.
Concurrency: All booking and cancellation operations execute inside SQLite BEGIN IMMEDIATE transactions. This establishes exclusive write locks before reading capacity, making race conditions on the 20th seat mathematically impossible even under simultaneous load.
```

---

## 2. Quick Start & How to Run

### Prerequisites
- Python 3.9+ (Python 3.13 tested)

### 1-Step Installation & Launch
```bash
# Clone the repository
git clone <repo-url>
cd Byte

# (Optional) Install dependencies for bcrypt & pyjwt if not already installed
pip install bcrypt pyjwt

# Run the server (auto-creates database schema and seeds initial test data)
python server.py
```

Open your browser to: **`http://localhost:8000`**

---

## 3. Test Credentials & Demo Data

The database comes pre-seeded with realistic test accounts across multiple days, including an active session right now and a **fully booked session (20/20 seats)** with members waiting in line.

| Role | Name | Email | Password | Pre-configured State |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Gym Administrator | `admin@gympulse.com` | `AdminPass123!` | Created directly in DB; staff check-in & roster management |
| **Member** | Sarah Connor | `sarah@gympulse.com` | `MemberPass123!` | Has active booking right now (Code: `7XKP2Q`) & tomorrow |
| **Member** | Mike Tyson | `mike@gympulse.com` | `MemberPass123!` | **Position #1 on Waitlist** for the full session |
| **Member** | Alex Johnson | `alex@gympulse.com` | `MemberPass123!` | **Position #2 on Waitlist** for the full session |

> 💡 **Quick Persona Switcher:** The top demo bar on the website allows 1-click instant login into any of these personas without typing credentials!

---

## 4. Key Architectural Decisions & Concurrency Defense

### 1. Preventing Race Conditions on the Last Seat (Concurrency)
- **Problem**: When a session has 19/20 seats taken, two members clicking "Book" simultaneously might both read `count = 19`, both proceed, and cause 21 bookings.
- **Solution**: We employ SQLite's `BEGIN IMMEDIATE` transaction mode. SQLite immediately acquires a reserved lock, preventing other write transactions from beginning. The seat count query and insert occur atomically inside this lock. The second request is serialized, sees `count = 20`, and is rejected with `409 Conflict`.
- **Database Index Constraint**: A partial unique index `CREATE UNIQUE INDEX idx_unique_active_booking ON bookings(session_id, user_id) WHERE status = 'confirmed';` ensures a member can never have more than one active booking per session at the database engine level.

### 2. Automated FIFO Waitlist Promotion
- When a member cancels a confirmed booking:
  1. The booking is marked `status = 'cancelled'`.
  2. If `now < session.start_time`:
     - The earliest waitlist entry (`ORDER BY created_at ASC, id ASC LIMIT 1 WHERE status = 'waiting'`) is fetched.
     - A new confirmed booking with a fresh unguessable check-in code is created atomically.
     - The waitlist record is marked `status = 'promoted'`.
  3. **Strict Invariant**: Nobody is promoted into a session that has already started (`now >= session.start_time`).

### 3. Unguessable Door Check-In Codes
- Check-in codes are 6-character strings generated via Python's cryptographic CSPRNG (`secrets.choice`).
- Characters: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (length 6).
- Ambiguous characters (`0`, `O`, `1`, `I`) are omitted to eliminate confusion at the gym door.
- Entropy: $30^6 = 729,000,000$ possible combinations.
- Validation:
  - Valid **once only** (checked-in timestamp recorded).
  - Valid **only during its session's hour** (`start_time <= now <= end_time`).
  - Never valid for cancelled bookings.

---

## 5. Assumptions

As permitted by challenge guidelines:
1. **Gym Opening Hours & Sessions**: Sessions are 1-hour in length and start on the hour (e.g. 09:00 to 10:00). Capacity defaults to 20.
2. **Cancellation Cutoff**: Members can cancel anytime prior to the start time (`now < session.start_time`). Once a session starts, bookings cannot be cancelled.
3. **Check-In Window**: Code redemption is strictly allowed from session start time until session end time (`start_time <= now <= end_time`). Attempting check-in before session start returns `CHECKIN_WINDOW_EARLY (400)`, and after session end returns `CHECKIN_WINDOW_EXPIRED (400)`.
4. **Admin Account Creation**: Admins cannot be created via public registration (`POST /api/auth/register` strictly creates `role='member'`). Admins are created directly in the database or via seed scripts.

---

## 6. Extra Features Added

Beyond the required take-home specification, the following production-grade features were implemented:
1. **High-Contrast QR Code Pass**: Every confirmed ticket renders an SVG QR code. Members can display the QR code at the desk, and admins can scan or read it.
2. **Live Check-In Countdown Timer**: Real-time ticker displaying countdown to check-in window opening, active window remaining time, and expiration.
3. **Live Waitlist Position Tracker**: Members see their exact real-time standby queue position (e.g., *"Position #1 in queue"*).
4. **Instant Persona Switcher Bar**: Switch between Admin, Booked Member, Waitlisted Member, and New Member in 1 click for rapid testing.
5. **Gym Analytics Dashboard**: Admin portal provides real-time statistics on total sessions, confirmed seats, door attendance rate %, and facility capacity utilization %.
6. **Web Audio Synthesizer**: Subtle tactile harmonic chimes on check-in validation and booking confirmation using browser Web Audio API (zero audio file dependencies).
7. **Session Availability Filters**: Filter sessions by date, available seats only, or full sessions.

---

## 7. Running the Automated Test Suite

A comprehensive test suite is provided in `tests/test_api.py`. It tests:
- Multithreaded concurrent booking barrier race condition (5 threads competing for 2 seats).
- Automatic FIFO waitlist queue promotion on cancellation.
- Time-gated check-in validation (early, on-time, expired, duplicate reuse, cancelled).
- RBAC authorization (members blocked from admin routes; ownership checks).
- Consistent JSON error formats across 400, 401, 403, 404, 409, 422 status codes.

```bash
python -m unittest tests/test_api.py
```
Output:
```text
Ran 5 tests in ~7s
OK
```

---

## 8. Deployment (Docker & Cloud Ready)

### Dockerfile
```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir bcrypt pyjwt
EXPOSE 8000
CMD ["python", "-u", "server.py"]
```
Deploy to **Render**, **Railway**, or **Fly.io** with 1 command.
