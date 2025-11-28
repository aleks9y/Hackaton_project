from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class UserCredsSchema(BaseModel):
    phone: str
    password: str

    model_config = ConfigDict(extra="forbid")


class UserRegisterSchema(BaseModel):
    phone: str
    password: str
    fio: str
    role: Optional[str] = "customer"

    model_config = ConfigDict(extra="forbid")


class UserSchema(BaseModel):
    phone: str
    fio: str
    role: str

    model_config = ConfigDict(extra="forbid")


class TokenSchema(BaseModel):
    access_token: str
    token_type: str

    model_config = ConfigDict(extra="forbid")
