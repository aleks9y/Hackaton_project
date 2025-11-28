from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, HTTPException, status, Request, Response
from jose import jwt, JWTError

from schemas.user import UserSchema, TokenSchema
from utils.hashing import Hasher
from utils.time import get_moscow_time
from repositories.user_repository import UserRepository
from database.models import User
from database.engine import SessionDep
from config import settings
from database.engine import get_session

security = HTTPBearer(auto_error=False)


async def create_access_token(data: Dict[str, Any]) -> str:
    expire = get_moscow_time() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = data.copy()
    payload.update({"exp": expire})
    encoded_jwt = jwt.encode(payload, settings.SECRET_KEY, settings.ALGORITHM)
    return encoded_jwt


async def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, settings.ALGORITHM)
        return payload
    except JWTError:
        return None


async def auth_user(
    phone: str,
    input_password: str,
    session = SessionDep,
) -> Optional[User]:
    user = await UserRepository.get_user_by_phone(session, phone)
    if not user:
        return None

    if not await Hasher.verify_password(input_password, user.hashed_password):
        return None

    return user


async def get_token_from_cookie(request: Request) -> Optional[str]:
    return request.cookies.get("access_token")


async def set_access_token_cookie(
    response: Response,
    access_token: str,
    expires_days: int = 30
) -> None:
    print(f"🔐 Устанавливаю куку access_token: {access_token[:20]}...")
    print(f"📝 Параметры куки: httponly=False, secure=False, path=/")
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=False,
        max_age=expires_days * 24 * 60 * 60,
        path="/",
        secure=False, 
        domain="127.0.0.1" 
    )
    
    print("✅ Кука должна быть установлена")


async def delete_access_token_cookie(response: Response) -> None:
    response.delete_cookie(
        key="access_token",
        path="/",
    )


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> User:
    token = None
    
    token_from_cookie = await get_token_from_cookie(request)
    if token_from_cookie:
        token = token_from_cookie
        print("✅ Токен из request.cookies")

    if not token:
        print("❌ Токен не найден в куках")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    
    payload = await verify_token(token)
    if payload is None:
        print("❌ Невалидный токен")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    user_id = payload.get("user_id")
    if user_id is None:
        print("❌ Неверный payload токена")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await UserRepository.get_user_by_id(session, user_id)
    if user is None:
        print("❌ Пользователь не найден")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    print(f"✅ Пользователь аутентифицирован: {user.phone}")
    return user