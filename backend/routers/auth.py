"""
Authentication router — JWT-based register / login / me
"""
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from typing import Optional
from models.session import sync_postgres_sequences

from models import (
    LoginRequest,
    RegisterRequest,
    SessionLocal,
    TokenResponse,
    User,
    UserPublic,
    UserRole,
    Restaurant,
    NGO,
)

router = APIRouter(prefix="/auth", tags=["Auth"])

# ── Crypto config ────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "rescueiq-demo-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 h for demo convenience

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


# ── Helpers ──────────────────────────────────────────────
def _hash(password: str) -> str:
    """Hash password with bcrypt (directly — no passlib)."""
    pwd_bytes = password.encode("utf-8")[:72]  # bcrypt hard limit
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")


def _verify(plain: str, hashed: str) -> bool:
    pwd_bytes = plain.encode("utf-8")[:72]
    return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))


def create_access_token(sub: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(sub), "role": str(role), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    """FastAPI dependency — returns User or raises 401."""
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        # Detach from session so caller can use outside `db`
        db.expunge(user)
        return user
    finally:
        db.close()


def _is_sequence_pk_collision(exc: IntegrityError) -> bool:
    message = str(exc).lower()
    return (
        "duplicate key value violates unique constraint" in message
        and ("restaurants_pkey" in message or "ngos_pkey" in message)
    )


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest):
    db = SessionLocal()
    try:
        if not body.password:
            raise HTTPException(status_code=400, detail="Password is required")
        if len(body.password) < 4:
            raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

        user = None
        for attempt in range(2):
            existing = db.query(User).filter(User.email == body.email).first()
            if existing:
                raise HTTPException(status_code=400, detail="Email already registered")

            user = User(
                email=body.email,
                password_hash=_hash(body.password),
                role=body.role,
                name=body.name,
                phone=body.phone,
            )
            db.add(user)
            db.flush()  # get user.id

            if user.role in (UserRole.RESTAURANT, UserRole.PROVIDER):
                db.add(
                    Restaurant(
                        user_id=user.id,
                        name=body.name,
                        address="(not set)",
                        latitude=0.0,
                        longitude=0.0,
                    )
                )
            elif user.role == UserRole.NGO:
                db.add(
                    NGO(
                        user_id=user.id,
                        name=body.name,
                        address="(not set)",
                        latitude=0.0,
                        longitude=0.0,
                    )
                )

            try:
                db.commit()
                db.refresh(user)
                break
            except IntegrityError as exc:
                db.rollback()
                if attempt == 0 and _is_sequence_pk_collision(exc):
                    sync_postgres_sequences()
                    continue
                raise HTTPException(status_code=500, detail="Database constraint error during signup")

        if user is None:
            raise HTTPException(status_code=500, detail="Failed to create user")

        token = create_access_token(user.id, user.role.value)
        return TokenResponse(
            access_token=token,
            user=UserPublic.model_validate(user),
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    db = SessionLocal()
    try:
        if not body.password:
            raise HTTPException(status_code=400, detail="Password is required")
        if len(body.password) < 4:
            raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

        user = db.query(User).filter(User.email == body.email).first()
        if not user or not _verify(body.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_access_token(user.id, user.role.value)
        return TokenResponse(
            access_token=token,
            user=UserPublic.model_validate(user),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(exc)}")
    finally:
        db.close()


class MeResponse(BaseModel):
    user: UserPublic
    restaurant_id: Optional[int] = None
    ngo_id: Optional[int] = None


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        restaurant_id = None
        ngo_id = None
        rest = db.query(Restaurant).filter(Restaurant.user_id == current_user.id).first()
        if rest:
            restaurant_id = rest.id
        ngo = db.query(NGO).filter(NGO.user_id == current_user.id).first()
        if ngo:
            ngo_id = ngo.id

        return MeResponse(
            user=UserPublic.model_validate(current_user),
            restaurant_id=restaurant_id,
            ngo_id=ngo_id,
        )
    finally:
        db.close()
