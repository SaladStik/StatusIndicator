from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from app.core.database import get_db
from app.core.redis import get_redis
from app.schemas.ping import PingResponse
from app.services.ping_service import PingService
from app.api.middleware.auth import get_current_device

router = APIRouter()


@router.post("/ping", response_model=PingResponse, status_code=status.HTTP_200_OK)
async def send_ping(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_device = Depends(get_current_device),
):
    """
    Receive a heartbeat ping from a device.
    Just send the ping with your API key - no request body needed.
    """
    ping_service = PingService(db, redis)
    result = await ping_service.record_ping(device_id=current_device.device_id)
    
    return result
