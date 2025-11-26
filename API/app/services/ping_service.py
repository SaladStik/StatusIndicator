from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from redis.asyncio import Redis
from datetime import datetime
from uuid import UUID
from app.models.ping import StatusPing
from app.models.status import DeviceStatus, StatusEnum
from app.schemas.ping import PingResponse


class PingService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis

    async def record_ping(self, device_id: UUID) -> PingResponse:
        """Record a ping from a device and update its status"""
        current_time = datetime.utcnow()

        # Create ping record
        new_ping = StatusPing(
            device_id=device_id,
            ping_timestamp=current_time,
        )
        self.db.add(new_ping)
        await self.db.flush()

        # Update device status
        query = select(DeviceStatus).where(DeviceStatus.device_id == device_id)
        result = await self.db.execute(query)
        device_status = result.scalar_one_or_none()

        if device_status:
            # Check if status is changing
            old_status = device_status.status
            device_status.last_ping_at = current_time
            device_status.status = StatusEnum.ONLINE
            device_status.updated_at = current_time

            if old_status != StatusEnum.ONLINE:
                device_status.status_changed_at = current_time

        await self.db.commit()
        
        # Invalidate Redis cache for this device
        cache_key = f"device_status:{device_id}"
        await self.redis.delete(cache_key)
        
        await self.db.refresh(new_ping)

        return PingResponse(
            ping_id=new_ping.ping_id,
            device_id=new_ping.device_id,
            ping_timestamp=new_ping.ping_timestamp,
        )
