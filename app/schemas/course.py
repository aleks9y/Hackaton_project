from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional


class HomeworkSubmissionCreate(BaseModel):
    homework_id: int
    answer: str


class HomeworkSubmissionResponse(BaseModel):
    id: int
    homework_id: int
    student_id: int
    answer: str
    submitted_at: datetime
    score: Optional[int] = None
    teacher_comment: Optional[str] = None
    attachment_files: List[str] = []

    class Config:
        from_attributes = True


class TeacherFeedback(BaseModel):
    score: int
    teacher_comment: str


class HomeworkWithSubmissions(BaseModel):
    id: int
    title: str
    text: str
    max_score: Optional[int] = None
    submissions: List[HomeworkSubmissionResponse] = []

    class Config:
        from_attributes = True
