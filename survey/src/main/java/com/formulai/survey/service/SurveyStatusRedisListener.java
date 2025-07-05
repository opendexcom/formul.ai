package com.formulai.survey.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.formulai.survey.model.SurveyStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Profile("!test")
public class SurveyStatusRedisListener implements MessageListener {

    private final SurveyService surveyService;
    private final ObjectMapper objectMapper;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String msg = new String(message.getBody());
            Map<String, String> data = objectMapper.readValue(msg, Map.class);
            UUID surveyId = UUID.fromString(data.get("surveyId"));
            SurveyStatus status = SurveyStatus.valueOf(data.get("status"));
            log.info("Received Redis status update: {} -> {}", surveyId, status);
            surveyService.updateSurveyStatus(surveyId, status);
        } catch (Exception e) {
            log.error("Failed to process Redis survey status update", e);
        }
    }
}