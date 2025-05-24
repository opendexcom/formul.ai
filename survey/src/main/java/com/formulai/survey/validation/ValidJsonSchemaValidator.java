package com.formulai.survey.validation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ValidJsonSchemaValidator implements ConstraintValidator<ValidJsonSchema, String> {
    private static final Logger logger = LoggerFactory.getLogger(ValidJsonSchemaValidator.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final JsonSchemaFactory jsonSchemaFactory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V7);

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isEmpty()) return false;
        try {
            JsonNode schemaNode = objectMapper.readTree(value);
            jsonSchemaFactory.getSchema(schemaNode);
            return true;
        } catch (Exception e) {
            logger.warn("Invalid JSON schema: {}", e.getMessage());
            return false;
        }
    }
}