import io
from datetime import timedelta

from minio import Minio

from app.core.config import settings


def get_minio_client(endpoint: str | None = None, secure: bool | None = None) -> Minio:
    return Minio(
        endpoint or settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE if secure is None else secure,
    )


def upload_file_to_minio(
    file_bytes: bytes,
    file_name: str,
    content_type: str = "application/octet-stream",
) -> str:
    client = get_minio_client()
    bucket_name = settings.MINIO_BUCKET_NAME

    if not client.bucket_exists(bucket_name):
        client.make_bucket(bucket_name)

    client.put_object(
        bucket_name,
        file_name,
        io.BytesIO(file_bytes),
        length=len(file_bytes),
        content_type=content_type,
    )
    return file_name


def get_file_download_url(storage_key: str) -> str:
    endpoint = settings.MINIO_PUBLIC_ENDPOINT or settings.MINIO_ENDPOINT
    secure = settings.MINIO_PUBLIC_SECURE if settings.MINIO_PUBLIC_ENDPOINT else settings.MINIO_SECURE
    client = get_minio_client(endpoint=endpoint, secure=secure)
    return client.presigned_get_object(
        settings.MINIO_BUCKET_NAME,
        storage_key,
        expires=timedelta(hours=2),
    )


def delete_file_from_minio(storage_key: str) -> None:
    client = get_minio_client()
    client.remove_object(settings.MINIO_BUCKET_NAME, storage_key)
