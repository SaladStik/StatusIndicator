from fastapi import Header, HTTPException, status, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import hash_api_key
from app.core.email import send_failed_auth_alert
from app.models.device import Device
from app.config import get_settings
import asyncio

settings = get_settings()


async def verify_master_key(
    request: Request,
    x_master_key: str = Header(..., description="Master API Key for admin operations"),
) -> bool:
    """
    Dependency to verify master API key for admin operations.
    Used for device creation and management.
    """
    if not x_master_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Master API key is required",
            headers={"WWW-Authenticate": "MasterKey"},
        )
    
    if x_master_key != settings.MASTER_API_KEY:
        # Send alert in background (don't wait for email)
        client_ip = request.client.host if request.client else "unknown"
        asyncio.create_task(send_failed_auth_alert(
            failed_key=x_master_key,
            ip_address=client_ip,
            endpoint="Master Key Authentication"
        ))
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid master API key",
            headers={"WWW-Authenticate": "MasterKey"},
        )
    
    return True


async def get_current_device(
    request: Request,
    x_api_key: str = Header(..., description="API Key for authentication"),
    db: AsyncSession = Depends(get_db),
) -> Device:
    """
    Dependency to authenticate requests using API key.
    Returns the authenticated device.
    """
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is required",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    # Hash the provided API key
    api_key_hash = hash_api_key(x_api_key)
    
    # Look up device by hashed API key
    query = select(Device).where(
        Device.api_key_hash == api_key_hash,
        Device.is_active == True
    )
    result = await db.execute(query)
    device = result.scalar_one_or_none()
    
    if not device:
        # Send alert in background (don't wait for email)
        client_ip = request.client.host if request.client else "unknown"
        asyncio.create_task(send_failed_auth_alert(
            failed_key=x_api_key,
            ip_address=client_ip,
            endpoint="Device API Key Authentication"
        ))
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    return device
