from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from app.core.database import get_db
from app.schemas.history import PingHistoryResponse
from app.services.history_service import HistoryService

router = APIRouter()


@router.get("/history", response_model=PingHistoryResponse)
async def get_ping_history(
    device_id: Optional[UUID] = Query(None, description="Filter by device ID"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of pings to return"
    ),
    days: Optional[int] = Query(None, ge=1, description="Number of days to look back"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get historical ping data for all devices or a specific device.
    This endpoint is public and does not require authentication.

    Query parameters:
    - device_id: Optional UUID to filter by specific device
    - limit: Maximum number of pings to return (1-1000, default 100)
    - days: Optional number of days to look back
    """
    history_service = HistoryService(db)
    result = await history_service.get_ping_history(
        device_id=device_id, limit=limit, days=days
    )

    return result
