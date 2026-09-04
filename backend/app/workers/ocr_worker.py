import io
import os
import re
import json
import shutil
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from celery import Celery
from PIL import Image
import fitz  # PyMuPDF
import pytesseract
import redis

from app.core.config import settings
from app.services.storage import get_minio_client

if os.name == 'nt':
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
else:
    pytesseract.pytesseract.tesseract_cmd = shutil.which('tesseract') or '/usr/bin/tesseract'

BROKER_URL = getattr(settings, "CELERY_BROKER_URL", getattr(settings, "REDIS_URL", "redis://redis:6379/0"))
RESULT_BACKEND = getattr(settings, "CELERY_RESULT_BACKEND", getattr(settings, "REDIS_URL", "redis://redis:6379/0"))

celery_app = Celery("dms_worker", broker=BROKER_URL, backend=RESULT_BACKEND)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Bangkok",
    enable_utc=True,
)

BUCKET_NAME = getattr(settings, "MINIO_BUCKET_NAME", getattr(settings, "MINIO_BUCKET", "dms-documents"))
redis_client = redis.Redis.from_url(BROKER_URL, decode_responses=True)

def invalidate_cache(pattern: str = "dms:*"):
    try:
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
    except Exception:
        pass

def get_db_connection():
    return psycopg2.connect(settings.DATABASE_URL)

def extract_structured_json(text: str) -> dict:
    tax = re.search(r'(?:tax|เลขประจำตัวผู้เสียภาษี|ผู้เสียภาษี)[:\s]*(\d{13}|\d{1}-\d{4}-\d{5}-\d{2}-\d{1})', text, re.IGNORECASE)
    doc_num = re.search(r'(?:เลขที่รายการ|เลขที่เอกสาร|เลขที่|no\.|invoice no|receipt no|doc no|ที่ อว\.)[:\s]*([a-zA-Z0-9\.\-\/]+)', text, re.IGNORECASE)
    date_match = re.search(r'(?:วันที่|date|พิมพ์รายการเมื่อ)[:\s]*([0-9]{1,2}[\/\-\.\s]+[a-zA-Zก-๙0-9]+[\/\-\.\s]+[0-9]{2,4})', text, re.IGNORECASE)
    org = re.search(r'(?:มหาวิทยาลัย|บริษัท|ห้างหุ้นส่วนจำกัด|บจก\.|หจก\.)\s*([^\n\r]+)', text)
    phone = re.search(r'(?:โทร|tel|phone)[:\s]*([0-9]{2,3}[\-]?[0-9]{3}[\-]?[0-9]{4})', text, re.IGNORECASE)
    email = re.search(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', text)

    clean_amounts = []

    # 1. ดักจับยอดเงินที่มีคีย์เวิร์ดนำหน้า (รองรับคำคั่นกลางและ Newlines)
    keyword_amounts = re.findall(
        r'(?:total|grand total|amount|net amount|รวมทั้งสิ้น|จำนวนเงินรวม|จำนวนเงินทั้งหมด|ยอดสุทธิ|จำนวนเงิน|ราคารวม|ค่าบำรุง|ค่าลงทะเบียน|เป็นเงิน|รวม|baht|บาท|thb|฿)[^\d\n\r]{0,30}[\:\s\=]*([0-9]{1,3}(?:,[0-9]{3})*\.\d{2})',
        text,
        re.IGNORECASE
    )
    for a in keyword_amounts:
        try:
            val = float(a.replace(',', ''))
            if val > 0:
                clean_amounts.append(val)
        except Exception:
            pass

    # 2. ดักจับตัวเลขที่มี Comma คั่นหลักพันและทศนิยม 2 ตำแหน่ง (เช่น 8,000.00) โดยไม่ติดเลขที่หนังสือ
    comma_amounts = re.findall(r'(?<![\d\.\-\/])([0-9]{1,3}(?:,[0-9]{3})+\.\d{2})(?![\d\.\-\/])', text)
    for a in comma_amounts:
        try:
            val = float(a.replace(',', ''))
            if val > 0:
                clean_amounts.append(val)
        except Exception:
            pass

    grand_total = max(clean_amounts) if clean_amounts else None

    # สรุปใจความเอกสารแบบย่อ
    summary_parts = []
    if org:
        summary_parts.append(f"หน่วยงาน/องค์กร: {org.group(0).strip()}")
    if doc_num:
        summary_parts.append(f"รหัสอ้างอิง: {doc_num.group(1).strip()}")
    if grand_total:
        summary_parts.append(f"ยอดเงิน: ฿{grand_total:,.2f}")
    
    summary_text = " | ".join(summary_parts) if summary_parts else (text[:120].strip() + "..." if text else "ไม่มีข้อมูลสรุป")

    return {
        "organization": org.group(0).strip() if org else None,
        "tax_id": tax.group(1).replace("-", "") if tax else None,
        "document_number": doc_num.group(1).strip() if doc_num else None,
        "document_date": date_match.group(1).strip() if date_match else None,
        "contact_phone": phone.group(1).strip() if phone else None,
        "contact_email": email.group(1).strip() if email else None,
        "grand_total": grand_total,
        "summary": summary_text
    }

def auto_generate_tags(text: str, current_tags: str = "") -> str:
    tags = set([t.strip() for t in current_tags.split(',') if t.strip()])
    lower_text = text.lower()

    if any(k in lower_text for k in ['ใบกำกับภาษี', 'tax invoice', 'ภาษีมูลค่าเพิ่ม', 'vat']):
        tags.add('#ภาษี')
    if any(k in lower_text for k in ['ใบเสร็จ', 'ใบแจ้งยอด', 'การชำระเงิน', 'receipt', 'บิล']):
        tags.add('#การเงิน')
    if any(k in lower_text for k in ['สัญญา', 'agreement', 'contract', 'ข้อตกลง']):
        tags.add('#สัญญา')
    if any(k in lower_text for k in ['ใบสั่งซื้อ', 'purchase order', 'po']):
        tags.add('#จัดซื้อ')
    if any(k in lower_text for k in ['หนังสือส่งตัว', 'ฝึกงาน', 'สหกิจศึกษา']):
        tags.add('#สหกิจศึกษา')
    if any(k in lower_text for k in ['ด่วน', 'urgent', 'ด่วนที่สุด']):
        tags.add('#ด่วน')

    meta = extract_structured_json(text)
    if meta["grand_total"] and meta["grand_total"] >= 50000:
        tags.add('#ยอดสูง')

    return ", ".join(tags)

def auto_classify_category(text: str):
    lower_text = text.lower()
    if any(k in lower_text for k in ['ใบเสร็จ', 'ใบกำกับภาษี', 'ใบแจ้งยอด', 'การชำระเงิน', 'receipt']):
        return 1
    elif any(k in lower_text for k in ['สัญญา', 'contract', 'agreement', 'ข้อตกลง']):
        return 2
    elif any(k in lower_text for k in ['ใบสั่งซื้อ', 'purchase order', 'po']):
        return 3
    elif any(k in lower_text for k in ['หนังสือราชการ', 'บันทึกข้อความ', 'คำสั่ง', 'หนังสือส่งตัว', 'ขอส่งนักศึกษา']):
        return 5
    return None

@celery_app.task(name="tasks.process_document_ocr", bind=True, max_retries=3)
def process_document_ocr(self, document_id: str, storage_key: str, file_name: str):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("SELECT tags FROM documents WHERE id = %s;", (document_id,))
        existing_doc = cur.fetchone()
        current_tags = existing_doc["tags"] if existing_doc and existing_doc.get("tags") else ""

        cur.execute("UPDATE documents SET status = 'PROCESSING' WHERE id = %s;", (document_id,))
        conn.commit()
        cur.close()

        minio_client = get_minio_client()
        response = minio_client.get_object(BUCKET_NAME, storage_key)
        file_bytes = response.read()
        response.close()
        response.release_conn()

        extracted_text = ""
        if file_name.lower().endswith('.pdf'):
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            full_text = []
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                txt = page.get_text()
                try:
                    pix = page.get_pixmap(dpi=200)
                    raw_img = Image.open(io.BytesIO(pix.tobytes("png")))
                    ocr_txt = pytesseract.image_to_string(raw_img, lang='tha+eng')
                    if len(ocr_txt.strip()) > 20:
                        txt = ocr_txt
                except Exception:
                    pass
                if txt.strip():
                    full_text.append(txt)
            extracted_text = "\n\n".join(full_text)
        else:
            try:
                raw_img = Image.open(io.BytesIO(file_bytes))
                extracted_text = pytesseract.image_to_string(raw_img, lang='tha+eng')
            except Exception:
                pass

        detected_cat_id = auto_classify_category(extracted_text)
        enriched_tags = auto_generate_tags(extracted_text, current_tags)
        structured_meta = extract_structured_json(extracted_text)

        cur = conn.cursor()
        cur.execute("DELETE FROM document_extractions WHERE document_id = %s;", (document_id,))
        
        cur.execute(
            """
            INSERT INTO document_extractions (document_id, raw_text, structured_data)
            VALUES (%s, %s, %s);
            """,
            (document_id, extracted_text, Json(structured_meta))
        )

        if detected_cat_id:
            cur.execute(
                """
                UPDATE documents 
                SET status = 'COMPLETED', category_id = %s, tags = %s
                WHERE id = %s;
                """,
                (detected_cat_id, enriched_tags, document_id)
            )
        else:
            cur.execute("UPDATE documents SET status = 'COMPLETED', tags = %s WHERE id = %s;", (enriched_tags, document_id))

        conn.commit()
        cur.close()

        invalidate_cache()
        return {"status": "SUCCESS", "document_id": document_id, "structured_data": structured_meta}

    except Exception as exc:
        if conn:
            conn.rollback()
            try:
                fail_cur = conn.cursor()
                fail_cur.execute("UPDATE documents SET status = 'FAILED' WHERE id = %s;", (document_id,))
                conn.commit()
                fail_cur.close()
            except:
                pass
        raise self.retry(exc=exc, countdown=5)
    finally:
        if conn:
            conn.close()