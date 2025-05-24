package com.formulai.survey.dto.request;

import com.formulai.survey.validation.ValidJsonSchema;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SurveyRequest(
                @NotNull(message = "name is Required") @Size(max = 64, min = 1) String name,

                @NotNull(message = "schemaJson is Required") @ValidJsonSchema String schemaJson) {

}
