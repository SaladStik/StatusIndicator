from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.core.redis import get_redis
from app.schemas.device import DeviceCreate, DeviceResponse, DeviceWithApiKey
from app.services.device_service import DeviceService
from app.api.middleware.auth import verify_master_key

router = APIRouter()


@router.post("/devices", response_model=DeviceWithApiKey, status_code=http_status.HTTP_201_CREATED)
async def create_device(
    device_data: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    _: bool = Depends(verify_master_key),
):
    """
    Register a new device and generate an API key.
    Requires Master API Key authentication (X-Master-Key header).
    Returns the device info with the API key (only shown once).
    """
    device_service = DeviceService(db, redis)
    result = await device_service.create_device(device_data.device_name)
    
    return result


@router.get("/devices", response_model=List[DeviceResponse])
async def list_devices(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    _: bool = Depends(verify_master_key),
):
    """
    List all registered devices.
    Requires Master API Key authentication (X-Master-Key header).
    """
    device_service = DeviceService(db, redis)
    devices = await device_service.get_all_devices()
    
    return devices


@router.get("/devices/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: UUID,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    _: bool = Depends(verify_master_key),
):
    """
    Get a specific device by ID.
    Requires Master API Key authentication (X-Master-Key header).
    """
    device_service = DeviceService(db, redis)
    device = await device_service.get_device_by_id(device_id)
    
    if not device:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found"
        )
    
    return device


@router.delete("/devices/{device_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: UUID,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    _: bool = Depends(verify_master_key),
):
    """
    Delete a device and all associated data.
    Requires Master API Key authentication (X-Master-Key header).
    """
    device_service = DeviceService(db, redis)
    success = await device_service.delete_device(device_id)
    
    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found"
        )
    
    return None
