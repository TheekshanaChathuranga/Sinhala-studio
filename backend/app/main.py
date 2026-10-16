import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.api.routes.projects import router as projects_router
from app.api.routes.subtitles import router as subtitles_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.exports import router as exports_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("sinhala_subtitles")

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sinhala Subtitle Generator API",
    description="AI-powered speech recognition, Sinhala translation, and subtitle synchronization service.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in dev for frontend flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(projects_router, prefix=settings.API_PREFIX)
app.include_router(subtitles_router, prefix=settings.API_PREFIX)
app.include_router(jobs_router, prefix=settings.API_PREFIX)
app.include_router(exports_router, prefix=settings.API_PREFIX)

@app.get("/health", tags=["health"])
@app.get(f"{settings.API_PREFIX}/health", tags=["health"])
def health_check():
    return {
        "status": "healthy",
        "service": "Sinhala Subtitle Generator",
        "version": "1.0.0",
        "environment": settings.APP_ENV,
        "asr_provider": settings.ASR_PROVIDER,
        "translation_provider": settings.TRANSLATION_PROVIDER
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
