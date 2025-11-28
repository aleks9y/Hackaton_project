from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
from database.models import Product


class ProductRepository:
    async def create_product(session, product_data: dict) -> Product:
        product = Product(**product_data)
        session.add(product)
        await session.commit()
        await session.refresh(product)
        return product

    async def get_all_products(session, skip: int = 0, limit: int = 5) -> List[Product]:
        query = select(Product).offset(skip).limit(limit)
        res = await session.execute(query)
        return res.scalars().all()

    async def get_product_by_id(
        session,
        product_id: int,
    ) -> Optional[Product]:
        query = select(Product).where(Product.id == product_id)
        res = await session.execute(query)
        return res.scalar()

    async def get_products_by_category(
        session, category_id: int, skip: int = 0, limit: int = 5
    ) -> List[Product]:
        query = (
            select(Product)
            .where(Product.category_id == category_id)
            .offset(skip)
            .limit(limit)
        )
        res = await session.execute(query)
        return res.scalars().all()

    async def search_products(
        session, query: str, skip: int = 0, limit: int = 5
    ) -> List[Product]:
        query = (
            select(Product)
            .where((Product.name.ilike(f"%{query}%")) | (Product.sku.ilike(f"{query}")))
            .offset(skip)
            .limit(limit)
        )
        res = await session.execute(query)
        return res.scalars().all()
