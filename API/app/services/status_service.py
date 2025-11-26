from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from redis.asyncio import Redis
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import json
from app.models.device import Device
from app.models.status import DeviceStatus, StatusEnum
from app.schemas.status import DeviceStatusResponse
from app.schemas.online import OnlineDevicesResponse
from app.config import get_settings

settings = get_settings()


class StatusService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis

    async def get_device_status(self, device_id: UUID) -> Optional[DeviceStatusResponse]:
        """Get status for a specific device with Redis caching"""
        # Try cache first
        cache_key = f"device_status:{device_id}"
        cached = await self.redis.get(cache_key)

        if cached:
            data = json.loads(cached)
            return DeviceStatusResponse(**data)

        # Query database
        query = select(Device, DeviceStatus).join(
            DeviceStatus, Device.device_id == DeviceStatus.device_id
        ).where(Device.device_id == device_id)

        result = await self.db.execute(query)
        row = result.first()

        if not row:
            return None

        device, status = row
        
        # Calculate time since last ping in seconds
        time_since_last_ping_seconds = None
        if status.last_ping_at:
            time_since_last_ping_seconds = int((datetime.utcnow() - status.last_ping_at).total_seconds())
        
        response = DeviceStatusResponse(
            device_id=device.device_id,
            device_name=device.device_name,
            status=status.status,
            last_ping_at=status.last_ping_at,
            status_changed_at=status.status_changed_at,
            updated_at=status.updated_at,
            time_since_last_ping_seconds=time_since_last_ping_seconds,
        )

        # Cache the result
        await self.redis.setex(
            cache_key,
            settings.REDIS_CACHE_TTL,
            response.model_dump_json(),
        )

        return response

    async def get_all_device_statuses(self) -> List[DeviceStatusResponse]:
        """Get status for all devices"""
        query = select(Device, DeviceStatus).join(
            DeviceStatus, Device.device_id == DeviceStatus.device_id
        ).order_by(Device.device_name)

        result = await self.db.execute(query)
        rows = result.all()

        responses = []
        for device, status in rows:
            # Calculate time since last ping in seconds
            time_since_last_ping_seconds = None
            if status.last_ping_at:
                time_since_last_ping_seconds = int((datetime.utcnow() - status.last_ping_at).total_seconds())
            
            responses.append(
                DeviceStatusResponse(
                    device_id=device.device_id,
                    device_name=device.device_name,
                    status=status.status,
                    last_ping_at=status.last_ping_at,
                    status_changed_at=status.status_changed_at,
                    updated_at=status.updated_at,
                    time_since_last_ping_seconds=time_since_last_ping_seconds,
                )
            )

        return responses

    async def get_online_devices(self) -> OnlineDevicesResponse:
        """Get list of device names that are currently online"""
        query = select(Device, DeviceStatus).join(
            DeviceStatus, Device.device_id == DeviceStatus.device_id
        ).where(
            DeviceStatus.status == StatusEnum.ONLINE
        ).order_by(Device.device_name)

        result = await self.db.execute(query)
        rows = result.all()

        online_names = [device.device_name for device, _ in rows]

        return OnlineDevicesResponse(
            online_count=len(online_names),
            online_devices=online_names,
        )
