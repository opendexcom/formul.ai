package com.formulai.survey.model;

/**
 * Enumeration representing the possible statuses of a survey.
 * <p>
 * The statuses represent the lifecycle of a survey from creation to completion:
 * <ul>
 *   <li><b>NEW</b>: Survey has been created but not yet started</li>
 *   <li><b>ONGOING</b>: Survey is currently active and accepting responses</li>
 *   <li><b>UNDER_ANALYSIS</b>: Survey responses are being processed by AI</li>
 *   <li><b>ANALYSIS_DONE</b>: AI analysis has completed successfully</li>
 *   <li><b>ANALYSIS_ERROR</b>: An error occurred during AI analysis</li>
 * </ul>
 */
public enum SurveyStatus {
    NEW,
    ONGOING,
    UNDER_ANALYSIS,
    ANALYSIS_DONE,
    ANALYSIS_ERROR
}
