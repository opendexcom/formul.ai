package com.formulai.survey.controllers;

import com.formulai.survey.dto.SurveyDTO;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/survey")
public class SurveyController {

    @PostMapping("")
    public Map<String, String> Submit(@RequestBody SurveyDTO surveyDTO) {
        Map<String, String> result = new HashMap<>();

        String successMessage = "Form submitted successfully";
        result.put("success", successMessage);
        result.put("formId", surveyDTO.getFormId());
        result.put("responses", surveyDTO.getResponses().toString());
        return result;
    }
}

