from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.engine import SessionDep
from database.models import Theme, Course, User
from utils.auth import get_current_user

from schemas.theme import ThemeCreate, ThemeUpdate, ThemeResponse

themes_router = APIRouter()


@themes_router.get("/{course_id}", response_model=list[ThemeResponse])
def get_themes(
    course_id: int,
    db = SessionDep,
    current_user: User = Depends(get_current_user)
):
    themes = db.query(Theme).filter(Theme.course_id == course_id).all()

    if not themes:
        # Проверяем, существует ли курс
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

    return themes


#ТОЛЬКО ПРЕПОДУ
@themes_router.post("/{course_id}", response_model=ThemeResponse)
def create_theme(
    course_id: int,
    theme_data: ThemeCreate,
    db = SessionDep,
    current_user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()

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
    db.commit()
    db.refresh(new_theme)

    return new_theme


@themes_router.patch("/theme/{theme_id}", response_model=ThemeResponse)
def update_theme(
    theme_id: int,
    theme_data: ThemeUpdate,
    db = SessionDep,
    current_user: User = Depends(get_current_user)
):
    theme = db.query(Theme).filter(Theme.id == theme_id).first()

    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    # Проверяем что он владелец курса
    if theme.course.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the owner of this course")

    if theme_data.name is not None:
        theme.name = theme_data.name

    if theme_data.text is not None:
        theme.text = theme_data.text

    db.commit()
    db.refresh(theme)

    return theme


@themes_router.delete("/theme/{theme_id}")
def delete_theme(
    theme_id: int,
    db = SessionDep,
    current_user: User = Depends(get_current_user)
):
    theme = db.query(Theme).filter(Theme.id == theme_id).first()

    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    if theme.course.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the owner of this course")

    db.delete(theme)
    db.commit()

    return {"detail": "Theme deleted successfully"}
