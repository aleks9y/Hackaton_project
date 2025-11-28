from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class ProductSchema(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    price: float
    quantity: int
    sku: str
    image_url: Optional[str] = None


class ProductCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    quantity: int
    sku: str
    image_url: Optional[str] = None
    category_id: int
    brand_id: int


class ProductUpdateSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    sku: Optional[str] = None
    image_url: Optional[str] = None


class ProductDBSchema(ProductSchema):
    id: UUID
    category_id: int
    brand_id: int