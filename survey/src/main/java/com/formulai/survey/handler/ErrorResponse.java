package com.formulai.survey.handler;

import java.util.Map;

public record ErrorResponse(
        Map<String, String> errors
) {

}
