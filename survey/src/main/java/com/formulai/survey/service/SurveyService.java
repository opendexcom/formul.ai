package com.formulai.survey.service;

import com.formulai.survey.dto.request.SurveySubmitRequestDTO;
import com.formulai.survey.model.Survey;
import com.formulai.survey.model.SurveyResponse;
import com.formulai.survey.repository.SurveyRepository;
import com.formulai.survey.dto.request.SurveyRequestDTO;
import com.formulai.survey.dto.response.SurveyResponseDTO;
import com.formulai.survey.repository.SurveyResponseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

import static java.lang.String.format;

@RequiredArgsConstructor
@Service
public class SurveyService {

    private final SurveyRepository surveyRepository;
    private final SurveyResponseRepository surveyResponseRepository;

    public SurveyResponseDTO getSurveyById(String id) {
        return surveyRepository
                .findById(id)
                .map(this::fromSurvey)
                .orElseThrow(()-> new IllegalArgumentException(format("Survey %s not found!", id)));
                // () and -> is a lambda. Lambda is a temporary function without a name.
                // In our case we want just throw IllegalArgumentException if any problem exist.
    }

    public List<SurveyResponseDTO> getAllSurvey(){
        return surveyRepository
                .findAll()
                .stream()
                .map(this::fromSurvey)
                .collect(Collectors.toList());
    }

    public String createSurvey(SurveyRequestDTO request) {
        surveyRepository.save(toSurvey(request));
        return "Survey created successfully";
    }

    public Survey toSurvey(SurveyRequestDTO surveyRequest){
        return Survey
                .builder()
                .name(surveyRequest.name())
                .schemaJson(surveyRequest.schemaJson())
                .build();
    }

    public List<SurveyResponseDTO> getResponses() {
        return surveyResponseRepository.findAll().stream().map(this::fromSurveyResponse).collect(Collectors.toList());
    }

    public String submitSurveyRequest(String id, SurveySubmitRequestDTO request) {
        surveyResponseRepository.save(toSurveyResponse(id, request));

        return "Survey submitted successfully";
    }

    private SurveyResponse toSurveyResponse(String id, SurveySubmitRequestDTO request)
    {
        var survey = surveyRepository.findById(id);
        if(survey.isEmpty())
            throw new IllegalArgumentException(format("Survey %s not found!", id));

        if(request.responses() == null || request.responses().isEmpty())
            throw new IllegalArgumentException("Survey responses cannot be null or empty!");

        try {
            String responsesJson = objectMapper.writeValueAsString(request);
            return SurveyResponse.builder().survey(survey.get()).responsesJson(responsesJson).build();
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize survey responses to JSON", e);
        }
    }

    private SurveyResponseDTO fromSurvey(Survey survey) {
        return new SurveyResponseDTO(
                survey.getId(),
                survey.getName(),
                survey.getSchemaJson()
        );
    }

    private SurveyResponseDTO fromSurveyResponse(SurveyResponse surveyResponse) {
        return new SurveyResponseDTO(
                surveyResponse.getId(),
                surveyResponse.getSurvey().getName(),
                surveyResponse.getResponsesJson()
        );
    }
}
