package com.formulai.survey.repository;

import com.formulai.survey.model.SurveyAnswers;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SurveyAnswerRepository extends JpaRepository<SurveyAnswers, String> {
}
