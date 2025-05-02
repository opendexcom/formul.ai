package com.formulai.survey.service;

import com.formulai.survey.model.Survey;
import com.formulai.survey.repository.SurveyRepository;
import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.response.SurveyResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

import static java.lang.String.format;

@RequiredArgsConstructor
@Service
public class SurveyService {

    private final SurveyRepository surveyRepository;

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
        return "Survey created Succesfully";
    }

    public Survey toSurvey(SurveyRequest surveyRequest){
        return Survey
                .builder()
                .name(surveyRequest.name())
                .schemaJson(surveyRequest.schemaJson())
                .build();
    }

    private SurveyResponse fromSurvey(Survey survey) {
        return new SurveyResponse(
                survey.getId(),
                survey.getName(),
                survey.getSchemaJson()
        );
    }
}
