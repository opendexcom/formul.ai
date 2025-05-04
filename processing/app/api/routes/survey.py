import sys
from datetime import datetime
from datetime import timezone
from pathlib import Path

from app.core.exceptions import NotFoundError
from app.deps import get_analysis_service
from app.deps import get_survey_service
from app.deps import get_task_service
from app.models import AnalysisJobResponse
from app.models import AnalysisTaskStatus
from app.models import ProcessSurveyRequest
from app.services.analysis_service import AnalysisService
from app.services.survey_service import SurveyService
from app.services.task_service import TaskService
from fastapi import APIRouter
from fastapi import BackgroundTasks
from fastapi import Depends
from pydantic import UUID4

router = APIRouter(prefix="/surveys")


# should be POST
@router.get("/{survey_id}/start", response_model=AnalysisJobResponse)
async def start_survey_analysis(
    survey_id: UUID4,
    background_tasks: BackgroundTasks,
    task_service: TaskService = Depends(get_task_service),
    analysis_service: AnalysisService = Depends(get_analysis_service),
    survey_service: SurveyService = Depends(get_survey_service),
):
    """Start asynchronous analysis of a survey"""
    survey = survey_service.get_survey_by_id(survey_id)

    if survey == None:
        print(f"Survey with ID {survey_id} not found")
        sys.stdout.flush()
        raise NotFoundError()
    print(f"Survey with ID {survey_id} found")
    sys.stdout.flush()

    l: list[str] = [
        "I like that we’re using real-world tools like Docker and microservices — good exposure. But honestly, coordination’s been messy. We need clearer ownership per service.",
        "It’s cool we’re blending multiple languages and tools, but context-switching between Java and Python is painful. Feels like overkill for a student project.",
        "I love how ambitious the project is, especially using AI for survey analysis — feels meaningful. But the team’s all over the place skill-wise, which slows things down.",
        "I like that we’re using GitHub seriously — issues, branches, pull requests. But half the team still doesn’t really know Git, which makes merges frustrating.",
        "React frontend looks solid so far, props to whoever’s owning that. But we still haven’t nailed down our API contracts, and it’s breaking stuff constantly.",
        "Cool idea and stack, but we probably should’ve picked one backend language. Java + Python + microservices = too many moving parts for a mostly newbie team.",
        "Docker is a great learning experience — finally feels like we’re building something 'real.' Downside is debugging containers eats way too much time.",
        "I like that we’re treating it like a real product — planning, meetings, reviews. But I wish we spent less time in meetings and more actually coding.",
        "Feels good seeing everyone improve. Some people came in barely knowing Git, now they’re doing pull requests. But onboarding new members is still painful.",
        "I’m proud we’re pulling off microservices, even in a rough way. Just wish we spent more time upfront defining how they’d talk to each other.",
        "Survey AI analysis is a solid use case. But labeling training data manually? Ugh. We need a better workflow for that.",
        "Really like how we split work — frontend/backend/devops. But we’re lacking real integration testing, so services often don’t play nice.",
        "Fun project, even if chaotic. Everyone’s learning fast. But we need more code reviews — too many bugs sneak in.",
        "Honestly, I’m surprised how far we’ve come given how many of us started clueless. But I’d kill for a better README and setup guide.",
        "Cool tech stack, solid project idea, and I like the energy. But right now, too much tech for too little process — we need to simplify or organize better.",
    ]
    # for answer in survey.answers:
    #     l.append(answer.answersJson)

    answersJsons = [answer.answersJson for answer in survey.answers]
    print(f"{survey=}")
    print(f"{answersJsons=}")
    survey_data = ProcessSurveyRequest(
        survey_id=survey.id,
        question="What do you think about this project so far, what do you like, what you dislike?",
        answers=l,
    )

    job = task_service.create_task(survey_id, AnalysisTaskStatus.IN_PROGRESS)

    write_to_file = False

    async def worker(survey_data: ProcessSurveyRequest):
        now = datetime.now(timezone.utc)
        print(f"Starting analysis_service {now=}")
        llm_reponse = await analysis_service.start_survey_analysis(survey_data)
        print(f"Finished analysis_service {now=}")
        if write_to_file:
            filename = Path(f"./data/{now}.json")
            filename.parent.mkdir(parents=True, exist_ok=True)
            with open(filename, "w") as f:
                f.write(llm_reponse)
            print(f"response written to {filename}")
        task_service.complete_task(job, llm_reponse)

        sys.stdout.flush()

    background_tasks.add_task(worker, survey_data)

    return AnalysisJobResponse(
        survey_id=job.survey_id, id=job.id, status=job.status, created_at=job.created_at
    )


# @router.get("/{survey_id}/status", response_model=AnalysisJobStatusResponse)
# async def get_survey_analysis_status(
#     survey_id: str,
#     db: Session = Depends(get_db)
# ):
#     """Get the status of a survey analysis"""
#     job = db.exec(select(AnalysisJob).where(AnalysisJob.survey_id == survey_id).order_by(AnalysisJob.created_at.desc())).first()
#     if not job:
#         raise HTTPException(status_code=404, detail="Analysis job not found")
#     return job
