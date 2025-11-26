from pydantic import BaseModel
from typing import List


class OnlineDevicesResponse(BaseModel):
    online_count: int
    online_devices: List[str]
    
    class Config:
        from_attributes = True
