from pydantic import BaseModel
from typing import Optional, List


class CourseBase(BaseModel):
    name: str
    description: Optional[str] = None


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CourseResponse(CourseBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True
