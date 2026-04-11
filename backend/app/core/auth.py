from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.base import AdminUser

# We switch to PBKDF2-SHA256 which is extremely compatible 
# and has NO issues with Python 3.12 or password length.
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"], 
    deprecated="auto"
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def authenticate_admin(db: Session, username: str, password: str) -> Optional[AdminUser]:
    admin = db.query(AdminUser).filter(AdminUser.username == username).first()
    if not admin or not verify_password(password, admin.hashed_password):
        return None
    return admin


async def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> AdminUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        sid: str = payload.get("sid")
        if username is None or sid is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Check session in Redis
    from app.core.redis_client import redis_client
    session_data = await redis_client.get(f"admin_session:{sid}")
    if not session_data:
        raise credentials_exception
    
    # Auto-extend session on activity (Heartbeat)
    # Get timeout from config
    from app.core.hub_config import load_hub_config
    cfg = load_hub_config(db)
    timeout_mins = cfg.get("session_timeout", 120)
    await redis_client.expire(f"admin_session:{sid}", timeout_mins * 60)

    admin = db.query(AdminUser).filter(AdminUser.username == username).first()
    if admin is None:
        raise credentials_exception
    
    # Attach sid to admin object temporarily for downstream use if needed
    admin._sid = sid
    return admin
