from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from database.engine import SessionDep, get_session
from database.models import User, Course
from repositories.product_repository import ProductRepository as Repo
from schemas.product import ProductSchema, ProductCreateSchema
from utils.auth import get_current_user
from schemas.course import CourseBase, CourseCreate, CourseShortResponse, CourseUpdate, CourseDetailResponse
from utils.auth import get_current_user


courses_router = APIRouter()


@courses_router.get("/my", response_model=List[CourseShortResponse])
def my_courses(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.is_teacher:
        # курсы, которые он ведёт
        return db.query(Course).filter(Course.owner_id == current_user.id).all()

    # курсы, на которые записан студент
    return current_user.enrolled_courses


@courses_router.get("/{course_id}", response_model=CourseDetailResponse)
def get_course(
    course_id: int,
    db: AsyncSession = Depends(get_session),
):
    course = (
        db.query(Course)
        .filter(Course.id == course_id)
        .first()
    )

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return course


@courses_router.post("/courses/{course_id}/enroll")
def enroll_course(
    course_id: int,
    db: AsyncSession = Depends(get_session),
    student: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Уже записан
    if course in student.enrolled_courses:
        return {"detail": "Already enrolled"}

    student.enrolled_courses.append(course)
    db.commit()

    return {"detail": "Enrolled successfully"}




#ТОЛЬКО ДЛЯ ПРЕПОДОВ
@courses_router.post("/", response_model=CourseDetailResponse)
def create_course(
    course_data: CourseCreate,
    db=SessionDep,
    current_user: User = Depends(get_current_user),
):
    new_course = Course(
        name=course_data.name,
        description=course_data.description,
        owner_id=current_user.id,
    )

    db.add(new_course)
    db.commit()
    db.refresh(new_course)

    return new_course


@courses_router.patch("/{course_id}", response_model=CourseDetailResponse)
def update_course(
    course_id: int,
    course_data: CourseUpdate,
    db=SessionDep,
    current_user: User = Depends(get_current_user),
):
    course = db.query(Course).filter(Course.id == course_id).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You are not the owner of this course"
        )

    if course_data.name is not None:
        course.name = course_data.name
    if course_data.description is not None:
        course.description = course_data.description

    db.commit()
    db.refresh(course)

    return course


@courses_router.delete("/{course_id}")
def delete_course(
    course_id: int, db=SessionDep, current_user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if course.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You are not the owner of this course"
        )

    db.delete(course)
    db.commit()

    return {"detail": "Course deleted successfully"}
