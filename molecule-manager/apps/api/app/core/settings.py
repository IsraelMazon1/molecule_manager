from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Required — startup will fail with a clear error if these are missing
    database_url: str
    secret_key: str
    allowed_origins: str

    # Optional — defaults are safe for production (HTTPS)
    cookie_secure: bool = True
    cookie_samesite: str = "lax"

    # Environment name — set to "development" or "dev" for local work
    env: str = "production"

    # Public-facing app URL for email links (no trailing slash)
    app_url: str = "http://localhost:3000"

    # Resend API key for email notifications (empty = emails skipped)
    resend_api_key: str = ""


settings = Settings()

BANNED_SECRETS = {
    "replace-with-a-random-secret-key",
    "changeme",
    "secret",
    "dev-secret-key",
    "",
}

if settings.secret_key in BANNED_SECRETS or len(settings.secret_key) < 32:
    raise RuntimeError(
        "SECRET_KEY is missing, too short, or a known placeholder. "
        "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(64))'"
    )
