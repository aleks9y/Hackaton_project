from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database.engine import get_session
from database.models import Theme, Course, User
from utils.auth import get_current_user
from schemas.theme import ThemeCreate, ThemeUpdate, ThemeResponse

users_router = APIRouter()

@users_router.get("/profile")
async def get_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Получить профиль текущего пользователя"""
    return current_user

@users_router.get("/students")
async def get_students_list(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50
):
    """Получить список студентов (для преподавателей)"""
    if not current_user.is_teacher:
        raise HTTPException(status_code=403, detail="Only for teachers")
    
    result = await db.execute(
        select(User).filter(User.is_teacher == False).offset(skip).limit(limit)
    )
    return result.scalars().all()

@users_router.get("/teachers")
async def get_teachers_list(
    db: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 50
):
    """Получить список преподавателей"""
    result = await db.execute(
        select(User).filter(User.is_teacher == True).offset(skip).limit(limit)
    )
    return result.scalars().all()