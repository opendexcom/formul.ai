package com.formulai.survey.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Entity representing the answers submitted for a specific survey.
 * <p>
 * Each instance of this class corresponds to a set of answers provided by a respondent
 * for a particular survey. The answers are stored in JSON format.
 * </p>
 *
 * <p>
 * Fields:
 * <ul>
 *   <li><b>id</b>: Unique identifier for the survey answers entry.</li>
 *   <li><b>survey</b>: Reference to the associated {@link Survey} entity.</li>
 *   <li><b>answersJson</b>: JSON string containing the answers data.</li>
 * </ul>
 * </p>
 *
 * <p>
 * This entity is mapped to the <code>survey_answers</code> table in the database.
 * </p>
 */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity
@Table(name = "survey_answers")
public class SurveyAnswers {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    /**
     * Unique identifier for the survey answer.
     */
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "survey_id")
    /**
     * The {@code survey} field represents the {@link Survey} entity associated with the survey answers.
     * It holds a reference to the survey for which the answers are provided.
     */
    private Survey survey;

    /**
     * A JSON-formatted string representing the answers provided in the survey.
     * This field stores the serialized answers data for flexible and dynamic structure.
     */
    private String answersJson;
}
