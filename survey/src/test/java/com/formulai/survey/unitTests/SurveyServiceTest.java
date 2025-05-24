package com.formulai.survey.unitTests;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.request.SurveySubmitRequest;
import com.formulai.survey.dto.response.SurveyAnswerResponse;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.model.Survey;
import com.formulai.survey.model.SurveyAnswers;
import com.formulai.survey.model.Task;
import com.formulai.survey.repository.SurveyAnswerRepository;
import com.formulai.survey.repository.SurveyRepository;
import com.formulai.survey.service.SurveyService;

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

    private static final ObjectMapper objectMapper = new ObjectMapper();

    private UUID surveyId;
    private Survey survey;
    private SurveyAnswers surveyAnswers;
    private Task task;

    @BeforeEach
    void setUp() {
        JsonNode jsonSchema = objectMapper.createObjectNode().put("type", "object");

        surveyId = UUID.randomUUID();

        survey = Survey.builder()
                .id(surveyId)
                .name("Test Survey")
                .schemaJson(jsonSchema)
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
        Optional<SurveyResponse> response = surveyService.getSurveyById(surveyId);

        //then
        assertTrue(response.isPresent());

        SurveyResponse assertSurvey = response.get();
        assertEquals(surveyId, assertSurvey.id());
        assertEquals("Test Survey", assertSurvey.name());
        verify(surveyRepository).findById(surveyId);
    }

    @Test
    void getSurveyById_shouldReturnEmpty_whenSurveyDoesNotExist() {
        // given
        when(surveyRepository.findById(surveyId)).thenReturn(Optional.empty());

        // when
        Optional<SurveyResponse> result = surveyService.getSurveyById(surveyId);

        // then
        assertTrue(result.isEmpty());
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
    void createSurvey_shouldCreateAndReturnSurvey() throws Exception {
        // given
        JsonNode jsonSchema = objectMapper.createObjectNode().put("type", "object").put("questions", objectMapper.createArrayNode());
        SurveyRequest request = new SurveyRequest("New Survey", jsonSchema);
        JsonNode schemaJson = objectMapper.readTree("{\"questions\":[]}");
        Survey newSurvey = Survey.builder()
                .id(UUID.randomUUID())
                .name("New Survey")
                .schemaJson(schemaJson)
                .tasks(List.of())
                .build();

        when(surveyRepository.save(any(Survey.class))).thenReturn(newSurvey);

        // when
        SurveyResponse result = surveyService.createSurvey(request);

        // then
        assertNotNull(result);
        assertEquals("New Survey", result.name());
        assertEquals(schemaJson, result.schemaJson());
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
