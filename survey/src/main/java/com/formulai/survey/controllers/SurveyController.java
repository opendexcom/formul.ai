package com.formulai.survey.controllers;

import com.formulai.survey.dto.SurveyDTO;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/survey")
public class SurveyController {

    @PostMapping("/{id}/submit")
    public Map<String, String> Submit(@PathVariable UUID id, @RequestBody SurveyDTO surveyDTO) {
        Map<String, String> result = new HashMap<>();

        var responses = surveyDTO.getResponses();
        if(responses == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "responses is null");
        }

        if(responses.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "responses is empty");
        }

        String successMessage = "Form submitted successfully";
        result.put("success", successMessage);
        result.put("formId", id.toString());
        result.put("responses", responses.toString());

        return result;
    }
}

