from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from typing import List, Optional


class PingHistoryItem(BaseModel):
    ping_id: UUID
    device_id: UUID
    device_name: str
    ping_timestamp: datetime

    class Config:
        from_attributes = True


class PingHistoryResponse(BaseModel):
    device_id: Optional[UUID] = None
    device_name: Optional[str] = None
    total_pings: int
    pings: List[PingHistoryItem]
