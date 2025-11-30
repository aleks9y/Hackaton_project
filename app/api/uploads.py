from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from pathlib import Path
import os
import uuid

from database.engine import get_session
from database.models import Theme, Course, User, File as ThemeFile
from utils.auth import get_current_user


upload_router = APIRouter()

UPLOAD_DIR = Path("uploads/themes")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


@upload_router.get("/uploads/themes/{theme_id}/{filename}")
async def download_theme_file(
    theme_id: int,
    filename: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Скачивание файла темы:
    GET /uploads/themes/{theme_id}/{filename}

    Возвращает FileResponse с заголовком Content-Disposition: attachment,
    чтобы файл сохранялся на ПК пользователя.
    """
    # Проверяем, что тема существует и принадлежит преподавателю
    result = await db.execute(
        select(Theme)
        .options(selectinload(Theme.course).selectinload(Course.owner))
        .filter(Theme.id == theme_id)
    )
    theme = result.scalar_one_or_none()

    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")



    file_path = UPLOAD_DIR / str(theme_id) / filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # filename в заголовке — то, что увидит пользователь при сохранении
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream",
    )
