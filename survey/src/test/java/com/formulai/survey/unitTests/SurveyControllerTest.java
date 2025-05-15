package com.formulai.survey.unitTests;

import com.formulai.survey.controllers.SurveyController;
import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.dto.response.SurveyAnswerResponse;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.service.SurveyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
        expectedSurvey = surveys.getFirst();

        answers = List.of(
                new SurveyAnswerResponse(surveyId, "{}"),
                new SurveyAnswerResponse(surveyId, "{}")
        );
        expectedAnswer = answers.getFirst();
    }


    @Test
    void getSurvey_shouldReturnSurveyResponse() {
        // given
        when(surveyService.getSurveyById(surveyId)).thenReturn(expectedSurvey);

        // when
        ResponseEntity<SurveyResponse> result = surveyController.getSurvey(surveyId);

        // then
        assertNotNull(result);
        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(expectedSurvey, result.getBody());
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
        SurveyRequest request = new SurveyRequest("New Survey", "{/}");
        SurveyResponse response = new SurveyResponse(
                UUID.randomUUID(), "New Survey", "{}", null, null);

        when(surveyService.createSurvey(request)).thenReturn(response);

        // when
        ResponseEntity<SurveyResponse> result = surveyController.createSurvey(request);

        // then
        assertNotNull(result);
        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(response, result.getBody());
        verify(surveyService).createSurvey(request);
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
