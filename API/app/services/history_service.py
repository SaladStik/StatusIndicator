from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from app.models.ping import StatusPing
from app.models.device import Device
from app.schemas.history import PingHistoryItem, PingHistoryResponse


class HistoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_ping_history(
        self,
        device_id: Optional[UUID] = None,
        limit: int = 100,
        days: Optional[int] = None,
    ) -> PingHistoryResponse:
        """
        Get ping history for a specific device or all devices

        Args:
            device_id: Optional device ID to filter by
            limit: Maximum number of pings to return (default 100)
            days: Optional number of days to look back
        """
        # Build query
        query = (
            select(StatusPing, Device.device_name)
            .join(Device, StatusPing.device_id == Device.device_id)
            .order_by(desc(StatusPing.ping_timestamp))
        )

        # Filter by device if specified
        if device_id:
            query = query.where(StatusPing.device_id == device_id)

        # Filter by date range if specified
        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = query.where(StatusPing.ping_timestamp >= cutoff_date)

        # Apply limit
        query = query.limit(limit)

        # Execute query
        result = await self.db.execute(query)
        rows = result.all()

        # Count total pings
        count_query = select(func.count(StatusPing.ping_id))
        if device_id:
            count_query = count_query.where(StatusPing.device_id == device_id)
        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            count_query = count_query.where(StatusPing.ping_timestamp >= cutoff_date)

        count_result = await self.db.execute(count_query)
        total_pings = count_result.scalar()

        # Format results
        pings = [
            PingHistoryItem(
                ping_id=ping.ping_id,
                device_id=ping.device_id,
                device_name=device_name,
                ping_timestamp=ping.ping_timestamp,
            )
            for ping, device_name in rows
        ]

        # Get device name if filtering by device
        device_name = None
        if device_id and pings:
            device_name = pings[0].device_name

        return PingHistoryResponse(
            device_id=device_id,
            device_name=device_name,
            total_pings=total_pings,
            pings=pings,
        )
