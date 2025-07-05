package com.formulai.survey.service;

import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.model.Survey;
import com.formulai.survey.model.SurveyAnswers;
import com.formulai.survey.model.SurveyStatus;
import com.formulai.survey.config.ProcessingProperties;
import com.formulai.survey.repository.SurveyRepository;
import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.response.SurveyAnswerResponse;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.repository.SurveyAnswerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static java.lang.String.format;

@Slf4j
@RequiredArgsConstructor
@Service
public class SurveyService {

    private final SurveyRepository surveyRepository;
    private final SurveyAnswerRepository surveyAnswerRepository;
    private final ProcessingProperties processingProperties;

    private final RestTemplate restTemplate = new RestTemplate();


    @Tool(name = "Find_Survey", description = "Find survey metadata and questions by Form ID")
    @Transactional(readOnly = true)
    public Optional<SurveyResponse> getSurveyById(UUID id) {
        return surveyRepository
                .findById(id)
                .map(this::fromSurvey);
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

    public SurveyResponse updateSurvey(UUID id, SurveyRequest request) {
        var survey = surveyRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(format("Survey %s not found!", id)));

        if (request.name() != null && !request.name().isBlank()) {
            survey.setName(request.name());
        }

        if (request.schemaJson() != null) {
            try {
                survey.setSchemaJson(request.schemaJson());
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid JSON schema provided", e);
            }
        }

        return fromSurvey(surveyRepository.save(survey));
    }

    @Tool(name = "Find_All_Answers", description = "Find a complete list of Survey Answers by Form ID")
    public List<SurveyAnswerResponse> getResponses(UUID surveyId) {
        return surveyAnswerRepository.findAllBySurveyId(surveyId).stream().map(this::fromSurveyAnswers)
                .collect(Collectors.toList());
    }

    public SurveyAnswerResponse submitSurveyRequest(UUID id, SurveySubmitRequest request) {
        return fromSurveyAnswers(surveyAnswerRepository.save(toSurveyAnswers(id, request)));
    }

    public String closeSurvey(UUID id) {
        log.info("Starting survey analysis for survey ID: {}", id);
        
        // Then start the analysis process
        String endpoint = UriComponentsBuilder.fromUriString(processingProperties.getUrl())
                .pathSegment("surveys", id.toString(), "start")
                .toUriString();
        
        log.info("Calling processing service at: {}", endpoint);
        var responseEntity = restTemplate.postForEntity(endpoint, null, String.class);
        log.info("Processing service responded with status: {}", responseEntity.getStatusCode());
        
        return responseEntity.getBody();
    }

    private SurveyAnswerResponse fromSurveyAnswers(SurveyAnswers surveyAnswers) {
        return new SurveyAnswerResponse(
                surveyAnswers.getSurvey().getId(),
                surveyAnswers.getAnswersJson());
    }

    private SurveyResponse fromSurvey(Survey survey) {
        
        return new SurveyResponse(
                survey.getId(),
                survey.getName(),
                survey.getSchemaJson(),
                survey.getStatus());
            
    }

    private Survey toSurvey(SurveyRequest surveyRequest) {
        return Survey
                .builder()
                .name(surveyRequest.name())
                .schemaJson(surveyRequest.schemaJson())
                .build();
    }

    private SurveyAnswers toSurveyAnswers(UUID id, SurveySubmitRequest request) {
        return SurveyAnswers
                .builder()
                .survey(surveyRepository.findById(id)
                        .orElseThrow(() -> new IllegalArgumentException(format("Survey %s not found!", id))))
                .answersJson(request.answersJson())
                .build();
    }

    @Transactional
    public void updateSurveyStatus(UUID surveyId, SurveyStatus status) {
        Survey survey = surveyRepository.findById(surveyId)
            .orElseThrow(() -> new IllegalArgumentException("Survey not found: " + surveyId));
        survey.setStatus(status);
        surveyRepository.save(survey);
    }
}
