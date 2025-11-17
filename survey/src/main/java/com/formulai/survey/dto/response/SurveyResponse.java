package com.formulai.survey.dto.response;

import java.util.UUID;

public record SurveyResponse(
        UUID id,
        String name,
        String schemaJson,
        String status,
        UUID task_id
) {

}
