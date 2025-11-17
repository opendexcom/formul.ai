package com.formulai.survey.controllers;

import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.dto.response.SurveyAnswerResponse;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.service.SurveyService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import java.util.List;
import java.util.UUID;

@RequiredArgsConstructor
@RestController
@RequestMapping("/v1/surveys")
public class SurveyController {

    private final SurveyService surveyService;

    /**
     * Retrieves a survey by its unique identifier.
     *
     * @param id the UUID of the survey to retrieve
     * @return a ResponseEntity containing the SurveyResponse for the specified
     *         survey
     */
    @GetMapping("/{id}")
    public ResponseEntity<SurveyResponse> getSurvey(@PathVariable UUID id) {
        return ResponseEntity.ok(surveyService.getSurveyById(id));
    }

    /**
     * Handles HTTP GET requests to retrieve all surveys.
     *
     * @return a {@link ResponseEntity} containing a list of {@link SurveyResponse}
     *         objects representing all surveys
     */
    @GetMapping
    public ResponseEntity<List<SurveyResponse>> getAllSurveys() {
        return ResponseEntity.ok(surveyService.getAllSurvey());
    }

    /**
     * Handles HTTP POST requests to create a new survey.
     *
     * @param surveyRequest the request body containing survey details, validated
     *                      for correctness
     * @return a ResponseEntity containing the created SurveyResponse
     */
    @PostMapping
    public ResponseEntity<SurveyResponse> createSurvey(@RequestBody @Valid SurveyRequest surveyRequest) {
        return ResponseEntity.ok(surveyService.createSurvey(surveyRequest));
    }

    /**
     * Retrieves all responses for a specific survey.
     *
     * @param id the UUID of the survey for which to fetch responses
     * @return a ResponseEntity containing a list of SurveyAnswerResponse objects
     *         representing the survey responses
     */
    @GetMapping("/{id}/answers")
    public ResponseEntity<List<SurveyAnswerResponse>> getAllSurveyResponses(@PathVariable UUID id) {
        return ResponseEntity.ok(surveyService.getResponses(id));
    }

    /**
     * Handles the submission of survey answers for a specific survey.
     *
     * @param id                  the unique identifier of the survey to submit
     *                            answers for
     * @param surveySubmitRequest the request body containing the user's survey
     *                            answers, validated for correctness
     * @return a {@link ResponseEntity} containing the {@link SurveyAnswerResponse}
     *         with the results of the submission
     */
    @PostMapping("/{id}/submit")
    public ResponseEntity<SurveyAnswerResponse> submitSurvey(@PathVariable UUID id,
            @RequestBody @Valid SurveySubmitRequest surveySubmitRequest) {

        return ResponseEntity.ok(surveyService.submitSurveyRequest(id, surveySubmitRequest));
    }

    /**
     * Closes the survey with the specified ID.
     *
     * @param id the UUID of the survey to be closed
     * @return a ResponseEntity containing a confirmation message upon successful
     *         closure of the survey
     */
    @PostMapping("/{id}/close")
    public ResponseEntity<String> closeSurvey(@PathVariable final UUID id) {
        return ResponseEntity.ok(surveyService.closeSurvey(id));
    }
}
