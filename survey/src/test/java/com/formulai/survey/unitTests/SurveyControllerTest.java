package com.formulai.survey.unitTests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import com.formulai.survey.controllers.SurveyController;
import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.dto.response.SurveyAnswerResponse;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.service.SurveyService;

@ExtendWith(MockitoExtension.class)
public class SurveyControllerTest {
    @Mock
    private SurveyService surveyService;

    @InjectMocks
    private SurveyController surveyController;

    private UUID surveyId;
    private List<SurveyResponse> surveys;
    private SurveyResponse expectedSurvey;
    private List<SurveyAnswerResponse> answers;
    private SurveyAnswerResponse expectedAnswer;

    @BeforeEach
    void setUp() {
        surveyId = UUID.randomUUID();
        surveys = List.of(
                new SurveyResponse(surveyId, "Survey 1", "{}", "COMPLETED", null),
                new SurveyResponse(UUID.randomUUID(), "Survey 2", "{}", "IN_PROGRESS", null)
        );
        expectedSurvey = surveys.get(0);

        answers = List.of(
                new SurveyAnswerResponse(surveyId, "{}"),
                new SurveyAnswerResponse(surveyId, "{}")
        );
        expectedAnswer = answers.get(0);
    }


    @Test
    void getSurvey_shouldReturnOKWhenSurveyResponseExists() {
        // given
        when(surveyService.getSurveyById(surveyId)).thenReturn(Optional.of(expectedSurvey));

        // when
        ResponseEntity<?> result = surveyController.getSurvey(surveyId);

        // then
        assertNotNull(result);
        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(expectedSurvey, result.getBody());
        verify(surveyService).getSurveyById(surveyId);
    }

    @Test
    void getSurvey_shouldReturnNotFoundWithProblemDetailsWhenSurveyResponseDoesNotExist() {
        // given
        when(surveyService.getSurveyById(surveyId)).thenReturn(Optional.empty());

        // when
        ResponseEntity<?> result = surveyController.getSurvey(surveyId);

        // then
        assertNotNull(result);
        assertEquals(HttpStatus.NOT_FOUND, result.getStatusCode());
        assertEquals(ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND,
                String.format("Survey with id '%s' does not exist", surveyId)), result.getBody());
        verify(surveyService).getSurveyById(surveyId);
    }

    @Test
    void getAllSurveys_shouldReturnAllSurveys() {
        // given
        when(surveyService.getAllSurvey()).thenReturn(surveys);

        // when
        ResponseEntity<List<SurveyResponse>> result = surveyController.getAllSurveys();

        // then
        assertNotNull(result);
        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(surveys, result.getBody());
        assertNotNull(result.getBody());
        assertEquals(2, result.getBody() != null ? result.getBody().size() : 0);
        verify(surveyService).getAllSurvey();
    }

    @Test
    void createSurvey_shouldCreateAndReturnSurvey() {
        // given
        SurveyRequest request = new SurveyRequest("New Survey", "{}");
        SurveyResponse response = new SurveyResponse(
                UUID.randomUUID(), "New Survey", "{}", null, null);

        when(surveyService.createSurvey(request)).thenReturn(response);

        // when
        ResponseEntity<SurveyResponse> result = surveyController.createSurvey(request);

        // then
        assertNotNull(result);
        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals(response, result.getBody());
        verify(surveyService).createSurvey(request);
    }

    @Test
    void createSurvey_shouldReturnBadRequestForNotProperSchema() {
        // given
        SurveyRequest notProperSchemaRequest = new SurveyRequest("Not Proper Schema", "{\"unexpected_field\":123}");
        when(surveyService.createSurvey(notProperSchemaRequest)).thenThrow(new IllegalArgumentException("Schema is not proper"));

        // then
        ResponseStatusException exception = org.junit.jupiter.api.Assertions.assertThrows(
            ResponseStatusException.class,
            () -> surveyController.createSurvey(notProperSchemaRequest)
        );
        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        // Optionally, check error message if needed
    }

    @Test
    void getAllSurveyResponses_shouldReturnAllResponsesForSurvey() {
        // given
        when(surveyService.getResponses(surveyId)).thenReturn(answers);

        // when
        ResponseEntity<List<SurveyAnswerResponse>> result = surveyController.getAllSurveyResponses(surveyId);

        // then
        assertNotNull(result);
        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(answers, result.getBody());
        assertNotNull(result.getBody());
        assertEquals(2, result.getBody() != null ? result.getBody().size() : 0);
        verify(surveyService).getResponses(surveyId);
    }

    @Test
    void submitSurvey_shouldSubmitAndReturnResponse() {
        //given
        SurveySubmitRequest request = new SurveySubmitRequest("{}");

        when(surveyService.submitSurveyRequest(surveyId, request)).thenReturn(expectedAnswer);

        //when
        ResponseEntity<SurveyAnswerResponse> response = surveyController.submitSurvey(surveyId, request);

        //then
        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(expectedAnswer, response.getBody());
        verify(surveyService).submitSurveyRequest(surveyId, request);
    }

    @Test
    void closeSurvey_shouldCloseAndReturnResult() {
        // given
        String expectedResult = "Processing started";

        when(surveyService.closeSurvey(surveyId)).thenReturn(expectedResult);

        // when
        ResponseEntity<String> result = surveyController.closeSurvey(surveyId);

        // then
        assertNotNull(result);
        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(expectedResult, result.getBody());
        verify(surveyService).closeSurvey(surveyId);
    }


}
