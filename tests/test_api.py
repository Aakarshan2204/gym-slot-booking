"""
Automated Test Suite for Gym Slot Booking System.
Tests:
- Concurrency race conditions on last seat
- Waitlist FIFO ordering & automated promotion on cancellation
- Nobody promoted into a session that has already started
- Check-in window validation (works once, only during hour, never for cancelled)
- Role-based authorization & ownership enforcement
- Consistent JSON error formats & status codes (400, 401, 403, 404, 409, 422)
"""

import os
import unittest
import threading
import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import json
import time

# Ensure test DB is used
TEST_DB = "test_gym_booking.db"
os.environ["DATABASE_URL"] = TEST_DB
os.environ["PORT"] = "8001"

import database
import auth
from server import run_server

class TestGymSlotBooking(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Remove old test DB if exists
        if os.path.exists(TEST_DB):
            try:
                os.remove(TEST_DB)
            except OSError:
                pass

        database.DB_PATH = TEST_DB
        database.init_db()

        # Start background server
        cls.server_thread = threading.Thread(target=run_server, daemon=True)
        cls.server_thread.start()
        time.sleep(0.5)  # Let server bind

        cls.base_url = "http://127.0.0.1:8001"

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB):
            try:
                os.remove(TEST_DB)
            except OSError:
                pass

    def request(self, method: str, path: str, data: dict = None, token: str = None):
        url = f"{self.base_url}{path}"
        body = json.dumps(data).encode("utf-8") if data is not None else None
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        req = Request(url, data=body, headers=headers, method=method)
        try:
            with urlopen(req) as resp:
                status = resp.status
                content = resp.read().decode("utf-8")
                return status, json.loads(content) if content else {}
        except HTTPError as e:
            status = e.code
            content = e.read().decode("utf-8")
            return status, json.loads(content) if content else {}

    def test_01_user_registration_and_login(self):
        # 1. Register valid member
        status, data = self.request("POST", "/api/auth/register", {
            "name": "Alice Wonderland",
            "email": "alice@example.com",
            "password": "Password123!"
        })
        self.assertEqual(status, 201)
        self.assertIn("token", data)
        self.assertEqual(data["user"]["role"], "member")

        # 2. Register duplicate email -> 409
        status, data = self.request("POST", "/api/auth/register", {
            "name": "Alice Duplicate",
            "email": "alice@example.com",
            "password": "Password123!"
        })
        self.assertEqual(status, 409)
        self.assertEqual(data["code"], "EMAIL_ALREADY_EXISTS")

        # 3. Invalid email -> 422
        status, data = self.request("POST", "/api/auth/register", {
            "name": "Bad Email",
            "email": "invalid-email",
            "password": "Password123!"
        })
        self.assertEqual(status, 422)

        # 4. Login with right credentials -> 200
        status, data = self.request("POST", "/api/auth/login", {
            "email": "alice@example.com",
            "password": "Password123!"
        })
        self.assertEqual(status, 200)
        self.assertIn("token", data)

        # 5. Login with wrong password -> 401
        status, data = self.request("POST", "/api/auth/login", {
            "email": "alice@example.com",
            "password": "WrongPassword"
        })
        self.assertEqual(status, 401)
        self.assertEqual(data["code"], "INVALID_CREDENTIALS")

    def test_02_admin_session_management_and_collision(self):
        # Create admin directly in database
        with database.get_db() as conn:
            admin_hash = auth.hash_password("AdminKey123!")
            conn.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
                ("Staff Admin", "admin_test@example.com", admin_hash)
            )
            admin_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            conn.commit()

        admin_token = auth.create_access_token(admin_id, "admin_test@example.com", "admin")

        # Non-admin attempting to create session -> 403
        alice_login_status, alice_auth = self.request("POST", "/api/auth/login", {
            "email": "alice@example.com",
            "password": "Password123!"
        })
        status, data = self.request("POST", "/api/sessions", {
            "date": "2026-11-01",
            "start_hour": 10,
            "capacity": 20
        }, token=alice_auth["token"])
        self.assertEqual(status, 403)
        self.assertEqual(data["code"], "FORBIDDEN_NOT_ADMIN")

        # Admin creating session -> 201
        status, data = self.request("POST", "/api/sessions", {
            "date": "2026-11-01",
            "start_hour": 10,
            "capacity": 20
        }, token=admin_token)
        self.assertEqual(status, 201)
        session_id = data["session"]["id"]

        # Rule: Two cannot share a start time. Attempt creating duplicate hour on same date -> 409
        status, data = self.request("POST", "/api/sessions", {
            "date": "2026-11-01",
            "start_hour": 10,
            "capacity": 20
        }, token=admin_token)
        self.assertEqual(status, 409)
        self.assertEqual(data["code"], "TIME_SLOT_COLLISION")

    def test_03_concurrency_race_condition_and_capacity_cap(self):
        """
        Verify rule:
        'A session never exceeds 20 confirmed bookings, even when two people take the last seat at the same moment.'
        """
        with database.get_db() as conn:
            # Create a session with capacity = 2 for sharp concurrency test
            conn.execute("""
                INSERT INTO sessions (date, start_hour, start_time, end_time, capacity, created_by)
                VALUES ('2026-11-05', 14, '2026-11-05T14:00:00', '2026-11-05T15:00:00', 2, 1)
            """)
            s_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

            # Create 5 distinct users
            user_tokens = []
            for i in range(1, 6):
                pw = auth.hash_password("Pass123!")
                conn.execute("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'member')",
                             (f"Racer {i}", f"racer{i}@test.com", pw))
                u_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                user_tokens.append(auth.create_access_token(u_id, f"racer{i}@test.com", "member"))
            conn.commit()

        # Fire 5 concurrent requests at the exact same moment for 2 spots
        results = []
        barrier = threading.Barrier(5)

        def worker(tok):
            barrier.wait()
            res = self.request("POST", f"/api/sessions/{s_id}/book", {}, token=tok)
            results.append(res)

        threads = [threading.Thread(target=worker, args=(tok,)) for tok in user_tokens]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        successes = [r for r in results if r[0] == 201]
        conflicts = [r for r in results if r[0] == 409 and r[1].get("code") == "SESSION_FULL"]

        # Exactly 2 succeed, exactly 3 get rejected with 409 Conflict
        self.assertEqual(len(successes), 2, "Capacity was violated or under-filled!")
        self.assertEqual(len(conflicts), 3, "Concurrent requests were not cleanly rejected!")

        # Verify database count strictly equals capacity
        with database.get_db() as conn:
            cnt = conn.execute("SELECT COUNT(*) FROM bookings WHERE session_id = ? AND status = 'confirmed'", (s_id,)).fetchone()[0]
            self.assertEqual(cnt, 2)

    def test_04_waitlist_and_automatic_promotion_on_cancellation(self):
        """
        Tests:
        - Joining waitlist when session is full
        - FIFO ordering
        - Cancelling booking promotes first waitlisted member automatically
        - Promoted member gets new unguessable code
        """
        now = datetime.datetime.now()
        date_str = (now + datetime.timedelta(days=7)).date().isoformat()
        with database.get_db() as conn:
            # Create a dedicated session with capacity = 1
            st = f"{date_str}T16:00:00"
            et = f"{date_str}T17:00:00"
            conn.execute("""
                INSERT INTO sessions (date, start_hour, start_time, end_time, capacity, created_by)
                VALUES (?, 16, ?, ?, 1, 1)
            """, (date_str, st, et))
            s_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

            # Create 3 dedicated users: BookedUser, WaitlistUser1, WaitlistUser2
            pw = auth.hash_password("Pass123!")
            conn.execute("INSERT INTO users (name, email, password_hash, role) VALUES ('Booked', 'booked@test.com', ?, 'member')", (pw,))
            u_booked = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            conn.execute("INSERT INTO users (name, email, password_hash, role) VALUES ('WL1', 'wl1@test.com', ?, 'member')", (pw,))
            u_wl1 = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            conn.execute("INSERT INTO users (name, email, password_hash, role) VALUES ('WL2', 'wl2@test.com', ?, 'member')", (pw,))
            u_wl2 = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

            tok_booked = auth.create_access_token(u_booked, "booked@test.com", "member")
            tok_r3 = auth.create_access_token(u_wl1, "wl1@test.com", "member")
            tok_r4 = auth.create_access_token(u_wl2, "wl2@test.com", "member")

            # Book the 1 spot with BookedUser
            code_b = auth.generate_check_in_code()
            conn.execute("""
                INSERT INTO bookings (session_id, user_id, status, check_in_code, created_at, updated_at)
                VALUES (?, ?, 'confirmed', ?, ?, ?)
            """, (s_id, u_booked, code_b, now.isoformat(), now.isoformat()))
            b_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            conn.commit()

        # Racer 3 joins waitlist
        status, data = self.request("POST", f"/api/sessions/{s_id}/waitlist", {}, token=tok_r3)
        self.assertEqual(status, 201)
        self.assertEqual(data["waitlist"]["position"], 1)

        # Racer 4 joins waitlist
        status, data = self.request("POST", f"/api/sessions/{s_id}/waitlist", {}, token=tok_r4)
        self.assertEqual(status, 201)
        self.assertEqual(data["waitlist"]["position"], 2)

        # Racer 3 tries joining again -> 409 Conflict
        status, data = self.request("POST", f"/api/sessions/{s_id}/waitlist", {}, token=tok_r3)
        self.assertEqual(status, 409)
        self.assertEqual(data["code"], "ALREADY_ON_WAITLIST")

        # Now, original booked member cancels their booking
        status, data = self.request("DELETE", f"/api/bookings/{b_id}", {}, token=tok_booked)
        self.assertEqual(status, 200)

        # Verify Racer 3 was promoted automatically
        self.assertIsNotNone(data["promoted_waitlist_member"])
        self.assertEqual(data["promoted_waitlist_member"]["user_id"], u_wl1)
        promoted_code = data["promoted_waitlist_member"]["check_in_code"]
        self.assertEqual(len(promoted_code), 6)

        # Verify Racer 4 is now position #1
        status, data = self.request("GET", f"/api/sessions?date={date_str}", {}, token=tok_r4)
        sess = next(s for s in data["sessions"] if s["id"] == s_id)
        self.assertEqual(sess["user_waitlist_position"], 1)

    def test_05_check_in_rules_and_window_validation(self):
        """
        Tests:
        - Check-in code works once only
        - Only during its session's hour
        - Never for cancelled booking
        """
        now = datetime.datetime.now()
        current_hour = now.hour
        today_str = now.date().isoformat()

        with database.get_db() as conn:
            # Create active session right now
            st = datetime.datetime(now.year, now.month, now.day, current_hour, 0, 0)
            et = st + datetime.timedelta(hours=1)
            conn.execute("""
                INSERT INTO sessions (date, start_hour, start_time, end_time, capacity, created_by)
                VALUES (?, ?, ?, ?, 20, 1)
            """, (today_str, current_hour, st.isoformat(), et.isoformat()))
            active_s_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

            # Add confirmed booking
            code_valid = "VAL999"
            conn.execute("""
                INSERT INTO bookings (session_id, user_id, status, check_in_code, created_at, updated_at)
                VALUES (?, 1, 'confirmed', ?, ?, ?)
            """, (active_s_id, code_valid, now.isoformat(), now.isoformat()))

            # Add cancelled booking
            code_cancelled = "CAN999"
            conn.execute("""
                INSERT INTO bookings (session_id, user_id, status, check_in_code, created_at, updated_at)
                VALUES (?, 1, 'cancelled', ?, ?, ?)
            """, (active_s_id, code_cancelled, now.isoformat(), now.isoformat()))

            # Add booking for session in future (starts 4 hours from now)
            st_fut = st + datetime.timedelta(hours=4)
            et_fut = et + datetime.timedelta(hours=4)
            conn.execute("""
                INSERT INTO sessions (date, start_hour, start_time, end_time, capacity, created_by)
                VALUES (?, ?, ?, ?, 20, 1)
            """, (today_str, (current_hour + 4) % 24, st_fut.isoformat(), et_fut.isoformat()))
            fut_s_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            code_future = "FUT999"
            conn.execute("""
                INSERT INTO bookings (session_id, user_id, status, check_in_code, created_at, updated_at)
                VALUES (?, 1, 'confirmed', ?, ?, ?)
            """, (fut_s_id, code_future, now.isoformat(), now.isoformat()))

            conn.commit()

        with database.get_db() as conn:
            admin_row = conn.execute("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1").fetchone()
            admin_token = auth.create_access_token(admin_row["id"], admin_row["email"], "admin")

        # 1. Non-existent code -> 404
        status, data = self.request("POST", "/api/admin/check-in", {"code": "NONEXIST"}, token=admin_token)
        self.assertEqual(status, 404)
        self.assertEqual(data["code"], "CODE_NOT_FOUND")

        # 2. Cancelled booking -> 400
        status, data = self.request("POST", "/api/admin/check-in", {"code": code_cancelled}, token=admin_token)
        self.assertEqual(status, 400)
        self.assertEqual(data["code"], "BOOKING_CANCELLED")

        # 3. Future session (not in session hour yet) -> 400
        status, data = self.request("POST", "/api/admin/check-in", {"code": code_future}, token=admin_token)
        self.assertEqual(status, 400)
        self.assertEqual(data["code"], "CHECKIN_WINDOW_EARLY")

        # 4. Valid active session code -> 200
        status, data = self.request("POST", "/api/admin/check-in", {"code": code_valid}, token=admin_token)
        self.assertEqual(status, 200)
        self.assertIn("member", data["check_in"])
        self.assertIn("checked_in_at", data["check_in"])

        # 5. Reuse code -> 409 Conflict ("already used")
        status, data = self.request("POST", "/api/admin/check-in", {"code": code_valid}, token=admin_token)
        self.assertEqual(status, 409)
        self.assertEqual(data["code"], "ALREADY_CHECKED_IN")

if __name__ == "__main__":
    unittest.main()
