from datetime import datetime
from datetime import timezone
from pathlib import Path

from app.core.exceptions import NotFoundError
from app.models import AnalysisJobResponse
from app.models import ProcessSurveyRequest
from app.models import TaskStatus
from app.services.analysis_service import AnalysisService
from app.services.survey_service import SurveyService
from app.services.task_service import TaskService
from fastapi import BackgroundTasks
from ollama import ResponseError
from pydantic import UUID4


class ProcessingService:
    def __init__(
        self,
        task_service: TaskService,
        analysis_service: AnalysisService,
        survey_service: SurveyService,
    ):
        self.task_service = task_service
        self.analysis_service = analysis_service
        self.survey_service = survey_service

    async def prepare_survey_analysis_task(
        self, survey_id: UUID4
    ) -> tuple[ProcessSurveyRequest, AnalysisJobResponse]:
        """Prepare survey analysis task by creating task and preparing survey data"""
        survey = await self.survey_service.get_survey_by_id(survey_id)

        if survey == None:
            raise NotFoundError()

        answersJsons = [answer.answersJson for answer in survey.answers]
        print(f"{survey=}")
        print(f"{answersJsons=}")
        survey_data = ProcessSurveyRequest(
            survey_id=survey.id,
            question="What do you think about this project so far, what do you like, what you dislike?",
            answers=answersJsons,
        )

        task = await self.task_service.create_task(survey_id, TaskStatus.IN_PROGRESS)

        response = AnalysisJobResponse(
            survey_id=task.survey_id,
            id=task.id,
            status=task.status,
            created_at=task.created_at,
        )
        
        return survey_data, response

    async def execute_survey_analysis(self, survey_data: ProcessSurveyRequest, task_id: UUID4):
        """Execute survey analysis task"""
        write_to_file = False
        task = await self.task_service.get_task_by_id(task_id)
        
        start_time = datetime.now(timezone.utc)
        print(f"Starting analysis_service {start_time=}")
        try:
            llm_reponse = await self.analysis_service.start_survey_analysis(survey_data)
        except ResponseError as e:
            print(f"Ollama server error {e}")
            task.status = TaskStatus.ERROR
            await self.task_service.update_task(task)
            return

        end_time = datetime.now(timezone.utc)
        print(f"Finished analysis_service {end_time=}")
        if write_to_file:
            filename = Path(f"./data/{start_time}.json")
            filename.parent.mkdir(parents=True, exist_ok=True)
            with open(filename, "w") as f:
                f.write(llm_reponse)
            print(f"response written to {filename}")
        await self.task_service.complete_task(task, llm_reponse)

    async def start_survey_analysis(
        self, survey_id: UUID4
    ) -> tuple[AnalysisJobResponse, callable]:
        """Start asynchronous analysis of a survey"""
        survey_data, response = await self.prepare_survey_analysis_task(survey_id)
        
        async def worker():
            await self.execute_survey_analysis(survey_data, response.id)
        
        return response, worker
