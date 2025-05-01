from pydantic import BaseModel

class Item(BaseModel):
    name: str
    price: float
    is_offer: bool = False

class ProcessSurveyRequest(BaseModel):
    survey_id: str
    question: str
    answers: list[str]
