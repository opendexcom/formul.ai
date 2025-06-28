package com.formulai.survey.config;

import java.util.List;

import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.formulai.survey.service.SurveyService;

/**
 * Configuration for Model Context Protocol (MCP) tools.
 * This registers the survey service tools with the AI system.
 * 
 * Note: The @Tool annotations in SurveyService are automatically picked up
 * by Spring AI when the spring-ai-mcp dependency is present.
 */
@Configuration
public class McpConfiguration {
    @Bean
    public List<ToolCallback> findTools(SurveyService surveyService) {
        return List.of(ToolCallbacks.from(surveyService));
    }
}
