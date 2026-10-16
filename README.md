# PULSE GYM — Online Session Booking & Door Check-In System

> **Production-Grade Athletic Club Booking & Member Access Engine**  
> A high-concurrency gym session booking system that eliminates overbooking and doorstep congestion through atomic seat reservations, automated FIFO waitlist promotions, and digital member check-in passes.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render-00F076)](https://gym-slot-booking-g7v8.onrender.com)
[![Latest Release](https://img.shields.io/github/v/release/Aakarshan2204/gym-slot-booking?color=10b981&label=Latest%20Version)](https://github.com/Aakarshan2204/gym-slot-booking/releases)
[![Changelog](https://img.shields.io/badge/Changelog-Keep%20a%20Changelog-3b82f6)](CHANGELOG.md)

**Live Website:** [https://gym-slot-booking-g7v8.onrender.com](https://gym-slot-booking-g7v8.onrender.com)

---

## 1. Architecture Overview (Stack & Data Model)

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

### Option A: 1-Click Launch (Windows)
Simply double-click **`start.bat`**.  
It will automatically launch `server.py` and open `http://localhost:8000` in your default browser.

### Option B: Manual Launch (Terminal)
```bash
# Clone the repository
git clone https://github.com/Aakarshan2204/gym-slot-booking.git
cd gym-slot-booking

# (Optional) Install dependencies for bcrypt & pyjwt if not already installed
pip install bcrypt pyjwt

# Run the server (auto-creates database schema and seeds initial test data)
python server.py
```

Open your browser to: **`http://localhost:8000`**

---

## 3. Test Credentials & Demo Accounts

The database comes pre-seeded with realistic member and staff accounts across multiple days, including an active session right now and a **fully booked session (20/20 seats)** with members waiting in line.

| Role | Name | Email | Password | Pre-configured State |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Front Desk Staff | `admin@gympulse.com` | `AdminPass123!` | Staff reception desk check-in & roster management |
| **Member** | Sarah Connor | `sarah@gympulse.com` | `MemberPass123!` | Has active booking right now & tomorrow |
| **Member** | Mike Miller | `mike@gympulse.com` | `MemberPass123!` | **Position #1 on Waitlist** for the full session |
| **Member** | Alex Mercer | `alex@gympulse.com` | `MemberPass123!` | **Position #2 on Waitlist** for the full session |

> **Quick Sign-In Bar:** The header bar provides 1-click test access to pre-configured accounts without manually retyping credentials.

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

## 5. Facility Rules & Operational Parameters

1. **Gym Opening Hours & Sessions**: Small-group training blocks are 1 hour in length, scheduled throughout daytime hours with an optimal 20-athlete facility capacity.
2. **Cancellation Cutoff**: Members can cancel anytime prior to the start time (`now < session.start_time`). Once a session starts, bookings cannot be cancelled to preserve coach planning.
3. **Check-In Window**: Code redemption is strictly allowed from session start time until session end time (`start_time <= now <= end_time`). Attempting check-in before session start returns `CHECKIN_WINDOW_EARLY (400)`, and after session end returns `CHECKIN_WINDOW_EXPIRED (400)`.
4. **Staff Desk Administration**: Reception desk accounts are provisioned directly in the backend (`POST /api/auth/register` creates `role='member'`), preventing unauthorized elevation.

---

## 6. Built-In Member & Administrative Features

1. **Digital Pass Card & QR Engine**: Every confirmed ticket renders a clean, scannable QR code pass. Members can present the pass at reception, save it as a digital card, or display the 6-character code.
2. **Live Check-In Countdown Ticker**: Real-time counter displaying when the reception desk window opens, remaining active time, and completion status.
3. **Standby Queue Tracker**: Members on standby see their exact live position in the queue (e.g., *"Position #1 on Standby"*).
4. **"Meet Your Gym Family" Coaching Showcase**: Highlights certified floor trainers on duty with credentials, form advice, and hourly station badges.
5. **Time-of-Day Community Greeting**: Dynamic greeting banner offering personalized encouragement and rotating daily coach tips.
6. **Front Desk Analytics**: Staff portal provides real-time visibility into active training blocks, confirmed athletes, and door check-in rates.
7. **Session Availability Filters**: Filter timetable by date, available spots, and workout focus.

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
