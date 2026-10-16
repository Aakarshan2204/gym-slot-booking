"""
Seed script to populate initial test data non-destructively:
- Admin account (created directly in DB)
- Member accounts
- Preserves all registered users (never deletes existing user accounts!)
- Creates active sessions, full sessions, and waitlists for current and upcoming dates
"""

import datetime
from database import get_db, init_db
from auth import hash_password, generate_check_in_code

def seed_database():
    init_db()
    with get_db() as conn:
        cursor = conn.cursor()

        # Helper to get or create a user by email non-destructively
        def get_or_create_user(name: str, email: str, plain_pass: str, role: str = "member") -> int:
            cursor.execute("SELECT id FROM users WHERE email = ? COLLATE NOCASE", (email.strip(),))
            row = cursor.fetchone()
            if row:
                return row[0]
            pw_hash = hash_password(plain_pass)
            cursor.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
                (name.strip(), email.strip().lower(), pw_hash, role)
            )
            return cursor.lastrowid

        print("Ensuring core test users exist...")
        admin_id = get_or_create_user("Gym Administrator", "admin@gympulse.com", "AdminPass123!", "admin")
        sarah_id = get_or_create_user("Sarah Connor", "sarah@gympulse.com", "MemberPass123!", "member")
        mike_id = get_or_create_user("Mike Tyson", "mike@gympulse.com", "MemberPass123!", "member")
        alex_id = get_or_create_user("Alex Johnson", "alex@gympulse.com", "MemberPass123!", "member")

        # Also pre-register user's personal account so they can log in immediately
        get_or_create_user("Aakarshan", "goyalaakarshan2204@gmail.com", "MemberPass123!", "member")

        synthetic_member_ids = []
        for i in range(1, 22):
            uid = get_or_create_user(f"Member {i}", f"member{i}@gympulse.com", "MemberPass123!", "member")
            synthetic_member_ids.append(uid)

        now = datetime.datetime.now()
        today = now.date()
        today_str = today.isoformat()
        tomorrow = today + datetime.timedelta(days=1)
        day_after = today + datetime.timedelta(days=2)

        def make_session(date_val: datetime.date, hour: int, capacity: int = 20) -> int:
            st = datetime.datetime(date_val.year, date_val.month, date_val.day, hour, 0, 0)
            et = st + datetime.timedelta(hours=1)
            cursor.execute(
                """INSERT OR IGNORE INTO sessions (date, start_hour, start_time, end_time, capacity, created_by)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (date_val.isoformat(), hour, st.isoformat(), et.isoformat(), capacity, admin_id)
            )
            cursor.execute("SELECT id FROM sessions WHERE date = ? AND start_hour = ?", (date_val.isoformat(), hour))
            return cursor.fetchone()[0]

        current_hour = now.hour

        # 1. ALWAYS guarantee an active session for the CURRENT HOUR today
        # Guarantees the "Active Now" badge and check-in window are open whenever the app is opened
        session_now_id = make_session(today, current_hour)
        cursor.execute("SELECT id FROM bookings WHERE session_id = ? AND user_id = ? AND status = 'confirmed'", (session_now_id, sarah_id))
        if not cursor.fetchone():
            cursor.execute("SELECT id FROM bookings WHERE check_in_code = '7XKP2Q'")
            code_now = generate_check_in_code() if cursor.fetchone() else "7XKP2Q"
            cursor.execute(
                """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                   VALUES (?, ?, 'confirmed', ?)""",
                (session_now_id, sarah_id, code_now)
            )

        # 2. Upcoming Sessions Today (if current_hour < 23)
        # A: Next hour is an OPEN bookable session (so users can immediately test booking!)
        if current_hour + 1 <= 23:
            s_open_id = make_session(today, current_hour + 1)
            # Ensure it is open with free seats: seed 4 bookings, leaving 16 open seats
            cursor.execute("SELECT COUNT(*) FROM bookings WHERE session_id = ? AND status = 'confirmed'", (s_open_id,))
            if cursor.fetchone()[0] == 0:
                for uid in synthetic_member_ids[:4]:
                    cursor.execute(
                        """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                           VALUES (?, ?, 'confirmed', ?)""",
                        (s_open_id, uid, generate_check_in_code())
                    )

        # B: Next+2 hour is a FULL session with waitlist (for testing waitlist queue & FIFO promotion)
        if current_hour + 2 <= 23:
            full_hour = current_hour + 2
        elif current_hour + 1 <= 23:
            full_hour = current_hour + 1
        else:
            full_hour = None

        if full_hour is not None:
            session_full_id = make_session(today, full_hour)
            cursor.execute("SELECT COUNT(*) FROM bookings WHERE session_id = ? AND status = 'confirmed'", (session_full_id,))
            booked_count = cursor.fetchone()[0]
            if booked_count < 20:
                for uid in synthetic_member_ids[:(20 - booked_count)]:
                    cursor.execute(
                        """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                           VALUES (?, ?, 'confirmed', ?)""",
                        (session_full_id, uid, generate_check_in_code())
                    )

            # Waitlist entries for full session
            cursor.execute("SELECT COUNT(*) FROM waitlist WHERE session_id = ? AND status = 'waiting'", (session_full_id,))
            if cursor.fetchone()[0] == 0:
                cursor.execute(
                    "INSERT OR IGNORE INTO waitlist (session_id, user_id, status, created_at) VALUES (?, ?, 'waiting', ?)",
                    (session_full_id, mike_id, (now - datetime.timedelta(minutes=30)).isoformat())
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO waitlist (session_id, user_id, status, created_at) VALUES (?, ?, 'waiting', ?)",
                    (session_full_id, alex_id, (now - datetime.timedelta(minutes=15)).isoformat())
                )

        # C: Extra late session if early enough
        if current_hour < 21:
            make_session(today, 22)

        # 3. Tomorrow Sessions (guarantee morning, midday, afternoon, full evening, and night slots)
        make_session(tomorrow, 9)   # 20 free
        s_tom_2 = make_session(tomorrow, 11)  # Midday slot (Sarah booked, 12 free)
        cursor.execute("SELECT COUNT(*) FROM bookings WHERE session_id = ? AND status = 'confirmed'", (s_tom_2,))
        if cursor.fetchone()[0] < 8:
            for uid in synthetic_member_ids[:8]:
                cursor.execute(
                    """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                       VALUES (?, ?, 'confirmed', ?)""",
                    (s_tom_2, uid, generate_check_in_code())
                )
        cursor.execute("SELECT id FROM bookings WHERE session_id = ? AND user_id = ? AND status = 'confirmed'", (s_tom_2, sarah_id))
        if not cursor.fetchone():
            cursor.execute(
                """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                   VALUES (?, ?, 'confirmed', ?)""",
                (s_tom_2, sarah_id, generate_check_in_code())
            )

        make_session(tomorrow, 14)  # Afternoon slot (20 free)

        s_tom_full = make_session(tomorrow, 18)  # Evening slot (FULL with waitlist)
        cursor.execute("SELECT COUNT(*) FROM bookings WHERE session_id = ? AND status = 'confirmed'", (s_tom_full,))
        tom_booked = cursor.fetchone()[0]
        if tom_booked < 20:
            for uid in synthetic_member_ids[:(20 - tom_booked)]:
                cursor.execute(
                    """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                       VALUES (?, ?, 'confirmed', ?)""",
                    (s_tom_full, uid, generate_check_in_code())
                )
        cursor.execute("SELECT COUNT(*) FROM waitlist WHERE session_id = ? AND status = 'waiting'", (s_tom_full,))
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                "INSERT OR IGNORE INTO waitlist (session_id, user_id, status, created_at) VALUES (?, ?, 'waiting', ?)",
                (s_tom_full, mike_id, (now - datetime.timedelta(minutes=30)).isoformat())
            )
            cursor.execute(
                "INSERT OR IGNORE INTO waitlist (session_id, user_id, status, created_at) VALUES (?, ?, 'waiting', ?)",
                (s_tom_full, alex_id, (now - datetime.timedelta(minutes=15)).isoformat())
            )

        make_session(tomorrow, 20)  # Late evening slot (20 free)

        # 4. Multi-day schedule for the rest of the week (next 6 days)
        for day_offset in range(2, 7):
            target_date = today + datetime.timedelta(days=day_offset)
            if target_date.weekday() == 6:
                continue
            s_morn = make_session(target_date, 10)
            s_eve = make_session(target_date, 18)
            cursor.execute("SELECT COUNT(*) FROM bookings WHERE session_id = ? AND status = 'confirmed'", (s_morn,))
            if cursor.fetchone()[0] < 3:
                for uid in synthetic_member_ids[:(day_offset * 2) % 10]:
                    cursor.execute(
                        """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                           VALUES (?, ?, 'confirmed', ?)""",
                        (s_morn, uid, generate_check_in_code())
                    )

        conn.commit()
        print("Database ready with persistent users, sessions, and waitlists.")

if __name__ == "__main__":
    seed_database()
