from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database.engine import get_session
from database.models import User, Course, UserCourseAssociation, Theme, ThemeProgress
from utils.auth import get_current_user
from schemas.course import (
    CourseCreate,
    CourseShortResponse,
    CourseUpdate,
    CourseDetailResponse,
)

courses_router = APIRouter()


@courses_router.get("/all")
async def get_all_courses(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Получить все курсы с информацией о записи пользователя"""
    # Базовый запрос для всех курсов
    query = (
        select(Course)
        .options(selectinload(Course.owner))
    )
    
    result = await db.execute(query)
    courses = result.scalars().all()
    
    # Если пользователь не авторизован или это преподаватель, возвращаем просто курсы
    if not current_user or current_user.is_teacher:
        return courses
    
    # Для студента проверяем, на какие курсы он записан
    enrolled_result = await db.execute(
        select(UserCourseAssociation.course_id)
        .filter(UserCourseAssociation.user_id == current_user.id)
    )
    enrolled_course_ids = {course_id for course_id, in enrolled_result.all()}
    
    # Добавляем флаг is_enrolled к каждому курсу
    for course in courses:
        course.is_enrolled = course.id in enrolled_course_ids
    
    return courses


@courses_router.get("/my")
async def my_courses(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_teacher:
        # Для преподавателя - только его курсы
        result = await db.execute(
            select(Course)
            .options(selectinload(Course.owner))
            .filter(Course.owner_id == current_user.id)
        )
        return result.scalars().all()
    else:
        # Для студента - только курсы, на которые он записан
        result = await db.execute(
            select(Course)
            .options(selectinload(Course.owner))
            .join(UserCourseAssociation, Course.id == UserCourseAssociation.course_id)
            .filter(UserCourseAssociation.user_id == current_user.id)
        )
        return result.scalars().all()


@courses_router.get("/{course_id}/students")
async def get_course_students(
    course_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Получить студентов конкретного курса"""
    # Проверяем что пользователь владелец курса
    course_result = await db.execute(select(Course).filter(Course.id == course_id))
    course = course_result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Получаем студентов курса
    result = await db.execute(
        select(User)
        .join(UserCourseAssociation, User.id == UserCourseAssociation.user_id)
        .filter(UserCourseAssociation.course_id == course_id)
        .filter(User.is_teacher == False)  # только студентов
    )
    students = result.scalars().all()

    return students


@courses_router.get("/{course_id}")
async def get_course(
    course_id: int,
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(Course).filter(Course.id == course_id))
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return course


@courses_router.post("/{course_id}/enroll")
async def enroll_course(
    course_id: int,
    db: AsyncSession = Depends(get_session),
    student: User = Depends(get_current_user),
):
    # Подгружаем enrolled_courses у студента сразу
    await db.refresh(student, attribute_names=["enrolled_courses"])

    # Получаем курс
    result = await db.execute(
        select(Course)
        .options(selectinload(Course.students))  # если нужно подгружать студентов
        .filter(Course.id == course_id)
    )
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course in student.enrolled_courses:
        return {"detail": "Already enrolled"}

    student.enrolled_courses.append(course)
    await db.commit()

    return {"detail": "Enrolled successfully"}


@courses_router.post("")
async def create_course(
    course_data: CourseCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_teacher == True:
        new_course = Course(
            name=course_data.name,
            description=course_data.description,
            owner_id=current_user.id,
        )

        db.add(new_course)
        await db.commit()
        await db.refresh(new_course)

        return new_course
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="You are not a teacher"
    )


@courses_router.patch("/{course_id}")
async def update_course(
    course_id: int,
    course_data: CourseUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Course).filter(Course.id == course_id))
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You are not the owner of this course"
        )

    if course_data.name is not None:
        course.name = course_data.name
    if course_data.description is not None:
        course.description = course_data.description

    await db.commit()
    await db.refresh(course)

    return course


@courses_router.delete("/{course_id}")
async def delete_course(
    course_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Course).filter(Course.id == course_id))
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You are not the owner of this course"
        )

    await db.delete(course)
    await db.commit()

    return {"detail": "Course deleted successfully"}


@courses_router.get("/{course_id}/students")
async def get_course_students(
    course_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Получить студентов конкретного курса"""
    # Проверяем что пользователь владелец курса
    course_result = await db.execute(select(Course).filter(Course.id == course_id))
    course = course_result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Получаем студентов курса
    result = await db.execute(
        select(User)
        .join(UserCourseAssociation, User.id == UserCourseAssociation.user_id)
        .filter(UserCourseAssociation.course_id == course_id)
        .filter(User.is_teacher == False)  # только студентов
    )
    students = result.scalars().all()

    return students


@courses_router.get("/{course_id}/students")
async def get_course_students(
    course_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Получить студентов конкретного курса"""
    # Проверяем что пользователь владелец курса
    course_result = await db.execute(select(Course).filter(Course.id == course_id))
    course = course_result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Получаем студентов курса
    result = await db.execute(
        select(User)
        .join(UserCourseAssociation, User.id == UserCourseAssociation.user_id)
        .filter(UserCourseAssociation.course_id == course_id)
        .filter(User.is_teacher == False)  # только студентов
    )
    students = result.scalars().all()

    return students


@courses_router.get("/{course_id}/progress")
async def get_course_progress(
    course_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Получить прогресс по курсу"""
    # Получаем все темы курса
    result = await session.execute(
        select(Theme).filter(Theme.course_id == course_id)
    )
    themes = result.scalars().all()
    
    # Получаем прогресс пользователя по этим темам
    result = await session.execute(
        select(ThemeProgress).filter(
            ThemeProgress.user_id == current_user.id,
            ThemeProgress.theme_id.in_([theme.id for theme in themes])
        )
    )
    user_progress = result.scalars().all()
    
    # Создаем словарь для быстрого доступа
    progress_dict = {progress.theme_id: progress for progress in user_progress}
    
    # Формируем ответ
    completed_count = sum(1 for progress in user_progress if progress.is_completed)
    total_count = len(themes)
    progress_percentage = (completed_count / total_count * 100) if total_count > 0 else 0
    
    return {
        "completed_count": completed_count,
        "total_count": total_count,
        "progress_percentage": progress_percentage,
        "themes_progress": [
            {
                "theme_id": theme.id,
                "theme_name": theme.name,
                "is_completed": progress_dict.get(theme.id) and progress_dict[theme.id].is_completed,
                "is_homework": theme.is_homework
            }
            for theme in themes
        ]
    }