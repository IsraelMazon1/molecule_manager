from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Required — startup will fail with a clear error if these are missing
    database_url: str
    secret_key: str
    allowed_origins: str

    # Optional — defaults are safe for local/HTTP dev
    cookie_secure: bool = False


settings = Settings()
