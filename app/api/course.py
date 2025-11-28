from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from database.engine import SessionDep
from database.models import User, Course
from repositories.product_repository import ProductRepository as Repo
from schemas.product import ProductSchema, ProductCreateSchema
from utils.auth import get_current_user
from schemas.course import CourseBase, CourseCreate, CourseResponse, CourseUpdate
from utils.auth import get_current_user


course_router = APIRouter()


@course_router.post("/", response_model=CourseResponse)
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


@course_router.get("/my-courses/", response_model=List[CourseResponse])
def get_my_courses(db=SessionDep, current_user: User = Depends(get_current_user)):
    courses = db.query(Course).filter(Course.owner_id == current_user.id).all()
    return courses


@course_router.patch("/{course_id}", response_model=CourseResponse)
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


@course_router.delete("/courses/{course_id}")
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
