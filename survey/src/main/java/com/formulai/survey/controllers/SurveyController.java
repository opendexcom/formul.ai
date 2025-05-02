package com.formulai.survey.controllers;

import com.formulai.survey.dto.request.SurveyRequestDTO;
import com.formulai.survey.dto.request.SurveySubmitRequestDTO;
import com.formulai.survey.dto.response.SurveyResponseDTO;
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
    public ResponseEntity<SurveyResponseDTO> getSurvey(@PathVariable String id){
        return ResponseEntity.ok(surveyService.getSurveyById(id));
    }
    @GetMapping
    public ResponseEntity<List<SurveyResponseDTO>> getAllSurveys() {
        return ResponseEntity.ok(surveyService.getAllSurvey());
    }
    @PostMapping
    public ResponseEntity<String> createSurvey(@RequestBody @Valid SurveyRequestDTO surveyRequest){
        return ResponseEntity.ok(surveyService.createSurvey(surveyRequest));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<String> submitSurvey(@PathVariable String id, @RequestBody @Valid SurveySubmitRequestDTO surveySubmitRequest){

        return ResponseEntity.ok(surveyService.submitSurveyRequest(id, surveySubmitRequest));
    }
}

