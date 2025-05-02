package com.formulai.survey.dto;

import java.util.List;
import java.util.UUID;

public class SurveyDTO {

    private List<String> responses;

    public List<String> getResponses()
    {
        return responses;
    }

    public void setResponses(List<String> responses)
    {
        this.responses = responses;
    }
}
