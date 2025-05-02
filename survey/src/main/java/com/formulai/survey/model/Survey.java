package com.formulai.survey.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.List;
import java.util.UUID;

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
    private UUID id;
    private String name;
    private String schemaJson;

    @OneToMany(mappedBy = "survey", cascade = CascadeType.ALL)
    private List<SurveyAnswers> answers;
}






