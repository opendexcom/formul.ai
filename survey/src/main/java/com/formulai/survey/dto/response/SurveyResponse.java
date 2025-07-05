package com.formulai.survey.dto.response;

import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.formulai.survey.model.SurveyStatus;

public record SurveyResponse(
        UUID id,
        String name,
        JsonNode schemaJson,
        SurveyStatus status
) {

}
