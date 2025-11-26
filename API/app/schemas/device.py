from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class DeviceCreate(BaseModel):
    device_name: str = Field(..., min_length=1, max_length=255, description="Name of the device")


class DeviceResponse(BaseModel):
    device_id: UUID
    device_name: str
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class DeviceWithApiKey(DeviceResponse):
    api_key: str = Field(..., description="API key (only returned once on creation)")
