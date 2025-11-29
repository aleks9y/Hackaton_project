from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import List, Optional
from database.models import Homework, HomeworkSubmission, Theme, Course, User


class HomeworkRepository:
    async def create_homework(session: AsyncSession, homework_data: dict) -> Homework:
        homework = Homework(**homework_data)
        session.add(homework)
        await session.commit()
        await session.refresh(homework)
        return homework

    async def create_submission(
        session: AsyncSession, submission_data: dict
    ) -> HomeworkSubmission:
        submission = HomeworkSubmission(**submission_data)
        session.add(submission)
        await session.commit()
        await session.refresh(submission)
        return submission

    async def get_homeworks_with_filters(
        session: AsyncSession,
        teacher_id: Optional[int] = None,
        student_id: Optional[int] = None,
        course_id: Optional[int] = None,
        theme_id: Optional[int] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 10,
    ) -> List[Homework]:
        query = select(Homework).join(Theme).join(Course)

        if teacher_id:
            query = query.where(Course.owner_id == teacher_id)
        if student_id:
            query = query.where(Homework.student_id == student_id)
        if course_id:
            query = query.where(Theme.course_id == course_id)
        if theme_id:
            query = query.where(Homework.theme_id == theme_id)
        if status:
            query = query.where(Homework.status == status)

        query = query.offset(skip).limit(limit)
        result = await session.execute(query)
        return result.scalars().all()

    async def update_submission_grade(
        session: AsyncSession,
        submission_id: int,
        score: int,
        comment: Optional[str] = None,
    ) -> Optional[HomeworkSubmission]:
        query = select(HomeworkSubmission).where(HomeworkSubmission.id == submission_id)
        result = await session.execute(query)
        submission = result.scalar_one_or_none()

        if submission:
            submission.score = score
            submission.teacher_comment = comment
            submission.status = "verified"
            await session.commit()
            await session.refresh(submission)

        return submission
