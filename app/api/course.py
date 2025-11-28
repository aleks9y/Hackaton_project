from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File as FastAPIFile,
)
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import shutil
import os
from datetime import datetime

from app.schemas.course import HomeworkSubmissionCreate, HomeworkSubmissionResponse
from database.engine import get_session
from schemas.product import ProductSchema, ProductCreateSchema
from utils.auth import get_current_user
from database.models import (
    User,
    Course,
    Homework,
    HomeworkSubmission,
    HomeworkFile,
    Theme,
)


course_router = APIRouter()


# Настройки для загрузки файлов
UPLOAD_DIR = "uploads/homeworks"
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def verify_student_on_course(user_id: int, course_id: int, db: Session):
    """Проверяет, что студент записан на курс"""
    user = db.query(User).filter(User.id == user_id).first()
    course = db.query(Course).filter(Course.id == course_id).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if user not in course.students and user.id != course.owner_id:
        raise HTTPException(
            status_code=403, detail="Student is not enrolled in this course"
        )


async def verify_teacher_access(user_id: int, course_id: int, db: Session):
    """Проверяет, что пользователь - преподаватель курса"""
    user = db.query(User).filter(User.id == user_id).first()
    course = db.query(Course).filter(Course.id == course_id).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if user.id != course.owner_id:
        raise HTTPException(
            status_code=403, detail="User is not the teacher of this course"
        )


# Роуты для студентов
@course_router.post(
    "/{course_id}/homeworks/submit",
    response_model=HomeworkSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_homework(
    course_id: int,
    submission_data: HomeworkSubmissionCreate,
    files: List[UploadFile] = FastAPIFile(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Студент отправляет домашнее задание
    """
    # Проверяем, что студент записан на курс
    await verify_student_on_course(current_user.id, course_id, db)

    # Проверяем существование домашнего задания
    homework = (
        db.query(Homework).filter(Homework.id == submission_data.homework_id).first()
    )
    if not homework:
        raise HTTPException(status_code=404, detail="Homework not found")

    # Проверяем, что домашнее задание принадлежит курсу
    theme = (
        db.query(Theme)
        .filter(Theme.id == homework.theme_id, Theme.course_id == course_id)
        .first()
    )
    if not theme:
        raise HTTPException(
            status_code=400, detail="Homework does not belong to this course"
        )

    # Создаем submission
    submission = HomeworkSubmission(
        homework_id=submission_data.homework_id,
        student_id=current_user.id,
        answer=submission_data.answer,
    )

    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Сохраняем файлы
    saved_files = []
    for file in files:
        # Создаем уникальное имя файла
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{submission.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        # Сохраняем файл
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Создаем запись в базе данных
        homework_file = HomeworkFile(submission_id=submission.id, file_path=file_path)
        db.add(homework_file)
        saved_files.append(unique_filename)

    db.commit()

    # Получаем обновленный submission с файлами
    submission_with_files = (
        db.query(HomeworkSubmission)
        .options(joinedload(HomeworkSubmission.attachment_files))
        .filter(HomeworkSubmission.id == submission.id)
        .first()
    )

    return HomeworkSubmissionResponse(
        id=submission_with_files.id,
        homework_id=submission_with_files.homework_id,
        student_id=submission_with_files.student_id,
        answer=submission_with_files.answer,
        submitted_at=submission_with_files.submitted_at,
        score=submission_with_files.score,
        teacher_comment=submission_with_files.teacher_comment,
        attachment_files=[f.file_path for f in submission_with_files.attachment_files],
    )


@course_router.get(
    "/{course_id}/homeworks/{homework_id}/submissions/my",
    response_model=HomeworkSubmissionResponse,
)
async def get_my_submission(
    course_id: int,
    homework_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Студент получает свою отправку домашнего задания
    """
    await verify_student_on_course(current_user.id, course_id, db)

    submission = (
        db.query(HomeworkSubmission)
        .options(joinedload(HomeworkSubmission.attachment_files))
        .filter(
            HomeworkSubmission.homework_id == homework_id,
            HomeworkSubmission.student_id == current_user.id,
        )
        .first()
    )

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    return HomeworkSubmissionResponse(
        id=submission.id,
        homework_id=submission.homework_id,
        student_id=submission.student_id,
        answer=submission.answer,
        submitted_at=submission.submitted_at,
        score=submission.score,
        teacher_comment=submission.teacher_comment,
        attachment_files=[f.file_path for f in submission.attachment_files],
    )


# Роуты для преподавателей
@course_router.get(
    "/{course_id}/homeworks/{homework_id}/submissions",
    response_model=List[HomeworkSubmissionResponse],
)
async def get_all_submissions(
    course_id: int,
    homework_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Преподаватель получает все отправки домашнего задания
    """
    await verify_teacher_access(current_user.id, course_id, db)

    submissions = (
        db.query(HomeworkSubmission)
        .options(joinedload(HomeworkSubmission.attachment_files))
        .filter(HomeworkSubmission.homework_id == homework_id)
        .all()
    )

    return [
        HomeworkSubmissionResponse(
            id=submission.id,
            homework_id=submission.homework_id,
            student_id=submission.student_id,
            answer=submission.answer,
            submitted_at=submission.submitted_at,
            score=submission.score,
            teacher_comment=submission.teacher_comment,
            attachment_files=[f.file_path for f in submission.attachment_files],
        )
        for submission in submissions
    ]


@course_router.put(
    "/{course_id}/submissions/{submission_id}/feedback",
    response_model=HomeworkSubmissionResponse,
)
async def provide_feedback(
    course_id: int,
    submission_id: int,
    feedback: TeacherFeedback,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Преподаватель ставит оценку и комментарий к домашнему заданию
    """
    await verify_teacher_access(current_user.id, course_id, db)

    # Находим submission и проверяем, что он принадлежит курсу
    submission = (
        db.query(HomeworkSubmission)
        .join(Homework, HomeworkSubmission.homework_id == Homework.id)
        .join(Theme, Homework.theme_id == Theme.id)
        .filter(HomeworkSubmission.id == submission_id, Theme.course_id == course_id)
        .first()
    )

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Проверяем максимальный балл
    homework = db.query(Homework).filter(Homework.id == submission.homework_id).first()
    if homework.max_score and feedback.score > homework.max_score:
        raise HTTPException(
            status_code=400,
            detail=f"Score cannot exceed maximum score of {homework.max_score}",
        )

    # Обновляем оценку и комментарий
    submission.score = feedback.score
    submission.teacher_comment = feedback.teacher_comment

    db.commit()
    db.refresh(submission)

    # Получаем submission с файлами
    submission_with_files = (
        db.query(HomeworkSubmission)
        .options(joinedload(HomeworkSubmission.attachment_files))
        .filter(HomeworkSubmission.id == submission.id)
        .first()
    )

    return HomeworkSubmissionResponse(
        id=submission_with_files.id,
        homework_id=submission_with_files.homework_id,
        student_id=submission_with_files.student_id,
        answer=submission_with_files.answer,
        submitted_at=submission_with_files.submitted_at,
        score=submission_with_files.score,
        teacher_comment=submission_with_files.teacher_comment,
        attachment_files=[f.file_path for f in submission_with_files.attachment_files],
    )


@course_router.get(
    "/{course_id}/homeworks", response_model=List[HomeworkWithSubmissions]
)
async def get_course_homeworks(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Получить все домашние задания курса с отправками
    (для преподавателя - все отправки, для студента - только свои)
    """
    await verify_student_on_course(current_user.id, course_id, db)

    homeworks = (
        db.query(Homework)
        .join(Theme, Homework.theme_id == Theme.id)
        .filter(Theme.course_id == course_id)
        .options(
            joinedload(Homework.submissions).joinedload(
                HomeworkSubmission.attachment_files
            )
        )
        .all()
    )

    result = []
    for homework in homeworks:
        if current_user.is_teacher or current_user.id in [
            course.owner_id for course in current_user.owned_courses
        ]:
            # Преподаватель видит все отправки
            submissions_data = [
                HomeworkSubmissionResponse(
                    id=submission.id,
                    homework_id=submission.homework_id,
                    student_id=submission.student_id,
                    answer=submission.answer,
                    submitted_at=submission.submitted_at,
                    score=submission.score,
                    teacher_comment=submission.teacher_comment,
                    attachment_files=[f.file_path for f in submission.attachment_files],
                )
                for submission in homework.submissions
            ]
        else:
            # Студент видит только свои отправки
            student_submission = next(
                (s for s in homework.submissions if s.student_id == current_user.id),
                None,
            )
            submissions_data = (
                [
                    HomeworkSubmissionResponse(
                        id=student_submission.id,
                        homework_id=student_submission.homework_id,
                        student_id=student_submission.student_id,
                        answer=student_submission.answer,
                        submitted_at=student_submission.submitted_at,
                        score=student_submission.score,
                        teacher_comment=student_submission.teacher_comment,
                        attachment_files=[
                            f.file_path for f in student_submission.attachment_files
                        ],
                    )
                ]
                if student_submission
                else []
            )

        result.append(
            HomeworkWithSubmissions(
                id=homework.id,
                title=homework.title,
                text=homework.text,
                max_score=homework.max_score,
                submissions=submissions_data,
            )
        )

    return result
