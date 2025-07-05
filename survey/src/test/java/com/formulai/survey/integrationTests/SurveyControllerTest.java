package com.formulai.survey.integrationTests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.ActiveProfiles;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.formulai.survey.BaseIntegrationTest;
import com.formulai.survey.dto.request.SurveyRequest;
import com.formulai.survey.dto.response.SurveyAnswerResponse;
import com.formulai.survey.dto.response.SurveyResponse;
import com.formulai.survey.model.Survey;
import com.formulai.survey.repository.SurveyRepository;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SurveyControllerTest extends BaseIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SurveyRepository surveyRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void getSurvey_shouldReturnSurveyById() throws Exception {
        // given
        Survey firstSurvey = surveyRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No surveys found"));
        UUID surveyId = firstSurvey.getId();

        // when
        MvcResult result = mockMvc.perform(get("/v1/surveys/" + surveyId))
                .andExpect(status().isOk())
                .andReturn();

        // then
        SurveyResponse response = objectMapper.readValue(
                result.getResponse().getContentAsString(), SurveyResponse.class);

        assertNotNull(response);
        assertEquals(firstSurvey.getId(), response.id());
        assertEquals(firstSurvey.getName(), response.name());
    }

    @Test
    void updateSurvey_shouldUpdateSurveyAndReturnUpdatedResponse() throws Exception {
        // given
        Survey firstSurvey = surveyRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No surveys found"));
        UUID surveyId = firstSurvey.getId();

        // create updated request
        JsonNode updatedSchemaJson = objectMapper.createObjectNode()
                .put("type", "object")
                .put("properties", "{\"field\":\"newValue\"}");
        String updatedName = firstSurvey.getName() + " Updated";
        SurveyRequest updateRequest = new SurveyRequest(updatedName, updatedSchemaJson);
        String requestJson = objectMapper.writeValueAsString(updateRequest);

        // when
        MvcResult result = mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/v1/surveys/" + surveyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isOk())
                .andReturn();

        // then
        SurveyResponse response = objectMapper.readValue(
                result.getResponse().getContentAsString(), SurveyResponse.class);

        assertNotNull(response);
        assertEquals(surveyId, response.id());
        assertEquals(updatedName, response.name());
        assertEquals(updatedSchemaJson, response.schemaJson());
    }

    @Test
    void updateSurvey_shouldReturn400WithInvalidRequest() throws Exception {
        // given
        Survey firstSurvey = surveyRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No surveys found"));
        UUID surveyId = firstSurvey.getId();

        // invalid request: null name and null schemaJson
        SurveyRequest invalidRequest = new SurveyRequest(null, null);
        String requestJson = objectMapper.writeValueAsString(invalidRequest);

        // when & then
        mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/v1/surveys/" + surveyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateSurvey_shouldReturn400WithEmptyName() throws Exception {
        // given
        Survey firstSurvey = surveyRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No surveys found"));
        UUID surveyId = firstSurvey.getId();

        JsonNode schemaJson = objectMapper.createObjectNode()
                .put("type", "object")
                .put("properties", "{}");
        SurveyRequest invalidRequest = new SurveyRequest("", schemaJson);
        String requestJson = objectMapper.writeValueAsString(invalidRequest);

        // when & then
        mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/v1/surveys/" + surveyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateSurvey_shouldReturn400WithNullSchemaJson() throws Exception {
        // given
        Survey firstSurvey = surveyRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No surveys found"));
        UUID surveyId = firstSurvey.getId();

        SurveyRequest invalidRequest = new SurveyRequest("Survey Name", null);
        String requestJson = objectMapper.writeValueAsString(invalidRequest);

        // when & then
        mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/v1/surveys/" + surveyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateSurvey_shouldReturn400WithInvalidUUID() throws Exception {
        // given
        String invalidUUID = "not-a-uuid";
        SurveyRequest updateRequest = new SurveyRequest("Name", objectMapper.createObjectNode());
        String requestJson = objectMapper.writeValueAsString(updateRequest);

        // when & then
        mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/v1/surveys/" + invalidUUID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getAllSurveyResponses_shouldReturnAllResponsesForSurvey() throws Exception {
        // given
        Survey firstSurvey = surveyRepository.findByName("example")
                .orElseThrow(() -> new RuntimeException("No surveys found"));
        UUID surveyId = firstSurvey.getId();

        // when
        MvcResult result = mockMvc.perform(get("/v1/surveys/" + surveyId + "/answers"))
                .andExpect(status().isOk())
                .andReturn();

        // then
        List<SurveyAnswerResponse> responses = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, SurveyAnswerResponse.class));

        assertNotNull(responses);
        assertFalse(responses.isEmpty());
        assertEquals(surveyId, responses.getFirst().surveyId());
    }


    @Test
    void createSurvey_shouldReturn400WithInvalidRequest() throws Exception {
        // given
        SurveyRequest invalidRequest = new SurveyRequest(null, null);
        String requestJson = objectMapper.writeValueAsString(invalidRequest);

        // when and then
        mockMvc.perform(post("/v1/surveys")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createSurvey_shouldReturn400WithEmptyName() throws Exception {
        // given
        JsonNode schemaJson = objectMapper.createObjectNode()
                .put("type", "object")
                .put("properties", "{}");
        SurveyRequest invalidRequest = new SurveyRequest("", schemaJson);
        String requestJson = objectMapper.writeValueAsString(invalidRequest);

        // when and then
        mockMvc.perform(post("/v1/surveys")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createSurvey_shouldReturn400WithNullSchemaJson() throws Exception {
        // given
        SurveyRequest invalidRequest = new SurveyRequest("Survey Name", null);
        String requestJson = objectMapper.writeValueAsString(invalidRequest);

        // when & then
        mockMvc.perform(post("/v1/surveys")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getSurvey_shouldHandleInvalidUUID() throws Exception {
        // given
        String invalidUUID = "not-a-uuid";

        // when and then
        mockMvc.perform(get("/v1/surveys/" + invalidUUID))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitSurvey_shouldReturn400WithMissingBody() throws Exception {
        // given
        Survey firstSurvey = surveyRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No surveys found"));
        UUID surveyId = firstSurvey.getId();

        // when and then
        mockMvc.perform(post("/v1/surveys/" + surveyId + "/submit")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }



}
