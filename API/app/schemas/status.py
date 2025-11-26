from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from app.models.status import StatusEnum


class DeviceStatusResponse(BaseModel):
    device_id: UUID
    device_name: str
    status: StatusEnum
    last_ping_at: Optional[datetime]
    status_changed_at: datetime
    updated_at: datetime
    time_since_last_ping_seconds: Optional[int] = None

    class Config:
        from_attributes = True
