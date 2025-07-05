package com.formulai.survey.unitTests;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.formulai.survey.model.SurveyStatus;
import com.formulai.survey.service.SurveyService;
import com.formulai.survey.service.SurveyStatusRedisListener;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.connection.Message;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SurveyStatusRedisListenerTest {
    private SurveyService surveyService;
    private ObjectMapper objectMapper;
    private SurveyStatusRedisListener listener;

    @BeforeEach
    void setUp() {
        surveyService = mock(SurveyService.class);
        objectMapper = mock(ObjectMapper.class);
        listener = new SurveyStatusRedisListener(surveyService, objectMapper);
    }

    @Test
    void testOnMessage_validMessage_callsUpdateSurveyStatus() throws Exception {
        UUID surveyId = UUID.randomUUID();
        SurveyStatus status = SurveyStatus.ANALYSIS_DONE;
        Map<String, String> data = new HashMap<>();
        data.put("surveyId", surveyId.toString());
        data.put("status", status.name());
        String json = "{\"surveyId\":\"" + surveyId + "\",\"status\":\"" + status.name() + "\"}";
        Message message = mock(Message.class);
        when(message.getBody()).thenReturn(json.getBytes(StandardCharsets.UTF_8));

        when(objectMapper.readValue(json, Map.class)).thenReturn(data);

        listener.onMessage(message, null);

        ArgumentCaptor<UUID> idCaptor = ArgumentCaptor.forClass(UUID.class);
        ArgumentCaptor<SurveyStatus> statusCaptor = ArgumentCaptor.forClass(SurveyStatus.class);
        verify(surveyService, times(1)).updateSurveyStatus(idCaptor.capture(), statusCaptor.capture());
        assertEquals(surveyId, idCaptor.getValue());
        assertEquals(status, statusCaptor.getValue());
    }

    @Test
    void testOnMessage_invalidMessage_logsError() throws Exception {
        String invalidJson = "not a json";
        Message message = mock(Message.class);
        when(message.getBody()).thenReturn(invalidJson.getBytes(StandardCharsets.UTF_8));
        when(objectMapper.readValue(invalidJson, Map.class)).thenThrow(new RuntimeException("Invalid JSON"));

        // Should not throw, just log error
        assertDoesNotThrow(() -> listener.onMessage(message, null));
        verify(surveyService, never()).updateSurveyStatus(any(), any());
    }
} 