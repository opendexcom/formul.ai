package com.formulai.survey.integrationTests;

import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.dto.response.SurveyAnswerResponse;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.model.Survey;
import com.formulai.survey.model.SurveyAnswers;
import com.formulai.survey.model.Task;
import com.formulai.survey.repository.SurveyRepository;
import com.formulai.survey.repository.SurveyAnswerRepository;

import com.formulai.survey.service.SurveyService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SurveyServiceTest {
    @Mock
    private SurveyRepository surveyRepository;
    @Mock
    private SurveyAnswerRepository surveyAnswerRepository;
    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private SurveyService surveyService;

    private UUID surveyId;
    private Survey survey;
    private SurveyAnswers surveyAnswers;
    private Task task;

    @BeforeEach
    void setUp() {
        surveyId = UUID.randomUUID();

        survey = Survey.builder()
                .id(surveyId)
                .name("Test Survey")
                .schemaJson("{\"questions\": []}")
                .answers(new ArrayList<>())
                .tasks(new ArrayList<>())
                .build();

        task = Task.builder()
                .id(UUID.randomUUID())
                .survey(survey)
                .createdAt(new Date())
                .status("IN_PROGRESS")
                .build();

        List<Task> tasks = new ArrayList<>();
        tasks.add(task);
        survey.setTasks(tasks);

        surveyAnswers = SurveyAnswers.builder()
                .id(UUID.randomUUID())
                .survey(survey)
                .answersJson("{\"answers\": []}")
                .build();

        ReflectionTestUtils.setField(surveyService, "processingBaseUrl", "http://processing-service");
        ReflectionTestUtils.setField(surveyService, "restTemplate", restTemplate);
    }

    @Test
    void getSurveyById_shouldReturnSurveyResponse_whenSurveyExists() {
        // given
        when(surveyRepository.findById(surveyId)).thenReturn(Optional.of(survey));

        // when
        SurveyResponse response = surveyService.getSurveyById(surveyId);

        //then
        assertNotNull(response);
        assertEquals(surveyId, response.id());
        assertEquals("Test Survey", response.name());
        verify(surveyRepository).findById(surveyId);
    }

    @Test
    void getSurveyById_shouldThrowException_whenSurveyDoesNotExist() {
        // given
        when(surveyRepository.findById(surveyId)).thenReturn(Optional.empty());

        // when
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> surveyService.getSurveyById(surveyId)
        );

        // then
        assertTrue(exception.getMessage().contains("not found"));
        verify(surveyRepository).findById(surveyId);
    }

    @Test
    void getAllSurvey_shouldReturnAllSurveys() {
        // given
        when(surveyRepository.findAll()).thenReturn(List.of(survey));

        // when
        List<SurveyResponse> result = surveyService.getAllSurvey();

        //then
        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals(surveyId, result.getFirst().id());
        verify(surveyRepository).findAll();
    }

    @Test
    void createSurvey_shouldCreateAndReturnSurvey() {
        // given
        SurveyRequest request = new SurveyRequest("New Survey", "{\"questions\": []}");
        Survey newSurvey = Survey.builder()
                .id(UUID.randomUUID())
                .name("New Survey")
                .schemaJson("{\"questions\":[]}")
                .tasks(List.of())
                .build();

        when(surveyRepository.save(any(Survey.class))).thenReturn(newSurvey);

        // when
        SurveyResponse result = surveyService.createSurvey(request);

        // then
        assertNotNull(result);
        assertEquals("New Survey", result.name());
        assertEquals("{\"questions\":[]}", result.schemaJson());
        verify(surveyRepository).save(any(Survey.class));
    }

    @Test
    void getResponses_shouldReturnAllResponsesForSurvey() {
        // given
        when(surveyAnswerRepository.findAllBySurveyId(surveyId)).thenReturn(List.of(surveyAnswers));

        //when
        List<SurveyAnswerResponse> result = surveyService.getResponses(surveyId);

        // then
        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals(surveyId, result.getFirst().surveyId());
        assertEquals("{\"answers\": []}", result.getFirst().answersJson());
        verify(surveyAnswerRepository).findAllBySurveyId(surveyId);
    }

    @Test
    void submitSurveyRequest_shouldSaveAndReturnSurveyAnswer() {
        // given
        SurveySubmitRequest request = new SurveySubmitRequest("{\"answers\":[{\"questionId\":1,\"answer\":\"New Answer\"}]}");

        when(surveyRepository.findById(surveyId)).thenReturn(Optional.of(survey));
        when(surveyAnswerRepository.save(any(SurveyAnswers.class))).thenReturn(surveyAnswers);

        // when
        SurveyAnswerResponse result = surveyService.submitSurveyRequest(surveyId, request);

        // then
        assertNotNull(result);
        assertEquals(surveyId, result.surveyId());
        verify(surveyRepository).findById(surveyId);
        verify(surveyAnswerRepository).save(any(SurveyAnswers.class));
    }

    @Test
    void closeSurvey_shouldCallProcessingServiceAndReturnResult() {
        // given
        ResponseEntity<String> responseEntity = ResponseEntity.ok("Processing started");

        when(restTemplate.postForEntity(contains("/surveys/" + surveyId + "/start"),
                                        isNull(),
                                        eq(String.class))
                ).thenReturn(responseEntity);

        // when
        String result = surveyService.closeSurvey(surveyId);

        // then
        assertEquals("Processing started", result);
        verify(restTemplate).postForEntity(contains("/surveys/" + surveyId + "/start"),
                                           isNull(),
                                           eq(String.class));
    }


}
