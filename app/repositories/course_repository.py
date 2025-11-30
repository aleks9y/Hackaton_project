from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from database.models import Course, User, Theme, UserCourseAssociation


class CourseRepository:
    async def create_course(session: AsyncSession, course_data: dict) -> Course:
        course = Course(**course_data)
        session.add(course)
        await session.commit()
        await session.refresh(course)
        return course

    async def get_course_by_id(
        session: AsyncSession, course_id: int
    ) -> Optional[Course]:
        query = select(Course).where(Course.id == course_id)
        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def get_courses_with_filters(
        session: AsyncSession,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 10,
    ) -> List[Course]:
        query = select(Course)
        if search:
            query = query.where(Course.name.ilike(f"%{search}%"))
        query = query.offset(skip).limit(limit)
        result = await session.execute(query)
        return result.scalars().all()

    async def get_user_courses(
        session: AsyncSession, user_id: int, is_teacher: bool
    ) -> List[Course]:
        if is_teacher:
            query = select(Course).where(Course.owner_id == user_id)
        else:
            query = (
                select(Course)
                .join(UserCourseAssociation)
                .where(UserCourseAssociation.user_id == user_id)
            )
        result = await session.execute(query)
        return result.scalars().all()

    async def enroll_student(
        session: AsyncSession, course_id: int, student_id: int
    ) -> None:
        association = UserCourseAssociation(user_id=student_id, course_id=course_id)
        session.add(association)
        await session.commit()

    async def is_student_enrolled(
        session: AsyncSession, course_id: int, student_id: int
    ) -> bool:
        query = select(UserCourseAssociation).where(
            UserCourseAssociation.course_id == course_id,
            UserCourseAssociation.user_id == student_id,
        )
        result = await session.execute(query)
        return result.scalar_one_or_none() is not None
