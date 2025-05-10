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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.logging.Logger;
import java.util.stream.Collectors;

import static java.lang.String.format;

@Slf4j
@RequiredArgsConstructor
@Service
public class SurveyService {

    private final SurveyRepository surveyRepository;
    private final SurveyAnswerRepository surveyAnswerRepository;

    @Value("${processing.url}")
    private String processingBaseUrl;

    private RestTemplate restTemplate = new RestTemplate();

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
        var tasks = survey.getTasks();
        var lastCreatedTask = tasks
                .stream()
                .max(Comparator.comparing(task -> task.getCreatedAt()));
        
        
        return new SurveyResponse(
                survey.getId(),
                survey.getName(),
                survey.getSchemaJson(),
                lastCreatedTask.map(task -> task.getStatus()).orElse(null),
                lastCreatedTask.map(task -> task.getId()).orElse(null)
                );                
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

    public String closeSurvey(UUID id) {
        String endpoint = processingBaseUrl + "/" + id + "/start";
        var responseEntity = restTemplate.postForEntity(endpoint, null, String.class);
        return responseEntity.getBody();
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
