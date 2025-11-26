from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class PingResponse(BaseModel):
    ping_id: UUID
    device_id: UUID
    ping_timestamp: datetime
    message: str = "Ping recorded successfully"

    class Config:
        from_attributes = True
