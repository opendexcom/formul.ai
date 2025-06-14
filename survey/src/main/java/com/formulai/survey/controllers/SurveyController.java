package com.formulai.survey.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.dto.response.SurveyAnswerResponse;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.service.SurveyService;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

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
     *         survey, or NotFound with ProblemDetails for non-existent survey
     */
    @GetMapping("/{id}")
    @ApiResponses(value = {
            @ApiResponse(
                responseCode = "200",
                content = @Content(mediaType = "application/json",
                schema = @Schema(implementation = SurveyResponse.class))),
            @ApiResponse(
                responseCode = "404",
                content = @Content(mediaType = "application/problem+json",
                schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<SurveyResponse> getSurvey(@PathVariable UUID id) {
        return surveyService.getSurveyById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.of(ProblemDetail.forStatusAndDetail(
                        HttpStatus.NOT_FOUND, String.format("Survey with id '%s' does not exist", id))).build());
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
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "201",
            content = @Content(mediaType = "application/json",
            schema = @Schema(implementation = SurveyResponse.class))),
        @ApiResponse(
            responseCode = "400",
            content = @Content(mediaType = "application/problem+json",
            schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<SurveyResponse> createSurvey(@RequestBody @Valid SurveyRequest surveyRequest) {
        try {
            SurveyResponse response = surveyService.createSurvey(surveyRequest);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage(), ex);
        }
    }


    /**
     * Handles HTTP PUT requests to update an existing survey.
     *
     * @param id            the UUID of the survey to update
     * @param surveyRequest the request body containing updated survey details,
     *                      validated for correctness
     * @return a ResponseEntity containing the updated SurveyResponse
     */
    @PutMapping("/{id}")
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            content = @Content(mediaType = "application/json",
            schema = @Schema(implementation = SurveyResponse.class))),
        @ApiResponse(
            responseCode = "400",
            content = @Content(mediaType = "application/problem+json",
            schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<SurveyResponse> updateSurvey(@PathVariable UUID id,
            @RequestBody @Valid SurveyRequest surveyRequest) {
        try {
            SurveyResponse response = surveyService.updateSurvey(id, surveyRequest);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage(), ex);
        }
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
