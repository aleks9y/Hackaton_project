from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database.engine import get_session
from database.models import User, Course
from utils.auth import get_current_user
from schemas.course import (
    CourseCreate,
    CourseShortResponse,
    CourseUpdate,
    CourseDetailResponse,
)

courses_router = APIRouter()


@courses_router.get("/my", response_model=list[CourseShortResponse])
async def my_courses(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_teacher:
        result = await db.execute(
            select(Course).filter(Course.owner_id == current_user.id)
        )
        return result.scalars().all()

    # Для студента сразу подгружаем курсы
    result = await db.execute(
        select(User)
        .options(selectinload(User.enrolled_courses))
        .filter(User.id == current_user.id)
    )
    user = result.scalar_one()
    return user.enrolled_courses


@courses_router.get("/{course_id}", response_model=CourseDetailResponse)
async def get_course(
    course_id: int,
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(Course).filter(Course.id == course_id))
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return course


@courses_router.post("/courses/{course_id}/enroll")
async def enroll_course(
    course_id: int,
    db: AsyncSession = Depends(get_session),
    student: User = Depends(get_current_user),
):
    result = await db.execute(select(Course).filter(Course.id == course_id))
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    await db.refresh(student)  # чтобы подгрузить enrolled_courses
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
    new_course = Course(
        name=course_data.name,
        description=course_data.description,
        owner_id=current_user.id,
    )

    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)

    return new_course


@courses_router.patch("/{course_id}", response_model=CourseDetailResponse)
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
