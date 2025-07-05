import json
import redis.asyncio as aioredis
from typing import Optional
from enum import StrEnum
import os

def get_redis_url() -> str:
    host = os.getenv("REDIS_HOST", "redis")
    return os.getenv("REDIS_URL", f"redis://{host}:6379")

class SurveyStatus(StrEnum):
    NEW = "NEW"
    ONGOING = "ONGOING"
    UNDER_ANALYSIS = "UNDER_ANALYSIS"
    ANALYSIS_DONE = "ANALYSIS_DONE"
    ANALYSIS_ERROR = "ANALYSIS_ERROR"

async def publish_survey_status(survey_id: str, status: SurveyStatus, redis_url: Optional[str] = None):
    if redis_url is None:
        redis_url = get_redis_url()
    redis = aioredis.from_url(redis_url)
    message = {
        "surveyId": survey_id,
        "status": status
    }
    await redis.publish("survey-status-update", json.dumps(message))
    await redis.close()
