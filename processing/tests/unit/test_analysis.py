from uuid import uuid4
import pytest
from app.schemas.analyze_survey_data import AnalyzeSurveyData
from app.services.analysis_service import AnalysisService


@pytest.mark.asyncio
async def test_analysis_service__start_survey_analysis(mock_client, mocked_response, mock_chat):
    analysis_service = AnalysisService(mock_client)

    # Prepare test data
    local_survey_id = uuid4()
    question = "How are you?"
    answers = ["Good", "Bad"]
    survey_data = AnalyzeSurveyData(survey_id=local_survey_id, question=question, answers=answers)

    response = await analysis_service.start_survey_analysis(survey_data)

    # Use the fixture value directly for assertion
    assert response == mocked_response.message.content

    mock_chat.assert_called_once()
