import uvicorn
from fastapi import FastAPI, UploadFile
from contextlib import asynccontextmanager
from database.engine import create_db, drop_db
from fastapi.middleware.cors import CORSMiddleware
from api.auth import auth_router
from api.products import products_router
from api.categories import categories_router
from api.brands import brands_router
from api.cart import cart_router
from api.chat import chat_router
from api.admin import admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_param = True
    if run_param:
        await drop_db()
    await create_db()
    yield


app = FastAPI(title="my app", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(products_router, prefix="/products", tags=["products"])
app.include_router(categories_router, prefix="/categories", tags=["categories"])
app.include_router(brands_router, prefix="/brands", tags=["brands"])
app.include_router(cart_router, prefix="/cart", tags=["cart"])
app.include_router(chat_router, tags=["chat"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
