from pydantic import BaseModel
from typing import List, Optional

class ThemeResponse(BaseModel):
    id: int
    name: str
    text: str

    class Config:
        from_attributes = True


class CourseBase(BaseModel):
    name: str
    description: Optional[str]


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CourseShortResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class CourseDetailResponse(CourseBase):
    id: int
    owner_id: int
    themes: List[ThemeResponse]

    class Config:
        from_attributes = True
