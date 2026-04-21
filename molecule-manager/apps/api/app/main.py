import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.limiter import limiter
from app.core.settings import settings
from app.routers import audit, auth, chemistry, experiments, labs, molecules, notifications, proteins

logger = logging.getLogger(__name__)

if not settings.cookie_secure and settings.env not in ("development", "dev"):
    logger.warning("COOKIE_SECURE is False outside of a development environment — session cookies will not have the Secure flag")

app = FastAPI(title="Molecule Manager API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
print(f"CORS origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(audit.router)
app.include_router(labs.router)
app.include_router(chemistry.router)
app.include_router(molecules.router)
app.include_router(experiments.router)
app.include_router(notifications.router)
app.include_router(proteins.router)


@app.get("/health")
def health():
    return {"status": "ok"}
