import os
import psycopg2
from psycopg2.extras import RealDictCursor
from passlib.context import CryptContext

DB_HOST = os.getenv("POSTGRES_HOST", "postgres")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "password123")
DB_NAME = os.getenv("POSTGRES_DB", "dms_db")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return psycopg2.connect(db_url)
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        dbname=DB_NAME
    )

def restore_data():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        print("[*] กำลังล้างข้อมูลจำลอง (Mock Data) ออกด้วย TRUNCATE CASCADE...")
        # ล้างข้อมูลและรีเซ็ต ID เริ่มต้นใหม่ทั้งหมด
        cur.execute("""
            TRUNCATE TABLE audit_logs, documents, users, branches, departments, categories 
            RESTART IDENTITY CASCADE;
        """)

        print("[*] กำลังกู้คืนข้อมูลจริง: แผนกภายในองค์กร...")
        real_departments = [
            "บัญชี/การเงิน",
            "ฝ่ายบุคคล (HR)",
            "ฝ่ายจัดซื้อ (Procurement)",
            "ฝ่ายไอทีและพัฒนาระบบ"
        ]
        dept_ids = []
        for d in real_departments:
            cur.execute("INSERT INTO departments (name) VALUES (%s) RETURNING id;", (d,))
            dept_ids.append(cur.fetchone()["id"])

        print("[*] กำลังกู้คืนข้อมูลจริง: สาขาของบริษัท...")
        real_branches = [
            "สำนักงานใหญ่ (HQ)",
            "สาขารังสิต",
            "สาขาพระราม 9",
            "สาขาเชียงใหม่"
        ]
        branch_ids = []
        for b in real_branches:
            cur.execute("INSERT INTO branches (name) VALUES (%s) RETURNING id;", (b,))
            branch_ids.append(cur.fetchone()["id"])

        print("[*] กำลังกู้คืนข้อมูลจริง: หมวดหมู่เอกสาร...")
        real_categories = [
            "ใบเสร็จ/ใบกำกับภาษี",
            "สัญญาจ้าง",
            "ใบสั่งซื้อ (PO)",
            "ใบเสร็จรับเงิน /ใบกำกับภาษี",
            "หนังสือราชการ/เอกสารทางการ"
        ]
        for c in real_categories:
            cur.execute("INSERT INTO categories (name) VALUES (%s);", (c,))

        print("[*] กำลังสร้างบัญชีผู้ใช้งานหลัก (admin / user)...")
        admin_pass = pwd_context.hash("admin123")
        user_pass = pwd_context.hash("user123")

        cur.execute(
            "INSERT INTO users (username, password_hash, full_name, role, department_id) VALUES (%s, %s, %s, %s, %s);",
            ("admin", admin_pass, "System Administrator", "ADMIN", dept_ids[3])
        )
        cur.execute(
            "INSERT INTO users (username, password_hash, full_name, role, department_id) VALUES (%s, %s, %s, %s, %s);",
            ("user", user_pass, "General Officer", "USER", dept_ids[0])
        )

        print("[*] บันทึก Audit Log เริ่มต้นระบบ...")
        cur.execute(
            "INSERT INTO audit_logs (action, username, details, created_at) VALUES (%s, %s, %s, NOW());",
            ("SYSTEM", "admin", "กู้คืนระบบและข้อมูลหลักกลับสู่สถานะพร้อมใช้งาน")
        )

        conn.commit()
        print("[✓] กู้คืนข้อมูลจริงเดิมของระบบสำเร็จเรียบร้อย 100%!")
    except Exception as e:
        conn.rollback()
        print(f"[!] เกิดข้อผิดพลาด: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    restore_data()