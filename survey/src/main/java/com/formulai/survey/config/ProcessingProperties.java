package com.formulai.survey.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Data;

/**
 * Configuration properties for external service URLs.
 */
@Data
@Component
@ConfigurationProperties(prefix = "processing")
public class ProcessingProperties {
    
    /**
     * Base URL for the processing service.
     * Default: http://processing:8000
     */
    private String url = "http://processing:8000";
}
