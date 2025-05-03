package com.formulai.survey.integrationTests;

import com.formulai.survey.model.Survey;
import com.formulai.survey.repository.SurveyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
public class InitialSurveyTest {

    @Autowired
    private SurveyRepository surveyRepository;

    @Test
    void isInitialSurvey() {
        Survey survey = surveyRepository.findByName("Initial Survey").orElse(null);

        assertNotNull(survey,
                "Initial Survey should not be null");
        assertNotNull(survey.getId(),
                "Initial Survey ID should not be null");
        assertNotNull(survey.getName(),
                "Initial Survey name should not be null");
    }
}
