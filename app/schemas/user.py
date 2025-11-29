from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional


class UserCredsSchema(BaseModel):
    email: EmailStr
    password: str

    model_config = ConfigDict(extra="forbid")


class UserRegisterSchema(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    is_teacher: bool

    model_config = ConfigDict(extra="forbid")


class UserSchema(BaseModel):
    email: EmailStr
    fio: str
    isTeacher: bool

    model_config = ConfigDict(extra="forbid")


class TokenSchema(BaseModel):
    access_token: str
    token_type: str

    model_config = ConfigDict(extra="forbid")


class StudentProgressSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    student_id: int
    student_name: str
    course_id: int
    course_name: str
    completed_themes: int
    total_themes: int
    progress_percentage: float


class StudentHomeworkSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    homework_id: int
    theme_name: str
    course_name: str
    submitted_at: datetime
    status: str
    score: Optional[int] = None
