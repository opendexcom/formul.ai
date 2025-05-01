package com.formulai.survey.dto;

import java.util.List;

public class SurveyDTO {
    private String formId;
    private List<String> responses;

    public String getFormId()
    {
        return formId;
    }

    public List<String> getResponses()
    {
        return responses;
    }

    public void setFormId(String formId)
    {
        this.formId = formId;
    }

    public void setResponses(List<String> responses)
    {
        this.responses = responses;
    }
}
