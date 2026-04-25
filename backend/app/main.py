from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import router as routes_router
from .config import get_cors_origins

app = FastAPI(
    title="IntervAI API",
    description="AI mock interview platform backend",
    version="1.0.0",
)

origins = get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_router)
