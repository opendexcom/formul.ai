package com.formulai.survey.service;

import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.model.Survey;
import com.formulai.survey.model.SurveyAnswers;
import com.formulai.survey.repository.SurveyRepository;
import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.repository.SurveyAnswerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

import static java.lang.String.format;

@RequiredArgsConstructor
@Service
public class SurveyService {

    private final SurveyRepository surveyRepository;
    private final SurveyAnswerRepository surveyResponseRepository;

    public SurveyResponse getSurveyById(String id) {
        return surveyRepository
                .findById(id)
                .map(this::fromSurvey)
                .orElseThrow(()-> new IllegalArgumentException(format("Survey %s not found!", id)));
                // () and -> is a lambda. Lambda is a temporary function without a name.
                // In our case we want just throw IllegalArgumentException if any problem exist.
    }

    public List<SurveyResponse> getAllSurvey(){
        return surveyRepository
                .findAll()
                .stream()
                .map(this::fromSurvey)
                .collect(Collectors.toList());
    }

    public String createSurvey(SurveyRequest request) {
        surveyRepository.save(toSurvey(request));
        return "Survey created successfully";
    }

    public Survey toSurvey(SurveyRequest surveyRequest){
        return Survey
                .builder()
                .name(surveyRequest.name())
                .schemaJson(surveyRequest.schemaJson())
                .build();
    }

    public List<SurveyResponse> getResponses(String survey_id) {
        return surveyResponseRepository.find().stream().map(this::fromSurveyResponse).collect(Collectors.toList());
    }

    public String submitSurveyRequest(String id, SurveySubmitRequest request) {
        surveyResponseRepository.save(toSurveyResponse(id, request));

        return "Survey submitted successfully";
    }

    private SurveyAnswers toSurveyResponse(String id, SurveySubmitRequest request)
    {
        var survey = surveyRepository.findById(id);
        if(survey.isEmpty())
            throw new IllegalArgumentException(format("Survey %s not found!", id));

        if(request.responses() == null || request.responses().isEmpty())
            throw new IllegalArgumentException("Survey responses cannot be null or empty!");

        try {
            
            return SurveyAnswers.builder().survey(survey.get()).responsesJson(responsesJson).build();
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize survey responses to JSON", e);
        }
    }

    private SurveyResponse fromSurvey(Survey survey) {
        return new SurveyResponse(
                survey.getId(),
                survey.getName(),
                survey.getSchemaJson()
        );
    }

    private SurveyResponse fromSurveyResponse(SurveyAnswers surveyResponse) {
        return new SurveyResponse(
                surveyResponse.getId(),
                surveyResponse.getSurvey().getName(),
                surveyResponse.getAnswersJson()
        );
    }
}
