from pydantic import BaseModel
from sqlmodel import Field

from app.schemas.survey_points_sentiment_bucket import SurveyPointsSentimentBucket


class SurveyPoints(BaseModel):
    """Data that we want collect from llm as response"""

    frequent: SurveyPointsSentimentBucket = Field(description="List of frequent points")
    moderate: SurveyPointsSentimentBucket = Field(description="List of moderate points")
    occasional: SurveyPointsSentimentBucket = Field(description="List of occasional points")
