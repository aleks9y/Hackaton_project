from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database.engine import get_session
from database.models import Theme, Course, User
from utils.auth import get_current_user
from schemas.theme import ThemeCreate, ThemeUpdate, ThemeResponse

themes_router = APIRouter()


@themes_router.get("/{course_id}")
async def get_themes(
    course_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Theme).filter(Theme.course_id == course_id))
    themes = result.scalars().all()

    if not themes:
        # Проверяем, существует ли курс
        course_result = await db.execute(select(Course).filter(Course.id == course_id))
        course = course_result.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

    return themes


# ТОЛЬКО ПРЕПОД
@themes_router.post("/{course_id}",)
async def create_theme(
    course_id: int,
    theme_data: ThemeCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    course_result = await db.execute(select(Course).filter(Course.id == course_id))
    course = course_result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the owner of this course")

    new_theme = Theme(
        course_id=course_id,
        name=theme_data.name,
        text=theme_data.text
    )

    db.add(new_theme)
    await db.commit()
    await db.refresh(new_theme)

    return new_theme


@themes_router.patch("/theme/{theme_id}")
async def update_theme(
    theme_id: int,
    theme_data: ThemeUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Theme)
        .options(
            selectinload(Theme.course).selectinload(Course.owner)  # сразу подгружаем курс и владельца
        )
        .filter(Theme.id == theme_id)
    )
    theme = result.scalar_one_or_none()

    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    # Проверяем что пользователь владелец курса
    if theme.course.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the owner of this course")

    if theme_data.name is not None:
        theme.name = theme_data.name
    if theme_data.text is not None:
        theme.text = theme_data.text

    await db.commit()
    await db.refresh(theme)  # обновляем объект после коммита, чтобы вернуть актуальные данные

    return theme


@themes_router.delete("/theme/{theme_id}")
async def delete_theme(
    theme_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Theme)
        .options(
            selectinload(Theme.course).selectinload(Course.owner)  # сразу подгружаем курс и владельца
        )
        .filter(Theme.id == theme_id)
    )
    theme = result.scalar_one_or_none()

    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    # Уже не нужно refresh, связи подгружены заранее
    if theme.course.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the owner of this course")

    await db.delete(theme)
    await db.commit()

    return {"detail": "Theme deleted successfully"}
