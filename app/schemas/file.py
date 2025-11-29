from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class FileBase(BaseModel):
    file_path: str
    is_homework: bool


class FileCreate(FileBase):
    theme_id: Optional[int] = None
    homework_id: Optional[int] = None


class FileSchema(FileBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    theme_id: Optional[int] = None
    homework_id: Optional[int] = None
    created: datetime
