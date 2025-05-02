package com.formulai.survey.service;

import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.model.Survey;
import com.formulai.survey.model.SurveyAnswers;
import com.formulai.survey.repository.SurveyRepository;
import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.response.SurveyAnswerResponse;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.repository.SurveyAnswerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static java.lang.String.format;

@RequiredArgsConstructor
@Service
public class SurveyService {

    private final SurveyRepository surveyRepository;
    private final SurveyAnswerRepository surveyAnswerRepository;

    public SurveyResponse getSurveyById(UUID id) {
        return surveyRepository
                .findById(id)
                .map(this::fromSurvey)
                .orElseThrow(() -> new IllegalArgumentException(format("Survey %s not found!", id)));
        // () and -> is a lambda. Lambda is a temporary function without a name.
        // In our case we want just throw IllegalArgumentException if any problem exist
    }

    private SurveyAnswerResponse fromSurveyAnswers(SurveyAnswers surveyAnswers) {
        return new SurveyAnswerResponse(
                surveyAnswers.getSurvey().getId(),
                surveyAnswers.getAnswersJson());
    }

    private SurveyResponse fromSurvey(Survey survey) {
        return new SurveyResponse(survey.getId(), survey.getName(), survey.getSchemaJson());
    }

    public List<SurveyResponse> getAllSurvey() {
        return surveyRepository
                .findAll()
                .stream()
                .map(this::fromSurvey)
                .collect(Collectors.toList());
    }

    public SurveyResponse createSurvey(SurveyRequest request) {
        return fromSurvey(surveyRepository.save(toSurvey(request)));
    }

    public Survey toSurvey(SurveyRequest surveyRequest) {
        return Survey
                .builder()
                .name(surveyRequest.name())
                .schemaJson(surveyRequest.schemaJson())
                .build();
    }

    public List<SurveyAnswerResponse> getResponses(UUID surveyId) {
        return surveyAnswerRepository.findAllBySurveyId(surveyId).stream().map(this::fromSurveyAnswers)
                .collect(Collectors.toList());
    }

    public SurveyAnswerResponse submitSurveyRequest(UUID id, SurveySubmitRequest request) {
        return fromSurveyAnswers(surveyAnswerRepository.save(toSurveyAnswers(id, request)));
    }

    private SurveyAnswers toSurveyAnswers(UUID id, SurveySubmitRequest request) {
        return SurveyAnswers
                .builder()
                .survey(surveyRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(format("Survey %s not found!", id.toString()))))
                .answersJson(request.answersJson())
                .build();
    }
}
