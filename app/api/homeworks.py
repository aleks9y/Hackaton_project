from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from database.engine import get_session
from database.models import User
from schemas.homework import (
    HomeworkSchema,
    HomeworkCreate,
    HomeworkSubmissionCreate,
    HomeworkSubmissionUpdate,
    HomeworkFilter,
)
from schemas.user import StudentHomeworkSchema
from repositories.homework_repository import HomeworkRepository
from repositories.course_repository import CourseRepository
from utils.auth import get_current_user

homeworks_router = APIRouter()


@homeworks_router.post("/", response_model=HomeworkSchema)
async def create_homework(
    homework_data: HomeworkCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Создать домашнее задание (для студентов)"""
    if current_user.is_teacher:
        raise HTTPException(status_code=403, detail="Teachers cannot create homeworks")

    homework = await HomeworkRepository.create_homework(
        session, {**homework_data.model_dump(), "student_id": current_user.id}
    )
    return homework


@homeworks_router.post("/submissions", response_model=HomeworkSubmissionCreate)
async def submit_homework(
    submission_data: HomeworkSubmissionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Отправить решение ДЗ (текст)"""
    if current_user.is_teacher:
        raise HTTPException(status_code=403, detail="Teachers cannot submit homeworks")

    submission = await HomeworkRepository.create_submission(
        session, {**submission_data.model_dump(), "status": "pending"}
    )
    return submission


@homeworks_router.get("/my", response_model=list[HomeworkSchema])
async def get_my_homeworks(
    skip: int = 0,
    limit: int = 10,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Получить мои отправленные ДЗ (для студентов)"""
    if current_user.is_teacher:
        raise HTTPException(status_code=403, detail="Only for students")

    homeworks = await HomeworkRepository.get_homeworks_with_filters(
        session, student_id=current_user.id, skip=skip, limit=limit
    )
    return homeworks


@homeworks_router.get("/", response_model=list[HomeworkSchema])
async def get_homeworks_for_review(
    course_id: Optional[int] = Query(None),
    theme_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    student_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 10,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Получить ДЗ для проверки (для преподавателей)"""
    if not current_user.is_teacher:
        raise HTTPException(status_code=403, detail="Only for teachers")

    homeworks = await HomeworkRepository.get_homeworks_with_filters(
        session,
        teacher_id=current_user.id,
        course_id=course_id,
        theme_id=theme_id,
        status=status,
        student_id=student_id,
        skip=skip,
        limit=limit,
    )
    return homeworks


@homeworks_router.put("/{homework_id}/grade")
async def grade_homework(
    homework_id: int,
    grade_data: HomeworkSubmissionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Оценить ДЗ (для преподавателей)"""
    if not current_user.is_teacher:
        raise HTTPException(status_code=403, detail="Only for teachers")

    submission = await HomeworkRepository.update_submission_grade(
        session, homework_id, grade_data.score, grade_data.teacher_comment
    )

    if not submission:
        raise HTTPException(status_code=404, detail="Homework submission not found")

    return {"message": "Homework graded successfully"}
