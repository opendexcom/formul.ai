package com.formulai.survey.dto.response;

import java.util.UUID;

public record SurveyAnswerResponse(
        UUID surveyId,
        String answersJson) {
}
