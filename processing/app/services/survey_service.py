from app.repository.survey_repository import SurveyRepository


class SurveyService:
    def __init__(self, survey_repository: SurveyRepository):
        self.survey_repository = survey_repository

    def get_survey_by_id(self, survey_id):
        return self.survey_repository.get_by_id(survey_id)
