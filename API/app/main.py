from fastapi import FastAPI
from contextlib import asynccontextmanager
from datetime import datetime
from app.config import get_settings
from app.core.database import init_db
from app.core.redis import init_redis, close_redis
from app.api.routes import devices, ping, status, history
from app.tasks.status_checker import start_status_checker, stop_status_checker

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    await init_redis()
    await init_db()
    await start_status_checker()
    yield
    # Shutdown
    await stop_status_checker()
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# Include routers
app.include_router(
    devices.router, prefix=f"/api/{settings.API_VERSION}", tags=["devices"]
)
app.include_router(ping.router, prefix=f"/api/{settings.API_VERSION}", tags=["ping"])
app.include_router(
    status.router, prefix=f"/api/{settings.API_VERSION}", tags=["status"]
)
app.include_router(
    history.router, prefix=f"/api/{settings.API_VERSION}", tags=["history"]
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.API_VERSION,
        "docs": "/docs",
    }
