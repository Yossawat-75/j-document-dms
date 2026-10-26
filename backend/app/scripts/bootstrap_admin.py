import re

import psycopg2
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{3,50}$")


def bootstrap_admin() -> None:
    username = settings.DMS_ADMIN_USERNAME.strip()
    password = settings.DMS_ADMIN_PASSWORD
    full_name = settings.DMS_ADMIN_FULL_NAME.strip()
    department_id = settings.DMS_ADMIN_DEPARTMENT_ID

    if not USERNAME_PATTERN.fullmatch(username):
        raise RuntimeError("DMS_ADMIN_USERNAME must contain 3-50 safe characters")
    if len(password) < 16:
        raise RuntimeError("DMS_ADMIN_PASSWORD must contain at least 16 characters")
    if not full_name:
        raise RuntimeError("DMS_ADMIN_FULL_NAME is required")
    if department_id < 1:
        raise RuntimeError("DMS_ADMIN_DEPARTMENT_ID must be a positive integer")

    password_hash = pwd_context.hash(password)
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM departments WHERE id = %s;", (department_id,))
            if cur.fetchone() is None:
                raise RuntimeError("Configured admin department does not exist")

            cur.execute(
                """
                INSERT INTO users (username, password_hash, full_name, role, department_id)
                VALUES (%s, %s, %s, 'ADMIN', %s)
                ON CONFLICT (username) DO UPDATE
                SET password_hash = EXCLUDED.password_hash,
                    full_name = EXCLUDED.full_name,
                    role = 'ADMIN',
                    department_id = EXCLUDED.department_id
                RETURNING id, username, role;
                """,
                (username, password_hash, full_name, department_id),
            )
            admin = cur.fetchone()
        conn.commit()
    finally:
        conn.close()

    print(f"Application admin ready: {admin[1]} (role={admin[2]})")


if __name__ == "__main__":
    bootstrap_admin()
