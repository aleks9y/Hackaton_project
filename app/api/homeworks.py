from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional

from database.engine import get_session
from database.models import Course, Theme, User
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


@homeworks_router.post("/{theme_id}")
async def create_homework(
    theme_id: int,
    homework_data: HomeworkCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Создать домашнее задание (для студентов)"""
    if current_user.is_teacher:
        raise HTTPException(status_code=403, detail="Teachers cannot create homeworks")

    result = await session.execute(
        select(Theme)
        .options(
            selectinload(Theme.course).selectinload(
                Course.owner
            )  # сразу подгружаем курс и владельца
        )
        .filter(Theme.id == theme_id)
    )
    theme = result.scalar_one_or_none()

    if theme is None:
        raise HTTPException(status_code=404, detail="Theme not found")

    if not theme.is_homework:
        raise HTTPException(
            status_code=403, detail="You can't add homework to a topic without a task"
        )

    homework = await HomeworkRepository.create_homework(
        session,
        {
            **homework_data.model_dump(),
            "student_id": current_user.id,
            "theme_id": theme_id,
        },
    )
    return homework


@homeworks_router.post("/submissions")
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


2


@homeworks_router.get("/my")
async def get_my_homeworks(
    theme_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 10,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Получить мои отправленные ДЗ (для студентов)"""
    if current_user.is_teacher:
        raise HTTPException(status_code=403, detail="Only for students")

    homeworks = await HomeworkRepository.get_homeworks_with_filters(
        session, student_id=current_user.id, theme_id=theme_id, skip=skip, limit=limit
    )
    return homeworks


@homeworks_router.get("/")
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

    print(f"DEBUG: Grading homework ID: {homework_id}")
    print(f"DEBUG: Teacher ID: {current_user.id}")
    print(f"DEBUG: Grade data: {grade_data}")

    # Сначала проверим существование домашнего задания
    from sqlalchemy import select
    from database.models import Homework, HomeworkSubmission

    homework_check = await session.execute(
        select(Homework).filter(Homework.id == homework_id)
    )
    homework_exists = homework_check.scalar_one_or_none()

    if not homework_exists:
        print(f"DEBUG: Homework with ID {homework_id} not found in database")
        raise HTTPException(status_code=404, detail="Homework submission not found")

    print(
        f"DEBUG: Homework found: ID={homework_exists.id}, Student={homework_exists.student_id}, Theme={homework_exists.theme_id}"
    )

    # Проверим, имеет ли преподаватель доступ к этому курсу
    theme_check = await session.execute(
        select(Theme)
        .options(selectinload(Theme.course))
        .filter(Theme.id == homework_exists.theme_id)
    )
    theme = theme_check.scalar_one_or_none()

    if not theme:
        print(f"DEBUG: Theme not found for homework {homework_id}")
        raise HTTPException(status_code=404, detail="Theme not found")

    if theme.course.owner_id != current_user.id:
        print(
            f"DEBUG: Teacher {current_user.id} is not owner of course {theme.course.id}"
        )
        raise HTTPException(
            status_code=403, detail="You are not the owner of this course"
        )

    print(f"DEBUG: Teacher has access to course. Checking for existing submission...")

    # Ищем существующую submission или создаем новую
    submission_check = await session.execute(
        select(HomeworkSubmission).filter(HomeworkSubmission.homework_id == homework_id)
    )
    submission = submission_check.scalar_one_or_none()

    if submission:
        print(f"DEBUG: Existing submission found: ID={submission.id}")
        # Обновляем существующую submission
        submission.score = grade_data.score
        submission.teacher_comment = grade_data.teacher_comment
    else:
        print(f"DEBUG: No existing submission, creating new one")
        # Создаем новую submission
        submission = HomeworkSubmission(
            homework_id=homework_id,
            user_id=homework_exists.student_id,  # ID студента
            score=grade_data.score,
            teacher_comment=grade_data.teacher_comment,
        )
        session.add(submission)

    # Также обновляем статус homework
    homework_exists.status = "graded"

    try:
        await session.commit()
        await session.refresh(submission)
        print(f"DEBUG: Successfully graded homework {homework_id}")
        return {"message": "Homework graded successfully"}
    except Exception as e:
        await session.rollback()
        print(f"DEBUG: Error during commit: {str(e)}")
        raise HTTPException(status_code=500, detail="Error saving grade")
