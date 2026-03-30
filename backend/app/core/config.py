from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720

    DATABASE_URL: str = "postgresql+asyncpg://sopuser:changeme@db:5432/sopnavigator"
    REDIS_URL: str = "redis://redis:6379/0"

    CORS_ORIGINS: str = "http://localhost:3000"

    # Resend email (optional — leave empty to disable email sending)
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM: str = "SOP-Navigator <onboarding@resend.dev>"
    APP_BASE_URL: str = "http://localhost:3000"

    @property
    def email_enabled(self) -> bool:
        return bool(self.RESEND_API_KEY)

    # LDAP (optional)
    LDAP_SERVER: Optional[str] = None
    LDAP_PORT: int = 389
    LDAP_BASE_DN: Optional[str] = None
    LDAP_BIND_DN: Optional[str] = None
    LDAP_BIND_PASSWORD: Optional[str] = None
    LDAP_USER_SEARCH_BASE: Optional[str] = None
    LDAP_USER_ATTR: str = "sAMAccountName"

    @property
    def ldap_enabled(self) -> bool:
        return bool(self.LDAP_SERVER and self.LDAP_BASE_DN)

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
