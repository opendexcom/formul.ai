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

    @GetMapping("/{id}")
    public ResponseEntity<SurveyResponse> getSurvey(@PathVariable UUID id) {
        return ResponseEntity.ok(surveyService.getSurveyById(id));
    }

    @GetMapping
    public ResponseEntity<List<SurveyResponse>> getAllSurveys() {
        return ResponseEntity.ok(surveyService.getAllSurvey());
    }

    @PostMapping
    public ResponseEntity<SurveyResponse> createSurvey(@RequestBody @Valid SurveyRequest surveyRequest) {
        return ResponseEntity.ok(surveyService.createSurvey(surveyRequest));
    }

    @GetMapping("/{id}/answers")
    public ResponseEntity<List<SurveyAnswerResponse>> getAllSurveyResponses(@PathVariable UUID id) {
        return ResponseEntity.ok(surveyService.getResponses(id));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<SurveyAnswerResponse> submitSurvey(@PathVariable UUID id,
            @RequestBody @Valid SurveySubmitRequest surveySubmitRequest) {

        return ResponseEntity.ok(surveyService.submitSurveyRequest(id, surveySubmitRequest));
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<String> closeSurvey(@PathVariable UUID id) {
        return ResponseEntity.ok(surveyService.closeSurvey(id));
    }
}
