from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional
from pydantic import EmailStr
from database.models import User
from schemas.user import UserRegisterSchema
from utils.hashing import Hasher


class UserRepository:
    async def create_user(session: AsyncSession, user_data: UserRegisterSchema) -> User:
        hashed_password = await Hasher.get_password_hash(user_data.password)
        user_data = user_data.model_dump(exclude={"password"})

        user = User(hashed_password=hashed_password, **user_data)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

    async def get_user_by_id(session: AsyncSession, user_id: str) -> Optional[User]:
        query = select(User).where(User.id == user_id)
        res = await session.execute(query)
        return res.scalar_one_or_none()

    async def get_user_by_email(
        session: AsyncSession, email: EmailStr
    ) -> Optional[User]:
        query = select(User).where(User.email == email)
        res = await session.execute(query)
        return res.scalar_one_or_none()
