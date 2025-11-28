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
    Table
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


class UserCourseAssociation(Base):
    __tablename__ = 'user_course_association'
    
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey('courses.id'), primary_key=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name:  Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(100))
    hashed_password: Mapped[str] = mapped_column(String(256))
    is_teacher: Mapped[bool] = mapped_column(Boolean)
    
    owned_courses: Mapped[List["Course"]] = relationship(
        "Course", 
        back_populates="owner",
        foreign_keys="Course.owner_id"
    )
    enrolled_courses: Mapped[List["Course"]] = relationship(
        "Course",
        secondary="user_course_association",
        back_populates="students"
    )
    homeworks: Mapped[List["HomeworkSubmission"]] = relationship(
        "HomeworkSubmission", 
        back_populates="student"
    )
    
    
class Course(Base):
    __tablename__ = "courses"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))   
    name: Mapped[str] = mapped_column(String(200))  
    description: Mapped[Optional[str]] = mapped_column(Text)  

    owner: Mapped["User"] = relationship(
        "User", 
        back_populates="owned_courses",
        foreign_keys=[owner_id]
    )
    themes: Mapped[List["Theme"]] = relationship(
        "Theme", 
        back_populates="course",
        cascade="all, delete-orphan"
    )
    students: Mapped[List["User"]] = relationship(
        "User",
        secondary="user_course_association",
        back_populates="enrolled_courses"
    )


class Theme(Base):
    __tablename__ = "themes"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    name: Mapped[str] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text)

    course: Mapped["Course"] = relationship("Course", back_populates="themes")
    homeworks: Mapped[List["Homework"]] = relationship(
        "Homework", 
        back_populates="theme",
        cascade="all, delete-orphan")
    files: Mapped[List["File"]] = relationship(
        "File", 
        back_populates="theme",
        cascade="all, delete-orphan"
    )


class Homework(Base):
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    theme_id: Mapped[int] = mapped_column(ForeignKey("themes.id"))
    title: Mapped[str] = mapped_column(String(200))  
    text: Mapped[str] = mapped_column(Text) 
    max_score: Mapped[Optional[int]] = mapped_column(Integer) 
    
    theme: Mapped["Theme"] = relationship("Theme", back_populates="homeworks")
    submissions: Mapped[List["HomeworkSubmission"]] = relationship(
        "HomeworkSubmission", 
        back_populates="homework",
        cascade="all, delete-orphan"
    )    
    
    
class HomeworkSubmission(Base):
    __tablename__ = "homework_submissions"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    homework_id: Mapped[int] = mapped_column(ForeignKey("homeworks.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    answer: Mapped[str] = mapped_column(Text)
    submitted_at: Mapped[DateTime] = mapped_column(DateTime, default=lambda: get_moscow_time())
    score: Mapped[Optional[int]] = mapped_column(Integer)
    teacher_comment: Mapped[Optional[str]] = mapped_column(Text)
    
    homework: Mapped["Homework"] = relationship("Homework", back_populates="submissions")
    student: Mapped["User"] = relationship("User", back_populates="homeworks")
    attachment_files: Mapped[List["HomeworkFile"]] = relationship(
        "HomeworkFile", 
        back_populates="submission",
        cascade="all, delete-orphan"
    )


class File(Base):
    __tablename__ = "theme_files"  
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    theme_id: Mapped[int] = mapped_column(ForeignKey("themes.id", ondelete="CASCADE"))
    file_path: Mapped[str] = mapped_column(Text)
    
    theme: Mapped["Theme"] = relationship("Theme", back_populates="files")
    
    
class HomeworkFile(Base):
    __tablename__ = "homework_files"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("homework_submissions.id", ondelete="CASCADE"))
    file_path: Mapped[str] = mapped_column(Text)
    
    submission: Mapped["HomeworkSubmission"] = relationship("HomeworkSubmission", back_populates="attachment_files")