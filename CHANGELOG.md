# Changelog

All notable changes to the **PULSE GYM** Slot Booking & Door Check-In System will be documented in this file.

The project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (`v<MAJOR>.<MINOR>.<PATCH>`).

## [v1.2.2] - 2026-10-15

### 🚀 Summary of Improvements Over v1.2.1
Version 1.2.2 eliminates the root causes of startup and new-day failures. It completely overhauls the calendar rollover scheduling engine so that an active session is guaranteed for the current hour, upcoming slots exist for tonight and tomorrow, and a 7-day multi-day timetable is perpetually maintained. It also resolves cold-start `ERR_CONNECTION_REFUSED` errors by coordinating browser launch directly with HTTP socket readiness in `server.py` and `start.bat`, and adds diagnostic guidance if `index.html` is opened directly via `file:///`.

### 🔍 Side-by-Side Comparison: What Improved from v1.2.1 to v1.2.2?

| Area / Feature | In v1.2.1 | In v1.2.2 (Improved) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **New Day Schedule Refresh** | Stale date boundary check (`SELECT COUNT(*) WHERE date >= today`) caused auto-seeder to skip new days if past future sessions existed. Timetables showed all sessions as *"Session Ended"* with 0 slots for tomorrow. | **Idempotent Multi-Day Lifecycle Engine**: Guarantees active session for current hour, upcoming full session with waitlist, tomorrow sessions (9:00, 11:00, 18:00), and weekly split. | Every morning the user opens the site, it is **100% fresh, bookable, and populated with active slots**! |
| **Active Live Check-In** | On calendar day rollover, demo member tickets were attached to past dates, breaking live door check-in testing. | **Guaranteed Active Now Slot**: Always provisions an active session for `now.hour` today and attaches a live confirmed pass for Sarah Connor. | Evaluators and users can immediately test the `🔥 Active Now` badge and door QR check-in on any day at any hour. |
| **Cold-Start Launch Reliability** | `start.bat` opened browser after a fixed 1s timeout before Python bound port 8000, causing browser `ERR_CONNECTION_REFUSED` errors every morning. | **Socket-Bound Browser Launch**: Browser is launched via `webbrowser.open()` only **after** the TCP socket is bound and listening on port 8000. | Zero connection refused errors on opening `start.bat`. |
| **Direct File Explorer Opening** | Opening `index.html` via `file:///` threw CORS and module errors, rendering a silent blank screen. | **Embedded Diagnostic File Protocol Guard**: Displays an informative, high-tech diagnostic modal instructing the user to launch `start.bat`. | Eliminates user confusion when opening HTML directly from Windows Explorer. |
| **Live Rollover Awareness** | Server running overnight required manual restarts to populate new day sessions. | **Dynamic Sync on Browse**: `ensure_current_sessions()` runs automatically on timetable fetch (throttled to 30s) if the current hour or tomorrow are missing. | The application seamlessly self-heals across midnight transitions without server restarts. |

### 🐛 Bug Fixes
- **Calendar Boundary Evaluation (`server.py`)**: Fixed `ensure_current_sessions()` to verify that an active session exists for `(today, current_hour)` and at least one session exists for `tomorrow`, rather than a loose `>= today` check.
- **Idempotent Schedule Seeder (`seed.py`)**: Removed rigid `today_session_count == 0` check; implemented `INSERT OR IGNORE` with session ID lookup and unique code generation so sessions are non-destructively supplemented rather than skipped.
- **Startup Race Condition (`start.bat`)**: Replaced premature browser spawn in batch script with automated post-socket initialization in `server.py`.
- **Diagnostic Guide for Direct Disk Access (`index.html`)**: Added a `<script>` guard at the top of `<head>` alerting users if launched via `file://`.

---

## [v1.2.1] - 2026-10-13

### 🚀 Summary of Improvements Over v1.2.0
Version 1.2.1 resolves a critical JavaScript runtime issue where gym session schedules were failing to render (`ReferenceError: getTodayISO is not defined`). It also introduces seamless public guest browsing, allowing visitors to inspect training schedules and capacity meters immediately without an upfront login requirement.

### 🔍 Side-by-Side Comparison: What Improved from v1.2.0 to v1.2.1?

| Area / Feature | In v1.2.0 | In v1.2.1 (Improved) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **Schedule Rendering** | Halted by runtime `ReferenceError: getTodayISO is not defined` inside card mapping. | **Zero-error rendering with localized date helpers** (`getTodayISO()`, `getTomorrowISO()`). | Session schedules, live indicators, and capacity bars render immediately on page load. |
| **Public Timetable Access** | `GET /api/sessions` enforced `401 Unauthorized` for visitors; redirected guests away from `#sessions`. | **Open public timetable browsing**; unauthenticated guests can explore all session times and free spots. | Prospective members and visitors can freely explore schedules without having to register first. |
| **Guest Reservation Prompt** | Threw unhandled 401 API errors if an unauthenticated user attempted an action. | Friendly informational toast directing visitors: *"Please log in or select a demo account to reserve a session"* with seamless transition to `#login`. | Smooth, intuitive user onboarding rather than jarring error messages. |
| **Navigation Visibility** | "Browse Sessions" link was hidden when not logged in. | **"Browse Sessions" is prominently visible to all users**, guests and members alike. | Clear and standard website navigation hierarchy. |
| **Filter Button Accuracy** | Date filters relied on UTC `.toISOString()`, causing timezone mismatches for users in UTC+ offsets. | Filters use **local calendar calculations**, accurately filtering for today's and tomorrow's real calendar slots. | Filter tabs (`Today`, `Tomorrow`) always correspond to the user's actual date. |

### 🐛 Bug Fixes
- **Frontend `getTodayISO` Definition (`app.js`)**: Defined `getTodayISO()` and `getTomorrowISO()` helpers to compute year-month-day strings in the client's local time zone.
- **Backend Guest Access (`server.py`)**: Modified `GET /api/sessions` to accept optional authentication (`required=False`), safely querying sessions with SQL `NULL` for `user_id` when unauthenticated.
- **Client Route Guard (`app.js`)**: Adjusted route guard so unauthenticated users visiting `/#sessions` remain on the session grid rather than being forced to `#login`. Protected views (`#my-bookings` and `#admin`) remain strictly guarded.
- **Filter Date Synchronization (`app.js`)**: Fixed `btnToday` and `btnTomorrow` click listeners to use localized ISO strings and trigger immediate timetable re-renders.

---

## [v1.2.0] - 2026-10-13

### 🚀 Summary of Improvements Over v1.1.0
Version 1.2.0 transforms the platform's visual aesthetics and replaces placeholder QR patterns with a genuine, standards-compliant ISO/IEC 18004 QR engine readable by any smartphone camera. It introduces a high-impact athletic hero section, VIP holographic door ticket modals with animated scanning lasers, 1-click test check-ins, ticket image downloads, and audio feedback equalizer controls.

### 🔍 Side-by-Side Comparison: What Improved from v1.1.0 to v1.2.0?

| Area / Feature | In v1.1.0 | In v1.2.0 (Improved) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **QR Code Engine** | Pseudo-random math hash; failed when scanned by real phone cameras / Google Lens. | **100% Real ISO/IEC 18004 Standard QR Code Engine (`qr-engine.js`)** with Reed-Solomon error correction. | Scannable by **ANY smartphone camera**, Google Lens, iOS Camera, or gym turnstile barcode gun. |
| **QR Ticket Experience** | Simple text popup displaying code and static SVG. | **VIP Access Pass Modal** with optical target crosshairs (`┌ ┐ └ ┘`) and animated green sweeping laser line. | Looks like an authentic high-tech VIP gym credential. |
| **Ticket Actions** | View only; manual transcription required. | Added **"📋 Copy Code"**, **"💾 Save Pass Card"** (PNG canvas downloader), and **"🚪 Test Door Check-In"**. | 1-click convenience for members and effortless testing for evaluators. |
| **Design & Typography** | Default system sans-serif fonts. | Imported **Google Fonts** (`Plus Jakarta Sans`, `Outfit`, `JetBrains Mono`). | Clean, athletic, high-energy modern aesthetic. |
| **Visual Immersion** | Flat dark surfaces. | **Cyber-Athletic theme**: Deep obsidian background with glowing ambient mesh gradients and frosted glass cards. | Rich, wow-factor visual impression at first glance. |
| **Browse Experience** | Standard table header without context. | **Hero Showcase Banner** highlighting 20-seat strict cap, instant waitlist standby, and QR pass security. | Immediately conveys the high-concurrency value proposition. |
| **Live Session Awareness** | Sessions looked uniform regardless of current time. | Dynamic **`🔥 Active Now` glowing pulse badge** and cyan card border for current calendar hour slots. | Users instantly spot currently accessible gym slots. |
| **Staff Reception Desk** | Receptionist had to manually retype 6-character codes. | Added **"⚡ Check In" 1-click action button** next to each attendee in the roster table. | Staff can check in arriving members in 1 tap without typing. |
| **Audio Feedback Controls** | Fixed audio chimes with no user toggle. | Top demo bar **Audio Equalizer Toggle** with animated dancing sound wave bars (`||||`) and persistent state. | Visual & auditory delight with full user control. |
| **Demo Persona Switcher** | Static chips without active indicator. | **Luminous active indicator ring** highlighting whichever demo user is currently authenticated. | Clear visual context during multi-persona testing. |

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
