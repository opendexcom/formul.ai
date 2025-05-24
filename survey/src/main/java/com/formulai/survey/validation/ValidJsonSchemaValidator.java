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
    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final JsonSchemaFactory jsonSchemaFactory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V7);

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isEmpty()) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate("JSON schema cannot be null or empty.")
                   .addConstraintViolation();
            return false;
        }
        try {
            JsonNode schemaNode = objectMapper.readTree(value);
            jsonSchemaFactory.getSchema(schemaNode);
            return true;
        } catch (Exception e) {
            logger.warn("Invalid JSON schema: {}", e.getMessage());
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate("Invalid JSON schema: " + e.getMessage())
                   .addConstraintViolation();
            return false;
        }
    }
}