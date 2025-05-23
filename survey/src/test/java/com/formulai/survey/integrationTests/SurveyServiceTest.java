package com.formulai.survey.integrationTests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.client.RestClientException;

import com.formulai.survey.BaseIntegrationTest;
import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.dto.response.SurveyAnswerResponse;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.model.Survey;
import com.formulai.survey.repository.SurveyRepository;
import com.formulai.survey.service.SurveyService;

import jakarta.transaction.Transactional;

@SpringBootTest
@Transactional
class SurveyServiceTest extends BaseIntegrationTest {
    @Autowired
    private SurveyService surveyService;

    @Autowired
    private SurveyRepository surveyRepository;

    @Test
    void testNonExistingSurvey() {
        // given
        var nonExistingSurveyId = UUID.randomUUID();

        // when
        Optional<SurveyResponse> result = surveyService.getSurveyById(nonExistingSurveyId);

        // then
        assertTrue(result.isEmpty());
    }

    @Test
    void testSurveyServiceById() {
        // given
        Survey firstSurvey = surveyRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No surveys found"));

        // when
        Optional<SurveyResponse> result = surveyService.getSurveyById(firstSurvey.getId());

        // then
        assertTrue(result.isPresent());

        SurveyResponse assertSurvey = result.get();
        assertEquals(firstSurvey.getId(), assertSurvey.id());
        assertEquals(firstSurvey.getName(), assertSurvey.name());
        assertEquals(firstSurvey.getSchemaJson(), assertSurvey.schemaJson());
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
    @Disabled
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
    @Disabled("For now schemaJson is not validated against JSON format")
    void testCreateSurveyWithInvalidSchema() {
        // given
        SurveyRequest invalidRequest = new SurveyRequest("Test Survey", null);

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
