from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.schemas.status import DeviceStatusResponse
from app.schemas.online import OnlineDevicesResponse
from app.services.status_service import StatusService
from app.core.redis import get_redis
from redis.asyncio import Redis

router = APIRouter()


@router.get("/status/{device_id}", response_model=DeviceStatusResponse)
async def get_device_status(
    device_id: UUID,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Get the current status of a specific device"""
    status_service = StatusService(db, redis)
    result = await status_service.get_device_status(device_id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found"
        )
    
    return result


@router.get("/status", response_model=List[DeviceStatusResponse])
async def get_all_device_statuses(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Get the status of all devices"""
    status_service = StatusService(db, redis)
    results = await status_service.get_all_device_statuses()
    
    return results


@router.get("/online", response_model=OnlineDevicesResponse)
async def get_online_devices(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Get a list of devices that are currently online"""
    status_service = StatusService(db, redis)
    results = await status_service.get_online_devices()
    
    return results
