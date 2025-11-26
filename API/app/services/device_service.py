from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from redis.asyncio import Redis
from typing import List, Optional
from uuid import UUID
from app.models.device import Device
from app.models.status import DeviceStatus, StatusEnum
from app.core.security import generate_api_key, hash_api_key
from app.schemas.device import DeviceResponse, DeviceWithApiKey


class DeviceService:
    def __init__(self, db: AsyncSession, redis: Redis = None):
        self.db = db
        self.redis = redis

    async def create_device(self, device_name: str) -> DeviceWithApiKey:
        """Create a new device with an API key"""
        # Generate API key
        api_key = generate_api_key()
        api_key_hash = hash_api_key(api_key)

        # Create device
        new_device = Device(
            device_name=device_name,
            api_key_hash=api_key_hash,
        )
        self.db.add(new_device)
        await self.db.flush()

        # Create initial status record
        device_status = DeviceStatus(
            device_id=new_device.device_id,
            status=StatusEnum.OFFLINE,
        )
        self.db.add(device_status)
        await self.db.commit()
        await self.db.refresh(new_device)

        # Return device with plain API key (only time it's shown)
        return DeviceWithApiKey(
            device_id=new_device.device_id,
            device_name=new_device.device_name,
            created_at=new_device.created_at,
            updated_at=new_device.updated_at,
            is_active=new_device.is_active,
            api_key=api_key,
        )

    async def get_device_by_id(self, device_id: UUID) -> Optional[DeviceResponse]:
        """Get a device by ID"""
        query = select(Device).where(Device.device_id == device_id)
        result = await self.db.execute(query)
        device = result.scalar_one_or_none()

        if device:
            return DeviceResponse.model_validate(device)
        return None

    async def get_all_devices(self) -> List[DeviceResponse]:
        """Get all devices"""
        query = select(Device).order_by(Device.created_at.desc())
        result = await self.db.execute(query)
        devices = result.scalars().all()

        return [DeviceResponse.model_validate(device) for device in devices]

    async def delete_device(self, device_id: UUID) -> bool:
        """Delete a device"""
        query = select(Device).where(Device.device_id == device_id)
        result = await self.db.execute(query)
        device = result.scalar_one_or_none()

        if device:
            await self.db.delete(device)
            await self.db.commit()
            
            # Invalidate Redis cache for this device
            if self.redis:
                cache_key = f"device_status:{device_id}"
                await self.redis.delete(cache_key)
            
            return True
        return False
