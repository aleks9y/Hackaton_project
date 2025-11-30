import uvicorn
from fastapi import FastAPI, UploadFile
from contextlib import asynccontextmanager
from database.engine import create_db, drop_db
from fastapi.middleware.cors import CORSMiddleware
from api.auth import auth_router
from api.courses import courses_router
from api.themes import themes_router
from api.homeworks import homeworks_router
from api.files import files_router
from api.uploads import upload_router


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
    allow_origins=[
        "https://fussily-tops-bowerbird.cloudpub.ru",  # Основной домен
        "https://jubilantly-evident-warthog.cloudpub.ru",  # Бэкенд домен
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://0.0.0.0:5500",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://0.0.0.0:3000",
        "https://lusciously-reliable-hermit.cloudpub.ru",
        "https://merely-factual-platy.cloudpub.ru",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(courses_router, prefix="/courses", tags=["courses"])
app.include_router(themes_router, prefix="/themes", tags=["themes"])
app.include_router(homeworks_router, prefix="/homeworks", tags=["homeworks"])
app.include_router(files_router, prefix="/files", tags=["files"])
app.include_router(upload_router, tags=["uploads"])


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8080, reload=True)
