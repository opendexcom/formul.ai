from pydantic import BaseModel
from sqlmodel import Field


class SurveyPointsSentimentBucket(BaseModel):
    """Sentiment bucket for survey points"""

    positive: list[str] = Field(description="List of positive points")
    negative: list[str] = Field(description="List of negative points")
