from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from database.engine import get_session
from database.models import Brand, Category
from repositories.brand_repository import BrandRepository as Repo
from schemas.brand import BrandSchema, CreateBrandSchema
from schemas.category import CategorySchema, CreateCategorySchema
from schemas.product import ProductCreateSchema
from utils.role_checker import admin


admin_router = APIRouter(
    dependencies=[Depends(admin)]
)


@admin_router.post("/brand/create", status_code=status.HTTP_201_CREATED)
async def create_brand(brand_data: CreateBrandSchema, session=Depends(get_session)):
    brand_dict = brand_data.model_dump()
    brand = await Repo.create_brand(session, brand_dict)
    return brand


@admin_router.post("/category/create", status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CreateCategorySchema, session=Depends(get_session)
):
    category_dict = category_data.model_dump()
    category = await Repo.create_category(session, category_dict)
    return category


@admin_router.post("/product/create", status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreateSchema, session=Depends(get_session)
):
    product_dict = product_data.model_dump()
    product = await Repo.create_product(session, product_dict)
    return product
