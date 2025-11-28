import uuid
from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    String,
    Text,
    func,
    Boolean,
    ForeignKey,
    Integer,
    ARRAY,
    JSON,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from typing import List, Optional
from sqlalchemy.dialects.postgresql import UUID

from utils.time import get_moscow_time


class Base(DeclarativeBase):
    created: Mapped[DateTime] = mapped_column(
        DateTime, default=lambda: get_moscow_time()
    )
    updated: Mapped[DateTime] = mapped_column(
        DateTime, default=lambda: get_moscow_time(), onupdate=lambda: get_moscow_time()
    )


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(100), nullable=True)
    fio: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="customer", nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)

    cart: Mapped["Cart"] = relationship(back_populates="user")
    orders: Mapped[List["Order"]] = relationship(back_populates="user")

