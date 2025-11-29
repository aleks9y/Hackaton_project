import uvicorn
from fastapi import FastAPI, UploadFile
from contextlib import asynccontextmanager
from database.engine import create_db, drop_db
from fastapi.middleware.cors import CORSMiddleware
from api.auth import auth_router
from api.courses import courses_router
from api.themes import themes_router
from api.users import users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_param = False
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
app.include_router(courses_router, prefix="/courses", tags=["courses"])
app.include_router(themes_router, prefix="/themes", tags=["themes"])
app.include_router(users_router, prefix="/users", tags=["users"])


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
