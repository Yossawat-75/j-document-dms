import io
from datetime import timedelta
from minio import Minio
from app.core.config import settings

def get_minio_client():
    endpoint = getattr(settings, "MINIO_ENDPOINT", "localhost:9000")
    access_key = getattr(settings, "MINIO_ACCESS_KEY", "minioadmin")
    secret_key = getattr(settings, "MINIO_SECRET_KEY", "minioadmin")
    secure_raw = getattr(settings, "MINIO_SECURE", "false")
    
    if isinstance(secure_raw, str):
        secure = secure_raw.lower() == "true"
    else:
        secure = bool(secure_raw)

    return Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=secure
    )

def upload_file_to_minio(file_bytes: bytes, file_name: str, content_type: str = "application/octet-stream") -> str:
    client = get_minio_client()
    bucket_name = getattr(settings, "MINIO_BUCKET_NAME", getattr(settings, "MINIO_BUCKET", "dms-documents"))
    
    if not client.bucket_exists(bucket_name):
        client.make_bucket(bucket_name)

    client.put_object(
        bucket_name,
        file_name,
        io.BytesIO(file_bytes),
        length=len(file_bytes),
        content_type=content_type
    )
    return file_name

def get_file_download_url(storage_key: str) -> str:
    client = get_minio_client()
    bucket_name = getattr(settings, "MINIO_BUCKET_NAME", getattr(settings, "MINIO_BUCKET", "dms-documents"))
    url = client.presigned_get_object(bucket_name, storage_key, expires=timedelta(hours=2))
    return url.replace("minio:9000", "localhost:9000")

def delete_file_from_minio(storage_key: str):
    client = get_minio_client()
    bucket_name = getattr(settings, "MINIO_BUCKET_NAME", getattr(settings, "MINIO_BUCKET", "dms-documents"))
    try:
        client.remove_object(bucket_name, storage_key)
    except Exception as e:
        print(f"Failed to delete {storage_key} from MinIO: {e}")