from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.core.security import hash_password, verify_password
from app.core.session import SESSION_COOKIE_NAME, SESSION_MAX_AGE, create_session_token
from app.core.settings import settings
from app.deps.auth import get_current_user
from app.deps.db import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest, UserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_COOKIE_KWARGS = dict(
    key=SESSION_COOKIE_NAME,
    httponly=True,
    samesite="lax",
    max_age=SESSION_MAX_AGE,
)


def _set_session_cookie(response: Response, user_id: str) -> None:
    response.set_cookie(
        value=create_session_token(user_id),
        secure=settings.cookie_secure,
        **_COOKIE_KWARGS,
    )


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
def signup(request: Request, body: SignupRequest, response: Response, db: Session = Depends(get_db)) -> User:
    existing = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(email=body.email, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    _set_session_cookie(response, str(user.id))
    return user


@router.post("/login", response_model=UserResponse)
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    _set_session_cookie(response, str(user.id))
    return user


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, samesite="lax")
