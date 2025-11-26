from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.redis import get_redis
from app.models.device import Device
from app.models.status import DeviceStatus, StatusEnum
from app.config import get_settings

settings = get_settings()
scheduler = AsyncIOScheduler()


async def check_device_statuses():
    """Background task to check device statuses based on last ping time"""
    async with AsyncSessionLocal() as session:
        # Get all devices with their last ping time
        query = select(Device, DeviceStatus).join(
            DeviceStatus, Device.device_id == DeviceStatus.device_id
        ).where(Device.is_active == True)
        
        result = await session.execute(query)
        devices_with_status = result.all()
        
        current_time = datetime.utcnow()
        threshold_minutes = settings.OFFLINE_THRESHOLD_MINUTES
        
        # Track which devices changed status to invalidate cache
        changed_device_ids = []
        
        for device, device_status in devices_with_status:
            old_status = device_status.status
            
            if device_status.last_ping_at is None:
                # Never pinged - mark as offline
                if device_status.status != StatusEnum.OFFLINE:
                    device_status.status = StatusEnum.OFFLINE
                    device_status.status_changed_at = current_time
                    device_status.updated_at = current_time
                    changed_device_ids.append(device.device_id)
            else:
                # Check time since last ping
                time_since_ping = (current_time - device_status.last_ping_at).total_seconds() / 60
                
                if time_since_ping > threshold_minutes:
                    # Mark as offline
                    if device_status.status != StatusEnum.OFFLINE:
                        device_status.status = StatusEnum.OFFLINE
                        device_status.status_changed_at = current_time
                        device_status.updated_at = current_time
                        changed_device_ids.append(device.device_id)
                else:
                    # Mark as online
                    if device_status.status != StatusEnum.ONLINE:
                        device_status.status = StatusEnum.ONLINE
                        device_status.status_changed_at = current_time
                        device_status.updated_at = current_time
                        changed_device_ids.append(device.device_id)
        
        await session.commit()
        
        # Invalidate Redis cache for devices that changed status
        if changed_device_ids:
            redis = await get_redis()
            if redis:
                cache_keys = [f"device_status:{device_id}" for device_id in changed_device_ids]
                if cache_keys:
                    await redis.delete(*cache_keys)


async def start_status_checker():
    """Start the background status checker"""
    scheduler.add_job(
        check_device_statuses,
        'interval',
        minutes=settings.STATUS_CHECK_INTERVAL_MINUTES,
        id='status_checker',
        replace_existing=True,
    )
    scheduler.start()


async def stop_status_checker():
    """Stop the background status checker"""
    scheduler.shutdown()
