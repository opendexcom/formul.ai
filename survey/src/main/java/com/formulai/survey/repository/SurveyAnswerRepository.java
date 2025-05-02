package com.formulai.survey.repository;

import com.formulai.survey.model.SurveyAnswers;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SurveyAnswerRepository extends JpaRepository<SurveyAnswers, UUID> {
    List<SurveyAnswers> findAllBySurveyId(UUID surveyId);
}
