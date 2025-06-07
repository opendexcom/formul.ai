package com.formulai.survey.dto.request;

import com.fasterxml.jackson.databind.JsonNode;

public record SurveySubmitRequest(JsonNode answersJson) {
}
