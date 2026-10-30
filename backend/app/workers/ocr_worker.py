import io
import os
import re
import csv
import json
import shutil
import zipfile
import xml.etree.ElementTree as ET
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from celery import Celery
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import fitz  # PyMuPDF
import pytesseract
import redis

try:
    import openpyxl
except ImportError:
    openpyxl = None

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

BUCKET_NAME = settings.MINIO_BUCKET_NAME
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

def sanitize_text(text: str) -> str:
    """ลบ Null Byte (0x00) ทั้งหมดเพื่อป้องกัน PostgreSQL พัง"""
    if not text:
        return ""
    return text.replace('\x00', '')

# -------------------------------------------------------------
# Smart Image Pre-processing for High Accuracy Thai/Eng OCR
# -------------------------------------------------------------
def preprocess_image_pass1(img: Image.Image) -> Image.Image:
    if img.width < 1600:
        scale = 1800.0 / img.width
        new_size = (int(img.width * scale), int(img.height * scale))
        img = img.resize(new_size, Image.Resampling.LANCZOS)
    
    gray = img.convert('L')
    sharpened = gray.filter(ImageFilter.SHARPEN)
    enhancer = ImageEnhance.Contrast(sharpened)
    return enhancer.enhance(1.8)

def preprocess_image_pass2(img: Image.Image) -> Image.Image:
    gray = img.convert('L')
    gray = ImageOps.autocontrast(gray, cutoff=2)
    enhancer = ImageEnhance.Contrast(gray)
    contrasted = enhancer.enhance(2.2)
    threshold = 165
    table = [0 if i < threshold else 255 for i in range(256)]
    return contrasted.point(table, '1')

def clean_thai_ocr_text(text: str) -> str:
    if not text:
        return ""
    text = sanitize_text(text)
    text = re.sub(r'([ก-ฮ])\s+([ก-ฮ])\s+([ก-ฮ])', r'\1\2\3', text)
    text = re.sub(r'([ก-ฮ])\s+([ก-ฮ])', r'\1\2', text)
    lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in text.split('\n')]
    return '\n'.join([l for l in lines if l])

def run_tesseract_ocr(img: Image.Image) -> str:
    custom_cfg = '--oem 1 --psm 3 -c preserve_interword_spaces=1'
    try:
        img1 = preprocess_image_pass1(img)
        txt1 = pytesseract.image_to_string(img1, lang='tha+eng', config=custom_cfg)
        clean1 = clean_thai_ocr_text(txt1)
        
        if len(clean1.strip()) < 40:
            img2 = preprocess_image_pass2(img)
            txt2 = pytesseract.image_to_string(img2, lang='tha+eng', config=custom_cfg)
            clean2 = clean_thai_ocr_text(txt2)
            if len(clean2) > len(clean1):
                return clean2
        return clean1
    except Exception:
        return ""

def extract_excel_text(file_bytes: bytes, file_name: str) -> str:
    """จับคู่พิกัดเซลล์กับข้อความให้เรียงสวยงามเหมือนตารางจริง"""
    lower_name = file_name.lower()

    # 1. กรณีเป็นไฟล์ CSV
    if lower_name.endswith('.csv'):
        for encoding in ['utf-8-sig', 'utf-8', 'cp874', 'tis-620']:
            try:
                decoded = file_bytes.decode(encoding)
                reader = csv.reader(io.StringIO(decoded))
                lines = []
                for row_idx, row in enumerate(reader, 1):
                    row_cells = [sanitize_text(str(c).strip()) for c in row if str(c).strip()]
                    if row_cells:
                        lines.append(f"แถว {row_idx}: " + " | ".join(row_cells))
                if lines:
                    return "\n".join(lines)
            except Exception:
                continue
        return ""

    # 2. กรณีเป็นไฟล์ Excel (.xlsx)
    if file_bytes.startswith(b'PK\x03\x04'):
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                # อ่าน Shared Strings
                shared_strings = []
                if 'xl/sharedStrings.xml' in z.namelist():
                    s_tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
                    for elem in s_tree.iter():
                        if elem.tag.endswith('}si'):
                            text_chunks = [t.text for t in elem.iter() if t.tag.endswith('}t') and t.text]
                            shared_strings.append("".join(text_chunks).strip())

                # อ่านแผ่นงานชีตแรก (sheet1.xml)
                sheet_files = [f for f in z.namelist() if f.startswith('xl/worksheets/sheet') and f.endswith('.xml')]
                if sheet_files:
                    sheet_tree = ET.fromstring(z.read(sheet_files[0]))
                    formatted_rows = []

                    for row in sheet_tree.iter():
                        if row.tag.endswith('}row'):
                            row_cells = []
                            for c in row.iter():
                                if c.tag.endswith('}c'):
                                    cell_ref = c.attrib.get('r', '')
                                    cell_type = c.attrib.get('t', '')
                                    v_elem = next((child for child in c if child.tag.endswith('}v')), None)
                                    val = v_elem.text.strip() if v_elem is not None and v_elem.text else ''

                                    # ถ้าเป็น shared string ให้นำ index ไปหาค่าจริง
                                    if cell_type == 's' and val.isdigit():
                                        s_idx = int(val)
                                        if s_idx < len(shared_strings):
                                            val = shared_strings[s_idx]

                                    if val:
                                        row_cells.append(f"[{cell_ref}] {val}" if cell_ref else val)

                            if row_cells:
                                formatted_rows.append("  |  ".join(row_cells))

                    if formatted_rows:
                        return sanitize_text("\n".join(formatted_rows))
        except Exception as e:
            print(f"Zip mapping error: {e}")

        # Fallback ด้วย openpyxl
        if openpyxl:
            try:
                wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
                lines = []
                for sheet in wb.worksheets:
                    for row in sheet.iter_rows(values_only=False):
                        row_vals = []
                        for cell in row:
                            if cell.value is not None and str(cell.value).strip():
                                val_str = sanitize_text(str(cell.value).strip())
                                row_vals.append(f"[{cell.coordinate}] {val_str}")
                        if row_vals:
                            lines.append("  |  ".join(row_vals))
                wb.close()
                if lines:
                    return "\n".join(lines)
            except Exception as e:
                print(f"openpyxl fallback error: {e}")

    return ""

def extract_structured_json(text: str) -> dict:
    """สกัดข้อมูลโครงสร้างสำคัญ (Tax ID, ยอดเงิน, เลขที่เอกสาร, หน่วยงาน) ด้วย Regex อัจฉริยะ"""
    text = sanitize_text(text)

    # 1. Tax ID (13 หลัก)
    tax = re.search(r'(?:tax|ผู้เสียภาษี|เลขประจำตัวผู้เสียภาษี)[^\d]{0,20}([0-9]{13}|[0-9]{1}[\-\s][0-9]{4}[\-\s][0-9]{5}[\-\s][0-9]{2}[\-\s][0-9]{1})', text, re.IGNORECASE)
    tax_clean = None
    if tax:
        raw_tax = re.sub(r'[\s\-]', '', tax.group(1))
        if len(raw_tax) == 13:
            tax_clean = raw_tax

    # 2. เลขที่เอกสาร / Document Number
    doc_num = re.search(r'(?:เลขที่รายการ|เลขที่เอกสาร|เลขที่|ใบแจ้งหนี้เลขที่|ใบสั่งซื้อเลขที่|ใบสั่งซื้อ|invoice\s*no|receipt\s*no|doc\s*no|no\.|ที่\s*อว\.)[:\s]*([a-zA-Z0-9\.\-\/\_]+)', text, re.IGNORECASE)
    
    # 3. วันที่
    date_match = re.search(r'(?:วันที่|date|พิมพ์รายการเมื่อ)[:\s]*([0-9]{1,2}[\/\-\.\s]+(?:[a-zA-Zก-๙]+|[0-9]{1,2})[\/\-\.\s]+[0-9]{2,4})', text, re.IGNORECASE)
    
    # 4. องค์กร / บริษัท / มหาวิทยาลัย
    org = re.search(r'(?:มหาวิทยาลัย[^\n\r\|]+|บริษัท\s*[^\n\r\|]+|ห้างหุ้นส่วนจำกัด\s*[^\n\r\|]+|บจก\.\s*[^\n\r\|]+|หจก\.\s*[^\n\r\|]+)', text)
    
    # 5. โทรศัพท์ & อีเมล
    phone = re.search(r'(?:โทร|tel|phone)[:\s]*([0-9]{2,3}[\-]?[0-9]{3}[\-]?[0-9]{4})', text, re.IGNORECASE)
    email = re.search(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', text)

    # 6. ยอดเงินรวมสุทธิ (Grand Total)
    clean_amounts = []
    keyword_amounts = re.findall(
        r'(?:total|grand\s*total|net\s*amount|amount|ยอดเงินรวมทั้งสิ้น|รวมทั้งสิ้น|จำนวนเงินรวมทั้งสิ้น|จำนวนเงินรวม|ยอดสุทธิ|ยอดเงินสุทธิ|ค่าบำรุง|ค่าลงทะเบียน|รวมเงิน|เป็นเงิน)[^\d\n\r]{0,25}[:\s\=]*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)',
        text,
        re.IGNORECASE
    )
    for a in keyword_amounts:
        try:
            val = float(a.replace(',', ''))
            if 0 < val < 100000000:
                clean_amounts.append(val)
        except Exception:
            pass

    if not clean_amounts:
        comma_amounts = re.findall(r'(?<![\d\.\-\/])([0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{2})(?![\d\.\-\/])', text)
        for a in comma_amounts:
            try:
                val = float(a.replace(',', ''))
                if val > 0:
                    clean_amounts.append(val)
            except Exception:
                pass

    grand_total = max(clean_amounts) if clean_amounts else None

    # สรุปใจความสำคัญ (Summary)
    summary_parts = []
    if org:
        summary_parts.append(f"หน่วยงาน/องค์กร: {sanitize_text(org.group(0).strip()[:40])}")
    if doc_num:
        summary_parts.append(f"รหัสอ้างอิง: {sanitize_text(doc_num.group(1).strip())}")
    if grand_total:
        summary_parts.append(f"ยอดเงิน: ฿{grand_total:,.2f}")
    
    summary_text = " | ".join(summary_parts) if summary_parts else (sanitize_text(text[:120].replace('\n', ' ').strip()) + "..." if text else "ไม่มีข้อมูลสรุป")

    return {
        "organization": sanitize_text(org.group(0).strip()) if org else None,
        "tax_id": tax_clean,
        "document_number": sanitize_text(doc_num.group(1).strip()) if doc_num else None,
        "document_date": sanitize_text(date_match.group(1).strip()) if date_match else None,
        "contact_phone": sanitize_text(phone.group(1).strip()) if phone else None,
        "contact_email": sanitize_text(email.group(1).strip()) if email else None,
        "grand_total": grand_total,
        "summary": summary_text
    }

def auto_generate_tags(text: str, current_tags: str = "") -> str:
    tags = set([sanitize_text(t.strip()) for t in current_tags.split(',') if t.strip()])
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
    if any(k in lower_text for k in ['excel', 'sheet', 'สเปรดชีต', 'uat test']):
        tags.add('#สเปรดชีต')

    meta = extract_structured_json(text)
    if meta.get("grand_total") and meta["grand_total"] >= 50000:
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

def do_process_document(document_id: str, storage_key: str, file_name: str):
    """ฟังก์ชันหลักในการดึงข้อมูล"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("SELECT tags FROM documents WHERE id = %s;", (document_id,))
        existing_doc = cur.fetchone()
        current_tags = existing_doc["tags"] if existing_doc and existing_doc.get("tags") else ""

        cur.execute("UPDATE documents SET status = 'PROCESSING' WHERE id = %s;", (document_id,))
        conn.commit()

        minio_client = get_minio_client()
        response = minio_client.get_object(BUCKET_NAME, storage_key)
        file_bytes = response.read()
        response.close()
        response.release_conn()

        extracted_text = ""
        lower_name = file_name.lower()

        # 1. ไฟล์ Excel / CSV
        if lower_name.endswith(('.xlsx', '.xls', '.csv')):
            extracted_text = extract_excel_text(file_bytes, file_name)

        # 2. ไฟล์ PDF
        elif lower_name.endswith('.pdf'):
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            full_text = []

            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                direct_text = page.get_text("text", sort=True)

                if len(direct_text.strip()) > 40:
                    full_text.append(direct_text.strip())
                else:
                    try:
                        pix = page.get_pixmap(dpi=300)
                        raw_img = Image.open(io.BytesIO(pix.tobytes("png")))
                        ocr_txt = run_tesseract_ocr(raw_img)
                        if ocr_txt.strip():
                            full_text.append(ocr_txt.strip())
                    except Exception:
                        if direct_text.strip():
                            full_text.append(direct_text.strip())

            extracted_text = "\n\n".join(full_text)

        # 3. ไฟล์รูปภาพ
        else:
            try:
                raw_img = Image.open(io.BytesIO(file_bytes))
                extracted_text = run_tesseract_ocr(raw_img)
            except Exception:
                pass

        extracted_text = sanitize_text(extracted_text)

        detected_cat_id = auto_classify_category(extracted_text)
        enriched_tags = sanitize_text(auto_generate_tags(extracted_text, current_tags))
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
        return {
            "status": "COMPLETED",
            "document_id": document_id,
            "extracted_text": extracted_text,
            "structured_data": structured_meta,
            "smart_meta": {
                "tax_id": structured_meta.get("tax_id"),
                "total_amount": structured_meta.get("grand_total"),
                "organization": structured_meta.get("organization")
            }
        }

    except Exception as exc:
        if conn:
            conn.rollback()
            try:
                fail_cur = conn.cursor()
                fail_cur.execute("UPDATE documents SET status = 'FAILED' WHERE id = %s;", (document_id,))
                conn.commit()
                fail_cur.close()
            except Exception:
                pass
        raise exc
    finally:
        if conn:
            conn.close()

@celery_app.task(name="app.workers.ocr_worker.process_document_ocr", bind=True, max_retries=3)
def process_document_ocr(self, document_id: str, storage_key: str, file_name: str):
    try:
        return do_process_document(document_id, storage_key, file_name)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5)