import os
import psycopg2
from psycopg2.extras import RealDictCursor

# ค่าเชื่อมต่อ Database
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "password123")
DB_NAME = os.getenv("POSTGRES_DB", "dms_db")

def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        dbname=DB_NAME
    )

def reset_and_seed_data():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        print("[*] กำลังล้างข้อมูลจริงที่ไม่ควรเผยแพร่ออก...")
        cur.execute("DELETE FROM audit_logs;")
        cur.execute("DELETE FROM documents;")
        cur.execute("DELETE FROM branches;")
        cur.execute("DELETE FROM departments;")
        cur.execute("DELETE FROM categories;")
        cur.execute("DELETE FROM users;")

        print("[*] กำลังสร้างข้อมูลแผนกและสาขาจำลอง (Mock Master Data)...")
        # 1. แผนกจำลอง (ไม่ใช้ชื่อเฉพาะภายใน)
        departments = ["แผนกเทคโนโลยีสารสนเทศ", "แผนกการเงินและบัญชี", "แผนกบริหารทรัพยากรบุคคล", "แผนกจัดซื้อและพัสดุ"]
        dept_ids = []
        for d in departments:
            cur.execute("INSERT INTO departments (name) VALUES (%s) RETURNING id;", (d,))
            dept_ids.append(cur.fetchone()["id"])

        # 2. สาขาจำลอง (ไม่ระบุสาขาจริงของบริษัท)
        branches = ["สำนักงานใหญ่ (ส่วนกลาง)", "สาขาภูมิภาค A", "สาขาภูมิภาค B", "สาขาภูมิภาค C"]
        branch_ids = []
        for b in branches:
            cur.execute("INSERT INTO branches (name) VALUES (%s) RETURNING id;", (b,))
            branch_ids.append(cur.fetchone()["id"])

        # 3. หมวดหมู่จำลอง
        categories = ["ใบสั่งซื้อ (PO)", "ใบเสร็จรับเงิน/ใบกำกับภาษี", "สัญญาจ้างและข้อตกลง", "หนังสือราชการและเอกสารภายนอก"]
        cat_ids = []
        for c in categories:
            cur.execute("INSERT INTO categories (name) VALUES (%s) RETURNING id;", (c,))
            cat_ids.append(cur.fetchone()["id"])

        print("[*] กำลังสร้างรายชื่อผู้ใช้งานจำลอง (Mock Users)...")
        # 4. ผู้ใช้จำลอง (แทนที่ admin, yosswat, microsoft_user)
        # รหัสผ่านคือ dummy hash
        dummy_hash = "$2b$12$e80yVqg6q8Uu.WvM7E1bTeo5V5d2qP3E4mUuD6S7F8G9H0J1K2L3M"
        mock_users = [
            ("admin_demo", "System Administrator", "ADMIN", dept_ids[0]),
            ("officer_finance", "Sompong Jaidee", "USER", dept_ids[1]),
            ("officer_hr", "Suda Raksa", "USER", dept_ids[2]),
            ("officer_procure", "Wichai Manee", "USER", dept_ids[3]),
            ("guest_tester", "Demo Guest Account", "USER", dept_ids[0])
        ]
        for u in mock_users:
            cur.execute(
                "INSERT INTO users (username, password_hash, full_name, role, department_id) VALUES (%s, %s, %s, %s, %s);",
                (u[0], dummy_hash, u[1], u[2], u[3])
            )

        print("[*] กำลังสร้างบันทึกประวัติการใช้งานจำลอง (Mock Audit Logs)...")
        # 5. ประวัติการใช้งานจำลอง (ล้าง Timestamp จริงและรหัสเอกสารจริงออก)
        mock_logs = [
            ("LOGIN", "admin_demo", "เข้าสู่ระบบเพื่อตรวจสอบสถิติประจำวัน"),
            ("VIEW", "officer_finance", "เปิดตรวจสอบเอกสาร DOC-1002"),
            ("LOGIN", "officer_hr", "เข้าสู่ระบบเพื่อจัดการเอกสารสัญญา"),
            ("RETRY_OCR", "admin_demo", "สั่งประมวลผล OCR ซ้ำสำหรับเอกสาร DOC-1005"),
            ("DOWNLOAD", "officer_procure", "ดาวน์โหลดไฟล์เอกสารต้นฉบับ DOC-1001")
        ]
        for l in mock_logs:
            cur.execute(
                "INSERT INTO audit_logs (action, username, details, created_at) VALUES (%s, %s, %s, NOW());",
                (l[0], l[1], l[2])
            )

        conn.commit()
        print("[✓] สร้างข้อมูลจำลองสำหรับแคปรูปภาพส่งเล่มรายงานเสร็จสมบูรณ์ 100%")
    except Exception as e:
        conn.rollback()
        print(f"[!] เกิดข้อผิดพลาด: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    reset_and_seed_data()