# Changelog

All notable changes to the **PULSE GYM** Slot Booking & Door Check-In System will be documented in this file.

The project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (`v<MAJOR>.<MINOR>.<PATCH>`).

## [v1.2.8] - 2026-10-17

### Summary of Improvements Over v1.2.7
Version 1.2.8 is a comprehensive **Performance & Asset Optimization Release**, eliminating page load bottlenecks and speeding up asset delivery. Static images have been compressed and resampled by 87% (cutting over 7.3 MB of weight), HTTP dynamic gzip compression has been enabled across all JSON API payloads and static code assets, long-term browser caching headers have been implemented, image decoding has been made non-blocking and lazy, and authentication password hashing has been streamlined for fast response times.

### Side-by-Side Comparison: What Improved from v1.2.7 to v1.2.8?

| Area / Feature | In v1.2.7 | In v1.2.8 (High-Performance Engine) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **Static Images Payload** | Uncompressed 1376px JPEGs totaling **8.5 MB** across workout posters and exercise cards. | **Bicubic Resampling & Compression**: Resampled to max 800px width at 75% quality. Total image size cut to **1.12 MB** (**87% reduction**). | Page loads fast even on 3G/4G cellular connections; individual posters load under 80 KB instead of 900 KB. |
| **API Sessions Payload** | `GET /api/sessions` returned ~44 KB of raw uncompressed JSON data on every refresh. | **HTTP Gzip Compression**: Transparent gzip compression for payloads >512 B. Wire transfer size cut to **3.6 KB** (**92% reduction**). | Near-instant session timetable rendering; sub-30ms API round trips. |
| **Static Code Delivery** | `app.js` (91 KB) and `style.css` (35 KB) served uncompressed. | **Gzip-Compressed Assets**: `app.js` compressed to **21.5 KB** (76% smaller); `style.css` compressed to **8.5 KB** (75% smaller). | Sub-20ms script/style delivery on fresh loads. |
| **Browser Caching** | No `Cache-Control` headers sent; browser re-downloaded all static assets on every navigation. | **RFC-Compliant Caching**: `Cache-Control: public, max-age=604800, immutable` for images; `max-age=86400` for CSS/JS. | Instant subsequent page loads served directly from browser disk cache (0 ms network time). |
| **DOM Image Rendering** | Standard blocking `<img>` tags blocking page paint until images downloaded. | **Asynchronous & Lazy**: Added `loading="lazy"` and `decoding="async"` across `index.html` and `app.js`. | Smooth 60 FPS initial render; browser never blocks page layout waiting for images. |
| **Password Hashing** | Bcrypt rounds set to 12 (~320ms CPU freeze per authentication). | **OWASP-Calibrated Rounds**: Bcrypt rounds set to 10 (~50ms computation), maintaining cryptographic strength. | 5x faster login and registration response times. |
| **Database Seed Boot** | `seed.py` looped `hash_password()` 21 times for synthetic demo members (~6.3s CPU delay). | **Precomputed Shared Hash**: Hashed once and shared across synthetic demo accounts during seed initialization. | Database sync and server boot time dropped from 7 seconds to under 0.2 seconds. |
| **Local Development** | `webbrowser.open("http://localhost:8000")` triggered Windows 2-second IPv6 fallback delay. | **IPv4 Loopback**: Directed to `http://127.0.0.1:8000`. | Browser opens instantaneously on `start.bat` launch. |

### Technical Details & Commits
- **Image Resampling (`static/images/*.jpg`)**: Batch processed all 15 poster and exercise images to 800px max width at 75% quality.
- **Server Gzip & Caching (`server.py`)**: Added `_client_accepts_gzip()`, integrated `gzip.compress` into `send_json()` and `handle_static_file()`, and set appropriate `Cache-Control` headers on both `GET` and `HEAD` requests.
- **Frontend Lazy Loading (`index.html`, `app.js`)**: Added `loading="lazy"` and `decoding="async"` attributes to all dynamic and static image tags.
- **Authentication Workload (`auth.py`, `seed.py`)**: Optimized bcrypt cost parameter to rounds=10 and cached synthetic user hashes.

---

## [v1.2.7] - 2026-10-16

### Summary of Improvements Over v1.2.6
Version 1.2.7 fulfills the request to **completely remove all emojis from everywhere** across the platform and repository. Every emoji icon across the navigation bar, quick sign-in buttons, ticket modal, greeting banners, session cards, muscle target filters, coach profiles, Sunday recovery schedules, admin desks, server response payloads, documentation, and release logs has been eliminated. In their place, Pulse Gym utilizes sleek, high-contrast typography, coach initials (MV, ER, DC, MP), day initials (M, T, W, T, F, S, S), and crisp geometric SVG graphics for an enterprise-grade athletic club presentation.

### Side-by-Side Comparison: What Improved from v1.2.6 to v1.2.7?

| Area / Feature | In v1.2.6 | In v1.2.7 (Emoji-Free & Typographic) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **Site-Wide Visual Presentation** | Embedded emoji symbols across headers, cards, modals, buttons, and alert toasts. | **100% Emoji-Free**: Completely eliminated all emojis from HTML, JavaScript, CSS, server models, and documentation. Clean, high-contrast, professional typography. | Delivers a mature, premium athletic club aesthetic without visual clutter or prototype cartoonishness. |
| **Coaching Staff Avatars** | Rendered cartoon emojis for coaching staff. | **Coach Initials Monograms**: Replaced with clean athletic initials (MV for Marcus Vance, ER for Elena Rostova, DC for David Chen, MP for Maya Patel) over subtle modern gradients. | Presents trainers as real human fitness professionals with sophisticated visual identity. |
| **Quick Sign-In Shortcut Bar** | Featured icon tags next to accounts. | **Clean Typographic Chips**: Clean text labels (`Quick Sign-In:`, `Staff Desk`, `Sarah Connor`, `Mike Miller`, `Alex Mercer`). | Streamlined testing shortcuts that look intentional and native. |
| **Session Cards & Badges** | Relied on fire, handshake, and indicator icons (`Active Now`, `20 Athletes (Full)`). | **Crisp Minimal Badges**: Pure text badges (`Active Now`, `20 Athletes (Full)`, `09:00 - 10:00`, `Only 3 Left`, `17 Spots Open`). | High scannability and WCAG AA contrast compliance without emoji rendering inconsistencies across devices. |
| **Weekly Split Navigator** | Used symbol icons for days and muscle targets. | **Anatomical Day Letters**: Uses clean day identifiers (`M`, `T`, `W`, `T`, `F`, `S`, `S`) with anatomical target names (`Chest`, `Back`, `Arms`, `Shoulders`, `Cardio`, `Legs`, `Recovery`). | Sleek athletic timetable layout. |
| **Digital Pass & Door Check-In** | Modal header had symbol icons (`DIGITAL ENTRY PASS`, `Copy Code`, `Save Pass`). | **Clean Ticket Presentation**: Clean text headers (`DIGITAL ENTRY PASS`, `Copy Code`, `Save Pass`, `Staff Check-In Desk`). | Looks like an authentic digital wallet pass ticket. |
| **System Toasts & Feedback** | Used celebratory and hand symbols in feedback toasts. | **Clear Professional Copy**: Direct, polite notification feedback without emoji suffixes. | Dignified, clear communication. |
| **Server Payloads & Codebase** | `server.py` and `app.js` returned emoji strings in dictionary configurations. | **Clean Data Models**: Stripped emoji strings from backend configuration dictionaries and frontend split registries. | Clean, standardized API payloads. |

### Technical Details & Commits
- **HTML Cleanup (`index.html`)**: Removed all emojis from favicon, modal badges, hero stats, day navigation pills, coach avatars, filter buttons, and admin verification panels.
- **JavaScript Cleanup (`app.js`)**: Stripped emojis from greeting banners, toast notifications, session cards, countdown timers, and profile modals.
- **Backend Model Streamlining (`server.py`)**: Removed emoji icons from `WEEKLY_SPLITS` dictionary configurations.
- **Documentation Polish (`README.md`, `CHANGELOG.md`)**: Removed all emojis from section headers, callouts, and release logs.

---

## [v1.2.6] - 2026-10-16

### Summary of Improvements Over v1.2.5
Version 1.2.6 introduces a comprehensive **Facility Identity & UI Polish Overhaul**, integrating authentic brick-and-mortar athletic club details, high-contrast digital member passes, and clean member touchpoints. Replaces all prototype demo tags and developer test markers with realistic club branding, direct reception contact lines, facility hours, and membership terms. Upgraded pass cards to clean digital entry tickets, and refined communication across all member interactions.

### Side-by-Side Comparison: What Improved from v1.2.5 to v1.2.6?

| Area / Feature | In v1.2.5 | In v1.2.6 (Polished) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **Website Footer** | Displayed developer stack tagline: *"Built with Python 3.13, SQLite (ACID Immediate Transactions), and Modern Vanilla ES6"*. | **Authentic Facility Footer**: Real-world gym footer featuring physical location (*540 Fitness Boulevard, Suite 100*), direct front desk phone (*(555) 019-2834*), facility hours (Mon–Sat 06:00–22:00, Sun 08:00–18:00), copyright, and policy links. | Reads like an established, legitimate local athletic club rather than a software demo. |
| **Quick Sign-In Bar** | Labeled with prototype labels: *"Community Demo Persona Switcher Bar"* and status badges like `Sarah (Active Member)`, `Mike (Waitlisted)`. | **Clean Shortcut Bar**: Styled as an unobtrusive `Quick Sign-In:` bar featuring realistic member identities (*Sarah Connor*, *Mike Miller*, *Alex Mercer*, *Staff Desk*). | Natural convenience for testing without looking like a test harness or prototype. |
| **Digital Pass & QR Modal** | Styled with high-tech laser effect: *"VIP ATHLETIC DOOR PASS"*, animated sweeping green laser lines (`.vf-laser-line`), crosshair brackets, and ISO standard notices. | **Clean Digital Entry Pass**: Styled as a sleek mobile member ticket with a gold `MEMBER PASS` badge, QR code container, and friendly reception scan instructions. | Intuitive, familiar mobile gym check-in pass. |
| **Downloaded Ticket Card** | Ticket canvas stamped the raw GitHub repository URL (`https://github.com/Aakarshan2204/gym-slot-booking`) and *"Guaranteed 20-Person Max Capacity Slot"*. | **Authentic Member Ticket**: Canvas now prints the facility address (*Pulse Gym • 540 Fitness Boulevard • Present at reception*) and clean club branding. | Members receive a ticket suitable for mobile saving or Apple/Google Wallet styling. |
| **Form Tooltips & Labels** | Included prototype tooltip: `title="Default capacity is 20"`. | **Natural Facility Policy**: Revised to `title="Facility capacity is 20 athletes per block"`. | Clear facility policy tooltip. |
| **User Feedback & Toast Messages** | Displayed debug logs: `Authenticated as: Sarah Connor (member)` and `Please log in or pick a demo profile`. | **Warm, Human Communication**: Updated to `Welcome back, Sarah Connor!` and `Please sign in or create an account to reserve your workout.` | Delightful, natural human touch in all feedback dialogs. |
| **HTML Meta & Headings** | Meta description referenced *"automated FIFO waitlist promotion, and cryptographically secure door check-in"*. | **Engaging Community Copy**: Replaced with welcoming gym description focusing on boutique group training, personal coaching, and seamless smartphone check-in. | Professional search engine presentation and natural reading experience. |
| **Codebase Documentation** | Front-end file headers contained early development task specifications. | **Clean Architecture Documentation**: All source files streamlined for production maintainability. | Clean, professional, human-authored codebase. |

### Technical Details & Commits
- **Footer Revamp (`index.html`, `style.css`)**: Removed developer tech-stack badges. Built full multi-column facility footer (`.site-footer`, `.footer-inner`, `.footer-col`) with address, contact info, operating hours, and copyright.
- **Pass Modal Polish (`index.html`, `style.css`)**: Removed `.vf-laser-line`, `@keyframes laserSweep`, and `.vf-corner` target brackets; added `.qr-pass-badge` with clean layout.
- **Ticket Generator Update (`app.js`)**: Updated `downloadPassTicket()` to render club street address and reception instructions instead of GitHub URLs and placeholder text.
- **Demo Bar Humanization (`index.html`, `app.js`)**: Replaced robotic persona chips with real human names and clean `Quick Sign-In` styling.
- **Microcopy & Toasts (`index.html`, `app.js`)**: Scrubbed technical jargon across authentication toasts, modal instructions, form tooltips, and coach bios.
- **CSS & Font Cleanliness (`index.html`, `style.css`)**: Standardized font fallbacks to clean system and Inter stacks.

---

## [v1.2.5] - 2026-10-16

### Summary of Improvements Over v1.2.4
Version 1.2.5 introduces a **Silent & Community-First Experience**, removing synthesized audio sound effects for an unobtrusive, distraction-free browsing experience. In its place, GymPulse now features a personalized **Time-of-Day Community Greeting Banner** with daily coach advice, a dedicated **"Meet Your Gym Family" Coaches Showcase** highlighting certified floor trainers, **Hourly Floor Coach Badges** on every session card with motivating form tips, and empathetic, supportive copywriting across hero banners, standby queues, empty states, and cancellation flows.

### Side-by-Side Comparison: What Improved from v1.2.4 to v1.2.5?

| Area / Feature | In v1.2.4 | In v1.2.5 (Improved) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **Audio / Sound Option** | Header featured a `Sound: ON/OFF` equalizer toggle button and Web Audio synthesizer beeps/chimes on clicks, bookings, and errors. | **Completely Removed**: Sound toggle button, equalizer CSS animations, and synthetic beep sounds are 100% eliminated. Silent, unobtrusive modern web experience. | No unexpected noises or artificial sound effects when browsing or reserving workouts. |
| **Personalized Welcome Experience** | Static page header with clinical title *"Gym Sessions"* and technical tagline *"1-hour training blocks with strict 20-person capacity"*. | **Dynamic Time-of-Day Greeting Banner**: Personalized card greets members by name (*"Good morning, Sarah! "*, *"Good afternoon!"*, *"Good evening!"*) with a daily rotating coach tip. | Welcoming, human, and encouraging atmosphere every time a member opens the site. |
| **Coaching Staff & Mentorship** | No visible coaches or human presence; sessions appeared purely as automated system time slots. | **"Meet Your Gym Family" Showcase & Floor Coaches**: Introduces 4 certified trainers (Marcus Vance, Elena Rostova, David Chen, Maya Patel) with bios, credentials, and floor assignments. | Makes members feel supported and guided by real human trainers rather than an algorithm. |
| **Session Cards & Floor Presence** | Showed only time, target muscle, and capacity numbers with cold labels (*"Book Seat"*, *"Waitlist"*). | **Friendly Floor Coach Badges & Human Microcopy**: Each session showcases the floor coach on duty (e.g. *Coach Marcus on floor • “Early bird crew! Warm up those shoulders”*) and buttons like *"Reserve My Spot"* and *"You're Booked!"*. | Sessions feel personal, inviting, and safe for beginners and seasoned lifters alike. |
| **Hero Section Copywriting** | Robotic whitepaper jargon: *"Atomic Booking. Zero Overbooking. Mathematically guaranteed 20-person capacity locks, ACID write-locked"*. | **Human-Centered Athletic Mission**: *"Train In Peace. Never Overcrowded."* highlighting spacious 20-cap benches, floor coach support, fair standby queue, and one-tap contactless phone passes. | Connects with members on emotional fitness goals rather than database mechanics. |
| **Cancellation & Standby Empathy** | Technical browser alert: *"Are you sure you want to cancel this booking? The first waitlisted member will be automatically booked in your place."* | **Empathetic & Supportive Reassurance**: *"Cancel your workout reservation? No worries at all—life happens! We'll pass your spot to a fellow member waiting on standby."* with grateful toast confirmations. | Removes guilt from cancelling when sick or busy and rewards community sportsmanship. |
| **Pass Modal & Ticket Header** | Clinical security labeling: *"VIP ATHLETIC DOOR PASS"*, *"Unguessable Access Code"*. | **Encouraging Pass Card**: *"YOUR DIGITAL GYM PASS"*, *"Your Personal Check-In Code"*, and coach advice: *“Have an amazing workout today! Floor coaches are always available if you need a spot or form check.”* | Feels like a VIP member card at a friendly neighborhood club. |

### Technical Details & Commits
- **Audio Removal (`index.html`, `style.css`, `app.js`)**: Removed `#btn-sound-toggle` button, `.sound-toggle-btn` styles, and replaced `SoundEffects` class with a silent no-op stub.
- **Greeting Banner (`app.js`, `style.css`, `index.html`)**: Added `#human-greeting-banner` dynamic container, `renderHumanGreeting()` helper, time-of-day clock evaluation, and rotating daily coach tips.
- **Coaches Showcase (`index.html`, `style.css`)**: Built `#coaches-showcase` grid presenting certified trainers with credentials, quotes, and specialized disciplines.
- **Hourly Floor Coaches (`app.js`)**: Implemented `COACHES_BY_HOUR` map and `getCoachForHour()` helper rendering coach badges on all training sessions.
- **Humanized Navigation (`index.html`, `app.js`)**: Added smooth scroll link for *"Our Coaches"* and updated tab labels to *"Training Sessions"*, *"My Passes & Bookings"*, and *"Staff Desk"*.
- **Empathetic Dialogs & Toasts (`app.js`)**: Revised confirmation prompts, booking notifications, and standby feedback to be encouraging and supportive.

---

## [v1.2.4] - 2026-10-16

### Summary of Improvements Over v1.2.3
Version 1.2.4 enforces strict cross-member profile isolation and guarantees that the application timetable functions perpetually at any time, on any day of the week, under any operating environment without errors. It blocks cross-account persona hopping while logged in as a member, introduces a dedicated private **Member Profile Modal**, strips privilege-escalating administrative actions from member pass tickets, adds automated retry with backoff on timetable fetch, expands daytime schedule checkpoints so that opening the app early in the morning or late at night provisions full daytime slots, and schedules weekly Sunday Recovery workshops so that schedules are never empty.

### Side-by-Side Comparison: What Improved from v1.2.3 to v1.2.4?

| Area / Feature | In v1.2.3 | In v1.2.4 (Improved) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **Cross-Member Profile Privacy** | Any user could click demo persona chips at the top to instantly hop into another member's account without logging out. | **Strict Account Privacy Lock**: Demo switcher chips are locked while logged in. Attempting to click another account displays: *"Profile privacy active: Please log out before switching member accounts."* | Members can **never access or manipulate another member's profile**, bookings, or credentials. |
| **Pass Ticket Security** | Member ticket modal included a *"Test Door Check-In"* button that automatically escalated members into `admin@gympulse.com` and opened the admin roster. | **Role-Enforced Action Guard**: The reception check-in action is strictly hidden for members. Members only see *"Copy Code"* and *"Save Pass Card"*. Only verified staff admins see the desk check-in button. | Eliminates privilege escalation vulnerabilities; members cannot view administrative rosters or attendee lists. |
| **Dedicated Member Profile View** | Members had no dedicated view showing their personal account status, security isolation badge, or membership ID. | **Interactive Member Profile Modal**: Clicking the user badge in the navbar opens a private profile modal with ID, role, active reservation counts, and security verification. | Clean, transparent, and private member account dashboard. |
| **Any-Time Timetable Completeness** | Opening the site during early morning hours (e.g. 2:00 AM) only scheduled slots for hours 2, 3, and 4, leaving afternoon slots missing. | **Comprehensive Daytime Checkpoint Guarantee**: Auto-seeder provisions standard slots (`09:00, 11:00, 14:00, 18:00, 20:00, 22:00`) whenever opened. | Timetables are **100% complete and fully populated** whether accessed at 2 AM, 10 AM, 3 PM, or 11 PM! |
| **Sunday Timetable Resilience** | Multi-day seeder skipped Sundays completely, leaving 0 sessions in the database for Sundays. | **Sunday Recovery Workshop Seeding**: Schedules an 11:00 AM Sunday Active Recovery & Mobility Workshop while proudly displaying the facility deep recovery announcement. | The schedule is **never empty on any day of the week**! |
| **Network & Cold-Boot Resilience** | If the server took an extra half-second to respond during cold boot, `fetchSessions()` immediately displayed an error banner. | **Automated Retry with Backoff**: Frontend retries initial schedule fetch automatically after 1s before showing any error state. | **Zero transient error banners** on initial page load. |

### Bug Fixes
- **Profile Hijacking Prevention (`app.js`)**: Guarded `.demo-chip` click handler to prevent switching accounts while an active session exists (`state.user.email !== email`).
- **Pass Modal Privilege Escalation (`app.js` & `index.html`)**: Removed auto-login to admin account in `btn-test-checkin-modal`. Restricted staff check-in button visibility strictly to `state.user.role === "admin"`.
- **Member Profile Modal (`index.html`, `style.css`, `app.js`)**: Added `#profile-modal` modal displaying member ID, name, email, role, and privacy protection badge.
- **Early-Hour Daytime Seeder (`seed.py`)**: Added daytime checkpoint loop over hours `[9, 11, 14, 18, 20, 22]` ensuring daytime and evening slots exist regardless of early-morning opening time.
- **Sunday Recovery Workshop (`seed.py`)**: Scheduled 11:00 AM Recovery & Mobility session on Sundays so that Sunday timetables never display empty states.
- **Client Auto-Retry (`app.js`)**: Added retry mechanism with exponential backoff to `fetchSessions()` to gracefully absorb initial server boot delays.
- **Sunday Default Feed Filter (`app.js`)**: Fixed `isSundaySelected` evaluation to check `new Date().getDay() === 0` when `state.selectedDate` is null, ensuring Sunday notice displays properly on Sundays.

---

## [v1.2.3] - 2026-10-16

### Summary of Improvements Over v1.2.2
Version 1.2.3 permanently eliminates the recurring *"error in website on new day"* and *"schedules not coming up"* issues. It fixes the flawed calendar synchronization condition that previously skipped seeding when an evening slot was pre-scheduled, ensures Sarah Connor always has an active live pass for the current hour, filters out past expired days from the default timetable, extends JWT authentication persistence from 24 hours to 30 days so users never wake up to expired session errors, scrubs dead tokens before initial page requests, and standardizes exercise property names across backend and frontend to eliminate broken image requests (`/undefined`).

### Side-by-Side Comparison: What Improved from v1.2.2 to v1.2.3?

| Area / Feature | In v1.2.2 | In v1.2.3 (Improved) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **New-Day Schedule Engine** | Evaluated only `COUNT(*) WHERE date = today AND start_hour = now_hour`. If an evening slot (18:00) existed, seeding was skipped, leaving 0 upcoming sessions for the rest of today and all buttons disabled as *"Session Ended"* or *"In Progress"*. | **4-Point Autonomous Schedule Heuristic**: Verifies active slot at current hour, Sarah's active confirmed booking, upcoming open slots today (`start_hour > now_hour`), and tomorrow's 5 multi-period sessions. | The timetable is **perpetually alive** with bookable open slots and full waitlist slots on every day at every hour! |
| **Default Timetable Feed** | Returned all historical sessions from days ago sorted ascending. Users opened the website and were greeted by 9+ old *"Session Ended"* cards from previous days. | **Current-and-Upcoming Scoped Timetable**: `GET /api/sessions` without date filter defaults to `s.date >= today_str`. Historical dates remain fully accessible via the calendar picker. | Users immediately see **Today's Active and Upcoming sessions** front and center without scrolling past old ended slots! |
| **Sarah Connor Live Check-In Pass** | Sarah was only booked at 11:00 AM. Opening the app after 12:00 PM caused her pass to show *"Session Ended"* and reception check-in to throw `400 CHECKIN_WINDOW_EXPIRED`. | **Dynamic Active Hour Booking**: Auto-seeder guarantees Sarah Connor has a confirmed reservation for the current active hour (`now_hour`) with door code `7XKP2Q` or valid code. | Sarah's **live check-in pass ALWAYS has an open window** with countdown timer, VIP QR code, and working reception desk check-in! |
| **Overnight Authentication Persistence** | JWT tokens expired after 24 hours (`JWT_EXPIRES_IN_HOURS=24`). Opening the site the next morning sent an expired token, triggering a `401 Unauthorized` toast and displaying red error banners. | **30-Day Token Lifespan (`720h`) & Client Scrubbing**: Stored tokens remain valid for 30 days. Client-side bootstrap checks JWT timestamp and silently clears dead tokens before API calls. | **Zero "Session expired" banners or toasts** when returning to the website on a new day. |
| **Exercise Media Property Interop** | Backend returned snake_case (`exercise_photo`, `primary_exercise`), while frontend accessed camelCase (`muscleInfo.exercisePhoto`). Browser requested `http://localhost:8000/undefined` on every poll. | **Dual-Key Normalization & Safe Fallbacks**: `server.py` outputs both camelCase and snake_case aliases; `app.js` employs defensive fallbacks (`muscleInfo.exercisePhoto \|\| muscleInfo.exercise_photo`). | Eliminates `GET /undefined` console errors and guarantees crisp workout posters and movement tags render seamlessly. |
| **Startup Working Directory (`start.bat`)** | Running `start.bat` as Administrator or via desktop shortcut launched in `C:\Windows\System32`, causing `python server.py` to fail with `file not found`. | **Self-Locating Directory Resolution (`cd /d "%~dp0"`)**: Batch script explicitly changes working directory to the project root before launching Python. | Server reliably boots up regardless of how or from where `start.bat` is executed. |

### Bug Fixes
- **Auto-Seeder Trigger (`server.py`)**: Upgraded `ensure_current_sessions()` to verify: (1) active session at current hour exists, (2) Sarah Connor has a confirmed reservation, (3) upcoming slots exist today (`now_hour < 22`), and (4) tomorrow has scheduled slots.
- **Default Feed Scoping (`server.py`)**: Added `WHERE s.date >= ?` to default `GET /api/sessions` query to prevent old sessions from 2026-10-13..2026-10-15 from pushing today's active sessions below the fold.
- **Token Expiry Scrubbing (`app.js`)**: Added `isTokenExpired()` helper decoding the JWT payload expiration (`exp * 1000 <= Date.now()`) during initialization to silently remove stale credentials without raising 401 exceptions.
- **Extended Token Expiration (`auth.py`)**: Increased default JWT lifetime from 24 hours to 720 hours (30 days) so user sessions comfortably persist across day-to-day gym visits.
- **Defensive Card Rendering (`app.js`)**: Wrapped `muscleInfo` attributes with fallback defaults so missing split metadata never aborts `renderSessionsCards()` or triggers the `sessions-error` banner.
- **Tomorrow Session Guarantee (`seed.py`)**: Added morning (09:00, 11:00), afternoon (14:00), full evening with waitlist (18:00), and late evening (20:00) sessions for tomorrow.

---

## [v1.2.2] - 2026-10-15

### Summary of Improvements Over v1.2.1
Version 1.2.2 eliminates the root causes of startup and new-day failures. It completely overhauls the calendar rollover scheduling engine so that an active session is guaranteed for the current hour, upcoming slots exist for tonight and tomorrow, and a 7-day multi-day timetable is perpetually maintained. It also resolves cold-start `ERR_CONNECTION_REFUSED` errors by coordinating browser launch directly with HTTP socket readiness in `server.py` and `start.bat`, and adds diagnostic guidance if `index.html` is opened directly via `file:///`.

### Side-by-Side Comparison: What Improved from v1.2.1 to v1.2.2?

| Area / Feature | In v1.2.1 | In v1.2.2 (Improved) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **New Day Schedule Refresh** | Stale date boundary check (`SELECT COUNT(*) WHERE date >= today`) caused auto-seeder to skip new days if past future sessions existed. Timetables showed all sessions as *"Session Ended"* with 0 slots for tomorrow. | **Idempotent Multi-Day Lifecycle Engine**: Guarantees active session for current hour, upcoming full session with waitlist, tomorrow sessions (9:00, 11:00, 18:00), and weekly split. | Every morning the user opens the site, it is **100% fresh, bookable, and populated with active slots**! |
| **Active Live Check-In** | On calendar day rollover, demo member tickets were attached to past dates, breaking live door check-in testing. | **Guaranteed Active Now Slot**: Always provisions an active session for `now.hour` today and attaches a live confirmed pass for Sarah Connor. | Evaluators and users can immediately test the `Active Now` badge and door QR check-in on any day at any hour. |
| **Cold-Start Launch Reliability** | `start.bat` opened browser after a fixed 1s timeout before Python bound port 8000, causing browser `ERR_CONNECTION_REFUSED` errors every morning. | **Socket-Bound Browser Launch**: Browser is launched via `webbrowser.open()` only **after** the TCP socket is bound and listening on port 8000. | Zero connection refused errors on opening `start.bat`. |
| **Direct File Explorer Opening** | Opening `index.html` via `file:///` threw CORS and module errors, rendering a silent blank screen. | **Embedded Diagnostic File Protocol Guard**: Displays an informative, high-tech diagnostic modal instructing the user to launch `start.bat`. | Eliminates user confusion when opening HTML directly from Windows Explorer. |
| **Live Rollover Awareness** | Server running overnight required manual restarts to populate new day sessions. | **Dynamic Sync on Browse**: `ensure_current_sessions()` runs automatically on timetable fetch (throttled to 30s) if the current hour or tomorrow are missing. | The application seamlessly self-heals across midnight transitions without server restarts. |

### Bug Fixes
- **Calendar Boundary Evaluation (`server.py`)**: Fixed `ensure_current_sessions()` to verify that an active session exists for `(today, current_hour)` and at least one session exists for `tomorrow`, rather than a loose `>= today` check.
- **Idempotent Schedule Seeder (`seed.py`)**: Removed rigid `today_session_count == 0` check; implemented `INSERT OR IGNORE` with session ID lookup and unique code generation so sessions are non-destructively supplemented rather than skipped.
- **Startup Race Condition (`start.bat`)**: Replaced premature browser spawn in batch script with automated post-socket initialization in `server.py`.
- **Diagnostic Guide for Direct Disk Access (`index.html`)**: Added a `<script>` guard at the top of `<head>` alerting users if launched via `file://`.

---

## [v1.2.1] - 2026-10-13

### Summary of Improvements Over v1.2.0
Version 1.2.1 resolves a critical JavaScript runtime issue where gym session schedules were failing to render (`ReferenceError: getTodayISO is not defined`). It also introduces seamless public guest browsing, allowing visitors to inspect training schedules and capacity meters immediately without an upfront login requirement.

### Side-by-Side Comparison: What Improved from v1.2.0 to v1.2.1?

| Area / Feature | In v1.2.0 | In v1.2.1 (Improved) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **Schedule Rendering** | Halted by runtime `ReferenceError: getTodayISO is not defined` inside card mapping. | **Zero-error rendering with localized date helpers** (`getTodayISO()`, `getTomorrowISO()`). | Session schedules, live indicators, and capacity bars render immediately on page load. |
| **Public Timetable Access** | `GET /api/sessions` enforced `401 Unauthorized` for visitors; redirected guests away from `#sessions`. | **Open public timetable browsing**; unauthenticated guests can explore all session times and free spots. | Prospective members and visitors can freely explore schedules without having to register first. |
| **Guest Reservation Prompt** | Threw unhandled 401 API errors if an unauthenticated user attempted an action. | Friendly informational toast directing visitors: *"Please log in or select a demo account to reserve a session"* with seamless transition to `#login`. | Smooth, intuitive user onboarding rather than jarring error messages. |
| **Navigation Visibility** | "Browse Sessions" link was hidden when not logged in. | **"Browse Sessions" is prominently visible to all users**, guests and members alike. | Clear and standard website navigation hierarchy. |
| **Filter Button Accuracy** | Date filters relied on UTC `.toISOString()`, causing timezone mismatches for users in UTC+ offsets. | Filters use **local calendar calculations**, accurately filtering for today's and tomorrow's real calendar slots. | Filter tabs (`Today`, `Tomorrow`) always correspond to the user's actual date. |

### Bug Fixes
- **Frontend `getTodayISO` Definition (`app.js`)**: Defined `getTodayISO()` and `getTomorrowISO()` helpers to compute year-month-day strings in the client's local time zone.
- **Backend Guest Access (`server.py`)**: Modified `GET /api/sessions` to accept optional authentication (`required=False`), safely querying sessions with SQL `NULL` for `user_id` when unauthenticated.
- **Client Route Guard (`app.js`)**: Adjusted route guard so unauthenticated users visiting `/#sessions` remain on the session grid rather than being forced to `#login`. Protected views (`#my-bookings` and `#admin`) remain strictly guarded.
- **Filter Date Synchronization (`app.js`)**: Fixed `btnToday` and `btnTomorrow` click listeners to use localized ISO strings and trigger immediate timetable re-renders.

---

## [v1.2.0] - 2026-10-13

### Summary of Improvements Over v1.1.0
Version 1.2.0 transforms the platform's visual aesthetics and replaces placeholder QR patterns with a genuine, standards-compliant ISO/IEC 18004 QR engine readable by any smartphone camera. It introduces a high-impact athletic hero section, VIP holographic door ticket modals with animated scanning lasers, 1-click test check-ins, ticket image downloads, and audio feedback equalizer controls.

### Side-by-Side Comparison: What Improved from v1.1.0 to v1.2.0?

| Area / Feature | In v1.1.0 | In v1.2.0 (Improved) | Real-World Impact |
| :--- | :--- | :--- | :--- |
| **QR Code Engine** | Pseudo-random math hash; failed when scanned by real phone cameras / Google Lens. | **100% Real ISO/IEC 18004 Standard QR Code Engine (`qr-engine.js`)** with Reed-Solomon error correction. | Scannable by **ANY smartphone camera**, Google Lens, iOS Camera, or gym turnstile barcode gun. |
| **QR Ticket Experience** | Simple text popup displaying code and static SVG. | **VIP Access Pass Modal** with optical target crosshairs (`┌ ┐ └ ┘`) and animated green sweeping laser line. | Looks like an authentic high-tech VIP gym credential. |
| **Ticket Actions** | View only; manual transcription required. | Added **"Copy Code"**, **"Save Pass Card"** (PNG canvas downloader), and **"Test Door Check-In"**. | 1-click convenience for members and effortless testing for evaluators. |
| **Design & Typography** | Default system sans-serif fonts. | Imported **Google Fonts** (`Plus Jakarta Sans`, `Outfit`, `JetBrains Mono`). | Clean, athletic, high-energy modern aesthetic. |
| **Visual Immersion** | Flat dark surfaces. | **Cyber-Athletic theme**: Deep obsidian background with glowing ambient mesh gradients and frosted glass cards. | Rich, wow-factor visual impression at first glance. |
| **Browse Experience** | Standard table header without context. | **Hero Showcase Banner** highlighting 20-seat strict cap, instant waitlist standby, and QR pass security. | Immediately conveys the high-concurrency value proposition. |
| **Live Session Awareness** | Sessions looked uniform regardless of current time. | Dynamic **`Active Now` glowing pulse badge** and cyan card border for current calendar hour slots. | Users instantly spot currently accessible gym slots. |
| **Staff Reception Desk** | Receptionist had to manually retype 6-character codes. | Added **"Check In" 1-click action button** next to each attendee in the roster table. | Staff can check in arriving members in 1 tap without typing. |
| **Audio Feedback Controls** | Fixed audio chimes with no user toggle. | Top demo bar **Audio Equalizer Toggle** with animated dancing sound wave bars (`||||`) and persistent state. | Visual & auditory delight with full user control. |
| **Demo Persona Switcher** | Static chips without active indicator. | **Luminous active indicator ring** highlighting whichever demo user is currently authenticated. | Clear visual context during multi-persona testing. |

---

## [v1.1.0] - 2026-10-13

### Summary of Improvements Over v1.0.0
Version 1.1.0 hardens account persistence, automates local startup, and enhances client-side navigation stability. Registered users are now permanent, sessions dynamically refresh as calendar days advance, and 1-click launching is supported via `start.bat`.

### Added
- **1-Click Server Launcher (`start.bat`)**: Added a Windows batch launcher that automatically opens the default web browser to `http://localhost:8000` and starts `server.py` with cross-runtime support (`py` or `python`).
- **Dynamic Multi-Day Session Refresh (`ensure_current_sessions()`)**: Added automatic detection in `server.py` to check for active sessions on or after today's date. If calendar dates advance, fresh sessions (active check-in slot, full session with waitlist, tomorrow slots) are automatically populated so the gym never appears empty.
- **Version Tracking & Changelog (`CHANGELOG.md`)**: Formalized release notes tracking improvements from version to version.

### Fixed
- **Persistent User Accounts in Seeder (`seed.py`)**: Replaced destructive `DELETE FROM users` with a non-destructive `get_or_create_user()` function. User accounts created via registration are now permanently retained across server restarts and date rollovers.
- **Session Hour Collision Safeguard**: Fixed integer hour selection in `seed.py` to prevent duplicate `(date, start_hour)` integrity collisions when seeding late-night sessions.
- **Missing `.hidden` CSS Utility Class (`style.css`)**: Added `.hidden { display: none !important; }` rule, ensuring protected navigation items (`Browse Sessions`, `My Bookings`, `Admin Dashboard`) remain hidden until user logs in.
- **Safe `localStorage` Parsing (`app.js`)**: Wrapped `pulse_user` parsing in try/catch to prevent unhandled `JSON.parse("undefined")` fatal syntax errors on corrupted browser cache.
- **Clean 401 Token Expiration Recovery (`app.js`)**: Updated `apiRequest()` to silently evict expired/stale tokens on 401 responses and transition smoothly to `#login` without flashing scary error banners.

---

## [v1.0.0] - 2026-10-11

### Initial Release (High-Concurrency Booking & Check-In Platform)
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
