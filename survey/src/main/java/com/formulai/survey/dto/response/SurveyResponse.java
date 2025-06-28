package com.formulai.survey.dto.response;

import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

public record SurveyResponse(
        UUID id,
        String name,
        JsonNode schemaJson
) {

}
