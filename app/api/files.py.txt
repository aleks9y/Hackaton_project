from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    File as FastAPIFile,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pathlib import Path
import os
import uuid

from database.engine import get_session
from database.models import Homework, Theme, Course, User, File as ThemeFile
from utils.auth import get_current_user


files_router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


@files_router.post("/theme/{theme_id}/uploadfiles")
async def upload_files(
    theme_id: int,
    files: List[UploadFile] = FastAPIFile(...),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Загрузить файлы для темы
    - Преподаватель: может загружать файлы для любых тем своих курсов (is_homework=False)
    - Студент: может загружать файлы только для домашних заданий (theme.is_homework=True)
    """
    # Получаем тему вместе с курсом
    result = await db.execute(
        select(Theme)
        .options(selectinload(Theme.course).selectinload(Course.owner))
        .filter(Theme.id == theme_id)
    )
    theme = result.scalar_one_or_none()

    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    # Определяем путь и тип файла в зависимости от роли
    if current_user.is_teacher:
        # Преподаватель должен быть владельцем курса
        if theme.course.owner_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="You are not the owner of this course"
            )
        is_homework = False
        fPath = "themes"
    else:
        # Студент может загружать только для домашних заданий
        if not theme.is_homework:
            raise HTTPException(
                status_code=403, detail="You can only upload files for homework themes"
            )
        is_homework = True
        fPath = "homeworks"

    saved_files = []

    # Создаем директорию для файлов
    if current_user.is_teacher:
        theme_dir = UPLOAD_DIR / fPath / str(theme_id)
    else:
        theme_dir = UPLOAD_DIR / fPath / str(current_user.id) / str(theme_id)

    theme_dir.mkdir(parents=True, exist_ok=True)

    for upload in files:
        file_id = uuid.uuid4().hex
        safe_name = f"{file_id}_{upload.filename}"
        dest_path = theme_dir / safe_name

        total_size = 0
        try:
            with dest_path.open("wb") as out:
                while True:
                    chunk = await upload.read(1024 * 1024)  # 1 MB
                    if not chunk:
                        break
                    total_size += len(chunk)
                    if total_size > MAX_FILE_SIZE:
                        out.close()
                        dest_path.unlink(missing_ok=True)
                        raise HTTPException(
                            status_code=400,
                            detail=f"File {upload.filename} exceeds 100 MB limit",
                        )
                    out.write(chunk)
        finally:
            await upload.close()

        rel_path = dest_path.as_posix()
        db_file = ThemeFile(
            theme_id=theme_id,
            is_homework=is_homework,
            file_path=rel_path,
        )

        # Для студентских файлов домашнего задания связываем с домашним заданием
        if is_homework and not current_user.is_teacher:
            # Находим или создаем домашнее задание студента
            homework_result = await db.execute(
                select(Homework).filter(
                    Homework.theme_id == theme_id,
                    Homework.student_id == current_user.id,
                )
            )
            homework = homework_result.scalar_one_or_none()

            if not homework:
                homework = Homework(
                    theme_id=theme_id,
                    student_id=current_user.id,
                    title=theme.name or "Homework",
                    text="",  # Текст будет добавлен позже
                    status="draft",
                )
                db.add(homework)
                await db.flush()

        db.add(db_file)
        await db.flush()
        await db.refresh(db_file)

        saved_files.append(
            {
                "id": db_file.id,
                "filename": upload.filename,
                "url": "/" + rel_path.lstrip("/"),
                "is_homework": is_homework,
            }
        )

    await db.commit()
    return saved_files


@files_router.get("/theme/{theme_id}/getfiles")
async def get_theme_files(
    theme_id: int,
    is_homework: Optional[bool] = Query(False),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Theme)
        .options(selectinload(Theme.course).selectinload(Course.owner))
        .filter(Theme.id == theme_id)
    )
    theme = result.scalar_one_or_none()

    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    files_result = await db.execute(
        select(ThemeFile).filter(
            ThemeFile.theme_id == theme_id,
            ThemeFile.is_homework == is_homework,
        )
    )
    files = files_result.scalars().all()

    return [
        {
            "id": f.id,
            "filename": os.path.basename(f.file_path),
            "url": "/" + f.file_path.lstrip("/"),
        }
        for f in files
    ]


@files_router.delete("/{file_id}")
async def delete_theme_file(
    file_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Удалить файл темы по ID
    """
    # Находим файл вместе с темой, курсом и владельцем
    result = await db.execute(
        select(ThemeFile)
        .options(
            selectinload(ThemeFile.theme)
            .selectinload(Theme.course)
            .selectinload(Course.owner)
        )
        .filter(ThemeFile.id == file_id)
    )
    file = result.scalar_one_or_none()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Проверяем, что пользователь - владелец курса
    if file.theme.course.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You are not the owner of this course"
        )

    # Проверяем права доступа для удаления
    if current_user.is_teacher:
        # Преподаватель может удалять файлы только своих курсов
        if file.theme.course.owner_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="You are not the owner of this course"
            )
    else:
        # Студент может удалять только файлы домашнего задания
        if not file.is_homework:
            raise HTTPException(
                status_code=403, detail="You can only delete homework files"
            )

        # Проверяем, что файл связан с домашним заданием студента
        # Для студентских файлов проверяем путь
        file_path = Path(file.file_path)
        expected_path = UPLOAD_DIR / "homeworks" / str(current_user.id)

        if str(expected_path) not in str(file_path):
            raise HTTPException(
                status_code=403, detail="You can only delete your own homework files"
            )

    try:
        # Удаляем физический файл с диска
        file_path = Path(file.file_path)
        if file_path.exists() and file_path.is_file():
            file_path.unlink()

        # Удаляем запись из базы данных
        await db.delete(file)
        await db.commit()

        return {"message": "File deleted successfully"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")
