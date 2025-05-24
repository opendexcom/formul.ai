package com.formulai.survey.validation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ValidJsonSchemaValidator implements ConstraintValidator<ValidJsonSchema, String> {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final JsonSchemaFactory jsonSchemaFactory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V7);

    /**
     * Validates whether the provided string is a valid JSON schema.
     *
     * @param value   the JSON schema as a string to validate
     * @param context the context in which the constraint is evaluated
     * @return {@code true} if the input string is a valid JSON schema, {@code false} otherwise
     */
    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isEmpty()) return false;
        try {
            JsonNode schemaNode = objectMapper.readTree(value);
            jsonSchemaFactory .getSchema(schemaNode);
            return true;
        } catch (Exception e) {
            System.err.println("Invalid JSON schema: " + e.getMessage());
            return false;
        }
    }
}