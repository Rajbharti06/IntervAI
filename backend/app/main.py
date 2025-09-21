from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import router as routes_router

app = FastAPI()

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Include the API router so endpoints are registered properly
app.include_router(routes_router)
