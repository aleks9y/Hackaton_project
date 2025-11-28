from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from database.engine import get_session
from repositories.product_repository import ProductRepository as Repo
from schemas.product import ProductSchema, ProductCreateSchema
from utils.auth import get_current_user


products_router = APIRouter()


@products_router.get("/", response_model=List[ProductSchema])
async def get_products(
    skip: int = 0,
    limit: int = 5,
    session = Depends(get_session),
    current_user = Depends(get_current_user) 
    ):
    products = await Repo.get_all_products(session, skip, limit)
    return products


@products_router.get("/product/{product_id}", response_model=ProductSchema)
async def get_product(
    product_id: UUID,
    session = Depends(get_session)
):
    product = Repo.get_product_by_id(session, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    return product


@products_router.get("/category/{category_id}", response_model=List[ProductSchema])
async def get_products_by_category(
    category_id: int,
    skip: int = 0,
    limit: int = 5,
    session =  Depends(get_session)
):
    products = Repo.get_products_by_category(session, category_id, skip, limit)
    if not products:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Products by this category not found"
        )
    return products


@products_router.get("/search")
async def search_products(
    query: str,
    skip: int = 0,
    limit: int = 5,
    session = Depends(get_session)
):
    products = await Repo.search_products(session, query, skip, limit)
    return products


