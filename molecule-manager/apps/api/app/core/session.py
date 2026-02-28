from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.core.settings import settings

SESSION_COOKIE_NAME = "session"
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.secret_key, salt="session")


def create_session_token(user_id: str) -> str:
    return _serializer().dumps(user_id)


def decode_session_token(token: str) -> str | None:
    try:
        return _serializer().loads(token, max_age=SESSION_MAX_AGE)
    except (SignatureExpired, BadSignature):
        return None
