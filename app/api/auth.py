from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from repositories.user_repository import UserRepository
from schemas.user import TokenSchema, UserRegisterSchema, UserSchema, UserCredsSchema
from utils.auth import (
    create_access_token,
    get_current_user,
    auth_user,
    set_access_token_cookie,
    delete_access_token_cookie,
)
from database.engine import get_session
from database.models import User
from config import settings

auth_router = APIRouter()


@auth_router.post(
    "/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED
)
async def register(
    user_data: UserRegisterSchema, session: AsyncSession = Depends(get_session)
) -> User:
    existing_user = await UserRepository.get_user_by_email(session, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exist",
        )

    new_user = await UserRepository.create_user(session, user_data)
    return new_user


@auth_router.post("/login", response_model=TokenSchema, status_code=status.HTTP_200_OK)
async def login(
    response: Response,
    request: Request,
    form_data: UserCredsSchema,
    session=Depends(get_session),
) -> TokenSchema:
    print(f"🔐 Логин запрос от: {request.client.host}")
    print(f"📧 Email: {form_data.email}")

    user = await auth_user(form_data.email, form_data.password, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone or password",
        )

    token_data = {"user_id": user.id}
    access_token = await create_access_token(token_data)

    print(f"✅ Токен создан: {access_token[:50]}...")

    # Устанавливаем куку - ПРАВИЛЬНЫЙ ВЫЗОВ
    await set_access_token_cookie(response, access_token)

    # Проверяем установилась ли кука
    print(f"📋 Set-Cookie заголовки: {response.headers.get('set-cookie')}")

    # ВОЗВРАЩАЕМ ответ с установленными куками
    return TokenSchema(access_token=access_token, token_type="bearer")


@auth_router.post("/logout", status_code=status.HTTP_201_CREATED)
async def logout(response: Response):
    await delete_access_token_cookie(response)
    return {"message": "Successfully logged out"}


@auth_router.get("/me", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
