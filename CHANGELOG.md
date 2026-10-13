# Changelog

All notable changes to the **PULSE GYM** Slot Booking & Door Check-In System will be documented in this file.

The project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (`v<MAJOR>.<MINOR>.<PATCH>`).

---

## [v1.1.0] - 2026-10-13

### 🚀 Summary of Improvements Over v1.0.0
Version 1.1.0 hardens account persistence, automates local startup, and enhances client-side navigation stability. Registered users are now permanent, sessions dynamically refresh as calendar days advance, and 1-click launching is supported via `start.bat`.

### ✨ Added
- **1-Click Server Launcher (`start.bat`)**: Added a Windows batch launcher that automatically opens the default web browser to `http://localhost:8000` and starts `server.py` with cross-runtime support (`py` or `python`).
- **Dynamic Multi-Day Session Refresh (`ensure_current_sessions()`)**: Added automatic detection in `server.py` to check for active sessions on or after today's date. If calendar dates advance, fresh sessions (active check-in slot, full session with waitlist, tomorrow slots) are automatically populated so the gym never appears empty.
- **Version Tracking & Changelog (`CHANGELOG.md`)**: Formalized release notes tracking improvements from version to version.

### 🐛 Fixed
- **Persistent User Accounts in Seeder (`seed.py`)**: Replaced destructive `DELETE FROM users` with a non-destructive `get_or_create_user()` function. User accounts created via registration are now permanently retained across server restarts and date rollovers.
- **Session Hour Collision Safeguard**: Fixed integer hour selection in `seed.py` to prevent duplicate `(date, start_hour)` integrity collisions when seeding late-night sessions.
- **Missing `.hidden` CSS Utility Class (`style.css`)**: Added `.hidden { display: none !important; }` rule, ensuring protected navigation items (`Browse Sessions`, `My Bookings`, `Admin Dashboard`) remain hidden until user logs in.
- **Safe `localStorage` Parsing (`app.js`)**: Wrapped `pulse_user` parsing in try/catch to prevent unhandled `JSON.parse("undefined")` fatal syntax errors on corrupted browser cache.
- **Clean 401 Token Expiration Recovery (`app.js`)**: Updated `apiRequest()` to silently evict expired/stale tokens on 401 responses and transition smoothly to `#login` without flashing scary error banners.

---

## [v1.0.0] - 2026-10-11

### 🚀 Initial Release (Take-Home Challenge Implementation)
- **ACID Concurrency Engine**: Multi-threaded Python server with SQLite WAL mode using `BEGIN IMMEDIATE` exclusive write locks to guarantee a 20-person capacity cap under concurrent load.
- **Cryptographic Security**: Passwords salted and hashed with `bcrypt` (12 rounds); stateless authentication via signed HS256 JWT tokens with role-based access control (`member` vs `admin`).
- **Door Check-In System**: CSPRNG 6-character unguessable passes (entropy $7.29 \times 10^8$) valid once only during the session's 1-hour window.
- **Automated FIFO Waitlist Promotion**: Instant promotion of standby members with check-in pass generation upon booking cancellations before session start.
- **Responsive SPA Frontend**: 4-page single-page application (Auth, Sessions Grid, My Bookings, Admin Desk) operable at 360px viewport with keyboard navigation and WCAG AA contrast.
- **Bonus Capabilities**:
  - Interactive QR code tickets with modal view.
  - Live check-in countdown timer (1s interval ticker).
  - Standby queue position tracker (*"Position #1 in line"*).
  - 1-click Quick Persona Switcher toolbar for rapid evaluation.
  - Gym attendance & capacity analytics dashboard.
  - Web Audio API harmonic sound feedback on door check-in and booking.
- **Automated Test Suite**: 5 comprehensive test suites in `tests/test_api.py` validating race conditions, waitlist queues, time-gated check-ins, and RBAC rules.
