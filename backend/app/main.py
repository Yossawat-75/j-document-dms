import uuid
import re
import io
import os
import shutil
import csv
import json
import hashlib
import asyncio
import mimetypes
import urllib.parse
import jwt
import redis
from datetime import date, datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
from passlib.context import CryptContext

from app.core.config import settings
from app.services.storage import upload_file_to_minio, get_file_download_url, delete_file_from_minio, get_minio_client
from app.workers.ocr_worker import process_document_ocr, extract_structured_json

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password.startswith("$2"):
        return plain_password == hashed_password
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

app = FastAPI(title="J-Document DMS API", version="1.0.0")

JWT_SECRET = "docu-sense-secret-key-2026"
JWT_ALGORITHM = "HS256"
BUCKET_NAME = getattr(settings, "MINIO_BUCKET_NAME", getattr(settings, "MINIO_BUCKET", "dms-documents"))
SCANNER_INBOX_DIR = "/app/scanner_inbox"
REDIS_URL = getattr(settings, "REDIS_URL", "redis://redis:6379/0")

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    return psycopg2.connect(settings.DATABASE_URL)

def calculate_sha256(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()

def invalidate_cache(pattern: str = "dms:*"):
    try:
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
    except Exception:
        pass

def record_audit_log(username: str, action: str, document_id: Optional[str] = None, details: str = ""):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO audit_logs (username, action, document_id, details)
            VALUES (%s, %s, %s, %s);
            """,
            (username, action, document_id, details)
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        pass

def init_db_schema():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("ALTER TABLE document_extractions ADD COLUMN IF NOT EXISTS structured_data jsonb;")
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        pass

def generate_highlight_snippet(raw_text: str, query: str, max_len: int = 160) -> str:
    if not raw_text:
        return ""
    if not query or not query.strip():
        clean_text = " ".join(raw_text.split())
        return clean_text[:max_len] + ("..." if len(clean_text) > max_len else "")

    clean_text = " ".join(raw_text.split())
    pattern = re.compile(re.escape(query.strip()), re.IGNORECASE)
    match = pattern.search(clean_text)

    if match:
        start_idx = max(0, match.start() - 50)
        end_idx = min(len(clean_text), match.end() + 100)
        snippet = clean_text[start_idx:end_idx]
        if start_idx > 0:
            snippet = "..." + snippet
        if end_idx < len(clean_text):
            snippet = snippet + "..."
        return snippet
    else:
        return clean_text[:max_len] + ("..." if len(clean_text) > max_len else "")

async def watch_scanner_folder():
    os.makedirs(SCANNER_INBOX_DIR, exist_ok=True)
    while True:
        try:
            for file_name in os.listdir(SCANNER_INBOX_DIR):
                file_path = os.path.join(SCANNER_INBOX_DIR, file_name)
                if os.path.isfile(file_path) and not file_name.startswith('.'):
                    ext = os.path.splitext(file_name)[1].lower()
                    if ext in ['.pdf', '.png', '.jpg', '.jpeg']:
                        with open(file_path, "rb") as f:
                            file_bytes = f.read()

                        mime_type, _ = mimetypes.guess_type(file_path)
                        mime_type = mime_type or "application/octet-stream"
                        file_hash = calculate_sha256(file_bytes)
                        unique_file_name = f"{uuid.uuid4()}_{file_name}"
                        storage_key = upload_file_to_minio(file_bytes, unique_file_name, mime_type)
                        
                        doc_code = f"SCAN-{int(datetime.utcnow().timestamp())}"
                        doc_title = f"[Scanner] {os.path.splitext(file_name)[0]}"
                        today = date.today()

                        conn = get_db_connection()
                        cur = conn.cursor(cursor_factory=RealDictCursor)
                        cur.execute(
                            """
                            INSERT INTO documents (title, document_code, document_date, category_id, department_id, branch_id, file_name, file_hash, mime_type, storage_bucket, storage_key, current_version, status)
                            VALUES (%s, %s, %s, 1, 1, 1, %s, %s, %s, %s, %s, 1, 'PROCESSING')
                            RETURNING id;
                            """,
                            (doc_title, doc_code, today, file_name, file_hash, mime_type, BUCKET_NAME, storage_key)
                        )
                        doc = cur.fetchone()
                        doc_id = str(doc["id"])

                        try:
                            cur.execute(
                                """
                                INSERT INTO document_versions (document_id, version, file_name, storage_key, mime_type, file_hash, created_by)
                                VALUES (%s, 1, %s, %s, %s, %s, 'ScannerService');
                                """,
                                (doc_id, file_name, storage_key, mime_type, file_hash)
                            )
                        except Exception:
                            pass

                        conn.commit()
                        cur.close()
                        conn.close()

                        invalidate_cache()
                        record_audit_log("ScannerService", "SCANNER_AUTO_IMPORT", doc_id, f"Auto-imported from scanner: {file_name}")
                        process_document_ocr.delay(doc_id, storage_key, file_name)

                        os.remove(file_path)
        except Exception:
            pass
        await asyncio.sleep(5)

@app.on_event("startup")
async def startup_event():
    init_db_schema()
    asyncio.create_task(watch_scanner_folder())

# Models
class LoginRequest(BaseModel):
    username: str
    password: str

class UpdateDocRequest(BaseModel):
    title: str
    extracted_text: str
    tags: Optional[str] = ""
    username: Optional[str] = "admin"

class SimpleItemRequest(BaseModel):
    name: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "USER"

class BulkDeleteRequest(BaseModel):
    document_ids: List[str]
    username: Optional[str] = "admin"

# 1. Auth Endpoints
@app.post("/api/auth/login")
def login(req: LoginRequest):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT * FROM users WHERE username = %s;", (req.username,))
        user = cur.fetchone()
        if not user or not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง")

        payload = {
            "user_id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "full_name": user["full_name"],
            "exp": datetime.utcnow() + timedelta(hours=24)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        record_audit_log(user["username"], "LOGIN", None, f"User {user['username']} logged in")

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "full_name": user["full_name"],
                "role": user["role"]
            }
        }
    finally:
        cur.close()
        conn.close()

# 2. Master Meta Options & Smart Search Suggestions
@app.get("/api/meta/options")
def get_meta_options():
    cache_key = "dms:meta:options"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, name FROM categories ORDER BY id ASC;")
        categories = cur.fetchall() or []
        cur.execute("SELECT id, name FROM departments ORDER BY id ASC;")
        departments = cur.fetchall() or []
        cur.execute("SELECT id, name FROM branches ORDER BY id ASC;")
        branches = cur.fetchall() or []
        
        result = {
            "categories": categories, 
            "departments": departments, 
            "branches": branches
        }
        try:
            redis_client.setex(cache_key, 300, json.dumps(result))
        except Exception:
            pass
        return result
    except Exception:
        return {"categories": [], "departments": [], "branches": []}
    finally:
        cur.close()
        conn.close()

@app.get("/api/documents/suggestions")
def get_search_suggestions(q: str = Query(..., min_length=1)):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        query_like = f"%{q.strip()}%"
        cur.execute(
            """
            SELECT DISTINCT title FROM documents WHERE title ILIKE %s LIMIT 5;
            """,
            (query_like,)
        )
        titles = [r["title"] for r in cur.fetchall() or []]

        cur.execute(
            """
            SELECT DISTINCT tags FROM documents WHERE tags ILIKE %s AND tags != '' LIMIT 5;
            """,
            (query_like,)
        )
        tag_rows = cur.fetchall() or []
        tags = set()
        for r in tag_rows:
            for t in (r["tags"] or "").split(","):
                if q.strip().lower() in t.strip().lower() and t.strip():
                    tags.add(t.strip())

        return {"suggestions": list(set(titles + list(tags)))[:8]}
    except Exception:
        return {"suggestions": []}
    finally:
        cur.close()
        conn.close()

@app.post("/api/categories")
def add_category(req: SimpleItemRequest):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("INSERT INTO categories (name) VALUES (%s) RETURNING *;", (req.name,))
        cat = cur.fetchone()
        conn.commit()
        invalidate_cache("dms:meta:*")
        return cat
    finally:
        cur.close()
        conn.close()

@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM categories WHERE id = %s;", (category_id,))
        conn.commit()
        invalidate_cache("dms:meta:*")
        return {"message": "Category deleted"}
    finally:
        cur.close()
        conn.close()

@app.post("/api/departments")
def add_department(req: SimpleItemRequest):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("INSERT INTO departments (name) VALUES (%s) RETURNING *;", (req.name,))
        dep = cur.fetchone()
        conn.commit()
        invalidate_cache("dms:meta:*")
        return dep
    finally:
        cur.close()
        conn.close()

@app.delete("/api/departments/{department_id}")
def delete_department(department_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM departments WHERE id = %s;", (department_id,))
        conn.commit()
        invalidate_cache("dms:meta:*")
        return {"message": "Department deleted"}
    finally:
        cur.close()
        conn.close()

@app.post("/api/branches")
def add_branch(req: SimpleItemRequest):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("INSERT INTO branches (name) VALUES (%s) RETURNING *;", (req.name,))
        br = cur.fetchone()
        conn.commit()
        invalidate_cache("dms:meta:*")
        return br
    finally:
        cur.close()
        conn.close()

@app.delete("/api/branches/{branch_id}")
def delete_branch(branch_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM branches WHERE id = %s;", (branch_id,))
        conn.commit()
        invalidate_cache("dms:meta:*")
        return {"message": "Branch deleted"}
    finally:
        cur.close()
        conn.close()

# 3. User Management
@app.get("/api/users")
def get_users():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, username, full_name, role, created_at FROM users ORDER BY id ASC;")
        users = cur.fetchall() or []
        return {"users": users}
    finally:
        cur.close()
        conn.close()

@app.post("/api/users")
def create_user(req: CreateUserRequest):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        hashed_pwd = get_password_hash(req.password)
        cur.execute(
            """
            INSERT INTO users (username, password_hash, full_name, role)
            VALUES (%s, %s, %s, %s)
            RETURNING id, username, full_name, role;
            """,
            (req.username, hashed_pwd, req.full_name, req.role.upper())
        )
        new_user = cur.fetchone()
        conn.commit()
        return new_user
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Username already exists")
    finally:
        cur.close()
        conn.close()

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, current_username: Optional[str] = Query("admin")):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, username, full_name FROM users WHERE id = %s;", (user_id,))
        target_user = cur.fetchone()
        if not target_user:
            raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้งานนี้ในระบบ")

        if target_user["username"] == "admin":
            raise HTTPException(status_code=400, detail="ไม่สามารถลบบัญชี Admin หลักของระบบได้")

        if target_user["username"] == current_username:
            raise HTTPException(status_code=400, detail="คุณไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้")

        cur.execute("DELETE FROM users WHERE id = %s;", (user_id,))
        conn.commit()

        record_audit_log(
            current_username or "admin",
            "DELETE_USER",
            None,
            f"ลบผู้ใช้งาน: {target_user['username']} ({target_user['full_name']})"
        )

        return {"message": f"ลบผู้ใช้งาน {target_user['username']} เรียบร้อยแล้ว"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

# 4. Analytics & Graph Breakdown API (Redis Cached)
@app.get("/api/analytics/stats")
def get_dashboard_stats():
    cache_key = "dms:stats:dashboard"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT COUNT(*) as total_docs FROM documents;")
        total_row = cur.fetchone()
        total_docs = total_row["total_docs"] if total_row else 0

        cur.execute("SELECT COUNT(*) as completed_docs FROM documents WHERE status = 'COMPLETED';")
        completed_row = cur.fetchone()
        completed_docs = completed_row["completed_docs"] if completed_row else 0

        cur.execute("SELECT raw_text FROM document_extractions;")
        extractions = cur.fetchall() or []

        total_amount = 0.0
        for ext in extractions:
            meta = extract_structured_json(ext.get("raw_text") or "")
            if meta.get("grand_total"):
                total_amount += meta["grand_total"]

        cur.execute(
            """
            SELECT c.name, COUNT(d.id) as count 
            FROM documents d 
            LEFT JOIN categories c ON d.category_id = c.id 
            WHERE c.name IS NOT NULL
            GROUP BY c.name 
            ORDER BY count DESC 
            LIMIT 1;
            """
        )
        top_cat = cur.fetchone()

        cur.execute(
            """
            SELECT COALESCE(dep.name, 'ไม่ระบุ') as name, COUNT(d.id) as count
            FROM documents d
            LEFT JOIN departments dep ON d.department_id = dep.id
            GROUP BY dep.name
            ORDER BY count DESC;
            """
        )
        dept_stats = cur.fetchall() or []

        cur.execute(
            """
            SELECT COALESCE(c.name, 'ทั่วไป') as name, COUNT(d.id) as count
            FROM documents d
            LEFT JOIN categories c ON d.category_id = c.id
            GROUP BY c.name
            ORDER BY count DESC;
            """
        )
        cat_stats = cur.fetchall() or []

        result = {
            "total_documents": total_docs,
            "completed_documents": completed_docs,
            "total_amount_extracted": total_amount,
            "top_category": top_cat["name"] if top_cat and top_cat.get("name") else "ทั่วไป",
            "department_breakdown": dept_stats,
            "category_breakdown": cat_stats
        }

        try:
            redis_client.setex(cache_key, 5, json.dumps(result))
        except Exception:
            pass

        return result
    except Exception:
        return {
            "total_documents": 0,
            "completed_documents": 0,
            "total_amount_extracted": 0.0,
            "top_category": "ทั่วไป",
            "department_breakdown": [],
            "category_breakdown": []
        }
    finally:
        cur.close()
        conn.close()

# 5. Audit Logging
@app.get("/api/audit-logs")
def get_audit_logs(limit: int = 50):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT %s;", (limit,))
        logs = cur.fetchall() or []
        return {"logs": logs}
    except Exception:
        return {"logs": []}
    finally:
        cur.close()
        conn.close()

# 6. Document Storage & Operations
@app.get("/api/documents/export")
def export_documents_csv():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT d.id, d.document_code, d.title, d.document_date, d.status, d.file_name,
                   COALESCE(c.name, 'ทั่วไป') as category_name, 
                   COALESCE(dep.name, 'ทั่วไป') as department_name, 
                   de.raw_text
            FROM documents d
            LEFT JOIN categories c ON d.category_id = c.id
            LEFT JOIN departments dep ON d.department_id = dep.id
            LEFT JOIN document_extractions de ON d.id = de.document_id
            ORDER BY d.created_at DESC;
            """
        )
        records = cur.fetchall() or []

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'Document Code', 'Title', 'Date', 'Category', 'Department', 'Status', 'Total Amount', 'Tax ID', 'File Name'])

        for r in records:
            meta = extract_structured_json(r['raw_text'] or '')
            writer.writerow([
                str(r['id']),
                r['document_code'],
                r['title'],
                str(r['document_date']),
                r['category_name'],
                r['department_name'],
                r['status'],
                meta.get('grand_total') or '',
                meta.get('tax_id') or '',
                r['file_name']
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=dms_documents_export.csv"}
        )
    finally:
        cur.close()
        conn.close()

@app.post("/api/documents/upload")
async def upload_document(
    title: str = Form(...),
    document_code: str = Form(...),
    document_date: date = Form(...),
    category_id: int = Form(1),
    department_id: int = Form(1),
    branch_id: int = Form(1),
    tags: str = Form(""),
    username: str = Form("admin"),
    file: UploadFile = File(...)
):
    file_bytes = await file.read()
    file_hash = calculate_sha256(file_bytes)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, title, document_code FROM documents WHERE (file_hash = %s AND file_hash IS NOT NULL) OR document_code = %s LIMIT 1;", (file_hash, document_code))
        duplicate = cur.fetchone()
        if duplicate:
            raise HTTPException(
                status_code=409, 
                detail=f"ตรวจพบเอกสารซ้ำ! เอกสาร '{duplicate['title']}' (รหัส: {duplicate['document_code']}) มีอยู่ในระบบแล้ว"
            )

        unique_file_name = f"{uuid.uuid4()}_{file.filename}"
        mime_type = file.content_type or "application/octet-stream"
        storage_key = upload_file_to_minio(file_bytes, unique_file_name, mime_type)

        cur.execute(
            """
            INSERT INTO documents (title, document_code, document_date, category_id, department_id, branch_id, tags, file_name, file_hash, mime_type, storage_bucket, storage_key, current_version, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, 'PROCESSING')
            RETURNING id, title, document_code, status;
            """,
            (title, document_code, document_date, category_id, department_id, branch_id, tags, file.filename, file_hash, mime_type, BUCKET_NAME, storage_key)
        )
        doc = cur.fetchone()
        doc_id = str(doc["id"])

        try:
            cur.execute(
                """
                INSERT INTO document_versions (document_id, version, file_name, storage_key, mime_type, file_hash, created_by)
                VALUES (%s, 1, %s, %s, %s, %s, %s);
                """,
                (doc_id, file.filename, storage_key, mime_type, file_hash, username)
            )
        except Exception:
            pass

        conn.commit()

        invalidate_cache()
        record_audit_log(username, "UPLOAD", doc_id, f"Uploaded: {file.filename} ({title}) [v1]")
        process_document_ocr.delay(doc_id, storage_key, file.filename)

        return {"message": "Document uploaded successfully", "document": doc}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.post("/api/documents/{document_id}/new-version")
async def upload_new_version(
    document_id: str,
    username: str = Form("admin"),
    file: UploadFile = File(...)
):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT current_version, title FROM documents WHERE id = %s;", (document_id,))
        doc = cur.fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        new_version_num = (doc["current_version"] or 1) + 1
        file_bytes = await file.read()
        file_hash = calculate_sha256(file_bytes)
        unique_file_name = f"{uuid.uuid4()}_{file.filename}"
        mime_type = file.content_type or "application/octet-stream"
        storage_key = upload_file_to_minio(file_bytes, unique_file_name, mime_type)

        cur.execute(
            """
            UPDATE documents 
            SET current_version = %s, file_name = %s, file_hash = %s, mime_type = %s, storage_key = %s, status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
            """,
            (new_version_num, file.filename, file_hash, mime_type, storage_key, document_id)
        )

        try:
            cur.execute(
                """
                INSERT INTO document_versions (document_id, version, file_name, storage_key, mime_type, file_hash, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
                """,
                (document_id, new_version_num, file.filename, storage_key, mime_type, file_hash, username)
            )
        except Exception:
            pass

        conn.commit()

        invalidate_cache()
        record_audit_log(username, "UPLOAD_NEW_VERSION", document_id, f"Uploaded new version v{new_version_num}: {file.filename}")
        process_document_ocr.delay(document_id, storage_key, file.filename)

        return {"message": f"Version {new_version_num} uploaded successfully", "version": new_version_num}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/documents/{document_id}/versions")
def get_document_versions(document_id: str):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT id, version, file_name, created_by, created_at
            FROM document_versions
            WHERE document_id = %s
            ORDER BY version DESC;
            """,
            (document_id,)
        )
        versions = cur.fetchall() or []
        return {"versions": versions}
    except Exception:
        return {"versions": []}
    finally:
        cur.close()
        conn.close()

# ⭐️ ปรับปรุง Bulk Upload ให้รองรับ code_prefix และ document_date พร้อมรันลำดับ 001, 002...
@app.post("/api/documents/bulk-upload")
async def bulk_upload_documents(
    category_id: int = Form(1),
    department_id: int = Form(1),
    branch_id: int = Form(1),
    tags: str = Form(""),
    code_prefix: str = Form("DOC-"),
    document_date: Optional[date] = Form(None),
    username: str = Form("admin"),
    files: List[UploadFile] = File(...)
):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    uploaded_docs = []
    skipped_count = 0
    today = document_date or date.today()
    prefix = code_prefix.strip() or "DOC-"
    if not prefix.endswith("-") and not prefix.endswith("/"):
        prefix += "-"

    try:
        # 🔍 1. ค้นหาในฐานข้อมูลว่า Prefix นี้เคยรันเลขไปถึงเท่าไหร่แล้ว
        cur.execute(
            """
            SELECT document_code 
            FROM documents 
            WHERE document_code LIKE %s;
            """,
            (f"{prefix}%",)
        )
        existing_codes = cur.fetchall() or []
        
        max_seq = 0
        for row in existing_codes:
            code_str = row["document_code"]
            # ดึงเฉพาะตัวเลขที่อยู่ท้าย Prefix ออกมา
            suffix = code_str[len(prefix):]
            if suffix.isdigit():
                num = int(suffix)
                if num > max_seq:
                    max_seq = num

        # 🔍 2. เริ่มรันเลขต่อจากค่าสูงสุดที่เคยมี (เช่น เดิมมี 4 -> เริ่มที่ 5)
        current_seq = max_seq

        for file in files:
            file_bytes = await file.read()
            file_hash = calculate_sha256(file_bytes)

            cur.execute("SELECT id FROM documents WHERE file_hash = %s AND file_hash IS NOT NULL LIMIT 1;", (file_hash,))
            if cur.fetchone():
                skipped_count += 1
                continue

            current_seq += 1
            unique_file_name = f"{uuid.uuid4()}_{file.filename}"
            mime_type = file.content_type or "application/octet-stream"
            storage_key = upload_file_to_minio(file_bytes, unique_file_name, mime_type)
            
            # ออกรหัสรันต่อจากเลขล่าสุด ไม่ซ้ำ 100%
            doc_code = f"{prefix}{str(current_seq).zfill(3)}"
            doc_title = os.path.splitext(file.filename)[0]

            cur.execute(
                """
                INSERT INTO documents (title, document_code, document_date, category_id, department_id, branch_id, tags, file_name, file_hash, mime_type, storage_bucket, storage_key, current_version, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, 'PROCESSING')
                RETURNING id, title, document_code, status;
                """,
                (doc_title, doc_code, today, category_id, department_id, branch_id, tags, file.filename, file_hash, mime_type, BUCKET_NAME, storage_key)
            )
            doc = cur.fetchone()
            doc_id = str(doc["id"])
            uploaded_docs.append(doc)

            try:
                cur.execute(
                    """
                    INSERT INTO document_versions (document_id, version, file_name, storage_key, mime_type, file_hash, created_by)
                    VALUES (%s, 1, %s, %s, %s, %s, %s);
                    """,
                    (doc_id, file.filename, storage_key, mime_type, file_hash, username)
                )
            except Exception:
                pass
            
            record_audit_log(username, "BULK_UPLOAD", doc_id, f"Bulk uploaded: {file.filename} ({doc_code})")
            process_document_ocr.delay(doc_id, storage_key, file.filename)

        conn.commit()
        invalidate_cache()
        return {
            "message": f"Successfully uploaded {len(uploaded_docs)} documents" + (f" (ข้าม {skipped_count} ไฟล์ซ้ำ)" if skipped_count > 0 else ""),
            "documents": uploaded_docs,
            "skipped": skipped_count
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.post("/api/documents/bulk-delete")
def bulk_delete_documents(req: BulkDeleteRequest):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    deleted_count = 0
    try:
        for doc_id in req.document_ids:
            cur.execute("SELECT storage_key, document_code FROM documents WHERE id = %s;", (doc_id,))
            doc = cur.fetchone()
            if doc:
                delete_file_from_minio(doc["storage_key"])
                cur.execute("DELETE FROM document_extractions WHERE document_id = %s;", (doc_id,))
                cur.execute("DELETE FROM document_versions WHERE document_id = %s;", (doc_id,))
                cur.execute("DELETE FROM documents WHERE id = %s;", (doc_id,))
                record_audit_log(req.username, "BULK_DELETE", doc_id, f"Deleted document {doc['document_code']}")
                deleted_count += 1

        conn.commit()
        invalidate_cache()
        return {"message": f"ลบเอกสารสำเร็จ {deleted_count} ฉบับ"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.post("/api/documents/{document_id}/retry-ocr")
def retry_document_ocr(document_id: str, username: Optional[str] = Query("system")):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT storage_key, file_name, document_code FROM documents WHERE id = %s;", (document_id,))
        doc = cur.fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        record_audit_log(username, "RETRY_OCR", document_id, f"Retrying OCR for {doc['document_code']}")
        
        process_document_ocr(document_id, doc["storage_key"], doc["file_name"])

        cur.execute("SELECT raw_text FROM document_extractions WHERE document_id = %s;", (document_id,))
        ext = cur.fetchone()
        new_text = ext["raw_text"] if ext and ext.get("raw_text") else ""
        new_structured = extract_structured_json(new_text)

        invalidate_cache()
        return {
            "message": "OCR processed successfully",
            "extracted_text": new_text,
            "structured_data": new_structured,
            "smart_meta": {
                "tax_id": new_structured.get("tax_id"),
                "total_amount": new_structured.get("grand_total"),
                "organization": new_structured.get("organization")
            }
        }
    finally:
        cur.close()
        conn.close()

@app.get("/api/documents/search")
def search_documents(
    q: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    cache_key = f"dms:search:{q}:{category_id}:{department_id}:{branch_id}:{start_date}:{end_date}"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        conditions = []
        params = []

        if q and q.strip():
            search_query = f"%{q.strip()}%"
            conditions.append("(d.title ILIKE %s OR d.document_code ILIKE %s OR COALESCE(d.tags, '') ILIKE %s OR COALESCE(de.raw_text, '') ILIKE %s)")
            params.extend([search_query, search_query, search_query, search_query])

        if category_id is not None and category_id > 0:
            conditions.append("d.category_id = %s")
            params.append(category_id)

        if department_id is not None and department_id > 0:
            conditions.append("d.department_id = %s")
            params.append(department_id)

        if branch_id is not None and branch_id > 0:
            conditions.append("d.branch_id = %s")
            params.append(branch_id)

        if start_date and start_date.strip():
            conditions.append("d.document_date >= %s")
            params.append(start_date.strip())

        if end_date and end_date.strip():
            conditions.append("d.document_date <= %s")
            params.append(end_date.strip())

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        query_str = f"""
            SELECT d.id, d.title, d.document_code, d.document_date, d.status, d.file_name,
                   COALESCE(d.current_version, 1) as current_version,
                   COALESCE(d.tags, '') as tags, d.created_at,
                   COALESCE(c.name, 'ทั่วไป') as category_name, 
                   COALESCE(dep.name, 'ทั่วไป') as department_name, 
                   COALESCE(b.name, 'สำนักงานใหญ่ (HQ)') as branch_name,
                   COALESCE(de.raw_text, '') as full_raw_text
            FROM documents d
            LEFT JOIN categories c ON d.category_id = c.id
            LEFT JOIN departments dep ON d.department_id = dep.id
            LEFT JOIN branches b ON d.branch_id = b.id
            LEFT JOIN document_extractions de ON d.id = de.document_id
            {where_clause}
            ORDER BY d.document_date DESC, d.document_code ASC;
        """
        cur.execute(query_str, tuple(params))
        results = cur.fetchall() or []
        
        clean_results = []
        for r in results:
            snippet = generate_highlight_snippet(r["full_raw_text"], q or "")
            clean_results.append({
                "id": str(r["id"]),
                "title": r["title"],
                "document_code": r["document_code"],
                "document_date": str(r["document_date"]),
                "status": r["status"],
                "file_name": r["file_name"],
                "current_version": r.get("current_version", 1),
                "tags": r["tags"] or "",
                "category_name": r["category_name"],
                "department_name": r["department_name"],
                "branch_name": r["branch_name"],
                "snippet": snippet
            })
        
        final_data = {"results": clean_results}
        try:
            redis_client.setex(cache_key, 5, json.dumps(final_data))
        except Exception:
            pass

        return final_data
    except Exception:
        return {"results": []}
    finally:
        cur.close()
        conn.close()

@app.get("/api/documents/{document_id}")
def get_document_detail(document_id: str, username: Optional[str] = Query("system")):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT d.id, d.document_code, d.title, d.document_date, d.status, d.file_name, d.mime_type,
                   COALESCE(d.current_version, 1) as current_version,
                   COALESCE(d.tags, '') as tags,
                   COALESCE(c.name, 'ทั่วไป') as category_name, 
                   COALESCE(dep.name, 'ทั่วไป') as department_name, 
                   COALESCE(b.name, 'สำนักงานใหญ่ (HQ)') as branch_name
            FROM documents d
            LEFT JOIN categories c ON d.category_id = c.id
            LEFT JOIN departments dep ON d.department_id = dep.id
            LEFT JOIN branches b ON d.branch_id = b.id
            WHERE d.id = %s;
            """, 
            (document_id,)
        )
        doc = cur.fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        cur.execute("SELECT raw_text FROM document_extractions WHERE document_id = %s LIMIT 1;", (document_id,))
        ext = cur.fetchone()
        
        raw_text = ext["raw_text"] if ext and ext.get("raw_text") else ""
        structured_data = extract_structured_json(raw_text)
        download_url = f"http://localhost:8000/api/documents/{doc['id']}/file"

        record_audit_log(username, "VIEW", str(doc["id"]), f"Inspected document {doc['document_code']}")

        return {
            "id": str(doc["id"]),
            "document_code": doc["document_code"],
            "title": doc["title"],
            "status": doc["status"],
            "current_version": doc.get("current_version", 1),
            "document_date": str(doc["document_date"]),
            "category_name": doc["category_name"],
            "department_name": doc["department_name"],
            "branch_name": doc["branch_name"],
            "tags": doc.get("tags") or "",
            "file_name": doc["file_name"],
            "mime_type": doc.get("mime_type", "application/pdf"),
            "extracted_text": raw_text,
            "download_url": download_url,
            "smart_meta": {
                "tax_id": structured_data.get("tax_id"),
                "total_amount": structured_data.get("grand_total"),
                "organization": structured_data.get("organization")
            },
            "structured_data": structured_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/documents/{document_id}/file")
def get_document_file(document_id: str, download: bool = False, username: Optional[str] = Query("system")):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT storage_key, mime_type, file_name, document_code FROM documents WHERE id = %s;", (document_id,))
        doc = cur.fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        minio_client = get_minio_client()
        response = minio_client.get_object(BUCKET_NAME, doc["storage_key"])
        
        disposition_type = "attachment" if download else "inline"
        if download:
            record_audit_log(username, "DOWNLOAD", document_id, f"Downloaded file: {doc['file_name']}")

        encoded_filename = urllib.parse.quote(doc["file_name"])
        content_disposition = f"{disposition_type}; filename*=UTF-8''{encoded_filename}"

        return StreamingResponse(
            response.stream(64 * 1024),
            media_type=doc["mime_type"] or "application/octet-stream",
            headers={
                "Content-Disposition": content_disposition,
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.put("/api/documents/{document_id}")
def update_document(document_id: str, req: UpdateDocRequest):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("UPDATE documents SET title = %s, tags = %s WHERE id = %s;", (req.title, req.tags, document_id))
        
        cur.execute("SELECT id FROM document_extractions WHERE document_id = %s;", (document_id,))
        exists = cur.fetchone()
        if exists:
            cur.execute("UPDATE document_extractions SET raw_text = %s WHERE document_id = %s;", (req.extracted_text, document_id))
        else:
            cur.execute("INSERT INTO document_extractions (document_id, raw_text) VALUES (%s, %s);", (document_id, req.extracted_text))
            
        conn.commit()
        invalidate_cache()
        record_audit_log(req.username, "UPDATE", document_id, f"Edited text/title of {req.title}")
        return {"message": "Updated successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str, username: Optional[str] = Query("admin")):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT storage_key, document_code FROM documents WHERE id = %s;", (document_id,))
        doc = cur.fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        storage_key = doc["storage_key"]
        doc_code = doc["document_code"]
        
        cur.execute("DELETE FROM document_extractions WHERE document_id = %s;", (document_id,))
        cur.execute("DELETE FROM documents WHERE id = %s;", (document_id,))
        conn.commit()

        delete_file_from_minio(storage_key)
        invalidate_cache()
        record_audit_log(username, "DELETE", document_id, f"Deleted document {doc_code}")

        return {"message": "Document deleted successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()