package com.formulai.survey.controllers;

import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.service.SurveyService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/surveys")
public class SurveyController {

    private final SurveyService surveyService;

    @GetMapping("/{id}")
    public ResponseEntity<SurveyResponse> getSurvey(@PathVariable String id){
        return ResponseEntity.ok(surveyService.getSurveyById(id));
    }
    @GetMapping
    public ResponseEntity<List<SurveyResponse>> getAllSurveys() {
        return ResponseEntity.ok(surveyService.getAllSurvey());
    }
    @PostMapping
    public ResponseEntity<String> createSurvey(@RequestBody @Valid SurveyRequest surveyRequest){
        return ResponseEntity.ok(surveyService.createSurvey(surveyRequest));
    }

    @GetMapping("/{id}/answers")
    public ResponseEntity<List<SurveyResponse>> getAllSurveyResponses(){
        return ResponseEntity.ok(surveyService.getResponses(id));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<String> submitSurvey(@PathVariable String id, @RequestBody @Valid SurveySubmitRequest surveySubmitRequest){

        return ResponseEntity.ok(surveyService.submitSurveyRequest(id, surveySubmitRequest));
    }
}

