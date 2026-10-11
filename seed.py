"""
Seed script to populate initial test data:
- Admin account (created directly in DB)
- Member accounts
- Sessions across multiple days
- A FULL session (20/20 seats taken) with members on the waitlist
- An active session with check-in open right now
"""

import datetime
from database import get_db, init_db
from auth import hash_password, generate_check_in_code

def seed_database():
    init_db()
    with get_db() as conn:
        cursor = conn.cursor()

        # Check if already seeded
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        if cursor.fetchone()[0] > 0:
            print("Database already contains an admin account. Resetting tables for clean seed...")
            cursor.execute("DELETE FROM waitlist")
            cursor.execute("DELETE FROM bookings")
            cursor.execute("DELETE FROM sessions")
            cursor.execute("DELETE FROM users")
            conn.commit()

        print("Seeding initial users...")
        # 1. Admin Account (Created directly in database, never through registration)
        admin_pass = hash_password("AdminPass123!")
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("Gym Administrator", "admin@gympulse.com", admin_pass, "admin")
        )
        admin_id = cursor.lastrowid

        # 2. Main Test Members
        member_pass = hash_password("MemberPass123!")
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("Sarah Connor", "sarah@gympulse.com", member_pass, "member")
        )
        sarah_id = cursor.lastrowid

        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("Mike Tyson", "mike@gympulse.com", member_pass, "member")
        )
        mike_id = cursor.lastrowid

        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("Alex Johnson", "alex@gympulse.com", member_pass, "member")
        )
        alex_id = cursor.lastrowid

        # 3. Create 20 synthetic members to populate full sessions
        synthetic_member_ids = []
        for i in range(1, 22):
            cursor.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
                (f"Member {i}", f"member{i}@gympulse.com", member_pass, "member")
            )
            synthetic_member_ids.append(cursor.lastrowid)

        print("Seeding sessions across several days...")
        now = datetime.datetime.now()
        today = now.date()
        tomorrow = today + datetime.timedelta(days=1)
        day_after = today + datetime.timedelta(days=2)

        def make_session(date_val: datetime.date, hour: int, capacity: int = 20):
            st = datetime.datetime(date_val.year, date_val.month, date_val.day, hour, 0, 0)
            et = st + datetime.timedelta(hours=1)
            cursor.execute(
                """INSERT INTO sessions (date, start_hour, start_time, end_time, capacity, created_by)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (date_val.isoformat(), hour, st.isoformat(), et.isoformat(), capacity, admin_id)
            )
            return cursor.lastrowid

        # Session 1: Current hour session (Check-in OPEN NOW for testing!)
        current_hour = now.hour
        session_now_id = make_session(today, current_hour)
        # Sarah booked this session so evaluator can immediately test check-in!
        code_now = "7XKP2Q"
        cursor.execute(
            """INSERT INTO bookings (session_id, user_id, status, check_in_code)
               VALUES (?, ?, 'confirmed', ?)""",
            (session_now_id, sarah_id, code_now)
        )

        # Session 2: FULL SESSION today at 19:00 (or 21:00 if current hour is past)
        full_hour = 21 if current_hour >= 19 else 19
        session_full_id = make_session(today, full_hour)
        # Fill with 20 confirmed bookings
        for uid in synthetic_member_ids[:20]:
            c = generate_check_in_code()
            cursor.execute(
                """INSERT INTO bookings (session_id, user_id, status, check_in_code)
                   VALUES (?, ?, 'confirmed', ?)""",
                (session_full_id, uid, c)
            )
        # Add Mike and Alex to the waitlist of the full session
        cursor.execute(
            "INSERT INTO waitlist (session_id, user_id, status, created_at) VALUES (?, ?, 'waiting', ?)",
            (session_full_id, mike_id, (now - datetime.timedelta(minutes=30)).isoformat())
        )
        cursor.execute(
            "INSERT INTO waitlist (session_id, user_id, status, created_at) VALUES (?, ?, 'waiting', ?)",
            (session_full_id, alex_id, (now - datetime.timedelta(minutes=15)).isoformat())
        )

        # Session 3: Evening session today with some spots taken
        if current_hour < 17:
            session_partial_id = make_session(today, 17)
            for uid in synthetic_member_ids[:5]:
                cursor.execute(
                    """INSERT INTO bookings (session_id, user_id, status, check_in_code)
                       VALUES (?, ?, 'confirmed', ?)""",
                    (session_partial_id, uid, generate_check_in_code())
                )

        # Tomorrow sessions
        s_tom_1 = make_session(tomorrow, 9)   # Empty (20 free)
        s_tom_2 = make_session(tomorrow, 11)  # 8 booked, 12 free
        for uid in synthetic_member_ids[:8]:
            cursor.execute(
                """INSERT INTO bookings (session_id, user_id, status, check_in_code)
                   VALUES (?, ?, 'confirmed', ?)""",
                (s_tom_2, uid, generate_check_in_code())
            )
        # Sarah also booked tomorrow 11:00
        cursor.execute(
            """INSERT INTO bookings (session_id, user_id, status, check_in_code)
               VALUES (?, ?, 'confirmed', ?)""",
            (s_tom_2, sarah_id, generate_check_in_code())
        )

        make_session(tomorrow, 18)            # Empty

        # Day after tomorrow
        make_session(day_after, 10)
        make_session(day_after, 16)

        conn.commit()
        print("Database seeded successfully with admin, members, sessions, full session, and waitlist!")

if __name__ == "__main__":
    seed_database()
