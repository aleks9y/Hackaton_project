from pydantic import BaseModel
from typing import Optional

class ThemeBase(BaseModel):
    name: str
    text: str


class ThemeCreate(ThemeBase):
    pass


class ThemeUpdate(BaseModel):
    name: Optional[str] = None
    text: Optional[str] = None
    is_homework: Optional[bool] = False


class ThemeResponse(ThemeBase):
    id: int
    course_id: int

    class Config:
        from_attributes = True
