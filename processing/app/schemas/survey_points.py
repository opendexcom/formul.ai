from pydantic import BaseModel
from typing import List, Optional

class SentimentDistribution(BaseModel):
    positive: int
    neutral: int
    negative: int

class TopicFrequency(BaseModel):
    topic: str
    count: int

class NumericalSummaryPerQuestion(BaseModel):
    topValues: Optional[List[dict]] = None
    uniqueCount: Optional[int] = None
    average: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    distribution: Optional[List[dict]] = None
    optionCounts: Optional[List[dict]] = None

class QuestionSummary(BaseModel):
    textSummary: str
    numericalSummary: Optional[NumericalSummaryPerQuestion]
    sentimentDistribution: Optional[SentimentDistribution]

class QuestionAnalysis(BaseModel):
    fieldId: str
    label: str
    type: str
    questionSummary: QuestionSummary

class Segment(BaseModel):
    segmentName: str
    criteria: str
    count: int
    summary: str

class OverallSummary(BaseModel):
    overall: str
    strengths: List[str]
    areasForImprovement: List[str]
    recommendations: List[str]
    keyQuotes: List[str]

class NumericalSummary(BaseModel):
    sentimentDistribution: SentimentDistribution
    topicFrequencies: List[TopicFrequency]
    averageExperienceYears: Optional[float]
    mostMentionedTech: List[str]

class Analysis(BaseModel):
    generatedAt: str
    model: str
    summary: OverallSummary
    numericalSummary: NumericalSummary
    segmentation: List[Segment]
    questions: List[QuestionAnalysis]

class FormAnalysis(BaseModel):
    formId: str
    analysis: Analysis
