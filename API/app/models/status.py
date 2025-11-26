import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class StatusEnum(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"


class DeviceStatus(Base):
    __tablename__ = "device_status"

    status_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.device_id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    status = Column(Enum(StatusEnum), default=StatusEnum.OFFLINE, nullable=False)
    last_ping_at = Column(DateTime, nullable=True, index=True)
    status_changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    device = relationship("Device", back_populates="status")
