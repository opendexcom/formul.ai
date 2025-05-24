package com.formulai.survey.model;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Represents a survey entity containing metadata and related data such as answers and tasks.
 * <p>
 * Fields:
 * <ul>
 *   <li><b>id</b>: Unique identifier for the survey (UUID).</li>
 *   <li><b>name</b>: Name of the survey.</li>
 *   <li><b>schemaJson</b>: JSON schema describing the survey structure, stored as a large text column.</li>
 *   <li><b>answers</b>: List of answers associated with this survey. Cascade operations are applied.</li>
 *   <li><b>tasks</b>: List of tasks related to this survey.</li>
 * </ul>
 * <p>
 * Uses Lombok annotations for boilerplate code generation and JPA annotations for ORM mapping.
 */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity
@Table(name = "survey")
public class Survey{
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    /**
     * Unique identifier for the survey.
     */
    private UUID id;

    /**
     * The name of the survey.
     */
    private String name;

    @Column(columnDefinition = "jsonb") // To store large JSON data
    /**
     * A JSON string representing the schema definition for the survey.
     * This field stores the structure and validation rules for survey data,
     * typically used for dynamic form generation and validation.
     */
    private String schemaJson;

    @OneToMany(mappedBy = "survey", cascade = CascadeType.ALL)
    /**
     * A list containing the answers associated with this survey.
     * Each element in the list represents a set of answers provided by a respondent.
     */
    private List<SurveyAnswers> answers;

    @OneToMany(mappedBy = "survey")
    @Builder.Default
    /**
     * The list of tasks associated with this survey.
     * Each {@link Task} represents an individual unit of work or question within the survey.
     */
    private List<Task> tasks = new ArrayList<>();
}