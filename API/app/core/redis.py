from redis.asyncio import Redis
from app.config import get_settings

settings = get_settings()

redis_client: Redis | None = None


async def get_redis() -> Redis:
    """Get Redis client instance"""
    return redis_client


async def init_redis():
    """Initialize Redis connection"""
    global redis_client
    redis_client = await Redis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )


async def close_redis():
    """Close Redis connection"""
    global redis_client
    if redis_client:
        await redis_client.close()
