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
    isTeacher: bool

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
