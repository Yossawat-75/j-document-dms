from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_ENV: str = "development"
    PUBLIC_APP_URL: str = "http://localhost:3000"
    API_PUBLIC_URL: str = "http://localhost:8000"
    DMS_BASE_PATH: str = ""
    CORS_ORIGINS: str = "http://localhost:3000"

    DATABASE_URL: str = "postgresql://postgres:password123@localhost:5432/dms_db"

    REDIS_URL: str = "redis://localhost:6379/2"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    MINIO_ENDPOINT: str = "localhost"
    MINIO_PORT: int = 9000
    MINIO_USE_SSL: bool = False
    MINIO_PUBLIC_URL: str = ""
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "dms-documents"

    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:8000/api/auth/github/callback"
    GITHUB_ALLOWED_USERS: str = ""
    GITHUB_ADMIN_USERS: str = ""

    MS_CLIENT_ID: str = ""
    MS_CLIENT_SECRET: str = ""
    MS_TENANT_ID: str = "common"
    MS_REDIRECT_URI: str = "http://localhost:8000/api/auth/microsoft/callback"

    ALLOW_MOCK_OAUTH: bool = False
    COOKIE_SECURE: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def api_public_base_url(self) -> str:
        return f"{self.API_PUBLIC_URL.rstrip('/')}/{self.DMS_BASE_PATH.strip('/')}".rstrip("/")

    @property
    def minio_internal_endpoint(self) -> str:
        endpoint = self.MINIO_ENDPOINT.removeprefix("http://").removeprefix("https://").rstrip("/")
        if ":" in endpoint:
            return endpoint
        return f"{endpoint}:{self.MINIO_PORT}"

    @property
    def github_allowed_users(self) -> set[str]:
        return {username.strip().lower() for username in self.GITHUB_ALLOWED_USERS.split(",") if username.strip()}

    @property
    def github_admin_users(self) -> set[str]:
        return {username.strip().lower() for username in self.GITHUB_ADMIN_USERS.split(",") if username.strip()}


settings = Settings()
