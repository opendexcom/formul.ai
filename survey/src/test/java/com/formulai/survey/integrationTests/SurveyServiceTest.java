package com.formulai.survey.integrationTests;

import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.dto.response.SurveyAnswerResponse;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.model.Survey;
import com.formulai.survey.repository.SurveyRepository;
import com.formulai.survey.service.SurveyService;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class SurveyServiceTest {
    @Autowired
    private SurveyService surveyService;

    @Autowired
    private SurveyRepository surveyRepository;

    @Test
    void testSurveyServiceById() {
        // given
        Survey firstSurvey = surveyRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No surveys found"));

        // when
        SurveyResponse result = surveyService.getSurveyById(firstSurvey.getId());

        // then
        assertNotNull(result);
        assertEquals(firstSurvey.getId(), result.id());
        assertEquals(firstSurvey.getName(), result.name());
        assertEquals(firstSurvey.getSchemaJson(), result.schemaJson());
    }

    @Test
    void testSurveyServiceByName() {
        // given
        List<Survey> surveys = surveyRepository.findAll();

        // when
        List<SurveyResponse> result = surveyService.getAllSurvey();

        // then
        assertNotNull(result);
        assertEquals(surveys.size(), result.size());
    }

    @Test
    void testGetResponsesForSurvey() {
        // given
        Survey firstSurvey = surveyRepository.findByName("example")
                .orElseThrow(() -> new RuntimeException("No surveys found"));

        // when
        List<SurveyAnswerResponse> result = surveyService.getResponses(firstSurvey.getId());

        // then
        assertNotNull(result);
        assertEquals(firstSurvey.getId(), result.getFirst().surveyId());
        assertFalse(result.isEmpty());
    }

    @Test
    void testGetSurveyByIdWithNonExistentId() {
        // given
        UUID nonExistentId = UUID.randomUUID();

        // when and then
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> surveyService.getSurveyById(nonExistentId)
        );

        assertTrue(exception.getMessage().contains("not found"));
    }

    @Test
    void testSubmitSurveyRequestWithNonExistentSurveyId() {
        // given
        UUID nonExistentId = UUID.randomUUID();
        SurveySubmitRequest request = new SurveySubmitRequest("{\"answers\": []}");

        // when and then
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> surveyService.submitSurveyRequest(nonExistentId, request)
        );

        assertTrue(exception.getMessage().contains("not found"));
    }

    @Test
    void testGetResponsesForNonExistentSurvey() {
        // given
        UUID nonExistentId = UUID.randomUUID();

        // when and then
        assertTrue(surveyService.getResponses(nonExistentId).isEmpty());
    }

    @Test
    void testCreateSurveyWithInvalidSchema() {
        // given
        SurveyRequest invalidRequest = new SurveyRequest("Test Survey", "invalid json {");

        // when and then
        Exception exception = assertThrows(
                Exception.class,
                () -> surveyService.createSurvey(invalidRequest)
        );
        assertNotNull(exception);
    }

    @Test
    void testCloseSurveyWithExternalServiceUnavailable() {
        // given
        UUID existingId = surveyService.getAllSurvey().getFirst().id();

        // when and then
        assertThrows(
                RestClientException.class,
                () -> surveyService.closeSurvey(existingId)
        );
    }

}
