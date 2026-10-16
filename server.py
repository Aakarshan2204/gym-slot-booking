"""
Gym Slot Booking System - Backend HTTP Server & REST API.
Built with Python 3.13 standard library (ThreadingHTTPServer) + SQLite with WAL mode.
Provides rock-solid concurrency handling, strict authorization guards, and consistent JSON responses.
"""

import os
import re
import json
import mimetypes
import datetime
from http import HTTPStatus
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Dict, Any, Optional, Tuple

from database import get_db, immediate_transaction, init_db
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    generate_check_in_code,
    validate_registration_input,
)

PORT = int(os.environ.get("PORT", 8000))
HOST = os.environ.get("HOST", "127.0.0.1")
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# ============================================================================
# Weekly Muscle Split & Training Program Configuration
# ============================================================================
TRAINING_SPLIT = {
    "Monday": {
        "day": "Monday",
        "muscle": "Chest",
        "badge": "Chest Day",
        "tagline": "Pectoral Hypertrophy & Upper Body Power",
        "icon": "",
        "color": "#00F076",
        "poster": "/images/poster_chest.jpg",
        "exercise_photo": "/images/exercise_chest.jpg",
        "primary_exercise": "Flat Barbell Bench Press",
        "exercises": [
            {"name": "Flat Barbell Bench Press", "sets": "4 Sets x 8-10 Reps", "note": "Explosive press, controlled 3-second negative descent"},
            {"name": "Incline Dumbbell Press", "sets": "3 Sets x 10-12 Reps", "note": "Target upper clavicular pectoral head at 30° incline"},
            {"name": "Cable Standing Chest Flyes", "sets": "3 Sets x 12-15 Reps", "note": "Constant tension with full peak contraction at center"},
            {"name": "Weighted Dips / Pushups", "sets": "3 Sets to Failure", "note": "Lean torso forward 15° to recruit lower pecs"}
        ],
        "target_muscles": ["Pectoralis Major", "Pectoralis Minor", "Anterior Deltoids", "Triceps Brachii"],
        "intensity": "Very High (85-90% 1RM)",
        "estimated_burn": "520 - 680 kcal",
        "is_holiday": False
    },
    "Tuesday": {
        "day": "Tuesday",
        "muscle": "Back",
        "badge": "Back Day",
        "tagline": "V-Taper Lat Width, Trap Density & Spine Stability",
        "icon": "",
        "color": "#38bdf8",
        "poster": "/images/poster_back.jpg",
        "exercise_photo": "/images/exercise_back.jpg",
        "primary_exercise": "Bent-Over Barbell Rows",
        "exercises": [
            {"name": "Conventional Deadlifts", "sets": "4 Sets x 5-6 Reps", "note": "Full posterior chain drive with neutral spine lock"},
            {"name": "Bent-Over Barbell Rows", "sets": "4 Sets x 8-10 Reps", "note": "Pull to lower sternum, flare elbows slightly"},
            {"name": "Wide-Grip Lat Pulldowns", "sets": "3 Sets x 10-12 Reps", "note": "Drive elbows down and back for maximum lat stretch"},
            {"name": "Seated Cable Rows", "sets": "3 Sets x 12-15 Reps", "note": "Squeeze rhomboids and middle traps for 2 seconds"}
        ],
        "target_muscles": ["Latissimus Dorsi", "Trapezius", "Rhomboids", "Erector Spinae"],
        "intensity": "Extreme (90% 1RM)",
        "estimated_burn": "580 - 750 kcal",
        "is_holiday": False
    },
    "Wednesday": {
        "day": "Wednesday",
        "muscle": "Biceps and Triceps",
        "badge": "Biceps & Triceps",
        "tagline": "Arm Hypertrophy & Antagonist Super-Sets",
        "icon": "",
        "color": "#c084fc",
        "poster": "/images/poster_arms.jpg",
        "exercise_photo": "/images/exercise_arms.jpg",
        "primary_exercise": "Standing Dumbbell Bicep Curls",
        "exercises": [
            {"name": "Standing Dumbbell Bicep Curls", "sets": "4 Sets x 10-12 Reps", "note": "Strict supination at top of movement with zero body swing"},
            {"name": "Cable Tricep Rope Pushdowns", "sets": "4 Sets x 12-15 Reps", "note": "Spread ropes at bottom to lock out tricep lateral head"},
            {"name": "Incline Dumbbell Hammer Curls", "sets": "3 Sets x 10-12 Reps", "note": "Build brachialis and forearm thickness"},
            {"name": "EZ-Bar Skull Crushers", "sets": "3 Sets x 10-12 Reps", "note": "Lower behind head to emphasize triceps long head"}
        ],
        "target_muscles": ["Biceps Brachii", "Triceps Brachii", "Brachialis", "Forearm Flexors"],
        "intensity": "High (Hypertrophy / High Volume)",
        "estimated_burn": "450 - 580 kcal",
        "is_holiday": False
    },
    "Thursday": {
        "day": "Thursday",
        "muscle": "Shoulders",
        "badge": "Shoulders Day",
        "tagline": "3D Deltoid Caps & Overhead Power",
        "icon": "",
        "color": "#fbbf24",
        "poster": "/images/poster_shoulders.jpg",
        "exercise_photo": "/images/exercise_shoulders.jpg",
        "primary_exercise": "Seated Dumbbell Shoulder Press",
        "exercises": [
            {"name": "Seated Overhead Dumbbell Press", "sets": "4 Sets x 8-10 Reps", "note": "Full range of motion, press slightly inward at lockout"},
            {"name": "Dumbbell Lateral Raises", "sets": "4 Sets x 12-15 Reps", "note": "Lead with elbows for targeted lateral delt isolation"},
            {"name": "Rear Delt Face Pulls", "sets": "3 Sets x 15 Reps", "note": "External rotation at finish for healthy rotator cuffs"},
            {"name": "Barbell Shrugs", "sets": "3 Sets x 12 Reps", "note": "Controlled vertical contraction of upper trapezius"}
        ],
        "target_muscles": ["Anterior Deltoids", "Lateral Deltoids", "Posterior Deltoids", "Rotator Cuffs"],
        "intensity": "High (Strength & Shape)",
        "estimated_burn": "480 - 620 kcal",
        "is_holiday": False
    },
    "Friday": {
        "day": "Friday",
        "muscle": "Cardio",
        "badge": "Cardio & HIIT",
        "tagline": "Cardiovascular Endurance, V02 Max & Fat Oxidation",
        "icon": "",
        "color": "#f43f5e",
        "poster": "/images/poster_cardio.jpg",
        "exercise_photo": "/images/exercise_cardio.jpg",
        "primary_exercise": "Curved Treadmill Interval Sprints",
        "exercises": [
            {"name": "Woodway Curved Treadmill Sprints", "sets": "8 Rounds x 30s Sprint / 30s Rest", "note": "Maximum anaerobic wattage and posterior propulsion"},
            {"name": "Assault Fan Bike Tabata", "sets": "6 Rounds x 20s Max / 10s Low", "note": "Total body metabolic output and oxygen depletion"},
            {"name": "Concept2 Rowing Ergometer", "sets": "5 x 500m Intervals", "note": "Keep stroke rate at 28-30 spm with powerful hip drive"},
            {"name": "High-Speed Battle Ropes & Box Jumps", "sets": "4 Sets x 45s", "note": "Core stability, agility and explosive fast-twitch endurance"}
        ],
        "target_muscles": ["Heart & Lungs (VO2 Max)", "Calves & Hamstrings", "Core & Diaphragm"],
        "intensity": "Maximum (Heart Rate Zone 4 - 5)",
        "estimated_burn": "650 - 900 kcal",
        "is_holiday": False
    },
    "Saturday": {
        "day": "Saturday",
        "muscle": "Legs",
        "badge": "Legs Day",
        "tagline": "Quad Sweeps, Hamstring Power & Glute Strength",
        "icon": "",
        "color": "#a3e635",
        "poster": "/images/poster_legs.jpg",
        "exercise_photo": "/images/exercise_legs.jpg",
        "primary_exercise": "Heavy Barbell Back Squats",
        "exercises": [
            {"name": "Barbell Back Squats", "sets": "5 Sets x 6-8 Reps", "note": "Deep hip crease below parallel, drive through whole foot"},
            {"name": "Romanian Deadlifts (RDLs)", "sets": "4 Sets x 8-10 Reps", "note": "Hinge at hips for deep hamstring stretch and glute recruitment"},
            {"name": "Leg Press Machine", "sets": "4 Sets x 10-12 Reps", "note": "High foot placement for glutes or close stance for quad sweep"},
            {"name": "Standing Calf Raises", "sets": "4 Sets x 15-20 Reps", "note": "Full 2-second stretch at bottom and 1-second peak flex"}
        ],
        "target_muscles": ["Quadriceps", "Hamstrings", "Gluteus Maximus", "Gastrocnemius"],
        "intensity": "Brutal (Heavy Compound Lifting)",
        "estimated_burn": "650 - 850 kcal",
        "is_holiday": False
    },
    "Sunday": {
        "day": "Sunday",
        "muscle": "Holiday / Rest Day",
        "badge": "Gym Holiday - Rest & Recovery",
        "tagline": "Active Recovery, Central Nervous System Reset & Nutrition",
        "icon": "",
        "color": "#38bdf8",
        "poster": "/images/poster_sunday_rest.jpg",
        "exercise_photo": "/images/exercise_sunday_rest.jpg",
        "primary_exercise": "Foam Rolling, Mobility & Hydration",
        "exercises": [
            {"name": "Full Body Myofascial Foam Rolling", "sets": "15-20 Minutes", "note": "Target tight IT bands, lats, thoracic spine and calves"},
            {"name": "Dynamic Mobility & Hip Openers", "sets": "10-15 Minutes", "note": "Improve joint lubrication and prepare body for Monday"},
            {"name": "Gentle 30-min Outdoor Walk", "sets": "Zone 1 Aerobic", "note": "Flush metabolic waste without inducing fatigue"},
            {"name": "Electrolyte Hydration & High-Protein Meal Prep", "sets": "All Day", "note": "Replenish muscle glycogen and repair microtears"}
        ],
        "target_muscles": ["Central Nervous System (CNS)", "Connective Tissue", "Mind & Spirit"],
        "intensity": "Restorative (Active Recovery & Rest)",
        "estimated_burn": "Maintenance Baseline",
        "is_holiday": True
    }
}

def get_muscle_target_for_date(date_str: str) -> Dict[str, Any]:
    """Resolves date string (YYYY-MM-DD) to its specific muscle group, posters, and exercises."""
    try:
        dt = datetime.date.fromisoformat(date_str)
        day_name = dt.strftime("%A")
        raw = dict(TRAINING_SPLIT.get(day_name, TRAINING_SPLIT["Monday"]))
    except Exception:
        raw = dict(TRAINING_SPLIT["Monday"])

    # Provide both camelCase and snake_case keys for seamless frontend interop
    raw["exercisePhoto"] = raw.get("exercise_photo")
    raw["primaryExercise"] = raw.get("primary_exercise")
    raw["targetMuscles"] = raw.get("target_muscles", [])
    raw["estimatedBurn"] = raw.get("estimated_burn")
    raw["isHoliday"] = raw.get("is_holiday", False)
    return raw

class APIError(Exception):
    """Custom API exception for structured error responses."""
    def __init__(self, status: int, error: str, message: str, code: str = "ERROR", details: Any = None):
        super().__init__(message)
        self.status = status
        self.error = error
        self.message = message
        self.code = code
        self.details = details

    def to_dict(self) -> Dict[str, Any]:
        resp = {
            "error": self.error,
            "message": self.message,
            "code": self.code,
            "status": self.status
        }
        if self.details is not None:
            resp["details"] = self.details
        return resp

class GymRequestHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler implementing the Gym Booking REST API and static asset delivery."""

    def log_message(self, format, *args):
        # Clean logging format
        print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {self.command} {self.path} - {args[1] if len(args) > 1 else ''}")

    # ==========================
    # CORS & Response Helpers
    # ==========================
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.end_headers()

    def send_json(self, data: Any, status: int = 200):
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status: int, error: str, message: str, code: str = "ERROR", details: Any = None):
        err = APIError(status, error, message, code, details)
        self.send_json(err.to_dict(), status=status)

    def read_json_body(self) -> Dict[str, Any]:
        content_length = self.headers.get("Content-Length")
        if not content_length:
            return {}
        try:
            length = int(content_length)
            raw = self.rfile.read(length).decode("utf-8")
            if not raw.strip():
                return {}
            return json.loads(raw)
        except json.JSONDecodeError:
            raise APIError(400, "Bad Request", "Malformed JSON payload.", "INVALID_JSON")
        except Exception as e:
            raise APIError(400, "Bad Request", f"Could not read request body: {str(e)}", "INVALID_BODY")

    # ==========================
    # Auth Middleware
    # ==========================
    def get_current_user(self, required: bool = True) -> Optional[Dict[str, Any]]:
        auth_header = self.headers.get("Authorization")
        if not auth_header:
            if required:
                raise APIError(401, "Unauthorized", "Authentication token is missing.", "AUTH_MISSING")
            return None
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            if required:
                raise APIError(401, "Unauthorized", "Invalid authorization header format. Expected 'Bearer <token>'.", "AUTH_INVALID_FORMAT")
            return None
        token = parts[1]
        payload = decode_access_token(token)
        if not payload:
            if required:
                raise APIError(401, "Unauthorized", "Invalid or expired token. Please log in again.", "AUTH_INVALID_TOKEN")
            return None

        # Verify user still exists in database
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, email, role FROM users WHERE id = ?", (payload["user_id"],))
            user = cursor.fetchone()
            if not user:
                if required:
                    raise APIError(401, "Unauthorized", "User associated with this token no longer exists.", "USER_NOT_FOUND")
                return None
            return dict(user)

    def require_admin(self) -> Dict[str, Any]:
        user = self.get_current_user(required=True)
        if user["role"] != "admin":
            raise APIError(403, "Forbidden", "Admin privilege required for this resource.", "FORBIDDEN_NOT_ADMIN")
        return user

    def do_HEAD(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            if path == "/" or not path:
                path = "/index.html"
            clean_path = os.path.normpath(path.lstrip("/"))
            file_path = os.path.join(STATIC_DIR, clean_path)
            if not os.path.isfile(file_path):
                file_path = os.path.join(STATIC_DIR, "index.html")
            if os.path.isfile(file_path):
                mime_type, _ = mimetypes.guess_type(file_path)
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", mime_type or "text/html")
                self.send_header("Content-Length", str(os.path.getsize(file_path)))
                self._send_cors_headers()
                self.end_headers()
            else:
                self.send_error_json(404, "Not Found", "File not found.", "STATIC_NOT_FOUND")
        except Exception:
            self.send_error_json(500, "Internal Server Error", "Server error", "SERVER_ERROR")

    # ==========================
    # Router Entry Points
    # ==========================
    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            query = parse_qs(parsed.query)

            if path.startswith("/api/"):
                self.handle_api_get(path, query)
            else:
                self.handle_static_file(path)
        except APIError as e:
            self.send_error_json(e.status, e.error, e.message, e.code, e.details)
        except Exception as e:
            # Global error handler: never leak raw stack traces, log to console
            print(f"[ERROR 500] Unexpected error: {repr(e)}")
            self.send_error_json(500, "Internal Server Error", "An unexpected server error occurred.", "SERVER_ERROR")

    def do_POST(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            query = parse_qs(parsed.query)

            if path.startswith("/api/"):
                self.handle_api_post(path, query)
            else:
                self.send_error_json(404, "Not Found", "Endpoint not found", "NOT_FOUND")
        except APIError as e:
            self.send_error_json(e.status, e.error, e.message, e.code, e.details)
        except Exception as e:
            print(f"[ERROR 500] Unexpected error: {repr(e)}")
            self.send_error_json(500, "Internal Server Error", "An unexpected server error occurred.", "SERVER_ERROR")

    def do_DELETE(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            query = parse_qs(parsed.query)

            if path.startswith("/api/"):
                self.handle_api_delete(path, query)
            else:
                self.send_error_json(404, "Not Found", "Endpoint not found", "NOT_FOUND")
        except APIError as e:
            self.send_error_json(e.status, e.error, e.message, e.code, e.details)
        except Exception as e:
            print(f"[ERROR 500] Unexpected error: {repr(e)}")
            self.send_error_json(500, "Internal Server Error", "An unexpected server error occurred.", "SERVER_ERROR")

    # ==========================
    # Static File Delivery
    # ==========================
    def handle_static_file(self, path: str):
        if path == "/" or not path:
            path = "/index.html"

        # Sanitize path to prevent directory traversal
        clean_path = os.path.normpath(path.lstrip("/"))
        if clean_path.startswith("static" + os.sep) or clean_path == "static":
            clean_path = clean_path[len("static"):].lstrip(os.sep)
        elif clean_path.startswith("static/"):
            clean_path = clean_path[len("static/"):].lstrip("/")
        file_path = os.path.join(STATIC_DIR, clean_path)

        if not os.path.isfile(file_path):
            # Fallback to index.html for Single-Page Application client routing
            file_path = os.path.join(STATIC_DIR, "index.html")

        if os.path.isfile(file_path):
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = "text/plain"
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", f"{mime_type}; charset=utf-8" if "text" in mime_type or "javascript" in mime_type else mime_type)
            self.send_header("Content-Length", str(len(content)))
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_error_json(404, "Not Found", "File not found.", "STATIC_NOT_FOUND")

    # ==========================
    # API Routes Implementation
    # ==========================
    def handle_api_get(self, path: str, query: Dict[str, list]):
        # Public: Demo accounts list
        if path == "/api/auth/demo-accounts":
            self.send_json({
                "accounts": [
                    {"role": "admin", "email": "admin@gympulse.com", "password": "AdminPass123!", "label": "Admin (Gym Staff)"},
                    {"role": "member", "email": "sarah@gympulse.com", "password": "MemberPass123!", "label": "Sarah Connor (Member with Bookings)"},
                    {"role": "member", "email": "mike@gympulse.com", "password": "MemberPass123!", "label": "Mike Tyson (Member on Waitlist)"},
                    {"role": "member", "email": "alex@gympulse.com", "password": "MemberPass123!", "label": "Alex Johnson (New Member)"}
                ]
            })
            return

        # Protected: Current user profile
        if path == "/api/auth/me":
            user = self.get_current_user(required=True)
            self.send_json({"user": user})
            return

        # Browse sessions (publicly accessible, personalized if authenticated)
        if path == "/api/sessions":
            user = self.get_current_user(required=False)
            user_id = user["id"] if user else None
            date_filter = query.get("date", [None])[0]
            sessions = self._get_sessions_list(user_id, date_filter)
            self.send_json({"sessions": sessions})
            return

        # Protected: Member's own bookings and waitlist entries
        if path == "/api/my-bookings":
            user = self.get_current_user(required=True)
            data = self._get_user_bookings_and_waitlist(user["id"])
            self.send_json(data)
            return

        # Admin: Get session roster
        roster_match = re.match(r"^/api/admin/sessions/(\d+)/roster$", path)
        if roster_match:
            self.require_admin()
            session_id = int(roster_match.group(1))
            roster = self._get_session_roster(session_id)
            self.send_json(roster)
            return

        # Admin: Stats analytics
        if path == "/api/admin/stats":
            self.require_admin()
            stats = self._get_admin_stats()
            self.send_json(stats)
            return

        # Weekly training split & daily muscle targets
        if path == "/api/training-split":
            self.send_json({
                "split": TRAINING_SPLIT,
                "order": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            })
            return

        raise APIError(404, "Not Found", f"Route {path} not found.", "ROUTE_NOT_FOUND")

    def handle_api_post(self, path: str, query: Dict[str, list]):
        # 1. Register
        if path == "/api/auth/register":
            body = self.read_json_body()
            name = (body.get("name") or "").strip()
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""

            val_err = validate_registration_input(name, email, password)
            if val_err:
                raise APIError(422, "Unprocessable Entity", val_err, "VALIDATION_FAILED")

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
                if cursor.fetchone():
                    raise APIError(409, "Conflict", "A user with this email address already exists.", "EMAIL_ALREADY_EXISTS")

                pw_hash = hash_password(password)
                # Registration is strictly member role
                cursor.execute(
                    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'member')",
                    (name, email, pw_hash)
                )
                user_id = cursor.lastrowid
                conn.commit()

            token = create_access_token(user_id, email, "member")
            self.send_json({
                "token": token,
                "user": {
                    "id": user_id,
                    "name": name,
                    "email": email,
                    "role": "member"
                }
            }, status=201)
            return

        # 2. Login
        if path == "/api/auth/login":
            body = self.read_json_body()
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""

            if not email or not password:
                raise APIError(400, "Bad Request", "Email and password are required.", "CREDENTIALS_REQUIRED")

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, email, password_hash, role FROM users WHERE email = ?", (email,))
                user_row = cursor.fetchone()

            if not user_row or not verify_password(password, user_row["password_hash"]):
                raise APIError(401, "Unauthorized", "Invalid email or password.", "INVALID_CREDENTIALS")

            token = create_access_token(user_row["id"], user_row["email"], user_row["role"])
            self.send_json({
                "token": token,
                "user": {
                    "id": user_row["id"],
                    "name": user_row["name"],
                    "email": user_row["email"],
                    "role": user_row["role"]
                }
            }, status=200)
            return

        # 3. Admin creates session
        if path == "/api/sessions":
            admin = self.require_admin()
            body = self.read_json_body()
            date_str = (body.get("date") or "").strip()
            start_hour = body.get("start_hour")
            capacity = body.get("capacity", 20)

            # Validate date format YYYY-MM-DD
            if not date_str or not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
                raise APIError(422, "Unprocessable Entity", "Valid date format YYYY-MM-DD is required.", "INVALID_DATE")

            try:
                dt_date = datetime.date.fromisoformat(date_str)
            except ValueError:
                raise APIError(422, "Unprocessable Entity", "Invalid calendar date provided.", "INVALID_CALENDAR_DATE")

            # Validate start_hour 0-23
            if start_hour is None or not isinstance(start_hour, int) or start_hour < 0 or start_hour > 23:
                raise APIError(422, "Unprocessable Entity", "start_hour must be an integer between 0 and 23.", "INVALID_START_HOUR")

            # Compute start and end ISO timestamps
            start_dt = datetime.datetime(dt_date.year, dt_date.month, dt_date.day, start_hour, 0, 0)
            end_dt = start_dt + datetime.timedelta(hours=1)

            # Rule: Sessions start on the hour and last one hour. Two cannot share a start time.
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id FROM sessions WHERE date = ? AND start_hour = ?",
                    (date_str, start_hour)
                )
                if cursor.fetchone():
                    raise APIError(409, "Conflict", f"A session already exists at {start_hour:02d}:00 on {date_str}. Two sessions cannot share a start time.", "TIME_SLOT_COLLISION")

                cursor.execute(
                    """INSERT INTO sessions (date, start_hour, start_time, end_time, capacity, created_by)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (date_str, start_hour, start_dt.isoformat(), end_dt.isoformat(), capacity, admin["id"])
                )
                session_id = cursor.lastrowid
                conn.commit()

            self.send_json({
                "message": "Session created successfully.",
                "session": {
                    "id": session_id,
                    "date": date_str,
                    "start_hour": start_hour,
                    "start_time": start_dt.isoformat(),
                    "end_time": end_dt.isoformat(),
                    "capacity": capacity
                }
            }, status=201)
            return

        # 4. Member books session: POST /api/sessions/{id}/book
        book_match = re.match(r"^/api/sessions/(\d+)/book$", path)
        if book_match:
            user = self.get_current_user(required=True)
            session_id = int(book_match.group(1))
            booking = self._execute_book_session(user["id"], session_id)
            self.send_json({
                "message": "Session booked successfully!",
                "booking": booking
            }, status=201)
            return

        # 5. Member joins waitlist: POST /api/sessions/{id}/waitlist
        waitlist_match = re.match(r"^/api/sessions/(\d+)/waitlist$", path)
        if waitlist_match:
            user = self.get_current_user(required=True)
            session_id = int(waitlist_match.group(1))
            result = self._execute_join_waitlist(user["id"], session_id)
            self.send_json({
                "message": "Joined waitlist successfully!",
                "waitlist": result
            }, status=201)
            return

        # 6. Admin check-in code redemption: POST /api/admin/check-in
        if path == "/api/admin/check-in":
            self.require_admin()
            body = self.read_json_body()
            code = (body.get("code") or "").strip().upper()
            if not code:
                raise APIError(422, "Unprocessable Entity", "Check-in code is required.", "CODE_REQUIRED")

            result = self._execute_admin_check_in(code)
            self.send_json({
                "message": "Member successfully marked present!",
                "check_in": result
            }, status=200)
            return

        # 7. Cancel booking via POST (convenience endpoint alongside DELETE)
        cancel_post_match = re.match(r"^/api/bookings/(\d+)/cancel$", path)
        if cancel_post_match:
            user = self.get_current_user(required=True)
            booking_id = int(cancel_post_match.group(1))
            res = self._execute_cancel_booking(user, booking_id)
            self.send_json(res, status=200)
            return

        raise APIError(404, "Not Found", f"Route {path} not found.", "ROUTE_NOT_FOUND")

    def handle_api_delete(self, path: str, query: Dict[str, list]):
        user = self.get_current_user(required=True)

        # Cancel booking: DELETE /api/bookings/{id}
        booking_del_match = re.match(r"^/api/bookings/(\d+)$", path)
        if booking_del_match:
            booking_id = int(booking_del_match.group(1))
            res = self._execute_cancel_booking(user, booking_id)
            self.send_json(res, status=200)
            return

        # Leave waitlist: DELETE /api/waitlist/{id} or DELETE /api/sessions/{session_id}/waitlist
        waitlist_del_match = re.match(r"^/api/waitlist/(\d+)$", path)
        if waitlist_del_match:
            waitlist_id = int(waitlist_del_match.group(1))
            res = self._execute_leave_waitlist(user, waitlist_id=waitlist_id)
            self.send_json(res, status=200)
            return

        session_waitlist_del_match = re.match(r"^/api/sessions/(\d+)/waitlist$", path)
        if session_waitlist_del_match:
            session_id = int(session_waitlist_del_match.group(1))
            res = self._execute_leave_waitlist(user, session_id=session_id)
            self.send_json(res, status=200)
            return

        raise APIError(404, "Not Found", f"Route {path} not found.", "ROUTE_NOT_FOUND")

    # ===================================================
    # Core Domain Logic & Concurrency-Safe Operations
    # ===================================================
    def _get_sessions_list(self, user_id: Optional[int], date_filter: Optional[str]) -> list:
        """Retrieves sessions with live remaining seat counts and user booking states."""
        ensure_current_sessions()
        now_iso = datetime.datetime.now().isoformat()
        with get_db() as conn:
            cursor = conn.cursor()
            query = """
                SELECT 
                    s.id, s.date, s.start_hour, s.start_time, s.end_time, s.capacity,
                    (SELECT COUNT(*) FROM bookings b WHERE b.session_id = s.id AND b.status = 'confirmed') as confirmed_count,
                    (SELECT COUNT(*) FROM waitlist w WHERE w.session_id = s.id AND w.status = 'waiting') as waitlist_count,
                    (SELECT b.id FROM bookings b WHERE b.session_id = s.id AND b.user_id = ? AND b.status = 'confirmed') as user_booking_id,
                    (SELECT b.check_in_code FROM bookings b WHERE b.session_id = s.id AND b.user_id = ? AND b.status = 'confirmed') as user_check_in_code,
                    (SELECT b.checked_in_at FROM bookings b WHERE b.session_id = s.id AND b.user_id = ? AND b.status = 'confirmed') as user_checked_in_at,
                    (SELECT w.id FROM waitlist w WHERE w.session_id = s.id AND w.user_id = ? AND w.status = 'waiting') as user_waitlist_id
                FROM sessions s
            """
            params = [user_id, user_id, user_id, user_id]
            if date_filter:
                query += " WHERE s.date = ?"
                params.append(date_filter)
            else:
                # Default timetable view: show from today onwards so past expired sessions don't clutter the UI
                query += " WHERE s.date >= ?"
                params.append(datetime.date.today().isoformat())
            query += " ORDER BY s.date ASC, s.start_hour ASC"

            cursor.execute(query, params)
            rows = cursor.fetchall()

            result = []
            for r in rows:
                item = dict(r)
                confirmed = item["confirmed_count"]
                capacity = item["capacity"]
                seats_remaining = max(0, capacity - confirmed)
                item["seats_remaining"] = seats_remaining
                item["is_full"] = seats_remaining <= 0
                item["has_started"] = now_iso >= item["start_time"]
                item["has_ended"] = now_iso >= item["end_time"]
                item["is_booked_by_user"] = item["user_booking_id"] is not None
                item["is_waitlisted_by_user"] = item["user_waitlist_id"] is not None

                # Compute waitlist position if user is waitlisted
                if item["user_waitlist_id"]:
                    cursor.execute("""
                        SELECT COUNT(*) FROM waitlist 
                        WHERE session_id = ? AND status = 'waiting' AND id <= ?
                    """, (item["id"], item["user_waitlist_id"]))
                    item["user_waitlist_position"] = cursor.fetchone()[0]
                else:
                    item["user_waitlist_position"] = None

                # Attach specific daily muscle target and workout media
                item["muscle_target"] = get_muscle_target_for_date(item["date"])

                result.append(item)
            return result

    def _execute_book_session(self, user_id: int, session_id: int) -> Dict[str, Any]:
        """
        Concurrency-safe session booking using BEGIN IMMEDIATE.
        Guarantees that capacity is NEVER exceeded, even under simultaneous requests.
        """
        now = datetime.datetime.now()
        now_iso = now.isoformat()

        with get_db() as conn:
            with immediate_transaction(conn):
                cursor = conn.cursor()

                # 1. Fetch session
                cursor.execute(
                    "SELECT id, date, start_hour, start_time, end_time, capacity FROM sessions WHERE id = ?",
                    (session_id,)
                )
                session = cursor.fetchone()
                if not session:
                    raise APIError(404, "Not Found", "Session not found.", "SESSION_NOT_FOUND")

                # 2. Check if session has already started
                if now_iso >= session["start_time"]:
                    raise APIError(400, "Bad Request", "Cannot book a session that has already started.", "SESSION_ALREADY_STARTED")

                # 3. Check if member already has an active booking for this session
                cursor.execute(
                    "SELECT id FROM bookings WHERE session_id = ? AND user_id = ? AND status = 'confirmed'",
                    (session_id, user_id)
                )
                if cursor.fetchone():
                    raise APIError(409, "Conflict", "You already have an active booking for this session.", "ALREADY_BOOKED")

                # 4. Atomically count active confirmed bookings under write lock
                cursor.execute(
                    "SELECT COUNT(*) FROM bookings WHERE session_id = ? AND status = 'confirmed'",
                    (session_id,)
                )
                confirmed_count = cursor.fetchone()[0]

                if confirmed_count >= session["capacity"]:
                    raise APIError(409, "Conflict", f"Session is full ({session['capacity']}/{session['capacity']} confirmed). You may join the waitlist instead.", "SESSION_FULL")

                # 5. Generate unique unguessable check-in code
                # Try code generation loop in rare event of collision
                check_in_code = None
                for _ in range(10):
                    candidate_code = generate_check_in_code()
                    cursor.execute("SELECT id FROM bookings WHERE check_in_code = ?", (candidate_code,))
                    if not cursor.fetchone():
                        check_in_code = candidate_code
                        break

                if not check_in_code:
                    raise APIError(500, "Internal Server Error", "Could not generate unique check-in code.", "CODE_GEN_FAILURE")

                # 6. Insert confirmed booking
                cursor.execute(
                    """INSERT INTO bookings (session_id, user_id, status, check_in_code, created_at, updated_at)
                       VALUES (?, ?, 'confirmed', ?, ?, ?)""",
                    (session_id, user_id, check_in_code, now_iso, now_iso)
                )
                booking_id = cursor.lastrowid

                # 7. If the user was on the waitlist for this session, clean up their waitlist row
                cursor.execute(
                    "UPDATE waitlist SET status = 'promoted' WHERE session_id = ? AND user_id = ? AND status = 'waiting'",
                    (session_id, user_id)
                )

                return {
                    "id": booking_id,
                    "session_id": session_id,
                    "user_id": user_id,
                    "status": "confirmed",
                    "check_in_code": check_in_code,
                    "session_date": session["date"],
                    "session_start": session["start_time"],
                    "session_end": session["end_time"],
                    "created_at": now_iso
                }

    def _execute_join_waitlist(self, user_id: int, session_id: int) -> Dict[str, Any]:
        """Adds a member to the FIFO waitlist of a full session."""
        now_iso = datetime.datetime.now().isoformat()

        with get_db() as conn:
            with immediate_transaction(conn):
                cursor = conn.cursor()

                # 1. Fetch session
                cursor.execute(
                    "SELECT id, start_time, capacity FROM sessions WHERE id = ?",
                    (session_id,)
                )
                session = cursor.fetchone()
                if not session:
                    raise APIError(404, "Not Found", "Session not found.", "SESSION_NOT_FOUND")

                # 2. Check if session has started
                if now_iso >= session["start_time"]:
                    raise APIError(400, "Bad Request", "Cannot join waitlist for a session that has already started.", "SESSION_ALREADY_STARTED")

                # 3. Check if user already has active booking
                cursor.execute(
                    "SELECT id FROM bookings WHERE session_id = ? AND user_id = ? AND status = 'confirmed'",
                    (session_id, user_id)
                )
                if cursor.fetchone():
                    raise APIError(409, "Conflict", "You already have a confirmed booking for this session.", "ALREADY_BOOKED")

                # 4. Check if user already on waitlist
                cursor.execute(
                    "SELECT id FROM waitlist WHERE session_id = ? AND user_id = ? AND status = 'waiting'",
                    (session_id, user_id)
                )
                if cursor.fetchone():
                    raise APIError(409, "Conflict", "You are already on the waitlist for this session.", "ALREADY_ON_WAITLIST")

                # 5. Check if session is actually full
                cursor.execute(
                    "SELECT COUNT(*) FROM bookings WHERE session_id = ? AND status = 'confirmed'",
                    (session_id,)
                )
                confirmed_count = cursor.fetchone()[0]
                if confirmed_count < session["capacity"]:
                    raise APIError(400, "Bad Request", "Seats are currently available for this session. Please book directly instead of joining the waitlist.", "SEATS_STILL_AVAILABLE")

                # 6. Insert into waitlist
                cursor.execute(
                    "INSERT INTO waitlist (session_id, user_id, status, created_at) VALUES (?, ?, 'waiting', ?)",
                    (session_id, user_id, now_iso)
                )
                waitlist_id = cursor.lastrowid

                # 7. Get waitlist position
                cursor.execute(
                    "SELECT COUNT(*) FROM waitlist WHERE session_id = ? AND status = 'waiting' AND id <= ?",
                    (session_id, waitlist_id)
                )
                position = cursor.fetchone()[0]

                return {
                    "id": waitlist_id,
                    "session_id": session_id,
                    "user_id": user_id,
                    "status": "waiting",
                    "position": position,
                    "created_at": now_iso
                }

    def _execute_cancel_booking(self, current_user: Dict[str, Any], booking_id: int) -> Dict[str, Any]:
        """
        Cancels a booking and automatically promotes the first eligible person on the waitlist.
        Guarantees:
        - Strict ownership check (members only cancel their own; admins can cancel).
        - Cannot cancel a session that has already started.
        - Nobody is promoted into a session that has already started.
        - Promotion creates confirmed booking with a fresh unguessable check-in code.
        """
        now = datetime.datetime.now()
        now_iso = now.isoformat()

        with get_db() as conn:
            with immediate_transaction(conn):
                cursor = conn.cursor()

                # 1. Fetch booking with session details
                cursor.execute("""
                    SELECT b.id, b.user_id, b.session_id, b.status, s.start_time, s.end_time, s.capacity
                    FROM bookings b
                    JOIN sessions s ON b.session_id = s.id
                    WHERE b.id = ?
                """, (booking_id,))
                booking = cursor.fetchone()

                if not booking:
                    raise APIError(404, "Not Found", "Booking not found.", "BOOKING_NOT_FOUND")

                # 2. Ownership check: Members see and cancel only their own bookings
                if current_user["role"] != "admin" and booking["user_id"] != current_user["id"]:
                    raise APIError(403, "Forbidden", "You do not have permission to cancel another member's booking.", "FORBIDDEN_OWNERSHIP")

                if booking["status"] == "cancelled":
                    raise APIError(400, "Bad Request", "This booking is already cancelled.", "ALREADY_CANCELLED")

                # 3. Time check: Member can cancel until session starts
                if now_iso >= booking["start_time"]:
                    raise APIError(400, "Bad Request", "Cannot cancel a booking for a session that has already started.", "SESSION_ALREADY_STARTED")

                # 4. Mark booking as cancelled
                cursor.execute(
                    "UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?",
                    (now_iso, booking_id)
                )

                # 5. Automatic Waitlist Promotion:
                # "When someone cancels, the first person on the waitlist is booked automatically and their place on the list is released."
                # "Nobody is promoted into a session that has already started."
                promoted_info = None
                session_id = booking["session_id"]

                if now_iso < booking["start_time"]:
                    # Find earliest waitlisted member
                    cursor.execute("""
                        SELECT w.id, w.user_id, u.name, u.email
                        FROM waitlist w
                        JOIN users u ON w.user_id = u.id
                        WHERE w.session_id = ? AND w.status = 'waiting'
                        ORDER BY w.created_at ASC, w.id ASC
                        LIMIT 1
                    """, (session_id,))
                    next_waitlist = cursor.fetchone()

                    if next_waitlist:
                        # Release waitlist place
                        cursor.execute(
                            "UPDATE waitlist SET status = 'promoted' WHERE id = ?",
                            (next_waitlist["id"],)
                        )

                        # Generate unique check-in code for promoted member
                        promoted_code = None
                        for _ in range(10):
                            candidate = generate_check_in_code()
                            cursor.execute("SELECT id FROM bookings WHERE check_in_code = ?", (candidate,))
                            if not cursor.fetchone():
                                promoted_code = candidate
                                break

                        # Insert confirmed booking for waitlisted user
                        cursor.execute("""
                            INSERT INTO bookings (session_id, user_id, status, check_in_code, created_at, updated_at)
                            VALUES (?, ?, 'confirmed', ?, ?, ?)
                        """, (session_id, next_waitlist["user_id"], promoted_code, now_iso, now_iso))
                        new_booking_id = cursor.lastrowid

                        promoted_info = {
                            "booking_id": new_booking_id,
                            "user_id": next_waitlist["user_id"],
                            "name": next_waitlist["name"],
                            "email": next_waitlist["email"],
                            "check_in_code": promoted_code
                        }

                return {
                    "message": "Booking cancelled successfully.",
                    "cancelled_booking_id": booking_id,
                    "promoted_waitlist_member": promoted_info
                }

    def _execute_leave_waitlist(self, current_user: Dict[str, Any], waitlist_id: Optional[int] = None, session_id: Optional[int] = None) -> Dict[str, Any]:
        """Allows a member to leave the waitlist."""
        with get_db() as conn:
            cursor = conn.cursor()
            if waitlist_id:
                cursor.execute("SELECT id, user_id, session_id, status FROM waitlist WHERE id = ?", (waitlist_id,))
            else:
                cursor.execute("SELECT id, user_id, session_id, status FROM waitlist WHERE session_id = ? AND user_id = ? AND status = 'waiting'", (session_id, current_user["id"]))

            row = cursor.fetchone()
            if not row:
                raise APIError(404, "Not Found", "Waitlist record not found.", "WAITLIST_NOT_FOUND")

            if current_user["role"] != "admin" and row["user_id"] != current_user["id"]:
                raise APIError(403, "Forbidden", "You can only leave your own waitlist entry.", "FORBIDDEN_OWNERSHIP")

            if row["status"] != "waiting":
                raise APIError(400, "Bad Request", f"Waitlist entry is already {row['status']}.", "WAITLIST_INACTIVE")

            cursor.execute("UPDATE waitlist SET status = 'cancelled' WHERE id = ?", (row["id"],))
            conn.commit()

            return {
                "message": "You have left the waitlist.",
                "waitlist_id": row["id"]
            }

    def _execute_admin_check_in(self, code: str) -> Dict[str, Any]:
        """
        Validates check-in code and marks member present.
        Enforces:
        - Code works once only.
        - Only during its session's hour (start_time <= now <= end_time).
        - Never for a cancelled booking.
        - Returns member name, email, and session info.
        """
        now = datetime.datetime.now()
        now_iso = now.isoformat()

        with get_db() as conn:
            with immediate_transaction(conn):
                cursor = conn.cursor()

                # Look up code with user and session data
                cursor.execute("""
                    SELECT 
                        b.id as booking_id, b.status, b.checked_in_at, b.check_in_code,
                        u.id as user_id, u.name as user_name, u.email as user_email,
                        s.id as session_id, s.date as session_date, s.start_hour, s.start_time, s.end_time
                    FROM bookings b
                    JOIN users u ON b.user_id = u.id
                    JOIN sessions s ON b.session_id = s.id
                    WHERE b.check_in_code = ?
                """, (code,))
                record = cursor.fetchone()

                if not record:
                    raise APIError(404, "Not Found", f"Check-in code '{code}' was not found in the system.", "CODE_NOT_FOUND")

                # Check 1: Never works for cancelled booking
                if record["status"] == "cancelled":
                    raise APIError(400, "Bad Request", "This booking was cancelled and is no longer valid.", "BOOKING_CANCELLED")

                # Check 2: Works once only
                if record["checked_in_at"]:
                    raise APIError(409, "Conflict", f"This code has already been used! Member was checked in at {record['checked_in_at']}.", "ALREADY_CHECKED_IN")

                # Check 3: Only during its session's hour
                # Session starts at start_time and lasts 1 hour until end_time
                if now_iso < record["start_time"]:
                    start_pretty = record["start_time"].replace("T", " ")
                    raise APIError(400, "Bad Request", f"Check-in window has not opened yet. Session begins at {start_pretty}.", "CHECKIN_WINDOW_EARLY")

                if now_iso > record["end_time"]:
                    end_pretty = record["end_time"].replace("T", " ")
                    raise APIError(400, "Bad Request", f"Check-in window has closed. Session ended at {end_pretty}.", "CHECKIN_WINDOW_EXPIRED")

                # Valid! Mark present
                cursor.execute(
                    "UPDATE bookings SET checked_in_at = ? WHERE id = ?",
                    (now_iso, record["booking_id"])
                )

                return {
                    "booking_id": record["booking_id"],
                    "code": record["check_in_code"],
                    "checked_in_at": now_iso,
                    "member": {
                        "id": record["user_id"],
                        "name": record["user_name"],
                        "email": record["user_email"]
                    },
                    "session": {
                        "id": record["session_id"],
                        "date": record["session_date"],
                        "start_hour": record["start_hour"],
                        "start_time": record["start_time"],
                        "end_time": record["end_time"]
                    }
                }

    def _get_user_bookings_and_waitlist(self, user_id: int) -> Dict[str, Any]:
        """Fetches all bookings and active waitlist entries for a member."""
        now_iso = datetime.datetime.now().isoformat()
        with get_db() as conn:
            cursor = conn.cursor()

            # Active & past bookings
            cursor.execute("""
                SELECT 
                    b.id, b.status, b.check_in_code, b.checked_in_at, b.created_at,
                    s.id as session_id, s.date, s.start_hour, s.start_time, s.end_time, s.capacity
                FROM bookings b
                JOIN sessions s ON b.session_id = s.id
                WHERE b.user_id = ?
                ORDER BY s.date DESC, s.start_hour DESC
            """, (user_id,))
            bookings_raw = cursor.fetchall()

            bookings = []
            for b in bookings_raw:
                item = dict(b)
                st = item["start_time"]
                et = item["end_time"]
                item["has_started"] = now_iso >= st
                item["has_ended"] = now_iso >= et
                item["is_check_in_open"] = (st <= now_iso <= et) and (item["status"] == "confirmed") and (item["checked_in_at"] is None)
                item["can_cancel"] = (now_iso < st) and (item["status"] == "confirmed")
                item["muscle_target"] = get_muscle_target_for_date(item["date"])
                bookings.append(item)

            # Waitlist entries
            cursor.execute("""
                SELECT 
                    w.id, w.status, w.created_at,
                    s.id as session_id, s.date, s.start_hour, s.start_time, s.end_time, s.capacity
                FROM waitlist w
                JOIN sessions s ON w.session_id = s.id
                WHERE w.user_id = ? AND w.status = 'waiting'
                ORDER BY s.date ASC, s.start_hour ASC
            """, (user_id,))
            waitlist_raw = cursor.fetchall()

            waitlist = []
            for w in waitlist_raw:
                item = dict(w)
                # Compute position
                cursor.execute("""
                    SELECT COUNT(*) FROM waitlist 
                    WHERE session_id = ? AND status = 'waiting' AND id <= ?
                """, (item["session_id"], item["id"]))
                item["position"] = cursor.fetchone()[0]
                item["has_started"] = now_iso >= item["start_time"]
                item["muscle_target"] = get_muscle_target_for_date(item["date"])
                waitlist.append(item)

            return {
                "bookings": bookings,
                "waitlist": waitlist
            }

    def _get_session_roster(self, session_id: int) -> Dict[str, Any]:
        """Admin view: fetches all bookings and waitlist for a specific session."""
        now_iso = datetime.datetime.now().isoformat()
        with get_db() as conn:
            cursor = conn.cursor()

            # Session info
            cursor.execute("SELECT id, date, start_hour, start_time, end_time, capacity FROM sessions WHERE id = ?", (session_id,))
            session_row = cursor.fetchone()
            if not session_row:
                raise APIError(404, "Not Found", "Session not found.", "SESSION_NOT_FOUND")

            session = dict(session_row)
            session["has_started"] = now_iso >= session["start_time"]
            session["has_ended"] = now_iso >= session["end_time"]
            session["is_check_in_open"] = session["start_time"] <= now_iso <= session["end_time"]
            session["muscle_target"] = get_muscle_target_for_date(session["date"])

            # Bookings roster
            cursor.execute("""
                SELECT 
                    b.id, b.status, b.check_in_code, b.checked_in_at, b.created_at,
                    u.id as user_id, u.name as user_name, u.email as user_email
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                WHERE b.session_id = ?
                ORDER BY b.status ASC, b.id ASC
            """, (session_id,))
            bookings = [dict(r) for r in cursor.fetchall()]

            # Waitlist queue
            cursor.execute("""
                SELECT 
                    w.id, w.status, w.created_at,
                    u.id as user_id, u.name as user_name, u.email as user_email
                FROM waitlist w
                JOIN users u ON w.user_id = u.id
                WHERE w.session_id = ? AND w.status = 'waiting'
                ORDER BY w.created_at ASC, w.id ASC
            """, (session_id,))
            waitlist = []
            for idx, r in enumerate(cursor.fetchall(), start=1):
                item = dict(r)
                item["position"] = idx
                waitlist.append(item)

            confirmed_count = sum(1 for b in bookings if b["status"] == "confirmed")
            checked_in_count = sum(1 for b in bookings if b["checked_in_at"] is not None)

            return {
                "session": session,
                "bookings": bookings,
                "waitlist": waitlist,
                "stats": {
                    "capacity": session["capacity"],
                    "confirmed_count": confirmed_count,
                    "seats_remaining": max(0, session["capacity"] - confirmed_count),
                    "checked_in_count": checked_in_count,
                    "waitlist_count": len(waitlist)
                }
            }

    def _get_admin_stats(self) -> Dict[str, Any]:
        """Admin analytical overview."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM sessions")
            total_sessions = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'")
            total_confirmed = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM bookings WHERE checked_in_at IS NOT NULL")
            total_checked_in = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM waitlist WHERE status = 'waiting'")
            active_waitlist = cursor.fetchone()[0]

            cursor.execute("SELECT SUM(capacity) FROM sessions")
            total_capacity = cursor.fetchone()[0] or 0

            attendance_rate = (total_checked_in / total_confirmed * 100) if total_confirmed > 0 else 0.0
            utilization_rate = (total_confirmed / total_capacity * 100) if total_capacity > 0 else 0.0

            return {
                "total_sessions": total_sessions,
                "total_confirmed_bookings": total_confirmed,
                "total_checked_in": total_checked_in,
                "active_waitlist_members": active_waitlist,
                "attendance_rate": round(attendance_rate, 1),
                "utilization_rate": round(utilization_rate, 1)
            }

_last_session_refresh_check = 0.0

def ensure_current_sessions(force: bool = False):
    """
    Ensures active and upcoming sessions always exist for the current hour,
    today, tomorrow, and the upcoming week.
    Throttled to avoid DB query overhead on high-frequency live polling.
    """
    global _last_session_refresh_check
    import time
    now_ts = time.time()
    if not force and (now_ts - _last_session_refresh_check < 10.0):
        return
    _last_session_refresh_check = now_ts

    now = datetime.datetime.now()
    today_str = now.date().isoformat()
    tomorrow_str = (now.date() + datetime.timedelta(days=1)).isoformat()
    now_hour = now.hour

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # 1. Does an active session exist for today at current hour?
            cursor.execute("SELECT id FROM sessions WHERE date = ? AND start_hour = ?", (today_str, now_hour))
            cur_sess = cursor.fetchone()
            has_current_hour = cur_sess is not None

            # 2. Is Sarah Connor confirmed for the current hour so her live check-in pass works?
            has_sarah_active = False
            if cur_sess:
                cursor.execute("""
                    SELECT b.id FROM bookings b 
                    JOIN users u ON b.user_id = u.id 
                    WHERE b.session_id = ? AND u.email = 'sarah@gympulse.com' AND b.status = 'confirmed'
                """, (cur_sess[0],))
                has_sarah_active = cursor.fetchone() is not None

            # 3. Are there upcoming sessions scheduled for today after current hour?
            has_upcoming_today = True
            if now_hour < 22:
                cursor.execute("""
                    SELECT COUNT(*) FROM sessions 
                    WHERE date = ? AND start_hour > ?
                """, (today_str, now_hour))
                has_upcoming_today = cursor.fetchone()[0] > 0

            # 4. Does tomorrow have at least one session?
            cursor.execute("SELECT COUNT(*) FROM sessions WHERE date = ?", (tomorrow_str,))
            has_tomorrow = cursor.fetchone()[0] > 0

            if not has_current_hour or not has_sarah_active or not has_upcoming_today or not has_tomorrow:
                print(f"[SCHEDULE SYNC] Refreshing sessions for {today_str} (hour {now_hour}) and upcoming days...")
                from seed import seed_database
                seed_database()
    except Exception as e:
        print(f"[SCHEDULE SYNC NOTICE] {repr(e)}")

def open_browser_when_ready():
    import time
    import webbrowser
    time.sleep(0.4)
    try:
        webbrowser.open(f"http://localhost:{PORT}")
    except Exception:
        pass

def run_server():
    init_db()
    ensure_current_sessions(force=True)
    server_address = (HOST, PORT)
    httpd = ThreadingHTTPServer(server_address, GymRequestHandler)
    print(f"============================================================")
    print(f" Gym Slot Booking Server Running on http://{HOST}:{PORT}")
    print(f"============================================================")
    if os.environ.get("AUTO_OPEN_BROWSER", "1") == "1" and PORT == 8000:
        import threading
        threading.Thread(target=open_browser_when_ready, daemon=True).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server gracefully...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
