package com.formulai.survey.integrationTests;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import com.formulai.survey.BaseIntegrationTest;
import com.formulai.survey.model.Survey;
import com.formulai.survey.repository.SurveyRepository;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
public class InitialSurveyTest extends BaseIntegrationTest {

    @Autowired
    private SurveyRepository surveyRepository;

    @Test
    void isInitialSurvey() {
        Survey survey = surveyRepository.findAll().getFirst();

        assertNotNull(survey.getId(),
                "Initial Survey ID should not be null");
        assertNotNull(survey.getName(),
                "Initial Survey name should not be null");
    }
}
