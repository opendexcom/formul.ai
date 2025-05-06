import sys
from datetime import datetime
from datetime import timezone
from pathlib import Path

from app.core.exceptions import NotFoundError
from app.deps import get_analysis_service
from app.deps import get_survey_service
from app.deps import get_task_service
from app.models import AnalysisJobResponse
from app.models import ProcessSurveyRequest
from app.models import TaskStatus
from app.services.analysis_service import AnalysisService
from app.services.survey_service import SurveyService
from app.services.task_service import TaskService
from fastapi import APIRouter
from fastapi import BackgroundTasks
from fastapi import Depends
from ollama import ResponseError
from pydantic import UUID4

router = APIRouter(prefix="/surveys")


@router.post("/{survey_id}/start", response_model=AnalysisJobResponse)
async def start_survey_analysis(
    survey_id: UUID4,
    background_tasks: BackgroundTasks,
    task_service: TaskService = Depends(get_task_service),
    analysis_service: AnalysisService = Depends(get_analysis_service),
    survey_service: SurveyService = Depends(get_survey_service),
):
    """Start asynchronous analysis of a survey"""
    survey = await survey_service.get_survey_by_id(survey_id)

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

    task = await task_service.create_task(survey_id, TaskStatus.IN_PROGRESS)

    write_to_file = False

    async def worker(survey_data: ProcessSurveyRequest):
        start_time = datetime.now(timezone.utc)
        print(f"Starting analysis_service {start_time=}")
        try:
            llm_reponse = await analysis_service.start_survey_analysis(survey_data)
        except ResponseError as e:
            print(f"Ollama server error {e}")
            task.status = TaskStatus.ERROR
            await task_service.update_task(task)
            return

        end_time = datetime.now(timezone.utc)
        print(f"Finished analysis_service {end_time=}")
        if write_to_file:
            filename = Path(f"./data/{start_time}.json")
            filename.parent.mkdir(parents=True, exist_ok=True)
            with open(filename, "w") as f:
                f.write(llm_reponse)
            print(f"response written to {filename}")
        await task_service.complete_task(task, llm_reponse)

    background_tasks.add_task(worker, survey_data)

    return AnalysisJobResponse(
        survey_id=task.survey_id,
        id=task.id,
        status=task.status,
        created_at=task.created_at,
    )
