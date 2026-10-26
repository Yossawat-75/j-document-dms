import io
from datetime import timedelta
from urllib.parse import urlparse

from minio import Minio

from app.core.config import settings


def get_minio_client(endpoint: str | None = None, secure: bool | None = None) -> Minio:
    return Minio(
        endpoint or settings.minio_internal_endpoint,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_USE_SSL if secure is None else secure,
    )


def upload_file_to_minio(
    file_bytes: bytes,
    file_name: str,
    content_type: str = "application/octet-stream",
) -> str:
    client = get_minio_client()
    bucket_name = settings.MINIO_BUCKET_NAME

    if not client.bucket_exists(bucket_name):
        raise RuntimeError("Configured MinIO bucket does not exist")

    client.put_object(
        bucket_name,
        file_name,
        io.BytesIO(file_bytes),
        length=len(file_bytes),
        content_type=content_type,
    )
    return file_name


def get_file_download_url(storage_key: str) -> str:
    if not settings.MINIO_PUBLIC_URL:
        client = get_minio_client()
    else:
        public_url = urlparse(settings.MINIO_PUBLIC_URL)
        if not public_url.hostname or public_url.path not in ("", "/"):
            raise RuntimeError("MINIO_PUBLIC_URL must contain only scheme and host")
        public_endpoint = public_url.hostname
        if public_url.port:
            public_endpoint = f"{public_endpoint}:{public_url.port}"
        client = get_minio_client(
            endpoint=public_endpoint,
            secure=public_url.scheme == "https",
        )

    return client.presigned_get_object(
        settings.MINIO_BUCKET_NAME,
        storage_key,
        expires=timedelta(hours=2),
    )


def delete_file_from_minio(storage_key: str) -> None:
    client = get_minio_client()
    client.remove_object(settings.MINIO_BUCKET_NAME, storage_key)
