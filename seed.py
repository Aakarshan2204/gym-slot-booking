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

        # Check if sessions exist for today
        cursor.execute("SELECT COUNT(*) FROM sessions WHERE date = ?", (today_str,))
        today_session_count = cursor.fetchone()[0]

        if today_session_count == 0:
            print("Creating sessions for today and upcoming days...")

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
            # Session 1: Current hour session (Check-in OPEN NOW for testing!)
            session_now_id = make_session(today, current_hour)
            code_now = "7XKP2Q"
            cursor.execute(
                """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                   VALUES (?, ?, 'confirmed', ?)""",
                (session_now_id, sarah_id, code_now)
            )

            # Session 2: FULL SESSION today (20 bookings + waitlist)
            full_hour = 22 if current_hour != 22 else 23
            session_full_id = make_session(today, full_hour)
            for uid in synthetic_member_ids[:20]:
                c = generate_check_in_code()
                cursor.execute(
                    """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                       VALUES (?, ?, 'confirmed', ?)""",
                    (session_full_id, uid, c)
                )

            # Waitlist entries for full session
            cursor.execute(
                "INSERT OR IGNORE INTO waitlist (session_id, user_id, status, created_at) VALUES (?, ?, 'waiting', ?)",
                (session_full_id, mike_id, (now - datetime.timedelta(minutes=30)).isoformat())
            )
            cursor.execute(
                "INSERT OR IGNORE INTO waitlist (session_id, user_id, status, created_at) VALUES (?, ?, 'waiting', ?)",
                (session_full_id, alex_id, (now - datetime.timedelta(minutes=15)).isoformat())
            )

            # Session 3: Evening session with some spots taken
            if current_hour < 17:
                session_partial_id = make_session(today, 17)
                for uid in synthetic_member_ids[:5]:
                    cursor.execute(
                        """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                           VALUES (?, ?, 'confirmed', ?)""",
                        (session_partial_id, uid, generate_check_in_code())
                    )

            # Tomorrow sessions
            make_session(tomorrow, 9)   # Empty (20 free)
            s_tom_2 = make_session(tomorrow, 11)  # 8 booked, 12 free
            for uid in synthetic_member_ids[:8]:
                cursor.execute(
                    """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                       VALUES (?, ?, 'confirmed', ?)""",
                    (s_tom_2, uid, generate_check_in_code())
                )
            cursor.execute(
                """INSERT OR IGNORE INTO bookings (session_id, user_id, status, check_in_code)
                   VALUES (?, ?, 'confirmed', ?)""",
                (s_tom_2, sarah_id, generate_check_in_code())
            )

            make_session(tomorrow, 18)

            # Day after tomorrow
            make_session(day_after, 10)
            make_session(day_after, 16)

        conn.commit()
        print("Database ready with persistent users, sessions, and waitlists.")

if __name__ == "__main__":
    seed_database()
