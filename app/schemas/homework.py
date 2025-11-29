from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import datetime

from app.schemas.file import FileSchema


class HomeworkBase(BaseModel):
    title: str
    text: str


class HomeworkCreate(HomeworkBase):
    theme_id: int


class HomeworkUpdate(HomeworkBase):
    pass


class HomeworkSchema(HomeworkBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    theme_id: int
    created: datetime
    student_name: Optional[str] = None
    course_name: Optional[str] = None
    theme_name: Optional[str] = None
    submission: Optional["HomeworkSubmissionSchema"] = None
    files: List["FileSchema"] = []


class HomeworkSubmissionBase(BaseModel):
    text: str


class HomeworkSubmissionCreate(HomeworkSubmissionBase):
    homework_id: int


class HomeworkSubmissionUpdate(BaseModel):
    score: int = Field(ge=1, le=10)
    teacher_comment: Optional[str] = None


class HomeworkSubmissionSchema(HomeworkSubmissionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    homework_id: int
    submitted_at: datetime
    score: Optional[int] = None
    teacher_comment: Optional[str] = None
    status: str = "pending"


class HomeworkFilter(BaseModel):
    course_id: Optional[int] = None
    theme_id: Optional[int] = None
    status: Optional[str] = None
    student_id: Optional[int] = None
